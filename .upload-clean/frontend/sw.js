const APP_SHELL_VERSION = "20260410-hybrid27";
const STATIC_CACHE = `kankai-static-${APP_SHELL_VERSION}`;
const PAGE_CACHE = `kankai-pages-${APP_SHELL_VERSION}`;

const CORE_ASSET_URLS = [
  "/styles.css?v=20260410hybrid27",
  "/script.js?v=20260410hybrid27",
  "/manifest.webmanifest?v=20260410hybrid27",
  "/photos/logo-round.png?v=20260227a"
];

const CORE_PAGE_URLS = [
  "/",
  "/about",
  "/who-we-are",
  "/our-history",
  "/principal-message",
  "/mission-vision",
  "/management-committee",
  "/administrative-staff",
  "/faculty-members",
  "/facilities",
  "/cafeteria",
  "/library",
  "/labs",
  "/first-aid",
  "/sports-eca",
  "/admissions",
  "/gallery",
  "/notice-board",
  "/contact",
  "/teachers"
];

async function warmCache(cacheName, urls) {
  const cache = await caches.open(cacheName);
  await Promise.allSettled(
    urls.map(async (url) => {
      const response = await fetch(url);
      if (response && response.ok) {
        await cache.put(url, response.clone());
      }
    })
  );
}

function isPageRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function shouldHandleAssetRequest(url, request) {
  return (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "worker" ||
    request.destination === "image" ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname.startsWith("/photos/")
  );
}

function buildOfflineFallback(pathname) {
  const safePath = String(pathname || "/").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Offline | Kankai Secondary School</title>
  <style>
    :root {
      color-scheme: light;
      --blue-900: #082e52;
      --blue-800: #0d4f87;
      --blue-100: #edf3f9;
      --gold: #f0b429;
      --text: #12273d;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: "Segoe UI", Tahoma, sans-serif;
      color: var(--text);
      background:
        radial-gradient(560px 220px at 0% 0%, rgba(13, 79, 135, 0.18), transparent 60%),
        radial-gradient(520px 240px at 100% 100%, rgba(240, 180, 41, 0.14), transparent 62%),
        var(--blue-100);
    }
    .card {
      width: min(560px, 100%);
      background: rgba(255, 255, 255, 0.96);
      border: 1px solid rgba(8, 46, 82, 0.1);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 18px 36px rgba(8, 46, 82, 0.14);
    }
    .logo {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      display: block;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0 0 10px;
      color: var(--blue-900);
      font-size: clamp(1.6rem, 4vw, 2.1rem);
    }
    p {
      margin: 0 0 14px;
      line-height: 1.65;
    }
    .path {
      display: inline-block;
      margin: 0 0 18px;
      padding: 0.45rem 0.75rem;
      border-radius: 999px;
      background: rgba(13, 79, 135, 0.08);
      color: var(--blue-800);
      font-weight: 700;
      font-size: 0.92rem;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 1rem;
    }
    a {
      text-decoration: none;
      font-weight: 700;
      border-radius: 999px;
      padding: 0.78rem 1.1rem;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    a.primary {
      background: var(--blue-800);
      color: #fff;
      box-shadow: 0 12px 24px rgba(13, 79, 135, 0.18);
    }
    a.secondary {
      background: #fff8e8;
      color: #5b4108;
      border: 1px solid rgba(240, 180, 41, 0.4);
    }
  </style>
</head>
<body>
  <main class="card">
    <img class="logo" src="/photos/logo-round.png?v=20260227a" alt="Kankai Secondary School logo" />
    <h1>You are offline right now</h1>
    <p class="path">Requested page: ${safePath}</p>
    <p>The website structure is still available from cache, but this page could not be refreshed from the internet.</p>
    <p>Reconnect and try again, or open a page you have already visited.</p>
    <div class="actions">
      <a class="primary" href="/">Go to Home</a>
      <a class="secondary" href="/notice-board">Open Notices</a>
      <a class="secondary" href="/contact">Contact School</a>
    </div>
  </main>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

async function networkFirstPage(request) {
  const url = new URL(request.url);
  const cache = await caches.open(PAGE_CACHE);

  try {
    const response = await fetch(request);
    if (response && response.ok) {
      await cache.put(url.pathname, response.clone());
    }
    return response;
  } catch (error) {
    const cached = (await cache.match(url.pathname)) || (await cache.match("/"));
    return cached || buildOfflineFallback(url.pathname);
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const networkPromise = fetch(request)
    .then(async (response) => {
      if (response && (response.ok || response.type === "opaque")) {
        await cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || (await networkPromise) || Response.error();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    Promise.all([
      warmCache(STATIC_CACHE, CORE_ASSET_URLS),
      warmCache(PAGE_CACHE, CORE_PAGE_URLS)
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter((cacheName) => cacheName !== STATIC_CACHE && cacheName !== PAGE_CACHE)
          .map((cacheName) => caches.delete(cacheName))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) return;

  if (isPageRequest(request)) {
    event.respondWith(networkFirstPage(request));
    return;
  }

  if (shouldHandleAssetRequest(url, request)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});











