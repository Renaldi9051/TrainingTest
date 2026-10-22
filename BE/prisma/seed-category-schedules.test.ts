import { describe, expect, it } from "vitest";
import { scheduleCreateSchema } from "../src/lib/validators/schedule";
import { CATEGORY_FILL_SLUGS } from "./seed-category-fill";
import { buildCategorySchedule, CATEGORY_SCHEDULE_SLUGS, SCHEDULES_PER_CATEGORY } from "./seed-category-schedules";
import { referenceCategories } from "./seed-data/reference-training";

const TODAY = "2026-10-22";
const all = CATEGORY_SCHEDULE_SLUGS.flatMap((_, categoryIndex) =>
  Array.from({ length: SCHEDULES_PER_CATEGORY }, (__, slot) => buildCategorySchedule(TODAY, categoryIndex, slot)),
);

describe("jadwal kategori A-B", () => {
  it("slug target: kategori referensi berawalan A atau B, termasuk semua kategori yang diisi", () => {
    const slugs = new Set(referenceCategories.map((category) => category.slug));
    expect(CATEGORY_SCHEDULE_SLUGS.filter((slug) => !slugs.has(slug))).toEqual([]);
    expect(CATEGORY_SCHEDULE_SLUGS.every((slug) => /^[ab]/.test(slug))).toBe(true);
    expect(CATEGORY_FILL_SLUGS.filter((slug) => /^[ab]/.test(slug) && !CATEGORY_SCHEDULE_SLUGS.includes(slug))).toEqual([]);
  });

  it("lolos validator admin, 2 hari, mulai Senin-Rabu, 2-17 minggu ke depan", () => {
    for (const schedule of all) {
      const parsed = scheduleCreateSchema.safeParse({ trainingId: "0199f000-0000-7000-8000-000000000000", ...schedule });
      expect(parsed.success).toBe(true);
      expect(schedule.startDate > addDays(TODAY, 13)).toBe(true);
      expect(schedule.startDate <= addDays(TODAY, 18 * 7)).toBe(true);
      expect(schedule.endDate).toBe(addDays(schedule.startDate, 1));
      expect([1, 2, 3]).toContain(new Date(`${schedule.startDate}T00:00:00.000Z`).getUTCDay());
    }
  });

  it("online tanpa kota dan lebih murah; offline dan hybrid punya kota", () => {
    for (const schedule of all) {
      expect(schedule.method === "ONLINE" ? schedule.city === null : schedule.city !== null).toBe(true);
    }
    expect(new Set(all.map((schedule) => schedule.method))).toEqual(new Set(["OFFLINE", "ONLINE", "HYBRID"]));
    expect(new Set(all.map((schedule) => schedule.city)).size).toBeGreaterThan(5);
  });

  it("jadwal satu kategori tersebar di tanggal berbeda", () => {
    for (const [categoryIndex] of CATEGORY_SCHEDULE_SLUGS.entries()) {
      const starts = Array.from({ length: SCHEDULES_PER_CATEGORY }, (_, slot) => buildCategorySchedule(TODAY, categoryIndex, slot).startDate);
      expect(new Set(starts).size).toBe(SCHEDULES_PER_CATEGORY);
    }
  });
});

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
