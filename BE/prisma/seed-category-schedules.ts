// Jadwal untuk kategori berawalan A dan B (pemilik, 22 Okt 2026): 5 jadwal per kategori, masing-masing
// untuk pelatihan yang berbeda, sekali per versi. Lewat service admin (audit + revalidate) atas nama admin
// pertama, jadi jadwalnya bisa diubah atau dihapus dari admin seperti jadwal lain.
// - Pelatihan: tampil di publik, belum punya jadwal yang akan datang; urut terbaru.
// - Jadwal yang akan datang yang sudah ada di kategori itu ikut dihitung, jadi seed tidak menambah lebih dari 5.
// - Tanggal: 2 hari, mulai Senin-Rabu, tersebar 2 sampai 17 minggu dari hari ini (WIB).
import { getDb } from "../src/lib/db";
import { withRevalidateBatch } from "../src/lib/revalidate-map";
import { appDateString, appToday } from "../src/lib/time";
import { scheduleCreateSchema, type ScheduleCreateInput } from "../src/lib/validators/schedule";
import { createSchedule } from "../src/services/schedule";
import { publicTrainingWhere } from "../src/services/training-visibility";
import { JOGJA_LOCATIONS } from "./seed-data/jogja-locations";

export const CATEGORY_SCHEDULES_KEY = "seed.categorySchedules.version";
export const CATEGORY_SCHEDULES_VERSION = "2026-10-22-ab-5";
export const SCHEDULES_PER_CATEGORY = 5;
export const CATEGORY_SCHEDULE_SLUGS = [
  "accounting",
  "administrative",
  "agrobisnis",
  "akuakultur",
  "alignment",
  "analysis",
  "anger",
  "arsitektur",
  "assurance",
  "audit",
  "balanced-scorecard",
  "banking",
  "batu-bara",
  "behavioral",
  "budgeting",
  "building",
  "business",
];

const METHODS = ["OFFLINE", "ONLINE", "OFFLINE", "HYBRID", "ONLINE"] as const;
const CITIES = JOGJA_LOCATIONS;
const ONLINE_VENUE = "Zoom";
const PRICES = [5_500_000, 6_000_000, 6_500_000, 7_000_000, 7_500_000];
const ONLINE_DISCOUNT = 1_500_000;
const DURATION_DAYS = 2;

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// Senin pada atau sesudah `date`.
function nextMonday(date: string): string {
  const weekday = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return addDays(date, (8 - weekday) % 7);
}

// Jadwal ke-`slot` kategori ke-`categoryIndex`, tanpa trainingId. Murni supaya bisa diuji.
export function buildCategorySchedule(today: string, categoryIndex: number, slot: number): Omit<ScheduleCreateInput, "trainingId"> {
  const week = 2 + slot * 3 + (categoryIndex % 3);
  const startDate = addDays(nextMonday(addDays(today, week * 7)), categoryIndex % 3);
  const method = METHODS[(slot + categoryIndex) % METHODS.length];
  const [city, venue] = CITIES[(slot * 2 + categoryIndex) % CITIES.length];
  const price = PRICES[(slot + categoryIndex * 2) % PRICES.length];
  return {
    startDate,
    endDate: addDays(startDate, DURATION_DAYS - 1),
    city: method === "ONLINE" ? null : city,
    venue: method === "ONLINE" ? ONLINE_VENUE : venue,
    method,
    price: method === "ONLINE" ? price - ONLINE_DISCOUNT : price,
    status: "OPEN",
  };
}

export type CategorySchedulesResult = { created: number; summary: { slug: string; before: number; after: number }[]; failed: string[] };

export async function seedCategorySchedules(now = new Date()): Promise<CategorySchedulesResult | "dilewati"> {
  const db = getDb();
  const done = await db.siteSetting.findUnique({ where: { key: CATEGORY_SCHEDULES_KEY }, select: { value: true } });
  if (done?.value === CATEGORY_SCHEDULES_VERSION) return "dilewati";
  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const today = appDateString(now);
  const upcoming = { deletedAt: null, endDate: { gte: appToday(now) } };

  const categories = await db.category.findMany({
    where: { slug: { in: CATEGORY_SCHEDULE_SLUGS }, deletedAt: null },
    select: { id: true, slug: true },
  });
  const ordered = CATEGORY_SCHEDULE_SLUGS.flatMap((slug) => categories.filter((category) => category.slug === slug));
  const summary: CategorySchedulesResult["summary"] = [];
  const failed: string[] = [];
  const taken = new Set<string>();
  let created = 0;

  await withRevalidateBatch(async () => {
    for (const [categoryIndex, category] of ordered.entries()) {
      const trainings = await db.training.findMany({
        where: { ...publicTrainingWhere(now), categories: { some: { categoryId: category.id } } },
        orderBy: [{ publishedAt: "desc" }, { slug: "asc" }],
        select: { id: true, slug: true, _count: { select: { schedules: { where: upcoming } } } },
      });
      const before = trainings.reduce((sum, training) => sum + training._count.schedules, 0);
      const picks = trainings
        .filter((training) => training._count.schedules === 0 && !taken.has(training.id))
        .slice(0, Math.max(0, SCHEDULES_PER_CATEGORY - before));
      let after = before;
      for (const [index, training] of picks.entries()) {
        taken.add(training.id);
        const input = scheduleCreateSchema.parse({
          trainingId: training.id,
          ...buildCategorySchedule(today, categoryIndex, before + index),
        });
        try {
          await createSchedule(input, owner.id);
          created += 1;
          after += 1;
        } catch (error) {
          failed.push(`${training.slug} (${error instanceof Error ? error.message : String(error)})`);
        }
      }
      summary.push({ slug: category.slug, before, after });
    }
  });

  await db.siteSetting.upsert({
    where: { key: CATEGORY_SCHEDULES_KEY },
    create: { key: CATEGORY_SCHEDULES_KEY, value: CATEGORY_SCHEDULES_VERSION },
    update: { value: CATEGORY_SCHEDULES_VERSION },
  });
  return { created, summary, failed };
}
