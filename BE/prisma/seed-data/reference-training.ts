// Snapshot judul dan kategori dari katalog publik referensi. Semua uraian di bawah adalah naskah
// baru; artikel, harga, jadwal, gambar, dan informasi kontak dari situs lain tidak disalin.
import snapshot from "./reference-catalog.json";
import { paragraphs } from "./rich-text";

type ReferencePost = (typeof snapshot.posts)[number];

const entities: Record<string, string> = { amp: "&", quot: '"', apos: "'", nbsp: " ", lt: "<", gt: ">", hellip: "…", ndash: "–", mdash: "—", rsquo: "’", lsquo: "‘" };
export function plainTitle(value: string): string {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (entity, code: string) => {
      if (code[0] === "#") {
        const hex = code[1]?.toLowerCase() === "x";
        const number = Number.parseInt(code.slice(hex ? 2 : 1), hex ? 16 : 10);
        return Number.isFinite(number) && number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
      }
      return entities[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, " ")
    .trim();
}

const menuSlugs = [
  "accounting", "administrative", "agrobisnis", "audit", "banking", "business", "cargo",
  "cement-fertilizer-industry", "chemical", "chemist", "civil", "coal-mining", "communication",
  "company", "customer-services", "economy", "education", "electrical", "employee", "energy",
  "enginering", "enterpreneur", "environment", "financial", "fraud", "geology",
  "healthy-safety-environtmental", "human-resource", "industrial", "industry",
  "information-technology", "instrumental", "insurance", "international", "keuangan", "law",
  "leadership", "maintenance", "management", "manufacture", "marketing", "mechanical", "media",
  "migas", "mining", "motivasional", "natural-resources", "negosiasi", "oil-and-gas",
  "operation-management", "organization", "pajak", "personal-development", "personality",
  "pertambangan", "petroleum-industry", "photography", "power-plant-industry", "procurement",
  "programming", "properties", "proyek", "public-relation", "purchasing", "risk-management",
  "sales", "secretarial", "secretary", "services", "skill", "slider", "social", "softskill",
  "strategic", "technology", "training", "transportasi",
];

const menuAliases: Record<string, string> = {
  "cement-fertilizer-industry": "industri-semen-dan-pupuk",
  chemical: "teknik-kimia",
  civil: "teknik-sipil",
  "coal-mining": "pertambangan-batubara",
  financial: "finance",
  industry: "industri",
  instrumental: "teknik-instrumental",
  mechanical: "teknik-mekanikal",
  "petroleum-industry": "industri-migas",
  "power-plant-industry": "perusahaan-pembangkitan-listrik",
  services: "service",
};

const categoryById = new Map(snapshot.categories.map((category) => [category.id, category]));
const categoryBySlug = new Map(snapshot.categories.map((category) => [category.slug, category]));
// Modul/kategori Evaluasi dihapus dari produk; judul pelatihannya tetap ada pada kategori lain.
const excludedCategorySlugs = new Set(["evaluasi"]);
export const referenceMenuCategories = menuSlugs
  .map((menuSlug) => {
    const category = categoryBySlug.get(menuAliases[menuSlug] ?? menuSlug);
    return category && category.count > 0
      ? { name: menuSlug === "financial" ? "Financial" : plainTitle(category.name), slug: category.slug }
      : null;
  })
  .filter((category): category is { name: string; slug: string } => Boolean(category));

export const referenceCategories = snapshot.categories
  .filter((category) => category.count > 0 && !excludedCategorySlugs.has(category.slug))
  .map((category, index) => ({
    slug: category.slug,
    name: plainTitle(category.name).slice(0, 100),
    description: `Kumpulan pelatihan ${plainTitle(category.name)}. Pilih topik untuk melihat materi, peserta yang dituju, dan cara berkonsultasi tentang penyelenggaraan.`,
    icon: null,
    featured: referenceMenuCategories.some((item) => item.slug === category.slug),
    order: referenceMenuCategories.findIndex((item) => item.slug === category.slug) >= 0
      ? referenceMenuCategories.findIndex((item) => item.slug === category.slug)
      : menuSlugs.length + index,
  }));

function topicFromTitle(title: string): string {
  return title.replace(/^(?:TRAINING|PELATIHAN|WORKSHOP|BIMTEK)\s+/i, "").trim();
}

function categorySlugs(post: ReferencePost): string[] {
  const slugs = post.categoryIds
    .map((id) => categoryById.get(id)?.slug)
    .filter((slug): slug is string => typeof slug === "string" && !excludedCategorySlugs.has(slug));
  return [...new Set(slugs)];
}

function referenceDate(value: string): Date {
  const parsed = new Date(`${value}+07:00`);
  return Number.isNaN(parsed.getTime()) ? new Date("2026-10-01T00:00:00.000Z") : parsed;
}

export function referenceTraining(post: ReferencePost) {
  const title = plainTitle(post.title).slice(0, 200);
  const topic = topicFromTitle(title);
  const categories = categorySlugs(post);
  const categoryName = plainTitle(categoryBySlug.get(categories[0])?.name ?? "profesional");
  const common = {
    slug: post.slug,
    title,
    summary: `Pelatihan ${topic} untuk memperdalam pemahaman, mengasah penerapan di tempat kerja, dan membahas kasus yang relevan.`,
    description: paragraphs(
      `Program ${topic} membahas konsep yang perlu dikuasai sebelum diterapkan dalam pekerjaan. Peserta diajak menghubungkan prinsip utama dengan persoalan yang muncul dalam bidang ${categoryName}.`,
      `Pembelajaran disusun melalui penjelasan, latihan, dan diskusi kasus. Ruang lingkup dapat disesuaikan dengan pengalaman peserta serta kebutuhan organisasi.`,
    ),
    outcomes: [
      `Menjelaskan konsep dan istilah utama dalam ${topic}`,
      `Mengenali masalah kerja yang berkaitan dengan ${topic}`,
      `Memilih pendekatan yang sesuai untuk menerapkan ${topic}`,
      `Menyusun langkah tindak lanjut yang dapat dipakai di unit kerja`,
    ],
    modules: [
      { title: `Dasar dan ruang lingkup ${topic}`, points: ["Konsep utama", "Istilah dan alur kerja", "Kebutuhan organisasi"], durationMinutes: null },
      { title: `Penerapan ${topic}`, points: ["Tahapan pelaksanaan", "Dokumen dan data pendukung", "Kendala yang umum terjadi"], durationMinutes: null },
      { title: "Analisis dan latihan kasus", points: ["Pembacaan kasus", "Pemilihan solusi", "Diskusi hasil"], durationMinutes: null },
      { title: "Evaluasi dan rencana penerapan", points: ["Indikator keberhasilan", "Perbaikan proses", "Rencana tindak lanjut"], durationMinutes: null },
    ],
    audience: [
      { role: `Staf dan praktisi bidang ${categoryName}`, note: "yang ingin memperkuat kemampuan kerja" },
      { role: "Supervisor dan manajer terkait", note: "yang mengawasi penerapan di timnya" },
    ],
    faq: [
      { q: "Apakah materi dapat disesuaikan?", a: "Cakupan materi dapat dibicarakan berdasarkan kebutuhan peserta atau perusahaan sebelum pelaksanaan." },
      { q: "Bagaimana memperoleh jadwal dan biaya?", a: "Hubungi tim penyelenggara untuk memperoleh informasi jadwal, format kelas, dan penawaran yang berlaku." },
    ],
    categorySlugs: categories,
    publishedAt: referenceDate(post.date),
  };

  if (post.slug !== "training-finance-treasury-management") return common;
  return {
    ...common,
    summary: "Program keuangan korporasi yang membahas arus kas, likuiditas, pengelolaan dana, dan risiko treasury melalui latihan kasus.",
    description: paragraphs(
      "Keputusan operasional bergantung pada ketersediaan dana yang tepat waktu. Pelatihan ini mengajak peserta membaca kebutuhan kas, merencanakan likuiditas, dan menata hubungan antara fungsi keuangan dan strategi perusahaan.",
      "Peserta menelaah contoh proyeksi kas, pengendalian modal kerja, risiko suku bunga dan nilai tukar, serta tata kelola transaksi treasury. Diskusi diarahkan pada keputusan yang dapat diterapkan di organisasi masing-masing.",
    ),
    outcomes: [
      "Menjelaskan fungsi keuangan dan treasury dalam pengambilan keputusan perusahaan",
      "Menyusun proyeksi arus kas dan mengenali potensi kekurangan likuiditas",
      "Menilai kebutuhan modal kerja dan penggunaan dana jangka pendek",
      "Mengidentifikasi risiko kurs, suku bunga, kredit, dan transaksi",
      "Memilih kontrol yang membantu menjaga keamanan aktivitas treasury",
      "Menyajikan informasi treasury untuk mendukung keputusan manajemen",
    ],
    modules: [
      { title: "Peran finance dan treasury", points: ["Fungsi kedua tim", "Siklus keputusan keuangan", "Keterkaitan dengan rencana bisnis"], durationMinutes: null },
      { title: "Perencanaan arus kas", points: ["Peta penerimaan dan pengeluaran", "Proyeksi kas", "Analisis selisih"], durationMinutes: null },
      { title: "Likuiditas dan modal kerja", points: ["Kebutuhan dana operasional", "Pengelolaan aset lancar", "Kewajiban jangka pendek"], durationMinutes: null },
      { title: "Risiko keuangan", points: ["Eksposur kurs dan suku bunga", "Risiko kredit", "Langkah mitigasi"], durationMinutes: null },
      { title: "Hubungan dengan bank", points: ["Fasilitas perbankan", "Perbandingan layanan", "Negosiasi kebutuhan perusahaan"], durationMinutes: null },
      { title: "Instrumen dan penempatan dana", points: ["Pilihan instrumen jangka pendek", "Risiko dan imbal hasil", "Batasan kebijakan investasi"], durationMinutes: null },
      { title: "Kontrol dan pelaporan treasury", points: ["Pemisahan tugas", "Persetujuan transaksi", "Laporan untuk manajemen"], durationMinutes: null },
    ],
    audience: [
      { role: "Manajer keuangan dan treasury", note: "yang mengambil keputusan tentang kas dan pendanaan" },
      { role: "Staf akuntansi dan keuangan", note: "yang mengolah transaksi dan laporan" },
      { role: "Perencana anggaran", note: "yang menyusun kebutuhan dana unit kerja" },
      { role: "Auditor internal", note: "yang menilai pengendalian proses treasury" },
    ],
  };
}

// Setiap kategori diwakili paling banyak 10 pelatihan (kategori yang di sumbernya lebih sedikit tetap
// memakai semua yang ada). Kategori diproses dari yang paling kecil; tiap kategori memilih pelatihan yang
// sudah terpilih lebih dulu (supaya jumlah pelatihan tetap kecil), lalu yang terbaru. Pelatihan hanya
// ditautkan ke kategori yang memilihnya, jadi kategori besar seperti Management tidak membengkak.
// Hasilnya deterministik dan hanya bergantung pada snapshot.
export const POSTS_PER_CATEGORY = 10;
// Dua artikel ini dipakai tes dan punya naskah khusus, jadi selalu terpilih di kategorinya.
const pinnedSlugs = new Set(["training-finance-treasury-management", "training-evaluasi-etika-dan-kepatuhan"]);

function selectPostsPerCategory(posts: ReferencePost[]): ReferencePost[] {
  const knownIds = new Set(snapshot.categories.map((category) => category.id));
  const excludedIds = new Set(snapshot.categories.filter((category) => excludedCategorySlugs.has(category.slug)).map((category) => category.id));
  const usable = posts.map((post) => ({
    post,
    categoryIds: [...new Set(post.categoryIds)].filter((id) => knownIds.has(id) && !excludedIds.has(id)),
  }));
  const byCategory = new Map<number, typeof usable>();
  for (const item of usable) {
    for (const id of item.categoryIds) byCategory.set(id, [...(byCategory.get(id) ?? []), item]);
  }
  const linked = new Map<string, Set<number>>();
  const order = [...byCategory.entries()].sort((a, b) => a[1].length - b[1].length || a[0] - b[0]);
  for (const [categoryId, candidates] of order) {
    const ranked = [...candidates].sort(
      (a, b) =>
        Number(pinnedSlugs.has(b.post.slug)) - Number(pinnedSlugs.has(a.post.slug)) ||
        Number(linked.has(b.post.slug)) - Number(linked.has(a.post.slug)) ||
        b.post.date.localeCompare(a.post.date) ||
        a.post.slug.localeCompare(b.post.slug),
    );
    for (const { post } of ranked.slice(0, POSTS_PER_CATEGORY)) {
      linked.set(post.slug, (linked.get(post.slug) ?? new Set<number>()).add(categoryId));
    }
  }
  return posts.flatMap((post) => {
    const ids = linked.get(post.slug);
    return ids ? [{ ...post, categoryIds: post.categoryIds.filter((id) => ids.has(id)) }] : [];
  });
}

// Validator aplikasi membatasi slug menjadi 120 karakter; 15 slug sumber lebih panjang.
function withUniqueSlugs(posts: ReferencePost[]) {
  const usedSlugs = new Set<string>();
  return posts.map((post) => {
    const base = post.slug.slice(0, 120).replace(/-+$/g, "");
    let slug = base;
    for (let suffix = 2; usedSlugs.has(slug); suffix += 1) slug = `${base.slice(0, 120 - String(suffix).length - 1).replace(/-+$/g, "")}-${suffix}`;
    usedSlugs.add(slug);
    return { ...post, slug };
  });
}

export const referencePosts = withUniqueSlugs(selectPostsPerCategory(snapshot.posts));
// Seluruh slug snapshot (termasuk yang tidak dipilih): dipakai untuk merapikan database yang sudah
// terlanjur berisi katalog lengkap versi sebelumnya.
export const referenceSnapshotSlugs = withUniqueSlugs(snapshot.posts).map((post) => post.slug);
export const referenceSnapshotDate = snapshot.fetchedAt;
