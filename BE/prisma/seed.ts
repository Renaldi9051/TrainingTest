// Seed data placeholder untuk development. Idempotent: aman dijalankan berulang (upsert).
// Semua teks di sini ditulis sendiri, bukan salinan dari website referensi.
import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";

const db = getDb();

type RichText = Prisma.InputJsonValue;

// Dokumen Tiptap minimal: paragraf dan daftar butir.
const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...content: object[]): RichText => ({ type: "doc", content });
const bulletList = (items: string[]) => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [paragraph(item)] })),
});

const settings: { key: string; value: Prisma.InputJsonValue }[] = [
  {
    key: "site.identity",
    value: {
      name: "Lembaga Pelatihan Contoh",
      tagline: "Pelatihan praktis untuk tim yang terus bertumbuh",
    },
  },
  {
    key: "site.contact",
    value: {
      phone: "+62 21 0000 0000",
      whatsapp: "+62 812 0000 0000",
      email: "halo@example.com",
      address: "Jl. Contoh Raya No. 1, Jakarta",
    },
  },
  {
    key: "site.footer",
    value: { text: "Pelatihan in-house dan public untuk perusahaan dan instansi." },
  },
  {
    key: "seo.default",
    value: {
      title: "Lembaga Pelatihan Contoh",
      description: "Katalog pelatihan, jadwal public training, dan layanan in-house.",
    },
  },
];

const categories = [
  {
    slug: "keuangan-akuntansi",
    name: "Keuangan & Akuntansi",
    description: "Laporan keuangan, anggaran, dan pengendalian biaya.",
    order: 1,
    featured: true,
  },
  {
    slug: "sumber-daya-manusia",
    name: "Sumber Daya Manusia",
    description: "Rekrutmen, manajemen kinerja, dan pengembangan karyawan.",
    order: 2,
    featured: true,
  },
  {
    slug: "teknologi-informasi",
    name: "Teknologi Informasi",
    description: "Keamanan data, analitik, dan produktivitas digital.",
    order: 3,
    featured: false,
  },
];

const trainings = [
  {
    slug: "analisis-laporan-keuangan-non-finance",
    title: "Analisis Laporan Keuangan untuk Non-Finance",
    summary:
      "Membaca neraca, laba rugi, dan arus kas untuk mengambil keputusan tanpa latar belakang akuntansi.",
    body: doc(
      paragraph(
        "Pelatihan ini membantu manajer dan staf non-keuangan memahami angka-angka utama perusahaan.",
      ),
    ),
    objectives: doc(
      bulletList([
        "Membaca tiga laporan keuangan utama",
        "Menghitung rasio likuiditas dan profitabilitas dasar",
        "Menyampaikan temuan keuangan secara ringkas",
      ]),
    ),
    syllabus: doc(
      bulletList(["Struktur laporan keuangan", "Analisis rasio", "Studi kasus dan diskusi"]),
    ),
    audience: doc(paragraph("Manajer, supervisor, dan staf dari divisi non-keuangan.")),
    facilities: doc(bulletList(["Modul cetak", "Sertifikat", "Makan siang dan rehat kopi"])),
    duration: "2 hari",
    method: "HYBRID",
    types: ["PUBLIC", "IN_HOUSE"],
    priceText: "Rp4.500.000 per peserta",
    showPrice: true,
    categorySlug: "keuangan-akuntansi",
  },
  {
    slug: "manajemen-kinerja-berbasis-kpi",
    title: "Manajemen Kinerja Berbasis KPI",
    summary: "Menyusun KPI yang terukur dan menjalankan siklus penilaian kinerja yang adil.",
    body: doc(
      paragraph("Peserta belajar merancang KPI yang selaras dengan target unit dan perusahaan."),
    ),
    objectives: doc(
      bulletList([
        "Menurunkan target perusahaan menjadi KPI unit",
        "Menulis KPI yang spesifik dan terukur",
        "Melakukan review kinerja berkala",
      ]),
    ),
    syllabus: doc(bulletList(["Dasar-dasar KPI", "Cascading target", "Simulasi review kinerja"])),
    audience: doc(paragraph("Tim HR, kepala divisi, dan supervisor.")),
    facilities: doc(bulletList(["Template KPI", "Sertifikat"])),
    duration: "3 hari",
    method: "OFFLINE",
    types: ["IN_HOUSE"],
    priceText: null,
    showPrice: false,
    categorySlug: "sumber-daya-manusia",
  },
] as const;

// Id tetap supaya jadwal contoh bisa di-upsert (Schedule tidak punya kolom unik lain).
const SAMPLE_SCHEDULE_ID = "0199c3a0-0000-7000-8000-000000000001";
const PUBLISHED_AT = new Date("2026-10-01T00:00:00.000Z");

async function main() {
  for (const setting of settings) {
    await db.siteSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const saved = await db.category.upsert({
      where: { slug: category.slug, deletedAt: null },
      update: category,
      create: category,
    });
    categoryIds.set(category.slug, saved.id);
  }

  const trainingIds = new Map<string, string>();
  for (const { categorySlug, ...training } of trainings) {
    const data = {
      ...training,
      types: [...training.types],
      status: "PUBLISHED" as const,
      publishedAt: PUBLISHED_AT,
    };
    const saved = await db.training.upsert({
      where: { slug: training.slug, deletedAt: null },
      update: data,
      create: data,
    });
    trainingIds.set(training.slug, saved.id);

    const categoryId = categoryIds.get(categorySlug);
    if (!categoryId) throw new Error(`Kategori ${categorySlug} tidak ditemukan`);
    await db.trainingCategory.upsert({
      where: { trainingId_categoryId: { trainingId: saved.id, categoryId } },
      update: {},
      create: { trainingId: saved.id, categoryId },
    });
  }

  const scheduleTrainingId = trainingIds.get("analisis-laporan-keuangan-non-finance");
  if (!scheduleTrainingId) throw new Error("Pelatihan untuk jadwal contoh tidak ditemukan");
  const schedule = {
    trainingId: scheduleTrainingId,
    startDate: new Date("2026-11-17"),
    endDate: new Date("2026-11-18"),
    city: "Jakarta",
    venue: "Ruang pelatihan, Jakarta Selatan",
    method: "OFFLINE" as const,
    price: 4_500_000,
    status: "OPEN" as const,
  };
  await db.schedule.upsert({
    where: { id: SAMPLE_SCHEDULE_ID },
    update: schedule,
    create: { id: SAMPLE_SCHEDULE_ID, ...schedule },
  });

  console.info(
    `Seed selesai: ${settings.length} pengaturan, ${categories.length} kategori, ` +
      `${trainings.length} pelatihan, 1 jadwal.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
