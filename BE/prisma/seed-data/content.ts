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
    "Lembaga pelatihan drone dan industri kreatif: pilot drone, pemetaan udara, fotografi, videografi, desain, sampai keuangan untuk pelaku usaha kreatif.",
  copyright: "Lembaga Pelatihan Contoh",
};

// ===== Layanan =====

export type SeedService = { slug: string; title: string; icon: CategoryIcon; summary: string; body: RichTextDoc };

export const services: SeedService[] = [
  {
    slug: "top-training",
    title: "Top Training",
    icon: "plane",
    summary:
      "Program unggulan drone dan industri kreatif: pilot drone, pemetaan udara, foto dan video, sampai desain, dalam kelas public maupun in-house.",
    body: doc(
      p("Top Training adalah rangkaian program paling diminati kami. Peserta belajar langsung dari praktisi yang setiap hari menerbangkan drone untuk survei, inspeksi, dan produksi, atau bekerja di studio foto, video, dan desain."),
      p("Kelas drone menggabungkan teori singkat dengan jam terbang di area latihan. Kelas kreatif berbasis proyek: setiap peserta pulang membawa karya yang bisa langsung masuk portofolio."),
      h3("Bidang yang tersedia"),
      ul("Pilot drone, sertifikasi, dan perawatan drone", "Pemetaan, survei udara, dan inspeksi industri", "Fotografi, videografi, dan sinematografi", "Desain grafis, animasi, dan konten digital"),
      h3("Format pelaksanaan"),
      ul("Public training di beberapa kota dengan jadwal tetap", "In-house training dengan materi dan studi kasus organisasi Anda", "Kelas online untuk materi teori, desain, dan konten"),
    ),
  },
  {
    slug: "tot-lsp-iki-bnsp",
    title: "TOT LSP - IKI BNSP",
    icon: "graduation-cap",
    summary:
      "Persiapan sertifikasi kompetensi trainer dan instruktur, cocok bagi pilot drone senior dan praktisi kreatif yang ingin mengajar secara profesional.",
    body: doc(
      p("Banyak praktisi drone dan kreatif sudah ahli di bidangnya, tetapi belum terbiasa mengajar. Program Training of Trainers ini membekali peserta cara menganalisis kebutuhan belajar, menyusun rencana sesi, dan memandu praktik dengan aman."),
      p("Di akhir program, peserta dibimbing menyiapkan portofolio bukti dan berlatih menghadapi asesmen. Pelaksanaan uji kompetensi mengikuti ketentuan lembaga sertifikasi yang ditunjuk."),
      h3("Yang dipelajari"),
      ul("Analisis kebutuhan pelatihan", "Penyusunan rencana dan materi sesi teori maupun praktik", "Teknik fasilitasi dan demonstrasi", "Evaluasi hasil belajar", "Persiapan portofolio dan simulasi asesmen"),
    ),
  },
  {
    slug: "persiapan-pensiun-kewirausahaan",
    title: "Persiapan Pensiun & Kewirausahaan",
    icon: "lightbulb",
    summary:
      "Bekal menyambut masa pensiun dengan semangat, sekaligus peluang usaha di bidang jasa drone, fotografi, dan produksi konten.",
    body: doc(
      p("Masa pensiun adalah awal babak baru. Program ini menyiapkan peserta secara mental dan finansial, lalu memperkenalkan peluang usaha yang bisa dimulai dengan modal terukur, seperti jasa foto udara, pemetaan lahan skala kecil, atau produksi konten untuk UMKM."),
      p("Sesi kewirausahaan membahas cara memilih jenis usaha, menghitung kelayakan sederhana, menentukan harga jasa, dan memisahkan keuangan usaha dari keuangan keluarga."),
      h3("Materi utama"),
      ul("Kesiapan mental dan motivasi menghadapi pensiun", "Perencanaan keuangan masa pensiun", "Peluang usaha jasa drone dan kreatif", "Pemasaran sederhana dan pengelolaan kas usaha"),
    ),
  },
  {
    slug: "outbound-training",
    title: "Outbound Training",
    icon: "users",
    summary:
      "Team building dan acara perusahaan berpeserta banyak, lengkap dengan dokumentasi foto, video, dan liputan udara.",
    body: doc(
      p("Outbound training memadukan permainan luar ruang dengan refleksi yang terarah. Setiap aktivitas dipilih untuk melatih satu aspek kerja sama: komunikasi, kepercayaan, pembagian peran, atau pengambilan keputusan."),
      p("Kami menangani acara dari puluhan sampai ratusan peserta, termasuk lokasi, fasilitator, perlengkapan, serta dokumentasi foto, video, dan rekaman drone yang siap dibagikan setelah acara."),
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
    role: "Koordinator Survei",
    company: "PT Contoh Konstruksi Bangun",
    quote:
      "Setelah kelas pemetaan, tim kami bisa menghitung volume stockpile sendiri tanpa menunggu surveyor luar. Instruktur sabar membahas data dari proyek kami.",
  },
  {
    name: "Andi",
    role: "Pilot Drone",
    company: "PT Contoh Energi Nusantara",
    quote:
      "Latihan prosedur darurat dan simulasi uji praktiknya sangat membantu. Saya lulus uji kompetensi di percobaan pertama.",
  },
  {
    name: "Sari",
    role: "Kepala Humas",
    company: "PT Contoh Logistik Utama",
    quote:
      "Tim humas kami sekarang bisa memproduksi video profil dan konten media sosial sendiri, dari pengambilan gambar sampai editing.",
  },
];

export const portfolio = [
  {
    title: "Pelatihan pilot drone untuk tim inspeksi",
    date: "2026-09-15",
    client: "PT Contoh Energi Nusantara",
    description: "Tiga hari di area latihan bersama 16 teknisi, dari kendali dasar sampai simulasi inspeksi panel surya dan menara.",
  },
  {
    title: "Pemetaan lahan perkebunan dengan drone",
    date: "2026-08-25",
    client: "PT Contoh Agro Lestari",
    description: "Pendampingan tim kebun memetakan 300 hektare lahan dan menyusun peta blok untuk perencanaan pemupukan.",
  },
  {
    title: "Kelas drone penyemprot untuk kelompok tani",
    date: "2026-07-30",
    client: "Koperasi Contoh Tani Makmur",
    description: "Dua hari praktik kalibrasi dan penyemprotan dengan air untuk 25 anggota kelompok tani, ditutup penyusunan SOP semprot.",
  },
  {
    title: "Produksi video profil perusahaan",
    date: "2026-06-20",
    client: "PT Contoh Logistik Utama",
    description: "Workshop videografi untuk tim humas: naskah, pengambilan gambar darat dan udara, sampai editing video profil berdurasi tiga menit.",
  },
  {
    title: "Workshop desain identitas visual UMKM",
    date: "2026-05-12",
    client: "Dinas Contoh Koperasi dan UMKM",
    description: "Pendampingan 40 pelaku UMKM menyusun logo, palet warna, dan template konten media sosial untuk usahanya.",
  },
  {
    title: "Dokumentasi udara acara tahunan",
    date: "2026-04-08",
    client: "PT Contoh Bank Sentosa",
    description: "Liputan foto dan video udara untuk acara 1.000 peserta, sekaligus pelatihan singkat tim internal tentang keselamatan terbang.",
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

// Inquiry contoh (dummy, email example.com, nomor 0812-0000-00xx).
export const sampleInquiries = [
  {
    name: "Rina Contoh",
    company: "PT Contoh Agro",
    email: "rina@example.com",
    phone: "6281200000011",
    source: "TRAINING_DETAIL" as const,
    message: "Kami ingin pelatihan in-house untuk 12 orang di bulan depan.",
    status: "NEW" as const,
  },
  {
    name: "Bayu Contoh",
    company: "CV Contoh Kreatif",
    email: "bayu@example.com",
    phone: null,
    source: "CONTACT" as const,
    interest: "Fotografi produk",
    message: "Apakah ada kelas akhir pekan?",
    status: "IN_PROGRESS" as const,
  },
  {
    name: "Sari Contoh",
    company: null,
    email: "sari@example.com",
    phone: "6281200000013",
    source: "TRAINING_DETAIL" as const,
    message: null,
    status: "DONE" as const,
  },
];

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

// Halaman pembayaran (+ menu header, lihat seedPaymentPage di seed.ts). Tayang dengan rekening contoh
// bertanda [ISI] (keputusan pemilik, 19 Okt 2026); pemilik menggantinya dengan rekening resmi lewat admin.
export const PAYMENT_SLUG = "pembayaran";

export const paymentPage = {
  slug: PAYMENT_SLUG,
  title: "Pembayaran",
  blocks: [
    {
      type: "PAYMENT_ACCOUNTS",
      eyebrow: "Transfer bank",
      heading: "Rekening pembayaran",
      intro: "Transfer sesuai nominal pada surat penawaran atau konfirmasi pendaftaran ke salah satu rekening resmi berikut.",
      accounts: [
        {
          bank: "[ISI] Nama bank",
          number: "0000000000",
          holder: "[ISI] Nama pemilik rekening",
        },
      ],
      confirm: { label: "Konfirmasi pembayaran", href: "/kontak" },
    },
    {
      type: "LIST",
      eyebrow: "",
      heading: "Langkah pembayaran",
      style: "bullet",
      items: [
        "Transfer sesuai nominal tagihan ke salah satu rekening di atas.",
        "Tulis nama peserta dan judul pelatihan di berita transfer.",
        "Simpan bukti transfer, lalu kirim lewat tombol konfirmasi pembayaran.",
        "Tim kami mengirim konfirmasi pendaftaran paling lambat satu hari kerja.",
      ],
    },
  ],
};

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
      p("Nama, nama instansi, jabatan, alamat email, dan nomor telepon yang Anda isi saat mendaftar atau bertanya tentang pelatihan."),
      h3("Penggunaan data"),
      ul(
        "Memproses pendaftaran dan mengirim informasi pelaksanaan pelatihan.",
        "Menyiapkan sertifikat keikutsertaan untuk peserta dan instansi pengirim.",
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
    "Menjadi pusat pengembangan keterampilan drone dan industri kreatif bagi para profesional di Indonesia dan Asia Tenggara.",
  mission: [
    "Menyediakan ruang belajar tempat pilot drone, fotografer, videografer, dan desainer saling berbagi ilmu dan pengalaman.",
    "Memberikan pelayanan pelatihan yang profesional, aman, dan mudah diakses dari mana saja.",
    "Membangun kerja sama dengan tenaga ahli, perguruan tinggi, pemerintah, dan pelaku industri untuk menghadirkan materi yang relevan.",
  ],
  motto: "Terbang lebih tinggi, berkarya lebih jauh.",
};

// ===== Halaman profil (PRD 5.4) =====
// Tanpa id: id blok dibuat saat seed/sinkronisasi (crypto.randomUUID).

export const profilePage = {
  title: "Tentang kami",
  blocks: [
    {
      type: "RICH_TEXT",
      eyebrow: "01 / Tentang kami",
      heading: "Belajar drone dan industri kreatif dari praktisi",
      body: paragraphs(
        "Kami adalah lembaga pelatihan drone dan industri kreatif yang menyelenggarakan public training, in-house training, program sertifikasi, dan outbound untuk perusahaan, instansi, serta perorangan.",
        "Program kami mencakup lima belas bidang: dari pilot drone, pemetaan, inspeksi, dan drone pertanian sampai fotografi, videografi, desain, animasi, dan konten digital, ditambah keuangan dan perpajakan untuk pelaku usaha kreatif.",
        "Setiap kelas dipandu praktisi aktif. Kami percaya pelatihan yang baik diukur dari jam terbang dan karya yang dihasilkan peserta, bukan hanya dari sertifikat yang dibawa pulang.",
      ),
    },
    {
      type: "SERVICES",
      eyebrow: "02 / Layanan",
      heading: "Layanan kami",
      intro: "Empat jenis program drone dan kreatif yang bisa disesuaikan dengan kebutuhan organisasi Anda.",
      mode: "auto",
      limit: 4,
    },
    { type: "VISION_MISSION", eyebrow: "03 / Visi, misi & moto", ...visionMission },
    {
      type: "FEATURES",
      eyebrow: "04 / Keunggulan",
      heading: "Kenapa memilih kami",
      items: [
        { title: "Instruktur praktisi", description: "Pilot drone berlisensi dan praktisi kreatif yang aktif di industri.", icon: "users" },
        { title: "Jam terbang nyata", description: "Kelas drone memakai unit latihan dan area terbang yang aman.", icon: "plane" },
        { title: "Berbasis proyek", description: "Kelas kreatif menghasilkan karya yang langsung masuk portofolio.", icon: "camera" },
        { title: "Pilihan format", description: "Kelas public, in-house, online, atau hybrid.", icon: "laptop" },
        { title: "Jadwal rutin", description: "Kelas public terjadwal setiap bulan di beberapa kota.", icon: "presentation" },
        { title: "Sertifikat keikutsertaan", description: "Sertifikat digital bagi peserta yang mengikuti seluruh sesi.", icon: "award" },
      ],
    },
    {
      type: "LIST",
      eyebrow: "05 / Bidang unggulan",
      heading: "Bidang pelatihan unggulan",
      style: "chips",
      items: [
        "Pilot Drone",
        "Sertifikasi Pilot Drone",
        "Pemetaan & Survei Udara",
        "Fotografi & Videografi Udara",
        "Drone Pertanian",
        "Inspeksi Industri dengan Drone",
        "Perakitan & Perawatan Drone",
        "Fotografi",
        "Videografi & Sinematografi",
        "Desain Grafis",
        "Animasi & Motion Graphic",
        "Konten Digital & Media Sosial",
      ],
    },
    {
      type: "LIST",
      eyebrow: "06 / Peserta",
      heading: "Target peserta",
      style: "bullet",
      items: [
        "Pemula yang ingin menjadi pilot drone",
        "Surveyor, inspektur, dan tenaga teknik di lapangan",
        "Petani, penyuluh, dan staf perkebunan",
        "Fotografer, videografer, desainer, dan kreator konten",
        "Tim humas, pemasaran, dan media internal instansi",
        "Pelaku UMKM dan karyawan yang menyiapkan usaha di masa pensiun",
      ],
    },
    {
      type: "DOWNLOAD",
      eyebrow: "07 / Company profile",
      heading: "Unduh company profile",
      description: "Ringkasan profil lembaga, daftar program drone dan kreatif, serta cara bekerja sama dalam satu dokumen PDF.",
      label: "Unduh company profile",
      // File PDF diunggah admin; selama kosong blok ini tidak tampil di publik.
      file: null,
    },
  ],
};

// ===== Section beranda =====
// Urutan mengikuti beranda situs referensi, lalu section tambahan PRD 5.3. Semua visible.

// Teks hero sesuai katalog pelatihan korporat (21 Okt 2026). Database lama diperbarui oleh seed-home-copy.ts.
export const heroCopy = {
  rotatingWords: ["memimpin", "mengelola", "bersaing"],
  subheadline:
    "Pelatihan publik dan in-house untuk perusahaan dan instansi, dari keuangan, SDM, dan manajemen sampai K3, pertambangan, dan migas, dipandu praktisi berpengalaman.",
  searchPlaceholder: "Cari pelatihan, mis. manajemen risiko",
};

export const homeSections = [
  {
    type: "HERO",
    content: {
      eyebrow: "Training provider",
      headline: "Tambah pengetahuan, tingkatkan kemampuan",
      rotatingWords: heroCopy.rotatingWords,
      subheadline: heroCopy.subheadline,
      showSearch: true,
      searchPlaceholder: heroCopy.searchPlaceholder,
      primaryCta: { label: "Dapatkan harga spesial", href: "/pelatihan" },
      secondaryCta: null,
      // Tanpa slide: hero teks. Slide (gambar dokumentasi asli) diisi admin lewat editor slide.
      layout: "fullbleed",
      intervalMs: 6000,
      photoStyle: "color",
      showViewfinder: true,
      showBadge: false,
      badgeText: "",
      badgeHref: "",
      slides: [],
      decor: true,
    },
  },
  { type: "VISION_MISSION", content: { eyebrow: "01 / Visi & misi", ...visionMission } },
  { type: "CLIENTS", content: { eyebrow: "02 / Klien", heading: "Klien kami", mode: "auto", limit: 24 } },
  {
    type: "LATEST_TRAININGS",
    content: {
      eyebrow: "03 / Terbaru",
      heading: "Training terupdate",
      mode: "auto",
      limit: 6,
      cta: { label: "Lihat selengkapnya", href: "/pelatihan" },
    },
  },
  {
    type: "UPCOMING_SCHEDULES",
    content: {
      eyebrow: "04 / Jadwal",
      heading: "Jadwal terdekat",
      limit: 5,
      cta: { label: "Semua jadwal", href: "/jadwal" },
    },
  },
  { type: "TESTIMONIALS", content: { eyebrow: "05 / Testimoni", mode: "auto", limit: 6 } },
  {
    type: "CTA",
    content: {
      eyebrow: "Konsultasi",
      heading: "Butuh pelatihan drone atau kreatif untuk tim Anda?",
      body: "Ceritakan kebutuhan tim, kami bantu susun program, jadwal, unit latihan, dan anggarannya.",
      primaryCta: { label: "Lihat layanan", href: "/layanan" },
      secondaryCta: { label: "Jadwal training", href: "/jadwal" },
    },
  },
] as const;
