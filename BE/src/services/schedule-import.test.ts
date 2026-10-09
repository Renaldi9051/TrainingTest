import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockDb, passThroughTransactions, type MockDb } from "@/test/mock-db";

const db = vi.hoisted(() => ({ current: undefined as unknown }));
vi.mock("@/lib/db", () => ({ getDb: () => db.current }));
const revalidate = vi.hoisted(() => vi.fn<(tags: string[]) => Promise<boolean>>(async () => true));
vi.mock("@/lib/revalidate", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/revalidate")>()),
  revalidateTags: revalidate,
}));

import {
  importSchedules,
  parsePrice,
  readImportCsv,
  scheduleImportTemplate,
  validateImportRows,
} from "@/services/schedule-import";

const HEADER = "training_slug,start_date,end_date,city,venue,method,price,status";
const lookup = new Map([["kpi", { id: "t1", title: "KPI" }]]);
const validate = (lines: string[]) => validateImportRows(readImportCsv([HEADER, ...lines].join("\n")).rows, lookup);

let mock: MockDb;
beforeEach(() => {
  mock = createMockDb();
  db.current = mock;
  passThroughTransactions(mock);
  revalidate.mockClear();
});

describe("parsePrice", () => {
  it.each([
    ["4500000", 4500000],
    ["Rp4.500.000", 4500000],
    ["4,500,000", 4500000],
    ["", null],
    ["4,5 juta", "invalid"],
    ["-100", "invalid"],
  ])("%s -> %s", (input, expected) => {
    expect(parsePrice(input)).toBe(expected);
  });
});

describe("readImportCsv", () => {
  it("menolak header yang tidak sesuai template", () => {
    expect(() => readImportCsv("slug,tanggal\nkpi,2026-11-01")).toThrow(/Header CSV tidak sesuai/);
  });

  it("menolak CSV tanpa baris data", () => {
    expect(() => readImportCsv(`${HEADER}\n`)).toThrow(/tidak berisi baris data/);
  });

  it("kolom opsional boleh tidak ada", () => {
    const { rows } = readImportCsv("training_slug,start_date,end_date,method\nkpi,2026-11-01,2026-11-02,online");
    expect(rows[0].values).toMatchObject({ city: "", price: "", status: "" });
  });
});

describe("validateImportRows", () => {
  it("baris valid diubah ke data jadwal (status kosong = DIBUKA)", () => {
    const [row] = validate(["kpi,2026-11-17,2026-11-18,Jakarta,Ruang A,Offline,Rp4.500.000,"]);
    expect(row.errors).toEqual([]);
    expect(row.data).toEqual({
      trainingId: "t1",
      trainingTitle: "KPI",
      startDate: "2026-11-17",
      endDate: "2026-11-18",
      city: "Jakarta",
      venue: "Ruang A",
      method: "OFFLINE",
      price: 4500000,
      status: "OPEN",
    });
  });

  it("error per baris: slug, tanggal, urutan tanggal, metode, status, harga", () => {
    const rows = validate([
      "tidak-ada,2026-11-17,2026-11-18,,,online,,DIBUKA",
      "kpi,2026-02-31,2026-03-01,,,online,,",
      "kpi,2026-11-18,2026-11-17,,,online,,",
      "kpi,2026-11-17,2026-11-18,,,tatap muka,,",
      "kpi,2026-11-17,2026-11-18,,,online,,BATAL",
      "kpi,2026-11-17,2026-11-18,,,online,empat juta,",
    ]);
    expect(rows.map((row) => row.errors.length > 0)).toEqual([true, true, true, true, true, true]);
    expect(rows[0].errors[0]).toMatch(/tidak-ada.*tidak ditemukan/);
    expect(rows[1].errors[0]).toMatch(/start_date/);
    expect(rows[2].errors[0]).toMatch(/sebelum start_date/);
    expect(rows[3].errors[0]).toMatch(/method/);
    expect(rows[4].errors[0]).toMatch(/status/);
    expect(rows[5].errors[0]).toMatch(/price/);
    expect(rows.every((row) => row.data === null)).toBe(true);
  });

  it("baris duplikat di file yang sama ditandai", () => {
    const rows = validate(["kpi,2026-11-17,2026-11-18,Jakarta,,online,,", "kpi,2026-11-17,2026-11-18,jakarta,,online,,"]);
    expect(rows[1].errors).toEqual(["Duplikat dengan baris 2."]);
  });

  it("template bisa dibaca ulang tanpa error", () => {
    const rows = validateImportRows(readImportCsv(scheduleImportTemplate("kpi")).rows, lookup);
    expect(rows.every((row) => row.errors.length === 0)).toBe(true);
  });
});

describe("importSchedules", () => {
  const csv = [HEADER, "kpi,2026-11-17,2026-11-18,Jakarta,,offline,4500000,DIBUKA", "kpi,2026-12-01,2026-12-01,,,online,,"].join("\n");

  beforeEach(() => {
    mock.training.findMany.mockResolvedValue([{ id: "t1", slug: "kpi", title: "KPI" }]);
  });

  it("dryRun: hanya preview, tidak menyimpan", async () => {
    const result = await importSchedules({ csv, dryRun: true }, "u1");
    expect(result).toMatchObject({ validCount: 2, invalidCount: 0, created: 0 });
    expect(mock.schedule.createMany).not.toHaveBeenCalled();
  });

  it("simpan: semua baris dalam satu transaksi, audit IMPORT, revalidate jadwal + pelatihan", async () => {
    const result = await importSchedules({ csv, dryRun: false }, "u1");
    expect(result.created).toBe(2);
    expect(mock.$transaction).toHaveBeenCalledTimes(1);
    expect(mock.schedule.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(mock.auditLog.create.mock.calls[0][0].data).toMatchObject({ action: "IMPORT", entity: "Schedule" });
    expect(revalidate).toHaveBeenCalledWith(["schedules", "training:kpi"]);
  });

  it("ada satu baris salah: 422 dan tidak ada yang disimpan", async () => {
    const bad = `${csv}\nkpi,2026-13-01,2026-13-02,,,online,,`;
    await expect(importSchedules({ csv: bad, dryRun: false }, "u1")).rejects.toMatchObject({
      status: 422,
      code: "IMPORT_INVALID",
      details: { validCount: 2, invalidCount: 1 },
    });
    expect(mock.schedule.createMany).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });
});
