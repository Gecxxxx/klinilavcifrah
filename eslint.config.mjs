import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    ".open-next/**",
    ".wrangler/**",
    "out/**",
    "build/**",
    "release-artifacts/**",
    ".pages-api-disabled/**",
    "playwright-report/**",
    "test-results/**",
    "design-qa/screenshots/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
