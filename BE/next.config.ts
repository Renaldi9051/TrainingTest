import type { NextConfig } from "next";
import { getConfigEnv } from "./src/lib/env";

const { E2E_SERVER } = getConfigEnv();

const nextConfig: NextConfig = {
  // Server mandiri yang ramping untuk image Docker (docker/be.Dockerfile).
  output: "standalone",
  poweredByHeader: false,
  // Aturan agent ada di AGENTS.md root; jangan biarkan `next dev` membuat AGENTS.md per app.
  agentRules: false,
  // Server e2e (scripts/e2e-dev.ts) memakai folder build sendiri supaya tidak bentrok dengan kunci
  // `next dev` biasa, dan tsconfig sendiri supaya Next tidak menambah path .next/e2e ke tsconfig.json.
  ...(E2E_SERVER ? { distDir: ".next/e2e", typescript: { tsconfigPath: "tsconfig.e2e.json" } } : {}),
};

export default nextConfig;
