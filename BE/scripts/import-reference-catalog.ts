// Impor ulang katalog referensi secara aman. Data admin dan baris di Sampah tetap dipertahankan.
import { seedReferenceCatalog } from "../prisma/seed-reference";
import { getDb } from "../src/lib/db";
import { RevalidateTag, revalidateTags } from "../src/lib/revalidate";

const db = getDb();

seedReferenceCatalog({ hideDemo: process.argv.includes("--hide-demo") })
  .then(async (result) => {
    console.info(`Impor selesai: ${result.categoriesCreated} kategori, ${result.trainingsCreated} pelatihan, ${result.linksCreated} tautan kategori, ${result.menuCreated} submenu baru; ${result.trainingsHidden} pelatihan ke Sampah, ${result.linksRemoved} tautan dilepas.`);
    await revalidateTags([RevalidateTag.NAV, RevalidateTag.CATEGORIES, RevalidateTag.TRAININGS, RevalidateTag.HOME]);
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
