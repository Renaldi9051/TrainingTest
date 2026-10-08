import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Env dummy untuk unit test; test tidak pernah menyentuh database asli (DB di-mock).
    env: {
      DATABASE_URL: "postgresql://test:test@localhost:5433/training_test",
      SESSION_SECRET: "test-session-secret-0123456789abcdef",
      UPLOAD_DIR: "./uploads-test",
      PUBLIC_BASE_URL: "http://localhost:3000",
      FE_REVALIDATE_URL: "http://localhost:3000/api/revalidate",
      REVALIDATE_SECRET: "test-revalidate-secret",
      ALLOWED_ORIGINS: "http://localhost:3000",
      TRUST_PROXY_HOPS: "1",
    },
  },
});
