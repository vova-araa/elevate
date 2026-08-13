import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // Zonder deze plugin lost `@/...` niet op in tests (wel in de app-build).
  plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    // Standaard jsdom voor componenten; server-modules zetten bovenaan hun
    // bestand `// @vitest-environment node` omdat ze node:dns/node:net nodig hebben.
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
  },
});
