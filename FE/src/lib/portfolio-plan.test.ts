import { describe, expect, it } from "vitest";
import { activityHref, availableActivityTypes, cardSpan, filterPortfolio, parseActivityParam } from "@/lib/portfolio-plan";

const items = [
  { title: "a", activityType: "CLASSROOM" as const },
  { title: "b", activityType: null },
  { title: "c", activityType: "FIELD" as const },
  { title: "d", activityType: "CLASSROOM" as const },
];

describe("filter jenis kegiatan", () => {
  it("parameter Indonesia; nilai tak dikenal = semua", () => {
    expect(parseActivityParam("lapangan")).toBe("FIELD");
    expect(parseActivityParam(["kelas", "x"])).toBe("CLASSROOM");
    expect(parseActivityParam("FIELD")).toBeNull();
    expect(parseActivityParam(undefined)).toBeNull();
    expect(activityHref("CERTIFICATION")).toBe("/profil/portofolio?jenis=sertifikasi");
    expect(activityHref(null)).toBe("/profil/portofolio");
  });

  it("chip hanya jenis yang punya item, urutan tetap; semua null = tidak ada chip", () => {
    expect(availableActivityTypes(items)).toEqual(["FIELD", "CLASSROOM"]);
    expect(availableActivityTypes([{ activityType: null }])).toEqual([]);
  });

  it("filter menyaring; item tanpa jenis hanya di Semua", () => {
    expect(filterPortfolio(items, "CLASSROOM").map((item) => item.title)).toEqual(["a", "d"]);
    expect(filterPortfolio(items, null)).toHaveLength(4);
  });
});

describe("grid asimetris", () => {
  it("pola 7-5 / 4-4-4 / 5-7 / 6, berulang; difilter = 4", () => {
    expect(Array.from({ length: 9 }, (_, index) => cardSpan(index, false))).toEqual([7, 5, 4, 4, 4, 5, 7, 6, 7]);
    expect(cardSpan(0, true)).toBe(4);
  });
});
