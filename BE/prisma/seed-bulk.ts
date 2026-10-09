// Seed massal KHUSUS DEV: ~70 kategori + 1.200 pelatihan dummy (+ jadwal) untuk menguji katalog
// dan performa search (PRD: p95 < 300 ms dengan 1.000+ judul). Idempotent: data dengan slug yang
// sudah ada dilewati. Semua teks dibuat dari kombinasi kata, bukan salinan website referensi.
//
// Jalankan: npm run db:seed:bulk   (BE/)
import type { TrainingMethod, TrainingType } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { slugify } from "../src/lib/slug";

const TRAINING_COUNT = 1200;
const BATCH = 200;

function assertDevDatabase() {
  const url = process.env.DATABASE_URL ?? "";
  let database = "";
  try {
    database = new URL(url).pathname.replace(/^\//, "");
  } catch {
    throw new Error("DATABASE_URL tidak valid.");
  }
  if (process.env.NODE_ENV === "production" || /prod/i.test(database)) {
    throw new Error(`Seed massal hanya untuk database dev. Ditolak untuk database "${database}".`);
  }
}

// RNG deterministik supaya hasil seed sama di setiap mesin.
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)],
  };
}

// Bidang -> topik. Nama kategori = bidang; judul pelatihan dirakit dari topik.
const FIELDS: Record<string, string[]> = {
  "Akuntansi Keuangan": ["Laporan Keuangan", "Rekonsiliasi Bank", "Penyusunan Neraca", "Konsolidasi"],
  "Akuntansi Manajemen": ["Analisis Biaya", "Activity Based Costing", "Penganggaran", "Analisis Varians"],
  Perpajakan: ["PPh Badan", "PPN", "Rekonsiliasi Fiskal", "Pajak Internasional", "e-Faktur"],
  "Audit Internal": ["Audit Berbasis Risiko", "Audit Operasional", "Teknik Sampling Audit", "Laporan Audit"],
  "Manajemen Risiko": ["ISO 31000", "Risk Register", "Business Continuity", "Analisis Risiko Kuantitatif"],
  Treasury: ["Manajemen Kas", "Cash Flow Forecasting", "Manajemen Likuiditas"],
  "Keuangan Non-Keuangan": ["Membaca Laporan Keuangan", "Rasio Keuangan", "Analisis Investasi"],
  "Rekrutmen & Seleksi": ["Wawancara Berbasis Kompetensi", "Employer Branding", "Assessment Center"],
  "Manajemen Kinerja": ["KPI", "Balanced Scorecard", "OKR", "Penilaian Kinerja 360"],
  "Kompensasi & Benefit": ["Struktur Upah", "Job Evaluation", "Remunerasi Berbasis Kinerja"],
  "Hubungan Industrial": ["Peraturan Perusahaan", "PKB", "Penyelesaian Perselisihan", "Ketenagakerjaan"],
  "Pengembangan SDM": ["Training Need Analysis", "Evaluasi Pelatihan", "Talent Management", "Succession Planning"],
  Kepemimpinan: ["Leadership", "Coaching", "Mentoring", "Situational Leadership", "Change Management"],
  Supervisori: ["Supervisory Skills", "Delegasi Efektif", "Manajemen Tim"],
  Komunikasi: ["Public Speaking", "Presentasi Efektif", "Business Writing", "Negosiasi"],
  "Layanan Pelanggan": ["Service Excellence", "Complaint Handling", "Customer Experience"],
  Penjualan: ["Teknik Closing", "Key Account Management", "Sales Forecasting", "Consultative Selling"],
  Pemasaran: ["Digital Marketing", "Brand Management", "Marketing Plan", "Riset Pasar"],
  "Pemasaran Digital": ["SEO", "Social Media Marketing", "Content Marketing", "Google Ads"],
  "Manajemen Proyek": ["PMBOK", "Agile Scrum", "Manajemen Jadwal Proyek", "Earned Value"],
  "Manajemen Operasional": ["Lean Management", "Six Sigma", "Kaizen", "5S"],
  "Rantai Pasok": ["Supply Chain Management", "Demand Planning", "S&OP"],
  Pengadaan: ["Procurement", "Strategic Sourcing", "Manajemen Vendor", "Kontrak Pengadaan"],
  Logistik: ["Manajemen Gudang", "Inventory Control", "Transportasi & Distribusi"],
  "Ekspor Impor": ["Prosedur Ekspor Impor", "Kepabeanan", "Incoterms"],
  Produksi: ["PPIC", "Maintenance Planning", "TPM", "OEE"],
  "Kualitas & ISO": ["ISO 9001", "Internal Audit ISO", "Statistical Process Control", "Root Cause Analysis"],
  K3: ["Ahli K3 Umum", "Manajemen Risiko K3", "Investigasi Kecelakaan", "Izin Kerja Aman"],
  Lingkungan: ["ISO 14001", "Pengelolaan Limbah B3", "AMDAL", "Audit Lingkungan"],
  Keselamatan: ["Fire Safety", "Emergency Response", "Pertolongan Pertama"],
  "Teknologi Informasi": ["IT Governance", "COBIT", "ITIL", "Manajemen Layanan TI"],
  "Keamanan Siber": ["Cyber Security Awareness", "ISO 27001", "Ethical Hacking", "Incident Response"],
  "Data & Analitik": ["Data Analytics", "Power BI", "Excel Lanjutan", "Visualisasi Data"],
  "Pemrograman": ["Python", "Web Development", "Pemrograman Basis Data", "API Design"],
  "Kecerdasan Buatan": ["Machine Learning", "AI untuk Bisnis", "Prompt Engineering"],
  "Produktivitas Kantor": ["Microsoft Excel", "Manajemen Arsip", "Time Management"],
  Kesekretariatan: ["Sekretaris Profesional", "Notulen Rapat", "Etika Bisnis"],
  "Hukum Bisnis": ["Legal Drafting", "Hukum Kontrak", "Perizinan Berusaha", "Kepatuhan"],
  "Tata Kelola": ["GCG", "Manajemen Kepatuhan", "Anti Penyuapan ISO 37001", "Whistleblowing System"],
  Perbankan: ["Analisis Kredit", "Manajemen Risiko Perbankan", "Anti Pencucian Uang"],
  Asuransi: ["Underwriting", "Klaim Asuransi", "Manajemen Risiko Asuransi"],
  "Pasar Modal": ["Analisis Saham", "Manajemen Portofolio", "Valuasi Perusahaan"],
  Koperasi: ["Akuntansi Koperasi", "Tata Kelola Koperasi"],
  "Sektor Publik": ["Penyusunan RKA", "Akuntansi Pemerintahan", "Pengadaan Barang Jasa Pemerintah"],
  "Manajemen Aset": ["Manajemen Aset Tetap", "Inventarisasi Aset", "Penilaian Aset"],
  Properti: ["Manajemen Gedung", "Facility Management"],
  "Migas & Energi": ["Dasar Industri Migas", "Manajemen Energi", "ISO 50001"],
  Pertambangan: ["Manajemen Tambang", "K3 Pertambangan", "Reklamasi"],
  Perkebunan: ["Manajemen Kebun", "Agronomi", "Sertifikasi ISPO"],
  Perhotelan: ["Front Office", "Housekeeping", "Food & Beverage Service"],
  Kesehatan: ["Manajemen Rumah Sakit", "Akreditasi", "Rekam Medis"],
  Pendidikan: ["Desain Instruksional", "Training of Trainers", "E-Learning"],
  "Kewirausahaan": ["Business Model Canvas", "Startup", "Rencana Bisnis"],
  "Strategi Bisnis": ["Perencanaan Strategis", "Analisis SWOT", "Blue Ocean Strategy"],
  "Inovasi": ["Design Thinking", "Inovasi Produk", "Creative Problem Solving"],
  "Pengembangan Diri": ["Emotional Intelligence", "Personal Branding", "Growth Mindset"],
  "Etika & Budaya Kerja": ["Budaya Kerja", "Integritas", "Employee Engagement"],
  "Manajemen Fasilitas": ["Facility Management", "Building Maintenance"],
  Transportasi: ["Manajemen Armada", "Defensive Driving", "Keselamatan Transportasi"],
  Maritim: ["Manajemen Pelabuhan", "Shipping", "Keselamatan Maritim"],
  Penerbangan: ["Manajemen Bandara", "Keselamatan Penerbangan"],
  Konstruksi: ["Manajemen Konstruksi", "Estimasi Biaya Konstruksi", "K3 Konstruksi"],
  Teknik: ["Gambar Teknik", "Instrumentasi", "Kelistrikan Industri"],
  "Telekomunikasi": ["Jaringan Komputer", "Fiber Optik", "Network Security"],
  "Ritel": ["Retail Management", "Visual Merchandising", "Store Operation"],
  "Makanan & Minuman": ["HACCP", "Keamanan Pangan", "Halal Assurance System"],
  Farmasi: ["CPOB", "Distribusi Farmasi", "Regulatory Affairs"],
  "Statistik": ["Statistik Bisnis", "Analisis Regresi", "Survei & Sampling"],
  "Bahasa Inggris Bisnis": ["Business English", "Presentation in English", "Email Writing"],
};

const PREFIXES = ["Pelatihan", "Workshop", "Sertifikasi", "Masterclass", "Bootcamp", "Kursus Intensif"];
const SUFFIXES = [
  "",
  "untuk Supervisor",
  "untuk Manajer",
  "Tingkat Dasar",
  "Tingkat Lanjut",
  "Berbasis Studi Kasus",
  "untuk Staf Non-Teknis",
  "dan Implementasinya",
];
const AUDIENCES = ["staf", "supervisor", "manajer", "tim lintas fungsi", "pimpinan unit"];
const OUTCOMES = [
  "menyusun rencana kerja yang terukur",
  "mengambil keputusan berbasis data",
  "menerapkan praktik terbaik di unit kerja",
  "mengurangi kesalahan proses",
  "meningkatkan kualitas layanan",
];
const OUTCOME_VERBS = ["Menerapkan", "Menyusun", "Menganalisis", "Mengevaluasi", "Merancang", "Memantau"];
const OUTCOME_OBJECTS = [
  "langkah kerja yang terstandar",
  "rencana tindak lanjut untuk tim",
  "indikator keberhasilan yang terukur",
  "laporan ringkas untuk pimpinan",
  "checklist pemeriksaan harian",
  "prioritas perbaikan proses",
];
const MODULE_PREFIXES = ["Dasar-dasar", "Praktik", "Studi kasus", "Evaluasi dan tindak lanjut"];
const DURATIONS = ["1 hari", "2 hari", "3 hari", "5 hari", "16 jam pelajaran"];
const METHODS: TrainingMethod[] = ["ONLINE", "OFFLINE", "HYBRID"];
const TYPE_SETS: TrainingType[][] = [["PUBLIC"], ["IN_HOUSE"], ["PUBLIC", "IN_HOUSE"]];
const CITIES = ["Jakarta", "Bandung", "Surabaya", "Yogyakarta", "Bali", "Medan", "Makassar", "Batam"];

async function main() {
  assertDevDatabase();
  const db = getDb();
  const random = createRandom(20261010);
  // RNG terpisah untuk konten terstruktur, supaya urutan `random` (judul/slug) tetap sama dengan
  // seed bulk versi lama dan baris yang sudah ada dikenali lewat slug-nya.
  const contentRandom = createRandom(20261011);
  const fieldNames = Object.keys(FIELDS);

  // Kategori
  const maxOrder = await db.category.aggregate({ where: { deletedAt: null }, _max: { order: true } });
  const createdCategories = await db.category.createMany({
    data: fieldNames.map((name, index) => ({
      slug: slugify(name),
      name,
      description: `Pelatihan bidang ${name.toLowerCase()} untuk perusahaan dan instansi.`,
      order: (maxOrder._max.order ?? 0) + index + 1,
    })),
    skipDuplicates: true,
  });
  const categories = await db.category.findMany({
    where: { slug: { in: fieldNames.map((name) => slugify(name)) }, deletedAt: null },
    select: { id: true, slug: true, name: true },
  });
  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));

  // Pelatihan (judul unik lewat nomor seri di slug)
  const now = Date.now();
  const twoYears = 730 * 24 * 60 * 60 * 1000;
  const planned = Array.from({ length: TRAINING_COUNT }, (_, index) => {
    const field = random.pick(fieldNames);
    const topic = random.pick(FIELDS[field]);
    const title = [random.pick(PREFIXES), topic, random.pick(SUFFIXES)].filter(Boolean).join(" ");
    const secondField = random.next() < 0.3 ? random.pick(fieldNames) : null;
    const serial = String(index + 1).padStart(4, "0");
    return {
      slug: `${slugify(title)}-b${serial}`,
      title,
      summary: `${title} membantu ${random.pick(AUDIENCES)} ${random.pick(OUTCOMES)} melalui materi ${topic.toLowerCase()} yang praktis.`,
      duration: random.pick(DURATIONS),
      method: random.pick(METHODS),
      types: random.pick(TYPE_SETS),
      priceText: `Rp${(random.int(25, 120) * 100_000).toLocaleString("id-ID")} per peserta`,
      showPrice: random.next() < 0.6,
      status: "PUBLISHED" as const,
      publishedAt: new Date(now - Math.floor(random.next() * twoYears)),
      publishRevalidatedAt: new Date(now),
      outcomes: Array.from({ length: contentRandom.int(4, 6) }, (_, i) =>
        `${OUTCOME_VERBS[(index + i) % OUTCOME_VERBS.length]} ${OUTCOME_OBJECTS[(index + i * 2) % OUTCOME_OBJECTS.length]} terkait ${topic.toLowerCase()}`,
      ),
      modules: MODULE_PREFIXES.slice(0, contentRandom.int(2, 4)).map((prefix) => ({
        title: `${prefix} ${topic}`,
        points: [`Konsep ${topic.toLowerCase()}`, "Latihan terpandu", "Diskusi kasus peserta"].slice(0, contentRandom.int(2, 3)),
        durationMinutes: contentRandom.pick([60, 90, 120]),
      })),
      audience: [...new Set([contentRandom.pick(AUDIENCES), contentRandom.pick(AUDIENCES)])].map((role) => ({
        role: role.charAt(0).toUpperCase() + role.slice(1),
        note: null,
      })),
      categorySlugs: [...new Set([slugify(field), ...(secondField ? [slugify(secondField)] : [])])],
      hasSchedules: random.next() < 0.35,
    };
  });

  let createdTrainings = 0;
  let createdLinks = 0;
  let createdSchedules = 0;
  let backfilled = 0;
  for (let start = 0; start < planned.length; start += BATCH) {
    const batch = planned.slice(start, start + BATCH);
    const result = await db.training.createMany({
      data: batch.map((item) => ({
        slug: item.slug,
        title: item.title,
        summary: item.summary,
        duration: item.duration,
        method: item.method,
        types: item.types,
        priceText: item.priceText,
        showPrice: item.showPrice,
        status: item.status,
        publishedAt: item.publishedAt,
        publishRevalidatedAt: item.publishRevalidatedAt,
        outcomes: item.outcomes,
        modules: item.modules,
        audience: item.audience,
      })),
      skipDuplicates: true,
    });
    createdTrainings += result.count;

    const rows = await db.training.findMany({
      where: { slug: { in: batch.map((item) => item.slug) }, deletedAt: null },
      select: { id: true, slug: true, outcomes: true, _count: { select: { categories: true, schedules: true } } },
    });
    const bySlug = new Map(rows.map((row) => [row.slug, row]));

    // Dummy dari seed bulk versi lama (sebelum konten terstruktur): lengkapi kontennya.
    const outdated = batch.filter((item) => bySlug.get(item.slug)?.outcomes.length === 0);
    if (outdated.length > 0) {
      await db.$transaction(
        outdated.map((item) =>
          db.training.update({
            where: { id: bySlug.get(item.slug)?.id },
            data: { outcomes: item.outcomes, modules: item.modules, audience: item.audience },
          }),
        ),
      );
      backfilled += outdated.length;
    }

    const links = batch.flatMap((item) => {
      const row = bySlug.get(item.slug);
      if (!row || row._count.categories > 0) return [];
      return item.categorySlugs.flatMap((slug) => {
        const category = categoryBySlug.get(slug);
        return category ? [{ trainingId: row.id, categoryId: category.id }] : [];
      });
    });
    if (links.length > 0) {
      createdLinks += (await db.trainingCategory.createMany({ data: links, skipDuplicates: true })).count;
    }

    const schedules = batch.flatMap((item) => {
      const row = bySlug.get(item.slug);
      if (!item.hasSchedules || !row || row._count.schedules > 0) return [];
      return Array.from({ length: random.int(1, 3) }, () => {
        const startDate = new Date(now + random.int(-30, 180) * 24 * 60 * 60 * 1000);
        startDate.setUTCHours(0, 0, 0, 0);
        const endDate = new Date(startDate.getTime() + random.int(0, 2) * 24 * 60 * 60 * 1000);
        const method = random.pick(METHODS);
        return {
          trainingId: row.id,
          startDate,
          endDate,
          city: method === "ONLINE" ? null : random.pick(CITIES),
          venue: method === "ONLINE" ? "Zoom" : "Ruang pelatihan",
          method,
          price: random.int(25, 120) * 100_000,
          status: random.next() < 0.15 ? ("FULL" as const) : ("OPEN" as const),
        };
      });
    });
    if (schedules.length > 0) createdSchedules += (await db.schedule.createMany({ data: schedules })).count;
  }

  const totalPublic = await db.training.count({ where: { deletedAt: null, status: "PUBLISHED" } });
  console.info(
    `Seed bulk selesai: +${createdCategories.count} kategori, +${createdTrainings} pelatihan, ` +
      `+${createdLinks} relasi kategori, +${createdSchedules} jadwal, ${backfilled} dummy lama dilengkapi. ` +
      `Total pelatihan published: ${totalPublic}.`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => getDb().$disconnect());
