import type { Prisma } from "@/generated/prisma/client";

// Aturan tampil publik untuk pelatihan, dipakai SEMUA query publik (katalog, detail, jadwal,
// jumlah per kategori): belum dihapus, PUBLISHED, dan waktu publish sudah lewat.
export function publicTrainingWhere(now: Date): Prisma.TrainingWhereInput {
  return { deletedAt: null, status: "PUBLISHED", publishedAt: { lte: now } };
}

export function isPubliclyVisible(
  training: { deletedAt: Date | null; status: string; publishedAt: Date | null },
  now: Date,
): boolean {
  return (
    training.deletedAt === null &&
    training.status === "PUBLISHED" &&
    training.publishedAt !== null &&
    training.publishedAt.getTime() <= now.getTime()
  );
}
