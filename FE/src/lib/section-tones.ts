import type { HomeSectionType } from "@/lib/api/types";

export type LightTone = "default" | "subtle" | "warm";

// Section yang punya permukaan sendiri (foto hero, CTA navy): tidak ikut selang-seling latar.
const OWN_SURFACE: readonly HomeSectionType[] = ["HERO", "CTA"];

// Section beranda yang menjadi band hangat (Malam Hujan v2). Hardcode dulu; field tone di konten
// section menyusul bersama fitur ganti palet.
const WARM_TYPE: HomeSectionType = "VISION_MISSION";

// Latar tiap section beranda (DESIGN 2, Malam Hujan v2): section terang selang-seling --bg dan
// --bg-subtle, mulai dari --bg. Visi & Misi menjadi band hangat (maks 1 per halaman: hanya yang pertama)
// dan tetap memakan satu giliran, jadi tetangganya tidak berlatar sama. Hero & CTA: null.
export function homeSectionTones(types: readonly HomeSectionType[]): (LightTone | null)[] {
  let index = 0;
  let warmUsed = false;
  return types.map((type) => {
    if (OWN_SURFACE.includes(type)) return null;
    const alternating: LightTone = index % 2 === 0 ? "default" : "subtle";
    index += 1;
    if (type === WARM_TYPE && !warmUsed) {
      warmUsed = true;
      return "warm";
    }
    return alternating;
  });
}
