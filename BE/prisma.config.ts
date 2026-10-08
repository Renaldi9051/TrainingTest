import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Prisma 7 tidak memuat .env sendiri. Env proyek ada di root repo (../.env), bukan di BE/.
// Variabel yang sudah ada di environment (mis. CI) tidak ditimpa.
const rootEnvFile = path.resolve(__dirname, "../.env");
if (existsSync(rootEnvFile)) process.loadEnvFile(rootEnvFile);

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  // `prisma generate` tidak butuh koneksi, jadi tetap jalan tanpa DATABASE_URL (mis. postinstall
  // di clone baru). Perintah yang butuh DB (migrate, studio, seed) akan gagal dengan pesan jelas.
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
});
