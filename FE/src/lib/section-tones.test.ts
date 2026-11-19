import { describe, expect, it } from "vitest";
import { homeSectionTones } from "@/lib/section-tones";

describe("homeSectionTones", () => {
  it("selang-seling --bg dan --bg-subtle, hero & CTA dilewati", () => {
    expect(homeSectionTones(["HERO", "LATEST_TRAININGS", "UPCOMING_SCHEDULES", "CLIENTS", "CTA"])).toEqual([
      null,
      "default",
      "subtle",
      "default",
      null,
    ]);
  });

  it("Visi & Misi jadi band hangat dan tetap memakan satu giliran", () => {
    expect(homeSectionTones(["HERO", "LATEST_TRAININGS", "VISION_MISSION", "CLIENTS", "LATEST_ARTICLES", "CTA"])).toEqual([
      null,
      "default",
      "warm",
      "default",
      "subtle",
      null,
    ]);
  });

  it("maksimal satu band hangat per halaman", () => {
    expect(homeSectionTones(["VISION_MISSION", "CLIENTS", "VISION_MISSION"])).toEqual(["warm", "subtle", "default"]);
  });

  it("daftar kosong", () => {
    expect(homeSectionTones([])).toEqual([]);
  });
});
