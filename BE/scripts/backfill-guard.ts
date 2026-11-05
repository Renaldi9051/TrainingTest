// Guard database tujuan untuk skrip backfill galeri kategori (scripts/backfill-category-gallery.ts).
//
// - Tanpa --production: hanya training_dev.
// - Dengan --production: database apa pun, asalkan env CONFIRM_DB_NAME diisi dan sama persis dengan
//   nama database di DATABASE_URL. Ini konfirmasi eksplisit dari operator, supaya skrip tidak jalan
//   ke database production hanya karena DATABASE_URL salah arah.
// Dry-run tetap default di kedua mode; perubahan hanya dengan --apply.

export const DEV_DATABASE = "training_dev";

export type GuardInput = {
  // Nama database dari DATABASE_URL ("" kalau tidak terbaca).
  databaseName: string;
  production: boolean;
  // Nilai env CONFIRM_DB_NAME (undefined kalau tidak diisi).
  confirmDbName: string | undefined;
};

export type GuardResult = { mode: "dev" | "production" };

export class BackfillGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackfillGuardError";
  }
}

export function assertBackfillTarget({ databaseName, production, confirmDbName }: GuardInput): GuardResult {
  if (!databaseName) throw new BackfillGuardError("Menolak jalan: nama database tidak terbaca dari DATABASE_URL.");

  if (!production) {
    if (databaseName !== DEV_DATABASE) {
      throw new BackfillGuardError(
        `Menolak jalan: database "${databaseName}" bukan ${DEV_DATABASE}. ` +
          "Untuk database lain pakai --production dan CONFIRM_DB_NAME=<nama database>.",
      );
    }
    return { mode: "dev" };
  }

  const confirm = confirmDbName ?? "";
  if (confirm === "") {
    throw new BackfillGuardError("Menolak jalan: --production butuh env CONFIRM_DB_NAME berisi nama database tujuan.");
  }
  if (confirm !== databaseName) {
    throw new BackfillGuardError(
      `Menolak jalan: CONFIRM_DB_NAME "${confirm}" tidak sama persis dengan database tujuan "${databaseName}".`,
    );
  }
  return { mode: "production" };
}
