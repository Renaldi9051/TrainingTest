import type { AttentionKey, TrainingIssue } from "@/lib/api/types";

// Label & tautan "perlu dibereskan" (dashboard) dan filter ?issue= di daftar admin. Sama dengan
// BE/src/services/dashboard.ts dan validator daftar pelatihan/layanan.

export const TRAINING_ISSUE_LABELS: Record<TrainingIssue, string> = {
  "no-cover": "Tanpa sampul",
  "cover-no-alt": "Sampul tanpa teks alt",
  "stale-draft": "Draf tidak diubah > 30 hari",
  "no-summary": "Tayang tanpa ringkasan",
};

export const TRAINING_ISSUES = Object.keys(TRAINING_ISSUE_LABELS) as TrainingIssue[];

export function isTrainingIssue(value: string | null): value is TrainingIssue {
  return value !== null && (TRAINING_ISSUES as string[]).includes(value);
}

type AttentionMeta = { label: string; hint: string; all: string; item: (id: string) => string };

export const ATTENTION_META: Record<AttentionKey, AttentionMeta> = {
  trainingNoCover: {
    label: "Pelatihan tanpa sampul",
    hint: "Kartu katalog tampil sebagai blok abu.",
    all: "/admin/trainings?issue=no-cover",
    item: (id) => `/admin/trainings/${id}`,
  },
  trainingCoverNoAlt: {
    label: "Sampul tanpa teks alt",
    hint: "Isi alt di media library supaya terbaca pembaca layar.",
    all: "/admin/trainings?issue=cover-no-alt",
    item: (id) => `/admin/trainings/${id}`,
  },
  staleDraft: {
    label: "Draf lama (> 30 hari)",
    hint: "Tayangkan, lengkapi, atau hapus.",
    all: "/admin/trainings?issue=stale-draft",
    item: (id) => `/admin/trainings/${id}`,
  },
  publishedNoSummary: {
    label: "Tayang tanpa ringkasan",
    hint: "Meta description jadi kosong (SEO description juga kosong).",
    all: "/admin/trainings?issue=no-summary",
    item: (id) => `/admin/trainings/${id}`,
  },
  pastOpenSchedule: {
    label: "Jadwal lewat, status masih Dibuka",
    hint: "Di publik sudah tampil Selesai; rapikan statusnya.",
    all: "/admin/schedules?period=past&status=OPEN",
    item: () => "/admin/schedules?period=past&status=OPEN",
  },
  serviceNoImage: {
    label: "Layanan tanpa gambar",
    hint: "Gambar tampil saat kursor di atas baris layanan.",
    all: "/admin/services?issue=no-image",
    item: (id) => `/admin/services/${id}`,
  },
};

// Halaman edit per entitas AuditLog (yang tidak punya halaman edit: daftar modulnya).
export function activityHref(entity: string, id: string): string | null {
  const edit: Record<string, string> = {
    Training: "/admin/trainings",
    Category: "/admin/categories",
    Service: "/admin/services",
    Page: "/admin/pages",
    HomeSection: "/admin/home",
    PortfolioItem: "/admin/portfolio",
  };
  const list: Record<string, string> = {
    Client: "/admin/clients",
    Testimonial: "/admin/testimonials",
    MarketingContact: "/admin/marketing",
    Media: "/admin/media",
  };
  if (edit[entity]) return `${edit[entity]}/${id}`;
  return list[entity] ?? null;
}

export const ENTITY_LABELS: Record<string, string> = {
  Training: "pelatihan",
  Category: "kategori",
  CategoryOrder: "urutan kategori",
  Schedule: "jadwal",
  Service: "layanan",
  Page: "halaman",
  HomeSection: "section beranda",
  PortfolioItem: "portofolio",
  Client: "klien",
  Testimonial: "testimoni",
  MarketingContact: "kontak marketing",
  MediaPartner: "media partner",
  Media: "media",
  Nav: "menu",
  Settings: "pengaturan",
  SiteSetting: "pengaturan",
  Redirect: "redirect",
  Session: "sesi login",
  DayChange: "pergantian hari",
  ContentSync: "sinkronisasi konten",
};

export const ACTION_LABELS: Record<string, string> = {
  CREATE: "menambah",
  UPDATE: "mengubah",
  DELETE: "menghapus",
  RESTORE: "memulihkan",
  REORDER: "mengurutkan",
  DUPLICATE: "menduplikasi",
  BULK: "mengubah massal",
  IMPORT: "mengimpor",
  LOGIN: "masuk",
  LOGOUT: "keluar",
};

export function activityText(action: string, entity: string): string {
  return `${ACTION_LABELS[action] ?? action.toLowerCase()} ${ENTITY_LABELS[entity] ?? entity}`;
}

const relative = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });

// "5 menit lalu", "kemarin", ... (waktu lengkap di title).
export function relativeTime(iso: string, now = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 30],
    ["month", 12],
  ];
  let value = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return relative.format(value, unit);
    value = Math.round(value / size);
  }
  return relative.format(value, "year");
}
