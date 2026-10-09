import { describe, expect, it } from "vitest";
import { formatDateRange, fromWibInputValue, toWibInputValue } from "@/lib/format";

describe("waktu publish WIB", () => {
  it("ISO <-> datetime-local dibaca sebagai WIB", () => {
    expect(toWibInputValue("2026-11-01T02:00:00.000Z")).toBe("2026-11-01T09:00");
    expect(fromWibInputValue("2026-11-01T09:00")).toBe("2026-11-01T09:00:00+07:00");
    expect(new Date(fromWibInputValue("2026-11-01T09:00") ?? "").toISOString()).toBe("2026-11-01T02:00:00.000Z");
    expect(fromWibInputValue("")).toBeNull();
    expect(toWibInputValue(null)).toBe("");
  });
});

describe("formatDateRange", () => {
  it("menyingkat bulan/tahun yang sama", () => {
    expect(formatDateRange("2026-11-17", "2026-11-17")).toBe("17 Nov 2026");
    expect(formatDateRange("2026-11-17", "2026-11-18")).toBe("17-18 Nov 2026");
    expect(formatDateRange("2026-11-30", "2026-12-01")).toBe("30 Nov - 1 Des 2026");
    expect(formatDateRange("2026-12-31", "2027-01-02")).toBe("31 Des 2026 - 2 Jan 2027");
  });
});
