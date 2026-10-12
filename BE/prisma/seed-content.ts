// Konten contoh Fase 3 (beranda, layanan, klien, testimoni, portofolio, marketing, media partner,
// halaman statis). Dipanggil dari seed.ts kecuali mode --minimal (setup e2e).
// Aturan sama dengan katalog: setiap entitas hanya diisi kalau tabelnya kosong sama sekali, termasuk
// baris di Sampah, supaya data yang dihapus admin tidak muncul lagi di setiap `docker compose up`.
// Semua teks ditulis sendiri. Nama organisasi memakai kata "Contoh" supaya tidak tertukar dengan
// organisasi sungguhan. Tidak ada gambar: admin mengunggah foto & logo sendiri di media library.
import { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import type { RichTextBlock, RichTextDoc } from "../src/lib/rich-text";
import { clientCreateSchema } from "../src/lib/validators/client";
import { homeSectionCreateSchema } from "../src/lib/validators/home-section";
import { marketingCreateSchema } from "../src/lib/validators/marketing";
import { mediaPartnerCreateSchema } from "../src/lib/validators/media-partner";
import { pageBlocksSchema } from "../src/lib/validators/page-blocks";
import { portfolioCreateSchema } from "../src/lib/validators/portfolio";
import { serviceCreateSchema } from "../src/lib/validators/service";
import { testimonialCreateSchema } from "../src/lib/validators/testimonial";

const db = getDb();

const EMPTY_SEO = { title: "", description: "", ogImageId: null };

const text = (value: string) => ({ type: "text" as const, text: value });
const p = (value: string): RichTextBlock => ({ type: "paragraph", content: [text(value)] });
const h3 = (value: string): RichTextBlock => ({ type: "heading", attrs: { level: 3 }, content: [text(value)] });
const ul = (...items: string[]): RichTextBlock => ({
  type: "bulletList",
  content: items.map((item) => ({ type: "listItem", content: [p(item)] })),
});
const doc = (...content: RichTextBlock[]): RichTextDoc => ({ type: "doc", content });

// Slug layanan contoh. In-house dipakai juga oleh tombol CTA penutup beranda.
const IN_HOUSE_SLUG = "in-house-training";

const services = [
  {
    slug: IN_HOUSE_SLUG,
    title: "In-house training",
    icon: "building-2",
    summary: "Pelatihan khusus untuk tim Anda, di kantor sendiri atau online, dengan studi kasus dari pekerjaan sehari-hari.",
    body: doc(
      p("Materi disusun setelah sesi analisis kebutuhan bersama perwakilan tim. Contoh kasus, latihan, dan istilah disesuaikan dengan proses kerja perusahaan, sehingga peserta tidak perlu menerjemahkan teori ke konteksnya sendiri."),
      h3("Cocok untuk"),
      ul("Tim dengan kebutuhan kompetensi yang sama", "Program pengembangan tahunan", "Peluncuran sistem atau prosedur baru"),
      h3("Alur kerja"),
      ul("Diskusi kebutuhan dan sasaran", "Penyusunan silabus dan jadwal", "Pelaksanaan pelatihan", "Laporan evaluasi peserta"),
    ),
  },
  {
    slug: "public-training",
    title: "Public training",
    icon: "users",
    summary: "Kelas terbuka terjadwal untuk peserta dari berbagai organisasi. Cocok untuk satu sampai beberapa orang per instansi.",
    body: doc(
      p("Public training memberi kesempatan belajar bersama peserta dari industri lain. Diskusi lintas organisasi sering membuka sudut pandang baru untuk masalah yang sama."),
      p("Jadwal, lokasi, dan biaya setiap kelas tercantum di halaman jadwal. Pendaftaran ditutup ketika kuota terpenuhi."),
    ),
  },
  {
    slug: "sertifikasi-kompetensi",
    title: "Sertifikasi kompetensi",
    icon: "award",
    summary: "Pendampingan persiapan uji kompetensi: pemetaan unit, latihan portofolio bukti, dan simulasi asesmen.",
    body: doc(
      p("Peserta dibantu memahami unit kompetensi yang diujikan, menyiapkan bukti kerja, dan berlatih menghadapi wawancara asesor. Pelaksanaan uji mengikuti ketentuan lembaga sertifikasi yang ditunjuk."),
    ),
  },
  {
    slug: "outbound-team-building",
    title: "Outbound & team building",
    icon: "handshake",
    summary: "Kegiatan luar ruang yang dirancang dengan tujuan belajar yang jelas, bukan sekadar rekreasi.",
    body: doc(
      p("Setiap permainan dipilih untuk melatih satu aspek kerja tim, misalnya komunikasi, pembagian peran, atau pengambilan keputusan di bawah tekanan. Sesi refleksi di akhir menghubungkan pengalaman lapangan dengan situasi kerja."),
    ),
  },
];

const clients = [
  "PT Contoh Logistik Nusantara",
  "Bank Contoh Sejahtera",
  "PT Contoh Energi Mandiri",
  "Rumah Sakit Contoh Medika",
  "PT Contoh Manufaktur Presisi",
  "Dinas Contoh Kota",
  "PT Contoh Retail Indonesia",
  "Koperasi Contoh Makmur",
];

const testimonials = [
  {
    name: "Rina Kusuma",
    role: "HR Manager",
    company: "PT Contoh Logistik Nusantara",
    quote: "Draf KPI yang kami susun di kelas langsung dipakai untuk penilaian kinerja semester berikutnya. Trainer sabar membahas kasus kami satu per satu.",
  },
  {
    name: "Bayu Pratama",
    role: "Supervisor Keuangan",
    company: "PT Contoh Manufaktur Presisi",
    quote: "Materinya padat tapi mudah diikuti. Template analisis yang dibagikan masih saya pakai setiap tutup buku.",
  },
  {
    name: "Sari Wulandari",
    role: "Kepala Bagian Pelayanan",
    company: "Rumah Sakit Contoh Medika",
    quote: "Simulasi penanganan keluhan terasa sangat dekat dengan situasi di loket kami. Tim jadi lebih percaya diri menghadapi pasien.",
  },
];

const portfolio = [
  {
    title: "Pelatihan penyusunan KPI untuk kepala cabang",
    date: "2026-08-20",
    client: "PT Contoh Logistik Nusantara",
    description: "Dua hari di kantor pusat bersama 24 kepala cabang. Hasilnya draf KPI per cabang yang ditinjau bersama direksi.",
  },
  {
    title: "Workshop pelayanan prima tenaga front office",
    date: "2026-07-09",
    client: "Rumah Sakit Contoh Medika",
    description: "Tiga angkatan peserta dengan simulasi kasus dari loket pendaftaran, farmasi, dan kasir.",
  },
  {
    title: "Outbound kepemimpinan tim produksi",
    date: "2026-05-16",
    client: "PT Contoh Manufaktur Presisi",
    description: "Kegiatan luar ruang satu hari untuk 60 supervisor produksi, ditutup sesi refleksi dan rencana aksi per lini.",
  },
];

// Nomor dummy (bukan nomor sungguhan); admin mengganti dengan nomor marketing yang aktif.
const marketing = [
  { name: "Andi Saputra", phone: "6281200000001", defaultMessage: "Halo, saya ingin bertanya tentang pelatihan in-house." },
  { name: "Dewi Lestari", phone: "6281200000002", defaultMessage: "Halo, saya ingin mendaftar kelas public training." },
  { name: "Fajar Nugroho", phone: "6281200000003", defaultMessage: null },
];

const mediaPartners = ["Majalah Contoh SDM", "Portal Contoh Bisnis", "Radio Contoh FM", "Buletin Contoh Industri"];

const visionMission = {
  vision: "Menjadi mitra pengembangan kompetensi yang dipercaya organisasi di seluruh Indonesia.",
  mission: [
    "Menyusun program pelatihan yang relevan dengan kebutuhan kerja.",
    "Menghadirkan trainer praktisi dengan pengalaman lapangan.",
    "Mendampingi peserta sampai materi diterapkan di tempat kerja.",
  ],
  motto: "Belajar, terapkan, ukur hasilnya.",
};

// Urutan section beranda mengikuti PRD 5.3. Section berbasis data memakai mode auto.
const homeSections = [
  {
    type: "HERO",
    content: {
      eyebrow: "Training provider",
      headline: "Pelatihan yang membuat tim bekerja lebih",
      rotatingWords: ["terarah", "terukur", "percaya diri"],
      subheadline: "Public training dan in-house training bersama trainer praktisi, dengan materi yang langsung dipakai di pekerjaan.",
      showSearch: true,
      searchPlaceholder: "Cari pelatihan, mis. KPI",
      primaryCta: { label: "Lihat pelatihan", href: "/pelatihan" },
      secondaryCta: { label: "Lihat jadwal", href: "/jadwal" },
      image: null,
    },
  },
  {
    type: "STATS",
    content: {
      eyebrow: "01 / Angka",
      heading: "Dipercaya banyak organisasi",
      items: [
        { value: 100, prefix: "", suffix: "+", label: "Trainer praktisi" },
        { value: 1000, prefix: "", suffix: "+", label: "Judul pelatihan" },
        { value: 4, prefix: "", suffix: "", label: "Negara" },
      ],
    },
  },
  {
    type: "SERVICES",
    content: {
      eyebrow: "02 / Layanan",
      heading: "Layanan kami",
      intro: "Pilih format yang paling pas dengan kebutuhan dan jadwal tim Anda.",
      mode: "auto",
      limit: 4,
      cta: { label: "Semua layanan", href: "/layanan" },
    },
  },
  {
    type: "CATEGORIES",
    content: {
      eyebrow: "03 / Kategori",
      heading: "Kategori populer",
      mode: "auto",
      limit: 12,
      cta: { label: "Semua pelatihan", href: "/pelatihan" },
    },
  },
  {
    type: "LATEST_TRAININGS",
    content: {
      eyebrow: "04 / Terbaru",
      heading: "Pelatihan terbaru",
      mode: "auto",
      limit: 6,
      cta: { label: "Lihat katalog", href: "/pelatihan" },
    },
  },
  {
    type: "UPCOMING_SCHEDULES",
    content: {
      eyebrow: "05 / Jadwal",
      heading: "Jadwal terdekat",
      limit: 5,
      cta: { label: "Semua jadwal", href: "/jadwal" },
    },
  },
  { type: "CLIENTS", content: { eyebrow: "06 / Klien", heading: "Klien kami", mode: "auto", limit: 24 } },
  { type: "VISION_MISSION", content: { eyebrow: "07 / Visi & misi", ...visionMission } },
  { type: "TESTIMONIALS", content: { eyebrow: "08 / Testimoni", heading: "Kata peserta", mode: "auto", limit: 6 } },
  {
    type: "CTA",
    content: {
      eyebrow: "Konsultasi",
      heading: "Butuh pelatihan khusus untuk tim Anda?",
      body: "Ceritakan kebutuhan tim, kami bantu susun program dan jadwalnya.",
      primaryCta: { label: "Konsultasi in-house", href: `/layanan/${IN_HOUSE_SLUG}` },
      secondaryCta: { label: "Lihat jadwal", href: "/jadwal" },
    },
  },
] as const;

// Halaman statis yang ditautkan menu footer.
export const TERMS_SLUG = "syarat-dan-ketentuan";
export const PRIVACY_SLUG = "kebijakan-privasi";

const legalNote = "Isi halaman ini contoh. Sesuaikan dengan ketentuan resmi lembaga sebelum situs tayang.";

const pages = [
  {
    slug: TERMS_SLUG,
    title: "Syarat & Ketentuan",
    eyebrow: "Berlaku sejak 1 Oktober 2026",
    heading: "Ketentuan mengikuti pelatihan",
    body: doc(
      p(legalNote),
      h3("Pendaftaran"),
      p("Pendaftaran dianggap sah setelah formulir diterima dan konfirmasi dikirim oleh tim kami. Kuota kelas public terbatas dan diberikan sesuai urutan konfirmasi pembayaran."),
      h3("Pembayaran"),
      p("Pembayaran dilakukan paling lambat tiga hari kerja sebelum pelatihan dimulai, kecuali ada kesepakatan tertulis lain. Harga belum termasuk pajak kecuali disebutkan."),
      h3("Pembatalan dan penjadwalan ulang"),
      ul(
        "Pembatalan oleh peserta paling lambat tujuh hari sebelum pelatihan: biaya dikembalikan penuh.",
        "Pembatalan kurang dari tujuh hari: peserta dapat dialihkan ke jadwal lain atau digantikan rekan dari instansi yang sama.",
        "Bila kelas dibatalkan oleh penyelenggara, peserta dapat memilih pengembalian biaya atau pindah jadwal.",
      ),
      h3("Sertifikat"),
      p("Sertifikat keikutsertaan diberikan kepada peserta yang mengikuti seluruh sesi. Sertifikat dikirim dalam bentuk digital paling lambat tujuh hari kerja setelah pelatihan."),
      h3("Perubahan ketentuan"),
      p("Ketentuan ini dapat diperbarui sewaktu-waktu. Versi yang berlaku adalah versi yang tampil di halaman ini."),
    ),
  },
  {
    slug: PRIVACY_SLUG,
    title: "Kebijakan Privasi",
    eyebrow: "Berlaku sejak 1 Oktober 2026",
    heading: "Cara kami mengelola data Anda",
    body: doc(
      p(legalNote),
      h3("Data yang kami kumpulkan"),
      p("Nama, nama instansi, jabatan, alamat email, dan nomor telepon yang Anda isi saat mendaftar, bertanya, atau mengisi evaluasi pelatihan."),
      h3("Penggunaan data"),
      ul(
        "Memproses pendaftaran dan mengirim informasi pelaksanaan pelatihan.",
        "Menyiapkan sertifikat dan laporan evaluasi untuk instansi pengirim.",
        "Mengirim informasi jadwal baru bila Anda menyetujuinya.",
      ),
      h3("Penyimpanan dan keamanan"),
      p("Data disimpan di server dengan akses terbatas dan hanya dibuka oleh petugas yang memerlukannya. Kami tidak menjual data pribadi kepada pihak lain."),
      h3("Hak Anda"),
      p("Anda dapat meminta salinan, perbaikan, atau penghapusan data dengan menghubungi kami melalui kontak yang tercantum di situs ini."),
    ),
  },
];

export type ContentSeedResult = Record<string, number | "dilewati">;

// Jalankan fn hanya kalau tabelnya kosong (termasuk Sampah); hasilnya jumlah baris yang dibuat.
async function ifEmpty(count: () => Promise<number>, fn: () => Promise<number>): Promise<number | "dilewati"> {
  return (await count()) === 0 ? fn() : "dilewati";
}

export async function seedContent(publishedAt: Date): Promise<ContentSeedResult> {
  const result: ContentSeedResult = {};

  result.layanan = await ifEmpty(
    () => db.service.count(),
    async () => {
      for (const [order, service] of services.entries()) {
        const input = serviceCreateSchema.parse({ ...service, status: "PUBLISHED" });
        await db.service.create({
          data: {
            slug: service.slug,
            title: input.title,
            icon: input.icon,
            summary: input.summary,
            body: input.body ? (input.body as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
            order,
            status: input.status,
            seo: EMPTY_SEO,
          },
        });
      }
      return services.length;
    },
  );

  result.klien = await ifEmpty(
    () => db.client.count(),
    async () => {
      await db.client.createMany({
        data: clients.map((name, order) => ({ ...clientCreateSchema.parse({ name }), order })),
      });
      return clients.length;
    },
  );

  result.testimoni = await ifEmpty(
    () => db.testimonial.count(),
    async () => {
      await db.testimonial.createMany({
        data: testimonials.map((item, order) => ({ ...testimonialCreateSchema.parse(item), order })),
      });
      return testimonials.length;
    },
  );

  result.portofolio = await ifEmpty(
    () => db.portfolioItem.count(),
    async () => {
      for (const [order, item] of portfolio.entries()) {
        // Tanpa galeri: foto kegiatan diunggah admin sendiri.
        const input = portfolioCreateSchema.parse(item);
        await db.portfolioItem.create({
          data: {
            title: input.title,
            client: input.client,
            description: input.description,
            date: input.date ? new Date(`${input.date}T00:00:00.000Z`) : null,
            order,
          },
        });
      }
      return portfolio.length;
    },
  );

  result.marketing = await ifEmpty(
    () => db.marketingContact.count(),
    async () => {
      await db.marketingContact.createMany({
        data: marketing.map((item, order) => ({ ...marketingCreateSchema.parse(item), order })),
      });
      return marketing.length;
    },
  );

  result["media partner"] = await ifEmpty(
    () => db.mediaPartner.count(),
    async () => {
      await db.mediaPartner.createMany({
        data: mediaPartners.map((name, order) => ({ ...mediaPartnerCreateSchema.parse({ name }), order })),
      });
      return mediaPartners.length;
    },
  );

  // Halaman statis: hanya kalau belum ada halaman STANDARD sama sekali (halaman profil tidak dihitung).
  result["halaman statis"] = await ifEmpty(
    () => db.page.count({ where: { kind: "STANDARD" } }),
    async () => {
      for (const page of pages) {
        const blocks = pageBlocksSchema.parse([
          { id: crypto.randomUUID(), type: "RICH_TEXT", eyebrow: page.eyebrow, heading: page.heading, body: page.body },
        ]);
        await db.page.create({
          data: {
            kind: "STANDARD",
            slug: page.slug,
            title: page.title,
            status: "PUBLISHED",
            publishedAt,
            blocks: blocks as Prisma.InputJsonValue,
            seo: EMPTY_SEO,
          },
        });
      }
      return pages.length;
    },
  );

  result["section beranda"] = await ifEmpty(
    () => db.homeSection.count(),
    async () => {
      for (const [order, section] of homeSections.entries()) {
        const input = homeSectionCreateSchema.parse(section);
        await db.homeSection.create({
          data: {
            type: input.type,
            title: input.title,
            content: input.content as Prisma.InputJsonValue,
            order,
            visible: input.visible,
          },
        });
      }
      return homeSections.length;
    },
  );

  return result;
}
