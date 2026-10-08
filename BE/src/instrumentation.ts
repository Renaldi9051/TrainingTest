// Validasi env sekali saat server start supaya salah konfigurasi langsung ketahuan.
export async function register() {
  const { getEnv } = await import("@/lib/env");
  getEnv();
}
