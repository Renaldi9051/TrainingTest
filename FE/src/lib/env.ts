import { z } from "zod";

const envSchema = z.object({
  BE_INTERNAL_URL: z.url(),
  NEXT_PUBLIC_SITE_URL: z.url(),
  REVALIDATE_SECRET: z.string().min(16),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Env FE tidak valid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

let cached: Env | undefined;

// Hanya untuk kode server & next.config.ts. Kode client membaca NEXT_PUBLIC_* langsung.
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
