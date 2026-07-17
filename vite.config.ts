import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

// Standalone build config (voorheen @lovable.dev/vite-tanstack-config).
// Deploy-target wisselen: zet NITRO_PRESET, bv. "vercel" of "cloudflare_module".
export default defineConfig({
  plugins: [
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // src/server.ts wikkelt de SSR-handler in een nette error-pagina.
      server: { entry: "server" },
    }),
    nitro({
      preset: process.env.NITRO_PRESET ?? "node-server",
      // Security-headers op elke response (clickjacking/MIME-sniffing/referrer).
      routeRules: {
        "/**": {
          headers: {
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
          },
        },
      },
    }),
    viteReact(),
    tailwindcss(),
  ],
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-router", "@tanstack/react-query"],
  },
});
