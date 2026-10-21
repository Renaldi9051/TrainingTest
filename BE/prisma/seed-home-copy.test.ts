import { describe, expect, it } from "vitest";
import { HOME_SECTION_CONTENT_SCHEMAS } from "../src/lib/validators/home-section";
import { heroCopy, homeSections } from "./seed-data/content";
import { LEGACY_HERO_COPY, updatedHeroCopy } from "./seed-home-copy";

const legacyHero = {
  eyebrow: "Training provider",
  headline: "Tambah pengetahuan, tingkatkan kemampuan",
  ...LEGACY_HERO_COPY,
  showSearch: true,
  primaryCta: { label: "Dapatkan harga spesial", href: "/pelatihan" },
  slides: [],
};

describe("teks hero korporat", () => {
  it("teks seed lama diganti, field lain tetap", () => {
    const next = updatedHeroCopy(legacyHero);
    expect(next?.changed).toEqual(["rotatingWords", "subheadline", "searchPlaceholder"]);
    expect(next?.content).toMatchObject({ ...heroCopy, headline: legacyHero.headline, primaryCta: legacyHero.primaryCta });
  });

  it("teks yang sudah diubah admin tidak disentuh", () => {
    const edited = { ...legacyHero, subheadline: "Teks dari admin", rotatingWords: ["tumbuh"] };
    const next = updatedHeroCopy(edited);
    expect(next?.changed).toEqual(["searchPlaceholder"]);
    expect(next?.content).toMatchObject({ subheadline: "Teks dari admin", rotatingWords: ["tumbuh"] });
    expect(updatedHeroCopy({ ...edited, searchPlaceholder: "Cari" })).toBeNull();
  });

  it("teks baru lolos validator hero dan tidak lagi bertema drone", () => {
    const hero = homeSections.find((section) => section.type === "HERO");
    expect(HOME_SECTION_CONTENT_SCHEMAS.HERO.safeParse(hero?.content).success).toBe(true);
    expect(JSON.stringify(heroCopy)).not.toMatch(/drone|terbang/i);
  });
});
