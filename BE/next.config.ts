import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Aturan agent ada di AGENTS.md root; jangan biarkan `next dev` membuat AGENTS.md per app.
  agentRules: false,
};

export default nextConfig;
