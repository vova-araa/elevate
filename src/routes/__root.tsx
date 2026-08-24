import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerServiceWorker } from "@/lib/pwa";
import {
  Outlet,
  createRootRouteWithContext,
  HeadContent,
  Scripts,
  Link,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmHost } from "@/components/ui/confirm";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-8xl text-gradient-gold">404</h1>
        <p className="mt-3 text-muted-foreground">Deze pagina is niet gevonden.</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center rounded-full bg-gold px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Naar home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="font-display text-3xl text-gold">Er ging iets mis</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => {
            router.invalidate();
            reset();
          }}
          className="mt-6 rounded-full bg-gold px-5 py-2 text-sm font-medium text-primary-foreground"
        >
          Opnieuw proberen
        </button>
      </div>
    </div>
  );
}

// Publieke basis-URL van de app (voor absolute og:image/link-previews). Op de
// server komt dit uit APP_URL; valt terug op het productiedomein.
const SITE_URL = (
  (typeof process !== "undefined" && process.env?.APP_URL) ||
  "https://www.elevatedesign.nl"
).replace(/\/$/, "");
const OG_IMAGE = `${SITE_URL}/og-image.png`;

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#c6a05b" },
      { title: "Elevate Design — Elevate your brand" },
      {
        name: "description",
        content:
          "Premium brand studio voor ambitieuze merken. Stappenplannen, content en oplevering in één portaal.",
      },
      { property: "og:site_name", content: "Elevate Design" },
      { property: "og:title", content: "Elevate Design — Elevate your brand" },
      {
        property: "og:description",
        content:
          "Premium brand studio voor ambitieuze merken. Stappenplannen, content en oplevering in één portaal.",
      },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "nl_NL" },
      { property: "og:url", content: SITE_URL },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "Elevate Design" },
      { name: "twitter:title", content: "Elevate Design — Elevate your brand" },
      {
        name: "twitter:description",
        content:
          "Premium brand studio voor ambitieuze merken. Stappenplannen, content en oplevering in één portaal.",
      },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", sizes: "any" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl" suppressHydrationWarning>
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme')||'light';document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function ThemedToaster() {
  const { theme } = useTheme();
  return <Toaster theme={theme} position="top-right" />;
}

/**
 * Plausible (S04) — cookieloos, dus geen cookiebanner nodig. Alleen op de
 * publieke pagina's: /admin en /client zijn een privé-portaal
 * (noindex/nofollow) en horen niet in bezoekersanalytics mee te tellen.
 * Zonder VITE_PLAUSIBLE_DOMAIN gebeurt er niets — geen nulmeting voordat het
 * domein bekend is.
 */
function PlausibleAnalytics() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isPrivatePortal = pathname.startsWith("/admin") || pathname.startsWith("/client");
  const domain = import.meta.env.VITE_PLAUSIBLE_DOMAIN as string | undefined;

  useEffect(() => {
    if (!domain || isPrivatePortal) return;
    if (document.querySelector("script[data-plausible-loader]")) return;
    const script = document.createElement("script");
    script.defer = true;
    script.dataset.domain = domain;
    script.dataset.plausibleLoader = "true";
    script.src = "https://plausible.io/js/script.js";
    document.head.appendChild(script);
  }, [domain, isPrivatePortal]);

  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Service worker registreren: nodig om de app installeerbaar te maken (en
  // om offline nog een shell te tonen).
  useEffect(() => {
    registerServiceWorker();
  }, []);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      router.invalidate();
      queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Outlet />
          <ThemedToaster />
          <ConfirmHost />
          <PlausibleAnalytics />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
