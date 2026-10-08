import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { getEnv } from "@/lib/env";

function createClient() {
  const adapter = new PrismaPg({
    connectionString: getEnv().DATABASE_URL,
    // Gagal cepat kalau DB tidak menjawab, jangan menggantung request.
    connectionTimeoutMillis: 5_000,
  });
  return new PrismaClient({ adapter });
}

// `next dev` me-reload modul saat file berubah. Simpan instance di globalThis supaya
// tidak membuat pool koneksi baru di setiap reload.
const globalForPrisma = globalThis as typeof globalThis & { prisma?: PrismaClient };

// Client dibuat saat pertama dipakai, bukan saat modul di-import, supaya `next build`
// (mis. di Docker, tanpa .env) tidak butuh DATABASE_URL.
export function getDb(): PrismaClient {
  globalForPrisma.prisma ??= createClient();
  return globalForPrisma.prisma;
}
