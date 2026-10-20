import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { categoryPhoto, GALLERY_SIZE, loadThemes, THEMES_DIR, themeFor, trainingPhotos } from "./themes";

const themes = loadThemes();
const photos = themes.themes.flatMap((theme) => theme.photos);

describe("foto tema", () => {
  it("semua foto ada di disk dan bernama unik", () => {
    for (const photo of photos) expect(existsSync(path.join(THEMES_DIR, photo.file)), photo.file).toBe(true);
    const files = photos.map((photo) => photo.file);
    expect(new Set(files).size).toBe(files.length);
    expect(new Set(themes.themes.map((theme) => theme.key)).size).toBe(themes.themes.length);
  });

  it("foto yang dipensiunkan tidak dipakai lagi", () => {
    const files = new Set(photos.map((photo) => photo.file));
    for (const file of themes.retired) expect(files.has(file), file).toBe(false);
  });

  it.each([
    ["oil-and-gas", "energi"],
    ["industri-migas", "energi"],
    ["investigasi", "keuangan"],
    ["koperasi", "keuangan"],
    ["kelistrikan", "industri"],
    ["teknik-kimia", "industri"],
    ["pendidikan", "kelas"],
    ["perikanan", "agro"],
    ["pembuatan-pakan-ikan", "agro"],
    ["excel", "teknologi"],
    ["service-excellence", "layanan"],
    ["warehouse", "logistik"],
    ["teknik-sipil", "konstruksi"],
    ["human-resource", "kantor"],
    ["kategori-baru-tanpa-pola", "kantor"],
  ])("kategori %s memakai tema %s", (slug, theme) => {
    expect(themeFor(themes, slug).key).toBe(theme);
  });

  it("pelatihan tanpa kategori memakai tema bawaan", () => {
    expect(themeFor(themes, null).key).toBe(themes.default);
  });

  it("sampul dan galeri pelatihan berbeda semua, dari tema kategorinya, dan stabil", () => {
    const picked = trainingPhotos(themes, "oil-and-gas", "training-contoh");
    const files = [picked.cover, ...picked.gallery].map((photo) => photo.file);
    expect(picked.gallery).toHaveLength(GALLERY_SIZE);
    expect(new Set(files).size).toBe(GALLERY_SIZE + 1);
    for (const file of files) expect(file.startsWith("themes/energi-")).toBe(true);
    expect(trainingPhotos(themes, "oil-and-gas", "training-contoh")).toEqual(picked);
    expect(categoryPhoto(themes, "oil-and-gas").file.startsWith("themes/energi-")).toBe(true);
  });
});
