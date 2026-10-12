import { z } from "zod";

// .next/dev dipakai `next dev`, .next/e2e dipakai server e2e.
const RESERVED_DIST_DIRS = new Set(["dev", "e2e"]);

// ".next/verify" atau ".next/verify/a": relatif, di bawah .next/, tanpa segmen "..", ".", atau kosong.
export function isSafeDistDir(value: string): boolean {
  const segments = value.split("/");
  if (segments[0] !== ".next" || segments.length < 2) return false;
  const rest = segments.slice(1);
  if (rest.some((segment) => segment === "" || segment === "." || segment === ".." || !/^[A-Za-z0-9._-]+$/.test(segment))) {
    return false;
  }
  return !RESERVED_DIST_DIRS.has(rest[0]);
}

const envSchema = z.object({
  BE_INTERNAL_URL: z.url(),
  NEXT_PUBLIC_SITE_URL: z.url(),
  REVALIDATE_SECRET: z.string().min(16),
  // Dipasang Playwright untuk server e2e (folder build .next/e2e); jangan diisi di .env.
  E2E_SERVER: z.literal("1").optional(),
  // Folder build terpisah untuk uji build produksi lokal (mis. .next/verify), supaya `next build`/
  // `next start` tidak berbagi .next dengan `next dev`. Wajib relatif di bawah .next/.
  NEXT_DIST_DIR: z
    .string()
    .refine(isSafeDistDir, {
      message: "harus folder relatif di bawah .next/ (mis. .next/verify), tanpa .., bukan .next/dev atau .next/e2e",
    })
    .optional(),
});

// next.config.ts dijalankan saat build (termasuk di Docker, tanpa secret), jadi hanya
// memvalidasi variabel yang benar-benar dipakai config.
const configEnvSchema = envSchema.pick({ BE_INTERNAL_URL: true, E2E_SERVER: true, NEXT_DIST_DIR: true });

// Fetch data publik & URL absolut (metadata, JSON-LD) juga berjalan saat prerender build,
// jadi tidak boleh mewajibkan secret.
const publicEnvSchema = envSchema.pick({ BE_INTERNAL_URL: true, NEXT_PUBLIC_SITE_URL: true });
export type PublicEnv = z.infer<typeof publicEnvSchema>;

export type Env = z.infer<typeof envSchema>;
export type ConfigEnv = z.infer<typeof configEnvSchema>;

function parseWith<T extends z.ZodType>(schema: T, source: Record<string, string | undefined>) {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`Env FE tidak valid:\n${z.prettifyError(result.error)}`);
  }
  return result.data as z.infer<T>;
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  return parseWith(envSchema, source);
}

let cached: Env | undefined;

// Hanya untuk kode server. Kode client membaca NEXT_PUBLIC_* langsung.
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

let cachedPublic: PublicEnv | undefined;

export function getPublicEnv(): PublicEnv {
  cachedPublic ??= parseWith(publicEnvSchema, process.env);
  return cachedPublic;
}

export function getConfigEnv(): ConfigEnv {
  return parseWith(configEnvSchema, process.env);
}

// NODE_ENV di-inline Next saat build; aman dipakai di server maupun client.
export const isDevelopment = process.env.NODE_ENV === "development";
