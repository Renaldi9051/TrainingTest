// Konten contoh Fase 3: menu, pengaturan kontak/footer, layanan, klien, testimoni, portofolio,
// marketing, media partner, halaman statis, halaman profil, dan section beranda.
// Dipakai prisma/seed-content.ts (database baru) dan scripts/sync-content-dev.ts (training_dev).
//
// Isi dan struktur menu mengikuti situs referensi; semua teks ditulis ulang sendiri. Tidak ada
// logo, foto, nama orang, nomor, email, alamat, atau domain asli: semuanya dummy. Nama organisasi
// memakai kata "Contoh"; nomor 0812-0000-000x; domain contoh-*.id / example.com.
import type { CategoryIcon } from "../../src/lib/validators/category";
import type { RichTextDoc } from "../../src/lib/rich-text";
import { doc, h3, p, paragraphs, ul } from "./rich-text";

// ===== Pengaturan (hanya key yang diatur di sini; key lain tetap dari seed.ts) =====

export const contactSetting = {
  phone: "021 0000 0000",
  email: "info@example.com",
  emailSecondary: "pendaftaran@example.com",
  whatsapp: "6281200000001",
  address: "Gedung Contoh Lt. 5\nJl. Contoh Raya No. 10, Jakarta Pusat 10110",
  // Peta umum area Monas, Jakarta (bukan alamat referensi).
  mapEmbedUrl:
    "https://www.openstreetmap.org/export/embed.html?bbox=106.8166%2C-6.1830%2C106.8352%2C-6.1702&layer=mapnik",
};

export const socialSetting = {
  links: [
    { platform: "instagram" as const, label: "", url: "https://www.instagram.com/example" },
    { platform: "facebook" as const, label: "", url: "https://www.facebook.com/example" },
    { platform: "x" as const, label: "", url: "https://x.com/example" },
  ],
};

export const footerSetting = {
  description:
    "Lembaga pelatihan untuk profesional dan perusahaan: public training, in-house training, sertifikasi, dan outbound di berbagai bidang.",
  copyright: "Lembaga Pelatihan Contoh",
};

// ===== Layanan =====

export type SeedService = { slug: string; title: string; icon: CategoryIcon; summary: string; body: RichTextDoc };

export const services: SeedService[] = [
  {
    slug: "top-training",
    title: "Top Training",
    icon: "cog",
    summary:
      "Pelatihan bidang engineering dan teknik industri, tersedia sebagai kelas public terjadwal maupun in-house di lokasi perusahaan.",
    body: doc(
      p("Top Training adalah rangkaian program teknik untuk tim operasi, perawatan, dan produksi. Materinya dekat dengan pekerjaan di lapangan: membaca gambar teknik, merawat peralatan, sampai menganalisis kerusakan yang berulang."),
      p("Setiap kelas dipandu instruktur yang berpengalaman di industri, dengan porsi latihan dan diskusi kasus yang besar. Peserta pulang membawa lembar kerja dan prosedur yang bisa langsung diterapkan."),
      h3("Bidang yang tersedia"),
      ul("Mechanical dan maintenance", "Electrical dan instrumentasi", "Migas, pertambangan, dan pembangkit", "K3 dan lingkungan kerja"),
      h3("Format pelaksanaan"),
      ul("Public training di kota besar dengan jadwal tetap", "In-house training dengan materi dan studi kasus perusahaan", "Kelas online untuk topik teori dan pengantar"),
    ),
  },
  {
    slug: "tot-lsp-iki-bnsp",
    title: "TOT LSP - IKI BNSP",
    icon: "graduation-cap",
    summary:
      "Persiapan sertifikasi kompetensi trainer dan instruktur: dari menyusun materi dan merancang sesi sampai simulasi uji kompetensi.",
    body: doc(
      p("Program Training of Trainers ini ditujukan bagi praktisi yang ingin mengajar secara profesional dan memiliki bukti kompetensi sebagai instruktur. Peserta mempelajari cara menganalisis kebutuhan pelatihan, menyusun rencana sesi, dan menyampaikan materi dengan metode yang melibatkan peserta."),
      p("Di akhir program, peserta dibimbing menyiapkan portofolio bukti dan berlatih menghadapi asesmen. Pelaksanaan uji kompetensi mengikuti ketentuan lembaga sertifikasi yang ditunjuk."),
      h3("Yang dipelajari"),
      ul("Analisis kebutuhan pelatihan", "Penyusunan rencana dan materi sesi", "Teknik fasilitasi dan presentasi", "Evaluasi hasil belajar", "Persiapan portofolio dan simulasi asesmen"),
    ),
  },
  {
    slug: "persiapan-pensiun-kewirausahaan",
    title: "Persiapan Pensiun & Kewirausahaan",
    icon: "lightbulb",
    summary:
      "Membantu karyawan menyambut masa pensiun dengan semangat dan bekal praktis untuk memulai usaha sendiri.",
    body: doc(
      p("Masa pensiun adalah awal babak baru. Program ini menyiapkan peserta secara mental dan finansial, sehingga perubahan rutinitas dan penghasilan bisa dihadapi dengan tenang."),
      p("Sesi kewirausahaan membahas cara memilih jenis usaha yang sesuai minat dan modal, menghitung kelayakan sederhana, serta mengelola keuangan usaha agar tidak tercampur dengan keuangan keluarga."),
      h3("Materi utama"),
      ul("Kesiapan mental dan motivasi menghadapi pensiun", "Perencanaan keuangan masa pensiun", "Memilih dan merancang usaha", "Pemasaran sederhana dan pengelolaan kas usaha"),
    ),
  },
  {
    slug: "outbound-training",
    title: "Outbound Training",
    icon: "users",
    summary:
      "Kegiatan team building dan acara perusahaan berpeserta banyak, dirancang dengan tujuan belajar yang jelas.",
    body: doc(
      p("Outbound training memadukan permainan luar ruang dengan refleksi yang terarah. Setiap aktivitas dipilih untuk melatih satu aspek kerja sama: komunikasi, kepercayaan, pembagian peran, atau pengambilan keputusan."),
      p("Kami menangani acara dari puluhan sampai ratusan peserta, termasuk pemilihan lokasi, fasilitator, perlengkapan, dan dokumentasi kegiatan."),
      h3("Cocok untuk"),
      ul("Team building antardivisi", "Gathering dan family day perusahaan", "Pembukaan program pengembangan karyawan", "Pembekalan kepemimpinan"),
    ),
  },
];

// ===== Klien, testimoni, portofolio, marketing, media partner =====

export const clients = [
  "PT Contoh Energi Nusantara",
  "PT Contoh Tambang Sejahtera",
  "PT Contoh Semen Indonesia",
  "PT Contoh Pupuk Makmur",
  "PT Contoh Migas Persada",
  "PT Contoh Listrik Mandiri",
  "PT Contoh Logistik Utama",
  "PT Contoh Bank Sentosa",
  "PT Contoh Asuransi Abadi",
  "PT Contoh Manufaktur Presisi",
  "PT Contoh Kimia Raya",
  "PT Contoh Konstruksi Bangun",
];

export const testimonials = [
  {
    name: "Rina",
    role: "HR Development Manager",
    company: "PT Contoh Energi Nusantara",
    quote:
      "Materi disusun sesuai kebutuhan tim kami. Instruktur sabar menjawab pertanyaan dan contoh kasusnya sangat dekat dengan pekerjaan di lapangan.",
  },
  {
    name: "Andi",
    role: "Supervisor Maintenance",
    company: "PT Contoh Semen Indonesia",
    quote:
      "Setelah pelatihan, kami mulai menyusun jadwal perawatan dari data kerusakan. Jumlah perbaikan mendadak di lini produksi turun cukup terasa.",
  },
  {
    name: "Sari",
    role: "Kepala Bagian Pengadaan",
    company: "PT Contoh Logistik Utama",
    quote:
      "Pelaksanaannya rapi dari pendaftaran sampai sertifikat. Template evaluasi pemasok yang dibagikan langsung kami pakai.",
  },
];

export const portfolio = [
  {
    title: "In-house training preventive maintenance",
    date: "2026-09-15",
    client: "PT Contoh Semen Indonesia",
    description: "Tiga hari di area pabrik bersama 30 teknisi dan planner perawatan, ditutup dengan penyusunan jadwal perawatan per lini.",
  },
  {
    title: "TOT instruktur internal",
    date: "2026-08-25",
    client: "PT Contoh Energi Nusantara",
    description: "Pembekalan 20 calon instruktur internal, dari menyusun rencana sesi sampai simulasi asesmen kompetensi.",
  },
  {
    title: "Program persiapan pensiun angkatan 2026",
    date: "2026-07-30",
    client: "PT Contoh Bank Sentosa",
    description: "Dua hari untuk 45 karyawan yang memasuki masa persiapan pensiun, termasuk klinik rencana usaha.",
  },
  {
    title: "Outbound team building 250 peserta",
    date: "2026-06-20",
    client: "PT Contoh Logistik Utama",
    description: "Kegiatan satu hari di area perbukitan dengan 12 pos permainan dan sesi refleksi per divisi.",
  },
  {
    title: "Pelatihan K3 untuk pengawas lapangan",
    date: "2026-05-12",
    client: "PT Contoh Tambang Sejahtera",
    description: "Pelatihan identifikasi bahaya dan investigasi insiden untuk 40 pengawas di lokasi tambang.",
  },
  {
    title: "Workshop audit internal berbasis risiko",
    date: "2026-04-08",
    client: "PT Contoh Asuransi Abadi",
    description: "Workshop tiga hari bagi tim audit internal untuk menyusun rencana audit tahunan berbasis risiko.",
  },
];

// Nomor dummy 0812-0000-000x (disimpan format wa.me oleh validator).
export const marketing = ["Rina", "Dewi", "Andi", "Sari", "Budi"].map((name, index) => ({
  name,
  phone: `0812-0000-000${index + 1}`,
  defaultMessage: "Halo, saya ingin mendaftar pelatihan",
}));

export const mediaPartners = ["contoh-satu.id", "contoh-dua.id", "contoh-tiga.id"].map((domain) => ({
  name: domain,
  url: `https://${domain}`,
}));

// ===== Menu =====

export type SeedNavItem = { label: string; href: string; children?: { label: string; href: string }[] };

export const headerNav: SeedNavItem[] = [
  { label: "Beranda", href: "/" },
  { label: "Profil", href: "/profil", children: [{ label: "Portofolio", href: "/profil/portofolio" }] },
  {
    label: "Layanan",
    href: "/layanan",
    children: services.map((service) => ({ label: service.title, href: `/layanan/${service.slug}` })),
  },
  { label: "Pelatihan", href: "/pelatihan" },
  { label: "Jadwal Training", href: "/jadwal" },
  // Halaman evaluasi dibuat di Fase 4; sampai saat itu 404.
  { label: "Evaluasi", href: "/evaluasi" },
];

// Halaman statis yang ditautkan menu footer "Bantuan".
export const TERMS_SLUG = "syarat-dan-ketentuan";
export const PRIVACY_SLUG = "kebijakan-privasi";

export const footerNav: SeedNavItem[] = [
  { label: "Syarat & Ketentuan", href: `/${TERMS_SLUG}` },
  { label: "Kebijakan Privasi", href: `/${PRIVACY_SLUG}` },
  // Halaman kontak dibuat di Fase 4.
  { label: "Hubungi Kami", href: "/kontak" },
];

// ===== Halaman statis =====

const legalNote = "Isi halaman ini contoh. Sesuaikan dengan ketentuan resmi lembaga sebelum situs tayang.";

export const staticPages = [
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

// ===== Visi & misi (dipakai profil dan beranda) =====

export const visionMission = {
  vision:
    "Menjadi pusat pengembangan ilmu dan keterampilan bagi para profesional di Indonesia dan Asia Tenggara.",
  mission: [
    "Menyediakan ruang belajar tempat praktisi dan peserta saling berbagi pengetahuan dan pengalaman kerja.",
    "Memberikan pelayanan pelatihan yang profesional, tepat waktu, dan mudah diakses.",
    "Membangun kerja sama dengan tenaga ahli, perguruan tinggi, pemerintah, dan pelaku industri untuk menghadirkan materi yang relevan.",
  ],
  motto: "Belajar hari ini, berkarya lebih baik esok hari.",
};

// ===== Halaman profil (PRD 5.4) =====
// Tanpa id: id blok dibuat saat seed/sinkronisasi (crypto.randomUUID).

export const profilePage = {
  title: "Tentang kami",
  blocks: [
    {
      type: "RICH_TEXT",
      eyebrow: "01 / Tentang kami",
      heading: "Mitra belajar para profesional",
      body: paragraphs(
        "Kami adalah lembaga pelatihan yang menyelenggarakan public training, in-house training, program sertifikasi, dan outbound untuk perusahaan, instansi, serta perorangan.",
        "Program kami mencakup lebih dari tujuh puluh bidang, dari keuangan dan sumber daya manusia sampai engineering, migas, dan pertambangan. Setiap kelas dipandu praktisi yang memahami tantangan di tempat kerja.",
        "Kami percaya pelatihan yang baik diukur dari perubahan cara kerja peserta setelah kelas selesai, bukan hanya dari sertifikat yang dibawa pulang.",
      ),
    },
    {
      type: "SERVICES",
      eyebrow: "02 / Layanan",
      heading: "Layanan kami",
      intro: "Empat jenis program yang bisa disesuaikan dengan kebutuhan organisasi Anda.",
      mode: "auto",
      limit: 4,
    },
    { type: "VISION_MISSION", eyebrow: "03 / Visi, misi & moto", ...visionMission },
    {
      type: "FEATURES",
      eyebrow: "04 / Keunggulan",
      heading: "Kenapa memilih kami",
      items: [
        { title: "Instruktur praktisi", description: "Pengajar berpengalaman langsung di bidang yang diajarkan.", icon: "users" },
        { title: "Materi aplikatif", description: "Studi kasus dan latihan yang dekat dengan pekerjaan sehari-hari.", icon: "clipboard-check" },
        { title: "Program bisa disesuaikan", description: "Silabus in-house disusun bersama tim Anda.", icon: "settings" },
        { title: "Pilihan format", description: "Kelas public, in-house, online, atau hybrid.", icon: "laptop" },
        { title: "Jadwal rutin", description: "Kelas public terjadwal setiap bulan di beberapa kota.", icon: "presentation" },
        { title: "Sertifikat & evaluasi", description: "Sertifikat keikutsertaan dan laporan evaluasi untuk instansi.", icon: "award" },
      ],
    },
    {
      type: "LIST",
      eyebrow: "05 / Bidang unggulan",
      heading: "Bidang pelatihan unggulan",
      style: "chips",
      items: [
        "Accounting",
        "Audit",
        "Human Resource",
        "Leadership",
        "Maintenance",
        "Electrical",
        "Oil and Gas",
        "Mining",
        "Health, Safety & Environment",
        "Procurement",
        "Information Technology",
        "Customer Services",
      ],
    },
    {
      type: "LIST",
      eyebrow: "06 / Peserta",
      heading: "Target peserta",
      style: "bullet",
      items: [
        "Karyawan BUMN dan perusahaan swasta",
        "Aparatur instansi pemerintah",
        "Supervisor, manajer, dan pimpinan unit",
        "Teknisi dan tenaga ahli di lapangan",
        "Calon trainer dan instruktur",
        "Karyawan yang memasuki masa persiapan pensiun",
      ],
    },
    {
      type: "DOWNLOAD",
      eyebrow: "07 / Company profile",
      heading: "Unduh company profile",
      description: "Ringkasan profil lembaga, daftar program, dan cara bekerja sama dalam satu dokumen PDF.",
      label: "Unduh company profile",
      // File PDF diunggah admin; selama kosong blok ini tidak tampil di publik.
      file: null,
    },
  ],
};

// ===== Section beranda =====
// Urutan mengikuti beranda situs referensi, lalu section tambahan PRD 5.3. Semua visible.

export const homeSections = [
  {
    type: "HERO",
    content: {
      eyebrow: "Training provider",
      headline: "Tambah pengetahuan, tingkatkan kemampuan",
      rotatingWords: ["profesional", "tim Anda", "karier Anda"],
      subheadline:
        "Public training dan in-house training di lebih dari tujuh puluh bidang, dipandu praktisi yang memahami pekerjaan Anda.",
      showSearch: true,
      searchPlaceholder: "Cari pelatihan, mis. maintenance",
      primaryCta: { label: "Dapatkan harga spesial", href: "/pelatihan" },
      secondaryCta: null,
      image: null,
    },
  },
  {
    type: "SERVICES",
    content: {
      eyebrow: "01 / Layanan",
      heading: "Program dan layanan training kami",
      intro: "Pilih program yang paling sesuai dengan kebutuhan Anda dan tim.",
      mode: "auto",
      limit: 4,
      cta: { label: "Semua layanan", href: "/layanan" },
    },
  },
  { type: "VISION_MISSION", content: { eyebrow: "02 / Visi & misi", ...visionMission } },
  { type: "CLIENTS", content: { eyebrow: "03 / Klien", heading: "Klien kami", mode: "auto", limit: 24 } },
  {
    type: "LATEST_TRAININGS",
    content: {
      eyebrow: "04 / Terbaru",
      heading: "Training terupdate",
      mode: "auto",
      limit: 12,
      cta: { label: "Lihat selengkapnya", href: "/pelatihan" },
    },
  },
  {
    type: "STATS",
    content: {
      eyebrow: "05 / Angka",
      heading: "Dipercaya banyak organisasi",
      items: [
        { value: 100, prefix: "", suffix: "+", label: "Instruktur praktisi" },
        { value: 1000, prefix: "", suffix: "+", label: "Judul pelatihan" },
        { value: 70, prefix: "", suffix: "+", label: "Bidang pelatihan" },
        { value: 4, prefix: "", suffix: "", label: "Negara" },
      ],
    },
  },
  {
    type: "CATEGORIES",
    content: {
      eyebrow: "06 / Kategori",
      heading: "Kategori populer",
      mode: "auto",
      limit: 12,
      cta: { label: "Semua pelatihan", href: "/pelatihan" },
    },
  },
  {
    type: "UPCOMING_SCHEDULES",
    content: {
      eyebrow: "07 / Jadwal",
      heading: "Jadwal terdekat",
      limit: 5,
      cta: { label: "Semua jadwal", href: "/jadwal" },
    },
  },
  { type: "TESTIMONIALS", content: { eyebrow: "08 / Testimoni", heading: "Kata peserta", mode: "auto", limit: 6 } },
  {
    type: "CTA",
    content: {
      eyebrow: "Konsultasi",
      heading: "Butuh pelatihan khusus untuk tim Anda?",
      body: "Ceritakan kebutuhan tim, kami bantu susun program, jadwal, dan anggarannya.",
      primaryCta: { label: "Lihat layanan", href: "/layanan" },
      secondaryCta: { label: "Jadwal training", href: "/jadwal" },
    },
  },
] as const;
