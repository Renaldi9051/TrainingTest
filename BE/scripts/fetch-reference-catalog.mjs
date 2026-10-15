// Snapshot judul, slug, kategori, dan tanggal publik untuk seeder lokal.
// Isi artikel tidak diunduh: naskah di aplikasi ditulis ulang oleh seeder.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const base = "https://diotraining.com/wp-json/wp/v2";
const output = fileURLToPath(new URL("../prisma/seed-data/reference-catalog.json", import.meta.url));

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

const [categories, posts] = await Promise.all([
  all("categories", "id,name,slug,parent,count"),
  all("posts", "id,slug,title,categories,date"),
]);
const snapshot = {
  source: base,
  fetchedAt: new Date().toISOString(),
  categories: categories.map(({ id, name, slug, parent, count }) => ({ id, name, slug, parent, count })),
  posts: posts.map(({ id, slug, title, categories: categoryIds, date }) => ({
    id,
    slug,
    title: title.rendered,
    categoryIds,
    date,
  })),
};
await writeFile(output, `${JSON.stringify(snapshot)}\n`, "utf8");
console.info(`Snapshot tersimpan: ${categories.length} kategori, ${posts.length} pelatihan.`);
