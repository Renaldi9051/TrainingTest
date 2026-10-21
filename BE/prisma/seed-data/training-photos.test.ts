import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { trainingPhotosSchema } from "../seed-training-photos";
import { referenceSnapshotSlugs } from "./reference-training";

// Daftar foto unik per pelatihan (gallery/training-photos.json): format, keunikan foto, dan tidak
// memakai ulang foto Pexels yang sudah dipakai foto tema/manifest.
const dir = path.join(__dirname, "gallery");
const photos = trainingPhotosSchema.parse(JSON.parse(readFileSync(path.join(dir, "training-photos.json"), "utf8")));
const entries = Object.entries(photos.trainings);
const ids = entries.flatMap(([, entry]) => [entry.cover, ...entry.gallery].map((photo) => photo.pexelsId));

describe("training-photos.json", () => {
  it("1 sampul + 4 galeri per pelatihan, alt bahasa Indonesia terisi", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const [, entry] of entries) {
      expect(entry.gallery).toHaveLength(4);
      for (const photo of [entry.cover, ...entry.gallery]) expect(photo.alt.trim().length).toBeGreaterThan(10);
    }
  });

  it("setiap foto hanya dipakai sekali di seluruh daftar", () => {
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("tidak memakai ulang foto Pexels dari foto tema atau manifest accounting", () => {
    const existing = ["themes.json", "manifest.json"].flatMap((file) =>
      [...readFileSync(path.join(dir, file), "utf8").matchAll(/pexels\.com\/photo\/(?:[a-z0-9-]*-)?(\d+)/g)].map((match) =>
        Number(match[1]),
      ),
    );
    expect(existing.length).toBeGreaterThan(0);
    expect(ids.filter((id) => existing.includes(id))).toEqual([]);
  });

  it("slug pelatihan ada di katalog referensi", () => {
    const slugs = new Set(referenceSnapshotSlugs);
    expect(entries.map(([slug]) => slug).filter((slug) => !slugs.has(slug))).toEqual([]);
  });
});
