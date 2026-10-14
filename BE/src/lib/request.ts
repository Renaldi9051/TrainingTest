import { HttpError } from "@/lib/http";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isMutatingMethod(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

// Proteksi CSRF: request mutasi wajib membawa header Origin yang terdaftar di ALLOWED_ORIGINS.
// Request tanpa Origin (mis. curl tanpa -H Origin) ikut ditolak.
export function assertAllowedOrigin(
  request: Pick<Request, "method" | "headers">,
  allowedOrigins: readonly string[],
): void {
  if (!isMutatingMethod(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin || !allowedOrigins.includes(origin)) {
    throw new HttpError(403, "FORBIDDEN_ORIGIN", "Permintaan ditolak karena asal tidak dikenali.");
  }
}

// IP yang tidak terbaca (X-Forwarded-For kosong). Lihat ipRateLimitKey untuk perlakuannya di rate limit.
export const UNKNOWN_IP = "unknown";

// IP klien dari X-Forwarded-For. Tiap proxy menambahkan entri di kanan, jadi entri ke-N dari kanan
// (N = jumlah proxy tepercaya) adalah IP yang dilihat proxy terluar. Entri di kirinya bisa dipalsukan.
// X-Real-IP tidak dipakai: rewrite FE meneruskannya dari klien apa adanya, jadi bisa dipalsukan.
export function getClientIp(headers: Headers, trustProxyHops: number): string {
  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (forwarded && forwarded.length > 0) {
    return forwarded[Math.max(0, forwarded.length - trustProxyHops)];
  }
  return UNKNOWN_IP;
}
