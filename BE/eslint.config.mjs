import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...next,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
