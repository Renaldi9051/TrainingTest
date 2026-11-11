// Perapian judul kembar hasil seed catalog-rest (lihat prisma/catalog-dedupe.ts).
// `--dry-run`: hanya laporan. Tanpa flag: baris kembar dipindah ke Sampah lewat service admin (audit
// DELETE + revalidate), bisa dipulihkan dari admin. Hanya untuk database dev; backup dulu.
import { planDedupe } from "../prisma/catalog-dedupe";
import { getDb } from "../src/lib/db";
import { withRevalidateBatch } from "../src/lib/revalidate-map";
import { deleteTraining } from "../src/services/training";

const db = getDb();

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const [trainings, audits] = await Promise.all([
    db.training.findMany({ where: { deletedAt: null }, select: { id: true, slug: true, title: true, createdAt: true } }),
    db.auditLog.findMany({
      where: { entity: "Training" },
      select: { entityId: true, action: true, diff: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const byTraining = new Map<string, { action: string; diff: unknown }[]>();
  for (const audit of audits) {
    if (!audit.entityId) continue;
    byTraining.set(audit.entityId, [...(byTraining.get(audit.entityId) ?? []), { action: audit.action, diff: audit.diff }]);
  }
  const groups = planDedupe(trainings.map((row) => ({ ...row, audits: byTraining.get(row.id) ?? [] })));
  const trash = groups.flatMap((group) => group.trash);
  const reportOnly = groups.filter((group) => group.untouched.length > 0);

  console.info(`Kelompok judul kembar: ${groups.length}. Ke Sampah: ${trash.length}. Dibiarkan (bukan hasil seed / diubah admin): ${reportOnly.reduce((n, g) => n + g.untouched.length, 0)}.`);
  for (const group of groups) {
    console.info(`\nTETAP  ${group.keep.title} (${group.keep.slug})`);
    for (const row of group.trash) console.info(`SAMPAH ${row.title} (${row.slug})`);
    for (const row of group.untouched) console.info(`BIAR   ${row.title} (${row.slug})`);
  }
  if (dryRun || trash.length === 0) return;

  const owner = await db.user.findFirstOrThrow({ orderBy: { createdAt: "asc" }, select: { id: true } });
  let done = 0;
  await withRevalidateBatch(async () => {
    for (const row of trash) {
      await deleteTraining(row.id, owner.id);
      done += 1;
    }
  });
  console.info(`\nSelesai: ${done} pelatihan dipindah ke Sampah.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
