import type { NextConfig } from "next";
import { getConfigEnv } from "./src/lib/env";

// Tujuan rewrite ikut "dibakar" saat build, jadi BE_INTERNAL_URL wajib ada saat `next build`.
const { BE_INTERNAL_URL } = getConfigEnv();

const nextConfig: NextConfig = {
  // Server mandiri yang ramping untuk image Docker (docker/fe.Dockerfile).
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  // Aturan agent ada di AGENTS.md root; jangan biarkan `next dev` membuat AGENTS.md per app.
  agentRules: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Browser hanya bicara ke satu origin; /api dan /uploads diteruskan ke BE.
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${BE_INTERNAL_URL}/api/:path*` },
      { source: "/uploads/:path*", destination: `${BE_INTERNAL_URL}/uploads/:path*` },
    ];
  },
};

export default nextConfig;
