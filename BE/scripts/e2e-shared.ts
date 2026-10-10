// Bagian bersama script e2e: membaca DATABASE_URL_E2E dengan penjaga nama database, dan
// membuat/men-drop database itu lewat database maintenance `postgres` di instance yang sama.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { databaseName, E2E_DATABASE_NAME, parseE2eEnv } from "../src/lib/env";

// Port & origin server e2e. Harus sama dengan FE/e2e/e2e-env.ts.
export const E2E_BE_PORT = 4100;
export const E2E_FE_ORIGIN = "http://localhost:3100";

export const BE_ROOT = path.resolve(__dirname, "..");

export function e2eDatabaseUrl(): string {
  const rootEnv = path.resolve(BE_ROOT, "../.env");
  // Variabel yang sudah ada di environment tidak ditimpa.
  if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);
  const { DATABASE_URL_E2E } = parseE2eEnv(process.env);
  if (process.env.DATABASE_URL && databaseName(process.env.DATABASE_URL) === E2E_DATABASE_NAME) {
    throw new Error("DATABASE_URL tidak boleh menunjuk training_e2e; database e2e hanya untuk test.");
  }
  return DATABASE_URL_E2E;
}

function assertE2eDatabase(url: string): string {
  const name = databaseName(url);
  // Penjaga terakhir tepat sebelum DROP/CREATE, terlepas dari validasi env di atas.
  if (name !== E2E_DATABASE_NAME) {
    throw new Error(`Menolak jalan: database "${name}" bukan ${E2E_DATABASE_NAME}.`);
  }
  return name;
}

async function withMaintenanceClient<T>(url: string, run: (client: Client) => Promise<T>): Promise<T> {
  const maintenance = new URL(url);
  maintenance.pathname = "/postgres";
  maintenance.search = "";
  const client = new Client({ connectionString: maintenance.toString() });
  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

// Buat database kalau belum ada (tanpa menyentuh isinya).
export async function ensureE2eDatabase(url: string): Promise<void> {
  const name = assertE2eDatabase(url);
  await withMaintenanceClient(url, async (client) => {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [name]);
    if (existing.rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
  });
}

// Drop + buat ulang. WITH (FORCE) memutus koneksi server e2e yang sudah jalan; pool Prisma
// membuka koneksi baru di query berikutnya.
export async function recreateE2eDatabase(url: string): Promise<void> {
  const name = assertE2eDatabase(url);
  await withMaintenanceClient(url, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    await client.query(`CREATE DATABASE "${name}"`);
  });
}

export function runWithDatabase(command: string, url: string): void {
  assertE2eDatabase(url);
  const result = spawnSync(command, {
    cwd: BE_ROOT,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
  if (result.status !== 0) throw new Error(`Perintah gagal: ${command}`);
}
