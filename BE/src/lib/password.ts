import { randomBytes } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";

// argon2id (default @node-rs/argon2) dengan parameter minimum OWASP: 19 MiB, 2 iterasi, 1 lane.
const ARGON2_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export function hashPassword(password: string): Promise<string> {
  return hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    // Hash rusak/format tidak dikenal diperlakukan sebagai password salah.
    return false;
  }
}

let dummyHash: Promise<string> | undefined;

// Dipakai saat email tidak terdaftar, supaya waktu respons sama dengan email terdaftar.
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword(randomBytes(16).toString("hex"));
  await verifyPassword(await dummyHash, password);
}
