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
      // Statische assets vooraf comprimeren (~15-20% kleiner dan gzip-on-the-fly).
      compressPublicAssets: { gzip: true, brotli: true },
      // Security-headers op elke response (clickjacking/MIME-sniffing/referrer).
      routeRules: {
        "/**": {
          headers: {
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
            "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
            // CSP als tweede verdedigingslaag. 'unsafe-inline' voor scripts is
            // nodig voor de thema-bootstrap in __root.tsx; media/img staan ruim
            // omdat we signed URLs van Supabase Storage en platform-CDN's tonen.
            "Content-Security-Policy": [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "img-src 'self' data: blob: https:",
              "media-src 'self' blob: https:",
              "connect-src 'self' https://*.supabase.co https://*.supabase.in wss://*.supabase.co",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
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
