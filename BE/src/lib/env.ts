import { z } from "zod";

// Baris kosong di file env (mis. `DATABASE_URL=`) dianggap tidak diisi.
const optionalString = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

const envSchema = z.object({
  // TODO(fase 0b): wajibkan saat Prisma masuk.
  DATABASE_URL: optionalString(z.url()),
  SESSION_SECRET: z.string().min(32),
  UPLOAD_DIR: z.string().min(1),
  PUBLIC_BASE_URL: z.url(),
  FE_REVALIDATE_URL: z.url(),
  REVALIDATE_SECRET: z.string().min(16),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Env BE tidak valid:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}

let cached: Env | undefined;

export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
