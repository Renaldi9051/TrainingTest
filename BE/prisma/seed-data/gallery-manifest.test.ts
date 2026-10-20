import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Manifest foto (gallery/manifest.json) dibaca seed-manifest-gallery.ts. Nama file dipakai untuk
// mendeteksi unggahan sebelumnya, jadi foto pengganti wajib bernama baru dan nama lama masuk `retired`.
type Photo = { file: string; alt: string; source: { url: string; license: string } };
type Manifest = {
  categories: Record<string, Photo>;
  trainings: Record<string, { cover: Photo; gallery: Photo[] }>;
  retired?: string[];
};

const GALLERY_DIR = path.join(__dirname, "gallery");
const manifest = JSON.parse(readFileSync(path.join(GALLERY_DIR, "manifest.json"), "utf8")) as Manifest;
const photos = [
  ...Object.values(manifest.categories),
  ...Object.values(manifest.trainings).flatMap((entry) => [entry.cover, ...entry.gallery]),
];
const retired = manifest.retired ?? [];

describe("manifest foto galeri", () => {
  it("semua foto ada di disk dan punya alt serta sumber", () => {
    for (const photo of photos) {
      expect(existsSync(path.join(GALLERY_DIR, photo.file)), photo.file).toBe(true);
      expect(photo.alt.length).toBeGreaterThan(0);
      expect(photo.alt.length).toBeLessThanOrEqual(200);
      expect(photo.source.url).toMatch(/^https:\/\//);
      expect(photo.source.license.length).toBeGreaterThan(0);
    }
  });

  it("nama file foto unik", () => {
    const files = photos.map((photo) => photo.file);
    expect(new Set(files).size).toBe(files.length);
  });

  it("foto yang dipensiunkan tidak dipakai lagi dan filenya sudah dihapus", () => {
    const files = new Set(photos.map((photo) => photo.file));
    for (const file of retired) {
      expect(files.has(file), file).toBe(false);
      expect(existsSync(path.join(GALLERY_DIR, file)), file).toBe(false);
    }
  });
});
