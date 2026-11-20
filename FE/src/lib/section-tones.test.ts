import { describe, expect, it } from "vitest";
import { homeSectionTones } from "@/lib/section-tones";

describe("homeSectionTones", () => {
  it("semua section terang berlatar --bg, hero & CTA dilewati", () => {
    expect(homeSectionTones(["HERO", "LATEST_TRAININGS", "UPCOMING_SCHEDULES", "CLIENTS", "CTA"])).toEqual([
      null,
      "default",
      "default",
      "default",
      null,
    ]);
  });

  it("Visi & Misi jadi band hangat", () => {
    expect(homeSectionTones(["HERO", "LATEST_TRAININGS", "VISION_MISSION", "CLIENTS", "LATEST_ARTICLES", "CTA"])).toEqual([
      null,
      "default",
      "warm",
      "default",
      "default",
      null,
    ]);
  });

  it("maksimal satu band hangat per halaman", () => {
    expect(homeSectionTones(["VISION_MISSION", "CLIENTS", "VISION_MISSION"])).toEqual(["warm", "default", "default"]);
  });

  it("daftar kosong", () => {
    expect(homeSectionTones([])).toEqual([]);
  });
});
