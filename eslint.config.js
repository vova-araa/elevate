import js from "@eslint/js";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", ".output", ".vinxi"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "server-only",
              message:
                "TanStack Start does not use the Next.js `server-only` package. Rename the module to `*.server.ts` or mark it with `@tanstack/react-start/server-only`.",
            },
          ],
        },
      ],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Codebase is any-vrij; houd het zo — nieuwe `any` blokkeert de lint.
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    // react-refresh/only-export-components is een dev-only HMR-hint zonder
    // runtime-impact. We staan hem uit voor:
    //  - shadcn/ui-basiscomponenten die per conventie hun variants mee-exporteren;
    //  - context-providers die bewust samen met hun hook in één bestand leven
    //    (idiomatisch React; de hook los trekken zou 18+ imports raken).
    files: [
      "src/components/ui/**/*.tsx",
      "src/lib/theme.tsx",
      "src/lib/auth-context.tsx",
      "src/components/notification-center.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
  eslintPluginPrettier,
);
