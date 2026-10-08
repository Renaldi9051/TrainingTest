import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// FE hanya bicara ke BE lewat HTTP: tidak boleh menyentuh database atau kode BE,
// dan hanya membaca env lewat src/lib/env.ts (skema env FE tidak memuat variabel DB).
const boundaryRules = {
  "no-restricted-properties": [
    "error",
    {
      object: "process",
      property: "env",
      message: "Baca env lewat getEnv() di src/lib/env.ts, jangan process.env langsung.",
    },
  ],
  "no-restricted-imports": [
    "error",
    {
      patterns: [
        {
          group: ["@prisma/*", "prisma", "prisma/*", "**/generated/prisma", "**/generated/prisma/**"],
          message: "FE tidak boleh memakai Prisma. Ambil data dari BE lewat /api.",
        },
        {
          group: ["**/BE", "**/BE/**"],
          message: "FE tidak boleh import kode dari BE. Ambil data lewat /api.",
        },
      ],
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: boundaryRules },
  {
    // Satu-satunya tempat yang boleh membaca process.env.
    files: ["src/lib/env.ts", "next.config.ts"],
    rules: { "no-restricted-properties": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
