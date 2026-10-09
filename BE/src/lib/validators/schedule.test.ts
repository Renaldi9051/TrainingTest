import { describe, expect, it } from "vitest";
import { appDateString, appToday, monthRange } from "@/lib/time";
import {
  isValidDateString,
  publicScheduleQuerySchema,
  scheduleCreateSchema,
} from "@/lib/validators/schedule";
import { scheduleDisplayStatus } from "@/services/schedule-status";

const TRAINING = "0199b4d0-0000-7000-8000-000000000001";
const base = { trainingId: TRAINING, startDate: "2026-11-17", endDate: "2026-11-18", method: "OFFLINE" };

describe("scheduleCreateSchema", () => {
  it("default status DIBUKA, harga & kota opsional", () => {
    expect(scheduleCreateSchema.parse(base)).toMatchObject({ status: "OPEN", price: null, city: null });
  });

  it("tanggal selesai tidak boleh sebelum tanggal mulai", () => {
    const result = scheduleCreateSchema.safeParse({ ...base, endDate: "2026-11-16" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["endDate"]);
  });

  it("tanggal harus benar-benar ada; harga bulat non-negatif", () => {
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(isValidDateString("2028-02-29")).toBe(true);
    expect(scheduleCreateSchema.safeParse({ ...base, startDate: "17/11/2026" }).success).toBe(false);
    expect(scheduleCreateSchema.safeParse({ ...base, price: -1 }).success).toBe(false);
    expect(scheduleCreateSchema.safeParse({ ...base, price: 10.5 }).success).toBe(false);
  });
});

describe("publicScheduleQuerySchema", () => {
  it("bulan YYYY-MM; nilai salah diabaikan", () => {
    expect(publicScheduleQuerySchema.parse({ bulan: "2026-11", kota: " Jakarta " })).toMatchObject({
      bulan: "2026-11",
      kota: "Jakarta",
    });
    expect(publicScheduleQuerySchema.parse({ bulan: "2026-13", kategori: "Bukan Slug" })).toMatchObject({
      bulan: undefined,
      kategori: undefined,
    });
  });
});

describe("waktu WIB & status jadwal turunan", () => {
  it("hari ini dihitung di WIB (UTC+7)", () => {
    expect(appDateString(new Date("2026-10-09T16:59:00Z"))).toBe("2026-10-09");
    expect(appDateString(new Date("2026-10-09T17:00:00Z"))).toBe("2026-10-10");
    expect(appToday(new Date("2026-10-09T17:00:00Z"))).toEqual(new Date("2026-10-10T00:00:00Z"));
  });

  it("monthRange untuk kolom tanggal", () => {
    expect(monthRange("2026-12")).toEqual({
      start: new Date("2026-12-01T00:00:00Z"),
      end: new Date("2027-01-01T00:00:00Z"),
    });
  });

  it("sesi yang tanggal selesainya lewat tampil SELESAI walau status belum diubah", () => {
    const today = new Date("2026-10-10T00:00:00Z");
    expect(scheduleDisplayStatus({ status: "OPEN", endDate: new Date("2026-10-09T00:00:00Z") }, today)).toBe("COMPLETED");
    expect(scheduleDisplayStatus({ status: "OPEN", endDate: today }, today)).toBe("OPEN");
    expect(scheduleDisplayStatus({ status: "FULL", endDate: new Date("2026-10-20T00:00:00Z") }, today)).toBe("FULL");
  });
});
