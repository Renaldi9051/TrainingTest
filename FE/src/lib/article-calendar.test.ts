import { describe, expect, it } from "vitest";
import { articlesByDate, wibDateKey, wibTimeLabel } from "@/lib/article-calendar";

describe("kalender artikel", () => {
  it("tanggal & jam mengikuti WIB, bukan UTC", () => {
    // 17.30 UTC = 00.30 WIB keesokan harinya.
    expect(wibDateKey("2026-11-02T17:30:00.000Z")).toBe("2026-11-03");
    expect(wibTimeLabel("2026-11-02T17:30:00.000Z")).toBe("00.30");
  });

  it("mengelompokkan per tanggal WIB dan menjaga urutan", () => {
    const items = [
      { id: "a", publishedAt: "2026-11-03T02:00:00.000Z" },
      { id: "b", publishedAt: "2026-11-03T09:00:00.000Z" },
      { id: "c", publishedAt: "2026-11-04T02:00:00.000Z" },
    ];
    const groups = articlesByDate(items);
    expect([...groups.keys()]).toEqual(["2026-11-03", "2026-11-04"]);
    expect(groups.get("2026-11-03")?.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
