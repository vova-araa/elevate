/*
 * Service worker voor Elevate.
 *
 * Bewust conservatief: een te agressieve cache is erger dan geen cache, want
 * dan zien mensen na een deploy oude code. Daarom:
 *   - navigaties (HTML): NETWERK EERST, cache alleen als noodvangnet offline.
 *   - gehashte assets (/assets/*): cache-first — die zijn onveranderlijk,
 *     een nieuwe build levert een nieuwe bestandsnaam op.
 *   - alle andere verzoeken (API, Supabase): niet aanraken.
 */

const VERSION = "v1";
const SHELL_CACHE = `elevate-shell-${VERSION}`;
const ASSET_CACHE = `elevate-assets-${VERSION}`;
const OFFLINE_URL = "/";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== SHELL_CACHE && k !== ASSET_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Alleen onze eigen origin; Supabase/Graph-verzoeken nooit cachen.
  if (url.origin !== self.location.origin) return;
  // API-routes en auth altijd rechtstreeks.
  if (url.pathname.startsWith("/api/")) return;

  // Navigaties: netwerk eerst, val terug op de cache als er geen verbinding is.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached ?? Response.error();
      }),
    );
    return;
  }

  // Gehashte build-assets: cache-first (onveranderlijk).
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});
