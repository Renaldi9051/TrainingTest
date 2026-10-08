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
  entity: "Training" | "Service" | "Client" | "Testimonial" | "MarketingContact" | "PortfolioItem";
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
