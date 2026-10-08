import { describe, expect, it } from "vitest";
import { MemoryRateLimiter } from "@/lib/rate-limit";

const WINDOW = 15 * 60 * 1000;

describe("MemoryRateLimiter", () => {
  it("memblokir setelah 5 kegagalan dalam window", () => {
    const limiter = new MemoryRateLimiter(5, WINDOW);
    for (let i = 0; i < 4; i++) limiter.recordFailure("k", 1_000 + i);
    expect(limiter.status("k", 2_000).blocked).toBe(false);
    limiter.recordFailure("k", 2_000);
    const status = limiter.status("k", 3_000);
    expect(status.blocked).toBe(true);
    // Terbuka saat kegagalan pertama (t=1000) keluar dari window.
    expect(status.retryAfterMs).toBe(1_000 + WINDOW - 3_000);
  });

  it("membuka lagi setelah window lewat", () => {
    const limiter = new MemoryRateLimiter(5, WINDOW);
    for (let i = 0; i < 5; i++) limiter.recordFailure("k", 0);
    expect(limiter.status("k", WINDOW - 1).blocked).toBe(true);
    expect(limiter.status("k", WINDOW).blocked).toBe(false);
  });

  it("memisahkan hitungan per key", () => {
    const limiter = new MemoryRateLimiter(5, WINDOW);
    for (let i = 0; i < 5; i++) limiter.recordFailure("a", 0);
    expect(limiter.status("a", 1).blocked).toBe(true);
    expect(limiter.status("b", 1).blocked).toBe(false);
  });

  it("reset menghapus hitungan (dipakai saat login sukses)", () => {
    const limiter = new MemoryRateLimiter(5, WINDOW);
    for (let i = 0; i < 5; i++) limiter.recordFailure("k", 0);
    limiter.reset("k");
    expect(limiter.status("k", 1).blocked).toBe(false);
  });
});
