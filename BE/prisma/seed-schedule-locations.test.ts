import { describe, expect, it } from "vitest";
import { scheduleUpdateSchema } from "../src/lib/validators/schedule";
import { GENERIC_VENUES, JOGJA_CITIES, JOGJA_LOCATIONS } from "./seed-data/jogja-locations";
import { jogjaLocationFor } from "./seed-schedule-locations";

describe("lokasi jadwal Jogja", () => {
  it("empat area DIY, tempat nyata tanpa kembar dan bukan tempat generik", () => {
    expect(JOGJA_CITIES).toEqual(["Yogyakarta", "Sleman", "Bantul", "Kulon Progo"]);
    const venues = JOGJA_LOCATIONS.map(([, venue]) => venue);
    expect(new Set(venues).size).toBe(venues.length);
    expect(venues.filter((venue) => GENERIC_VENUES.includes(venue))).toEqual([]);
  });

  it("bergiliran ke semua area dan lolos validator update admin", () => {
    const picks = Array.from({ length: JOGJA_LOCATIONS.length * 2 }, (_, index) => jogjaLocationFor(index));
    expect(new Set(picks.map((pick) => pick.city))).toEqual(new Set(JOGJA_CITIES));
    expect(picks.map((pick) => pick.venue)).toEqual([...JOGJA_LOCATIONS, ...JOGJA_LOCATIONS].map(([, venue]) => venue));
    for (const pick of picks) expect(scheduleUpdateSchema.safeParse(pick).success).toBe(true);
  });
});
