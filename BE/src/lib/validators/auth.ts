import { z } from "zod";

// Hanya kata sandi: panel admin dipakai satu admin, jadi tidak ada email untuk memilih akun.
export const loginSchema = z.object({
  password: z
    .string({ error: "Kata sandi wajib diisi." })
    .min(1, { error: "Kata sandi wajib diisi." })
    .max(256, { error: "Kata sandi terlalu panjang." }),
});

export type LoginInput = z.infer<typeof loginSchema>;
