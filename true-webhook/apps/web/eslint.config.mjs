import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals.js";
import nextTs from "eslint-config-next/typescript.js";

const asArray = (v) => {
  const maybe = v?.default ?? v;
  return Array.isArray(maybe) ? maybe : [];
};

export default defineConfig([
  ...asArray(nextVitals),
  ...asArray(nextTs),
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);
