// Demo branch tanpa Docker: BE :4100 + FE :3100 memakai database dev (DATABASE_URL di .env root),
// dengan env override lewat proses ini (file .env tidak diubah). Ctrl+C menghentikan keduanya.
// Port sama dengan e2e: jangan dijalankan bersamaan dengan `npm run test:e2e`.
// Pemakaian (dari BE/): npm run demo
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import path from "node:path";
import { databaseName } from "../src/lib/env";

const BE_PORT = 4100;
const FE_PORT = 3100;
const FE_ORIGIN = `http://localhost:${FE_PORT}`;
const BE_ROOT = path.resolve(__dirname, "..");
const FE_ROOT = path.resolve(BE_ROOT, "../FE");
const READY_TIMEOUT_MS = 120_000;

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer()
      .once("error", () => resolve(false))
      .once("listening", () => server.close(() => resolve(true)))
      .listen(port);
  });
}

async function waitFor(url: string, label: string): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status < 500) return;
    } catch {
      // Server belum menerima koneksi.
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`${label} belum siap setelah ${READY_TIMEOUT_MS / 1000} detik (${url}).`);
}

// shell: true di Windows membuat proses cmd -> node; kill() biasa hanya menghentikan cmd.
function stop(child: ChildProcess | null) {
  if (!child?.pid || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else child.kill("SIGTERM");
}

let be: ChildProcess | null = null;
let fe: ChildProcess | null = null;

function shutdown(code: number) {
  stop(fe);
  stop(be);
  process.exit(code);
}

async function main() {
  const rootEnv = path.resolve(BE_ROOT, "../.env");
  if (!existsSync(rootEnv)) throw new Error("File .env di root belum ada (salin dari .env.example).");
  process.loadEnvFile(rootEnv);
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL kosong di .env.");
  const name = databaseName(url);
  // Demo hanya untuk database dev; production dan database e2e ditolak.
  if (/prod/i.test(name) || name === "training_e2e") throw new Error(`Menolak jalan: database "${name}" bukan database dev.`);

  // Skema harus sudah sesuai branch ini. Migrasi tidak dijalankan otomatis: perubahan skema di
  // database dev tetap keputusan yang disengaja (npm run db:migrate).
  const status = spawnSync("npx prisma migrate status", { cwd: BE_ROOT, shell: true, encoding: "utf8" });
  if (status.status !== 0) {
    throw new Error(`Database "${name}" belum memakai semua migrasi branch ini. Jalankan dulu: npm run db:migrate
${status.stdout}`);
  }

  for (const port of [BE_PORT, FE_PORT]) {
    if (!(await portFree(port))) throw new Error(`Port ${port} sedang dipakai (e2e atau demo lain?). Hentikan dulu proses itu.`);
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => shutdown(0));

  console.info(`Demo memakai database "${name}". BE :${BE_PORT}, FE :${FE_PORT}.`);
  be = spawn(`npx next dev -p ${BE_PORT}`, {
    cwd: BE_ROOT,
    shell: true,
    stdio: "inherit",
    env: {
      ...process.env,
      PUBLIC_BASE_URL: FE_ORIGIN,
      FE_REVALIDATE_URL: `${FE_ORIGIN}/api/revalidate`,
      ALLOWED_ORIGINS: FE_ORIGIN,
    },
  });
  be.on("exit", (code) => shutdown(code ?? 1));
  await waitFor(`http://localhost:${BE_PORT}/api/health`, "BE");

  // FE dijalankan setelah BE siap (dua `next dev` yang start bersamaan bisa saling mengunci).
  fe = spawn(`npx next dev -p ${FE_PORT}`, {
    cwd: FE_ROOT,
    shell: true,
    stdio: "inherit",
    env: { ...process.env, BE_INTERNAL_URL: `http://localhost:${BE_PORT}`, NEXT_PUBLIC_SITE_URL: FE_ORIGIN },
  });
  fe.on("exit", (code) => shutdown(code ?? 1));
  await waitFor(FE_ORIGIN, "FE");
  console.info(`\nDemo siap: ${FE_ORIGIN}  (admin: ${FE_ORIGIN}/admin/login). Ctrl+C untuk berhenti.\n`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error && error.message ? error.message : error);
  // Server yang sudah jalan ikut dihentikan supaya port tidak tertinggal.
  shutdown(1);
});
