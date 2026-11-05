import { getDb } from "@/lib/db";
import { HttpError } from "@/lib/http";
import { CATEGORY_AUDIENCE_MAX } from "@/lib/validators/category";
import { readAudience } from "@/lib/validators/training-content";
import { publicTrainingWhere } from "@/services/training-visibility";

// Fitur "Ambil dari pelatihan": merangkum target peserta (role) dari semua pelatihan tayang di
// sebuah kategori menjadi daftar peran unik beserta jumlah pelatihan yang menyebutnya. Read-only:
// endpoint hanya memberi saran; admin merapikan lalu menyimpan lewat PATCH kategori biasa.

export type AudienceSuggestion = {
  // Label yang ditampilkan (varian paling sering muncul apa adanya).
  label: string;
  // Berapa pelatihan (bukan berapa kemunculan) yang menyebut peran ini.
  trainingCount: number;
};

export type AudienceSuggestions = {
  // Jumlah pelatihan tayang di kategori yang punya minimal satu target peserta.
  trainingsConsidered: number;
  suggestions: AudienceSuggestion[];
};

// Pemisah antar peran dalam satu baris role: baris baru, koma, titik koma, garis miring.
// " dan " dan "&" TIDAK dipakai sebagai pemisah: keduanya lazim di dalam satu frasa peran utuh
// (mis. "Staf administrasi dan tata usaha", "Sekretaris & asisten pimpinan").
const SPLIT_PATTERN = /\s*(?:\r?\n|,|;|\/)\s*/gu;

// Pecah satu string role menjadi beberapa peran berdasarkan pemisah daftar eksplisit. note tidak
// ikut dipecah (dipakai sebagai konteks terpisah dan tidak masuk agregasi).
export function splitRoles(role: string): string[] {
  return role
    .split(SPLIT_PATTERN)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

// Kunci untuk membandingkan dua peran: lowercase id-ID, rapikan spasi, buang tanda baca di ujung.
export function normalizeRoleKey(role: string): string {
  return role
    .toLocaleLowerCase("id-ID")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\p{P}]+/u, "")
    .replace(/[\p{P}]+$/u, "")
    .trim();
}

type RoleStat = {
  // Hitung kemunculan tiap varian label apa adanya, untuk memilih label tampilan terbanyak.
  labels: Map<string, number>;
  firstLabel: string;
  trainingCount: number;
};

// Fungsi murni: dari daftar audience per pelatihan, hasilkan saran peran teragregasi.
// - Tiap pelatihan dihitung sekali per peran (dedupe per pelatihan dulu).
// - Label tampilan = varian yang paling sering muncul; seri = yang pertama ditemui (deterministik).
// - Urut trainingCount desc, lalu label localeCompare id asc. Dipotong ke maks CATEGORY_AUDIENCE_MAX.
export function aggregateAudience(
  perTraining: { role: string }[][],
  max = CATEGORY_AUDIENCE_MAX,
): AudienceSuggestion[] {
  const stats = new Map<string, RoleStat>();

  for (const audience of perTraining) {
    // Peran unik per pelatihan (berdasarkan kunci normalisasi), supaya hitungannya "per pelatihan".
    const seenInTraining = new Set<string>();
    for (const item of audience) {
      for (const rawRole of splitRoles(item.role)) {
        const key = normalizeRoleKey(rawRole);
        if (!key) continue;
        // Label tampilan: spasi dirapikan, tanda baca di ujung dibuang, huruf besar/kecil dipertahankan.
        const label = rawRole
          .replace(/\s+/g, " ")
          .trim()
          .replace(/^[\p{P}]+/u, "")
          .replace(/[\p{P}]+$/u, "")
          .trim();
        let stat = stats.get(key);
        if (!stat) {
          stat = { labels: new Map(), firstLabel: label, trainingCount: 0 };
          stats.set(key, stat);
        }
        stat.labels.set(label, (stat.labels.get(label) ?? 0) + 1);
        if (!seenInTraining.has(key)) {
          seenInTraining.add(key);
          stat.trainingCount += 1;
        }
      }
    }
  }

  const suggestions = [...stats.values()].map((stat) => ({
    label: bestLabel(stat),
    trainingCount: stat.trainingCount,
  }));

  suggestions.sort(
    (a, b) => b.trainingCount - a.trainingCount || a.label.localeCompare(b.label, "id"),
  );
  return suggestions.slice(0, max);
}

// Varian label yang paling sering; seri dimenangkan oleh yang pertama ditemui.
function bestLabel(stat: RoleStat): string {
  let best = stat.firstLabel;
  let bestCount = stat.labels.get(best) ?? 0;
  for (const [label, count] of stat.labels) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

// Ambil saran peran dari pelatihan tayang di kategori. Melempar 404 kalau kategori tidak ada.
export async function getAudienceSuggestions(
  categoryId: string,
  now = new Date(),
): Promise<AudienceSuggestions> {
  const db = getDb();
  const category = await db.category.findFirst({ where: { id: categoryId, deletedAt: null }, select: { id: true } });
  if (!category) throw new HttpError(404, "NOT_FOUND", "Kategori tidak ditemukan.");

  const rows = await db.training.findMany({
    where: { ...publicTrainingWhere(now), categories: { some: { categoryId } } },
    select: { audience: true },
    // Urutan tetap supaya label pemenang seri selalu sama (pelatihan terbaru dulu).
    orderBy: [{ publishedAt: "desc" }, { id: "asc" }],
  });

  const perTraining = rows.map((row) => readAudience(row.audience).map((item) => ({ role: item.role })));
  const trainingsConsidered = perTraining.filter((audience) => audience.length > 0).length;
  return { trainingsConsidered, suggestions: aggregateAudience(perTraining) };
}
