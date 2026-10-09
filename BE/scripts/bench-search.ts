// Ukur latensi search katalog (PRD: p95 < 300 ms dengan 1.000+ judul) lewat HTTP ke BE.
// Jalankan setelah `npm run db:seed:bulk`, dengan BE menyala:  npm run bench:search
// BENCH_BASE_URL (opsional) default http://localhost:4000.
import { getDb } from "../src/lib/db";

const BASE_URL = process.env.BENCH_BASE_URL ?? "http://localhost:4000";
const REQUESTS = 300;
const WARMUP = 20;

function percentile(sorted: number[], p: number): number {
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, index)];
}

// Salah ketik sederhana: tukar dua huruf di tengah kata.
function typo(word: string): string {
  if (word.length < 5) return word;
  const i = Math.floor(word.length / 2);
  return word.slice(0, i - 1) + word[i] + word[i - 1] + word.slice(i + 1);
}

async function buildQueries(): Promise<string[]> {
  const rows = await getDb().training.findMany({
    where: { deletedAt: null, status: "PUBLISHED" },
    select: { title: true, summary: true },
    take: 400,
    orderBy: { id: "asc" },
  });
  const categories = await getDb().category.findMany({ where: { deletedAt: null }, select: { slug: true } });
  const words = rows.flatMap((row) => row.title.split(/\s+/)).filter((word) => word.length >= 4);
  const summaryWords = rows.flatMap((row) => (row.summary ?? "").split(/\s+/)).filter((word) => word.length >= 6);
  const pick = <T>(items: T[], i: number) => items[(i * 7919) % items.length];

  return Array.from({ length: REQUESTS + WARMUP }, (_, i) => {
    const params = new URLSearchParams();
    switch (i % 6) {
      case 0: params.set("q", pick(words, i)); break; // kata utuh di judul
      case 1: params.set("q", pick(words, i).slice(0, 4)); break; // awalan
      case 2: params.set("q", typo(pick(words, i))); break; // salah ketik
      case 3: params.set("q", pick(summaryWords, i)); break; // kata di ringkasan
      case 4: params.set("q", `${pick(words, i)} ${pick(words, i + 1)}`); params.set("metode", "offline"); break;
      case 5: params.set("q", pick(words, i)); params.set("kategori", pick(categories, i).slug); params.set("hal", "2"); break;
    }
    return params.toString();
  });
}

async function main() {
  const total = await getDb().training.count({ where: { deletedAt: null, status: "PUBLISHED" } });
  const queries = await buildQueries();
  const timings: number[] = [];
  let hits = 0;

  for (const [index, query] of queries.entries()) {
    const started = performance.now();
    const response = await fetch(`${BASE_URL}/api/public/trainings?${query}`);
    const body = (await response.json()) as { meta?: { total: number } };
    const elapsed = performance.now() - started;
    if (!response.ok) throw new Error(`HTTP ${response.status} untuk ?${query}`);
    if (index >= WARMUP) {
      timings.push(elapsed);
      if ((body.meta?.total ?? 0) > 0) hits += 1;
    }
  }

  timings.sort((a, b) => a - b);
  const format = (value: number) => `${value.toFixed(1)} ms`;
  console.info(`Pelatihan published: ${total}`);
  console.info(`Request diukur: ${timings.length} (setelah ${WARMUP} warm-up), berhasil menemukan hasil: ${hits}`);
  console.info(
    `p50 ${format(percentile(timings, 50))} | p95 ${format(percentile(timings, 95))} | ` +
      `p99 ${format(percentile(timings, 99))} | maks ${format(timings[timings.length - 1])}`,
  );
  const p95 = percentile(timings, 95);
  console.info(p95 < 300 ? "Target p95 < 300 ms: TERCAPAI" : "Target p95 < 300 ms: BELUM");
  if (p95 >= 300) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
