import type { NextConfig } from "next";
import { getConfigEnv } from "./src/lib/env";

// Tujuan rewrite ikut "dibakar" saat build, jadi BE_INTERNAL_URL wajib ada saat `next build`.
const { BE_INTERNAL_URL, E2E_SERVER, NEXT_DIST_DIR } = getConfigEnv();

// Folder build: server e2e (.next/e2e) atau build uji lokal (NEXT_DIST_DIR, mis. .next/verify).
// tsconfig terpisah supaya Next tidak menambah path folder build itu ke tsconfig.json.
const buildDir = E2E_SERVER
  ? { distDir: ".next/e2e", typescript: { tsconfigPath: "tsconfig.e2e.json" } }
  : NEXT_DIST_DIR
    ? { distDir: NEXT_DIST_DIR, typescript: { tsconfigPath: "tsconfig.dist.json" } }
    : {};

const nextConfig: NextConfig = {
  // Server mandiri yang ramping untuk image Docker (docker/fe.Dockerfile).
  output: "standalone",
  cacheComponents: true,
  // Cache data publik: kesegaran dijaga revalidateTag dari BE (< 5 detik setelah mutasi).
  // Waktu di bawah hanya jaring pengaman; stale >= 30 s & expire >= 5 menit memenuhi ensureStatic.
  cacheLife: {
    content: { stale: 300, revalidate: 3600, expire: 7 * 24 * 3600 },
  },
  partialPrefetching: true,
  poweredByHeader: false,
  // Aturan agent ada di AGENTS.md root; jangan biarkan `next dev` membuat AGENTS.md per app.
  agentRules: false,
  // Server e2e (playwright.config.ts) dan build uji lokal memakai folder build sendiri supaya tidak
  // bentrok dengan kunci `next dev` biasa (lihat buildDir di atas).
  ...buildDir,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // Gambar media memakai varian WebP buatan BE (sharp), bukan optimizer Next. Lihat src/lib/image-loader.ts.
  images: {
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    deviceSizes: [320, 768, 1600],
    imageSizes: [160],
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
