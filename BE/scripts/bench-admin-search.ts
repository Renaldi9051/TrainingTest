// Ukur latensi search global admin (adminSearch, semua grup sekaligus) langsung ke database.
// Endpoint HTTP-nya butuh sesi admin, jadi bench memanggil service (kerja DB + pencocokan JSON).
// Pemakaian: npm run bench:search-admin  (DATABASE_URL dari ../.env, hanya SELECT)
import { getDb } from "../src/lib/db";
import { adminSearch } from "../src/services/admin-search";

const REQUESTS = 200;
const WARMUP = 10;

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

async function buildQueries(): Promise<string[]> {
  const db = getDb();
  const [trainings, media] = await Promise.all([
    db.training.findMany({ where: { deletedAt: null }, select: { title: true }, take: 400, orderBy: { id: "asc" } }),
    db.media.findMany({ where: { deletedAt: null }, select: { originalName: true, path: true }, take: 200, orderBy: { id: "asc" } }),
  ]);
  const words = trainings.flatMap((row) => row.title.split(/\s+/)).filter((word) => word.length >= 4);
  const files = media.map((row) => (row.originalName || row.path).split(/[/.-]/).find((part) => part.length >= 4) ?? "foto");
  const pick = <T>(items: T[], i: number) => items[(i * 7919) % items.length];
  return Array.from({ length: REQUESTS + WARMUP }, (_, i) => {
    switch (i % 5) {
      case 0: return pick(words, i); // kata di judul pelatihan
      case 1: return pick(words, i).slice(0, 3); // awalan pendek (paling banyak cocok)
      case 2: return pick(files, i); // nama file media
      case 3: return `${pick(words, i)} ${pick(words, i + 1)}`; // dua kata
      default: return ["jakarta", "6281", "info@", "kontak", "drone"][i % 5]; // pengaturan & teks lain
    }
  });
}

async function main() {
  const db = getDb();
  const [trainings, media] = await Promise.all([db.training.count({ where: { deletedAt: null } }), db.media.count({ where: { deletedAt: null } })]);
  const queries = await buildQueries();
  const timings: number[] = [];
  for (const [index, query] of queries.entries()) {
    const started = performance.now();
    await adminSearch(query);
    if (index >= WARMUP) timings.push(performance.now() - started);
  }
  timings.sort((a, b) => a - b);
  const fmt = (ms: number) => `${ms.toFixed(0)} ms`;
  console.info(`Search global admin: ${trainings} pelatihan, ${media} media, ${timings.length} query`);
  console.info(`p50 ${fmt(percentile(timings, 50))}  p95 ${fmt(percentile(timings, 95))}  p99 ${fmt(percentile(timings, 99))}  maks ${fmt(timings.at(-1) ?? 0)}`);
  await db.$disconnect();
}

main().catch(async (error: unknown) => {
  console.error(error);
  await getDb().$disconnect();
  process.exit(1);
});
