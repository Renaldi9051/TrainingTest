import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

// Format respons API: sukses { data, meta? }, gagal { error: { code, message, fields?, details? } }.

export type FieldErrors = Record<string, string[]>;

export function ok<TData, TMeta = undefined>(data: TData, meta?: TMeta, status = 200) {
  return NextResponse.json(meta === undefined ? { data } : { data, meta }, { status });
}

export function fail(
  status: number,
  code: string,
  message: string,
  fields?: FieldErrors,
  details?: unknown,
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(fields ? { fields } : {}),
        ...(details === undefined ? {} : { details }),
      },
    },
    { status },
  );
}

// Dilempar dari service/helper, diubah jadi respons error standar oleh `route()`.
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: FieldErrors,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function zodFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "_";
    (fields[key] ??= []).push(issue.message);
  }
  return fields;
}

export function toErrorResponse(error: unknown) {
  if (error instanceof HttpError) {
    return fail(error.status, error.code, error.message, error.fields, error.details);
  }
  if (error instanceof z.ZodError) {
    return fail(422, "VALIDATION_ERROR", "Data tidak valid.", zodFieldErrors(error));
  }
  console.error("Kesalahan tak terduga di route handler", error);
  return fail(500, "INTERNAL_ERROR", "Terjadi kesalahan di server. Coba lagi.");
}

// Membungkus route handler: semua error yang dilempar jadi respons error standar.
export function route<TContext>(
  handler: (request: NextRequest, context: TContext) => Promise<Response>,
) {
  return async (request: NextRequest, context: TContext): Promise<Response> => {
    try {
      return await handler(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Body request harus JSON yang valid.");
  }
}

// Body JSON opsional: body kosong = undefined (mis. POST /:id/restore tanpa slug baru).
export async function readOptionalJson(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.trim() === "") return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new HttpError(400, "INVALID_JSON", "Body request harus JSON yang valid.");
  }
}
