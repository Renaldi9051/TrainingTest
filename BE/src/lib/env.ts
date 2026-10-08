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
