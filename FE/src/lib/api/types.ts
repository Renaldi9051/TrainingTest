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
  "training.defaults": {
    facilities: string[];
    faq: FaqItem[];
    inHouseNote: string;
    disclaimer: string;
  };
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

// ===== Pelatihan =====

export type TrainingMethod = "ONLINE" | "OFFLINE" | "HYBRID";
export type TrainingType = "PUBLIC" | "IN_HOUSE";
export type ContentStatus = "DRAFT" | "PUBLISHED";
// SCHEDULED = PUBLISHED dengan waktu publish di masa depan.
export type TrainingPublicState = "DRAFT" | "SCHEDULED" | "PUBLISHED";

export type TrainingCategoryRef = { id: string; slug: string; name: string };

export type TrainingSeo = { title: string; description: string; ogImageId: string | null };

export type TrainingListItem = {
  id: string;
  slug: string;
  title: string;
  status: ContentStatus;
  publicState: TrainingPublicState;
  publishedAt: string | null;
  method: TrainingMethod | null;
  types: TrainingType[];
  categories: TrainingCategoryRef[];
  cover: Media | null;
  scheduleCount: number;
  updatedAt: string;
};

export type TrainingModule = { title: string; points: string[]; durationMinutes: number | null };
export type AudienceItem = { role: string; note: string | null };
export type FaqItem = { q: string; a: string };

export type Training = TrainingListItem & {
  summary: string | null;
  description: RichTextDoc | null;
  outcomes: string[];
  modules: TrainingModule[];
  audience: AudienceItem[];
  prerequisites: string | null;
  // null = pakai fasilitas default global (Pengaturan > Pelatihan).
  facilities: string[] | null;
  faq: FaqItem[];
  duration: string | null;
  priceText: string | null;
  showPrice: boolean;
  coverId: string | null;
  seo: TrainingSeo;
  ogImage: Media | null;
  createdAt: string;
};

export type TrainingBulkResult = {
  affected: number;
  // Publish massal: pelatihan yang kontennya belum lengkap dilewati.
  skipped: { id: string; title: string; reason: string }[];
};

export type TrainingBulkAction =
  | { action: "publish" | "unpublish" | "delete"; ids: string[] }
  | { action: "set-category"; ids: string[]; categoryId: string };

export type PublicCategoryRef = { slug: string; name: string };

export type PublicTrainingCard = {
  slug: string;
  title: string;
  summary: string | null;
  duration: string | null;
  method: TrainingMethod | null;
  types: TrainingType[];
  cover: PublicImage | null;
  categories: PublicCategoryRef[];
  publishedAt: string;
};

export type ScheduleStatus = "OPEN" | "FULL" | "COMPLETED";

export type PublicTrainingSchedule = {
  id: string;
  startDate: string;
  endDate: string;
  city: string | null;
  venue: string | null;
  method: TrainingMethod;
  // null = harga disembunyikan (showPrice false) atau belum diisi.
  price: number | null;
  status: ScheduleStatus;
};

// null = "Hubungi marketing".
export type PublicInvestment = { type: "from"; amount: number } | { type: "text"; text: string } | null;

export type PublicTrainingDetail = PublicTrainingCard & {
  descriptionHtml: string | null;
  outcomes: string[];
  modules: TrainingModule[];
  audience: AudienceItem[];
  prerequisites: string | null;
  // Sudah di-resolve BE (fasilitas pelatihan atau default global).
  facilities: string[];
  // FAQ pelatihan lalu FAQ global.
  faq: FaqItem[];
  inHouseNote: string | null;
  disclaimer: string | null;
  showPrice: boolean;
  priceText: string | null;
  investment: PublicInvestment;
  // null = "Jadwal menyesuaikan".
  nextSchedule: Pick<PublicTrainingSchedule, "startDate" | "endDate" | "city" | "method"> | null;
  seo: { title: string; description: string; ogImage: PublicImage | null };
  schedules: PublicTrainingSchedule[];
  related: PublicTrainingCard[];
  updatedAt: string;
};

export type PublicCatalogMeta = PaginationMeta & { q: string | null };

// ===== Jadwal =====

export type Schedule = {
  id: string;
  training: { id: string; slug: string; title: string };
  startDate: string;
  endDate: string;
  city: string | null;
  venue: string | null;
  method: TrainingMethod;
  price: number | null;
  status: ScheduleStatus;
  // Status yang tampil di publik (SELESAI otomatis kalau tanggal selesai sudah lewat).
  displayStatus: ScheduleStatus;
  updatedAt: string;
};

export type ScheduleImportRow = {
  line: number;
  values: Record<
    "training_slug" | "start_date" | "end_date" | "city" | "venue" | "method" | "price" | "status",
    string
  >;
  errors: string[];
  data: {
    trainingId: string;
    trainingTitle: string;
    startDate: string;
    endDate: string;
    city: string | null;
    venue: string | null;
    method: TrainingMethod;
    price: number | null;
    status: ScheduleStatus;
  } | null;
};

export type ScheduleImportResult = {
  rows: ScheduleImportRow[];
  validCount: number;
  invalidCount: number;
  created: number;
};

export type PublicSchedule = {
  id: string;
  training: { slug: string; title: string; categories: PublicCategoryRef[] };
  startDate: string;
  endDate: string;
  city: string | null;
  venue: string | null;
  method: TrainingMethod;
  // null kalau showPrice false: tampil "Hubungi marketing".
  price: number | null;
  showPrice: boolean;
  status: ScheduleStatus;
};

export type PublicScheduleMeta = PaginationMeta & {
  cities: string[];
  month: string | null;
  upcomingOnly: boolean;
};
