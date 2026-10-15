// Membersihkan fitur Evaluasi lama dari database lokal. Aman dijalankan ulang.
// Pelatihan yang pernah memakai kategori ini tetap dipertahankan.
import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";

const databaseHost = new URL(process.env.DATABASE_URL ?? "postgres://invalid").hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(databaseHost)) {
  throw new Error("Skrip pembersihan Evaluasi hanya boleh dijalankan pada database lokal.");
}

const copy = new Map([
  [
    "Nama, nama instansi, jabatan, alamat email, dan nomor telepon yang Anda isi saat mendaftar, bertanya, atau mengisi evaluasi pelatihan.",
    "Nama, nama instansi, jabatan, alamat email, dan nomor telepon yang Anda isi saat mendaftar atau bertanya tentang pelatihan.",
  ],
  [
    "Menyiapkan sertifikat dan laporan evaluasi untuk instansi pengirim.",
    "Menyiapkan sertifikat keikutsertaan untuk peserta dan instansi pengirim.",
  ],
  ["Sertifikat & evaluasi", "Sertifikat keikutsertaan"],
  ["Sertifikat keikutsertaan dan laporan evaluasi untuk instansi.", "Sertifikat digital bagi peserta yang mengikuti seluruh sesi."],
]);

function replaceCopy(value: unknown): unknown {
  if (typeof value === "string") return copy.get(value) ?? value;
  if (Array.isArray(value)) return value.map(replaceCopy);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, replaceCopy(item)]));
  }
  return value;
}

const db = getDb();

async function main() {
  const result = await db.$transaction(async (tx) => {
    const category = await tx.category.findFirst({
      where: { slug: "evaluasi", name: "Evaluasi", deletedAt: null },
      select: { id: true },
    });
    const removedLinks = category
      ? (await tx.trainingCategory.deleteMany({ where: { categoryId: category.id } })).count
      : 0;
    if (category) {
      await tx.category.update({ where: { id: category.id }, data: { deletedAt: new Date() } });
    }

    const removedMenu = (await tx.navItem.updateMany({
      where: { href: "/evaluasi", deletedAt: null },
      data: { deletedAt: new Date() },
    })).count;
    const removedPages = (await tx.page.updateMany({
      where: { slug: "evaluasi", deletedAt: null },
      data: { deletedAt: new Date() },
    })).count;
    const removedRedirects = (await tx.redirect.updateMany({
      where: { OR: [{ from: "/evaluasi" }, { to: "/evaluasi" }], deletedAt: null },
      data: { deletedAt: new Date() },
    })).count;

    let revisedPages = 0;
    const pages = await tx.page.findMany({
      where: { slug: { in: ["profil", "kebijakan-privasi"] }, deletedAt: null },
      select: { id: true, blocks: true },
    });
    for (const page of pages) {
      const next = replaceCopy(page.blocks);
      if (JSON.stringify(next) === JSON.stringify(page.blocks)) continue;
      await tx.page.update({ where: { id: page.id }, data: { blocks: next as Prisma.InputJsonValue } });
      revisedPages += 1;
    }

    return { categoryRemoved: Boolean(category), removedLinks, removedMenu, removedPages, removedRedirects, revisedPages };
  });
  console.info(JSON.stringify(result));
  await revalidateTags([
    RevalidateTag.NAV,
    RevalidateTag.CATEGORIES,
    RevalidateTag.TRAININGS,
    RevalidateTag.PAGES,
    RevalidateTag.HOME,
    RevalidateTag.category("evaluasi"),
    RevalidateTag.training("training-evaluasi-etika-dan-kepatuhan"),
    RevalidateTag.page("profil"),
    RevalidateTag.page("kebijakan-privasi"),
  ]);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => db.$disconnect());
