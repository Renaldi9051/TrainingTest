import type { HomeSectionType } from "@/lib/api/types";

export type LightTone = "default" | "subtle" | "warm";

// Section yang punya permukaan sendiri (foto hero, CTA navy): tanpa tone.
const OWN_SURFACE: readonly HomeSectionType[] = ["HERO", "CTA"];

// Section beranda yang menjadi band hangat (Malam Hujan v2). Hardcode dulu; field tone di konten
// section menyusul bersama fitur ganti palet.
const WARM_TYPE: HomeSectionType = "VISION_MISSION";

// Latar tiap section beranda: semua section terang berlatar --bg (kabut biru) yang sama, dipisah garis
// tipis (divide-y beranda). Keputusan pemilik 20 Nov 2026, menggantikan selang-seling --bg/--bg-subtle.
// Visi & Misi menjadi band hangat (maks 1 per halaman: hanya yang pertama). Hero & CTA: null.
export function homeSectionTones(types: readonly HomeSectionType[]): (LightTone | null)[] {
  let warmUsed = false;
  return types.map((type) => {
    if (OWN_SURFACE.includes(type)) return null;
    if (type === WARM_TYPE && !warmUsed) {
      warmUsed = true;
      return "warm";
    }
    return "default";
  });
}
