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
