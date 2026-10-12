import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/lib/api/client";

// Error validasi BE ({ fields: { "seo.title": [...] } }) dipasang ke field form yang sama namanya.
// Mengembalikan true kalau ada field yang dipasang (toast umum tidak perlu lagi).
export function applyFieldErrors<TValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TValues>,
  knownFields: readonly string[],
): boolean {
  if (!(error instanceof ApiError) || !error.fields) return false;
  let applied = false;
  for (const [field, messages] of Object.entries(error.fields)) {
    const message = messages[0];
    if (!message) continue;
    // Path bertingkat (mis. "seo.title", "links.0.url") dipasang apa adanya kalau induknya dikenal.
    const known = knownFields.some((name) => field === name || field.startsWith(`${name}.`));
    if (!known) continue;
    setError(field as Path<TValues>, { type: "server", message }, { shouldFocus: !applied });
    applied = true;
  }
  return applied;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Index baris dari key field API untuk daftar dengan prefix tertentu, mis. prefix "blocks":
// "blocks.3.file" -> 3; prefix "content.items": "content.items.1.label" -> 1. Unik & terurut.
export function indexesFromFieldKeys(prefix: string, keys: readonly string[]): number[] {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}\\.(\\d+)(\\.|$)`);
  const indexes = keys.flatMap((key) => {
    const match = pattern.exec(key);
    return match ? [Number(match[1])] : [];
  });
  return [...new Set(indexes)].sort((a, b) => a - b);
}

// Index baris yang punya error di objek error React Hook Form untuk sebuah array (bisa berbentuk
// array jarang atau objek ber-index).
export function indexesFromFormErrors(errors: unknown): number[] {
  if (!errors || typeof errors !== "object") return [];
  return Object.keys(errors)
    .filter((key) => /^\d+$/.test(key) && (errors as Record<string, unknown>)[key])
    .map(Number)
    .sort((a, b) => a - b);
}
