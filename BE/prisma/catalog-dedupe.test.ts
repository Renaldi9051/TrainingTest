import { describe, expect, it } from "vitest";
import { type DedupeRow, fromSeedUntouched, planDedupe } from "./catalog-dedupe";

const seedCreate = { action: "CREATE", diff: { categoryIds: { from: [], to: ["c"] }, source: "catalog-rest" } };
const tags = { action: "UPDATE", diff: { categoryIds: { from: ["c"], to: ["c", "d"] }, source: "catalog-tags" } };
const photos = { action: "UPDATE", diff: { coverId: { from: null, to: "m" } } };
const adminEdit = { action: "UPDATE", diff: { title: { from: "a", to: "b" } } };

const row = (slug: string, title: string, day: number, audits: DedupeRow["audits"]): DedupeRow => ({
  id: `id-${slug}`,
  slug,
  title,
  createdAt: new Date(Date.UTC(2026, 10, day)),
  audits,
});

describe("perapian judul kembar", () => {
  it("hasil seed tanpa suntingan admin boleh ke Sampah; seed lain & foto tidak dihitung suntingan", () => {
    expect(fromSeedUntouched([seedCreate, tags, photos])).toBe(true);
    expect(fromSeedUntouched([seedCreate, adminEdit])).toBe(false);
    expect(fromSeedUntouched([adminEdit])).toBe(false);
  });

  it("pertahankan baris lama, buang kembar dari seed; kelompok tanpa baris seed hanya dilaporkan", () => {
    const groups = planDedupe([
      row("fire-lama", "TRAINING FIRE PREVENTION AND PROTECTION SYSTEM", 1, []),
      row("fire-seed", "Training Fire Prevention & Protection System", 11, [seedCreate, tags]),
      row("retail-a", "TRAINING RETAIL MANAGEMENT", 2, []),
      row("retail-b", "TRAINING MANAGEMENT RETAIL", 3, [adminEdit]),
      row("tunggal", "TRAINING AUDIT MUTU", 1, []),
    ]);
    expect(groups.map((group) => [group.keep.slug, group.trash.map((r) => r.slug), group.untouched.map((r) => r.slug)])).toEqual([
      ["fire-lama", ["fire-seed"], []],
      ["retail-a", [], ["retail-b"]],
    ]);
  });

  it("semua dari seed: yang paling awal dipertahankan", () => {
    const [group] = planDedupe([
      row("b", "TRAINING LOAN SYNDICATION & PROJECT FINANCING", 12, [seedCreate]),
      row("a", "TRAINING LOAN SYNDICATION AND PROJECT FINANCING", 11, [seedCreate]),
    ]);
    expect(group.keep.slug).toBe("a");
    expect(group.trash.map((r) => r.slug)).toEqual(["b"]);
  });
});
