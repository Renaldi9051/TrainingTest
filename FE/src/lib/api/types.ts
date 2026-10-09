// Bentuk respons BE. Kalau bentuk respons BE berubah, update file ini di perubahan yang sama.

export type ApiSuccess<TData, TMeta = undefined> = {
  data: TData;
  meta?: TMeta;
};

export type ApiFieldErrors = Record<string, string[]>;

export type ApiErrorBody = {
  error: {
    code: string;
    message: string;
    fields?: ApiFieldErrors;
    // Data tambahan per kode error, mis. daftar pemakai media untuk MEDIA_IN_USE.
    details?: unknown;
  };
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

// ===== Auth =====

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  lastLoginAt: string | null;
};

export type AuthUserResponse = { user: AuthUser };

// ===== Dashboard =====

export type DashboardStats = {
  trainings: number;
  categories: number;
  schedulesThisMonth: number;
  media: number;
};

// ===== Media =====

export type MediaVariant = { url: string; width: number; height: number };

export type Media = {
  id: string;
  // Relatif terhadap origin, mis. /uploads/2026/10/<uuid>.webp
  url: string;
  originalName: string | null;
  mime: string;
  size: number;
  width: number | null;
  height: number | null;
  alt: string | null;
  folder: string | null;
  // Kunci "320" | "768" | "1600" untuk gambar raster; null untuk SVG/PDF.
  variants: Record<string, MediaVariant> | null;
  createdAt: string;
  updatedAt: string;
};

export type MediaUsage = {
  entity:
    | "Training"
    | "Service"
    | "Client"
    | "Testimonial"
    | "MarketingContact"
    | "PortfolioItem"
    | "SiteSetting";
  entityLabel: string;
  id: string;
  label: string;
  field: string;
  inTrash: boolean;
};

export type MediaDetail = Media & { usages: MediaUsage[] };

export type MediaUploadFailure = { name: string; code: string; message: string };

export type MediaUploadResult = { created: Media[]; failed: MediaUploadFailure[] };

// details pada error MEDIA_IN_USE (409).
export type MediaInUseDetails = { usages: MediaUsage[] };

// Gambar di respons publik (tanpa metadata admin).
export type PublicImage = Pick<Media, "url" | "alt" | "width" | "height" | "mime" | "variants">;

// ===== Slug =====

export type SlugCheckResult = {
  slug: string;
  valid: boolean;
  available: boolean;
  suggestion: string | null;
  message: string | null;
};

// ===== Pengaturan situs =====

export type SocialPlatform = "instagram" | "facebook" | "linkedin" | "youtube" | "tiktok" | "x" | "other";

export type SettingValues = {
  "site.identity": {
    name: string;
    tagline: string;
    logoLightId: string | null;
    logoDarkId: string | null;
    faviconId: string | null;
  };
  "site.header": { ctaLabel: string; ctaHref: string };
  "site.contact": {
    phone: string;
    email: string;
    whatsapp: string;
    address: string;
    mapEmbedUrl: string;
  };
  "site.social": { links: { platform: SocialPlatform; label: string; url: string }[] };
  "site.footer": { description: string; copyright: string };
  "seo.default": {
    titleTemplate: string;
    defaultTitle: string;
    description: string;
    ogImageId: string | null;
  };
};

export type SettingKey = keyof SettingValues;

export type AdminSettings = { values: SettingValues; media: Record<string, Media> };

export type PublicSettings = {
  identity: {
    name: string;
    tagline: string;
    logoLight: PublicImage | null;
    logoDark: PublicImage | null;
    favicon: PublicImage | null;
  };
  header: SettingValues["site.header"];
  contact: SettingValues["site.contact"] & { whatsappUrl: string | null };
  social: SettingValues["site.social"];
  footer: SettingValues["site.footer"];
  seo: {
    titleTemplate: string;
    defaultTitle: string;
    description: string;
    ogImage: PublicImage | null;
  };
};

// ===== Navigasi =====

export type NavLocation = "HEADER" | "FOOTER";

export type NavItem = {
  id: string;
  location: NavLocation;
  label: string;
  href: string;
  parentId: string | null;
  order: number;
  children: NavItem[];
};

export type AdminNavTree = { header: NavItem[]; footer: NavItem[] };

export type PublicNavItem = { label: string; href: string; children: PublicNavItem[] };

export type PublicNav = { header: PublicNavItem[]; footer: PublicNavItem[] };

// ===== Kategori =====

export type Category = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  order: number;
  featured: boolean;
  // Admin: pelatihan yang belum dihapus (draft + published).
  trainingCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryOption = { id: string; slug: string; name: string };

// details pada error CATEGORY_IN_USE (409).
export type CategoryInUseDetails = { trainingCount: number };

export type PublicCategory = {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  featured: boolean;
  // Hanya pelatihan yang tampil publik.
  trainingCount: number;
};

// ===== Rich text (JSON Tiptap, allowlist sama dengan BE/src/lib/rich-text.ts) =====

export type RichTextMark = { type: string; attrs?: Record<string, unknown> };

export type RichTextNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
  marks?: RichTextMark[];
  text?: string;
};

export type RichTextDoc = { type: "doc"; content: RichTextNode[] };
