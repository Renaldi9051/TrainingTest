// Skrip sekali jalan: menyamakan konten Fase 3 di training_dev dengan data contoh
// (prisma/seed-data/*). Database baru tidak perlu ini: seed sudah berisi data yang sama.
//
//   npm run db:sync-content            # dry run: tampilkan rencana, tidak mengubah apa pun
//   npm run db:sync-content -- --apply # jalankan dalam satu transaksi, lalu revalidate FE
//
// Katalog (kategori, pelatihan, jadwal) lama dihapus permanen lalu diganti katalog contoh
// (prisma/seed-data/catalog.ts). Menolak jalan kalau DATABASE_URL bukan training_dev. AuditLog lama
// tidak disentuh; satu baris AuditLog "ContentSync" ditulis saat --apply.
import { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { databaseName } from "../src/lib/env";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";
import { appDateString } from "../src/lib/time";
import { AuditAction, writeAudit } from "../src/services/audit";
import {
  buildClients,
  buildHomeSections,
  buildMarketing,
  buildMediaPartners,
  buildPortfolio,
  buildProfileBlocks,
  buildServices,
  buildSettings,
  buildStaticPages,
  buildTestimonials,
} from "../prisma/seed-data/build";
import { buildSchedules, categories, trainings } from "../prisma/seed-data/catalog";
import { writeCatalog } from "../prisma/seed-data/catalog-writer";
import { footerNav, headerNav, profilePage } from "../prisma/seed-data/content";
import { findCoverTargets, seedCovers } from "../prisma/seed-covers";
import { createSeedNav } from "../prisma/seed-data/nav";
import {
  findImageTargets,
  PLACEHOLDER_FOLDER,
  plannedMediaCount,
  PORTFOLIO_IMAGES_PER_ITEM,
  seedPlaceholderImages,
} from "../prisma/seed-data/seed-images";

const TARGET_DATABASE = "training_dev";
// training_e2e (database sekali pakai, di-reset setiap run e2e) boleh untuk menguji skrip ini.
const ALLOWED_DATABASES = new Set([TARGET_DATABASE, "training_e2e"]);
const APPLY = process.argv.includes("--apply");
// --only=portfolio,testimonials: hanya sinkronkan tabel itu (tanpa menyentuh bagian lain).
const ONLY = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length).split(",").filter(Boolean) ?? null;
const PUBLISHED_AT = new Date("2026-10-01T00:00:00.000Z");
const EMPTY_SEO = { title: "", description: "", ogImageId: null };
// Redirect slug pelatihan/kategori lama: tujuannya ikut terhapus.
const CATALOG_REDIRECTS = { OR: [{ from: { startsWith: "/pelatihan/" } }, { to: { startsWith: "/pelatihan/" } }] };

const db = getDb();

type Line = { section: string; action: "tambah" | "ubah" | "hapus" | "tetap"; detail: string };

async function plan() {
  const lines: Line[] = [];
  const add = (section: string, action: Line["action"], detail: string) => lines.push({ section, action, detail });

  // Menu: semua menu lama dihapus permanen, diganti struktur baru.
  const navCount = await db.navItem.count();
  const navNew = [...headerNav, ...footerNav].reduce((sum, item) => sum + 1 + (item.children?.length ?? 0), 0);
  if (navCount > 0) add("Menu", "hapus", `${navCount} item menu lama (termasuk Sampah)`);
  add("Menu", "tambah", `${navNew} item: header ${headerNav.map((item) => item.label).join(", ")}; footer ${footerNav.map((item) => item.label).join(", ")}`);

  // Layanan: cocokkan per slug aktif.
  const services = buildServices();
  const existingServices = await db.service.findMany({ where: { deletedAt: null }, select: { slug: true } });
  const serviceSlugs = new Set(existingServices.map((row) => row.slug));
  for (const service of services) add("Layanan", serviceSlugs.has(service.slug) ? "ubah" : "tambah", `${service.title} (/layanan/${service.slug})`);
  const otherServices = existingServices.filter((row) => !services.some((service) => service.slug === row.slug));
  if (otherServices.length > 0) add("Layanan", "tetap", `${otherServices.length} layanan lain dibiarkan`);

  // Katalog: semua kategori, pelatihan, dan jadwal lama dihapus permanen (termasuk Sampah).
  const catalog = await catalogImpact();
  add("Katalog lama", "hapus", `${catalog.categories} kategori (${catalog.categoriesTrash} di Sampah)`);
  add("Katalog lama", "hapus", `${catalog.trainings} pelatihan (${catalog.trainingsTrash} di Sampah)`);
  add("Katalog lama", "hapus", `${catalog.schedules} jadwal (${catalog.schedulesTrash} di Sampah)`);
  add("Katalog lama", "hapus", `${catalog.trainingCategories} tautan pelatihan-kategori (ikut terhapus)`);
  add("Katalog baru", "tambah", `${categories.length} kategori (${categories.filter((c) => c.featured).length} unggulan)`);
  add("Katalog baru", "tambah", `${trainings.length} pelatihan (${trainings.filter((t) => t.categorySlugs.length === 2).length} dengan 2 kategori)`);
  add("Katalog baru", "tambah", `${trainings.reduce((sum, t) => sum + t.categorySlugs.length, 0)} tautan pelatihan-kategori`);
  add("Katalog baru", "tambah", `${buildSchedules(appDateString()).length} jadwal dalam 6 bulan ke depan`);

  // Relasi lain yang ikut terdampak.
  add("Relasi terdampak", catalog.evaluations > 0 ? "hapus" : "tetap", `${catalog.evaluations} respons evaluasi pada jadwal lama${catalog.evaluations > 0 ? " (MENGHALANGI penghapusan jadwal: FK Restrict)" : ""}`);
  add("Relasi terdampak", catalog.inquiries > 0 ? "ubah" : "tetap", `${catalog.inquiries} inquiry yang menautkan pelatihan lama (kolom pelatihan menjadi kosong)`);
  add("Relasi terdampak", catalog.redirects > 0 ? "hapus" : "tetap", `${catalog.redirects} redirect /pelatihan/... (tujuannya tidak ada lagi)`);
  add("Relasi terdampak", "tetap", `${catalog.coverMedia} media sampul pelatihan lama tetap di media library (tidak lagi dipakai)`);
  add("Relasi terdampak", "tetap", `${catalog.manualSections} section beranda mode manual yang menunjuk pelatihan/kategori (section beranda diganti penuh di bawah)`);
  add("Relasi terdampak", "tetap", `${catalog.auditLogs} baris AuditLog pelatihan/kategori/jadwal lama disimpan sebagai riwayat`);

  // Konten yang diganti penuh: hapus permanen baris lama (termasuk Sampah), buat ulang.
  const replace = async (section: string, count: number, created: number, unit: string) => {
    if (count > 0) add(section, "hapus", `${count} ${unit} lama (termasuk Sampah)`);
    add(section, "tambah", `${created} ${unit}`);
  };
  await replace("Section beranda", await db.homeSection.count(), buildHomeSections().length, "section (urutan referensi + PRD, semua tampil)");
  await replace("Klien", await db.client.count(), buildClients().length, "klien tanpa logo");
  await replace("Testimoni", await db.testimonial.count(), buildTestimonials().length, "testimoni");
  await replace("Portofolio", await db.portfolioItem.count(), buildPortfolio().length, "kegiatan tanpa gambar");
  await replace("Marketing", await db.marketingContact.count(), buildMarketing().length, "kontak marketing");
  await replace("Media partner", await db.mediaPartner.count(), buildMediaPartners().length, "media partner");

  // Halaman.
  const profile = await db.page.findFirst({ where: { kind: "PROFILE" }, select: { id: true } });
  add("Halaman", profile ? "ubah" : "tambah", `profil /profil (${buildProfileBlocks().length} blok)`);
  for (const page of buildStaticPages()) {
    const exists = await db.page.findFirst({ where: { slug: page.slug, deletedAt: null }, select: { id: true } });
    add("Halaman", exists ? "ubah" : "tambah", `${page.title} (/${page.slug})`);
  }

  // Pengaturan.
  for (const key of Object.keys(buildSettings())) add("Pengaturan", "ubah", key);

  return { lines, catalog };
}

// Jumlah baris katalog lama dan relasi yang ikut terdampak penghapusannya.
async function catalogImpact() {
  const [categoriesCount, categoriesTrash, trainingsCount, trainingsTrash, schedulesCount, schedulesTrash] = await Promise.all([
    db.category.count(),
    db.category.count({ where: { deletedAt: { not: null } } }),
    db.training.count(),
    db.training.count({ where: { deletedAt: { not: null } } }),
    db.schedule.count(),
    db.schedule.count({ where: { deletedAt: { not: null } } }),
  ]);
  const manualSections = await db.$queryRaw<{ count: bigint }[]>`
    SELECT count(*) AS count FROM "HomeSection"
    WHERE type IN ('LATEST_TRAININGS', 'CATEGORIES') AND content->>'mode' = 'manual'`;
  return {
    categories: categoriesCount,
    categoriesTrash,
    trainings: trainingsCount,
    trainingsTrash,
    schedules: schedulesCount,
    schedulesTrash,
    trainingCategories: await db.trainingCategory.count(),
    evaluations: await db.evaluationResponse.count(),
    inquiries: await db.inquiry.count({ where: { trainingId: { not: null } } }),
    redirects: await db.redirect.count({ where: CATALOG_REDIRECTS }),
    coverMedia: (await db.training.findMany({ where: { coverId: { not: null } }, distinct: ["coverId"], select: { coverId: true } })).length,
    manualSections: Number(manualSections[0]?.count ?? 0),
    auditLogs: await db.auditLog.count({ where: { entity: { in: ["Training", "Category", "Schedule"] } } }),
    // Untuk revalidate cache halaman lama (detail pelatihan & landing kategori).
    oldTrainingSlugs: (await db.training.findMany({ select: { slug: true } })).map((row) => row.slug),
    oldCategorySlugs: (await db.category.findMany({ select: { slug: true } })).map((row) => row.slug),
  };
}

async function apply(result: Awaited<ReturnType<typeof plan>>) {
  // Respons evaluasi adalah data peserta: tidak dihapus diam-diam. Hentikan dan minta keputusan.
  if (result.catalog.evaluations > 0) {
    throw new Error(`Ada ${result.catalog.evaluations} respons evaluasi pada jadwal lama. Sinkronisasi dibatalkan; tidak ada yang diubah.`);
  }
  const settings = buildSettings();
  await db.$transaction(
    async (tx) => {
      // Menu.
      await tx.navItem.deleteMany({ where: { parentId: { not: null } } });
      await tx.navItem.deleteMany({});
      await createSeedNav(tx);

      // Layanan.
      for (const [order, service] of buildServices().entries()) {
        const data = {
          title: service.title,
          icon: service.icon,
          summary: service.summary,
          body: service.body ? (service.body as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
          order,
          status: service.status,
        };
        const existing = await tx.service.findFirst({ where: { slug: service.slug, deletedAt: null }, select: { id: true } });
        if (existing) await tx.service.update({ where: { id: existing.id }, data });
        else await tx.service.create({ data: { ...data, slug: service.slug, seo: EMPTY_SEO } });
      }

      // Katalog: hapus permanen yang lama (jadwal dulu karena FK Restrict), lalu tulis katalog contoh.
      await tx.redirect.deleteMany({ where: CATALOG_REDIRECTS });
      await tx.schedule.deleteMany({});
      await tx.training.deleteMany({});
      await tx.category.deleteMany({});
      await writeCatalog(tx);

      // Konten yang diganti penuh.
      await tx.homeSection.deleteMany({});
      for (const [order, section] of buildHomeSections().entries()) {
        await tx.homeSection.create({
          data: { type: section.type, title: section.title, content: section.content as Prisma.InputJsonValue, order, visible: section.visible },
        });
      }
      await tx.client.deleteMany({});
      await tx.client.createMany({ data: buildClients().map((row, order) => ({ ...row, order })) });
      await tx.testimonial.deleteMany({});
      await tx.testimonial.createMany({ data: buildTestimonials().map((row, order) => ({ ...row, order })) });
      await tx.portfolioItem.deleteMany({});
      await tx.portfolioItem.createMany({
        data: buildPortfolio().map((row, order) => ({
          title: row.title,
          client: row.client,
          description: row.description,
          date: row.date ? new Date(`${row.date}T00:00:00.000Z`) : null,
          order,
        })),
      });
      await tx.marketingContact.deleteMany({});
      await tx.marketingContact.createMany({ data: buildMarketing().map((row, order) => ({ ...row, order })) });
      await tx.mediaPartner.deleteMany({});
      await tx.mediaPartner.createMany({ data: buildMediaPartners().map((row, order) => ({ ...row, order })) });

      // Halaman profil & statis.
      const profileBlocks = buildProfileBlocks() as Prisma.InputJsonValue;
      const profile = await tx.page.findFirst({ where: { kind: "PROFILE" }, select: { id: true } });
      if (profile) await tx.page.update({ where: { id: profile.id }, data: { title: profilePage.title, blocks: profileBlocks } });
      else
        await tx.page.create({
          data: { kind: "PROFILE", slug: "profil", title: profilePage.title, status: "PUBLISHED", publishedAt: PUBLISHED_AT, blocks: profileBlocks, seo: EMPTY_SEO },
        });
      for (const page of buildStaticPages()) {
        const blocks = page.blocks as Prisma.InputJsonValue;
        const existing = await tx.page.findFirst({ where: { slug: page.slug, deletedAt: null }, select: { id: true } });
        if (existing) await tx.page.update({ where: { id: existing.id }, data: { title: page.title, blocks, status: "PUBLISHED" } });
        else
          await tx.page.create({
            data: { kind: "STANDARD", slug: page.slug, title: page.title, status: "PUBLISHED", publishedAt: PUBLISHED_AT, blocks, seo: EMPTY_SEO },
          });
      }

      // Pengaturan.
      for (const [key, value] of Object.entries(settings)) {
        await tx.siteSetting.upsert({ where: { key }, update: { value }, create: { key, value } });
      }

      await writeAudit(
        {
          userId: null,
          action: AuditAction.UPDATE,
          entity: "ContentSync",
          diff: { script: "scripts/sync-content-dev.ts", plan: result.lines.map((line) => `${line.section}: ${line.action} ${line.detail}`) },
        },
        tx,
      );
    },
    { timeout: 120_000 },
  );

  const ok = await revalidateTags([
    // Tag statis (nilai string); tag per slug di bawah.
    ...Object.values(RevalidateTag).flatMap((tag) => (typeof tag === "string" ? [tag] : [])),
    "page:profil",
    ...buildStaticPages().map((page) => `page:${page.slug}`),
    ...buildServices().map((service) => `service:${service.slug}`),
    ...categories.map((category) => `category:${category.slug}`),
    ...result.catalog.oldCategorySlugs.map((slug) => `category:${slug}`),
    ...result.catalog.oldTrainingSlugs.map((slug) => `training:${slug}`),
  ]);
  console.info(ok ? "Cache FE direvalidasi." : "Revalidate FE gagal (FE tidak menyala?). Data tetap tersimpan; muat ulang FE bila perlu.");
}

// Sinkronisasi sebagian: tabel yang diganti penuh dengan data contoh, satu transaksi.
const PARTIAL = {
  portfolio: {
    label: "Portofolio",
    tags: [RevalidateTag.PORTFOLIO],
    count: () => db.portfolioItem.count(),
    rows: () => buildPortfolio().map((row) => row.title),
    replace: async (tx: Prisma.TransactionClient) => {
      await tx.portfolioItem.deleteMany({});
      await tx.portfolioItem.createMany({
        data: buildPortfolio().map((row, order) => ({
          title: row.title,
          client: row.client,
          description: row.description,
          date: row.date ? new Date(`${row.date}T00:00:00.000Z`) : null,
          order,
        })),
      });
    },
  },
  testimonials: {
    label: "Testimoni",
    tags: [RevalidateTag.TESTIMONIALS, RevalidateTag.HOME],
    count: () => db.testimonial.count(),
    rows: () => buildTestimonials().map((row) => `${row.name}, ${row.role} (${row.company})`),
    replace: async (tx: Prisma.TransactionClient) => {
      await tx.testimonial.deleteMany({});
      await tx.testimonial.createMany({ data: buildTestimonials().map((row, order) => ({ ...row, order })) });
    },
  },
} as const;

// --only=images: pasang gambar placeholder ke layanan & portofolio, dan cover JPG contoh
// (seed-data/covers/<slug>.jpg) ke pelatihan, hanya yang BELUM punya gambar (tidak menghapus atau
// mengganti apa pun). File ditulis ke UPLOAD_DIR lalu baris diperbarui.
async function runImages(name: string) {
  const targets = await findImageTargets(db);
  const covers = await findCoverTargets();
  const planned = plannedMediaCount(targets);
  console.info(`${APPLY ? "Menjalankan" : "Rencana (dry run, belum ada yang diubah)"} gambar contoh ${name}:\n`);
  console.info(`  [tambah] ${planned} media placeholder di folder "${PLACEHOLDER_FOLDER}" + ${covers.length} media cover JPG (WebP + varian 320/768/1600 di UPLOAD_DIR)`);
  console.info(`  [ubah]   ${targets.services.length} layanan tanpa gambar: ${targets.services.map((row) => row.title).join(", ") || "-"}`);
  console.info(`  [ubah]   ${targets.portfolio.length} portofolio tanpa galeri (${PORTFOLIO_IMAGES_PER_ITEM} gambar per kegiatan): ${targets.portfolio.map((row) => row.title).join(", ") || "-"}`);
  console.info(`  [ubah]   ${covers.length} pelatihan tanpa sampul yang punya file cover dengan slug sama`);
  console.info("  [tetap]  baris yang sudah punya gambar, cover yang pernah diunggah/dilepas, dan semua media lain tidak disentuh");
  if (!APPLY) return console.info("\nJalankan dengan --apply untuk menerapkan.");
  if (planned === 0 && covers.length === 0) return console.info("\nTidak ada yang perlu diisi.");
  const admin = await db.user.findFirst({ where: { active: true }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!admin) throw new Error("Butuh minimal satu admin (jalankan seed).");
  const result = await seedPlaceholderImages(targets, admin.id, db);
  const coverResult = await seedCovers(covers);
  const coversAttached = coverResult === "dilewati" ? 0 : coverResult;
  await writeAudit({
    userId: null,
    action: AuditAction.UPDATE,
    entity: "ContentSync",
    diff: { script: "scripts/sync-content-dev.ts", only: ["images"], ...result, covers: coversAttached },
  });
  const ok = await revalidateTags([RevalidateTag.MEDIA, RevalidateTag.SERVICES, RevalidateTag.PORTFOLIO, RevalidateTag.TRAININGS, RevalidateTag.HOME]);
  console.info(ok ? "Cache FE direvalidasi." : "Revalidate FE gagal (FE tidak menyala?). Data tetap tersimpan.");
  console.info(`Selesai: ${result.media} media placeholder, ${coversAttached} cover pelatihan.`);
}

async function runPartial(name: string, keys: string[]) {
  if (keys.includes("images")) {
    if (keys.length > 1) throw new Error("--only=images dijalankan sendiri, tanpa tabel lain.");
    return runImages(name);
  }
  const unknown = keys.filter((key) => !(key in PARTIAL));
  if (unknown.length > 0) throw new Error(`--only tidak dikenal: ${unknown.join(", ")}. Pilihan: ${Object.keys(PARTIAL).join(", ")}.`);
  const selected = keys.map((key) => PARTIAL[key as keyof typeof PARTIAL]);
  console.info(`${APPLY ? "Menjalankan" : "Rencana (dry run, belum ada yang diubah)"} sinkronisasi sebagian ${name}:`);
  for (const table of selected) {
    console.info(`\n${table.label}\n  [hapus] ${await table.count()} baris lama (termasuk Sampah)`);
    for (const row of table.rows()) console.info(`  [tambah] ${row}`);
  }
  if (!APPLY) return console.info("\nJalankan dengan --apply untuk menerapkan.");
  await db.$transaction(async (tx) => {
    for (const table of selected) await table.replace(tx);
    await writeAudit(
      { userId: null, action: AuditAction.UPDATE, entity: "ContentSync", diff: { script: "scripts/sync-content-dev.ts", only: keys } },
      tx,
    );
  });
  const ok = await revalidateTags(selected.flatMap((table) => table.tags));
  console.info(ok ? "Cache FE direvalidasi." : "Revalidate FE gagal (FE tidak menyala?). Data tetap tersimpan.");
  console.info("Selesai.");
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const name = url ? databaseName(url) : "";
  if (!ALLOWED_DATABASES.has(name)) throw new Error(`Menolak jalan: database "${name}" bukan ${TARGET_DATABASE}.`);

  if (ONLY) return runPartial(name, ONLY);

  const result = await plan();
  console.info(`${APPLY ? "Menjalankan" : "Rencana (dry run, belum ada yang diubah)"} sinkronisasi konten ${name}:\n`);
  let section = "";
  for (const line of result.lines) {
    if (line.section !== section) {
      section = line.section;
      console.info(`\n${section}`);
    }
    console.info(`  [${line.action}] ${line.detail}`);
  }
  console.info("\nKatalog baru per kategori (jumlah pelatihan termasuk kategori kedua; 3 contoh judul):");
  for (const category of categories) {
    const items = trainings.filter((training) => training.categorySlugs.includes(category.slug));
    const primary = items.filter((training) => training.categorySlugs[0] === category.slug);
    const examples = [primary[0], primary[Math.floor(primary.length / 2)], primary[primary.length - 1]].map((t) => t.title);
    console.info(`  ${category.featured ? "*" : " "} ${category.name}: ${items.length} pelatihan (${primary.length} utama)`);
    console.info(`      ${examples.join(" | ")}`);
  }
  console.info("  (* = unggulan)");
  if (!APPLY) {
    console.info("\nJalankan dengan --apply untuk menerapkan.");
    return;
  }
  await apply(result);
  console.info("\nSelesai.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error && error.message ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
