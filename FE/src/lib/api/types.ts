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
  lastLoginAt: string | null;
};

export type AuthUserResponse = { user: AuthUser };

// ===== Search publik =====

// GET /api/public/search?q= (BE/src/services/public-search.ts). Hanya konten yang tampil publik;
// grup kosong tidak dikirim. Pelatihan maks 6, kategori & layanan maks 4.
export type PublicSearchGroup = "trainings" | "categories" | "services";

export type PublicSearchItem = {
  slug: string;
  title: string;
  // Pelatihan: kategori utama; layanan: ringkasan; kategori: null.
  meta: string | null;
  // Khusus kategori: jumlah pelatihan yang tampil publik.
  trainingCount?: number;
};

export type PublicSearchResult = {
  q: string;
  groups: { group: PublicSearchGroup; items: PublicSearchItem[] }[];
};

// ===== Search global admin =====

// GET /api/admin/search?q= (BE/src/services/admin-search.ts). Grup kosong tidak dikirim, maks 5 item.
export type AdminSearchGroup =
  | "trainings"
  | "categories"
  | "services"
  | "pages"
  | "home"
  | "portfolio"
  | "clients"
  | "testimonials"
  | "marketing"
  | "mediaPartners"
  | "media"
  | "navigation"
  | "settings";

export type AdminSearchItem = {
  id: string;
  title: string;
  meta: string | null;
  status: "DRAFT" | "PUBLISHED" | null;
  // Khusus pengaturan: id = key (mis. "site.contact"), field = properti di dalamnya (mis. "whatsapp").
  field?: string;
};

export type AdminSearchResult = {
  q: string;
  groups: { group: AdminSearchGroup; items: AdminSearchItem[] }[];
};

// ===== Dashboard =====

// GET /api/admin/dashboard (BE/src/services/dashboard.ts).
export type TrainingIssue = "no-cover" | "cover-no-alt" | "stale-draft" | "no-summary";
// ===== Inquiry (BE/src/services/inquiry.ts) =====

export type InquiryStatus = "NEW" | "IN_PROGRESS" | "DONE";
export type InquirySource = "TRAINING_DETAIL" | "CONTACT";

export type Inquiry = {
  id: string;
  name: string;
  company: string | null;
  email: string;
  // Format wa.me (62xxxxxxxxxx) atau null.
  phone: string | null;
  training: { id: string; slug: string; title: string } | null;
  interest: string | null;
  message: string | null;
  source: InquirySource;
  consentAt: string | null;
  consentVersion: string | null;
  status: InquiryStatus;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

// POST /api/public/inquiries (lihat BE/src/lib/validators/inquiry.ts).
export type InquiryInput = {
  name: string;
  company: string;
  email: string;
  phone: string;
  trainingSlug: string | null;
  interest: string;
  message: string;
  source: InquirySource;
  consent: boolean;
  // Honeypot: selalu kosong dari manusia.
  website: string;
};

export type AttentionKey =
  | "trainingNoCover"
  | "trainingCoverNoAlt"
  | "staleDraft"
  | "publishedNoSummary"
  | "pastOpenSchedule"
  | "serviceNoImage";
export type Dashboard = {
  counts: {
    trainings: { published: number; scheduled: number; draft: number };
    categories: number;
    schedules: { thisMonth: number; next30Days: number; fullUpcoming: number };
    publicWithoutUpcoming: number;
  };
  attention: { key: AttentionKey; count: number; items: { id: string; title: string; detail?: string }[] }[];
  activity: {
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    userName: string | null;
    createdAt: string;
    linkable: boolean;
  }[];
  inquiries: { new: number; lastWeek: number; latest: { id: string; name: string; training: string | null; createdAt: string }[] };
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
    | "Category"
    | "Service"
    | "Client"
    | "Testimonial"
    | "MarketingContact"
    | "PortfolioItem"
    | "SiteSetting"
    | "HomeSection"
    | "Page";
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

// Kepala halaman daftar (BE/src/lib/validators/settings.ts). Kosong per field = label lama.
export type PageHeaderPage = "pelatihan" | "layanan" | "portofolio" | "jadwal" | "kontak";
export type PageHeader = { eyebrow: string; heading: string; lead: string };
export type ServicesProcess = { eyebrow: string; heading: string; steps: { title: string; description: string }[] };

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
    emailSecondary: string;
    whatsapp: string;
    address: string;
    mapEmbedUrl: string;
    // Kosong / null = tidak tampil.
    openingHours: string;
    latitude: number | null;
    longitude: number | null;
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
  "page.headers": Record<PageHeaderPage, PageHeader>;
  "services.process": ServicesProcess;
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
  pageHeaders: SettingValues["page.headers"];
  servicesProcess: ServicesProcess;
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
  imageId: string | null;
  image: Media | null;
  // Kata kunci judul untuk panel "Pelatihan yang cocok" (tidak menautkan otomatis).
  keywords: string[];
  // Admin: pelatihan aktif = belum dihapus (draft + published).
  trainingCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CategoryOption = { id: string; slug: string; name: string };

// details pada error CATEGORY_IN_USE (409).
export type CategoryInUseDetails = { trainingCount: number };

// GET /admin/categories/:id/keyword-matches
export type KeywordMatch = {
  id: string;
  slug: string;
  title: string;
  publicState: TrainingPublicState;
  categories: { id: string; name: string }[];
};

export type KeywordMatches = {
  keywords: string[];
  // Belum tertaut, paling banyak 200; total = semua yang belum tertaut.
  items: KeywordMatch[];
  total: number;
  linkedCount: number;
};

// POST /admin/categories/:id/merge
export type CategoryMergeResult = { target: Category; movedTrainings: number };

export type PublicCategory = {
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  featured: boolean;
  // Foto landing kategori; null kalau kosong.
  image: PublicImage | null;
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
// null = belum diisi admin (label tingkat tidak ditampilkan).
export type TrainingLevel = "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
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

// day: nomor hari silabus (HARI 01); null = modul tanpa pembagian hari.
export type TrainingModule = { title: string; points: string[]; durationMinutes: number | null; day: number | null };
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
  level: TrainingLevel | null;
  certificate: boolean | null;
  priceText: string | null;
  showPrice: boolean;
  coverId: string | null;
  // Galeri foto kegiatan (maks 6), terpisah dari sampul.
  imageIds: string[];
  images: Media[];
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
  level: TrainingLevel | null;
  // Sampul pelatihan, atau gambar kategori pertama yang punya gambar (lihat coverSource).
  cover: PublicImage | null;
  coverSource: CoverSource;
  categories: PublicCategoryRef[];
  publishedAt: string;
};

export type CoverSource = "training" | "category" | null;

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
  // null = belum diisi admin (fakta "Sertifikat" tidak ditampilkan).
  certificate: boolean | null;
  showPrice: boolean;
  priceText: string | null;
  investment: PublicInvestment;
  // null = "Jadwal menyesuaikan".
  nextSchedule: Pick<PublicTrainingSchedule, "startDate" | "endDate" | "city" | "method"> | null;
  seo: { title: string; description: string; ogImage: PublicImage | null };
  // Galeri foto kegiatan; kosong = blok disembunyikan.
  images: PublicImage[];
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

// ===== Pilihan (picker & panel urutkan) =====

// GET /api/admin/{resource}/options?q=&limit=&ids=
export type OptionItem = {
  id: string;
  label: string;
  sublabel: string | null;
  imageUrl: string | null;
};

// ===== Layanan =====

export type ServiceListItem = {
  id: string;
  slug: string;
  title: string;
  tagline: string | null;
  icon: string | null;
  summary: string | null;
  image: Media | null;
  order: number;
  status: ContentStatus;
  updatedAt: string;
};

export type ServiceBenefit = { icon: string | null; title: string; description: string };
export type ServiceFaq = { q: string; a: string };
// Pelatihan terkait (manual, urutan dijaga). null = section disembunyikan.
export type ServiceTrainingSelection = { mode: "manual"; ids: string[] } | null;

export type Service = ServiceListItem & {
  body: RichTextDoc | null;
  imageId: string | null;
  benefits: ServiceBenefit[];
  faqs: ServiceFaq[];
  trainingSelection: ServiceTrainingSelection;
  seo: TrainingSeo;
  ogImage: Media | null;
  createdAt: string;
};

export type PublicServiceCard = {
  slug: string;
  title: string;
  tagline: string | null;
  icon: string | null;
  summary: string | null;
  image: PublicImage | null;
};

export type PublicServiceDetail = PublicServiceCard & {
  bodyHtml: string | null;
  benefits: ServiceBenefit[];
  faqs: ServiceFaq[];
  trainings: PublicTrainingCard[];
  seo: { title: string; description: string; ogImage: PublicImage | null };
  updatedAt: string;
};

// ===== Klien, testimoni, portofolio, kontak marketing, media partner =====

export type Client = {
  id: string;
  name: string;
  url: string | null;
  logoId: string | null;
  logo: Media | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicClient = { name: string; url: string | null; logo: PublicImage | null };

export type Testimonial = {
  id: string;
  name: string;
  role: string | null;
  company: string | null;
  quote: string;
  photoId: string | null;
  photo: Media | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicTestimonial = {
  name: string;
  role: string | null;
  company: string | null;
  quote: string;
  photo: PublicImage | null;
};

// Jenis kegiatan portofolio (chip filter ?jenis=). null = belum diisi.
export type PortfolioActivityType = "FIELD" | "CLASSROOM" | "CERTIFICATION" | "OUTBOUND";

export type PortfolioItem = {
  id: string;
  title: string;
  activityType: PortfolioActivityType | null;
  // "YYYY-MM-DD"
  date: string | null;
  client: string | null;
  description: string | null;
  imageIds: string[];
  images: Media[];
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicPortfolioItem = {
  title: string;
  activityType: PortfolioActivityType | null;
  date: string | null;
  client: string | null;
  description: string | null;
  images: PublicImage[];
};

export type MarketingContact = {
  id: string;
  name: string;
  area: string | null;
  // Format wa.me (62...).
  phone: string;
  defaultMessage: string | null;
  photoId: string | null;
  photo: Media | null;
  active: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicMarketingContact = {
  name: string;
  area: string | null;
  phone: string;
  whatsappUrl: string | null;
  defaultMessage: string | null;
  photo: PublicImage | null;
};

export type MediaPartner = {
  id: string;
  name: string;
  url: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
};

export type PublicMediaPartner = { name: string; url: string | null };

// ===== Halaman (blok konten) =====

export type PageKind = "STANDARD" | "PROFILE";
export type SelectionMode = "auto" | "manual";
export type MediaRef = { mediaId: string };

type BlockHeading = { eyebrow: string; heading: string };

// Bentuk blok sama dengan BE (BE/src/lib/validators/page-blocks.ts). Di state editor, gambar/file
// boleh null sebelum dipilih dan rich text boleh null; validasi form menolaknya saat simpan.
export type PageBlock =
  | ({ id: string; type: "RICH_TEXT"; body: RichTextDoc | null } & BlockHeading)
  | { id: string; type: "VISION_MISSION"; eyebrow: string; vision: string; mission: string[]; motto: string }
  | ({
      id: string;
      type: "FEATURES";
      items: { title: string; description: string; icon: string | null }[];
    } & BlockHeading)
  | ({ id: string; type: "LIST"; style: "bullet" | "chips"; items: string[] } & BlockHeading)
  | ({ id: string; type: "SERVICES"; intro: string; mode: SelectionMode; limit: number; ids: string[] } & BlockHeading)
  | { id: string; type: "IMAGE"; image: MediaRef | null; caption: string }
  | ({ id: string; type: "DOWNLOAD"; description: string; label: string; file: MediaRef | null } & BlockHeading)
  | ({
      id: string;
      type: "PAYMENT_ACCOUNTS";
      intro: string;
      accounts: PaymentAccount<MediaRef>[];
      confirm: { label: string; href: string } | null;
    } & BlockHeading);

export type PageBlockType = PageBlock["type"];

// Rekening tujuan transfer. Nomor: angka dengan spasi/strip pemisah (divalidasi BE).
export type PaymentAccount<Logo> = { bank: string; number: string; holder: string; note: string; logo: Logo | null };

export type PageListItem = {
  id: string;
  kind: PageKind;
  slug: string;
  title: string;
  status: ContentStatus;
  blockCount: number;
  updatedAt: string;
};

export type Page = PageListItem & {
  blocks: PageBlock[];
  seo: TrainingSeo;
  ogImage: Media | null;
  // Media yang dirujuk blok, untuk pratinjau di editor.
  media: Record<string, Media>;
  publishedAt: string | null;
  createdAt: string;
};

export type PublicPageBlock =
  | ({ id: string; type: "RICH_TEXT"; bodyHtml: string } & BlockHeading)
  | { id: string; type: "VISION_MISSION"; eyebrow: string; vision: string; mission: string[]; motto: string }
  | ({
      id: string;
      type: "FEATURES";
      items: { title: string; description: string; icon: string | null }[];
    } & BlockHeading)
  | ({ id: string; type: "LIST"; style: "bullet" | "chips"; items: string[] } & BlockHeading)
  | ({ id: string; type: "SERVICES"; intro: string; items: PublicServiceCard[] } & BlockHeading)
  | { id: string; type: "IMAGE"; image: PublicImage; caption: string }
  | ({
      id: string;
      type: "DOWNLOAD";
      description: string;
      label: string;
      file: { url: string; size: number; mime: string };
    } & BlockHeading)
  | ({
      id: string;
      type: "PAYMENT_ACCOUNTS";
      intro: string;
      accounts: PaymentAccount<PublicImage>[];
      confirm: { label: string; href: string } | null;
    } & BlockHeading);

export type PublicPage = {
  kind: PageKind;
  slug: string;
  title: string;
  blocks: PublicPageBlock[];
  seo: { title: string; description: string; ogImage: PublicImage | null };
  updatedAt: string;
};

export type PublicPageRef = { slug: string; title: string };

// ===== Beranda (section) =====

export type HomeSectionType =
  | "HERO"
  | "STATS"
  | "SERVICES"
  | "CATEGORIES"
  | "LATEST_TRAININGS"
  | "UPCOMING_SCHEDULES"
  | "CLIENTS"
  | "VISION_MISSION"
  | "TESTIMONIALS"
  | "CTA"
  | "MARQUEE";

export type Cta = { label: string; href: string };
type SectionHeading = { eyebrow: string; heading: string };
type SelectionConfig = { mode: SelectionMode; limit: number; ids: string[] };
// Elemen dekoratif per section (DESIGN.md 6.2), default menyala.
type Decor = { decor: boolean };

export type HeroLayout = "fullbleed" | "split";
export type HeroPhotoStyle = "color" | "grayscale";

// Satu slide hero tersimpan. alt "" = memakai alt media; href "" = tanpa tautan.
export type HeroSlide = {
  mediaId: string;
  alt: string;
  caption: string;
  href: string;
  hudLabel: string;
  focalX: number;
  focalY: number;
};

// Slide hero di respons publik (GET /api/public/home).
export type PublicHeroSlide = {
  image: PublicImage;
  alt: string;
  caption: string;
  href: string | null;
  hudLabel: string;
  focalX: number;
  focalY: number;
};

// Isi section per type, sama dengan BE (BE/src/lib/validators/home-section.ts).
export type HomeSectionContentMap = {
  HERO: {
    eyebrow: string;
    headline: string;
    rotatingWords: string[];
    subheadline: string;
    showSearch: boolean;
    searchPlaceholder: string;
    primaryCta: Cta | null;
    secondaryCta: Cta | null;
    layout: HeroLayout;
    // 4000-10000 ms.
    intervalMs: number;
    photoStyle: HeroPhotoStyle;
    showViewfinder: boolean;
    showBadge: boolean;
    badgeText: string;
    badgeHref: string;
    // 0-6 slide; 0 = hero teks, 1 = foto statis, 2+ = slideshow.
    slides: HeroSlide[];
  } & Decor;
  STATS: SectionHeading & Decor & { items: { value: number; prefix: string; suffix: string; label: string }[] };
  SERVICES: SectionHeading & SelectionConfig & Decor & { intro: string; cta: Cta | null };
  CATEGORIES: SectionHeading & SelectionConfig & Decor & { intro: string; cta: Cta | null };
  LATEST_TRAININGS: SectionHeading & SelectionConfig & Decor & { intro: string; cta: Cta | null };
  UPCOMING_SCHEDULES: SectionHeading & Decor & { intro: string; limit: number; cta: Cta | null };
  CLIENTS: SectionHeading & SelectionConfig & Decor & { intro: string };
  VISION_MISSION: Decor & { eyebrow: string; vision: string; mission: string[]; motto: string };
  // Tanpa judul (keputusan pemilik, 29 Okt 2026).
  TESTIMONIALS: SelectionConfig & Decor & { eyebrow: string; intro: string };
  CTA: Decor & { eyebrow: string; heading: string; body: string; primaryCta: Cta; secondaryCta: Cta | null };
  // Teks berjalan: heading hanya untuk pembaca layar; source services = judul layanan tayang.
  MARQUEE: Decor & { heading: string; source: "custom" | "services"; items: string[]; limit: number };
};

export type HomeSection = {
  id: string;
  type: HomeSectionType;
  // Label internal di builder (tidak tampil di publik).
  title: string | null;
  visible: boolean;
  order: number;
  // null kalau isi tersimpan sudah tidak lolos skema dan perlu diisi ulang.
  content: HomeSectionContentMap[HomeSectionType] | null;
  media: Record<string, Media>;
  createdAt: string;
  updatedAt: string;
};

type Omit3<T> = Omit<T, "mode" | "limit" | "ids">;
type PublicBase<K extends HomeSectionType> = { id: string; type: K };

export type PublicHomeSection =
  | (PublicBase<"HERO"> & Omit<HomeSectionContentMap["HERO"], "slides"> & { slides: PublicHeroSlide[] })
  | (PublicBase<"LATEST_TRAININGS"> & Omit3<HomeSectionContentMap["LATEST_TRAININGS"]> & { items: PublicTrainingCard[] })
  | (PublicBase<"UPCOMING_SCHEDULES"> & Omit<HomeSectionContentMap["UPCOMING_SCHEDULES"], "limit"> & { items: PublicSchedule[] })
  | (PublicBase<"CLIENTS"> & Omit3<HomeSectionContentMap["CLIENTS"]> & { items: PublicClient[] })
  | (PublicBase<"VISION_MISSION"> & HomeSectionContentMap["VISION_MISSION"])
  | (PublicBase<"TESTIMONIALS"> & Omit3<HomeSectionContentMap["TESTIMONIALS"]> & { items: PublicTestimonial[] })
  | (PublicBase<"CTA"> & HomeSectionContentMap["CTA"]);

export type PublicHome = { sections: PublicHomeSection[] };

// GET /api/admin/home-sections/preview: termasuk section tersembunyi dan kosong.
export type PreviewHomeSection = PublicHomeSection & { visible: boolean; empty: boolean };
export type HomePreview = { sections: PreviewHomeSection[] };
