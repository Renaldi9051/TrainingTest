// Konten contoh Fase 3 untuk database baru (data di seed-data/content.ts, divalidasi seed-data/build.ts).
// Dipanggil dari seed.ts kecuali mode --minimal (setup e2e).
// Aturan sama dengan katalog: setiap entitas hanya diisi kalau tabelnya kosong sama sekali, termasuk
// baris di Sampah, supaya data yang dihapus admin tidak muncul lagi di setiap `docker compose up`.
// Gambar placeholder dipasang seed.ts setelah ini (seed-data/seed-images.ts); foto & logo asli
// diunggah admin sendiri di media library.
// Database yang sudah berisi disamakan lewat scripts/sync-content-dev.ts.
import { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import {
  buildClients,
  buildHomeSections,
  buildMarketing,
  buildMediaPartners,
  buildPortfolio,
  buildServices,
  buildStaticPages,
  buildTestimonials,
} from "./seed-data/build";

const db = getDb();

const EMPTY_SEO = { title: "", description: "", ogImageId: null };

export type ContentSeedResult = Record<string, number | "dilewati">;

// Jalankan fn hanya kalau tabelnya kosong (termasuk Sampah); hasilnya jumlah baris yang dibuat.
async function ifEmpty(count: () => Promise<number>, fn: () => Promise<number>): Promise<number | "dilewati"> {
  return (await count()) === 0 ? fn() : "dilewati";
}

const dateOnly = (value: string | null) => (value ? new Date(`${value}T00:00:00.000Z`) : null);

export async function seedContent(publishedAt: Date): Promise<ContentSeedResult> {
  const result: ContentSeedResult = {};

  result.layanan = await ifEmpty(
    () => db.service.count(),
    async () => {
      const rows = buildServices();
      for (const [order, service] of rows.entries()) {
        await db.service.create({
          data: {
            slug: service.slug,
            title: service.title,
            icon: service.icon,
            summary: service.summary,
            body: service.body ? (service.body as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
            order,
            status: service.status,
            seo: EMPTY_SEO,
          },
        });
      }
      return rows.length;
    },
  );

  result.klien = await ifEmpty(
    () => db.client.count(),
    async () => {
      const rows = buildClients();
      await db.client.createMany({ data: rows.map((row, order) => ({ ...row, order })) });
      return rows.length;
    },
  );

  result.testimoni = await ifEmpty(
    () => db.testimonial.count(),
    async () => {
      const rows = buildTestimonials();
      await db.testimonial.createMany({ data: rows.map((row, order) => ({ ...row, order })) });
      return rows.length;
    },
  );

  result.portofolio = await ifEmpty(
    () => db.portfolioItem.count(),
    async () => {
      // Galeri diisi gambar placeholder oleh seed.ts (seed-images.ts).
      const rows = buildPortfolio();
      await db.portfolioItem.createMany({
        data: rows.map((row, order) => ({
          title: row.title,
          client: row.client,
          description: row.description,
          date: dateOnly(row.date),
          order,
        })),
      });
      return rows.length;
    },
  );

  result.marketing = await ifEmpty(
    () => db.marketingContact.count(),
    async () => {
      const rows = buildMarketing();
      await db.marketingContact.createMany({ data: rows.map((row, order) => ({ ...row, order })) });
      return rows.length;
    },
  );

  result["media partner"] = await ifEmpty(
    () => db.mediaPartner.count(),
    async () => {
      const rows = buildMediaPartners();
      await db.mediaPartner.createMany({ data: rows.map((row, order) => ({ ...row, order })) });
      return rows.length;
    },
  );

  // Halaman statis: hanya kalau belum ada halaman STANDARD sama sekali (halaman profil tidak dihitung).
  result["halaman statis"] = await ifEmpty(
    () => db.page.count({ where: { kind: "STANDARD" } }),
    async () => {
      const rows = buildStaticPages();
      for (const page of rows) {
        await db.page.create({
          data: {
            kind: "STANDARD",
            slug: page.slug,
            title: page.title,
            status: "PUBLISHED",
            publishedAt,
            blocks: page.blocks as Prisma.InputJsonValue,
            seo: EMPTY_SEO,
          },
        });
      }
      return rows.length;
    },
  );

  result["section beranda"] = await ifEmpty(
    () => db.homeSection.count(),
    async () => {
      const rows = buildHomeSections();
      for (const [order, section] of rows.entries()) {
        await db.homeSection.create({
          data: {
            type: section.type,
            title: section.title,
            content: section.content as Prisma.InputJsonValue,
            order,
            visible: section.visible,
          },
        });
      }
      return rows.length;
    },
  );

  return result;
}
