// Seed data placeholder untuk development. Idempotent: aman dijalankan berulang.
// Hanya MEMBUAT data yang belum ada; data yang sudah diubah admin tidak pernah ditimpa
// (service `migrate` di compose menjalankan seed setiap `docker compose up`).
// Semua teks di sini ditulis sendiri, bukan salinan dari website referensi.
import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { parseSeedEnv } from "../src/lib/env";
import { hashPassword } from "../src/lib/password";

const db = getDb();

// Dokumen Tiptap minimal untuk deskripsi (rich text, maks 2 paragraf).
const paragraph = (text: string) => ({ type: "paragraph", content: [{ type: "text", text }] });
const doc = (...texts: string[]): Prisma.InputJsonValue => ({ type: "doc", content: texts.map(paragraph) });

const settings: { key: string; value: Prisma.InputJsonValue }[] = [
  {
    key: "site.identity",
    value: {
      name: "Lembaga Pelatihan Contoh",
      tagline: "Pelatihan praktis untuk tim yang terus bertumbuh",
      logoLightId: null,
      logoDarkId: null,
      faviconId: null,
    },
  },
  { key: "site.header", value: { ctaLabel: "Lihat jadwal", ctaHref: "/jadwal" } },
  {
    key: "site.contact",
    value: {
      phone: "+62 21 0000 0000",
      whatsapp: "6281200000000",
      email: "halo@example.com",
      address: "Jl. Contoh Raya No. 1, Jakarta",
      mapEmbedUrl: "",
    },
  },
  {
    key: "site.social",
    value: {
      links: [
        { platform: "instagram", label: "", url: "https://instagram.com/example" },
        { platform: "linkedin", label: "", url: "https://www.linkedin.com/company/example" },
      ],
    },
  },
  {
    key: "site.footer",
    value: {
      description: "Pelatihan in-house dan public untuk perusahaan dan instansi.",
      copyright: "Lembaga Pelatihan Contoh",
    },
  },
  {
    key: "training.defaults",
    value: {
      facilities: [
        "Modul materi digital",
        "Sertifikat keikutsertaan",
        "Lembar kerja dan template yang bisa dipakai ulang",
        "Sesi tanya jawab 30 hari setelah pelatihan",
      ],
      faq: [
        {
          q: "Apakah pelatihan bisa diadakan khusus untuk perusahaan kami?",
          a: "Bisa. Semua topik tersedia sebagai pelatihan in-house dengan materi dan studi kasus yang disesuaikan.",
        },
        {
          q: "Bagaimana cara mendaftar kelas public?",
          a: "Pilih sesi di tabel jadwal lalu hubungi tim kami lewat WhatsApp. Kami kirimkan formulir dan detail pembayaran.",
        },
        {
          q: "Apakah ada sertifikat?",
          a: "Peserta yang mengikuti seluruh sesi mendapat sertifikat keikutsertaan.",
        },
      ],
      inHouseNote:
        "Butuh jadwal sendiri? Pelatihan ini bisa diadakan in-house di kantor Anda atau online, minimal 10 peserta.",
      disclaimer:
        "Materi dan jadwal dapat berubah. Harga belum termasuk pajak kecuali disebutkan lain.",
    },
  },
  {
    key: "seo.default",
    value: {
      titleTemplate: "%s | Lembaga Pelatihan Contoh",
      defaultTitle: "Lembaga Pelatihan Contoh",
      description: "Katalog pelatihan, jadwal public training, dan layanan in-house.",
      ogImageId: null,
    },
  },
];

const navItems: { location: "HEADER" | "FOOTER"; label: string; href: string }[] = [
  { location: "HEADER", label: "Pelatihan", href: "/pelatihan" },
  { location: "HEADER", label: "Jadwal", href: "/jadwal" },
  { location: "FOOTER", label: "Katalog pelatihan", href: "/pelatihan" },
  { location: "FOOTER", label: "Jadwal training", href: "/jadwal" },
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
  {
    slug: "penjualan-negosiasi",
    name: "Penjualan & Negosiasi",
    description: "Teknik menjual, negosiasi, dan mengelola pelanggan bisnis.",
    order: 4,
    featured: true,
  },
  {
    slug: "k3-keselamatan-kerja",
    name: "K3 & Keselamatan Kerja",
    description: "Budaya keselamatan, identifikasi bahaya, dan tanggap darurat.",
    order: 5,
    featured: false,
  },
  {
    slug: "layanan-pelanggan",
    name: "Layanan Pelanggan",
    description: "Standar layanan, komunikasi, dan penanganan keluhan.",
    order: 6,
    featured: false,
  },
];

type SeedTraining = {
  slug: string;
  title: string;
  summary: string;
  description: Prisma.InputJsonValue;
  outcomes: string[];
  modules: { title: string; points: string[]; durationMinutes: number | null }[];
  audience: { role: string; note: string | null }[];
  prerequisites: string | null;
  facilities: string[] | null;
  faq: { q: string; a: string }[];
  duration: string;
  method: "ONLINE" | "OFFLINE" | "HYBRID";
  types: ("PUBLIC" | "IN_HOUSE")[];
  priceText: string | null;
  showPrice: boolean;
  categorySlug: string;
};

const trainings: SeedTraining[] = [
  {
    slug: "menyusun-kpi-tim-yang-bisa-diukur",
    title: "Menyusun KPI Tim yang Bisa Diukur",
    summary: "Ubah target tim yang abstrak jadi indikator yang jelas, adil, dan mudah dipantau.",
    description: doc(
      "Banyak tim punya target, tapi sedikit yang punya indikator yang benar-benar bisa diukur setiap minggu. Pelatihan ini memandu peserta dari sasaran organisasi sampai KPI per peran yang disepakati bersama.",
      "Peserta bekerja dengan data dan struktur tim masing-masing, sehingga hasil akhirnya adalah draf KPI yang siap dibahas dengan atasan.",
    ),
    outcomes: [
      "Menurunkan sasaran organisasi menjadi KPI per peran",
      "Membedakan indikator hasil dan indikator proses",
      "Menetapkan baseline, target, dan frekuensi pengukuran",
      "Menyusun dashboard pemantauan sederhana untuk tim",
    ],
    modules: [
      {
        title: "Dari sasaran ke indikator",
        points: ["Peta sasaran organisasi", "Kriteria SMART", "Jebakan KPI vanity"],
        durationMinutes: 90,
      },
      {
        title: "Merancang KPI per peran",
        points: ["Bobot indikator", "Sumber data", "Definisi operasional"],
        durationMinutes: 120,
      },
      {
        title: "Memantau dan meninjau",
        points: ["Ritme review", "Menangani KPI yang meleset", "Studi kasus"],
        durationMinutes: 120,
      },
    ],
    audience: [
      { role: "Kepala unit", note: null },
      { role: "Supervisor", note: null },
      { role: "Staf HR/perencanaan", note: "yang menyiapkan target tahunan" },
    ],
    prerequisites: "Pernah mengelola atau menyusun target tim.",
    facilities: null,
    faq: [
      {
        q: "Apakah perlu membawa data perusahaan?",
        a: "Disarankan membawa struktur tim dan target tahun berjalan. Data sensitif boleh disamarkan.",
      },
    ],
    duration: "2 hari",
    method: "HYBRID",
    types: ["PUBLIC", "IN_HOUSE"],
    priceText: "Rp4.200.000 per peserta",
    showPrice: true,
    categorySlug: "sumber-daya-manusia",
  },
  {
    slug: "membaca-laporan-keuangan-untuk-manajer",
    title: "Membaca Laporan Keuangan untuk Manajer",
    summary: "Pahami neraca, laba rugi, dan arus kas cukup dalam untuk mengambil keputusan bisnis.",
    description: doc(
      "Pelatihan ini untuk manajer yang sehari-hari menerima laporan keuangan tapi jarang diajak membedahnya. Fokusnya bukan pada pencatatan, melainkan pada membaca angka dan bertanya hal yang tepat.",
    ),
    outcomes: [
      "Membaca hubungan antara neraca, laba rugi, dan arus kas",
      "Menghitung rasio likuiditas dan profitabilitas dasar",
      "Mengenali tanda awal masalah arus kas",
      "Menyampaikan temuan keuangan secara ringkas kepada tim",
    ],
    modules: [
      {
        title: "Tiga laporan, satu cerita",
        points: ["Struktur neraca", "Laba rugi dan margin", "Arus kas operasi"],
        durationMinutes: 120,
      },
      {
        title: "Rasio yang paling sering dipakai",
        points: ["Likuiditas", "Profitabilitas", "Efisiensi modal kerja"],
        durationMinutes: 90,
      },
      {
        title: "Dari angka ke keputusan",
        points: ["Membaca tren", "Pertanyaan untuk tim keuangan", "Latihan kasus"],
        durationMinutes: 120,
      },
    ],
    audience: [
      { role: "Manajer non-keuangan", note: null },
      { role: "Supervisor", note: "yang mengelola anggaran unit" },
    ],
    prerequisites: null,
    facilities: null,
    faq: [],
    duration: "2 hari",
    method: "OFFLINE",
    types: ["PUBLIC", "IN_HOUSE"],
    priceText: null,
    showPrice: true,
    categorySlug: "keuangan-akuntansi",
  },
  {
    slug: "negosiasi-b2b-yang-menjaga-hubungan",
    title: "Negosiasi B2B yang Menjaga Hubungan",
    summary: "Capai kesepakatan yang menguntungkan tanpa merusak hubungan jangka panjang dengan klien.",
    description: doc(
      "Negosiasi bisnis jarang selesai dalam satu pertemuan. Pelatihan ini melatih persiapan, membaca kepentingan lawan bicara, dan menyusun konsesi yang terukur.",
      "Sebagian besar waktu dipakai untuk simulasi berpasangan dengan skenario pengadaan dan perpanjangan kontrak.",
    ),
    outcomes: [
      "Menyusun rencana negosiasi beserta batas dan alternatif terbaik",
      "Menggali kepentingan di balik posisi klien",
      "Merancang paket konsesi yang tetap menguntungkan",
      "Menutup kesepakatan dan mendokumentasikannya dengan jelas",
      "Menangani taktik tekanan tanpa terpancing",
    ],
    modules: [
      {
        title: "Persiapan sebelum bertemu",
        points: ["Tujuan dan batas", "Alternatif terbaik", "Peta pemangku kepentingan"],
        durationMinutes: 90,
      },
      {
        title: "Di meja negosiasi",
        points: ["Pertanyaan pembuka", "Membaca kepentingan", "Menyusun konsesi"],
        durationMinutes: 150,
      },
      {
        title: "Simulasi dan evaluasi",
        points: ["Skenario pengadaan", "Skenario perpanjangan kontrak", "Umpan balik terstruktur"],
        durationMinutes: 150,
      },
    ],
    audience: [
      { role: "Account manager", note: null },
      { role: "Tim penjualan B2B", note: null },
      { role: "Staf pengadaan", note: "yang bernegosiasi dengan vendor" },
    ],
    prerequisites: null,
    facilities: ["Modul materi digital", "Lembar persiapan negosiasi", "Sertifikat keikutsertaan"],
    faq: [],
    duration: "2 hari",
    method: "OFFLINE",
    types: ["PUBLIC", "IN_HOUSE"],
    priceText: "Rp3.900.000 per peserta",
    showPrice: true,
    categorySlug: "penjualan-negosiasi",
  },
  {
    slug: "dasar-k3-di-tempat-kerja",
    title: "Dasar K3 di Tempat Kerja",
    summary: "Kenali bahaya di sekitar area kerja dan bangun kebiasaan aman yang dijalankan bersama.",
    description: doc(
      "Pelatihan pengantar keselamatan dan kesehatan kerja untuk semua level karyawan. Peserta belajar mengenali bahaya, menilai risiko sederhana, dan tahu apa yang harus dilakukan saat terjadi insiden.",
    ),
    outcomes: [
      "Mengidentifikasi bahaya umum di area kerja",
      "Menilai risiko dengan matriks sederhana",
      "Memilih alat pelindung diri yang sesuai",
      "Melaporkan insiden dan nyaris celaka dengan benar",
    ],
    modules: [
      {
        title: "Mengapa K3 penting",
        points: ["Kewajiban dan tanggung jawab", "Biaya kecelakaan kerja"],
        durationMinutes: 60,
      },
      {
        title: "Bahaya dan risiko",
        points: ["Jenis bahaya", "Matriks risiko", "Hierarki pengendalian"],
        durationMinutes: 120,
      },
      {
        title: "Tanggap darurat",
        points: ["Prosedur evakuasi", "Pelaporan insiden", "Latihan singkat"],
        durationMinutes: 90,
      },
    ],
    audience: [
      { role: "Karyawan baru", note: null },
      { role: "Staf operasional", note: null },
      { role: "Koordinator area", note: "yang ditunjuk sebagai petugas K3" },
    ],
    prerequisites: null,
    facilities: null,
    faq: [],
    duration: "1 hari",
    method: "OFFLINE",
    types: ["IN_HOUSE"],
    priceText: null,
    showPrice: false,
    categorySlug: "k3-keselamatan-kerja",
  },
  {
    slug: "analisis-data-dengan-spreadsheet",
    title: "Analisis Data dengan Spreadsheet",
    summary: "Olah data operasional jadi ringkasan dan grafik yang siap dipresentasikan.",
    description: doc(
      "Kelas praktik untuk pekerja kantor yang setiap minggu menyusun laporan dari data mentah. Peserta belajar merapikan data, merangkum dengan tabel pivot, dan membuat grafik yang mudah dibaca.",
    ),
    outcomes: [
      "Merapikan data mentah agar siap dianalisis",
      "Merangkum data dengan tabel pivot",
      "Memakai fungsi pencarian dan logika yang paling sering dibutuhkan",
      "Membuat grafik yang jelas untuk laporan rutin",
      "Menyusun dashboard satu halaman",
    ],
    modules: [
      {
        title: "Menyiapkan data",
        points: ["Format tabel", "Membersihkan duplikat", "Validasi data"],
        durationMinutes: 90,
      },
      {
        title: "Merangkum dan mencari",
        points: ["Tabel pivot", "Fungsi pencarian", "Fungsi logika"],
        durationMinutes: 120,
      },
      {
        title: "Menyajikan hasil",
        points: ["Memilih jenis grafik", "Dashboard satu halaman"],
        durationMinutes: 90,
      },
    ],
    audience: [
      { role: "Staf administrasi", note: null },
      { role: "Analis junior", note: null },
      { role: "Supervisor", note: "yang menyusun laporan mingguan" },
    ],
    prerequisites: "Terbiasa memakai spreadsheet untuk input data.",
    facilities: null,
    faq: [
      {
        q: "Aplikasi spreadsheet apa yang dipakai?",
        a: "Materi berlaku untuk aplikasi spreadsheet umum. Peserta membawa laptop dengan aplikasi yang biasa dipakai di kantor.",
      },
    ],
    duration: "2 hari",
    method: "ONLINE",
    types: ["PUBLIC"],
    priceText: "Rp2.750.000 per peserta",
    showPrice: true,
    categorySlug: "teknologi-informasi",
  },
  {
    slug: "menangani-keluhan-pelanggan-dengan-tenang",
    title: "Menangani Keluhan Pelanggan dengan Tenang",
    summary: "Ubah keluhan jadi kesempatan memperbaiki layanan tanpa kehilangan kendali percakapan.",
    description: doc(
      "Pelatihan untuk tim garis depan yang setiap hari menghadapi pelanggan kecewa, baik tatap muka, telepon, maupun chat. Peserta berlatih alur penanganan keluhan yang konsisten dan bahasa yang menenangkan.",
    ),
    outcomes: [
      "Menerapkan alur penanganan keluhan yang konsisten",
      "Mendengarkan aktif dan merumuskan ulang masalah pelanggan",
      "Memilih kata yang menenangkan di lisan dan tulisan",
      "Menentukan kapan perlu eskalasi",
    ],
    modules: [
      {
        title: "Memahami pelanggan yang kecewa",
        points: ["Sumber keluhan", "Emosi dan ekspektasi"],
        durationMinutes: 60,
      },
      {
        title: "Alur penanganan keluhan",
        points: ["Mendengarkan", "Mengakui", "Menawarkan solusi", "Menindaklanjuti"],
        durationMinutes: 120,
      },
      {
        title: "Latihan per kanal",
        points: ["Tatap muka", "Telepon", "Chat dan email"],
        durationMinutes: 120,
      },
    ],
    audience: [
      { role: "Customer service", note: null },
      { role: "Front office", note: null },
      { role: "Team leader layanan", note: null },
    ],
    prerequisites: null,
    facilities: null,
    faq: [],
    duration: "1 hari",
    method: "HYBRID",
    types: ["PUBLIC", "IN_HOUSE"],
    priceText: null,
    showPrice: false,
    categorySlug: "layanan-pelanggan",
  },
];

// Id tetap supaya jadwal contoh bisa di-upsert (Schedule tidak punya kolom unik lain).
// Seri 01xx untuk format konten Fase 2 revisi; id seri lama tidak dipakai lagi.
const schedules = [
  {
    id: "0199c3a0-0000-7000-8000-000000000101",
    trainingSlug: "menyusun-kpi-tim-yang-bisa-diukur",
    startDate: "2026-11-17",
    endDate: "2026-11-18",
    city: "Jakarta",
    venue: "Ruang pelatihan, Jakarta Selatan",
    method: "OFFLINE" as const,
    price: 4_200_000,
    status: "OPEN" as const,
  },
  {
    id: "0199c3a0-0000-7000-8000-000000000102",
    trainingSlug: "menyusun-kpi-tim-yang-bisa-diukur",
    startDate: "2026-12-08",
    endDate: "2026-12-09",
    city: null,
    venue: "Zoom",
    method: "ONLINE" as const,
    price: 3_600_000,
    status: "OPEN" as const,
  },
  {
    id: "0199c3a0-0000-7000-8000-000000000103",
    trainingSlug: "negosiasi-b2b-yang-menjaga-hubungan",
    startDate: "2026-11-24",
    endDate: "2026-11-25",
    city: "Surabaya",
    venue: "Hotel mitra, Surabaya Pusat",
    method: "OFFLINE" as const,
    price: 3_900_000,
    status: "FULL" as const,
  },
  {
    id: "0199c3a0-0000-7000-8000-000000000104",
    trainingSlug: "analisis-data-dengan-spreadsheet",
    startDate: "2026-11-11",
    endDate: "2026-11-12",
    city: null,
    venue: "Zoom",
    method: "ONLINE" as const,
    price: 2_750_000,
    status: "OPEN" as const,
  },
];

const PUBLISHED_AT = new Date("2026-10-01T00:00:00.000Z");

// Admin pertama dari ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME. Hanya dibuat kalau email belum ada;
// password admin yang sudah ada tidak pernah ditimpa.
async function seedAdmin(): Promise<"created" | "exists"> {
  const admin = parseSeedEnv(process.env);
  const email = admin.ADMIN_EMAIL.toLowerCase();
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return "exists";
  await db.user.create({
    data: { email, name: admin.ADMIN_NAME, passwordHash: await hashPassword(admin.ADMIN_PASSWORD) },
  });
  return "created";
}

async function main() {
  const adminResult = await seedAdmin();
  for (const setting of settings) {
    await db.siteSetting.upsert({ where: { key: setting.key }, update: {}, create: setting });
  }

  // Menu contoh hanya kalau belum ada menu sama sekali (termasuk yang di Sampah).
  if ((await db.navItem.count()) === 0) {
    for (const [index, item] of navItems.entries()) {
      const order = navItems.slice(0, index).filter((other) => other.location === item.location).length;
      await db.navItem.create({ data: { ...item, order } });
    }
  }

  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const saved = await db.category.upsert({
      where: { slug: category.slug, deletedAt: null },
      update: {},
      create: category,
    });
    categoryIds.set(category.slug, saved.id);
  }

  const trainingIds = new Map<string, string>();
  for (const { categorySlug, facilities, description, ...training } of trainings) {
    const data = {
      ...training,
      description,
      // Tanpa fasilitas khusus: kolom dibiarkan NULL = pakai default global (training.defaults).
      ...(facilities ? { facilities } : {}),
      status: "PUBLISHED" as const,
      publishedAt: PUBLISHED_AT,
      publishRevalidatedAt: PUBLISHED_AT,
    };
    const saved = await db.training.upsert({
      where: { slug: training.slug, deletedAt: null },
      update: {},
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

  for (const { id, trainingSlug, startDate, endDate, ...schedule } of schedules) {
    const trainingId = trainingIds.get(trainingSlug);
    if (!trainingId) throw new Error(`Pelatihan ${trainingSlug} untuk jadwal contoh tidak ditemukan`);
    await db.schedule.upsert({
      where: { id },
      update: {},
      create: {
        id,
        trainingId,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        ...schedule,
      },
    });
  }

  console.info(
    `Seed selesai: ${settings.length} pengaturan, ${navItems.length} menu, ${categories.length} kategori, ` +
      `${trainings.length} pelatihan, ${schedules.length} jadwal, admin ${adminResult === "created" ? "dibuat" : "sudah ada"}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
