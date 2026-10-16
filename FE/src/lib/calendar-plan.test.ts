import { describe, expect, it } from "vitest";
import { byStartDate, monthCells, monthLabel, rangeLabel, shiftMonth, weeksOf } from "@/lib/calendar-plan";

describe("monthCells", () => {
  it("minggu mulai Senin; November 2026 dimulai Minggu (6 sel pengisi)", () => {
    const cells = monthCells("2026-11");
    expect(cells[0]).toEqual({ date: "2026-10-26", day: 26, inMonth: false });
    expect(cells[6]).toEqual({ date: "2026-11-01", day: 1, inMonth: true });
    expect(cells.length % 7).toBe(0);
    expect(cells.filter((cell) => cell.inMonth)).toHaveLength(30);
    expect(cells.at(-1)?.date).toBe("2026-12-06");
  });

  it("Februari 2027 (mulai Senin) tanpa pengisi di depan", () => {
    const cells = monthCells("2027-02");
    expect(cells[0]).toEqual({ date: "2027-02-01", day: 1, inMonth: true });
    expect(weeksOf(cells)).toHaveLength(4);
  });

  it("bulan tidak valid ditolak", () => {
    expect(() => monthCells("2026-13")).toThrow();
  });
});

describe("label", () => {
  it("rentang hari di teks: satu hari, satu bulan, lintas bulan", () => {
    expect(rangeLabel("2026-11-12", "2026-11-12")).toBe("12 NOV");
    expect(rangeLabel("2026-11-12", "2026-11-14")).toBe("12-14 NOV");
    expect(rangeLabel("2026-11-30", "2026-12-02")).toBe("30 NOV-2 DES");
  });

  it("nama & geser bulan", () => {
    expect(monthLabel("2026-10")).toBe("Oktober 2026");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("sesi dikelompokkan per tanggal mulai", () => {
    const groups = byStartDate([
      { id: "a", startDate: "2026-11-12" },
      { id: "b", startDate: "2026-11-19" },
      { id: "c", startDate: "2026-11-12" },
    ]);
    expect(groups.get("2026-11-12")?.map((item) => item.id)).toEqual(["a", "c"]);
  });
});
