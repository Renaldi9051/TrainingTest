import { z } from "zod";

// Parser query list admin yang sama untuk semua modul:
// ?page=&pageSize=&q=&sort=&status= ditambah filter per modul.
// Hasil list: { data, meta: { page, pageSize, total, totalPages } }.

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

export type SortDirection = "asc" | "desc";
export type ListSort<TField extends string> = { field: TField; direction: SortDirection };

export type ListMeta = { page: number; pageSize: number; total: number; totalPages: number };

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => value || undefined);

// sort: "title" (naik) atau "-updatedAt" (turun). Hanya field di whitelist modul yang diterima.
export function sortSchema<const TField extends string>(fields: readonly TField[], fallback: string) {
  return z
    .string()
    .trim()
    .default(fallback)
    .transform((value, ctx): ListSort<TField> => {
      const direction: SortDirection = value.startsWith("-") ? "desc" : "asc";
      const field = value.replace(/^-/, "");
      if (!(fields as readonly string[]).includes(field)) {
        ctx.addIssue({
          code: "custom",
          message: `Urutan tidak dikenal. Pilihan: ${fields.join(", ")}.`,
        });
        return z.NEVER;
      }
      return { field: field as TField, direction };
    });
}

export const baseListQueryShape = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  q: optionalText(100),
};

export const contentStatusFilter = z.enum(["DRAFT", "PUBLISHED"]).optional();

// Skema list per modul: field dasar + sort dengan whitelist + filter tambahan.
export function listQuerySchema<const TField extends string, TExtra extends z.ZodRawShape>(options: {
  sortFields: readonly TField[];
  defaultSort: string;
  extra: TExtra;
}) {
  return z.object({
    ...baseListQueryShape,
    sort: sortSchema(options.sortFields, options.defaultSort),
    ...options.extra,
  });
}

export function parseSearchParams<T extends z.ZodType>(schema: T, params: URLSearchParams): z.infer<T> {
  return schema.parse(Object.fromEntries(params));
}

// Parameter multi-nilai dari query string, dipisah koma: "a,b" -> ["a", "b"].
export function csvParam(max = 50) {
  return z
    .string()
    .optional()
    .transform((value) =>
      value
        ? [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, max)
        : [],
    );
}

export function pagination(page: number, pageSize: number) {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function listMeta(page: number, pageSize: number, total: number): ListMeta {
  return { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}
