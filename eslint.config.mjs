import { defineConfig, globalIgnores } from "eslint/config";
import { flatConfig } from "eslint-config-next";

const eslintConfig = defineConfig([
  ...flatConfig.coreWebVitals,
  ...flatConfig.typescript,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
