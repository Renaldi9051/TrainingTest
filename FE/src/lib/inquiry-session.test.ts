import { describe, expect, it } from "vitest";
import { messageWithSession } from "@/lib/inquiry-session";

describe("messageWithSession", () => {
  const session = { id: "s1", label: "12-14 Nov 2026 · Sleman" };

  it("tanpa sesi: pesan tidak diubah", () => {
    expect(messageWithSession("Halo", undefined)).toBe("Halo");
    expect(messageWithSession("", undefined)).toBe("");
  });

  it("dengan sesi: ditulis di baris pertama", () => {
    expect(messageWithSession("Untuk 5 orang", session)).toBe("Sesi: 12-14 Nov 2026 · Sleman\nUntuk 5 orang");
    expect(messageWithSession("  ", session)).toBe("Sesi: 12-14 Nov 2026 · Sleman");
  });
});
