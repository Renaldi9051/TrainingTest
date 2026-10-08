import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string({ error: "Email wajib diisi." })
    .trim()
    .toLowerCase()
    .pipe(z.email({ error: "Format email tidak valid." })),
  password: z
    .string({ error: "Kata sandi wajib diisi." })
    .min(1, { error: "Kata sandi wajib diisi." })
    .max(256, { error: "Kata sandi terlalu panjang." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
