import type { ApiErrorBody, ApiFieldErrors, ApiSuccess } from "./types";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: ApiFieldErrors,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function isApiErrorBody(body: unknown): body is ApiErrorBody {
  if (typeof body !== "object" || body === null || !("error" in body)) return false;
  const { error } = body;
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string" &&
    "message" in error &&
    typeof error.message === "string"
  );
}

// Fetch ke BE lewat rewrite /api (satu origin). Dipakai dari browser.
export async function apiFetch<TData, TMeta = undefined>(
  path: string,
  init?: RequestInit,
): Promise<ApiSuccess<TData, TMeta>> {
  const headers = new Headers(init?.headers);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  const url = `/api${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, { ...init, headers });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (isApiErrorBody(body)) {
      throw new ApiError(
        response.status,
        body.error.code,
        body.error.message,
        body.error.fields,
        body.error.details,
      );
    }
    throw new ApiError(response.status, "UNKNOWN_ERROR", "Terjadi kesalahan. Coba lagi.");
  }

  // Bentuk body belum divalidasi runtime; dipercaya sesuai kontrak di types.ts.
  return body as ApiSuccess<TData, TMeta>;
}

// Mutasi JSON (POST/PATCH/PUT/DELETE). Browser mengirim header Origin otomatis (dicek BE).
export function apiSend<TData>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
): Promise<ApiSuccess<TData>> {
  return apiFetch<TData>(path, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
}

// Pesan untuk toast dari error apa pun.
export function errorMessage(error: unknown, fallback = "Terjadi kesalahan. Coba lagi."): string {
  return error instanceof ApiError ? error.message : fallback;
}
