import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "test-results/**", "screenshots/**"]),
  {
    rules: {
      "@next/next/no-img-element": "off",
      // These React Compiler checks are new in eslint-plugin-react-hooks 7.
      // The existing components predate them, so keep the previous lint bar.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/purity": "off",
      "@typescript-eslint/ban-ts-comment": ["error", { "ts-nocheck": false }],
    },
  },
]);

export default eslintConfig;
