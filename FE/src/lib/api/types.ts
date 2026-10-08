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
