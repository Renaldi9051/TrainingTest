// Pindahkan lokasi jadwal ke area Jogja (pemilik, 28 Okt 2026), sekali per versi. Hanya jadwal buatan seed:
// pasangan kota + tempat yang persis sama dengan daftar kota seed lama (SEED_LOCATIONS). Jadwal yang dibuat
// atau diubah admin dengan tempat lain tidak disentuh, begitu juga jadwal online (tanpa kota) dan jadwal
// yang sudah di area Jogja. Kota & tempat Jogja diberikan bergiliran (urut tanggal mulai), lewat service
// admin (audit + revalidate) atas nama admin pertama.
import { getDb } from "../src/lib/db";
import { withRevalidateBatch } from "../src/lib/revalidate-map";
import { scheduleUpdateSchema } from "../src/lib/validators/schedule";
import { updateSchedule } from "../src/services/schedule";
import { JOGJA_CITIES, JOGJA_LOCATIONS } from "./seed-data/jogja-locations";

export const SCHEDULE_LOCATIONS_KEY = "seed.scheduleLocations.version";
export const SCHEDULE_LOCATIONS_VERSION = "2026-10-28-jogja";

// [kota, tempat] yang pernah dibuat seed sebelum dibatasi ke Jogja: katalog contoh (seed-data/catalog.ts),
// jadwal kategori A-B (seed-category-schedules.ts), dan seed bulk (tempat "Ruang pelatihan").
export const SEED_LOCATIONS: readonly (readonly [string, string])[] = [
  ["Jakarta", "Ruang pelatihan, Jakarta Selatan"],
  ["Bandung", "Hotel mitra, Bandung"],
  ["Surabaya", "Ruang pelatihan, Surabaya"],
  ["Semarang", "Ruang pelatihan, Semarang"],
  ["Medan", "Hotel mitra, Medan"],
  ["Makassar", "Ruang pelatihan, Makassar"],
  ["Denpasar", "Hotel mitra, Denpasar"],
  ["Balikpapan", "Ruang pelatihan, Balikpapan"],
  ["Palembang", "Hotel mitra, Palembang"],
  ["Batam", "Hotel mitra, Batam"],
  ...["Jakarta", "Bandung", "Surabaya", "Bali", "Medan", "Makassar", "Batam"].map((city) => [city, "Ruang pelatihan"] as const),
];

// Lokasi Jogja untuk jadwal ke-`index` yang dipindah. Murni supaya bisa diuji.
export function jogjaLocationFor(index: number): { city: string; venue: string } {
  const [city, venue] = JOGJA_LOCATIONS[index % JOGJA_LOCATIONS.length];
  return { city, venue };
}

export type ScheduleLocationsResult = {
  moved: number;
  byCity: Record<string, number>;
  // Jadwal di luar Jogja yang bukan buatan seed (dibiarkan).
  kept: number;
  failed: string[];
};

export async function seedScheduleLocations(): Promise<ScheduleLocationsResult | "dilewati"> {
  const db = getDb();
  const done = await db.siteSetting.findUnique({ where: { key: SCHEDULE_LOCATIONS_KEY }, select: { value: true } });
  if (done?.value === SCHEDULE_LOCATIONS_VERSION) return "dilewati";
  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });

  const outside = { deletedAt: null, city: { not: null, notIn: [...JOGJA_CITIES] } };
  const [rows, total] = await Promise.all([
    db.schedule.findMany({
      where: { ...outside, OR: SEED_LOCATIONS.map(([city, venue]) => ({ city, venue })) },
      orderBy: [{ startDate: "asc" }, { id: "asc" }],
      select: { id: true },
    }),
    db.schedule.count({ where: outside }),
  ]);
  const byCity: Record<string, number> = {};
  const failed: string[] = [];
  let moved = 0;

  await withRevalidateBatch(async () => {
    for (const [index, row] of rows.entries()) {
      const location = jogjaLocationFor(index);
      try {
        await updateSchedule(row.id, scheduleUpdateSchema.parse(location), owner.id);
        moved += 1;
        byCity[location.city] = (byCity[location.city] ?? 0) + 1;
      } catch (error) {
        failed.push(`${row.id} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  });

  await db.siteSetting.upsert({
    where: { key: SCHEDULE_LOCATIONS_KEY },
    create: { key: SCHEDULE_LOCATIONS_KEY, value: SCHEDULE_LOCATIONS_VERSION },
    update: { value: SCHEDULE_LOCATIONS_VERSION },
  });
  return { moved, byCity, kept: total - rows.length, failed };
}
