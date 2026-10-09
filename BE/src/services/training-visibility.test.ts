import { describe, expect, it } from "vitest";
import { publicState } from "@/services/training";
import { isPubliclyVisible, publicTrainingWhere } from "@/services/training-visibility";

const now = new Date("2026-10-10T05:00:00.000Z");
const past = new Date("2026-10-01T00:00:00.000Z");
const future = new Date("2026-10-10T05:00:01.000Z");

describe("aturan tampil publik pelatihan", () => {
  it("hanya PUBLISHED, belum dihapus, dan publishedAt <= sekarang", () => {
    expect(isPubliclyVisible({ status: "PUBLISHED", publishedAt: past, deletedAt: null }, now)).toBe(true);
    expect(isPubliclyVisible({ status: "PUBLISHED", publishedAt: now, deletedAt: null }, now)).toBe(true);
  });

  it("draft tidak tampil", () => {
    expect(isPubliclyVisible({ status: "DRAFT", publishedAt: past, deletedAt: null }, now)).toBe(false);
  });

  it("publishedAt di masa depan tidak tampil", () => {
    expect(isPubliclyVisible({ status: "PUBLISHED", publishedAt: future, deletedAt: null }, now)).toBe(false);
  });

  it("dihapus atau tanpa publishedAt tidak tampil", () => {
    expect(isPubliclyVisible({ status: "PUBLISHED", publishedAt: past, deletedAt: past }, now)).toBe(false);
    expect(isPubliclyVisible({ status: "PUBLISHED", publishedAt: null, deletedAt: null }, now)).toBe(false);
  });

  it("filter query publik sama dengan aturan di atas", () => {
    expect(publicTrainingWhere(now)).toEqual({
      deletedAt: null,
      status: "PUBLISHED",
      publishedAt: { lte: now },
    });
  });

  it("status turunan untuk admin: DRAFT / SCHEDULED / PUBLISHED", () => {
    expect(publicState({ status: "DRAFT", publishedAt: past }, now)).toBe("DRAFT");
    expect(publicState({ status: "PUBLISHED", publishedAt: future }, now)).toBe("SCHEDULED");
    expect(publicState({ status: "PUBLISHED", publishedAt: past }, now)).toBe("PUBLISHED");
  });
});
