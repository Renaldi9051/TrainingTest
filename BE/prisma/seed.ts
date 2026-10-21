// Seed utama: katalog referensi dan submenu Pelatihan, aman dijalankan berulang.
// `prisma db seed -- --minimal` (setup e2e): hanya admin, pengaturan, menu, katalog, dan halaman
// profil; konten beranda & entitas Fase 3 dibuat sendiri oleh test.
// `prisma db seed -- --bulk` (khusus dev): ditambah ~1.200 pelatihan dummy untuk uji performa search.
// Hanya MEMBUAT data yang belum ada; data yang sudah diubah admin tidak pernah ditimpa
// (service `migrate` di compose menjalankan seed setiap `docker compose up`).
// Data contoh ada di seed-data/ (katalog, konten Fase 3); teksnya ditulis sendiri.
import type { Prisma } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { parseSeedEnv } from "../src/lib/env";
import { hashPassword } from "../src/lib/password";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";
import { REFERENCE_SEED_KEY, REFERENCE_SEED_VERSION, seedReferenceCatalog } from "./seed-reference";
import { seedBulk } from "./seed-bulk";
import { seedCategoryCleanup } from "./seed-category-cleanup";
import { seedCategoryFill } from "./seed-category-fill";
import { seedHomeCopy } from "./seed-home-copy";
import { seedSingleCategory } from "./seed-single-category";
import { type ContentSeedResult, seedContent } from "./seed-content";
import { seedCovers } from "./seed-covers";
import { seedGallery } from "./seed-gallery";
import { seedHomeImages } from "./seed-home-images";
import { seedManifestGallery } from "./seed-manifest-gallery";
import { seedThemeGallery } from "./seed-theme-gallery";
import { seedTrainingPhotos } from "./seed-training-photos";
import { seedPaymentPage } from "./seed-payment-page";
import { buildProfileBlocks, buildSettings } from "./seed-data/build";
import { writeCatalog } from "./seed-data/catalog-writer";
import { profilePage } from "./seed-data/content";
import { createSeedNav } from "./seed-data/nav";
import { findImageTargets, plannedMediaCount, seedPlaceholderImages } from "./seed-data/seed-images";

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
const BULK = process.argv.includes("--bulk");
const USE_REFERENCE = !MINIMAL && !BULK;

// Satu admin dari ADMIN_PASSWORD/ADMIN_NAME. Hanya dibuat kalau belum ada admin sama sekali;
// admin yang sudah ada (termasuk password-nya) tidak pernah ditimpa.
async function seedAdmin(): Promise<"created" | "exists"> {
  if ((await db.user.count()) > 0) return "exists";
  const admin = parseSeedEnv(process.env);
  await db.user.create({
    data: { name: admin.ADMIN_NAME, passwordHash: await hashPassword(admin.ADMIN_PASSWORD) },
  });
  return "created";
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

  // Mode minimal/e2e dan bulk tetap memakai katalog contoh. Seed standar memakai katalog referensi.
  // Marker versi mencegah impor ulang setiap startup dan menjaga suntingan/penghapusan admin; versi baru
  // menjalankan seed sekali lagi (membuat yang kurang, merapikan yang tidak lagi dipakai).
  const catalogEmpty = (await db.category.count()) === 0 && (await db.training.count()) === 0;
  const catalog = !USE_REFERENCE && catalogEmpty ? await writeCatalog(db) : null;
  const referenceSeeded = USE_REFERENCE
    ? await db.siteSetting.findUnique({ where: { key: REFERENCE_SEED_KEY }, select: { value: true } })
    : null;
  const reference = USE_REFERENCE && referenceSeeded?.value !== REFERENCE_SEED_VERSION
    ? await seedReferenceCatalog({ hideDemo: true })
    : null;
  // Perapian kategori referensi (kata kunci, gabung kembar, hapus generik), sekali per versi.
  const cleanup = USE_REFERENCE ? await seedCategoryCleanup() : null;
  // Satu pelatihan satu kategori (sekali per versi), setelah perapian supaya kata kunci ikut menentukan.
  const single = USE_REFERENCE ? await seedSingleCategory() : null;
  // Isi kategori sampai 10 dari judul referensi: dipulihkan dari Sampah atau dibuat baru (sekali per versi).
  const fill = USE_REFERENCE ? await seedCategoryFill() : null;

  const profileResult = await seedProfilePage();
  // Mode minimal (e2e) tanpa halaman pembayaran; spec e2e membuat halamannya sendiri.
  const paymentResult = MINIMAL ? null : await seedPaymentPage(PUBLISHED_AT);
  const contentResult = MINIMAL ? null : await seedContent(PUBLISHED_AT);
  // Gambar contoh hanya untuk data contoh yang baru dibuat di run ini (database baru), supaya gambar
  // yang dihapus admin tidak muncul lagi di setiap `docker compose up`: placeholder untuk layanan &
  // portofolio, JPG contoh untuk sampul pelatihan. Database yang sudah berisi:
  // `npm run db:sync-content -- --only=images`. Mode minimal (e2e) tanpa gambar.
  const imageResult = MINIMAL ? null : await seedImages(contentResult);
  // Cover dari seed-data/covers/<slug>.jpg: dipasang ke pelatihan yang slug-nya cocok dan belum punya
  // cover (berlaku untuk katalog demo maupun katalog referensi). Idempotent & aman diulang.
  const coverResult = MINIMAL ? null : await seedCovers();
  // Foto manifest (accounting): gambar kategori, sampul & galeri yang kosong atau masih foto pool lama.
  const manifestResult = MINIMAL ? null : await seedManifestGallery();
  // Galeri foto administrative: 4 foto per pelatihan dari pool kategori ke TrainingImage, foto pertama
  // jadi cover kalau cover masih kosong.
  const galleryResult = MINIMAL ? null : await seedGallery();
  // Foto tema (orang Indonesia) untuk semua kategori lain dan pelatihan yang sampul/galerinya kosong.
  // Sebelum seedHomeImages, jadi kategori sudah berfoto dan ilustrasi lama tidak dipasang lagi.
  const themeResult = MINIMAL ? null : await seedThemeGallery();
  // Foto unik per pelatihan sesuai topik (training-photos.json), menggantikan foto tema yang berulang.
  const photoResult = MINIMAL ? null : await seedTrainingPhotos();
  // Slide hero & gambar kategori yang masih kosong (database tanpa gambar, mis. VPS).
  const homeImageResult = MINIMAL ? null : await seedHomeImages();
  // Teks hero beranda sesuai katalog korporat (sekali per versi; teks yang diubah admin tetap).
  const homeCopyResult = MINIMAL ? null : await seedHomeCopy();
  // Seed bulk mencetak ringkasannya sendiri.
  if (BULK) await seedBulk();

  const catalogResult = catalog
    ? `dibuat (${catalog.categories} kategori, ${catalog.trainings} pelatihan, ${catalog.schedules} jadwal)`
    : USE_REFERENCE ? "digantikan katalog referensi" : "dilewati (katalog sudah berisi)";
  console.info(
    `Seed selesai: ${settings.length} key pengaturan dicek (yang ada tidak ditimpa), katalog contoh ${catalogResult}, ` +
      `halaman profil ${profileResult === "created" ? "dibuat" : "sudah ada"}, ` +
      (paymentResult
        ? `halaman pembayaran ${{ created: "dibuat (tayang)", published: "ditayangkan", exists: "sudah ada" }[paymentResult.page]}, ` +
          `menu Pembayaran ${paymentResult.menu === "created" ? "dibuat" : "sudah ada"}, `
        : "") +
      `admin ${adminResult === "created" ? "dibuat" : "sudah ada"}.`,
  );
  if (USE_REFERENCE) {
    console.info(reference
      ? `Katalog referensi: ${reference.categoriesCreated} kategori, ${reference.trainingsCreated} pelatihan, ${reference.linksCreated} tautan, ${reference.menuCreated} submenu baru; dirapikan ${reference.trainingsHidden} pelatihan ke Sampah dan ${reference.linksRemoved} tautan kategori dilepas.`
      : "Katalog referensi sudah terpasang; perubahan admin dipertahankan.");
    console.info(cleanup === "dilewati" || cleanup === null
      ? "Perapian kategori: dilewati (versi ini sudah dijalankan)."
      : `Perapian kategori: kata kunci ${cleanup.keywordCategories} kategori (+${cleanup.linksAdded} tautan), ` +
          `${cleanup.merged} kategori digabung (${cleanup.movedTrainings} tautan pindah), ` +
          `${cleanup.deleted} kategori generik dihapus (${cleanup.detachedLinks} tautan dilepas)` +
          (cleanup.skipped.length > 0 ? `; dilewati: ${cleanup.skipped.join("; ")}.` : "."));
    console.info(single === "dilewati" || single === null
      ? "Satu kategori per pelatihan: dilewati (versi ini sudah dijalankan)."
      : `Satu kategori per pelatihan: ${single.trainingsChanged} pelatihan dirapikan (${single.linksRemoved} tautan dilepas, ` +
          `${single.linksAdded} kategori baru dari judul); kategori dihapus: ${single.deletedCategories.join(", ") || "-"}` +
          (single.stillGeneric.length > 0 ? `; masih di kategori generik: ${single.stillGeneric.join(" | ")}` : "") +
          (single.skipped.length > 0 ? `; dilewati: ${single.skipped.join("; ")}.` : "."));
    console.info(fill === "dilewati" || fill === null
      ? "Isi kategori: dilewati (versi ini sudah dijalankan)."
      : `Isi kategori: ${fill.restored} pelatihan dipulihkan dari Sampah, ${fill.created} dibuat dari judul referensi (` +
          fill.summary.map((item) => `${item.slug} ${item.before}->${item.after}`).join(", ") + ")" +
          (fill.failed.length > 0 ? `; gagal: ${fill.failed.join("; ")}.` : "."));
  }
  console.info(
    contentResult
      ? `Konten contoh: ${Object.entries(contentResult)
          .map(([name, value]) => `${name} ${value === "dilewati" ? "dilewati (sudah berisi)" : `${value} dibuat`}`)
          .join(", ")}.`
      : "Mode minimal: konten contoh Fase 3 dilewati.",
  );
  if (imageResult) {
    console.info(
      imageResult.media > 0
        ? `Gambar placeholder: ${imageResult.media} media (${imageResult.services} layanan, ${imageResult.portfolio} portofolio).`
        : "Gambar placeholder dilewati (tidak ada data contoh baru).",
    );
  }
  if (coverResult !== null) {
    console.info(
      `Cover pelatihan: ${coverResult === "dilewati" ? "dilewati" : `${coverResult} dipasang`} (hanya pelatihan yang belum punya cover).`,
    );
  }
  if (manifestResult !== null) {
    console.info(
      `Foto manifest: ${manifestResult === "dilewati" ? "dilewati (sudah terpasang)" : `${manifestResult.categories} kategori, ${manifestResult.trainings} pelatihan`}.`,
    );
  }
  if (galleryResult !== null) {
    console.info(
      `Galeri foto: ${galleryResult === "dilewati" ? "dilewati" : `${galleryResult} pelatihan`} (administrative, hanya yang galerinya kosong).`,
    );
  }
  if (themeResult !== null) {
    console.info(
      `Foto tema: ${themeResult === "dilewati" ? "dilewati (sudah terpasang)" : `${themeResult.categories} kategori, ${themeResult.trainings} pelatihan`}.`,
    );
  }
  if (photoResult !== null) {
    console.info(
      photoResult === "dilewati"
        ? "Foto per pelatihan: dilewati (sudah terpasang)."
        : `Foto per pelatihan: ${photoResult.trainings} pelatihan (${photoResult.uploaded} foto diunduh)` +
            (photoResult.kept > 0 ? `, ${photoResult.kept} dilewati karena foto pilihan admin` : "") +
            (photoResult.missing.length > 0 ? `, tidak ditemukan: ${photoResult.missing.join(", ")}` : "") +
            (photoResult.failed.length > 0 ? `; gagal: ${photoResult.failed.join("; ")}` : "") +
            ".",
    );
  }
  if (homeImageResult !== null) {
    console.info(
      `Gambar beranda: ${homeImageResult === "dilewati" ? "dilewati (sudah berisi)" : `${homeImageResult.heroSlides} slide hero, ${homeImageResult.categories} gambar kategori`}.`,
    );
  }
  if (homeCopyResult !== null) {
    console.info(
      homeCopyResult === "dilewati"
        ? "Teks hero: dilewati (versi ini sudah dijalankan)."
        : `Teks hero: ${homeCopyResult.changed.length > 0 ? `diperbarui (${homeCopyResult.changed.join(", ")})` : "tidak diubah (sudah disunting admin)"}.`,
    );
  }
  // Bila FE sudah berjalan saat seed manual, tampilkan dropdown baru tanpa perlu restart.
  if ((reference || (cleanup && cleanup !== "dilewati") || (single && single !== "dilewati") || (fill && fill !== "dilewati")) && process.env.FE_REVALIDATE_URL && process.env.REVALIDATE_SECRET) {
    await revalidateTags([RevalidateTag.NAV, RevalidateTag.CATEGORIES, RevalidateTag.TRAININGS, RevalidateTag.HOME]);
  }
}

async function seedImages(content: ContentSeedResult | null) {
  const created = (name: string) => typeof content?.[name] === "number";
  const targets = await findImageTargets(db);
  const scoped = {
    services: created("layanan") ? targets.services : [],
    portfolio: created("portofolio") ? targets.portfolio : [],
  };
  if (plannedMediaCount(scoped) === 0) return { services: 0, portfolio: 0, media: 0 };
  const admin = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return seedPlaceholderImages(scoped, admin.id, db);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
