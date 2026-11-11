// Judul referensi yang terbit setelah snapshot utama (reference-catalog.json). Disimpan terpisah supaya
// snapshot utama, dan pilihan 10 pelatihan per kategori yang bergantung padanya, tidak berubah.
// Hanya judul, slug, kategori, dan tanggal; isi artikel tidak diunduh.
// Jalankan: node scripts/fetch-reference-additions.mjs
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = "https://diotraining.com/wp-json/wp/v2";
const snapshotFile = fileURLToPath(new URL("../prisma/seed-data/reference-catalog.json", import.meta.url));
const output = fileURLToPath(new URL("../prisma/seed-data/reference-catalog-additions.json", import.meta.url));

async function page(kind, number, fields) {
  const url = `${base}/${kind}?per_page=100&page=${number}&_fields=${fields}`;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { "User-Agent": "TrainingCatalogSeeder/1.0" } });
      if (!response.ok) throw new Error(`${kind} page ${number}: HTTP ${response.status}`);
      return { items: await response.json(), pages: Number(response.headers.get("x-wp-totalpages")) };
    } catch (error) {
      if (attempt === 3) throw error;
      await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
    }
  }
}

async function all(kind, fields) {
  const first = await page(kind, 1, fields);
  const result = [...first.items];
  for (let start = 2; start <= first.pages; start += 4) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(4, first.pages - start + 1) }, (_, index) => page(kind, start + index, fields)),
    );
    result.push(...batch.flatMap((entry) => entry.items));
    process.stdout.write(`\r${kind}: ${result.length} item`);
  }
  process.stdout.write("\n");
  return result;
}

const snapshot = JSON.parse(await readFile(snapshotFile, "utf8"));
const knownPostIds = new Set(snapshot.posts.map((post) => post.id));
const knownSlugs = new Set(snapshot.posts.map((post) => post.slug));
const [categories, posts] = await Promise.all([
  all("categories", "id,name,slug,parent,count"),
  all("posts", "id,slug,title,categories,date"),
]);
const additions = posts
  .filter((post) => !knownPostIds.has(post.id) && !knownSlugs.has(post.slug))
  .sort((a, b) => a.id - b.id);
const usedCategoryIds = new Set(additions.flatMap((post) => post.categories));
const result = {
  source: base,
  fetchedAt: new Date().toISOString(),
  baseSnapshotFetchedAt: snapshot.fetchedAt,
  // Hanya kategori yang dipakai post tambahan (untuk memetakan id ke slug).
  categories: categories
    .filter((category) => usedCategoryIds.has(category.id))
    .map(({ id, name, slug, parent, count }) => ({ id, name, slug, parent, count })),
  posts: additions.map(({ id, slug, title, categories: categoryIds, date }) => ({
    id,
    slug,
    title: title.rendered,
    categoryIds,
    date,
  })),
};
await writeFile(output, `${JSON.stringify(result)}\n`, "utf8");
console.info(`Tambahan tersimpan: ${result.posts.length} pelatihan baru (dari ${posts.length} di sumber), ${result.categories.length} kategori.`);
