import { describe, expect, it } from "vitest";
import { displayTitle, isUntitled, UNTITLED } from "@/lib/display-title";

describe("displayTitle", () => {
  it("judul kosong / spasi saja jadi label UI", () => {
    expect(displayTitle("")).toBe(UNTITLED);
    expect(displayTitle("   ")).toBe(UNTITLED);
    expect(displayTitle(null)).toBe(UNTITLED);
    expect(isUntitled(" ")).toBe(true);
  });

  it("judul berisi tidak diubah (hanya dirapikan spasi tepi)", () => {
    expect(displayTitle("Training KPI")).toBe("Training KPI");
    expect(displayTitle(" Training KPI ")).toBe("Training KPI");
    expect(isUntitled("Training KPI")).toBe(false);
  });
});
