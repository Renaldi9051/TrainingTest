// Dipanggil global teardown Playwright (FE/e2e/global-teardown.ts): hapus folder upload sementara
// milik server BE e2e run ini.
import { removeE2eUploadDir } from "./e2e-uploads";

try {
  const removed = removeE2eUploadDir();
  console.info(removed ? `Folder upload e2e dihapus: ${removed}` : "Tidak ada folder upload e2e yang tercatat.");
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
