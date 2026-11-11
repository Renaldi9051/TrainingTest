// Mengisi kategori sampai 10 pelatihan (permintaan pemilik, 21 Okt 2026), sekali per versi. Sumbernya
// judul web referensi yang sudah ada di database tapi dipindah ke Sampah oleh batas 10 pelatihan per
// kategori versi lama: dipulihkan lewat service admin (slug, redirect, audit) lalu diberi SATU kategori,
// yaitu kategori yang diisi. Uraian pelatihan tetap naskah seed sendiri (tidak menyalin isi situs lain).
// - Kandidat: artikel snapshot yang ditandai kategori itu, judul belum dipakai pelatihan aktif, belum
//   pernah diubah admin; urut terbaru. Kategori dengan kandidat paling sedikit diisi lebih dulu.
// - Kategori yang kandidatnya kurang tetap di bawah 10 (pemilik: tidak mengarang judul).
// - Versi 2: kategori yang judul bertandanya habis diisi dari judul referensi lain yang topiknya sama
//   (CATEGORY_FILL_TOPIC_PICKS, dipilih manual dari judul di Sampah; tanpa judul kembar).
// - Versi 3: database yang dipasang langsung dengan katalog terbatas (production) tidak punya judul itu
//   di Sampah. Judul snapshot yang belum pernah ada di database dibuat baru (naskah seed sama seperti
//   seed referensi); yang di Sampah tapi pernah diubah admin tetap tidak disentuh. Judul yang sudah
//   punya foto di training-photos.json didahulukan supaya hasilnya sama dengan dev.
// - Versi 4 (pemilik, 5 Nov 2026): semua kategori publik yang masih di bawah 10, kecuali CATEGORY_FILL_SKIP
//   (uji/typo/duplikat/terlalu umum, dirapikan dulu lewat admin). Judul topik dipilih manual dari Sampah:
//   snapshot referensi di CATEGORY_FILL_TOPIC_PICKS, judul seed sendiri di CATEGORY_FILL_TRASH_PICKS (hanya
//   dipulihkan). Tetap tidak mengarang judul; kategori yang kandidatnya kurang tetap di bawah 10.
// Versi pertama: kategori berawalan A dan B yang tampil di publik.
import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { revalidateEntity, withRevalidateBatch } from "../src/lib/revalidate-map";
import { AuditAction, writeAudit } from "../src/services/audit";
import { restoreTraining } from "../src/services/training";
import snapshot from "./seed-data/reference-catalog.json";
import { hasReferenceTitle, plainTitle, type ReferencePost, referenceSnapshotSlugs, referenceTraining } from "./seed-data/reference-training";
import { loadTrainingPhotos } from "./seed-training-photos";

export const CATEGORY_FILL_KEY = "seed.categoryFill.version";
export const CATEGORY_FILL_VERSION = "2026-11-05-semua";
export const CATEGORY_FILL_TARGET = 10;
export const CATEGORY_FILL_SLUGS = [
  "administrative",
  "akuakultur",
  "alignment",
  "analysis",
  "anger",
  "arsitektur",
  "assurance",
  "audit",
  "balanced-scorecard",
  "banking",
  "batu-bara",
  "behavioral",
  "budgeting",
  "building",
  "business",
  "e-commerce",
  "economy",
  "education",
  "emotional-intelligence",
  "energy",
  "environment",
  "estimation",
  "ethic",
  "excel",
  "feasibility",
  "finance",
  "food",
  "fraud",
  "gedung",
  "general-affair",
  "geology",
  "healthy-safety-environtmental",
  "hidrogeologi",
  "housekeeping",
  "human-resource",
  "hutan",
  "import",
  "information-technology",
  "inovasi",
  "insurance",
  "investment",
  "iso",
  "keamanan",
  "kearsipan",
  "kepabeanan",
  "kepatuhan",
  "kesehatan",
  "ketenagakerjaan",
  "kinerja",
  "konsolidasi",
  "laboratorium",
  "law",
  "leadership",
  "maintenance",
  "manufacture",
  "marketing",
  "media",
  "mekatronika",
  "metering",
  "migas",
  "mineral",
  "modeling",
  "motivasional",
  "natural-resources",
  "negosiasi",
  "nuklir",
  "operation-management",
  "pajak",
  "pasar-modal",
  "pembayaran",
  "pembuatan-pakan-ikan",
  "pemerintah",
  "pemetaan",
  "perpustakaan",
  "pertambangan",
  "pertambangan-batubara",
  "perusahaan-pembangkitan-listrik",
  "photography",
  "problem-solving",
  "procurement",
  "production",
  "programming",
  "proyek",
  "public-relation",
  "public-speaking",
  "quality-control",
  "reliability",
  "risk-management",
  "rumah-sakit",
  "sales",
  "scheduling",
  "secretary",
  "sop",
  "spare-part-management",
  "supervisor",
  "supply-chain",
  "survey",
  "switchgear",
  "syariah",
  "teknik-instrumental",
  "teknik-mekanikal",
  "teknik-sipil",
  "transaksi",
  "transportasi",
  "treasury",
  "troubleshooting",
  "water-jet",
  "web",
];
// Versi 4: tidak diisi (pemilik 5 Nov 2026: kategori uji/typo/duplikat/terlalu umum dirapikan dulu lewat admin).
export const CATEGORY_FILL_SKIP = {
  uji: ["slider", "uncategorized"],
  typo: ["generatior", "enginering", "enterpreneur"],
  // Kembaran yang dipertahankan: pembuatan-pakan-ikan, production, investment, pajak, risk-management,
  // pertambangan, pemetaan, migas, healthy-safety-environtmental, environment, motivasional, law,
  // leadership, finance, information-technology, balanced-scorecard, procurement, proyek, human-resource, electrical.
  duplikat: [
    "pelatihan-pembuatan-pakan", "produksi", "investasi", "perpajakan", "tax", "risiko", "mining", "mapping",
    "oil-and-gas", "industri-migas", "k3", "safety", "lingkungan", "motivation", "hukum", "kepemimpinan",
    "keuangan", "sistem-informasi", "informasi", "scorecard", "purchasing", "vendor", "project-management",
    "employee", "teknik-elektro",
  ],
  umum: [
    "effective", "smart", "statement", "opinion", "program", "perusahaan", "pengelolaan", "laporan", "operasi",
    "office", "event", "international", "intelligence", "strategic", "perlindungan", "gold",
  ],
} as const;
// Slug pelatihan referensi (di Sampah) per kategori, urut prioritas; dipakai setelah judul bertanda habis.
export const CATEGORY_FILL_TOPIC_PICKS: Record<string, string[]> = {
  alignment: [
    "training-terminasi-tegangan-menengah-dan-jointing-di-jakarta-terbaru",
    "training-machinery-vibration-analysis-terbaru",
    "training-vibration-and-alignment",
    "training-balancing-and-total-alignment",
    "training-praktik-analisis-vibrasi-terupdate",
    "training-rotating-machine-maintenance",
    "training-rotating-equipment-operation-maintenance-and-troubleshooting",
    "pelatihan-bearing-selection-and-maintenance",
    "pelatihan-machinery-diagnostic-vibration-information-fundamentals-of-rotating-machinery-diagnostics",
    // Cadangan (database lain bisa sudah memakai judul di atas).
    "training-vibration-analysis-di-jakarta",
    "pelatihan-troubleshooting-bearing-failures",
    "training-electrical-mechanical-rotating-equipments-terbaru",
    "training-terminasi-dan-jointing-zoom",
  ],
  anger: [
    "training-emotional-control",
    "pelatihan-conflict-management-training",
    "training-managing-conflict-and-handling-difficult-people",
    "pelatihan-stress-time-management",
    "training-emotional-management-for-improvement-productivity",
    "pelatihan-kepemimpinan-berdasarkan-kecerdasan-emosi",
    "pelatihan-handling-conflict-at-work-place",
    "training-technique-of-emotional-freedom-technique",
    "pelatihan-conflict-collaboration",
    "training-managing-change-conflict",
    "training-emotional-inteligent-leadership",
    "pelatihan-conflict-growth-opportunity",
    "training-teknik-penyelesaian-konflik-dan-perselisihan-hubungan-industrial-di-tempat-kerja",
    "pelatihan-stress-conflict-management-for-secretary",
  ],
  assurance: [
    "pelatihan-quality-assurance-for-internal-audit-department",
    "training-project-quality-management",
    "pelatihan-best-practice-quality-assurance",
    "pelatihan-managing-quality-assurance-business-excellence",
    "training-leadership-for-quality-management",
    "pelatihan-fundamentals-total-quality-management",
  ],
  "balanced-scorecard": [
    "training-pengukuran-kinerja-perusahaan-berbasis-balanced-scorecard-di-jakarta",
    "training-performance-management",
    "teknik-penyusunan-casecading-kpi",
    "training-strategic-balanced-scorecard-penyusunan-kpi-bpr",
    "training-penilaian-kinerja-berbasis-balanced-scorecard-bsc",
    "training-metode-pengukuran-kinerja-dengan-key-performance-indicators-kpi",
    "pelatihan-employee-performance-management-di-jakarta",
    "training-performance-management-appraisal",
    "pelatihan-menyusun-rencana-stratejik-perusahaan-berbasis-balanced-scorecard-gratis",
    "training-performance-management-for-manager-from-performance-plan-to-appraisal",
  ],
  behavioral: [
    "training-office-communication-and-behavior-ethic",
    "training-behavior-based-safety-bbs",
    "training-effective-skill-for-organization-behavior",
    "training-effective-solutions-for-unacceptable-employee-behavior",
    "training-conflict-management-human-behaviour-in-organization",
    "training-technique-interview-for-recruitment-bei-interview",
    "training-wawancara-kerja-efektif-untuk-rekrutmen-staf-atau-jalur-karir",
    "pelatihan-understanding-customer-behaviour",
    "training-analisa-pendeteksian-fraud-dengan-human-behavior-dan-nlp-terbaru",
    "training-teknik-interview-dalam-proses-rekrutmen",
    "pelatihan-faktor-faktor-yang-mempengaruhi-perilaku-konsumen",
    "pelatihan-effective-job-interview",
    "training-recruitment-interview-and-selection",
  ],
  budgeting: [
    "training-strategic-planning-management-control-and-effective-budgeting",
    "training-rencana-anggaran-biaya-konstruksi",
    "training-penyusunan-anggaran-perawatan-bangunan-gedung-dan-fasilitas",
    "training-corporate-budgeting-training-concepts-applications",
    "training-budgeting-cost-control-for-coal-mining-industry",
    "training-strategic-plan-and-budgeting-perencanaan-strategi-dan-anggaran-rumah-sakit-tahun-2024-2025",
    "training-budgeting-cost-control",
    "training-cost-control-budgeting-profit-planning",
    "pelatihan-advanced-financial-modelling-dan-effective-budgeting-perusahaan",
    "training-cost-reduction-and-cost-control",
    "training-costing-and-budgeting-for-open-pit-mining-project-terbaru",
  ],
  // Versi 4 (5 Nov 2026): judul Sampah yang topiknya cocok, dipilih manual per kategori.
  "e-commerce": [
    "pelatihan-technology-logistics-digital-buying-online-shopping",
    "pelatihan-customer-relationship-management-e-business-e-commerce",
    "training-digital-marketing-strategy-terbaru",
  ],
  "emotional-intelligence": [
    "pelatihan-developing-emotional-quotient",
    "pelatihan-emotional-control",
    "pelatihan-pengantar-developing-emotional-quotient",
  ],
  estimation: [
    "training-integrated-project-management-and-calculating-owners-estimate",
    "training-tender-contract-owner-estimate-and-resource-management-2",
    "pelatihan-ms-excel-estimating-budgeting-calculating-controlling-evaluation",
    "pelatihan-natural-gas-engineering-properties-estimation-pipe-line-network-design-distribution-processing",
    "training-estimator",
    "pelatihan-calculating-project-owners-estimate-oe-hps-microsoft-project-application",
    "pelatihan-cost-estimating",
    "training-estimasi-proyek-kelistrikan",
    "training-metode-menyusun-harga-perkiraan-sendiri-hps-membuat-oe-owner-estimate",
  ],
  ethic: [
    "training-human-resources-ethics-3",
    "pelatihan-building-ethical-culture",
    "pelatihan-corporate-building-dalam-membangun-kultur-dan-etika-internal-organisasi-2",
    "training-work-ethics-personal-development",
    "ethical-leadership",
    "pelatihan-etika-komunikasi-pada-pelayanan-birokrasi",
    "training-etika-bisnis-untuk-ukm",
  ],
  excel: [
    "pelatihan-advance-microsoft-excel-training",
    "pelatihan-powerful-database-analysis-dashboard-reporting-microsoft-excel",
    "pelatihan-optimizing-financial-analysis-with-ms-excel",
    "pelatihan-developing-budget-using-microsoft-excel",
    "pelatihan-microsoft-office-specialist-certification-excel-2007",
    "training-merumuskan-job-profile-menggunakan-ms-excel",
    "training-financial-planning-forecasting-and-budgeting-using-ms-excel",
  ],
  feasibility: [
    "training-evaluasi-studi-kelayakan-dalam-usaha-pertambangan-batubara-logam-dan-non-logam",
    "training-studi-kelayakan-bisnis-konsep-dan-aplikasi",
    "pelatihan-studi-kelayakan-investasi-pertambangan",
    "training-kelayakan-industri-pertambangan",
    "training-studi-kelayakan-proyek",
    "pelatihan-project-feasibility-study",
    "pelatihan-feasibility-study-teknik-menyusun-studi-kelayakan-investasi",
    "pelatihan-analisis-kelayakan-investasi-publik",
  ],
  food: [
    "training-food-safety-terbaru",
    "training-manajemen-keuangan-perhotelan-dan-restoran",
  ],
  gedung: [
    "training-penyusunan-kajian-teknis-bangunan-untuk-sertifikasi-laik-fungsi-slf",
    "training-operator-listrik-untuk-bangunan-gedung",
    "pelatihan-advance-building-maintenance-management",
    "pelatihan-building-management",
    "pelatihan-pengawasan-bangunan",
    "pemeliharaan-aset-gedung",
    "pelatihan-green-building-and-factory",
    "pelatihan-penyusunan-anggaran-perawatan-gedung-dan-fasilitas",
    "pelatihan-fire-alarm-system-and-building-maintenance",
    "pelatihan-facility-management",
  ],
  "general-affair": [
    "training-general-affairs-professional",
    "training-general-affair-dan-keprotokoleran",
    "pelatihan-be-a-professional-general-affairs",
    "training-general-affairs-management-system",
  ],
  hidrogeologi: [
    "pelatihan-dasar-dasar-teknik-eksplorasi-dan-pemetaan-air-tanah",
  ],
  housekeeping: [
    "training-housekeeping-management-terbaru",
    "pelatihan-manajemen-kantor-yang-efektif-dengan-5s",
    "pelatihan-manajemen-5s-5r",
    "pelatihan-audit-5s-5r-seiriseitonseisoseiketsushitsuke",
    "training-5s-for-housekeeping",
    "training-performance-improvement-by-5s",
  ],
  hutan: [
    "pelatihan-manajemen-perkebunan-kelapa-sawit",
  ],
  import: [
    "pelatihan-custom-facility-shipping-documents-export-import-procedure",
    "training-tentang-export-import-incoterm",
    "pelatihan-procedure-export-import",
    "pelatihan-comprehensive-import-export-mechanis",
    "pelatihan-manajemen-ekspor",
    "pelatihan-letter-of-credit",
    "pelatihan-best-practice-tatalaksana-export-import-dan-letter-credit-konsep-dan-aplikasi",
    "pelatihan-shipping-management-terbaru",
  ],
  inovasi: [
    "training-inovasi-dan-kreatifitas-menuju-organisasi-pembelajaran",
    "pelatihan-innovative-creative-work",
    "pelatihan-creative-dan-innovative-thinking",
    "training-mengembangkan-ekosistem-inovasi-organisasi",
    "training-product-innovation-management",
    "pelatihan-creative-leadership-workshop",
    "pelatihan-creative-problem-solving",
    "pelatihan-creating-develop-new-product-research-research-design-thinking-based",
    "training-inspirational-leadership-and-creativity",
    "pelatihan-creative-problem-solving-effective-decision-making",
  ],
  insurance: [
    "pelatihan-marine-cargo-hull-insurance",
  ],
  iso: [
    "pelatihan-becoming-effective-internal-quality-auditor-based-iso-90012008-auditor",
    "training-basic-consept-of-iso-9001-2008",
    "pelatihan-pemahaman-standar-dan-teknik-dokumentasi-iso-90012008",
    "pelatihan-manajemen-risiko-berbasis-iso-31000",
    "pelatihan-iso-14001-environmental-management-system-sistem-manajemen-lingkungan",
    "pelatihan-iso-9001-2015-manajemen-mutu",
    "pelatihan-best-practice-audit-iso-19011-standard-pedoman-audit-iso-9000",
    "training-iso-14064-scope-1-3-terbaru",
    "training-iso-series-integrasi-sistem-manajemen",
  ],
  kearsipan: [
    "training-sistem-manajemen-dokumen-elektronik",
    "training-electronik-filing-document-management-system",
    "pelatihan-profesional-filing-and-records-management",
    "filing-system-arsip-dan-aset",
    "pelatihan-document-control-and-filling-system",
    "training-manajemen-kearsipan-dan-tata-kelola-kantor",
    "pelatihan-document-management-filing-system-principles-practice-uu-kearsipan-terbaru-nomor-43-tahun-2009",
    "training-sistem-kearsipan-perguruan-tinggi-2025",
    "training-kearsipan-pemerintah-perusahaan-2023-2024",
  ],
  kepabeanan: [
    "pelatihan-letter-credit-lc-dalam-ucp-600-dan-isbp-dikaitkan-transaksi-ekspor-impor-diaplikasikan-dalam-shipping-dan-kepa",
  ],
  kepatuhan: [
    "training-good-corporate-governance-gcg",
    "pelatihan-corporate-governance-practical-guide-for-auditor",
    "pelatihan-anti-money-laundering-aml-laporan-transaksi-keuangan-mencurigakan-ltkm",
    "audit-internal-dalam-good-corporate-governance",
    "pelatihan-advanced-good-corpoeate-governance-banking-4",
    "pelatihan-it-governance-2",
    "training-gcg-awareness-dan-strategi-implementasinya",
    "training-good-corporate-governance-gcg-dan-whistle-blowing-system-wbs-bali",
  ],
  ketenagakerjaan: [
    "pelatihan-manajemen-penanganan-perselisihan-hubungan-industrial",
    "training-teknik-menyusun-perjanjian-kerja-bersama-pkb-yang-efektif",
    "training-hubungan-industrial-ketenagakerjaan-terbaru",
    "training-strategi-manajemen-outsourcing-2",
    "training-serikat-pekerja-terbaru",
    "training-uu-no-6-tahun-2023-tentang-undang-undang-cipta-kerja-klaster-ketenagakerjaan",
  ],
  kinerja: [
    "training-keterampilan-managerial-untuk-peningkatan-kinerja",
    "training-sumber-daya-manusia-performance-management",
    "training-employee-performance-management",
    "pelatihan-performance-management-appraisal",
    "training-sistem-manajemen-kinerja",
    "training-analisa-beban-kerja-kpi-dalam-penetapan-remunerasi",
    "training-design-kpi-for-hr-departement",
    "training-high-performance-team-work",
    "training-coaching-counseling-mentoring-technique-for-maximum-performance",
  ],
  konsolidasi: [
    "training-psak-di-indonesia",
    "implementasi-psak-penyajian-laporan-keuangan-perusahaan",
    "pelatihan-best-practice-implementasi-ifrs-dan-dampak-terhadap-psak-2",
    "pelatihan-international-financial-reporting-standard-ifrs",
    "pelatihan-implikasi-penerapan-psak-terbaru-menuju-konvergensi-ifrs",
    "training-psak-73",
    "training-psak-71",
    "pelatihan-psak-46",
  ],
  laboratorium: [
    "training-pengendalian-alat-bahan-kimia-di-laboratorium",
    "training-manajemen-laboratorium-dan-quality-control-laboratorium-qc-online",
  ],
  mekatronika: [
    "pelatiha-plc-siemens-s7-tingkat-dasar",
    "pelatihan-motor-drives-automation-system-motor-intenter-system",
  ],
  metering: [
    "training-flowmetering-and-custody-transfer",
    "pelatihan-distribution-system-fuzzy-logic-metering-load-control",
    "training-kalibrasi-flow-meter-minyak",
  ],
  mineral: [
    "training-peraturan-baru-tentang-pelaksanaan-kegiatan-usaha-pertambangan-mineral-dan-batu-bara",
    "training-hukum-pertambangan-batubara-dan-mineral",
    "pelatihan-geology-mapping-mining-exploration-best-practice-case-study",
    "pelatihan-best-practice-manajemen-eksplorasi",
    "training-bisnis-pertambangan-mineral-dan-batu-bara",
    "training-eksplorasi-dan-pengelolaan-sumber-daya-geologi",
    "training-contract-drafting-bidang-pertambangan-mineral-dan-batubara",
    "training-coal-exploration",
  ],
  modeling: [
    "pelatihan-financial-modeling-for-budgeting",
    "pelatihan-financial-modeling-for-financial-institution",
    "pelatihan-modern-financial-modeling",
    "pelatihan-market-human-resources-research-using-structural-equation-modeling-sem-2",
    "training-pemodelan-keuangan-untuk-menyusun-anggaran-perusahaan",
    "training-financial-modelling-and-decision-making-2",
    "training-advanced-financial-modelling",
    "pelatihan-financial-modelling",
  ],
  "natural-resources": [
    "amdal-training",
    "pelatihan-management-analysis-environmental-impact",
    "training-tahapan-dan-metode-penyusunan-amdal",
  ],
  "pasar-modal": [
    "pelatihan-hukum-pasar-modal",
    "pelatihan-capital-market-pasar-modal",
    "pelatihan-best-practice-portopolio-obligasi-konsep-dan-oplikasi",
    "pelatihan-best-practice-investment-analysis-portfolio-theory",
  ],
  pembayaran: [
    "pelatihan-collection-techniques-collector-banking-leasing-companies",
    "training-cara-efektif-mengelola-piutang-customer",
    "pelatihan-best-practice-teknik-penagihan-dan-penanganan-piutang-debt-collection-2",
    "pelatihan-collection-strategy-negotiation-skills",
  ],
  "pembuatan-pakan-ikan": [
    "pelatihan-pakan-ikan-terapung-dan-tenggelam",
    "pelatihan-kiat-membuat-pakan-ikan-bermutu",
  ],
  pemerintah: [
    "training-pengadaan-barang-dan-jasa-pemerintah-pbj-2023-2024",
    "pelatihan-sistem-pengelolaan-keuangan-daerah",
    "training-e-procurement-bagi-instansi-pemerintah",
    "training-penilaian-risiko-di-instansi-pemerintah",
    "pelatihan-tata-usaha-tu-instansi-pemerintah-2024-2025",
    "training-perencanaan-dan-pengendalian-keuangan-instansi-pemerintah",
    "pelatihan-tata-kota-perencanaan-tata-ruang-pemerintah-daerah-tahun-2024-2025",
  ],
  pemetaan: [
    "training-survei-dan-pemetaan-geomorfologi",
    "pelatihan-survey-mapping-menggunakan-drone",
    "pelatihan-teknik-pemetaan-dan-survey-lapangan",
  ],
  perpustakaan: [
    "pelatihan-management-perpustakaan",
    "training-sistem-management-mutu-iso-9001-2008-untuk-perpustakaan",
  ],
  production: [
    "training-manufacturing-planning-control-system-improving-your-scheduling-for-better-customer-service",
    "pelatihan-production-planning-inventory-control",
    "training-integrated-production-management",
    "training-lean-manufacturing-system-tools-untuk-menjadikan-perusahaan-kelas-dunia",
    "training-manajemen-operasi-dan-produksi",
    "pelatihan-auditing-the-manufacturing-process",
    "pelatihan-metode-artificial-lift-untuk-produksi-minyak",
  ],
  "public-speaking": [
    "training-business-presentation-skills",
    "training-komunikasi-efektif-dan-teknik-presentasi-efektif",
    "pelatihan-effective-presentation-skill",
    "pelatihan-best-practice-powerful-presentation-communication-skill-4",
    "training-presentation-for-negotiations-2",
    "training-planning-presentations",
    "pelatihan-public-speaking-presentation-skill",
    "pelatihan-making-high-impact-presentations-leaders-managers",
    "pelatihan-boost-presentation-iq",
    "pelatihan-presentation-skill-praktek-dan-implementasi",
  ],
  "quality-control": [
    "pelatihan-statistical-process-control",
    "pelatihan-project-quality-management",
    "pelatihan-service-quality-awarness-mindset",
    "training-best-practice-quality-control",
    "pelatihan-best-technique-quality-control-using-statistical-process-control-spc",
    "pelatihan-quality-control-dan-quality-assurance",
  ],
  reliability: [
    "training-reliability-availability-and-maintainability-analysis",
    "training-reliability-centered-maintenance-weibull-analysis",
    "pelatihan-merging-tpm-rcm-maximum-performance-terbaru",
    "pelatihan-maintenance-priority-index-mpi-dengan-proses-system-equipment-reliability-prioritization-serp",
    "pelatihan-developing-effective-maintenance-reliability-centered-maintenance-rcm",
    "training-modern-maintenance-management-by-means-of-reliability",
    "training-reliability-management",
    "pelatihan-reliability-centere-maintenance-rcm",
  ],
  "rumah-sakit": [
    "training-hospital-service-excellent",
    "training-general-affairs-rumah-sakit-terbaru",
    "pelatihan-business-process-mapping-pendirian-poliklinik-dan-rumah-sakit-2",
    "training-super-healing-service-experience-workshop-untuk-tenaga-kesehatan",
    "bimbingan-teknis-pendampingan-penyusunan-dokumen-akradetasi-puskesmas-2025",
    "pelatihan-manajemen-kinerja-menggunakan-balanced-scorecard-bsc-untuk-rumah-sakit-dan-pendidikan",
    "pelatihan-manajemen-logistik-dan-filling-system-rumah-sakit",
  ],
  scheduling: [
    "training-project-management-with-primavera-p6",
    "training-ms-project-managing-project-using-microsoft-project-application",
    "pelatihan-mechanical-maintenance-planning-scheduling-estimating",
    "pelatihan-advanced-maintenance-planning-scheduling-auditing-benchmarking-3",
    "pelatihan-project-scheduling-controlling",
    "pelatihan-maintenance-teknik-perencanaan-dan-penjadwalan-perawatan-peralatan-mesin",
    "pelatihan-aplikasi-primavera-dalam-penjadwalan-dan-pengendalian-proyek",
    "training-maintenance-planning-schedulling-and-work-control",
    "pelatihan-effective-time-management-2",
  ],
  sop: [
    "pelatihan-standard-operating-procedure-sop-finance",
    "training-kiat-menyusun-sop-menggunakan-kpi",
    "training-human-resources-policies-procedures-sop-hrd-updated",
    "training-sop-for-enterprise-resources-planning-erp-integrated-real-time-system",
    "training-writing-hr-policy-and-procedures",
    "pelatihan-sales-marketing-policies-and-procedures",
    "pelatihan-developing-logistic-policies-procedures",
    "pelatihan-accounting-policies-and-procedure-manual",
  ],
  "spare-part-management": [
    "pelatihan-spare-parts-management",
    "training-inventory-and-warehouse-management",
    "pelatihan-inventory-management-2",
    "pelatihan-material-management-2",
    "pelatihan-managemen-pergudangan-dan-persediaan",
    "pelatihan-effective-receiving-warehousing",
    "training-inventory-management-for-raw-material",
    "warehouse-management-strategy-implementation-control",
    "pelatihan-managerial-skill-series-logistic-warehouse-kpi",
  ],
  supervisor: [
    "training-leadership-and-supervisory-skills",
    "training-managerial-leaderhsip-skill-for-supervisor",
    "training-management-skills-for-new-supervisors",
    "training-supervisory-management-program",
    "training-effective-supervisory-program",
    "pelatihan-basic-supervisory-skills",
    "pelatihan-moving-from-staff-member-to-supervisor",
    "training-supervisor-hr-sertifikasi-bnsp",
  ],
  survey: [
    "training-survey-kepuasan-karyawan",
    "training-riset-sdm-dan-survey-kepuasan-karyawan",
    "training-bimbingan-teknis-survei-kepuasan-pelayanan-publik",
    "pelatihan-quantity-surveyor",
    "training-drone-survey",
  ],
  switchgear: [
    "pelatihan-medium-voltage-power-circuit-breakers-switchgear",
    "pelatihan-low-voltage-switchgear-maintenance-testing-troubleshooting",
    "training-switchgear-mcc-electrical-syatem-and-troubleshooting",
    "training-switchgear-maintenance",
    "substation-switchyard-150-kv",
    "training-gardu-induk",
    "pelatihan-protective-relay",
    "training-medium-voltage",
    "pelatihan-power-distribution-system-protection-relaying",
  ],
  syariah: [
    "training-dasar-multifinance-syariah",
    "pelatihan-legal-syariah",
    "training-lembaga-keuangan-mikro-syariah-terbaru",
    "training-aspek-legal-perbankan-syariah-2",
    "training-pembiayaan-konsumer-bank-syariah-termurah",
    "pelatihan-audit-internal-bank-syariah-intermediate-termurah",
    "training-dasar-treasury-bank-syariah-termurah",
    "pelatihan-dasar-perbankan-syariah-jakarta",
  ],
  transaksi: [
    "training-peningkatan-kualitas-layanan-nasabah-dengan-mengoptimalkan-mesin-edc-untuk-transaksi",
    "training-teknik-praktis-akuntansi-perbankan",
    "training-peranan-lc-skbdn-dan-guarantee-dalam-transaksi-ekspor-impor",
    "training-peranan-skbdn-bank-garansi-standby-lc-transaksi-exim-termurah",
    "training-bourse-game-mm-transaction-simulation-terbaru",
    "training-bourse-game-swap-transaction-simulation-terbaru",
    "pelatihan-transaksi-derivatives",
  ],
  treasury: [
    "pelatihan-treasury-management",
    "pelatihan-treasury-management-for-non-specialist",
    "pelatihan-cash-management-treasury-management",
    "training-boosting-company-profit-through-aplication-of-cash-management",
    "pelatihan-advance-cash-management-2",
    "pelatihan-quadrant-cash-management-meningkatkan-laba-perusahaan",
    "pelatihan-best-practice-petty-cash-management",
    "pelatihan-best-practice-advance-cash-management-konsep-aplikasi-2",
  ],
  troubleshooting: [
    "training-control-valve-operation-maintenance-and-troubleshooting",
    "training-rotating-equipment-rotating-equipment-operation-maintenance-and-troubleshooting",
    "training-pump-compressor-operation-control-troubleshooting",
    "training-electrical-submergible-pump-design-operation-and-troubleshooting",
    "training-advance-troubleshooting-ups",
    "pelatihan-refrigerator-operation-maintenance-troubleshooting",
    "pelatihan-standard-steam-turbine-operation-maintenance-and-troubleshooting",
    "pelatihan-troubleshooting-and-operability-problem-for-centrifugal-compressors",
    "pelatihan-praktik-pemecahan-masalah-untuk-teknisi-pemeliharaan",
    "pelatihan-compressor-operation-maintenance-troubleshooting-terbaru",
  ],
  web: [
    "training-administrasi-data-pegawai-berbasis-website",
  ],
};
// Versi 4: judul seed sendiri (bukan snapshot referensi) yang ada di Sampah dan belum pernah diubah admin,
// dipilih manual per kategori. Hanya dipulihkan; database yang tidak punya barisnya melewatinya.
export const CATEGORY_FILL_TRASH_PICKS: Record<string, string[]> = {
  ethic: [
    "etika-dan-privasi-dalam-operasi-drone",
    "etika-dan-hak-cipta-konten-digital",
  ],
  feasibility: [
    "analisis-kelayakan-investasi",
    "analisis-biaya-dan-kelayakan-usaha-drone-pertanian",
  ],
  gedung: [
    "inspeksi-atap-dan-fasad-bangunan",
  ],
  hutan: [
    "integrasi-drone-dengan-sistem-informasi-perkebunan",
    "drone-untuk-perkebunan-kelapa-sawit",
  ],
  insurance: [
    "asuransi-dan-tanggung-jawab-hukum-operasi-drone",
  ],
  kepatuhan: [
    "audit-kepatuhan-operator-drone",
  ],
  konsolidasi: [
    "konsolidasi-laporan-keuangan",
  ],
  modeling: [
    "financial-modeling-dengan-excel",
  ],
  pembayaran: [
    "akuntansi-piutang-dan-utang",
  ],
  pemetaan: [
    "pemetaan-lahan-skala-kecil-dengan-drone",
    "pemetaan-lahan-sawah-dengan-drone",
    "pemetaan-kebun-dan-penghitungan-pohon",
    "membaca-peta-hasil-survei-drone",
  ],
  photography: [
    "komposisi-foto-untuk-pemula",
    "fotografi-potret-dasar",
    "dasar-videografi-untuk-pemula",
    "dasar-fotografi-udara-dengan-drone",
    "fotografi-produk-profesional-dengan-lampu-studio",
    "fotografi-makanan",
    "editing-foto-dengan-lightroom",
    "retouching-foto-dengan-photoshop",
    "fotografi-komersial-untuk-brand",
  ],
  production: [
    "manajemen-produksi-video",
  ],
  survey: [
    "survei-koridor-untuk-jalan-dan-jaringan-pipa",
    "survei-volume-stockpile-dengan-drone",
  ],
  transaksi: [
    "pajak-atas-transaksi-konstruksi",
  ],
  web: [
    "content-marketing-untuk-website",
  ],
};

const db = getDb();
// Judul kembar = sama setelah awalan "Training/Pelatihan" dan tanda baca diabaikan
// (mis. "PELATIHAN QA & QC ..." dan "TRAINING QA & QC ...").
export const normalizeTitle = (title: string) =>
  plainTitle(title)
    .toLowerCase()
    .replace(/^(training|trainning|pelatihan)\s+/, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

// restore = baris di Sampah yang belum pernah diubah admin; create = judul snapshot yang belum ada di database.
export type CategoryFillSource = { kind: "restore"; trainingId: string } | { kind: "create"; postIndex: number };
export type CategoryFillPick = { categoryId: string; categorySlug: string; source: CategoryFillSource; slug: string; title: string };
export type CategoryFillPlan = { picks: CategoryFillPick[]; summary: { slug: string; before: number; after: number }[] };

type Candidate = { slug: string; title: string; source: CategoryFillSource; hasPhotos: boolean };

// Rencana tanpa menulis apa pun (dipakai seed dan pratinjau).
export async function planCategoryFill(): Promise<CategoryFillPlan> {
  const trashPickSlugs = Object.values(CATEGORY_FILL_TRASH_PICKS).flat();
  const [categories, active, known, photos, trashRows] = await Promise.all([
    db.category.findMany({
      where: { slug: { in: CATEGORY_FILL_SLUGS }, deletedAt: null },
      select: { id: true, slug: true, _count: { select: { trainings: { where: { training: { deletedAt: null } } } } } },
    }),
    db.training.findMany({ where: { deletedAt: null }, select: { slug: true, title: true } }),
    db.training.findMany({
      where: { slug: { in: referenceSnapshotSlugs } },
      select: { id: true, slug: true, deletedAt: true, updatedById: true },
    }),
    loadTrainingPhotos(),
    // Judul seed sendiri di Sampah (CATEGORY_FILL_TRASH_PICKS): hanya yang belum pernah diubah admin.
    db.training.findMany({
      where: { slug: { in: trashPickSlugs }, deletedAt: { not: null }, updatedById: null },
      select: { id: true, slug: true, title: true },
      orderBy: { deletedAt: "desc" },
    }),
  ]);
  const activeSlugs = new Set(active.map((row) => row.slug));
  const trashBySlug = new Map<string, { id: string; title: string }>();
  for (const row of trashRows) if (!trashBySlug.has(row.slug)) trashBySlug.set(row.slug, row);
  const usedTitles = new Set(active.map((row) => normalizeTitle(row.title)));
  const knownSlugs = new Set(known.map((row) => row.slug));
  const restorable = new Map(
    known.filter((row) => row.deletedAt !== null && row.updatedById === null).map((row) => [row.slug, row.id]),
  );
  const indexBySlug = new Map(referenceSnapshotSlugs.map((slug, index) => [slug, index]));
  const snapshotIdBySlug = new Map(snapshot.categories.map((category) => [category.slug, category.id]));

  const candidate = (index: number): Candidate | null => {
    const post = snapshot.posts[index];
    const slug = referenceSnapshotSlugs[index];
    if (!post || !slug || !hasReferenceTitle(post) || activeSlugs.has(slug)) return null;
    const title = plainTitle(post.title).slice(0, 200);
    const hasPhotos = slug in photos.trainings;
    const trainingId = restorable.get(slug);
    if (trainingId) return { slug, title, source: { kind: "restore", trainingId }, hasPhotos };
    // Ada di database tapi tidak bisa dipulihkan (dihapus atau diubah admin): dibiarkan.
    if (knownSlugs.has(slug)) return null;
    return { slug, title, source: { kind: "create", postIndex: index }, hasPhotos };
  };

  const candidates = categories.map((category) => {
    const snapshotId = snapshotIdBySlug.get(category.slug);
    const tagged = snapshot.posts
      .map((post, index) => ({ post, index }))
      .filter(({ post }) => snapshotId !== undefined && post.categoryIds.includes(snapshotId))
      .sort(
        (a, b) =>
          b.post.date.localeCompare(a.post.date) ||
          referenceSnapshotSlugs[a.index].localeCompare(referenceSnapshotSlugs[b.index]),
      )
      .map(({ index }) => candidate(index));
    const topic = (CATEGORY_FILL_TOPIC_PICKS[category.slug] ?? []).map((slug) => {
      const index = indexBySlug.get(slug);
      return index === undefined ? null : candidate(index);
    });
    const seedTrash = (CATEGORY_FILL_TRASH_PICKS[category.slug] ?? []).map((slug): Candidate | null => {
      const row = trashBySlug.get(slug);
      if (!row || activeSlugs.has(slug)) return null;
      return { slug, title: plainTitle(row.title).slice(0, 200), source: { kind: "restore", trainingId: row.id }, hasPhotos: slug in photos.trainings };
    });
    const rows = [...tagged, ...topic, ...seedTrash].filter((row): row is Candidate => row !== null);
    // Urutan asal tetap, yang sudah punya foto unik didahulukan.
    return { category, rows: [...rows.filter((row) => row.hasPhotos), ...rows.filter((row) => !row.hasPhotos)] };
  });

  const picks: CategoryFillPick[] = [];
  const summary: CategoryFillPlan["summary"] = [];
  const taken = new Set<string>();
  for (const { category, rows } of [...candidates].sort((a, b) => a.rows.length - b.rows.length || a.category.slug.localeCompare(b.category.slug))) {
    const before = category._count.trainings;
    let after = before;
    for (const row of rows) {
      if (after >= CATEGORY_FILL_TARGET) break;
      const title = normalizeTitle(row.title);
      if (taken.has(row.slug) || usedTitles.has(title)) continue;
      taken.add(row.slug);
      usedTitles.add(title);
      picks.push({ categoryId: category.id, categorySlug: category.slug, source: row.source, slug: row.slug, title: row.title });
      after += 1;
    }
    summary.push({ slug: category.slug, before, after });
  }
  return { picks, summary: summary.sort((a, b) => a.slug.localeCompare(b.slug)) };
}

// Pelatihan baru dari judul snapshot: naskah dan field sama dengan seed referensi. updatedById diisi
// (seperti baris yang dipulihkan) supaya perapian katalog referensi berikutnya tidak memindahkannya ke Sampah.
// Dipakai juga oleh seed sisa katalog (seed-catalog-rest.ts); source dicatat di diff audit.
export async function createReferenceTraining(input: {
  post: ReferencePost;
  slug: string;
  categoryId: string;
  categoryName?: string;
  ownerId: string;
  source: string;
}) {
  const { slug, categoryId, ownerId, source } = input;
  const item = input.categoryName
    ? referenceTraining({ ...input.post, slug }, input.categoryName)
    : referenceTraining({ ...input.post, slug });
  await db.$transaction(async (tx) => {
    const training = await tx.training.create({
      data: {
        slug,
        title: item.title,
        summary: item.summary,
        description: item.description as Prisma.InputJsonValue,
        outcomes: item.outcomes,
        modules: item.modules,
        audience: item.audience,
        facilities: [],
        faq: item.faq,
        duration: null,
        method: null,
        types: ["PUBLIC", "IN_HOUSE"],
        priceText: null,
        showPrice: false,
        status: "PUBLISHED",
        publishedAt: item.publishedAt,
        publishRevalidatedAt: item.publishedAt,
        updatedById: ownerId,
        categories: { create: { categoryId, isPrimary: true } },
      },
      select: { id: true },
    });
    await writeAudit(
      {
        userId: ownerId,
        action: AuditAction.CREATE,
        entity: "Training",
        entityId: training.id,
        diff: { categoryIds: { from: [], to: [categoryId] }, source },
      },
      tx,
    );
  });
  await revalidateEntity({ entity: "Training", slugs: [slug] });
}

// Pulihkan baris Sampah lewat service admin (cek slug, lepas redirect yang memakai path ini, audit
// RESTORE, revalidate), lalu tautkan ke SATU kategori.
export async function restoreIntoCategory(input: { trainingId: string; categoryId: string; ownerId: string; source: string }) {
  const { trainingId, categoryId, ownerId, source } = input;
  await restoreTraining(trainingId, {}, ownerId);
  await db.$transaction(async (tx) => {
    const before = await tx.trainingCategory.findMany({ where: { trainingId }, select: { categoryId: true } });
    await tx.trainingCategory.deleteMany({ where: { trainingId } });
    await tx.trainingCategory.create({ data: { trainingId, categoryId, isPrimary: true } });
    await writeAudit(
      {
        userId: ownerId,
        action: AuditAction.UPDATE,
        entity: "Training",
        entityId: trainingId,
        diff: { categoryIds: { from: before.map((link) => link.categoryId), to: [categoryId] }, source },
      },
      tx,
    );
  });
}

export type CategoryFillResult = { restored: number; created: number; summary: CategoryFillPlan["summary"]; failed: string[] };

export async function seedCategoryFill(): Promise<CategoryFillResult | "dilewati"> {
  const done = await db.siteSetting.findUnique({ where: { key: CATEGORY_FILL_KEY }, select: { value: true } });
  if (done?.value === CATEGORY_FILL_VERSION) return "dilewati";
  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const plan = await planCategoryFill();
  const failed: string[] = [];
  let restored = 0;
  let created = 0;

  await withRevalidateBatch(async () => {
    for (const pick of plan.picks) {
      try {
        if (pick.source.kind === "create") {
          await createReferenceTraining({
            post: snapshot.posts[pick.source.postIndex],
            slug: pick.slug,
            categoryId: pick.categoryId,
            ownerId: owner.id,
            source: "category-fill",
          });
          created += 1;
          continue;
        }
        await restoreIntoCategory({ trainingId: pick.source.trainingId, categoryId: pick.categoryId, ownerId: owner.id, source: "category-fill" });
        restored += 1;
      } catch (error) {
        failed.push(`${pick.slug} (${error instanceof Error ? error.message : String(error)})`);
      }
    }
  });

  await db.siteSetting.upsert({
    where: { key: CATEGORY_FILL_KEY },
    create: { key: CATEGORY_FILL_KEY, value: CATEGORY_FILL_VERSION },
    update: { value: CATEGORY_FILL_VERSION },
  });
  return { restored, created, summary: plan.summary, failed };
}
