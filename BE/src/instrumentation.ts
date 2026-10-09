// Validasi env sekali saat server start supaya salah konfigurasi langsung ketahuan,
// lalu nyalakan scheduler publish (hanya di runtime Node.js, tidak saat `next build`).
export async function register() {
  const { getEnv } = await import("@/lib/env");
  getEnv();

  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const { startPublishScheduler } = await import("@/services/publish-scheduler");
  startPublishScheduler();
}
