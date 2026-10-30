// Menyalin file upload lama dari UPLOAD_DIR ke bucket Cloudflare R2 (variabel R2_* di .env).
// Dipakai sekali saat pindah dari penyimpanan disk ke R2; upload baru langsung masuk R2.
// Default dry-run (hanya menghitung). Tulis ke bucket dengan: npm run storage:sync-r2 -- --apply
// Objek yang sudah ada di bucket dilewati, file lokal tidak pernah dihapus.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getEnv } from "../src/lib/env";
import { putR2Object, r2Config, r2ObjectExists } from "../src/lib/storage";
import { collectUploadFiles } from "./upload-files";

const CONCURRENCY = 8;

async function main() {
  const apply = process.argv.includes("--apply");
  const config = r2Config();
  if (!config) throw new Error("Variabel R2_* di .env belum diisi.");
  const root = path.resolve(getEnv().UPLOAD_DIR);

  const files = await collectUploadFiles(root);
  console.info(`${files.length} file di ${root} -> bucket ${config.bucket}${apply ? "" : " (dry-run)"}`);

  let uploaded = 0;
  let skipped = 0;
  let done = 0;
  const failed: string[] = [];
  const queue = [...files];
  const worker = async () => {
    for (let file = queue.shift(); file; file = queue.shift()) {
      try {
        if (await r2ObjectExists(config, file)) {
          skipped += 1;
        } else {
          if (apply) await putR2Object(config, file, new Uint8Array(await readFile(path.join(root, ...file.split("/")))));
          uploaded += 1;
        }
      } catch (error: unknown) {
        failed.push(file);
        console.error(`  gagal: ${error instanceof Error ? error.message : String(error)}`);
      }
      done += 1;
      if (done % 500 === 0) console.info(`  ${done}/${files.length}`);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.info(`${apply ? "Diunggah" : "Akan diunggah"}: ${uploaded}, sudah ada di bucket: ${skipped}, gagal: ${failed.length}.`);
  if (failed.length > 0) {
    console.info("Jalankan ulang perintah yang sama; file yang sudah ada di bucket dilewati.");
    process.exitCode = 1;
  } else if (!apply && uploaded > 0) {
    console.info("Jalankan ulang dengan --apply untuk mengunggah.");
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
