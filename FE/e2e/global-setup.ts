import { spawnSync } from "node:child_process";
import path from "node:path";
import { E2E_FE_ORIGIN } from "./e2e-env";

// Route publik yang diuji dengan batas waktu (< 5 detik setelah mutasi). Server e2e selalu baru,
// jadi request pertama ikut menanggung kompilasi `next dev`; panaskan dulu supaya batas waktu
// mengukur revalidasi, bukan kompilasi. Slug yang tidak ada tetap mengompilasi route-nya.
const WARMUP_PATHS = ["/", "/pelatihan", "/pelatihan/__warmup", "/pelatihan/kategori/__warmup", "/jadwal"];

// Sebelum setiap run: drop + buat ulang training_e2e, migrasi, lalu seed (BE/scripts/e2e-db-reset.ts).
// Script itu menolak jalan kalau DATABASE_URL_E2E bukan database training_e2e.
export default async function globalSetup() {
  const result = spawnSync("npm run db:e2e:reset", {
    cwd: path.resolve(__dirname, "../../BE"),
    shell: true,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("Reset database e2e gagal, lihat log di atas.");

  for (const pathname of WARMUP_PATHS) {
    await fetch(`${E2E_FE_ORIGIN}${pathname}`, { signal: AbortSignal.timeout(120_000) });
  }
}
