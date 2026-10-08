import { z } from "zod";

const envSchema = z.object({
  BE_INTERNAL_URL: z.url(),
  NEXT_PUBLIC_SITE_URL: z.url(),
  REVALIDATE_SECRET: z.string().min(16),
});

// next.config.ts dijalankan saat build (termasuk di Docker, tanpa secret), jadi hanya
// memvalidasi variabel yang benar-benar dipakai config.
const configEnvSchema = envSchema.pick({ BE_INTERNAL_URL: true });

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

export function getConfigEnv(): ConfigEnv {
  return parseWith(configEnvSchema, process.env);
}

// NODE_ENV di-inline Next saat build; aman dipakai di server maupun client.
export const isDevelopment = process.env.NODE_ENV === "development";
