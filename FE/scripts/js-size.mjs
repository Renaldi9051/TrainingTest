// Ukuran JavaScript klien (gzip) dari build produksi, untuk membandingkan sebelum/sesudah perubahan.
// Pemakaian: node scripts/js-size.mjs [distDir] (default .next/verify), setelah `next build`.
// Per halaman: jumlah gzip semua chunk yang dirujuk HTML hasil prerender (JS awal halaman itu).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const distDir = process.argv[2] ?? ".next/verify";
const PAGES = ["index", "pelatihan", "layanan", "profil", "jadwal"];

const gzipSize = (file) => gzipSync(readFileSync(file), { level: 9 }).length;
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;

function chunksOf(htmlFile) {
  const html = readFileSync(htmlFile, "utf8");
  return [...new Set([...html.matchAll(/src="\/_next\/(static\/chunks\/[^"]+\.js)"/g)].map((match) => match[1]))];
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".js") ? [full] : [];
  });
}

const rows = [];
for (const page of PAGES) {
  const html = path.join(distDir, "server", "app", `${page}.html`);
  if (!existsSync(html)) continue;
  const total = chunksOf(html).reduce((sum, chunk) => sum + gzipSize(path.join(distDir, chunk)), 0);
  rows.push([page === "index" ? "/" : `/${page}`, total]);
}
const all = walk(path.join(distDir, "static", "chunks")).reduce((sum, file) => sum + gzipSize(file), 0);

for (const [page, total] of rows) console.info(`${page.padEnd(12)} JS awal ${kb(total)} gzip`);
console.info(`${"semua chunk".padEnd(12)} ${kb(all)} gzip`);
