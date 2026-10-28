// Pindahkan lokasi jadwal ke hotel/gedung nyata di area Jogja (pemilik, 28 Okt 2026), sekali per versi: semua
// jadwal offline/hybrid yang kotanya di luar Jogja (semua jadwal yang ada dibuat seed, kata pemilik) atau yang
// masih memakai tempat generik seed sebelumnya (GENERIC_VENUES). Jadwal online (tanpa kota) dan jadwal Jogja
// dengan tempat lain tidak disentuh. Lokasi diberikan bergiliran (urut tanggal mulai), lewat service admin
// (audit + revalidate) atas nama admin pertama.
import { getDb } from "../src/lib/db";
import { withRevalidateBatch } from "../src/lib/revalidate-map";
import { scheduleUpdateSchema } from "../src/lib/validators/schedule";
import { updateSchedule } from "../src/services/schedule";
import { GENERIC_VENUES, JOGJA_CITIES, JOGJA_LOCATIONS } from "./seed-data/jogja-locations";

export const SCHEDULE_LOCATIONS_KEY = "seed.scheduleLocations.version";
export const SCHEDULE_LOCATIONS_VERSION = "2026-10-28-jogja-venues";

// Lokasi Jogja untuk jadwal ke-`index` yang dipindah. Murni supaya bisa diuji.
export function jogjaLocationFor(index: number): { city: string; venue: string } {
  const [city, venue] = JOGJA_LOCATIONS[index % JOGJA_LOCATIONS.length];
  return { city, venue };
}

export type ScheduleLocationsResult = { moved: number; byCity: Record<string, number>; failed: string[] };

export async function seedScheduleLocations(): Promise<ScheduleLocationsResult | "dilewati"> {
  const db = getDb();
  const done = await db.siteSetting.findUnique({ where: { key: SCHEDULE_LOCATIONS_KEY }, select: { value: true } });
  if (done?.value === SCHEDULE_LOCATIONS_VERSION) return "dilewati";
  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });

  const rows = await db.schedule.findMany({
    where: {
      deletedAt: null,
      city: { not: null },
      OR: [{ city: { notIn: [...JOGJA_CITIES] } }, { venue: { in: [...GENERIC_VENUES] } }],
    },
    orderBy: [{ startDate: "asc" }, { id: "asc" }],
    select: { id: true },
  });
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
  return { moved, byCity, failed };
}
