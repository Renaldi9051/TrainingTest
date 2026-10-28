import { describe, expect, it } from "vitest";
import { scheduleUpdateSchema } from "../src/lib/validators/schedule";
import { JOGJA_CITIES, JOGJA_LOCATIONS } from "./seed-data/jogja-locations";
import { jogjaLocationFor, SEED_LOCATIONS } from "./seed-schedule-locations";

describe("lokasi jadwal Jogja", () => {
  it("empat area DIY, tempat menyebut kotanya", () => {
    expect(JOGJA_CITIES).toEqual(["Yogyakarta", "Sleman", "Bantul", "Kulon Progo"]);
    for (const [city, venue] of JOGJA_LOCATIONS) expect(venue.endsWith(city)).toBe(true);
  });

  it("bergiliran ke semua area dan lolos validator update admin", () => {
    const picks = Array.from({ length: 8 }, (_, index) => jogjaLocationFor(index));
    expect(picks.map((pick) => pick.city)).toEqual([...JOGJA_CITIES, ...JOGJA_CITIES]);
    for (const pick of picks) expect(scheduleUpdateSchema.safeParse(pick).success).toBe(true);
  });

  it("hanya pasangan kota + tempat seed lama yang dipindah, tidak ada yang di Jogja atau kembar", () => {
    expect(SEED_LOCATIONS.filter(([city]) => JOGJA_CITIES.includes(city))).toEqual([]);
    const keys = SEED_LOCATIONS.map(([city, venue]) => `${city}|${venue}`);
    expect(new Set(keys).size).toBe(keys.length);
    // Tempat yang ditulis admin sendiri tidak cocok dengan daftar ini.
    expect(keys).not.toContain("Surabaya|Gedung Serbaguna Kampus A");
  });
});
