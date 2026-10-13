export type RateLimitStatus = { blocked: boolean; retryAfterMs: number };

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

// Disimpan di globalThis supaya tidak ter-reset saat `next dev` me-reload modul.
const globalForLimiter = globalThis as typeof globalThis & {
  loginRateLimiter?: RateLimiter;
  inquiryRateLimiters?: { ip: RateLimiter; email: RateLimiter };
};

export function getInquiryRateLimiters(): { ip: RateLimiter; email: RateLimiter } {
  globalForLimiter.inquiryRateLimiters ??= {
    ip: new MemoryRateLimiter(INQUIRY_IP_MAX, INQUIRY_IP_WINDOW_MS),
    email: new MemoryRateLimiter(INQUIRY_EMAIL_MAX, INQUIRY_EMAIL_WINDOW_MS),
  };
  return globalForLimiter.inquiryRateLimiters;
}

export function getLoginRateLimiter(): RateLimiter {
  globalForLimiter.loginRateLimiter ??= new MemoryRateLimiter(LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS);
  return globalForLimiter.loginRateLimiter;
}
