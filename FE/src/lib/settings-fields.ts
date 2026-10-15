import type { PageHeaderPage, SettingKey } from "@/lib/api/types";

// Field halaman Pengaturan situs yang bisa dituju dari search global admin (Ctrl/Cmd+K).
// anchor = "<key>.<field>" dipasang sebagai data-anchor di form; URL: /admin/settings#field-<anchor>.
// Sinonim: kata yang biasa diketik admin untuk field itu (mis. "nomor WA").
export type SettingField = {
  key: SettingKey;
  field: string;
  label: string;
  synonyms: readonly string[];
};

export const SETTING_TAB_LABELS: Record<SettingKey, string> = {
  "site.identity": "Identitas",
  "site.header": "Header",
  "site.contact": "Kontak",
  "site.social": "Sosial media",
  "site.footer": "Footer",
  "training.defaults": "Pelatihan",
  "seo.default": "SEO default",
  "page.headers": "Kepala halaman",
  "services.process": "Alur kerja sama",
};

// Halaman daftar yang kepalanya bisa diatur (setting page.headers); label lama = fallback di FE.
export const PAGE_HEADER_LABELS: Record<PageHeaderPage, string> = {
  pelatihan: "Katalog pelatihan",
  layanan: "Layanan",
  portofolio: "Portofolio",
  jadwal: "Jadwal",
  kontak: "Kontak",
};

export const SETTING_FIELDS: readonly SettingField[] = [
  { key: "site.identity", field: "name", label: "Nama situs", synonyms: ["nama lembaga", "nama website", "brand"] },
  { key: "site.identity", field: "tagline", label: "Tagline", synonyms: ["slogan", "moto"] },
  { key: "site.identity", field: "logoLightId", label: "Logo terang", synonyms: ["logo header"] },
  { key: "site.identity", field: "logoDarkId", label: "Logo gelap", synonyms: ["logo footer"] },
  { key: "site.identity", field: "faviconId", label: "Favicon", synonyms: ["ikon situs", "icon tab"] },
  { key: "site.header", field: "ctaLabel", label: "Label tombol header", synonyms: ["cta header", "tombol header"] },
  { key: "site.header", field: "ctaHref", label: "Tautan tombol header", synonyms: ["link tombol", "cta header"] },
  { key: "site.contact", field: "phone", label: "Telepon", synonyms: ["nomor telepon", "no telp", "telp", "kontak"] },
  { key: "site.contact", field: "whatsapp", label: "WhatsApp", synonyms: ["nomor wa", "no wa", "wa", "kontak"] },
  { key: "site.contact", field: "email", label: "Email", synonyms: ["e-mail", "surel", "kontak"] },
  { key: "site.contact", field: "emailSecondary", label: "Email kedua", synonyms: ["email pendaftaran", "email keuangan"] },
  { key: "site.contact", field: "address", label: "Alamat", synonyms: ["lokasi", "alamat kantor"] },
  { key: "site.contact", field: "mapEmbedUrl", label: "URL embed peta", synonyms: ["peta", "maps", "google maps", "lokasi"] },
  {
    key: "site.social",
    field: "links",
    label: "Tautan sosial media",
    synonyms: ["sosmed", "instagram", "facebook", "linkedin", "youtube", "tiktok", "twitter"],
  },
  { key: "site.footer", field: "description", label: "Deskripsi footer", synonyms: ["teks footer"] },
  { key: "site.footer", field: "copyright", label: "Teks hak cipta", synonyms: ["copyright"] },
  { key: "training.defaults", field: "facilities", label: "Fasilitas default", synonyms: ["fasilitas pelatihan"] },
  { key: "training.defaults", field: "faq", label: "FAQ umum", synonyms: ["pertanyaan umum", "faq pelatihan"] },
  { key: "training.defaults", field: "inHouseNote", label: "Catatan in-house", synonyms: ["in house"] },
  { key: "training.defaults", field: "disclaimer", label: "Disclaimer", synonyms: ["penafian"] },
  { key: "seo.default", field: "titleTemplate", label: "Template judul", synonyms: ["seo", "title"] },
  { key: "seo.default", field: "defaultTitle", label: "Judul default", synonyms: ["seo", "title"] },
  { key: "seo.default", field: "description", label: "Deskripsi default", synonyms: ["seo", "meta description"] },
  { key: "seo.default", field: "ogImageId", label: "Gambar OG default", synonyms: ["og image", "gambar share", "seo"] },
  { key: "page.headers", field: "layanan", label: "Kepala halaman Layanan", synonyms: ["judul halaman", "header halaman", "layanan"] },
  { key: "page.headers", field: "portofolio", label: "Kepala halaman Portofolio", synonyms: ["judul halaman", "header halaman", "portofolio"] },
  { key: "page.headers", field: "pelatihan", label: "Kepala halaman Katalog", synonyms: ["judul halaman", "header halaman", "katalog"] },
  { key: "services.process", field: "steps", label: "Alur kerja sama", synonyms: ["langkah", "proses", "alur layanan"] },
];

export function settingAnchor(key: SettingKey, field: string): string {
  return `${key}.${field}`;
}

export function settingFieldHref(key: SettingKey, field: string): string {
  return `/admin/settings#field-${settingAnchor(key, field)}`;
}

export function findSettingField(key: string, field: string): SettingField | undefined {
  return SETTING_FIELDS.find((item) => item.key === key && item.field === field);
}

// "#field-site.contact.whatsapp" -> field terdaftar, atau null.
export function parseSettingHash(hash: string): SettingField | null {
  const match = /^#field-(.+)$/.exec(hash);
  if (!match) return null;
  const anchor = decodeURIComponent(match[1]);
  return SETTING_FIELDS.find((item) => settingAnchor(item.key, item.field) === anchor) ?? null;
}
