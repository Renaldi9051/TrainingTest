import { UNKNOWN_IP } from "@/lib/request";

export type RateLimitStatus = { blocked: boolean; retryAfterMs: number };

// Perlakuan IP yang tidak terbaca (RATE_LIMIT_UNKNOWN_IP di env).
export type UnknownIpMode = "shared" | "skip";

// Interface supaya implementasi in-memory bisa diganti (mis. Redis/Postgres) tanpa mengubah pemanggil.
export interface RateLimiter {
  status(key: string, now?: number): RateLimitStatus;
  recordFailure(key: string, now?: number): void;
  reset(key: string): void;
}

// Sliding window: maksimal `maxFailures` kegagalan per `windowMs` per key.
// Hanya berlaku untuk satu proses Node. Cukup untuk MVP dengan satu container BE.
export class MemoryRateLimiter implements RateLimiter {
  private readonly failures = new Map<string, number[]>();

  constructor(
    private readonly maxFailures: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {}

  status(key: string, now = Date.now()): RateLimitStatus {
    const recent = this.prune(key, now);
    if (recent.length < this.maxFailures) return { blocked: false, retryAfterMs: 0 };
    // Terbuka lagi saat kegagalan tertua yang masih dihitung keluar dari window.
    const oldest = recent[recent.length - this.maxFailures];
    return { blocked: true, retryAfterMs: oldest + this.windowMs - now };
  }

  recordFailure(key: string, now = Date.now()): void {
    const recent = this.prune(key, now);
    recent.push(now);
    this.failures.set(key, recent);
    if (this.failures.size > this.maxKeys) this.sweep(now);
  }

  reset(key: string): void {
    this.failures.delete(key);
  }

  private prune(key: string, now: number): number[] {
    const recent = (this.failures.get(key) ?? []).filter((time) => now - time < this.windowMs);
    if (recent.length === 0) this.failures.delete(key);
    else this.failures.set(key, recent);
    return recent;
  }

  private sweep(now: number): void {
    for (const key of [...this.failures.keys()]) this.prune(key, now);
  }
}

const LOGIN_MAX_FAILURES = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

// Form inquiry publik: kiriman yang berhasil dihitung (recordFailure = "pakai satu jatah").
export const INQUIRY_IP_MAX = 5;
export const INQUIRY_IP_WINDOW_MS = 10 * 60 * 1000;
export const INQUIRY_EMAIL_MAX = 3;
export const INQUIRY_EMAIL_WINDOW_MS = 60 * 60 * 1000;

// Search publik (palette Ctrl/Cmd+K): setiap permintaan dihitung. Ketikan wajar (debounce ~200 ms)
// jauh di bawah batas ini; yang terkena hanya skrip/bot.
export const PUBLIC_SEARCH_MAX = 60;
export const PUBLIC_SEARCH_WINDOW_MS = 60 * 1000;

// Disimpan di globalThis supaya tidak ter-reset saat `next dev` me-reload modul.
const globalForLimiter = globalThis as typeof globalThis & {
  loginRateLimiter?: RateLimiter;
  inquiryRateLimiters?: { ip: RateLimiter; email: RateLimiter };
  publicSearchRateLimiter?: RateLimiter;
  unknownIpWarned?: boolean;
};

// Peringatan sekali per proses: di produksi, IP tak terbaca berarti reverse proxy belum meneruskan
// X-Forwarded-For (semua pengunjung berbagi satu bucket rate limit).
export function warnUnknownIpOnce(): void {
  if (globalForLimiter.unknownIpWarned) return;
  globalForLimiter.unknownIpWarned = true;
  console.warn(
    "[rate-limit] IP klien tidak terbaca (X-Forwarded-For kosong): semua pengunjung tanpa IP berbagi satu " +
      "bucket rate limit. Di produksi pastikan reverse proxy meneruskan X-Forwarded-For dan TRUST_PROXY_HOPS sesuai.",
  );
}

// Key rate limit per IP untuk login, inquiry, dan search publik. IP tak terbaca: "shared" = satu
// bucket bersama "unknown" (+ peringatan sekali); "skip" = null, limit per IP dilewati (limit lain,
// mis. per email, tetap berlaku).
export function ipRateLimitKey(ip: string, mode: UnknownIpMode, warn: () => void = warnUnknownIpOnce): string | null {
  if (ip !== UNKNOWN_IP) return ip;
  if (mode === "skip") return null;
  warn();
  return UNKNOWN_IP;
}

export function getInquiryRateLimiters(): { ip: RateLimiter; email: RateLimiter } {
  globalForLimiter.inquiryRateLimiters ??= {
    ip: new MemoryRateLimiter(INQUIRY_IP_MAX, INQUIRY_IP_WINDOW_MS),
    email: new MemoryRateLimiter(INQUIRY_EMAIL_MAX, INQUIRY_EMAIL_WINDOW_MS),
  };
  return globalForLimiter.inquiryRateLimiters;
}

export function getPublicSearchRateLimiter(): RateLimiter {
  globalForLimiter.publicSearchRateLimiter ??= new MemoryRateLimiter(PUBLIC_SEARCH_MAX, PUBLIC_SEARCH_WINDOW_MS);
  return globalForLimiter.publicSearchRateLimiter;
}

export function getLoginRateLimiter(): RateLimiter {
  globalForLimiter.loginRateLimiter ??= new MemoryRateLimiter(LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS);
  return globalForLimiter.loginRateLimiter;
}
