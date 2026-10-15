import { z } from "zod";
import {
  hrefSchema,
  httpUrlSchema,
  mediaRefSchema,
  optionalWhatsappSchema,
  plainText,
  requiredText,
} from "@/lib/validators/common";
import { facilitiesListSchema, faqSchema } from "@/lib/validators/training-content";

// SiteSetting: satu baris per key, value JSON yang divalidasi skema per key di bawah.
// Semua referensi gambar disimpan sebagai mediaId (lihat SETTING_MEDIA_FIELDS).

// ===== Peta embed =====

// Hanya URL embed peta dari domain tepercaya. HTML iframe mentah tidak pernah disimpan;
// FE membuat <iframe src> sendiri dari URL ini.
const MAP_EMBED_RULES: { host: string; pathPrefix: string }[] = [
  { host: "www.google.com", pathPrefix: "/maps/embed" },
  { host: "maps.google.com", pathPrefix: "/maps" },
  { host: "www.openstreetmap.org", pathPrefix: "/export/embed.html" },
];

export const MAP_EMBED_ERROR =
  "Gunakan URL embed dari Google Maps (https://www.google.com/maps/embed?...) atau OpenStreetMap. Tempel URL-nya saja, bukan kode <iframe>.";

export function isAllowedMapEmbedUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || url.port) return false;
  if (url.host === "maps.google.com" && url.searchParams.get("output") !== "embed") return false;
  return MAP_EMBED_RULES.some(
    (rule) => url.host === rule.host && url.pathname.startsWith(rule.pathPrefix),
  );
}

const mapEmbedUrlSchema = z
  .string()
  .trim()
  .max(2000, { error: "URL peta terlalu panjang." })
  .refine((value) => value === "" || isAllowedMapEmbedUrl(value), { error: MAP_EMBED_ERROR })
  .default("");

// ===== Telepon & email =====

const phoneSchema = z
  .string()
  .trim()
  .max(30, { error: "Nomor telepon maksimal 30 karakter." })
  .refine((value) => value === "" || /^[+\d][\d\s().-]*$/.test(value), {
    error: "Nomor telepon hanya boleh berisi angka, spasi, +, -, dan tanda kurung.",
  })
  .default("");

const emailSchema = z
  .string()
  .trim()
  .max(200)
  .refine((value) => value === "" || z.email().safeParse(value).success, {
    error: "Format email tidak valid.",
  })
  .default("");

// ===== Skema per key =====

export const SOCIAL_PLATFORMS = [
  "instagram",
  "facebook",
  "linkedin",
  "youtube",
  "tiktok",
  "x",
  "other",
] as const;

const optionalHref = z
  .string()
  .trim()
  .default("")
  .pipe(z.union([z.literal(""), hrefSchema]));

// Kepala halaman daftar (eyebrow, h1, lead). Kosong = label lama di FE (aturan konten 5).
export const PAGE_HEADER_PAGES = ["pelatihan", "layanan", "portofolio", "jadwal", "kontak"] as const;
export type PageHeaderPage = (typeof PAGE_HEADER_PAGES)[number];
const pageHeaderSchema = z.object({
  eyebrow: plainText("Eyebrow", 60),
  heading: plainText("Judul", 120),
  lead: plainText("Pengantar", 300),
});
const EMPTY_PAGE_HEADER = { eyebrow: "", heading: "", lead: "" };
const pageHeadersSchema = z.object(
  Object.fromEntries(PAGE_HEADER_PAGES.map((page) => [page, pageHeaderSchema.default(EMPTY_PAGE_HEADER)])) as Record<
    PageHeaderPage,
    z.ZodDefault<typeof pageHeaderSchema>
  >,
);

// Alur kerja sama di /layanan. Tanpa langkah = section disembunyikan.
export const PROCESS_STEPS_MAX = 6;

export const settingSchemas = {
  "site.identity": z.object({
    name: z
      .string()
      .trim()
      .min(1, { error: "Nama situs wajib diisi." })
      .max(100, { error: "Nama situs maksimal 100 karakter." }),
    tagline: plainText("Tagline", 200),
    logoLightId: mediaRefSchema,
    logoDarkId: mediaRefSchema,
    faviconId: mediaRefSchema,
  }),
  "site.header": z
    .object({
      ctaLabel: plainText("Label tombol", 40),
      ctaHref: optionalHref,
    })
    .refine((value) => (value.ctaLabel === "") === (value.ctaHref === ""), {
      error: "Isi label dan tautan tombol sekaligus, atau kosongkan keduanya.",
      path: ["ctaHref"],
    }),
  "site.contact": z.object({
    phone: phoneSchema,
    email: emailSchema,
    // Email kedua (mis. pendaftaran/keuangan); opsional.
    emailSecondary: emailSchema,
    whatsapp: optionalWhatsappSchema,
    address: plainText("Alamat", 500),
    mapEmbedUrl: mapEmbedUrlSchema,
  }),
  "site.social": z.object({
    links: z
      .array(
        z.object({
          platform: z.enum(SOCIAL_PLATFORMS, { error: "Platform tidak dikenal." }),
          label: plainText("Label", 40),
          url: httpUrlSchema,
        }),
      )
      .max(12, { error: "Maksimal 12 tautan sosial media." })
      .default([]),
  }),
  "site.footer": z.object({
    description: plainText("Deskripsi footer", 500),
    copyright: plainText("Teks hak cipta", 200),
  }),
  // Default untuk semua halaman detail pelatihan.
  "training.defaults": z.object({
    facilities: facilitiesListSchema.default([]),
    faq: faqSchema.default([]),
    inHouseNote: plainText("Catatan in-house", 500),
    disclaimer: plainText("Disclaimer", 500),
  }),
  "seo.default": z.object({
    titleTemplate: z
      .string()
      .trim()
      .max(100, { error: "Template judul maksimal 100 karakter." })
      .refine((value) => value.includes("%s"), {
        error: "Template judul wajib berisi %s sebagai tempat judul halaman.",
      })
      .default("%s"),
    defaultTitle: plainText("Judul default", 70),
    description: plainText("Deskripsi default", 160),
    ogImageId: mediaRefSchema,
  }),
  "page.headers": pageHeadersSchema,
  "services.process": z.object({
    eyebrow: plainText("Eyebrow", 60),
    heading: plainText("Judul", 120),
    steps: z
      .array(z.object({ title: requiredText("Judul langkah", 80), description: plainText("Deskripsi langkah", 300) }))
      .max(PROCESS_STEPS_MAX, { error: `Langkah maksimal ${PROCESS_STEPS_MAX}.` })
      .default([]),
  }),
} as const;

export type SettingKey = keyof typeof settingSchemas;
export type SettingValues = { [K in SettingKey]: z.infer<(typeof settingSchemas)[K]> };

export const SETTING_KEYS = Object.keys(settingSchemas) as SettingKey[];

export const settingKeySchema = z.enum(SETTING_KEYS as [SettingKey, ...SettingKey[]], {
  error: "Kunci pengaturan tidak dikenal.",
});

export const SETTING_LABELS: Record<SettingKey, string> = {
  "site.identity": "Identitas situs",
  "site.header": "Header",
  "site.contact": "Kontak",
  "site.social": "Sosial media",
  "site.footer": "Footer",
  "training.defaults": "Default pelatihan",
  "seo.default": "SEO default",
  "page.headers": "Kepala halaman",
  "services.process": "Alur kerja sama",
};

// Field berisi mediaId per key, beserta label untuk "media dipakai di mana".
export const SETTING_MEDIA_FIELDS: Partial<Record<SettingKey, Record<string, string>>> = {
  "site.identity": { logoLightId: "Logo terang", logoDarkId: "Logo gelap", faviconId: "Favicon" },
  "seo.default": { ogImageId: "Gambar OG" },
};

// Nilai default dipakai kalau key belum ada di DB atau isinya tidak lagi valid.
export const SETTING_DEFAULTS: SettingValues = {
  "site.identity": {
    name: "Nama situs",
    tagline: "",
    logoLightId: null,
    logoDarkId: null,
    faviconId: null,
  },
  "site.header": { ctaLabel: "", ctaHref: "" },
  "site.contact": { phone: "", email: "", emailSecondary: "", whatsapp: "", address: "", mapEmbedUrl: "" },
  "site.social": { links: [] },
  "site.footer": { description: "", copyright: "" },
  "training.defaults": { facilities: [], faq: [], inHouseNote: "", disclaimer: "" },
  "seo.default": { titleTemplate: "%s", defaultTitle: "", description: "", ogImageId: null },
  "page.headers": Object.fromEntries(PAGE_HEADER_PAGES.map((page) => [page, EMPTY_PAGE_HEADER])) as SettingValues["page.headers"],
  "services.process": { eyebrow: "", heading: "", steps: [] },
};

export function parseStoredSetting<K extends SettingKey>(key: K, stored: unknown): SettingValues[K] {
  const result = settingSchemas[key].safeParse(stored ?? {});
  return (result.success ? result.data : SETTING_DEFAULTS[key]) as SettingValues[K];
}

export function settingMediaIds(key: SettingKey, value: unknown): Record<string, string | null> {
  const fields = SETTING_MEDIA_FIELDS[key];
  if (!fields || typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.keys(fields).map((field) => [
      field,
      typeof record[field] === "string" ? (record[field] as string) : null,
    ]),
  );
}
