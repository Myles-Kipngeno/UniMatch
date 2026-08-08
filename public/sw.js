/*
 * UniMatch Service Worker
 * -----------------------
 * Hand-written Workbox service worker for offline PWA support.
 *
 * Strategies:
 *   - Precache: app shell assets (icons, manifest, offline fallback)
 *   - CacheFirst: images, fonts, icon assets
 *   - StaleWhileRevalidate: JS/CSS bundles (/_next/static/)
 *   - NetworkFirst: page navigations & Next.js data routes
 *   - Offline fallback: offline.html for failed navigations
 */

// Import Workbox from CDN
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

// Ensure Workbox loaded
if (workbox) {
  console.log('[SW] Workbox loaded successfully');

  // ─── Configuration ───
  workbox.setConfig({ debug: false });

  const { precacheAndRoute, matchPrecache } = workbox.precaching;
  const { registerRoute, NavigationRoute, setCatchHandler } = workbox.routing;
  const { CacheFirst, NetworkFirst, StaleWhileRevalidate } = workbox.strategies;
  const { ExpirationPlugin } = workbox.expiration;
  const { CacheableResponsePlugin } = workbox.cacheableResponse;

  // ─── Precache: App Shell Assets ───
  // These are always available offline after first visit
  precacheAndRoute([
    { url: '/offline.html', revision: '1' },
    { url: '/manifest.json', revision: '1' },
    { url: '/Unimatch_icon.png', revision: '1' },
    { url: '/favicon.ico', revision: '1' },
    { url: '/favicon.svg', revision: '1' },
    { url: '/favicon.png', revision: '1' },
  ]);

  // ─── Strategy: Static Assets (Images & Icons) — CacheFirst ───
  // Once downloaded, serve from cache. Expires after 30 days.
  registerRoute(
    ({ request, url }) =>
      request.destination === 'image' ||
      url.pathname.match(/\.(png|jpg|jpeg|gif|webp|svg|ico)$/),
    new CacheFirst({
      cacheName: 'unimatch-images',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    })
  );

  // ─── Strategy: Fonts — CacheFirst ───
  // Google Fonts and Font Awesome
  registerRoute(
    ({ url }) =>
      url.origin === 'https://fonts.googleapis.com' ||
      url.origin === 'https://fonts.gstatic.com' ||
      url.origin === 'https://cdnjs.cloudflare.com',
    new CacheFirst({
      cacheName: 'unimatch-fonts',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 30,
          maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
        }),
      ],
    })
  );

  // ─── Strategy: Next.js Static Bundles (JS/CSS) — StaleWhileRevalidate ───
  // Serve from cache immediately, update in background
  registerRoute(
    ({ url }) => url.pathname.startsWith('/_next/static/'),
    new StaleWhileRevalidate({
      cacheName: 'unimatch-next-static',
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    })
  );

  // ─── Strategy: Next.js Data Routes — NetworkFirst ───
  // Always try network for fresh data, fall back to cache
  registerRoute(
    ({ url }) => url.pathname.startsWith('/_next/data/'),
    new NetworkFirst({
      cacheName: 'unimatch-next-data',
      networkTimeoutSeconds: 5,
      plugins: [
        new CacheableResponsePlugin({ statuses: [0, 200] }),
        new ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        }),
      ],
    })
  );

  // ─── Strategy: Page Navigations — NetworkFirst ───
  // If online, always fetch fresh. If offline, serve cached version.
  const navigationHandler = new NetworkFirst({
    cacheName: 'unimatch-pages',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
      }),
    ],
  });

  const navigationRoute = new NavigationRoute(navigationHandler, {
    // Don't cache API routes or auth callbacks
    denylist: [/^\/api\//, /^\/auth\//],
  });
  registerRoute(navigationRoute);

  // ─── Offline Fallback ───
  // If navigation fails entirely (never-visited route while offline),
  // serve the offline fallback page
  setCatchHandler(async ({ event }) => {
    if (event.request.destination === 'document') {
      return matchPrecache('/offline.html');
    }
    return Response.error();
  });

  // ─── Skip Waiting & Claim Clients ───
  // Activate new SW immediately without waiting for page reload
  self.addEventListener('install', (event) => {
    self.skipWaiting();
  });

  self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
  });

} else {
  console.error('[SW] Workbox failed to load');
}
