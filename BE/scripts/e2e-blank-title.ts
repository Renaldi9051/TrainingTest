// Khusus e2e: mengosongkan judul satu pelatihan di training_e2e, meniru data lama hasil impor
// (validator admin menolak judul kosong, jadi kondisi ini tidak bisa dibuat lewat API).
// Pemakaian: tsx scripts/e2e-blank-title.ts <slug>
import { Client } from "pg";
import { databaseName, E2E_DATABASE_NAME } from "../src/lib/env";
import { e2eDatabaseUrl } from "./e2e-shared";

async function main() {
  const slug = process.argv[2];
  if (!slug) throw new Error("Slug pelatihan wajib diisi.");
  const url = e2eDatabaseUrl();
  // Penjaga terakhir sebelum menulis: hanya database e2e.
  if (databaseName(url) !== E2E_DATABASE_NAME) throw new Error(`Menolak jalan: bukan ${E2E_DATABASE_NAME}.`);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const result = await client.query(`UPDATE "Training" SET title = '' WHERE slug = $1 AND "deletedAt" IS NULL`, [slug]);
    if (result.rowCount !== 1) throw new Error(`Pelatihan ${slug} tidak ditemukan.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
