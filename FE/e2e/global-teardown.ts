import { spawnSync } from "node:child_process";
import path from "node:path";

// Setelah semua test: hapus folder upload sementara milik server BE e2e run ini
// (BE/scripts/e2e-uploads.ts). Folder lain di temp OS tidak disentuh.
export default function globalTeardown() {
  const result = spawnSync("npm run e2e:cleanup", {
    cwd: path.resolve(__dirname, "../../BE"),
    shell: true,
    stdio: "inherit",
  });
  if (result.status !== 0) throw new Error("Pembersihan folder upload e2e gagal, lihat log di atas.");
}
