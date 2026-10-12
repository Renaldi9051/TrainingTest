// Katalog contoh bertema drone, industri kreatif, dan keuangan: 15 kategori, 330 pelatihan
// (22 per kategori, level dasar/menengah/lanjut), 2-3 jadwal per pelatihan dalam 6 bulan ke depan.
// Dipakai prisma/seed.ts (database baru) dan scripts/sync-content-dev.ts (training_dev).
// Semua judul dan bahan teks ditulis sendiri; field lengkap dirakit dari bahan per kategori.
import { slugify } from "../../src/lib/slug";
import type { RichTextDoc } from "../../src/lib/rich-text";
import type { CategoryIcon } from "../../src/lib/validators/category";
import { paragraphs } from "./rich-text";

type Level = "dasar" | "menengah" | "lanjut";
type Method = "ONLINE" | "OFFLINE" | "HYBRID";
type TrainingType = "PUBLIC" | "IN_HOUSE";

export type SeedCategory = { slug: string; name: string; description: string; icon: CategoryIcon; featured: boolean };

export type SeedTraining = {
  slug: string;
  title: string;
  summary: string;
  description: RichTextDoc;
  outcomes: string[];
  modules: { title: string; points: string[]; durationMinutes: number | null }[];
  audience: { role: string; note: string | null }[];
  prerequisites: string | null;
  facilities: string[] | null;
  faq: { q: string; a: string }[];
  duration: string;
  method: Method;
  types: TrainingType[];
  priceText: string;
  showPrice: boolean;
  level: Level;
  // Kategori utama dulu; sebagian pelatihan punya kategori kedua yang relevan.
  categorySlugs: string[];
};

export type SeedSchedule = {
  trainingSlug: string;
  startDate: string;
  endDate: string;
  city: string | null;
  venue: string;
  method: Method;
  price: number;
  status: "OPEN" | "FULL";
};

// ===== Kategori =====

type Profile = {
  category: SeedCategory;
  context: string;
  audience: { role: string; note: string | null }[];
  outcomes: string[];
  modules: { title: string; points: string[] }[];
  prerequisite: { menengah: string; lanjut: string };
  facilities: string[] | null;
  faq: { q: string; a: string }[];
  methods: Method[];
  basePrice: number;
  // [judul, level, kategori kedua?] — 8 dasar, 8 menengah, 6 lanjut.
  titles: [string, Level, string?][];
};

const DRONE_FACILITIES = [
  "Unit drone latihan dan baterai cadangan selama kelas",
  "Area terbang latihan yang aman",
  "Modul materi digital dan checklist lapangan",
  "Sertifikat keikutsertaan",
];

const DRONE_FAQ = [
  { q: "Apakah peserta harus membawa drone sendiri?", a: "Tidak wajib. Unit latihan disediakan; peserta yang membawa drone sendiri boleh memakainya setelah dicek instruktur." },
  { q: "Bagaimana jika cuaca tidak memungkinkan untuk terbang?", a: "Sesi praktik dipindah ke simulator atau dijadwalkan ulang di hari yang sama atau sesi berikutnya." },
];

const CREATIVE_FAQ = [
  { q: "Perlu membawa perangkat sendiri?", a: "Disarankan membawa laptop atau kamera pribadi agar latihan sesuai perangkat yang dipakai sehari-hari. Unit pinjaman tersedia terbatas." },
  { q: "Apakah hasil latihan boleh dipakai untuk portofolio?", a: "Boleh. Semua karya latihan adalah milik peserta." },
];

const FINANCE_FAQ = [
  { q: "Apakah materi mengikuti aturan terbaru?", a: "Materi diperbarui mengikuti ketentuan yang berlaku saat kelas berlangsung dan dibahas dengan contoh kasus." },
  { q: "Apakah ada file latihan yang bisa dibawa pulang?", a: "Ya. Peserta mendapat template spreadsheet dan contoh dokumen yang dipakai di kelas." },
];

const profiles: Profile[] = [
  {
    category: { slug: "pilot-drone-dasar", name: "Pilot Drone Dasar", icon: "plane", featured: true, description: "Langkah pertama menjadi pilot drone: kendali dasar, prosedur aman, dan latihan terbang terpandu." },
    context: "Kelas ini menggabungkan teori singkat dengan jam terbang praktik bersama instruktur berlisensi.",
    audience: [
      { role: "Pemula yang ingin menjadi pilot drone", note: null },
      { role: "Staf dokumentasi dan humas", note: "yang akan mengoperasikan drone kantor" },
      { role: "Petugas lapangan", note: null },
      { role: "Penghobi drone", note: "yang ingin terbang lebih aman" },
    ],
    outcomes: [
      "Menyiapkan drone dan area terbang sesuai checklist keselamatan",
      "Mengendalikan drone dengan stabil pada berbagai kondisi",
      "Memahami batasan regulasi dan zona terbang",
      "Mengambil keputusan cepat saat terjadi gangguan",
      "Mencatat penerbangan dalam logbook pilot",
      "Merawat drone dan baterai setelah terbang",
    ],
    modules: [
      { title: "Keselamatan dan regulasi terbang", points: ["Zona terbang", "Batas ketinggian", "Izin dan pemberitahuan"] },
      { title: "Kendali dan orientasi", points: ["Stik kendali", "Hover stabil", "Orientasi depan-belakang"] },
      { title: "Prosedur pra dan pasca terbang", points: ["Checklist", "Kalibrasi", "Pencatatan logbook"] },
      { title: "Latihan manuver lapangan", points: ["Kotak dan delapan", "Orbit", "Pendaratan presisi"] },
      { title: "Penanganan gangguan", points: ["Sinyal hilang", "Baterai lemah", "Return to home"] },
      { title: "Evaluasi terbang", points: ["Uji praktik", "Umpan balik instruktur", "Rencana latihan mandiri"] },
    ],
    prerequisite: { menengah: "Sudah mampu hover stabil dan pernah mengikuti kelas pilot dasar.", lanjut: "Memiliki jam terbang minimal 20 jam atau sertifikat pilot drone." },
    facilities: DRONE_FACILITIES,
    faq: DRONE_FAQ,
    methods: ["OFFLINE", "OFFLINE", "HYBRID"],
    basePrice: 3_500_000,
    titles: [
      ["Pengenalan Drone dan Regulasi Penerbangan untuk Pemula", "dasar"],
      ["Dasar Menerbangkan Drone Multirotor", "dasar"],
      ["Persiapan Pra-Terbang dan Checklist Keselamatan", "dasar"],
      ["Teknik Lepas Landas dan Pendaratan yang Aman", "dasar"],
      ["Mengenal Mode Terbang dan Sensor Drone", "dasar"],
      ["Membaca Cuaca untuk Penerbangan Drone", "dasar"],
      ["Latihan Terbang dengan Simulator Drone", "dasar"],
      ["Manajemen Baterai LiPo untuk Pilot Drone", "dasar", "perakitan-perawatan-drone"],
      ["Manuver Terbang Presisi untuk Pilot Drone", "menengah"],
      ["Terbang Mode Manual (ATTI) Tanpa Bantuan GPS", "menengah"],
      ["Perencanaan Misi Terbang dengan Waypoint", "menengah"],
      ["Penerbangan Drone yang Aman di Area Perkotaan", "menengah"],
      ["Penanganan Situasi Darurat saat Terbang", "menengah"],
      ["Terbang Malam dan Kondisi Cahaya Rendah", "menengah"],
      ["Komunikasi Tim Pilot dan Observer", "menengah"],
      ["Navigasi dan Orientasi Drone di Lapangan", "menengah"],
      ["Pengenalan Operasi Drone di Luar Jarak Pandang", "lanjut"],
      ["Manajemen Risiko Operasi Drone Komersial", "lanjut", "sertifikasi-pilot-drone"],
      ["Kendali Drone FPV untuk Pilot Berpengalaman", "lanjut"],
      ["Operasi Multi-Drone dan Koordinasi Armada", "lanjut"],
      ["Penyusunan SOP Operasi Drone Perusahaan", "lanjut"],
      ["Menjadi Instruktur Teknik Dasar Terbang Drone", "lanjut"],
    ],
  },
  {
    category: { slug: "sertifikasi-pilot-drone", name: "Sertifikasi Pilot Drone", icon: "award", featured: true, description: "Persiapan ujian teori dan praktik, dokumen, serta kepatuhan untuk pilot dan operator drone." },
    context: "Materi disusun mengikuti kisi-kisi uji kompetensi yang umum dipakai, dengan latihan soal dan simulasi ujian.",
    audience: [
      { role: "Pilot drone yang akan mengikuti uji kompetensi", note: null },
      { role: "Operator jasa drone", note: null },
      { role: "Staf HSE perusahaan", note: "yang mengawasi operasi drone" },
      { role: "Instruktur dan penguji internal", note: null },
    ],
    outcomes: [
      "Memahami materi ujian teori secara menyeluruh",
      "Menyiapkan dokumen dan logbook untuk asesmen",
      "Menjalankan prosedur uji praktik dengan percaya diri",
      "Menerapkan manajemen keselamatan operasi",
      "Memahami tanggung jawab hukum operator drone",
      "Menyusun manual operasi sesuai kebutuhan sertifikasi",
    ],
    modules: [
      { title: "Regulasi dan ruang udara", points: ["Klasifikasi ruang udara", "Zona larangan", "Perizinan"] },
      { title: "Pengetahuan teknis pesawat tanpa awak", points: ["Aerodinamika", "Sistem propulsi", "Sistem kendali"] },
      { title: "Meteorologi dan human factors", points: ["Angin dan visibilitas", "Kelelahan pilot", "Pengambilan keputusan"] },
      { title: "Dokumentasi dan logbook", points: ["Format logbook", "Laporan insiden", "Manual operasi"] },
      { title: "Simulasi ujian", points: ["Latihan soal", "Simulasi praktik", "Pembahasan"] },
      { title: "Kepatuhan operator", points: ["Asuransi", "Tanggung jawab hukum", "Audit internal"] },
    ],
    prerequisite: { menengah: "Sudah lulus ujian teori atau memiliki jam terbang praktik.", lanjut: "Berstatus pilot bersertifikat atau mengelola operasi drone." },
    facilities: ["Bank soal latihan", "Template logbook dan manual operasi", "Sesi tanya jawab dengan penguji", "Sertifikat keikutsertaan"],
    faq: [
      { q: "Apakah kelas ini sudah termasuk biaya uji kompetensi?", a: "Belum. Biaya uji mengikuti lembaga penyelenggara ujian; kami membantu pendaftaran dan persiapannya." },
      DRONE_FAQ[1],
    ],
    methods: ["HYBRID", "OFFLINE", "ONLINE"],
    basePrice: 4_200_000,
    titles: [
      ["Persiapan Ujian Teori Pilot Drone", "dasar"],
      ["Regulasi Ruang Udara dan Izin Terbang", "dasar"],
      ["Memahami Zona Larangan Terbang", "dasar"],
      ["Dasar Aerodinamika untuk Ujian Pilot Drone", "dasar"],
      ["Meteorologi Dasar untuk Calon Pilot Drone", "dasar"],
      ["Pengetahuan Sistem Pesawat Tanpa Awak", "dasar"],
      ["Etika dan Privasi dalam Operasi Drone", "dasar"],
      ["Latihan Soal Ujian Teori Pilot Drone", "dasar"],
      ["Persiapan Uji Praktik Terbang", "menengah", "pilot-drone-dasar"],
      ["Simulasi Ujian Praktik bersama Penguji", "menengah"],
      ["Logbook Penerbangan dan Dokumentasi Pilot", "menengah"],
      ["Pengajuan Izin Terbang untuk Proyek", "menengah"],
      ["Sistem Manajemen Keselamatan untuk Operator Drone", "menengah"],
      ["Human Factors bagi Pilot Drone", "menengah"],
      ["Prosedur Komunikasi dengan Pengelola Ruang Udara", "menengah"],
      ["Asuransi dan Tanggung Jawab Hukum Operasi Drone", "menengah"],
      ["Persiapan Sertifikasi Operator Drone Komersial", "lanjut"],
      ["Audit Kepatuhan Operator Drone", "lanjut"],
      ["Penyusunan Manual Operasi untuk Sertifikasi", "lanjut"],
      ["Persiapan Asesmen Kompetensi Pilot Drone", "lanjut"],
      ["Penyegaran Sertifikasi Pilot Drone", "lanjut"],
      ["Pembekalan Penguji Internal Pilot Drone", "lanjut"],
    ],
  },
  {
    category: { slug: "pemetaan-survei-udara", name: "Pemetaan & Survei Udara", icon: "globe", featured: true, description: "Fotogrametri, ortofoto, model elevasi, dan survei berbasis drone untuk berbagai proyek." },
    context: "Peserta mengolah data dari penerbangan nyata sampai menjadi peta dan laporan yang siap diserahkan.",
    audience: [
      { role: "Surveyor dan staf pemetaan", note: null },
      { role: "Tenaga teknik sipil dan konstruksi", note: null },
      { role: "Staf GIS instansi", note: null },
      { role: "Operator jasa pemetaan drone", note: null },
    ],
    outcomes: [
      "Merencanakan penerbangan pemetaan dengan overlap yang tepat",
      "Mengolah foto udara menjadi ortofoto dan model elevasi",
      "Menempatkan dan mengukur titik kontrol tanah",
      "Menguji akurasi hasil pemetaan",
      "Mengintegrasikan hasil drone ke aplikasi GIS",
      "Menyusun laporan survei yang mudah dipahami klien",
    ],
    modules: [
      { title: "Perencanaan misi pemetaan", points: ["Overlap", "Ketinggian dan GSD", "Jalur terbang"] },
      { title: "Titik kontrol dan akurasi", points: ["GCP", "RTK dan PPK", "Uji akurasi"] },
      { title: "Pengolahan fotogrametri", points: ["Point cloud", "Ortofoto", "DEM dan DSM"] },
      { title: "Analisis dan GIS", points: ["Sistem koordinat", "Digitasi", "Perhitungan luas dan volume"] },
      { title: "Pelaporan hasil", points: ["Layout peta", "Metadata", "Penyerahan data"] },
      { title: "Studi kasus proyek", points: ["Konstruksi", "Tambang", "Perkotaan"] },
    ],
    prerequisite: { menengah: "Mampu menerbangkan drone dan memahami dasar sistem koordinat.", lanjut: "Berpengalaman mengolah data fotogrametri atau mengelola proyek survei." },
    facilities: ["Drone pemetaan untuk praktik", "Lisensi perangkat lunak pengolahan selama kelas", "Contoh dataset survei", "Sertifikat keikutsertaan"],
    faq: [
      { q: "Perangkat lunak apa yang dipakai?", a: "Kelas memakai perangkat lunak fotogrametri dan GIS yang umum di industri; lisensi kelas disediakan selama pelatihan." },
      { q: "Apakah laptop harus berspesifikasi tinggi?", a: "Untuk pengolahan data disarankan RAM minimal 16 GB. Komputer lab tersedia untuk kelas offline." },
    ],
    methods: ["OFFLINE", "HYBRID", "OFFLINE"],
    basePrice: 5_500_000,
    titles: [
      ["Pengantar Fotogrametri dengan Drone", "dasar"],
      ["Perencanaan Jalur Terbang untuk Pemetaan", "dasar"],
      ["Dasar Sistem Koordinat dan Proyeksi Peta", "dasar"],
      ["Pengambilan Foto Udara dengan Overlap yang Tepat", "dasar"],
      ["Pengenalan Ground Control Point", "dasar"],
      ["Pengolahan Ortofoto Dasar", "dasar"],
      ["Membaca Peta Hasil Survei Drone", "dasar"],
      ["Pemetaan Lahan Skala Kecil dengan Drone", "dasar"],
      ["Pengolahan Data Fotogrametri hingga DEM dan DSM", "menengah"],
      ["Pemetaan Topografi dengan Drone", "menengah"],
      ["Survei Volume Stockpile dengan Drone", "menengah"],
      ["Pemetaan Kawasan Perkotaan", "menengah"],
      ["Drone RTK dan PPK untuk Akurasi Tinggi", "menengah"],
      ["Pemetaan Garis Pantai dan Wilayah Pesisir", "menengah"],
      ["Integrasi Hasil Drone ke Aplikasi GIS", "menengah"],
      ["Pembuatan Model 3D Bangunan dari Foto Udara", "menengah", "inspeksi-industri-drone"],
      ["Pemetaan LiDAR dengan Drone", "lanjut"],
      ["Kontrol Kualitas dan Uji Akurasi Peta", "lanjut"],
      ["Survei Koridor untuk Jalan dan Jaringan Pipa", "lanjut"],
      ["Pemantauan Progres Proyek Konstruksi dengan Drone", "lanjut"],
      ["Manajemen Proyek Pemetaan Skala Besar", "lanjut"],
      ["Analisis Perubahan Lahan Multi-Waktu", "lanjut"],
    ],
  },
  {
    category: { slug: "fotografi-videografi-udara", name: "Fotografi & Videografi Udara", icon: "camera", featured: true, description: "Foto dan video dari udara untuk properti, pariwisata, acara, dan produksi komersial." },
    context: "Setiap sesi praktik menghasilkan materi yang langsung diedit dan dibahas bersama instruktur.",
    audience: [
      { role: "Fotografer dan videografer", note: "yang ingin menambah sudut pandang udara" },
      { role: "Kreator konten", note: null },
      { role: "Staf pemasaran properti dan pariwisata", note: null },
      { role: "Pilot drone", note: "yang ingin masuk ke produksi kreatif" },
    ],
    outcomes: [
      "Mengatur kamera drone untuk foto dan video yang tajam",
      "Menyusun komposisi gambar dari udara",
      "Merancang pergerakan kamera yang halus",
      "Mengedit dan mewarnai hasil rekaman udara",
      "Merencanakan pengambilan gambar sesuai brief klien",
      "Menjaga keselamatan terbang selama produksi",
    ],
    modules: [
      { title: "Kamera dan eksposur", points: ["Format foto dan video", "Filter ND", "Histogram"] },
      { title: "Komposisi dari udara", points: ["Pola dan garis", "Skala", "Cahaya"] },
      { title: "Pergerakan kamera", points: ["Reveal", "Orbit", "Tracking"] },
      { title: "Perencanaan produksi", points: ["Shot list", "Lokasi dan izin", "Waktu terbaik"] },
      { title: "Pascaproduksi", points: ["Editing", "Color grading", "Ekspor untuk berbagai platform"] },
      { title: "Praktik lapangan dan review", points: ["Sesi pengambilan gambar", "Kritik karya", "Revisi"] },
    ],
    prerequisite: { menengah: "Sudah bisa menerbangkan drone dan memahami dasar eksposur.", lanjut: "Memiliki portofolio foto atau video udara." },
    facilities: DRONE_FACILITIES,
    faq: [DRONE_FAQ[0], CREATIVE_FAQ[1]],
    methods: ["OFFLINE", "HYBRID", "OFFLINE"],
    basePrice: 3_900_000,
    titles: [
      ["Dasar Fotografi Udara dengan Drone", "dasar", "fotografi"],
      ["Pengaturan Kamera Drone untuk Pemula", "dasar"],
      ["Komposisi Gambar dari Udara", "dasar", "fotografi"],
      ["Gerakan Kamera Dasar untuk Video Udara", "dasar"],
      ["Fotografi Udara untuk Properti dan Real Estat", "dasar"],
      ["Membuat Video Udara untuk Media Sosial", "dasar", "konten-digital-media-sosial"],
      ["Panorama dan Foto 360 dari Drone", "dasar"],
      ["Mengedit Foto Udara Dasar", "dasar"],
      ["Sinematografi Udara: Shot dan Pergerakan", "menengah", "videografi-sinematografi"],
      ["Color Grading Video Udara", "menengah"],
      ["Fotografi Udara Golden Hour dan Blue Hour", "menengah"],
      ["Video Udara untuk Liputan Acara", "menengah"],
      ["Hyperlapse dan Timelapse dari Udara", "menengah"],
      ["Filter ND dan Eksposur Video Udara", "menengah"],
      ["Dokumentasi Udara untuk Pariwisata", "menengah"],
      ["Penyutradaraan Shot Udara untuk Iklan", "menengah"],
      ["Produksi Video Udara Komersial dari Brief sampai Edit", "lanjut", "videografi-sinematografi"],
      ["Sinematografi Udara dengan Drone FPV", "lanjut"],
      ["Fotografi Udara untuk Laporan Inspeksi Visual", "lanjut", "inspeksi-industri-drone"],
      ["Pengambilan Gambar Udara untuk Film Dokumenter", "lanjut"],
      ["Mengelola Bisnis Jasa Foto dan Video Udara", "lanjut"],
      ["Workflow Produksi Udara untuk Tim Kreatif", "lanjut"],
    ],
  },
  {
    category: { slug: "drone-pertanian", name: "Drone Pertanian", icon: "leaf", featured: true, description: "Penyemprotan, pemupukan, pemantauan tanaman, dan pertanian presisi dengan drone." },
    context: "Latihan dilakukan di lahan praktik dengan drone penyemprot dan kamera pemantau tanaman.",
    audience: [
      { role: "Petani dan kelompok tani", note: null },
      { role: "Staf perkebunan", note: null },
      { role: "Penyuluh pertanian", note: null },
      { role: "Calon penyedia jasa drone pertanian", note: null },
    ],
    outcomes: [
      "Mengoperasikan drone penyemprot dengan aman",
      "Menghitung dosis dan volume semprot yang tepat",
      "Memetakan lahan dan menyusun rute otomatis",
      "Membaca data kesehatan tanaman dari citra drone",
      "Merawat sistem semprot dan baterai",
      "Menghitung biaya operasi per hektare",
    ],
    modules: [
      { title: "Keselamatan dan regulasi", points: ["Alat pelindung diri", "Penanganan pestisida", "Area terbang"] },
      { title: "Kalibrasi sistem semprot", points: ["Nozzle", "Debit", "Lebar semprot"] },
      { title: "Pemetaan dan rute", points: ["Batas lahan", "Rute otomatis", "Lahan miring"] },
      { title: "Pemantauan tanaman", points: ["Kamera multispektral", "Indeks vegetasi", "Zona perlakuan"] },
      { title: "Perawatan alat", points: ["Pembersihan tangki", "Baterai", "Suku cadang"] },
      { title: "Hitungan usaha", points: ["Biaya per hektare", "Penjadwalan", "Kemitraan dengan petani"] },
    ],
    prerequisite: { menengah: "Sudah pernah mengoperasikan drone pertanian atau mengikuti kelas dasar.", lanjut: "Mengelola operasi drone pertanian atau kebun." },
    facilities: ["Drone penyemprot untuk praktik", "Lahan praktik", "Alat pelindung diri", "Sertifikat keikutsertaan"],
    faq: [
      { q: "Apakah praktik memakai pestisida sungguhan?", a: "Tidak. Latihan kalibrasi dan penyemprotan memakai air agar aman bagi peserta dan lingkungan." },
      DRONE_FAQ[1],
    ],
    methods: ["OFFLINE", "OFFLINE", "HYBRID"],
    basePrice: 3_800_000,
    titles: [
      ["Pengenalan Drone untuk Pertanian", "dasar"],
      ["Dasar Penyemprotan Tanaman dengan Drone", "dasar"],
      ["Keselamatan Operasi Drone Penyemprot", "dasar"],
      ["Kalibrasi Tangki dan Nozzle Drone Penyemprot", "dasar"],
      ["Pemetaan Lahan Sawah dengan Drone", "dasar", "pemetaan-survei-udara"],
      ["Perawatan Harian Drone Pertanian", "dasar"],
      ["Perhitungan Dosis dan Volume Semprot", "dasar"],
      ["Drone untuk Pemupukan Tanaman", "dasar"],
      ["Pemantauan Kesehatan Tanaman dengan Kamera Multispektral", "menengah"],
      ["Analisis Indeks Vegetasi NDVI", "menengah"],
      ["Perencanaan Rute Semprot Otomatis", "menengah"],
      ["Drone untuk Perkebunan Kelapa Sawit", "menengah"],
      ["Penebaran Benih dengan Drone", "menengah"],
      ["Pemetaan Kebun dan Penghitungan Pohon", "menengah", "pemetaan-survei-udara"],
      ["Operasi Drone Pertanian di Lahan Miring", "menengah"],
      ["Pengelolaan Data Lahan untuk Petani", "menengah"],
      ["Pertanian Presisi Berbasis Data Drone", "lanjut"],
      ["Manajemen Layanan Jasa Drone Pertanian", "lanjut"],
      ["Integrasi Drone dengan Sistem Informasi Perkebunan", "lanjut"],
      ["Penyusunan SOP Penyemprotan untuk Kelompok Tani", "lanjut"],
      ["Analisis Biaya dan Kelayakan Usaha Drone Pertanian", "lanjut"],
      ["Pelatihan Operator Drone untuk Pendamping Lapangan", "lanjut"],
    ],
  },
  {
    category: { slug: "inspeksi-industri-drone", name: "Inspeksi Industri dengan Drone", icon: "hard-hat", featured: true, description: "Inspeksi visual dan termal untuk bangunan, energi, telekomunikasi, dan fasilitas industri." },
    context: "Studi kasus diambil dari pekerjaan inspeksi nyata, lengkap dengan contoh laporan temuan.",
    audience: [
      { role: "Inspektur dan teknisi aset", note: null },
      { role: "Staf HSE", note: null },
      { role: "Engineer pemeliharaan", note: null },
      { role: "Operator jasa inspeksi drone", note: null },
    ],
    outcomes: [
      "Merencanakan misi inspeksi yang aman di area industri",
      "Mengambil foto dan video inspeksi yang informatif",
      "Membaca citra termal untuk menemukan anomali",
      "Menyusun laporan temuan yang terstruktur",
      "Menilai risiko operasi di sekitar struktur",
      "Mengintegrasikan hasil inspeksi dengan data aset",
    ],
    modules: [
      { title: "Keselamatan di area industri", points: ["Izin kerja", "Jarak aman struktur", "Gangguan elektromagnetik"] },
      { title: "Perencanaan inspeksi", points: ["Ruang lingkup", "Pola terbang", "Peralatan"] },
      { title: "Kamera visual dan termal", points: ["Resolusi", "Emisivitas", "Waktu terbaik"] },
      { title: "Analisis temuan", points: ["Klasifikasi cacat", "Prioritas", "Rekomendasi"] },
      { title: "Pelaporan", points: ["Format laporan", "Penandaan lokasi", "Arsip data"] },
      { title: "Studi kasus aset", points: ["Panel surya", "Menara", "Tangki dan cerobong"] },
    ],
    prerequisite: { menengah: "Mampu terbang manual dengan stabil dan memahami dasar inspeksi.", lanjut: "Berpengalaman melakukan inspeksi aset dengan drone." },
    facilities: ["Drone inspeksi dengan kamera termal untuk praktik", "Contoh laporan inspeksi", "Modul materi digital", "Sertifikat keikutsertaan"],
    faq: [
      { q: "Apakah praktik dilakukan di fasilitas industri?", a: "Praktik dasar di area latihan; kelas in-house dapat dilaksanakan di fasilitas peserta dengan izin pengelola." },
      DRONE_FAQ[1],
    ],
    methods: ["OFFLINE", "HYBRID", "OFFLINE"],
    basePrice: 5_200_000,
    titles: [
      ["Pengenalan Inspeksi Visual dengan Drone", "dasar"],
      ["Keselamatan Terbang di Area Industri", "dasar"],
      ["Dokumentasi Foto Inspeksi yang Informatif", "dasar"],
      ["Inspeksi Atap dan Fasad Bangunan", "dasar"],
      ["Dasar Kamera Termal untuk Inspeksi", "dasar"],
      ["Perencanaan Misi Inspeksi Sederhana", "dasar"],
      ["Pelaporan Temuan Inspeksi Drone", "dasar"],
      ["Inspeksi Menara Telekomunikasi Dasar", "dasar"],
      ["Inspeksi Panel Surya dengan Kamera Termal", "menengah"],
      ["Inspeksi Jaringan Transmisi Listrik", "menengah"],
      ["Inspeksi Cerobong dan Tangki Industri", "menengah"],
      ["Inspeksi Jembatan dan Struktur Beton", "menengah"],
      ["Inspeksi Jalur Pipa Migas dengan Drone", "menengah"],
      ["Inspeksi Turbin Angin", "menengah"],
      ["Terbang Dekat Struktur dengan Aman", "menengah", "pilot-drone-dasar"],
      ["Inspeksi Ruang Terbatas dengan Drone Berpelindung", "menengah"],
      ["Analisis Data Termografi Inspeksi", "lanjut"],
      ["Program Inspeksi Rutin Berbasis Drone", "lanjut"],
      ["Inspeksi Fasilitas Lepas Pantai", "lanjut"],
      ["Integrasi Hasil Inspeksi ke Sistem Manajemen Aset", "lanjut"],
      ["Model 3D untuk Inspeksi Digital Twin", "lanjut", "pemetaan-survei-udara"],
      ["Manajemen Risiko Inspeksi di Area Berbahaya", "lanjut"],
    ],
  },
  {
    category: { slug: "perakitan-perawatan-drone", name: "Perakitan & Perawatan Drone", icon: "wrench", featured: true, description: "Komponen, perakitan, kalibrasi, perbaikan, dan program perawatan armada drone." },
    context: "Sebagian besar waktu kelas dipakai di meja kerja: membongkar, merakit, dan menguji drone.",
    audience: [
      { role: "Teknisi drone", note: null },
      { role: "Pilot drone", note: "yang ingin merawat unit sendiri" },
      { role: "Penghobi FPV", note: null },
      { role: "Pengelola armada drone perusahaan", note: null },
    ],
    outcomes: [
      "Mengenali fungsi setiap komponen drone",
      "Merakit dan mengonfigurasi drone hingga siap terbang",
      "Melakukan kalibrasi dan pembaruan firmware",
      "Mendiagnosis dan memperbaiki kerusakan umum",
      "Menyusun jadwal perawatan berkala",
      "Membaca log penerbangan untuk menemukan masalah",
    ],
    modules: [
      { title: "Komponen dan fungsinya", points: ["Frame", "Motor dan ESC", "Flight controller"] },
      { title: "Perakitan dan perkabelan", points: ["Penyolderan", "Manajemen kabel", "Pengujian awal"] },
      { title: "Konfigurasi dan kalibrasi", points: ["Firmware", "Kompas dan IMU", "Tuning"] },
      { title: "Diagnosis kerusakan", points: ["Gejala umum", "Alat ukur", "Log penerbangan"] },
      { title: "Perawatan berkala", points: ["Checklist", "Penyimpanan", "Suku cadang"] },
      { title: "Uji terbang pasca perbaikan", points: ["Uji hover", "Uji manuver", "Dokumentasi"] },
    ],
    prerequisite: { menengah: "Mengenal komponen drone dan pernah merakit atau merawat drone.", lanjut: "Berpengalaman memperbaiki drone atau mengelola bengkel drone." },
    facilities: ["Kit komponen dan peralatan bengkel", "Solder station per peserta", "Modul materi digital", "Sertifikat keikutsertaan"],
    faq: [
      { q: "Apakah drone hasil rakitan boleh dibawa pulang?", a: "Untuk kelas tertentu tersedia paket kit yang bisa dibeli dan dibawa pulang. Informasi ada di halaman jadwal." },
      { q: "Apakah perlu pengalaman elektronika?", a: "Tidak untuk kelas dasar. Kelas menengah ke atas mengasumsikan peserta terbiasa menyolder." },
    ],
    methods: ["OFFLINE", "OFFLINE", "HYBRID"],
    basePrice: 3_600_000,
    titles: [
      ["Mengenal Komponen Drone Multirotor", "dasar"],
      ["Perawatan Rutin dan Penyimpanan Drone", "dasar"],
      ["Kalibrasi Kompas dan IMU", "dasar"],
      ["Pembaruan Firmware dan Pengecekan Sistem", "dasar"],
      ["Mengganti Baling-Baling dan Motor", "dasar"],
      ["Dasar Elektronika untuk Drone", "dasar"],
      ["Merakit Drone Multirotor Pertama", "dasar"],
      ["Troubleshooting Masalah Umum Drone", "dasar"],
      ["Perakitan Drone FPV", "menengah"],
      ["Konfigurasi Flight Controller", "menengah"],
      ["Penyolderan dan Perkabelan Drone", "menengah"],
      ["Tuning PID untuk Penerbangan Stabil", "menengah"],
      ["Perawatan Gimbal dan Kamera Drone", "menengah"],
      ["Perbaikan Drone Pasca Kecelakaan", "menengah"],
      ["Pemilihan Motor, ESC, dan Baterai", "menengah"],
      ["Perawatan Drone Pertanian dan Sistem Semprot", "menengah", "drone-pertanian"],
      ["Merancang Drone untuk Kebutuhan Khusus", "lanjut"],
      ["Integrasi Payload dan Sensor Tambahan", "lanjut"],
      ["Manajemen Bengkel dan Suku Cadang Drone", "lanjut"],
      ["Analisis Kerusakan dan Laporan Teknis", "lanjut"],
      ["Telemetri dan Analisis Log Penerbangan", "lanjut"],
      ["Program Perawatan Armada Drone", "lanjut"],
    ],
  },
  {
    category: { slug: "fotografi", name: "Fotografi", icon: "camera", featured: true, description: "Teknik memotret, pencahayaan, dan editing untuk kebutuhan pribadi, bisnis, dan komersial." },
    context: "Kelas berbasis praktik dengan tugas pemotretan dan sesi kritik karya di setiap pertemuan.",
    audience: [
      { role: "Pemula yang ingin belajar fotografi", note: null },
      { role: "Pelaku UMKM", note: "yang memotret produk sendiri" },
      { role: "Staf humas dan dokumentasi", note: null },
      { role: "Fotografer lepas", note: null },
    ],
    outcomes: [
      "Mengatur eksposur dengan percaya diri",
      "Menyusun komposisi yang kuat",
      "Memanfaatkan cahaya alami dan buatan",
      "Mengedit foto dengan alur kerja yang rapi",
      "Menyiapkan foto untuk cetak dan digital",
      "Menyusun portofolio yang menarik",
    ],
    modules: [
      { title: "Kamera dan eksposur", points: ["Aperture", "Shutter speed", "ISO"] },
      { title: "Komposisi", points: ["Rule of thirds", "Garis dan bentuk", "Ruang negatif"] },
      { title: "Pencahayaan", points: ["Cahaya alami", "Lampu studio", "Reflektor"] },
      { title: "Editing", points: ["Koreksi warna", "Retouching", "Ekspor"] },
      { title: "Sesi pemotretan", points: ["Brief", "Praktik", "Kritik karya"] },
      { title: "Portofolio dan klien", points: ["Kurasi", "Penyajian", "Harga jasa"] },
    ],
    prerequisite: { menengah: "Memahami segitiga eksposur dan terbiasa memakai mode manual.", lanjut: "Memiliki portofolio atau berpengalaman sebagai fotografer." },
    facilities: null,
    faq: CREATIVE_FAQ,
    methods: ["OFFLINE", "HYBRID", "ONLINE"],
    basePrice: 2_500_000,
    titles: [
      ["Dasar Fotografi dengan Kamera Digital", "dasar"],
      ["Memahami Segitiga Eksposur", "dasar"],
      ["Komposisi Foto untuk Pemula", "dasar"],
      ["Fotografi dengan Smartphone", "dasar", "konten-digital-media-sosial"],
      ["Fotografi Produk Sederhana untuk UMKM", "dasar"],
      ["Dasar Pencahayaan Alami", "dasar"],
      ["Fotografi Potret Dasar", "dasar"],
      ["Mengelola dan Mengarsipkan Foto", "dasar"],
      ["Fotografi Produk Profesional dengan Lampu Studio", "menengah"],
      ["Fotografi Makanan", "menengah"],
      ["Fotografi Acara dan Dokumentasi Perusahaan", "menengah"],
      ["Lighting Studio untuk Potret", "menengah"],
      ["Editing Foto dengan Lightroom", "menengah"],
      ["Fotografi Arsitektur dan Interior", "menengah"],
      ["Fotografi Jurnalistik", "menengah"],
      ["Retouching Foto dengan Photoshop", "menengah", "desain-grafis"],
      ["Fotografi Komersial untuk Brand", "lanjut"],
      ["Manajemen Bisnis Fotografi", "lanjut"],
      ["Fotografi Fashion dan Katalog", "lanjut"],
      ["Fine Art dan Penyusunan Portofolio", "lanjut"],
      ["Color Management dari Kamera sampai Cetak", "lanjut"],
      ["Fotografi Korporat untuk Laporan Tahunan", "lanjut"],
    ],
  },
  {
    category: { slug: "videografi-sinematografi", name: "Videografi & Sinematografi", icon: "video", featured: false, description: "Produksi video dari perencanaan, pengambilan gambar, audio, sampai pascaproduksi." },
    context: "Peserta bekerja dalam kelompok kecil dan menyelesaikan satu karya video di akhir kelas.",
    audience: [
      { role: "Videografer pemula", note: null },
      { role: "Tim humas dan media internal", note: null },
      { role: "Kreator konten", note: null },
      { role: "Editor video", note: null },
    ],
    outcomes: [
      "Merencanakan produksi dengan naskah dan shot list",
      "Mengambil gambar dengan bahasa visual yang tepat",
      "Merekam audio yang jernih",
      "Mengedit video dengan alur yang enak ditonton",
      "Melakukan color grading dasar sampai lanjut",
      "Mengelola produksi dan tim di lapangan",
    ],
    modules: [
      { title: "Praproduksi", points: ["Ide dan naskah", "Shot list", "Jadwal produksi"] },
      { title: "Kamera dan lensa", points: ["Frame rate", "Shot size", "Pergerakan kamera"] },
      { title: "Audio", points: ["Mikrofon", "Level suara", "Ruang rekam"] },
      { title: "Pencahayaan", points: ["Three-point lighting", "Cahaya praktis", "Mood"] },
      { title: "Editing", points: ["Struktur cerita", "Ritme", "Grafis dan teks"] },
      { title: "Color grading dan ekspor", points: ["Koreksi warna", "Look", "Format distribusi"] },
    ],
    prerequisite: { menengah: "Terbiasa merekam dan mengedit video sederhana.", lanjut: "Pernah memproduksi video untuk klien atau institusi." },
    facilities: null,
    faq: CREATIVE_FAQ,
    methods: ["OFFLINE", "HYBRID", "ONLINE"],
    basePrice: 2_900_000,
    titles: [
      ["Dasar Videografi untuk Pemula", "dasar"],
      ["Mengenal Kamera dan Lensa Video", "dasar"],
      ["Shot Size dan Dasar Pengambilan Gambar", "dasar"],
      ["Merekam Audio yang Jernih untuk Video", "dasar"],
      ["Produksi Video dengan Smartphone", "dasar"],
      ["Dasar Editing Video", "dasar"],
      ["Pencahayaan Dasar untuk Video", "dasar"],
      ["Membuat Video Profil Perusahaan Sederhana", "dasar"],
      ["Sinematografi: Bahasa Visual dan Pergerakan Kamera", "menengah"],
      ["Editing Video dengan Premiere Pro", "menengah"],
      ["Color Grading dengan DaVinci Resolve", "menengah"],
      ["Produksi Video Wawancara", "menengah"],
      ["Membuat Video Dokumenter Pendek", "menengah"],
      ["Penulisan Naskah Video", "menengah"],
      ["Multi-Kamera untuk Liputan Acara", "menengah"],
      ["Produksi Video Pembelajaran", "menengah"],
      ["Penyutradaraan Video Komersial", "lanjut"],
      ["Produksi Film Pendek", "lanjut"],
      ["Live Streaming Multi-Kamera", "lanjut"],
      ["Manajemen Produksi Video", "lanjut"],
      ["Sinematografi Lanjut: Lighting dan Mood", "lanjut"],
      ["Pascaproduksi Lengkap dari Edit sampai Mastering", "lanjut"],
    ],
  },
  {
    category: { slug: "desain-grafis", name: "Desain Grafis", icon: "palette", featured: false, description: "Tipografi, warna, layout, identitas visual, dan desain untuk cetak maupun digital." },
    context: "Setiap materi diikuti latihan desain dengan brief yang mirip pekerjaan nyata.",
    audience: [
      { role: "Pemula di bidang desain", note: null },
      { role: "Staf pemasaran dan humas", note: null },
      { role: "Pelaku UMKM", note: null },
      { role: "Desainer junior", note: null },
    ],
    outcomes: [
      "Menerapkan prinsip tipografi dan warna",
      "Menyusun layout yang rapi dan mudah dibaca",
      "Membuat identitas visual yang konsisten",
      "Menggunakan perangkat lunak desain dengan efisien",
      "Menyiapkan file untuk cetak dan digital",
      "Mempresentasikan desain kepada klien",
    ],
    modules: [
      { title: "Prinsip desain", points: ["Hierarki", "Kontras", "Keseimbangan"] },
      { title: "Tipografi", points: ["Pemilihan huruf", "Pasangan huruf", "Keterbacaan"] },
      { title: "Warna", points: ["Teori warna", "Palet merek", "Aksesibilitas"] },
      { title: "Layout", points: ["Grid", "Ruang kosong", "Alur baca"] },
      { title: "Produksi file", points: ["Format cetak", "Format digital", "Pengelolaan aset"] },
      { title: "Presentasi dan revisi", points: ["Brief", "Presentasi konsep", "Mengelola revisi"] },
    ],
    prerequisite: { menengah: "Terbiasa memakai salah satu perangkat lunak desain.", lanjut: "Berpengalaman mengerjakan proyek desain untuk klien atau institusi." },
    facilities: null,
    faq: CREATIVE_FAQ,
    methods: ["ONLINE", "HYBRID", "OFFLINE"],
    basePrice: 2_400_000,
    titles: [
      ["Dasar Desain Grafis untuk Pemula", "dasar"],
      ["Prinsip Tipografi", "dasar"],
      ["Teori Warna dalam Desain", "dasar"],
      ["Desain dengan Canva untuk Kebutuhan Kantor", "dasar"],
      ["Pengenalan Adobe Illustrator", "dasar"],
      ["Pengenalan Adobe Photoshop untuk Desain", "dasar"],
      ["Desain Konten Media Sosial", "dasar", "konten-digital-media-sosial"],
      ["Layout Dasar untuk Materi Cetak", "dasar"],
      ["Desain Logo dan Identitas Visual", "menengah"],
      ["Desain Kemasan Produk", "menengah"],
      ["Desain Infografis", "menengah"],
      ["Layout Majalah dan Laporan dengan InDesign", "menengah"],
      ["Desain Presentasi yang Menarik", "menengah"],
      ["Ilustrasi Digital", "menengah"],
      ["Desain Antarmuka Aplikasi untuk Pemula", "menengah"],
      ["Penyusunan Brand Guideline", "menengah"],
      ["Strategi Branding Visual", "lanjut"],
      ["Desain Kampanye Iklan Terpadu", "lanjut"],
      ["Manajemen Proyek Desain dan Klien", "lanjut"],
      ["Desain Laporan Tahunan Perusahaan", "lanjut"],
      ["Art Direction untuk Tim Kreatif", "lanjut"],
      ["Menyusun Portofolio Desain Profesional", "lanjut"],
    ],
  },
  {
    category: { slug: "animasi-motion-graphic", name: "Animasi & Motion Graphic", icon: "zap", featured: false, description: "Animasi 2D dan 3D, motion graphic, dan efek visual untuk video dan media digital." },
    context: "Peserta membangun satu proyek animasi bertahap dari storyboard sampai render akhir.",
    audience: [
      { role: "Desainer grafis", note: "yang ingin membuat desain bergerak" },
      { role: "Editor video", note: null },
      { role: "Kreator konten", note: null },
      { role: "Animator pemula", note: null },
    ],
    outcomes: [
      "Menerapkan prinsip dasar animasi",
      "Menyusun storyboard dan animatic",
      "Membuat motion graphic yang halus",
      "Menganimasikan karakter dan objek",
      "Memadukan audio dengan animasi",
      "Merender hasil untuk berbagai platform",
    ],
    modules: [
      { title: "Prinsip animasi", points: ["Timing", "Easing", "Squash and stretch"] },
      { title: "Storyboard", points: ["Naskah", "Sketsa adegan", "Animatic"] },
      { title: "Motion graphic", points: ["Keyframe", "Tipografi kinetik", "Transisi"] },
      { title: "Animasi karakter", points: ["Rig sederhana", "Siklus jalan", "Ekspresi"] },
      { title: "Audio dan efek", points: ["Sound design", "Efek visual", "Compositing"] },
      { title: "Render dan distribusi", points: ["Pengaturan render", "Format", "Optimasi ukuran"] },
    ],
    prerequisite: { menengah: "Terbiasa memakai perangkat lunak desain atau editing video.", lanjut: "Memiliki portofolio animasi atau motion graphic." },
    facilities: null,
    faq: CREATIVE_FAQ,
    methods: ["ONLINE", "HYBRID", "OFFLINE"],
    basePrice: 2_800_000,
    titles: [
      ["Dasar Animasi 2D", "dasar"],
      ["Prinsip Dasar Animasi", "dasar"],
      ["Pengenalan Adobe After Effects", "dasar"],
      ["Animasi Teks dan Tipografi Kinetik", "dasar"],
      ["Animasi Pendek dan GIF untuk Media Sosial", "dasar"],
      ["Storyboard untuk Animasi", "dasar"],
      ["Animasi Cepat dengan Aplikasi Online", "dasar"],
      ["Animasi Logo Sederhana", "dasar", "desain-grafis"],
      ["Motion Graphic untuk Video Penjelasan", "menengah"],
      ["Animasi Karakter 2D", "menengah"],
      ["Animasi Infografis", "menengah", "desain-grafis"],
      ["Dasar Animasi 3D dengan Blender", "menengah"],
      ["Visual Effects Dasar", "menengah"],
      ["Lower Third dan Grafis Siaran", "menengah"],
      ["Animasi Antarmuka Aplikasi", "menengah"],
      ["Sound Design untuk Animasi", "menengah"],
      ["Produksi Video Animasi Explainer Lengkap", "lanjut"],
      ["Animasi 3D Produk", "lanjut"],
      ["Compositing dan VFX Lanjut", "lanjut"],
      ["Pipeline Produksi Animasi untuk Studio", "lanjut"],
      ["Motion Graphic untuk Iklan TV dan Digital", "lanjut"],
      ["Rigging Karakter 3D", "lanjut"],
    ],
  },
  {
    category: { slug: "konten-digital-media-sosial", name: "Konten Digital & Media Sosial", icon: "megaphone", featured: false, description: "Perencanaan, produksi, dan analisis konten untuk media sosial dan kanal digital." },
    context: "Peserta menyusun rencana konten nyata untuk akun bisnis atau instansinya sendiri.",
    audience: [
      { role: "Admin media sosial", note: null },
      { role: "Staf pemasaran dan humas", note: null },
      { role: "Pelaku UMKM", note: null },
      { role: "Kreator konten", note: null },
    ],
    outcomes: [
      "Menyusun strategi dan kalender konten",
      "Menulis caption dan naskah yang menarik",
      "Memproduksi foto dan video pendek",
      "Membaca data performa konten",
      "Mengelola komunitas dan komentar",
      "Merancang kampanye berbayar sederhana",
    ],
    modules: [
      { title: "Strategi konten", points: ["Tujuan dan audiens", "Pilar konten", "Kalender"] },
      { title: "Copywriting", points: ["Hook", "Caption", "Ajakan bertindak"] },
      { title: "Produksi konten", points: ["Foto", "Video pendek", "Desain sederhana"] },
      { title: "Analitik", points: ["Metrik penting", "Laporan bulanan", "Eksperimen"] },
      { title: "Komunitas dan reputasi", points: ["Membalas komentar", "Kolaborasi", "Krisis kecil"] },
      { title: "Iklan berbayar", points: ["Target audiens", "Anggaran", "Optimasi"] },
    ],
    prerequisite: { menengah: "Mengelola minimal satu akun media sosial bisnis atau instansi.", lanjut: "Bertanggung jawab atas strategi media sosial organisasi." },
    facilities: null,
    faq: [
      CREATIVE_FAQ[0],
      { q: "Apakah materi berlaku untuk semua platform?", a: "Prinsipnya berlaku umum; contoh praktik memakai platform yang paling banyak dipakai peserta." },
    ],
    methods: ["ONLINE", "ONLINE", "HYBRID"],
    basePrice: 2_200_000,
    titles: [
      ["Dasar Pembuatan Konten Media Sosial", "dasar"],
      ["Menulis Caption yang Menarik", "dasar"],
      ["Perencanaan Kalender Konten", "dasar"],
      ["Membuat Video Pendek untuk Reels dan TikTok", "dasar", "videografi-sinematografi"],
      ["Foto Produk untuk Media Sosial", "dasar", "fotografi"],
      ["Dasar Copywriting Digital", "dasar"],
      ["Membangun Personal Branding di Media Sosial", "dasar"],
      ["Etika dan Hak Cipta Konten Digital", "dasar"],
      ["Strategi Konten untuk Bisnis", "menengah"],
      ["Analisis Performa Media Sosial", "menengah"],
      ["Iklan Berbayar di Media Sosial", "menengah"],
      ["Storytelling untuk Konten Brand", "menengah"],
      ["Manajemen Komunitas Online", "menengah"],
      ["Produksi Podcast", "menengah"],
      ["Content Marketing untuk Website", "menengah"],
      ["Kolaborasi dengan Kreator dan Influencer", "menengah"],
      ["Strategi Media Sosial Perusahaan", "lanjut"],
      ["Manajemen Krisis di Media Sosial", "lanjut"],
      ["Social Media Analytics Lanjut", "lanjut"],
      ["Membangun Tim Konten Internal", "lanjut"],
      ["Konten Edukasi untuk Lembaga", "lanjut"],
      ["Monetisasi Konten Digital", "lanjut"],
    ],
  },
  {
    category: { slug: "akuntansi", name: "Akuntansi", icon: "calculator", featured: false, description: "Siklus akuntansi, laporan keuangan, dan pengendalian untuk perusahaan dan UMKM." },
    context: "Latihan memakai studi kasus transaksi dan template spreadsheet yang bisa dipakai ulang.",
    audience: [
      { role: "Staf akuntansi dan keuangan", note: null },
      { role: "Pemilik dan pengelola UMKM", note: null },
      { role: "Staf administrasi", note: "yang menangani pembukuan" },
      { role: "Supervisor keuangan", note: null },
    ],
    outcomes: [
      "Mencatat transaksi sesuai siklus akuntansi",
      "Menyusun laporan keuangan yang rapi",
      "Melakukan rekonsiliasi dan closing bulanan",
      "Menerapkan standar akuntansi yang relevan",
      "Menganalisis laporan keuangan untuk keputusan",
      "Menyiapkan dokumen untuk audit",
    ],
    modules: [
      { title: "Siklus akuntansi", points: ["Jurnal", "Buku besar", "Neraca saldo"] },
      { title: "Laporan keuangan", points: ["Laba rugi", "Posisi keuangan", "Arus kas"] },
      { title: "Akun-akun penting", points: ["Kas dan bank", "Piutang dan utang", "Persediaan dan aset tetap"] },
      { title: "Closing dan rekonsiliasi", points: ["Jurnal penyesuaian", "Rekonsiliasi bank", "Checklist closing"] },
      { title: "Analisis", points: ["Rasio", "Tren", "Catatan untuk manajemen"] },
      { title: "Pengendalian dan audit", points: ["Pemisahan tugas", "Dokumen pendukung", "Persiapan audit"] },
    ],
    prerequisite: { menengah: "Memahami jurnal dan siklus akuntansi dasar.", lanjut: "Berpengalaman menyusun laporan keuangan perusahaan." },
    facilities: null,
    faq: FINANCE_FAQ,
    methods: ["ONLINE", "HYBRID", "OFFLINE"],
    basePrice: 2_600_000,
    titles: [
      ["Dasar Akuntansi untuk Non-Akuntan", "dasar"],
      ["Siklus Akuntansi dan Jurnal", "dasar"],
      ["Akuntansi untuk UMKM", "dasar"],
      ["Penyusunan Laporan Keuangan Sederhana", "dasar"],
      ["Rekonsiliasi Bank", "dasar"],
      ["Akuntansi Kas Kecil", "dasar"],
      ["Pengenalan Software Akuntansi", "dasar"],
      ["Membaca Laporan Keuangan", "dasar", "manajemen-keuangan"],
      ["Akuntansi Aset Tetap dan Penyusutan", "menengah"],
      ["Akuntansi Persediaan", "menengah"],
      ["Akuntansi Biaya", "menengah"],
      ["Penyusunan Laporan Arus Kas", "menengah"],
      ["Akuntansi Piutang dan Utang", "menengah"],
      ["Closing Bulanan yang Rapi dan Tepat Waktu", "menengah"],
      ["Akuntansi Koperasi", "menengah"],
      ["Akuntansi Proyek", "menengah"],
      ["Konsolidasi Laporan Keuangan", "lanjut"],
      ["Penerapan Standar Akuntansi Terkini", "lanjut"],
      ["Akuntansi Manajemen untuk Pengambilan Keputusan", "lanjut", "manajemen-keuangan"],
      ["Analisis Laporan Keuangan Lanjut", "lanjut"],
      ["Pengendalian Internal Fungsi Akuntansi", "lanjut"],
      ["Persiapan Audit Laporan Keuangan", "lanjut"],
    ],
  },
  {
    category: { slug: "perpajakan", name: "Perpajakan", icon: "file-text", featured: false, description: "Kewajiban pajak pribadi dan badan, pelaporan, serta perencanaan dan pemeriksaan pajak." },
    context: "Setiap topik dibahas dengan contoh perhitungan dan latihan pengisian formulir.",
    audience: [
      { role: "Staf pajak dan keuangan", note: null },
      { role: "Staf HR", note: "yang mengurus PPh karyawan" },
      { role: "Pemilik usaha", note: null },
      { role: "Konsultan pajak junior", note: null },
    ],
    outcomes: [
      "Menghitung dan melaporkan pajak dengan benar",
      "Memahami jenis pajak yang relevan dengan usaha",
      "Menyiapkan dokumen pendukung pelaporan",
      "Melakukan rekonsiliasi fiskal",
      "Mengelola risiko dan pemeriksaan pajak",
      "Menyusun perencanaan pajak yang patuh",
    ],
    modules: [
      { title: "Dasar perpajakan", points: ["Subjek dan objek pajak", "NPWP", "Hak dan kewajiban"] },
      { title: "Pajak penghasilan", points: ["PPh 21", "PPh 23 dan 4 ayat 2", "PPh badan"] },
      { title: "PPN", points: ["Faktur pajak", "Pajak masukan dan keluaran", "Pelaporan"] },
      { title: "Pelaporan", points: ["SPT masa", "SPT tahunan", "Aplikasi pelaporan"] },
      { title: "Rekonsiliasi dan review", points: ["Koreksi fiskal", "Review kepatuhan", "Dokumentasi"] },
      { title: "Pemeriksaan dan sengketa", points: ["Persiapan pemeriksaan", "Keberatan", "Banding"] },
    ],
    prerequisite: { menengah: "Memahami dasar PPh dan PPN.", lanjut: "Berpengalaman menangani pajak perusahaan." },
    facilities: null,
    faq: FINANCE_FAQ,
    methods: ["ONLINE", "HYBRID", "OFFLINE"],
    basePrice: 2_700_000,
    titles: [
      ["Dasar Perpajakan untuk Karyawan", "dasar"],
      ["PPh Pasal 21", "dasar"],
      ["Pengenalan PPN", "dasar"],
      ["Pelaporan SPT Tahunan Pribadi", "dasar"],
      ["Pajak untuk UMKM", "dasar"],
      ["Bukti Potong dan Faktur Pajak Elektronik", "dasar"],
      ["Mengenal NPWP dan Kewajiban Wajib Pajak", "dasar"],
      ["Pajak Penghasilan Final", "dasar"],
      ["PPh Badan dan SPT Tahunan Badan", "menengah"],
      ["Rekonsiliasi Fiskal", "menengah", "akuntansi"],
      ["PPh Pasal 23 dan Pasal 4 Ayat 2", "menengah"],
      ["PPN Lanjutan dan Pengkreditan Pajak Masukan", "menengah"],
      ["Pemotongan dan Pemungutan Pajak", "menengah"],
      ["Akuntansi Pajak", "menengah", "akuntansi"],
      ["Pajak atas Transaksi Konstruksi", "menengah"],
      ["Pajak Daerah dan Retribusi", "menengah"],
      ["Perencanaan Pajak", "lanjut"],
      ["Pemeriksaan dan Keberatan Pajak", "lanjut"],
      ["Transfer Pricing", "lanjut"],
      ["Perpajakan Internasional", "lanjut"],
      ["Tax Review untuk Perusahaan", "lanjut"],
      ["Manajemen Risiko Pajak", "lanjut"],
    ],
  },
  {
    category: { slug: "manajemen-keuangan", name: "Manajemen Keuangan", icon: "coins", featured: false, description: "Anggaran, arus kas, investasi, dan analisis keuangan untuk pengambilan keputusan." },
    context: "Peserta berlatih dengan model spreadsheet yang dibangun bersama selama kelas.",
    audience: [
      { role: "Manajer dan kepala unit", note: null },
      { role: "Staf keuangan dan perencanaan", note: null },
      { role: "Pemilik usaha", note: null },
      { role: "Analis keuangan", note: null },
    ],
    outcomes: [
      "Menyusun anggaran yang realistis",
      "Memproyeksikan arus kas",
      "Menilai kelayakan investasi",
      "Menganalisis profitabilitas produk dan unit",
      "Mengendalikan anggaran dengan analisis varians",
      "Menyajikan analisis keuangan untuk pimpinan",
    ],
    modules: [
      { title: "Dasar manajemen keuangan", points: ["Tujuan keuangan", "Laporan inti", "Nilai waktu uang"] },
      { title: "Penganggaran", points: ["Asumsi", "Anggaran operasional", "Anggaran modal"] },
      { title: "Arus kas", points: ["Proyeksi", "Modal kerja", "Skenario"] },
      { title: "Investasi", points: ["NPV dan IRR", "Payback", "Analisis sensitivitas"] },
      { title: "Analisis kinerja", points: ["Rasio", "Profitabilitas", "Varians"] },
      { title: "Presentasi ke pimpinan", points: ["Dashboard", "Narasi angka", "Rekomendasi"] },
    ],
    prerequisite: { menengah: "Memahami laporan laba rugi, neraca, dan arus kas.", lanjut: "Berpengalaman menyusun anggaran atau analisis keuangan perusahaan." },
    facilities: null,
    faq: FINANCE_FAQ,
    methods: ["ONLINE", "HYBRID", "OFFLINE"],
    basePrice: 3_000_000,
    titles: [
      ["Dasar Manajemen Keuangan", "dasar"],
      ["Keuangan untuk Non-Keuangan", "dasar"],
      ["Penyusunan Anggaran Unit Kerja", "dasar"],
      ["Manajemen Kas Harian", "dasar"],
      ["Perencanaan Keuangan Pribadi", "dasar"],
      ["Dasar Analisis Rasio Keuangan", "dasar", "akuntansi"],
      ["Pengelolaan Keuangan UMKM", "dasar"],
      ["Pengelolaan Keuangan Proyek Kreatif", "dasar"],
      ["Penganggaran Perusahaan", "menengah"],
      ["Cash Flow Forecasting", "menengah"],
      ["Analisis Kelayakan Investasi", "menengah"],
      ["Manajemen Modal Kerja", "menengah"],
      ["Analisis Biaya dan Profitabilitas", "menengah"],
      ["Manajemen Treasuri", "menengah"],
      ["Pengendalian Anggaran dan Analisis Varians", "menengah"],
      ["Pembiayaan Usaha dan Kredit", "menengah"],
      ["Financial Modeling dengan Excel", "lanjut"],
      ["Valuasi Perusahaan", "lanjut"],
      ["Manajemen Risiko Keuangan", "lanjut"],
      ["Strategi Keuangan Korporat", "lanjut"],
      ["Merger dan Akuisisi", "lanjut"],
      ["Financial Planning and Analysis", "lanjut"],
    ],
  },
];

export const categories: SeedCategory[] = profiles.map((profile) => profile.category);

// ===== Perakit pelatihan =====

const LEVEL_LABEL: Record<Level, string> = { dasar: "Dasar", menengah: "Menengah", lanjut: "Lanjut" };
const DURATIONS: Record<Level, string[]> = { dasar: ["1 hari", "2 hari"], menengah: ["2 hari", "3 hari"], lanjut: ["3 hari", "4 hari", "5 hari"] };
const PRICE_FACTOR: Record<Level, number> = { dasar: 0.8, menengah: 1, lanjut: 1.35 };
const TYPES: TrainingType[][] = [["PUBLIC", "IN_HOUSE"], ["PUBLIC"], ["PUBLIC", "IN_HOUSE"], ["PUBLIC", "IN_HOUSE"], ["PUBLIC"]];

const SUMMARY: Record<Level, ((topic: string) => string)[]> = {
  dasar: [
    (topic) => `Kelas pengantar ${topic} untuk peserta yang baru memulai, lengkap dengan latihan terpandu.`,
    (topic) => `Bekal awal ${topic}: konsep penting, istilah, dan praktik langsung bersama instruktur.`,
    (topic) => `Mulai dari nol dan pahami ${topic} dengan contoh yang dekat dengan pekerjaan sehari-hari.`,
  ],
  menengah: [
    (topic) => `Perdalam ${topic} untuk kebutuhan kerja yang lebih menuntut, dengan studi kasus nyata.`,
    (topic) => `Naik satu tingkat dalam ${topic}: teknik yang lebih rapi, cepat, dan bisa diulang.`,
    (topic) => `Latihan intensif ${topic} bagi peserta yang sudah menguasai dasarnya.`,
  ],
  lanjut: [
    (topic) => `Kuasai ${topic} pada skala proyek, dengan standar kerja profesional.`,
    (topic) => `Program lanjutan ${topic} untuk praktisi yang memimpin pekerjaan atau tim.`,
    (topic) => `Pendalaman ${topic} dari sisi teknis dan manajerial, ditutup dengan proyek akhir.`,
  ],
};

const LEVEL_PARAGRAPH: Record<Level, string> = {
  dasar: "Materi disampaikan bertahap dan tidak mengasumsikan pengalaman sebelumnya. Di akhir kelas peserta mampu menjalankan langkah dasar secara mandiri.",
  menengah: "Peserta diharapkan sudah memahami dasar-dasarnya. Fokus kelas adalah memperbaiki kualitas hasil kerja dan mempercepat alur kerja.",
  lanjut: "Kelas dirancang untuk praktisi berpengalaman. Diskusi banyak membahas pengambilan keputusan, standar mutu, dan pengelolaan pekerjaan berskala besar.",
};

// Kata pertama judul ditulis kecil di tengah kalimat, kecuali singkatan atau nama produk.
const KEEP_CASE = /^(?:[A-Z0-9]{2,}|PPh|PPN|SPT|Adobe|Canva|Blender|DaVinci|Lightroom|Photoshop|Premiere|InDesign|Excel|FPV|NDVI|LiDAR)/;
function topicOf(title: string): string {
  return KEEP_CASE.test(title) ? title : title.charAt(0).toLowerCase() + title.slice(1);
}

function rotate<T>(items: readonly T[], start: number, count: number): T[] {
  return Array.from({ length: count }, (_, index) => items[(start + index) % items.length]);
}

function formatRupiah(value: number): string {
  return `Rp${value.toLocaleString("id-ID")}`;
}

function uniqueSlug(title: string, used: Set<string>): string {
  const base = slugify(title);
  let slug = base;
  for (let suffix = 2; used.has(slug); suffix += 1) slug = `${base}-${suffix}`;
  used.add(slug);
  return slug;
}

function buildTrainings(): SeedTraining[] {
  const used = new Set<string>();
  const list: SeedTraining[] = [];
  for (const profile of profiles) {
    profile.titles.forEach(([title, level, secondCategory], index) => {
      const topic = topicOf(title);
      const moduleCount = level === "dasar" ? 3 : 4;
      const minutes = level === "dasar" ? 120 : level === "menengah" ? 150 : 180;
      const price = Math.round((profile.basePrice * PRICE_FACTOR[level] * (1 + (index % 4) * 0.05)) / 50_000) * 50_000;
      list.push({
        slug: uniqueSlug(title, used),
        title,
        summary: SUMMARY[level][index % 3](topic),
        description: paragraphs(
          `Pelatihan ${topic} ini membahas konsep dan praktik yang paling sering dibutuhkan di lapangan. ${profile.context}`,
          `Tingkat ${LEVEL_LABEL[level].toLowerCase()}. ${LEVEL_PARAGRAPH[level]}`,
        ),
        outcomes: [`Memahami prinsip utama ${topic}`, ...rotate(profile.outcomes, index, 3)],
        modules: rotate(profile.modules, index, moduleCount).map((module) => ({ ...module, durationMinutes: minutes })),
        audience: rotate(profile.audience, index, index % 2 === 0 ? 2 : 3),
        prerequisites: level === "dasar" ? null : profile.prerequisite[level],
        facilities: profile.facilities,
        faq: profile.faq,
        duration: DURATIONS[level][index % DURATIONS[level].length],
        method: profile.methods[index % profile.methods.length],
        types: TYPES[index % TYPES.length],
        priceText: `${formatRupiah(price)} per peserta`,
        showPrice: index % 6 !== 5,
        level,
        categorySlugs: secondCategory ? [profile.category.slug, secondCategory] : [profile.category.slug],
      });
    });
  }
  return list;
}

export const trainings: SeedTraining[] = buildTrainings();

// Harga dasar per pelatihan (angka untuk jadwal), dari priceText.
function priceOf(training: SeedTraining): number {
  return Number(training.priceText.replace(/[^\d]/g, ""));
}

// ===== Jadwal: 2-3 sesi per pelatihan dalam 6 bulan sejak `today` (YYYY-MM-DD, WIB) =====

const CITIES: [string, string][] = [
  ["Jakarta", "Ruang pelatihan, Jakarta Selatan"],
  ["Bandung", "Hotel mitra, Bandung"],
  ["Surabaya", "Ruang pelatihan, Surabaya"],
  ["Yogyakarta", "Hotel mitra, Yogyakarta"],
  ["Semarang", "Ruang pelatihan, Semarang"],
  ["Medan", "Hotel mitra, Medan"],
  ["Makassar", "Ruang pelatihan, Makassar"],
  ["Denpasar", "Hotel mitra, Denpasar"],
  ["Balikpapan", "Ruang pelatihan, Balikpapan"],
  ["Palembang", "Hotel mitra, Palembang"],
];
const ONLINE_VENUES = ["Zoom", "Google Meet"];

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function buildSchedules(today: string): SeedSchedule[] {
  const schedules: SeedSchedule[] = [];
  trainings.forEach((training, index) => {
    const sessions = 2 + (index % 2);
    const days = Number.parseInt(training.duration, 10) || 1;
    for (let session = 0; session < sessions; session += 1) {
      // Sesi tersebar di hari ke-7 sampai ke-180, berbeda per pelatihan.
      const offset = 7 + ((index * 37 + session * 59) % 58) + session * 58;
      const startDate = addDays(today, Math.min(offset, 180));
      const method: Method =
        training.method === "HYBRID" ? (["OFFLINE", "ONLINE", "HYBRID"] as const)[session % 3] : training.method;
      const [city, venue] = CITIES[(index + session * 3) % CITIES.length];
      const base = priceOf(training);
      schedules.push({
        trainingSlug: training.slug,
        startDate,
        endDate: addDays(startDate, days - 1),
        city: method === "ONLINE" ? null : city,
        venue: method === "ONLINE" ? ONLINE_VENUES[index % ONLINE_VENUES.length] : venue,
        method,
        price: method === "ONLINE" ? Math.round((base * 0.9) / 50_000) * 50_000 : base,
        status: (index + session) % 4 === 3 ? "FULL" : "OPEN",
      });
    }
  });
  return schedules;
}

// Urutan terbit: berselang antarkategori supaya "Training terupdate" berisi campuran kategori.
export function publishOrder(): string[] {
  const byCategory = profiles.map((profile) => trainings.filter((training) => training.categorySlugs[0] === profile.category.slug));
  const order: string[] = [];
  const rounds = Math.max(...byCategory.map((items) => items.length));
  for (let round = 0; round < rounds; round += 1) {
    for (const items of byCategory) if (items[round]) order.push(items[round].slug);
  }
  return order;
}
