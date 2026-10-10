import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  SESSION_SECRET: z.string().min(32),
  UPLOAD_DIR: z.string().min(1),
  PUBLIC_BASE_URL: z.url(),
  FE_REVALIDATE_URL: z.url(),
  REVALIDATE_SECRET: z.string().min(16),
  // Origin yang boleh mengirim request mutasi, dipisah koma. Dibandingkan persis dengan header Origin.
  ALLOWED_ORIGINS: z
    .string()
    .min(1)
    .transform((value) => value.split(",").map((origin) => origin.trim()).filter(Boolean))
    .pipe(z.array(z.url({ protocol: /^https?$/ })).min(1)),
  // Jumlah proxy tepercaya yang menambah entri X-Forwarded-For (rewrite FE tidak menambah; lihat .env.example).
  TRUST_PROXY_HOPS: z.coerce.number().int().min(1).max(5).default(1),
});

export type Env = z.infer<typeof envSchema>;

function parseWith<T extends z.ZodType>(
  schema: T,
  label: string,
  source: Record<string, string | undefined>,
): z.infer<T> {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new Error(`${label} tidak valid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

export function parseEnv(source: Record<string, string | undefined>): Env {
  return parseWith(envSchema, "Env BE", source);
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}

// Hanya dipakai seed untuk membuat admin pertama, bukan syarat runtime server.
const seedEnvSchema = z.object({
  ADMIN_EMAIL: z.email(),
  ADMIN_PASSWORD: z.string().min(12, "minimal 12 karakter"),
  ADMIN_NAME: z.string().trim().min(1),
});

export type SeedEnv = z.infer<typeof seedEnvSchema>;

export function parseSeedEnv(source: Record<string, string | undefined>): SeedEnv {
  return parseWith(seedEnvSchema, "Env seed", source);
}

// Database khusus e2e. Script e2e (scripts/e2e-*.ts) men-drop & membuat ulang database ini di setiap
// run, jadi namanya dikunci: apa pun selain training_e2e ditolak sebelum ada koneksi dibuka.
export const E2E_DATABASE_NAME = "training_e2e";

const e2eEnvSchema = z.object({
  DATABASE_URL_E2E: z
    .url({ protocol: /^postgres(ql)?$/ })
    .refine((value) => databaseName(value) === E2E_DATABASE_NAME, {
      message: `nama database wajib ${E2E_DATABASE_NAME}`,
    }),
});

export type E2eEnv = z.infer<typeof e2eEnvSchema>;

export function databaseName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ""));
}

export function parseE2eEnv(source: Record<string, string | undefined>): E2eEnv {
  return parseWith(e2eEnvSchema, "Env e2e", source);
}

// next.config.ts: E2E_SERVER=1 dipasang script e2e supaya server e2e memakai folder build sendiri
// (.next/e2e) dan bisa jalan berdampingan dengan `npm run dev` (Next mengunci .next/dev).
const configEnvSchema = z.object({
  E2E_SERVER: z.literal("1").optional(),
});

export function getConfigEnv(): z.infer<typeof configEnvSchema> {
  return parseWith(configEnvSchema, "Env config BE", process.env);
}
