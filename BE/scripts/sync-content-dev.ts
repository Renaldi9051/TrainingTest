// Skrip sekali jalan: menyamakan konten Fase 3 di training_dev dengan data contoh
// (prisma/seed-data/*). Database baru tidak perlu ini: seed sudah berisi data yang sama.
//
//   npm run db:sync-content            # dry run: tampilkan rencana, tidak mengubah apa pun
//   npm run db:sync-content -- --apply # jalankan dalam satu transaksi, lalu revalidate FE
//
// Menolak jalan kalau DATABASE_URL bukan training_dev. AuditLog lama tidak disentuh; satu baris
// AuditLog "ContentSync" ditulis saat --apply.
import { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { databaseName } from "../src/lib/env";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";
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
import { categories } from "../prisma/seed-data/catalog";
import { footerNav, headerNav, profilePage } from "../prisma/seed-data/content";
import { createSeedNav } from "../prisma/seed-data/nav";

const TARGET_DATABASE = "training_dev";
// training_e2e (database sekali pakai, di-reset setiap run e2e) boleh untuk menguji skrip ini.
const ALLOWED_DATABASES = new Set([TARGET_DATABASE, "training_e2e"]);
const APPLY = process.argv.includes("--apply");
const PUBLISHED_AT = new Date("2026-10-01T00:00:00.000Z");
const EMPTY_SEO = { title: "", description: "", ogImageId: null };

// Kategori lama training_dev (seed bulk, nama Indonesia) -> kategori referensi. Pelatihan di
// kategori lama ditambahkan juga ke kategori referensi (kategori lama tetap ada).
const LEGACY_CATEGORY_MAP: Record<string, string> = {
  "keuangan-akuntansi": "accounting",
  "akuntansi-keuangan": "accounting",
  "akuntansi-manajemen": "accounting",
  "sumber-daya-manusia": "human-resource",
  "rekrutmen-dan-seleksi": "human-resource",
  "manajemen-kinerja": "human-resource",
  "pengembangan-sdm": "human-resource",
  "kompensasi-dan-benefit": "employee",
  "hubungan-industrial": "industrial",
  "teknologi-informasi": "information-technology",
  "keamanan-siber": "information-technology",
  "data-dan-analitik": "information-technology",
  "pemrograman": "programming",
  "kecerdasan-buatan": "technology",
  "telekomunikasi": "technology",
  "penjualan-negosiasi": "negosiasi",
  "penjualan": "sales",
  "ritel": "sales",
  "pemasaran": "marketing",
  "pemasaran-digital": "marketing",
  "k3-keselamatan-kerja": "health-safety-environment",
  "k3": "health-safety-environment",
  "keselamatan": "health-safety-environment",
  "kesehatan": "health-safety-environment",
  "lingkungan": "environment",
  "perpajakan": "pajak",
  "audit-internal": "audit",
  "manajemen-risiko": "risk-management",
  "treasury": "financial",
  "pasar-modal": "financial",
  "keuangan-non-keuangan": "keuangan",
  "kepemimpinan": "leadership",
  "supervisori": "leadership",
  "komunikasi": "communication",
  "bahasa-inggris-bisnis": "communication",
  "layanan-pelanggan": "customer-services",
  "perhotelan": "services",
  "manajemen-proyek": "proyek",
  "manajemen-operasional": "operation-management",
  "rantai-pasok": "procurement",
  "pengadaan": "procurement",
  "logistik": "cargo",
  "ekspor-impor": "international",
  "produksi": "manufacture",
  "kualitas-dan-iso": "industry",
  "makanan-dan-minuman": "industry",
  "kesekretariatan": "secretary",
  "produktivitas-kantor": "administrative",
  "hukum-bisnis": "law",
  "tata-kelola": "company",
  "perbankan": "banking",
  "asuransi": "insurance",
  "koperasi": "economy",
  "statistik": "economy",
  "sektor-publik": "social",
  "manajemen-aset": "management",
  "manajemen-fasilitas": "maintenance",
  "properti": "properties",
  "migas-dan-energi": "oil-and-gas",
  "perkebunan": "agrobisnis",
  "pendidikan": "education",
  "kewirausahaan": "entrepreneur",
  "strategi-bisnis": "strategic",
  "inovasi": "business",
  "pengembangan-diri": "personal-development",
  "etika-dan-budaya-kerja": "organization",
  "maritim": "transportasi",
  "penerbangan": "transportasi",
  "konstruksi": "civil",
  "teknik": "engineering",
  "farmasi": "chemical",
};

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

  // Kategori.
  const existingCategories = await db.category.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true, featured: true, _count: { select: { trainings: true } } },
  });
  const categoryBySlug = new Map(existingCategories.map((row) => [row.slug, row]));
  const createdCategories = categories.filter((category) => !categoryBySlug.has(category.slug));
  const updatedCategories = categories.filter((category) => categoryBySlug.has(category.slug));
  const referenceSlugs = new Set(categories.map((category) => category.slug));
  const legacy = existingCategories.filter((row) => !referenceSlugs.has(row.slug));
  add("Kategori", "tambah", `${createdCategories.length} kategori referensi baru`);
  if (updatedCategories.length > 0) add("Kategori", "ubah", `${updatedCategories.length} kategori referensi yang sudah ada (nama/deskripsi/ikon/urutan): ${updatedCategories.map((c) => c.slug).join(", ")}`);
  add("Kategori", "ubah", `unggulan: ${categories.filter((c) => c.featured).map((c) => c.name).join(", ")}`);
  const unfeatured = legacy.filter((row) => row.featured);
  if (unfeatured.length > 0) add("Kategori", "ubah", `${unfeatured.length} kategori lama tidak lagi unggulan: ${unfeatured.map((row) => row.slug).join(", ")}`);
  add("Kategori", "tetap", `${legacy.length} kategori lama tetap ada (${legacy.filter((row) => row._count.trainings > 0).length} punya pelatihan), diurutkan setelah kategori referensi`);

  // Tautan pelatihan ke kategori referensi (tanpa melepas kategori lama).
  const links = await legacyLinks(existingCategories.map((row) => ({ id: row.id, slug: row.slug })));
  const unmapped = legacy.filter((row) => !LEGACY_CATEGORY_MAP[row.slug]).map((row) => row.slug);
  add("Kategori", "tambah", `${links.count} tautan pelatihan -> kategori referensi (${links.trainings} pelatihan, dari ${links.mappedCategories} kategori lama)`);
  if (unmapped.length > 0) add("Kategori", "tetap", `kategori lama tanpa padanan: ${unmapped.join(", ")}`);

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

  return { lines, links, categoryBySlug, legacy };
}

// Pasangan (pelatihan, kategori referensi) yang belum ada, dari kategori lama yang punya padanan.
async function legacyLinks(existing: { id: string; slug: string }[]) {
  const idBySlug = new Map(existing.map((row) => [row.slug, row.id]));
  const pairs: { legacyCategoryId: string; targetSlug: string }[] = [];
  for (const [legacySlug, targetSlug] of Object.entries(LEGACY_CATEGORY_MAP)) {
    const legacyCategoryId = idBySlug.get(legacySlug);
    if (legacyCategoryId) pairs.push({ legacyCategoryId, targetSlug });
  }
  const rows = await db.trainingCategory.findMany({
    where: { categoryId: { in: pairs.map((pair) => pair.legacyCategoryId) }, training: { deletedAt: null } },
    select: { trainingId: true, categoryId: true },
  });
  const targetByLegacy = new Map(pairs.map((pair) => [pair.legacyCategoryId, pair.targetSlug]));
  const wanted = new Map<string, { trainingId: string; targetSlug: string }>();
  for (const row of rows) {
    const targetSlug = targetByLegacy.get(row.categoryId);
    if (targetSlug) wanted.set(`${row.trainingId}:${targetSlug}`, { trainingId: row.trainingId, targetSlug });
  }
  // Tautan yang sudah ada ke kategori referensi (kalau kategori referensi sudah ada) tidak dihitung.
  const targetIds = new Map(existing.filter((row) => categories.some((c) => c.slug === row.slug)).map((row) => [row.id, row.slug]));
  const already = await db.trainingCategory.findMany({ where: { categoryId: { in: [...targetIds.keys()] } }, select: { trainingId: true, categoryId: true } });
  for (const row of already) wanted.delete(`${row.trainingId}:${targetIds.get(row.categoryId)}`);
  const list = [...wanted.values()];
  return {
    list,
    count: list.length,
    trainings: new Set(list.map((item) => item.trainingId)).size,
    mappedCategories: pairs.length,
  };
}

async function apply(result: Awaited<ReturnType<typeof plan>>) {
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

      // Kategori referensi: buat/ubah, urutan 0..74. Kategori lama diurutkan sesudahnya, tidak unggulan.
      const ids = new Map<string, string>();
      for (const [order, category] of categories.entries()) {
        const existing = result.categoryBySlug.get(category.slug);
        const data = { name: category.name, description: category.description, icon: category.icon, featured: category.featured, order };
        const saved = existing
          ? await tx.category.update({ where: { id: existing.id }, data, select: { id: true } })
          : await tx.category.create({ data: { ...data, slug: category.slug }, select: { id: true } });
        ids.set(category.slug, saved.id);
      }
      for (const [index, row] of result.legacy.entries()) {
        await tx.category.update({ where: { id: row.id }, data: { featured: false, order: categories.length + index } });
      }
      await tx.trainingCategory.createMany({
        data: result.links.list.map((link) => ({ trainingId: link.trainingId, categoryId: ids.get(link.targetSlug) ?? "" })),
        skipDuplicates: true,
      });

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
  ]);
  console.info(ok ? "Cache FE direvalidasi." : "Revalidate FE gagal (FE tidak menyala?). Data tetap tersimpan; muat ulang FE bila perlu.");
}

async function main() {
  const url = process.env.DATABASE_URL ?? "";
  const name = url ? databaseName(url) : "";
  if (!ALLOWED_DATABASES.has(name)) throw new Error(`Menolak jalan: database "${name}" bukan ${TARGET_DATABASE}.`);

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
