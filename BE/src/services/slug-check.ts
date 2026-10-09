import { getDb } from "@/lib/db";
import { isSlugTaken, nextAvailableSlug, slugify, slugSchema, type SlugLookup } from "@/lib/slug";
import type { SlugCheckQuery } from "@/lib/validators/slug-check";
import { trainingSlugLookup } from "@/services/training";

export type SlugCheckResult = {
  slug: string;
  valid: boolean;
  available: boolean;
  // Saran slug yang masih kosong kalau slug diminta sudah dipakai.
  suggestion: string | null;
  message: string | null;
};

const lookups: Record<SlugCheckQuery["entity"], SlugLookup> = {
  category: (args) => getDb().category.findFirst(args),
  training: trainingSlugLookup,
};

// Validasi slug realtime di form admin. Tetap dicek ulang saat simpan (dan dijaga unique index).
export async function checkSlug(query: SlugCheckQuery): Promise<SlugCheckResult> {
  const parsed = slugSchema.safeParse(query.slug);
  if (!parsed.success) {
    return {
      slug: query.slug,
      valid: false,
      available: false,
      suggestion: slugify(query.slug) || null,
      message: parsed.error.issues[0]?.message ?? "Slug tidak valid.",
    };
  }
  const lookup = lookups[query.entity];
  const taken = await isSlugTaken(lookup, parsed.data, query.excludeId);
  return {
    slug: parsed.data,
    valid: true,
    available: !taken,
    suggestion: taken ? await nextAvailableSlug(lookup, parsed.data) : null,
    message: taken ? "Slug sudah dipakai. Ganti dengan slug lain." : null,
  };
}
