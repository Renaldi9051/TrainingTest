// Mengisi ulang kata sandi satu-satunya admin dari ADMIN_PASSWORD di .env. Seed tidak pernah menimpa
// admin yang sudah ada, jadi skrip ini dipakai setelah ADMIN_PASSWORD diganti. Semua sesi admin ikut
// dihapus supaya login lama dengan kata sandi sebelumnya berakhir. Hanya untuk database lokal non-prod.
import { databaseName, parseSeedEnv } from "../src/lib/env";
import { getDb } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

const url = new URL(process.env.DATABASE_URL ?? "postgres://invalid");
if (!["localhost", "127.0.0.1", "::1"].includes(url.hostname) || databaseName(url.toString()) === "training_prod") {
  throw new Error("Reset kata sandi admin hanya boleh dijalankan pada database lokal non-produksi.");
}

const db = getDb();

async function main() {
  const { ADMIN_PASSWORD } = parseSeedEnv(process.env);
  const admin = await db.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!admin) throw new Error("Admin belum ada. Jalankan `npm run db:seed` dulu.");
  const passwordHash = await hashPassword(ADMIN_PASSWORD);
  const sessions = await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: admin.id }, data: { passwordHash } });
    return tx.session.deleteMany({ where: { userId: admin.id } });
  });
  console.log(`Kata sandi admin di ${databaseName(url.toString())} diganti; ${sessions.count} sesi dihapus.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
