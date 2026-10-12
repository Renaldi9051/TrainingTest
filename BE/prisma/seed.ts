// Seed data placeholder untuk development. Idempotent: aman dijalankan berulang.
// `prisma db seed -- --minimal` (setup e2e): hanya admin, pengaturan, menu, katalog, dan halaman
// profil; konten beranda & entitas Fase 3 dibuat sendiri oleh test.
// Hanya MEMBUAT data yang belum ada; data yang sudah diubah admin tidak pernah ditimpa
// (service `migrate` di compose menjalankan seed setiap `docker compose up`).
// Data contoh ada di seed-data/ (katalog, konten Fase 3); teksnya ditulis sendiri.
import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { parseSeedEnv } from "../src/lib/env";
import { hashPassword } from "../src/lib/password";
import { seedContent } from "./seed-content";
import { buildProfileBlocks, buildSettings } from "./seed-data/build";
import { categories, schedules, trainings } from "./seed-data/catalog";
import { profilePage } from "./seed-data/content";
import { createSeedNav } from "./seed-data/nav";

const db = getDb();

const contentSettings = buildSettings();

const settings: { key: string; value: Prisma.InputJsonValue }[] = [
  {
    key: "site.identity",
    value: {
      name: "Lembaga Pelatihan Contoh",
      tagline: "Pelatihan praktis untuk tim yang terus bertumbuh",
      logoLightId: null,
      logoDarkId: null,
      faviconId: null,
    },
  },
  { key: "site.header", value: { ctaLabel: "Lihat jadwal", ctaHref: "/jadwal" } },
  { key: "site.contact", value: contentSettings["site.contact"] },
  { key: "site.social", value: contentSettings["site.social"] },
  { key: "site.footer", value: contentSettings["site.footer"] },
  {
    key: "training.defaults",
    value: {
      facilities: [
        "Modul materi digital",
        "Sertifikat keikutsertaan",
        "Lembar kerja dan template yang bisa dipakai ulang",
        "Sesi tanya jawab 30 hari setelah pelatihan",
      ],
      faq: [
        {
          q: "Apakah pelatihan bisa diadakan khusus untuk perusahaan kami?",
          a: "Bisa. Semua topik tersedia sebagai pelatihan in-house dengan materi dan studi kasus yang disesuaikan.",
        },
        {
          q: "Bagaimana cara mendaftar kelas public?",
          a: "Pilih sesi di tabel jadwal lalu hubungi tim kami lewat WhatsApp. Kami kirimkan formulir dan detail pembayaran.",
        },
        {
          q: "Apakah ada sertifikat?",
          a: "Peserta yang mengikuti seluruh sesi mendapat sertifikat keikutsertaan.",
        },
      ],
      inHouseNote:
        "Butuh jadwal sendiri? Pelatihan ini bisa diadakan in-house di kantor Anda atau online, minimal 10 peserta.",
      disclaimer:
        "Materi dan jadwal dapat berubah. Harga belum termasuk pajak kecuali disebutkan lain.",
    },
  },
  {
    key: "seo.default",
    value: {
      titleTemplate: "%s | Lembaga Pelatihan Contoh",
      defaultTitle: "Lembaga Pelatihan Contoh",
      description: "Katalog pelatihan, jadwal public training, dan layanan in-house.",
      ogImageId: null,
    },
  },
];

const PUBLISHED_AT = new Date("2026-10-01T00:00:00.000Z");
const MINIMAL = process.argv.includes("--minimal");

// Admin pertama dari ADMIN_EMAIL/ADMIN_PASSWORD/ADMIN_NAME. Hanya dibuat kalau email belum ada;
// password admin yang sudah ada tidak pernah ditimpa.
async function seedAdmin(): Promise<"created" | "exists"> {
  const admin = parseSeedEnv(process.env);
  const email = admin.ADMIN_EMAIL.toLowerCase();
  const existing = await db.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return "exists";
  await db.user.create({
    data: { email, name: admin.ADMIN_NAME, passwordHash: await hashPassword(admin.ADMIN_PASSWORD) },
  });
  return "created";
}

// Dipanggil hanya kalau katalog masih kosong (lihat main).
async function seedCatalog() {
  const categoryIds = new Map<string, string>();
  for (const [order, category] of categories.entries()) {
    const saved = await db.category.upsert({
      where: { slug: category.slug, deletedAt: null },
      update: {},
      create: { ...category, order },
    });
    categoryIds.set(category.slug, saved.id);
  }

  const trainingIds = new Map<string, string>();
  for (const [index, { categorySlug, facilities, description, ...training }] of trainings.entries()) {
    // Tanggal terbit berurutan (satu hari per pelatihan) supaya urutan "terbaru" stabil.
    const publishedAt = new Date(PUBLISHED_AT.getTime() + index * 24 * 60 * 60 * 1000);
    const data = {
      ...training,
      description: description as unknown as Prisma.InputJsonValue,
      // Tanpa fasilitas khusus: kolom dibiarkan NULL = pakai default global (training.defaults).
      ...(facilities ? { facilities } : {}),
      status: "PUBLISHED" as const,
      publishedAt,
      publishRevalidatedAt: publishedAt,
    };
    const saved = await db.training.upsert({
      where: { slug: training.slug, deletedAt: null },
      update: {},
      create: data,
    });
    trainingIds.set(training.slug, saved.id);

    const categoryId = categoryIds.get(categorySlug);
    if (!categoryId) throw new Error(`Kategori ${categorySlug} tidak ditemukan`);
    await db.trainingCategory.upsert({
      where: { trainingId_categoryId: { trainingId: saved.id, categoryId } },
      update: {},
      create: { trainingId: saved.id, categoryId },
    });
  }

  for (const { id, trainingSlug, startDate, endDate, ...schedule } of schedules) {
    const trainingId = trainingIds.get(trainingSlug);
    if (!trainingId) throw new Error(`Pelatihan ${trainingSlug} untuk jadwal contoh tidak ditemukan`);
    await db.schedule.upsert({
      where: { id },
      update: {},
      create: {
        id,
        trainingId,
        startDate: new Date(`${startDate}T00:00:00.000Z`),
        endDate: new Date(`${endDate}T00:00:00.000Z`),
        ...schedule,
      },
    });
  }
}

// Halaman sistem profil (/profil). Hanya dibuat kalau belum ada; isi selanjutnya diatur admin.
async function seedProfilePage(): Promise<"created" | "exists"> {
  if ((await db.page.count({ where: { kind: "PROFILE" } })) > 0) return "exists";
  await db.page.create({
    data: {
      kind: "PROFILE",
      slug: "profil",
      title: profilePage.title,
      status: "PUBLISHED",
      publishedAt: PUBLISHED_AT,
      blocks: buildProfileBlocks() as Prisma.InputJsonValue,
      seo: { title: "", description: "", ogImageId: null },
    },
  });
  return "created";
}

async function main() {
  const adminResult = await seedAdmin();
  for (const setting of settings) {
    await db.siteSetting.upsert({ where: { key: setting.key }, update: {}, create: setting });
  }

  // Menu contoh hanya kalau belum ada menu sama sekali (termasuk yang di Sampah).
  if ((await db.navItem.count()) === 0) {
    await createSeedNav(db);
  }

  // Katalog contoh (kategori, pelatihan, jadwal) hanya untuk database yang belum punya katalog sama
  // sekali, termasuk yang di Sampah. Kalau dicek per slug, pelatihan contoh yang dihapus atau diganti
  // slug-nya oleh admin akan muncul lagi di setiap `docker compose up`.
  const catalogEmpty = (await db.category.count()) === 0 && (await db.training.count()) === 0;
  if (catalogEmpty) await seedCatalog();

  const profileResult = await seedProfilePage();
  const contentResult = MINIMAL ? null : await seedContent(PUBLISHED_AT);

  const catalogResult = catalogEmpty
    ? `dibuat (${categories.length} kategori, ${trainings.length} pelatihan, ${schedules.length} jadwal)`
    : "dilewati (katalog sudah berisi)";
  console.info(
    `Seed selesai: ${settings.length} key pengaturan dicek (yang ada tidak ditimpa), katalog contoh ${catalogResult}, ` +
      `halaman profil ${profileResult === "created" ? "dibuat" : "sudah ada"}, ` +
      `admin ${adminResult === "created" ? "dibuat" : "sudah ada"}.`,
  );
  console.info(
    contentResult
      ? `Konten contoh: ${Object.entries(contentResult)
          .map(([name, value]) => `${name} ${value === "dilewati" ? "dilewati (sudah berisi)" : `${value} dibuat`}`)
          .join(", ")}.`
      : "Mode minimal: konten contoh Fase 3 dilewati.",
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
