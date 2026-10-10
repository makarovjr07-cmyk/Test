(function () {
  const STORAGE_KEY = "kankai-site-config";

  const DEFAULT_CONFIG = {
    hero: {
      eyebrow: "WELCOME TO KANKAI SECONDARY SCHOOL",
      title: "Education Opens up the Mind",
      description:
        "We combine academic excellence, discipline, digital learning, sports, and character development so students are ready for SEE, +2, and future careers.",
      cta_primary_text: "View More",
      cta_primary_url: "/who-we-are",
      cta_secondary_text: "Book School Visit",
      cta_secondary_url: "/contact"
    },
    stats: [
      { value: "1300+", label: "Students" },
      { value: "30+", label: "Teachers" },
      { value: "100+", label: "Technical Students" },
      { value: "50+", label: "Years of Experience" }
    ],
    calendar: [
      "March 5, 2026: First Terminal Examination Begins",
      "March 20, 2026: Inter-House Sports Competition",
      "April 3, 2026: Parent Teacher Meeting",
      "April 12, 2026: Science and Project Exhibition"
    ],
    gallery: [
      "photos/571812628_1277087307556453_2291941728688117624_n.jpg",
      "photos/481078693_1094847672447085_530806369640170268_n.jpg"
    ]
  };

  const COLLAGE_HIGHLIGHT_PRESET_IMAGES = [
    "photos/collage higlight/hig1.jpg",
    "photos/collage higlight/hig2.jpg",
    "photos/collage higlight/hig3.jpg",
    "photos/collage higlight/hig4.jpg",
    "photos/collage higlight/hig6.jpg",
    "photos/collage higlight/hig7.jpg",
    "photos/collage higlight/hig8.jpg",
    "photos/collage higlight/hig9.jpg",
    "photos/collage higlight/hig10.jpg",
    "photos/collage higlight/641449124_1366410891957427_2804754084618373025_n.jpg",
    "photos/collage higlight/3e109050-cf69-4f21-91b3-2fa5c589894b.jpg"

  ];
  const HOME_CAMPUS_HIGHLIGHTS = [...COLLAGE_HIGHLIGHT_PRESET_IMAGES];
  const HOME_CAMPUS_FEATURED = [
    "photos/collage higlight/641449124_1366410891957427_2804754084618373025_n.jpg",
    "photos/collage higlight/hig1.jpg",
    "photos/collage higlight/hig2.jpg",
    "photos/collage higlight/hig3.jpg",
    "photos/collage higlight/hig4.jpg",
    "photos/collage higlight/hig6.jpg",
    "photos/collage higlight/hig7.jpg",
  ];
  const DEFAULT_LATEST_UPDATES = [
    {
      title: "Entrance form open for class 9",
      message: "Admission open for new session. Contact school for details."
    },
    {
      title: "School Notice",
      message: "Important notice for students and parents is available in school office."
    },
    {
      title: "Co-curricular Activities",
      message: "Regular sports, cultural, and skill programs are running."
    }
  ];
  const COLLAGE_HIGHLIGHT_DIR = "photos/collage higlight/";
  const COLLAGE_FALLBACK_IMAGES = [
    "photos/collage higlight/hig3.jpg",
    "photos/collage higlight/hig2.jpg",
    "photos/collage higlight/hig1.jpg"
  ];
  const EVENTS_DIR = "photos/Events/";
  const EVENTS_PRESET_IMAGES = [

    "photos/Events/475330098_1068293625102490_6546117740112433951_n.jpg",
    "photos/Events/475175884_1068293528435833_2623719357161443315_n.jpg",
    "photos/Events/481168709_1095370475728138_3542820954815226016_n.jpg",
    "photos/Events/481975171_1093681919230327_2910654130580449385_n.jpg",
    "photos/Events/578615978_122235090080147318_3443532170042535540_n.jpg",
    "photos/Events/580488756_122235090422147318_8952655810067041081_n.jpg",
    "photos/Events/641627410_1366410398624143_5950846277860873154_n.jpg"
  ];
  const CAMPUS_DIR = "photos/school/";
  const CAMPUS_PRESET_IMAGES = [
    "photos/school/469379330_1083649473310008_5507704201457650402_n.jpg",
    "photos/school/476024697_1072356054696247_8459264315242404124_n.jpg",
    "photos/school/481269960_1093681792563673_3928820372185156670_n.jpg",
    "photos/school/494837033_1136157521649433_9144056548483441048_n.jpg",
    "photos/school/529833379_1211473474117837_7860189026508432270_n.jpg",
    "photos/school/605514503_1317866950145155_86470680445165872_n.jpg"
  ];
  const TOURING_DIR = "photos/touring/";
  const TOURING_PRESET_IMAGES = [
    "photos/touring/494648153_1137907128141139_5016641012459032329_n.jpg",
    "photos/touring/494926801_1137904421474743_2050341361300368072_n.jpg",
    "photos/touring/76.jpeg",
    "photos/touring/WhatsApp Image 2026-01-28 at 7.21.54 AM (2).jpeg",
    "photos/touring/WhatsApp Image 2026-01-28 at 7.21.56 AM (1).jpeg"
  ];
  const GALLERY_MAX_ITEMS = 120; // hard cap to avoid rendering hundreds of images at once
  const GALLERY_MAX_PER_FOLDER = 60;
  const HIGHLIGHT_EXCLUDE_FILES = [];
  const IMAGE_FILE_PATTERN = /\.(avif|gif|jpe?g|png|webp)$/i;
  const galleryTimers = {};
  const preloadedHeroImages = new Set();
  const HOME_HERO_CUSTOM_IMAGES = [
    "photos/collage higlight/100.jpeg",
    "photos/481078693_1094847672447085_530806369640170268_n.jpg",
    "photos/cap3.jpg",
    "photos/571812628_1277087307556453_2291941728688117624_n.jpg",
    "photos/cls12.jpg"
  ];
  const POPUP_SETTINGS_CHECK_KEY = "kankai:index-popup-settings:last-check";
  const POPUP_SETTINGS_CHECK_INTERVAL_MS = 1000 * 60 * 5;
  const RESULT_PORTAL_VISIBILITY_KEY = "kankai:result-portal-visible";
  const FORM_REQUEST_TIMEOUT_MS = 60000;
  const IDLE_PREFETCH_DELAY_MS = 1200;
  const PAGE_TRANSITION_SESSION_KEY = "kankai:page-transition";
  const PAGE_TRANSITION_MAX_AGE_MS = 15000;
  const PAGE_LEAVE_DELAY_MS = 140;
  const PAGE_ENTER_CLEANUP_MS = 680;
  const PAGE_ENTER_START_DELAY_MS = 24;
  const PAGE_WARM_FETCH_TIMEOUT_MS = 2500;
  const PAGE_TRANSITION_CLASS_NAMES = [
    "page-transition-nav",
    "page-transition-forward",
    "page-transition-backward",
    "page-transition-neutral"
  ];
  const HOMEPAGE_POPUP_FLOW_COMPLETE_EVENT = "kankai:homepage-popup-flow-complete";
  const SESSION_API_CACHE_PREFIX = "kankai:public-api:";
  const POPUP_SETTINGS_SESSION_TTL_MS = 1000 * 60;
  const GALLERY_IMAGES_SESSION_TTL_MS = 1000 * 60 * 2;
  const GALLERY_VERSION_SESSION_KEY = "kankai:gallery-version";
  const GALLERY_REFRESH_BROADCAST_KEY = "kankai:gallery-refresh";
  const GALLERY_VERSION_POLL_INTERVAL_MS = 8000;
  const prefetchedPageHrefs = new Set();
  const warmedPageHrefs = new Set();
  const popupSettingsRequests = new Map();
  const publicNoticeRequests = new Map();
  const folderImageRequests = new Map();
  let galleryAutoRefreshInitialized = false;
  const homepagePopupFlowState = {
    complete: false,
    hadPopup: false
  };

  function buildSessionApiCacheKey(key) {
    return `${SESSION_API_CACHE_PREFIX}${String(key || "").trim()}`;
  }

  function normalizeGalleryVersion(value) {
    const parsed = Number.parseInt(String(value || "").trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function readStoredGalleryVersion() {
    try {
      return normalizeGalleryVersion(sessionStorage.getItem(GALLERY_VERSION_SESSION_KEY));
    } catch {
      return 0;
    }
  }

  function storeStoredGalleryVersion(version) {
    const normalized = normalizeGalleryVersion(version);
    if (!normalized) return 0;

    try {
      sessionStorage.setItem(GALLERY_VERSION_SESSION_KEY, String(normalized));
    } catch { }

    return normalized;
  }

  function readGalleryRefreshSignalFromValue(rawValue) {
    try {
      if (!rawValue) return null;
      const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
      const ts = Number(parsed && parsed.ts);
      if (!Number.isFinite(ts) || ts <= 0) {
        return null;
      }

      return {
        ts,
        version: normalizeGalleryVersion(parsed && parsed.version),
        reason: String((parsed && parsed.reason) || "").trim()
      };
    } catch {
      return null;
    }
  }

  function readGalleryRefreshSignal() {
    try {
      return readGalleryRefreshSignalFromValue(localStorage.getItem(GALLERY_REFRESH_BROADCAST_KEY));
    } catch {
      return null;
    }
  }

  function clearGalleryRuntimeCaches() {
    try {
      for (let index = sessionStorage.length - 1; index >= 0; index -= 1) {
        const key = sessionStorage.key(index);
        if (!key) continue;
        if (key === buildSessionApiCacheKey("gallery-images") || key.startsWith("kankai:folder-list:")) {
          sessionStorage.removeItem(key);
        }
      }
    } catch { }

    folderImageRequests.clear();
  }

  async function fetchGalleryVersion() {
    try {
      const res = await fetch("/api/gallery-version", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Request failed for /api/gallery-version");
      }

      const payload = await res.json();
      return normalizeGalleryVersion(payload && payload.version);
    } catch {
      return 0;
    }
  }

  function readSessionApiCacheValue(cacheKey, { allowExpired = false } = {}) {
    try {
      const raw = sessionStorage.getItem(cacheKey);
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      const expiresAt = Number(parsed && parsed.expiresAt);
      if (!parsed || typeof parsed !== "object" || !Number.isFinite(expiresAt)) {
        sessionStorage.removeItem(cacheKey);
        return undefined;
      }
      if (!allowExpired && expiresAt < Date.now()) {
        sessionStorage.removeItem(cacheKey);
        return undefined;
      }
      return parsed.value;
    } catch {
      try {
        sessionStorage.removeItem(cacheKey);
      } catch { }
      return undefined;
    }
  }

  function writeSessionApiCacheValue(cacheKey, value, ttlMs) {
    try {
      sessionStorage.setItem(
        cacheKey,
        JSON.stringify({
          expiresAt: Date.now() + Math.max(1000, Number(ttlMs) || 1000),
          value
        })
      );
    } catch { }
    return value;
  }

  function fetchJsonWithSessionCache(url, options = {}) {
    const sessionKey = buildSessionApiCacheKey(options.sessionKey || url);
    const ttlMs = Math.max(1000, Number(options.ttlMs) || 1000);
    const cacheMode = options.cacheMode || "default";
    const fallbackValue = Object.prototype.hasOwnProperty.call(options, "fallbackValue")
      ? options.fallbackValue
      : null;
    const normalize =
      typeof options.normalize === "function" ? options.normalize : (value) => value;
    const cached = readSessionApiCacheValue(sessionKey);
    if (typeof cached !== "undefined") {
      return Promise.resolve(cached);
    }

    return fetch(url, { cache: cacheMode })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Request failed for ${url}`);
        }
        return res.json();
      })
      .then((payload) => normalize(payload))
      .then((normalized) => writeSessionApiCacheValue(sessionKey, normalized, ttlMs))
      .catch(() => {
        const stale = readSessionApiCacheValue(sessionKey, { allowExpired: true });
        return typeof stale !== "undefined" ? stale : fallbackValue;
      });
  }

  function fetchIndexPopupSettings(cacheMode = "no-store") {
    const normalizedCacheMode = cacheMode === "default" ? "default" : "no-store";
    if (popupSettingsRequests.has(normalizedCacheMode)) {
      return popupSettingsRequests.get(normalizedCacheMode);
    }

    const request = fetchJsonWithSessionCache("/api/index-popup-settings", {
      sessionKey: `index-popup-settings:${normalizedCacheMode}`,
      ttlMs: POPUP_SETTINGS_SESSION_TTL_MS,
      cacheMode: normalizedCacheMode,
      fallbackValue: null,
      normalize: (payload) => (payload && typeof payload === "object" ? payload : null)
    });

    popupSettingsRequests.set(normalizedCacheMode, request);
    return request;
  }

  function fetchPublicNotices(limit = 12) {
    const safeLimit = Math.min(Math.max(Number(limit) || 6, 1), 50);
    const requestKey = String(safeLimit);
    if (publicNoticeRequests.has(requestKey)) {
      return publicNoticeRequests.get(requestKey);
    }

    const request = fetch(`/api/notices?limit=${safeLimit}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Request failed for /api/notices?limit=${safeLimit}`);
        }
        return res.json();
      })
      .then((items) => (Array.isArray(items) ? items : []))
      .catch(() => []);
    publicNoticeRequests.set(requestKey, request);
    return request.finally(() => {
      publicNoticeRequests.delete(requestKey);
    });
  }

  function completeHomepagePopupFlow(hadPopup = false) {
    if (homepagePopupFlowState.complete) return;
    homepagePopupFlowState.complete = true;
    homepagePopupFlowState.hadPopup = Boolean(hadPopup);
    window.dispatchEvent(
      new CustomEvent(HOMEPAGE_POPUP_FLOW_COMPLETE_EVENT, {
        detail: { hadPopup: homepagePopupFlowState.hadPopup }
      })
    );
  }

  function whenHomepagePopupFlowComplete(callback) {
    if (typeof callback !== "function") return;

    if (!isIndexHomePage() || homepagePopupFlowState.complete) {
      callback({ hadPopup: homepagePopupFlowState.hadPopup });
      return;
    }

    window.addEventListener(
      HOMEPAGE_POPUP_FLOW_COMPLETE_EVENT,
      (event) => {
        const detail = event && event.detail ? event.detail : { hadPopup: homepagePopupFlowState.hadPopup };
        callback(detail);
      },
      { once: true }
    );
  }

  function applyGlobalImagePerfHints() {
    const criticalImages = new Set();
    [
      ".brand-mark",
      ".hero img",
      ".galleryx-hero-shot img"
    ].forEach((selector) => {
      document.querySelectorAll(selector).forEach((img) => criticalImages.add(img));
    });

    document.querySelectorAll("img").forEach((img) => {
      if (img.hasAttribute("data-eager")) return;
      if (!img.hasAttribute("decoding")) {
        img.decoding = "async";
      }
      if (criticalImages.has(img)) {
        if (!img.hasAttribute("loading")) {
          img.loading = "eager";
        }
        if (!img.hasAttribute("fetchpriority")) {
          img.setAttribute("fetchpriority", "high");
        }
        return;
      }
      if (!img.hasAttribute("loading")) {
        img.loading = "lazy";
      }
    });
  }

  function initMobileDataSaver() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const slowConnection = Boolean(
      connection && (connection.saveData || /(?:^|-)2g|slow-2g/i.test(String(connection.effectiveType || "")))
    );
    document.body.classList.toggle("is-data-saver", slowConnection);
    if (!slowConnection) return;

    document.querySelectorAll("video").forEach((video) => {
      if (!video.closest(".galleryx-lightbox")) video.preload = "none";
    });
    document.querySelectorAll("img:not(.brand-mark)").forEach((img) => {
      if (!img.hasAttribute("data-eager")) {
        img.loading = "lazy";
        img.setAttribute("fetchpriority", "low");
      }
    });
  }

  function initAccessibilityEnhancements() {
    const main = document.querySelector("main");
    if (main && !main.id) main.id = "main-content";
    if (main && !document.querySelector(".skip-link")) {
      const skipLink = document.createElement("a");
      skipLink.className = "skip-link";
      skipLink.href = "#main-content";
      skipLink.textContent = "Skip to main content";
      document.body.prepend(skipLink);
    }

    document.querySelectorAll("form").forEach((form) => {
      form.querySelectorAll("input, select, textarea").forEach((field) => {
        if (!(field instanceof HTMLElement)) return;
        field.addEventListener("invalid", () => field.setAttribute("aria-invalid", "true"));
        field.addEventListener("input", () => field.removeAttribute("aria-invalid"));
        field.addEventListener("change", () => field.removeAttribute("aria-invalid"));
      });
    });
  }

  function initFormFileFeedback() {
    document.querySelectorAll('input[type="file"]').forEach((input) => {
      if (!(input instanceof HTMLInputElement) || input.nextElementSibling?.classList.contains("form-file-name")) return;
      const name = document.createElement("span");
      name.className = "form-file-name";
      name.setAttribute("aria-live", "polite");
      input.insertAdjacentElement("afterend", name);
      input.addEventListener("change", () => {
        name.textContent = Array.from(input.files || []).map((file) => file.name).join(", ");
      });
    });
  }

  function attachSkeleton(card, img) {
    if (!card || !img) return;
    card.classList.add("skeleton");
    const clearSkeleton = () => {
      card.classList.add("is-loaded");
      card.classList.remove("skeleton");
      img.removeEventListener("load", clearSkeleton);
      img.removeEventListener("error", clearSkeleton);
      img.removeEventListener("loadeddata", clearSkeleton);
    };
    img.addEventListener("load", clearSkeleton, { once: true });
    img.addEventListener("error", clearSkeleton, { once: true });
    img.addEventListener("loadeddata", clearSkeleton, { once: true });
  }

  function collectIdlePrefetchTargets() {
    const targets = new Set(["/", "/who-we-are", "/teachers", "/gallery", "/admissions", "/contact"]);
    const brandLink = document.querySelector(".brand[href]");
    if (brandLink) {
      const href = String(brandLink.getAttribute("href") || "").trim();
      if (href) {
        targets.add(href);
      }
    }

    const primaryNav = document.querySelector(".links");
    if (primaryNav) {
      getDirectNavAnchors(primaryNav).forEach((link) => {
        const href = String(link.getAttribute("href") || "").trim();
        if (href) {
          targets.add(href);
        }
      });
    }

    return Array.from(targets);
  }

  function scheduleIdlePrefetch() {
    const pagesToPrefetch = collectIdlePrefetchTargets();
    const doPrefetch = () => {
      pagesToPrefetch.forEach((href) => {
        prefetchDocument(href);
      });
    };

    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(doPrefetch, { timeout: 2500 });
    } else {
      window.setTimeout(doPrefetch, IDLE_PREFETCH_DELAY_MS);
    }
  }

  function normalizeNavigationUrl(hrefLike) {
    try {
      if (hrefLike instanceof URL) {
        const copy = new URL(hrefLike.href);
        copy.hash = "";
        return copy;
      }
      const url = new URL(String(hrefLike || ""), window.location.href);
      url.hash = "";
      return url;
    } catch {
      return null;
    }
  }

  function normalizePathname(pathnameLike) {
    let normalized = String(pathnameLike || "/").trim() || "/";
    normalized = normalized.replace(/\\/g, "/");
    if (!normalized.startsWith("/")) {
      normalized = `/${normalized}`;
    }
    normalized = normalized.replace(/\/index(?:\.html)?$/i, "/");
    normalized = normalized.replace(/\.html$/i, "");
    normalized = normalized.replace(/\/{2,}/g, "/");
    if (normalized.length > 1) {
      normalized = normalized.replace(/\/+$/, "");
    }
    return normalized || "/";
  }

  function getCurrentNavigationSignature() {
    return `${normalizePathname(window.location.pathname)}${window.location.search}`;
  }

  function getNavigationSignature(hrefLike) {
    const url = normalizeNavigationUrl(hrefLike);
    return url ? `${normalizePathname(url.pathname)}${url.search}` : "";
  }

  function getNormalizedLocalPath(hrefLike) {
    const url = normalizeNavigationUrl(hrefLike);
    return url ? normalizePathname(url.pathname) : "";
  }

  function getDirectNavAnchors(nav) {
    if (!nav) return [];
    return Array.from(nav.children).reduce((anchors, child) => {
      if (!(child instanceof HTMLElement)) return anchors;
      if (child instanceof HTMLAnchorElement && child.hasAttribute("href")) {
        anchors.push(child);
        return anchors;
      }

      const directAnchor = Array.from(child.children).find(
        (node) => node instanceof HTMLAnchorElement && node.hasAttribute("href")
      );
      if (directAnchor) {
        anchors.push(directAnchor);
      }
      return anchors;
    }, []);
  }

  function resolvePrimaryNavAnchor(link, nav = document.querySelector(".links")) {
    if (!(link instanceof HTMLAnchorElement) || !nav) return null;
    if (link.parentElement === nav) return link;

    const navItem = link.closest(".nav-item");
    if (!navItem || !nav.contains(navItem)) return null;

    return (
      Array.from(navItem.children).find((node) => node instanceof HTMLAnchorElement) || null
    );
  }

  function sanitizePageTransitionMeta(meta) {
    const source = meta && meta.source === "nav" ? "nav" : "link";
    const direction =
      meta && (meta.direction === "forward" || meta.direction === "backward")
        ? meta.direction
        : "neutral";
    return { source, direction };
  }

  function clearPageTransitionContext() {
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return;
    PAGE_TRANSITION_CLASS_NAMES.forEach((className) => {
      root.classList.remove(className);
      body.classList.remove(className);
    });
  }

  function applyPageTransitionContext(meta) {
    const root = document.documentElement;
    const body = document.body;
    if (!root || !body) return;

    const resolvedMeta = sanitizePageTransitionMeta(meta);
    clearPageTransitionContext();
    root.classList.add(`page-transition-${resolvedMeta.direction}`);
    body.classList.add(`page-transition-${resolvedMeta.direction}`);
    if (resolvedMeta.source === "nav") {
      root.classList.add("page-transition-nav");
      body.classList.add("page-transition-nav");
    }
  }

  function getPageTransitionMeta(link) {
    const nav = document.querySelector(".links");
    if (!(link instanceof HTMLAnchorElement) || !nav) {
      return sanitizePageTransitionMeta();
    }

    const targetAnchor = resolvePrimaryNavAnchor(link, nav);
    if (!targetAnchor) {
      return sanitizePageTransitionMeta();
    }

    const anchors = getDirectNavAnchors(nav);
    const currentAnchor = anchors.find((entry) => entry.classList.contains("active")) || null;
    const currentIndex = currentAnchor ? anchors.indexOf(currentAnchor) : -1;
    const targetIndex = anchors.indexOf(targetAnchor);

    let direction = "neutral";
    if (currentIndex >= 0 && targetIndex >= 0) {
      if (targetIndex > currentIndex) {
        direction = "forward";
      } else if (targetIndex < currentIndex) {
        direction = "backward";
      }
    }

    return sanitizePageTransitionMeta({ source: "nav", direction });
  }

  function prefetchDocument(hrefLike, options = {}) {
    if (isConstrainedDevice()) return;
    const eager = Boolean(options && options.eager);
    const url = normalizeNavigationUrl(hrefLike);
    if (!url || url.origin !== window.location.origin) return;

    const signature = getNavigationSignature(url);
    const currentSignature = getCurrentNavigationSignature();
    if (!signature || signature === currentSignature) {
      return;
    }

    if (!prefetchedPageHrefs.has(signature)) {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.href = url.href;
      link.as = "document";
      document.head.appendChild(link);
      prefetchedPageHrefs.add(signature);
    }

    if (!eager || warmedPageHrefs.has(signature) || typeof window.fetch !== "function") {
      return;
    }

    warmedPageHrefs.add(signature);
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const timeoutId = controller
      ? window.setTimeout(() => {
        controller.abort();
      }, PAGE_WARM_FETCH_TIMEOUT_MS)
      : 0;

    window
      .fetch(url.href, {
        method: "GET",
        credentials: "same-origin",
        cache: "force-cache",
        signal: controller ? controller.signal : undefined
      })
      .then((response) => {
        if (!response || !response.ok) {
          throw new Error("warm-request-failed");
        }
        return response.text();
      })
      .catch(() => {
        warmedPageHrefs.delete(signature);
      })
      .finally(() => {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
      });
  }

  function readPendingPageTransition() {
    try {
      const raw = sessionStorage.getItem(PAGE_TRANSITION_SESSION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.href !== "string" || typeof parsed.ts !== "number") {
        sessionStorage.removeItem(PAGE_TRANSITION_SESSION_KEY);
        return null;
      }
      if (Date.now() - parsed.ts > PAGE_TRANSITION_MAX_AGE_MS) {
        sessionStorage.removeItem(PAGE_TRANSITION_SESSION_KEY);
        return null;
      }
      return {
        ...parsed,
        ...sanitizePageTransitionMeta(parsed)
      };
    } catch {
      return null;
    }
  }

  function clearPendingPageTransition() {
    try {
      sessionStorage.removeItem(PAGE_TRANSITION_SESSION_KEY);
    } catch {
      // Ignore storage failures.
    }
  }

  function storePendingPageTransition(hrefLike, meta = {}) {
    const signature = getNavigationSignature(hrefLike);
    if (!signature) return;
    const resolvedMeta = sanitizePageTransitionMeta(meta);
    try {
      sessionStorage.setItem(
        PAGE_TRANSITION_SESSION_KEY,
        JSON.stringify({
          href: signature,
          ts: Date.now(),
          ...resolvedMeta
        })
      );
    } catch {
      // Ignore storage failures.
    }
  }

  function shouldAnimatePageLink(link, event) {
    if (!link) return false;
    if (event) {
      if (event.defaultPrevented) return false;
      if (typeof event.button === "number" && event.button !== 0) return false;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    }

    const rawHref = String(link.getAttribute("href") || "").trim();
    if (!rawHref) return false;
    if (rawHref.startsWith("#")) return false;
    if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return false;
    if (link.hasAttribute("download")) return false;
    if (link.dataset.noPageTransition != null) return false;
    const target = String(link.getAttribute("target") || "").trim().toLowerCase();
    if (target && target !== "_self") return false;

    const url = normalizeNavigationUrl(rawHref);
    if (!url || url.origin !== window.location.origin) return false;

    const currentSignature = getCurrentNavigationSignature();
    if (`${normalizePathname(url.pathname)}${url.search}` === currentSignature) return false;

    return true;
  }

  function initPageTransitions() {
    const supportsNativeNavigationTransition =
      "onpageswap" in window || "onpagereveal" in window;
    const skipAnimatedTransitions =
      prefersReducedMotion() || supportsNativeNavigationTransition || shouldUseLiteMotion();
    const startSignature = getCurrentNavigationSignature();

    function triggerPageEnter() {
      const pending = readPendingPageTransition();
      if (!pending || pending.href !== startSignature) return;
      applyPageTransitionContext(pending);

      const startAnimation = () => {
        document.documentElement.classList.remove("is-page-transitioning");
        document.body.classList.remove("is-page-leaving");

        window.requestAnimationFrame(() => {
          document.body.classList.add("is-page-entering");
          window.setTimeout(() => {
            document.body.classList.remove("is-page-entering");
            clearPageTransitionContext();
          }, PAGE_ENTER_CLEANUP_MS);
        });

        clearPendingPageTransition();
      };

      if (skipAnimatedTransitions) {
        clearPageTransitionContext();
        clearPendingPageTransition();
        return;
      }

      window.setTimeout(() => {
        window.requestAnimationFrame(startAnimation);
      }, PAGE_ENTER_START_DELAY_MS);
    }

    function handlePageLinkClick(event) {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!shouldAnimatePageLink(link, event)) return;

      const destination = normalizeNavigationUrl(link.href);
      if (!destination) return;
      const transitionMeta = getPageTransitionMeta(link);

      event.preventDefault();
      if (document.body.classList.contains("is-page-leaving")) return;

      prefetchDocument(destination, { eager: true });
      storePendingPageTransition(destination, transitionMeta);
      document.body.classList.remove("mobile-drawer-open", "mobile-nav-lock", "mobile-nav-open");
      applyPageTransitionContext(transitionMeta);
      document.documentElement.classList.add("is-page-transitioning");
      document.body.classList.remove("is-page-entering");
      document.body.classList.add("is-page-leaving");

      window.setTimeout(() => {
        window.location.href = destination.href;
      }, PAGE_LEAVE_DELAY_MS);
    }

    function warmPageLink(event) {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!shouldAnimatePageLink(link)) return;
      prefetchDocument(link.href, { eager: true });
    }

    document.addEventListener("pointerover", warmPageLink, { passive: true });
    document.addEventListener("pointerdown", warmPageLink, { passive: true });
    document.addEventListener("focusin", warmPageLink);
    document.addEventListener("touchstart", warmPageLink, { passive: true });

    if (!skipAnimatedTransitions) {
      document.addEventListener("click", handlePageLinkClick);
    }

    window.addEventListener("pageshow", () => {
      document.documentElement.classList.remove("is-page-transitioning");
      document.body.classList.remove("is-page-leaving");
      document.body.classList.remove("is-page-entering");
      clearPageTransitionContext();
    });

    triggerPageEnter();
  }

  function disableRemovedPages() {
    const removedLinks = new Set(["/about", "/about.html", "/facilities", "/facilities.html"]);
    document.querySelectorAll("a[href]").forEach((link) => {
      const href = String(link.getAttribute("href") || "").trim();
      if (!href || !removedLinks.has(href)) return;
      link.setAttribute("href", "#");
    });
  }

  function syncPrimaryNavState() {
    const nav = document.querySelector(".links");
    if (!nav) return;

    const currentPath = normalizePathname(window.location.pathname);
    const topLevelAnchors = getDirectNavAnchors(nav);
    const navLinks = Array.from(nav.querySelectorAll("a[href]")).filter((link) => {
      const rawHref = String(link.getAttribute("href") || "").trim();
      if (!rawHref || rawHref.startsWith("#") || /^(mailto:|tel:|javascript:)/i.test(rawHref)) {
        return false;
      }
      return Boolean(getNormalizedLocalPath(rawHref));
    });

    nav.querySelectorAll("a.active").forEach((link) => link.classList.remove("active"));
    nav
      .querySelectorAll(".is-current-page, .is-current-branch, .is-nav-target")
      .forEach((node) => {
        node.classList.remove("is-current-page", "is-current-branch", "is-nav-target");
      });
    nav.querySelectorAll("[aria-current='page']").forEach((link) => link.removeAttribute("aria-current"));

    const exactMatches = navLinks.filter(
      (link) => getNormalizedLocalPath(link.getAttribute("href")) === currentPath
    );
    const exactTopLevelMatch =
      topLevelAnchors.find((link) => {
        const rawHref = String(link.getAttribute("href") || "").trim();
        if (!rawHref || rawHref.startsWith("#")) return false;
        return getNormalizedLocalPath(rawHref) === currentPath;
      }) || null;
    const primaryActiveLink = exactTopLevelMatch || resolvePrimaryNavAnchor(exactMatches[0], nav);

    if (primaryActiveLink) {
      primaryActiveLink.classList.add("active");
      const parentNavItem = primaryActiveLink.closest(".nav-item");
      if (parentNavItem) {
        parentNavItem.classList.add("is-current-branch");
      }
    }

    exactMatches.forEach((link) => {
      link.setAttribute("aria-current", "page");
      if (link !== primaryActiveLink) {
        link.classList.add("is-current-page");
      }

      const parentNavItem = link.closest(".nav-item");
      if (parentNavItem) {
        parentNavItem.classList.add("is-current-branch");
      }

      const parentSubitem = link.closest(".nav-subitem");
      if (parentSubitem) {
        parentSubitem.classList.add("is-current-branch");
      }
    });
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function hasCoarsePointer() {
    return (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(hover: none)").matches
    );
  }

  function isCompactViewport() {
    return window.matchMedia && window.matchMedia("(max-width: 980px)").matches;
  }

  function isConstrainedDevice() {
    const reducedMotion = prefersReducedMotion();
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const saveData = Boolean(connection && connection.saveData);
    const effectiveType = String((connection && connection.effectiveType) || "").toLowerCase();
    const slowNetwork = effectiveType.includes("2g") || effectiveType.includes("3g");
    const deviceMemory = Number(navigator.deviceMemory || 0);
    const hardwareConcurrency = Number(navigator.hardwareConcurrency || 0);
    const lowMemory = deviceMemory > 0 && deviceMemory <= 4;
    const veryLowMemory = deviceMemory > 0 && deviceMemory <= 2;
    const limitedCpu = hardwareConcurrency > 0 && hardwareConcurrency <= 4;
    const veryLimitedCpu = hardwareConcurrency > 0 && hardwareConcurrency <= 2;
    const lowEndHardware = veryLowMemory || veryLimitedCpu || (lowMemory && limitedCpu);
    return reducedMotion || saveData || slowNetwork || lowEndHardware;
  }

  function shouldUseLiteMotion() {
    return isConstrainedDevice() || isCompactViewport() || hasCoarsePointer();
  }

  function syncRuntimePerformanceMode() {
    const constrainedDevice = isConstrainedDevice();
    const compactViewport = isCompactViewport();
    document.body.classList.toggle("is-constrained-device", constrainedDevice);
    document.body.classList.toggle("is-compact-viewport", compactViewport);
    document.body.classList.toggle("is-motion-lite", shouldUseLiteMotion());
  }

  function initRuntimePerformanceMode() {
    if (!document.body) return;

    let syncRaf = 0;
    const queueSync = () => {
      if (syncRaf) return;
      syncRaf = window.requestAnimationFrame(() => {
        syncRaf = 0;
        syncRuntimePerformanceMode();
      });
    };

    syncRuntimePerformanceMode();
    window.addEventListener("resize", queueSync, { passive: true });

    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (connection && typeof connection.addEventListener === "function") {
      connection.addEventListener("change", queueSync);
    }
  }

  function scheduleNonCriticalTask(callback, options = {}) {
    if (typeof callback !== "function") return;

    const timeout = Math.max(0, Number(options.timeout) || 1200);
    const fallbackDelay = Math.max(0, Number(options.fallbackDelay) || 120);
    const waitForLoad = Boolean(options.waitForLoad);

    const run = () => {
      const invoke = () => {
        callback();
      };

      if ("requestIdleCallback" in window) {
        window.requestIdleCallback(invoke, { timeout });
      } else {
        window.setTimeout(invoke, fallbackDelay);
      }
    };

    const schedule = () => {
      if ("requestAnimationFrame" in window) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(run);
        });
      } else {
        run();
      }
    };

    if (waitForLoad && document.readyState !== "complete") {
      window.addEventListener("load", schedule, { once: true });
      return;
    }

    schedule();
  }

  function createManagedTimeoutLoop(callback, delay) {
    let timerId = 0;
    let active = false;

    function clearTimer() {
      if (!timerId) return;
      window.clearTimeout(timerId);
      timerId = 0;
    }

    function scheduleNext(nextDelay = delay) {
      clearTimer();
      if (!active) return;

      timerId = window.setTimeout(() => {
        timerId = 0;
        if (!active) return;
        callback();
        scheduleNext(delay);
      }, nextDelay);
    }

    return {
      start(initialDelay = delay) {
        if (active) return;
        active = true;
        scheduleNext(initialDelay);
      },
      stop() {
        active = false;
        clearTimer();
      },
      destroy() {
        active = false;
        clearTimer();
      }
    };
  }

  function createVisibilityManagedController(target, options = {}) {
    const onActivate = typeof options.onActivate === "function" ? options.onActivate : null;
    const onDeactivate = typeof options.onDeactivate === "function" ? options.onDeactivate : null;
    const rootMargin = String(options.rootMargin || "180px 0px");
    let inViewport = !(target instanceof Element) || !("IntersectionObserver" in window);
    let pageVisible = !document.hidden;
    let active = false;
    let observer = null;

    function syncState() {
      const nextActive = Boolean(inViewport && pageVisible);
      if (nextActive === active) return;
      active = nextActive;
      if (active) {
        if (onActivate) onActivate();
      } else if (onDeactivate) {
        onDeactivate();
      }
    }

    const handleVisibilityChange = () => {
      pageVisible = !document.hidden;
      syncState();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (target instanceof Element && "IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          inViewport = Boolean(entry && (entry.isIntersecting || entry.intersectionRatio > 0));
          syncState();
        },
        { rootMargin, threshold: 0.01 }
      );
      observer.observe(target);
    } else {
      syncState();
    }

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (observer) {
        observer.disconnect();
      }
      if (active && onDeactivate) {
        onDeactivate();
      }
      active = false;
    };
  }

  let activeAnchorScroll = null;

  function stopActiveAnchorScroll() {
    if (!activeAnchorScroll) return;
    window.cancelAnimationFrame(activeAnchorScroll.rafId);
    activeAnchorScroll.listeners.forEach(({ type, handler, options }) => {
      window.removeEventListener(type, handler, options);
    });
    activeAnchorScroll = null;
  }

  function getAnchorScrollOffset() {
    const header = document.querySelector(".header");
    if (!header) return 24;
    return Math.max(24, Math.round(header.getBoundingClientRect().height + 18));
  }

  function syncAnchorScrollOffsetVar() {
    document.documentElement.style.setProperty(
      "--anchor-scroll-offset",
      `${getAnchorScrollOffset()}px`
    );
  }

  function smoothScrollWindowTo(targetY, options = {}) {
    const topLimit = Math.max(
      0,
      Math.max(
        document.documentElement.scrollHeight,
        document.body ? document.body.scrollHeight : 0
      ) - window.innerHeight
    );
    const finalY = Math.max(0, Math.min(Math.round(targetY), topLimit));
    const startY = window.scrollY || window.pageYOffset || 0;
    const distance = Math.abs(finalY - startY);

    stopActiveAnchorScroll();

    if (
      options.behavior === "auto" ||
      prefersReducedMotion() ||
      isConstrainedDevice() ||
      distance < 2
    ) {
      window.scrollTo(0, finalY);
      return;
    }

    const defaultDuration = Math.min(980, Math.max(520, 360 + distance * 0.2));
    const duration = Math.round(
      typeof options.duration === "number"
        ? options.duration
        : isCompactViewport()
          ? Math.min(defaultDuration, 720)
          : defaultDuration
    );
    const startedAt = performance.now();
    const interrupt = () => stopActiveAnchorScroll();
    const listeners = [
      { type: "wheel", handler: interrupt, options: { passive: true } },
      { type: "touchstart", handler: interrupt, options: { passive: true } },
      { type: "mousedown", handler: interrupt },
      { type: "keydown", handler: interrupt }
    ];

    activeAnchorScroll = {
      rafId: 0,
      listeners
    };

    listeners.forEach(({ type, handler, options }) => {
      window.addEventListener(type, handler, options);
    });

    const easeInOutCubic = (progress) =>
      progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    function step(now) {
      if (!activeAnchorScroll) return;
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = easeInOutCubic(progress);
      const nextY = startY + (finalY - startY) * eased;
      window.scrollTo(0, nextY);

      if (progress < 1) {
        activeAnchorScroll.rafId = window.requestAnimationFrame(step);
        return;
      }

      window.scrollTo(0, finalY);
      stopActiveAnchorScroll();
    }

    activeAnchorScroll.rafId = window.requestAnimationFrame(step);
  }

  function getHashTarget(hashLike) {
    const rawHash = String(hashLike || "").trim();
    if (!rawHash || rawHash === "#") return null;

    const rawId = rawHash.startsWith("#") ? rawHash.slice(1) : rawHash;
    if (!rawId) return null;

    const decodedId = decodeURIComponent(rawId);
    return document.getElementById(decodedId) || document.getElementsByName(decodedId)[0] || null;
  }

  function scrollElementWithOffset(target, options = {}) {
    if (!target) return false;
    syncAnchorScrollOffsetVar();
    const top = target.getBoundingClientRect().top + window.scrollY - getAnchorScrollOffset();
    smoothScrollWindowTo(top, options);
    return true;
  }

  function getSamePageHash(link) {
    if (!link) return "";
    const rawHref = String(link.getAttribute("href") || "").trim();
    if (!rawHref || rawHref === "#" || /^javascript:/i.test(rawHref)) return "";

    try {
      const url = new URL(rawHref, window.location.href);
      const samePath = normalizePathname(url.pathname) === normalizePathname(window.location.pathname);
      const sameSearch = url.search === window.location.search;
      return url.origin === window.location.origin && samePath && sameSearch ? url.hash : "";
    } catch {
      return "";
    }
  }

  function initSmoothAnchorScroll() {
    syncAnchorScrollOffsetVar();

    let resizeRaf = 0;
    const queueOffsetSync = () => {
      if (resizeRaf) return;
      resizeRaf = window.requestAnimationFrame(() => {
        resizeRaf = 0;
        syncAnchorScrollOffsetVar();
      });
    };

    window.addEventListener("resize", queueOffsetSync, { passive: true });
    window.addEventListener("load", queueOffsetSync, { once: true });

    const header = document.querySelector(".header");
    if (header && "ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(queueOffsetSync);
      resizeObserver.observe(header);
    }

    document.addEventListener("click", (event) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || link.closest(".facx-hero-tags")) return;
      if (event.defaultPrevented) return;
      if (typeof event.button === "number" && event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.hasAttribute("download")) return;

      const hash = getSamePageHash(link);
      if (!hash || hash === "#") return;

      const target = getHashTarget(hash);
      if (!target) return;

      event.preventDefault();
      document.body.classList.remove("mobile-drawer-open", "mobile-nav-lock", "mobile-nav-open");

      try {
        history.replaceState(null, "", hash);
      } catch {
        // Ignore URL update failures.
      }

      scrollElementWithOffset(target, { behavior: "smooth" });
    });

    const syncFromHash = (behavior = "auto") => {
      if (!window.location.hash) return;
      const target = getHashTarget(window.location.hash);
      if (!target) return;
      scrollElementWithOffset(target, { behavior });
    };

    if (window.location.hash) {
      window.requestAnimationFrame(() => {
        window.setTimeout(() => {
          syncFromHash("auto");
        }, 0);
      });
    }

    window.addEventListener("hashchange", () => {
      syncFromHash("smooth");
    });
  }

  function preloadImage(src) {
    if (!src || preloadedHeroImages.has(src)) return;
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    preloadedHeroImages.add(src);
  }

  function cloneDefaultConfig() {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return cloneDefaultConfig();
      const parsed = JSON.parse(raw);
      const merged = {
        ...cloneDefaultConfig(),
        ...parsed
      };
      if (Array.isArray(merged.stats)) {
        merged.stats = merged.stats.map((item) => {
          if (!item || typeof item !== "object") return item;
          const label = String(item.label || "").trim().toLowerCase();
          if (label === "students") {
            return {
              ...item,
              value: "1300+",
              label: "Students"
            };
          }
          if (label === "qualified staff" || label === "teachers" || label === "teacher") {
            return {
              ...item,
              value: "30+",
              label: "Teachers"
            };
          }
          if (
            label === "see pass rate" ||
            label === "technical students" ||
            label === "technical student" ||
            label === "technical student option"
          ) {
            return {
              ...item,
              value: "100+",
              label: "Technical Students"
            };
          }
          if (
            label === "years legacy" ||
            label === "years of academic legacy" ||
            label === "years of experience"
          ) {
            return {
              ...item,
              value: "50+",
              label: "Years of Experience"
            };
          }
          return item;
        });
      }
      return merged;
    } catch {
      return cloneDefaultConfig();
    }
  }

  function saveConfig(config) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  }

  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || "";
  }

  function setLink(id, href, label) {
    const el = document.getElementById(id);
    if (!el) return;
    el.setAttribute("href", href || "#");
    if (label) el.textContent = label;
  }

  function isExternalNoticeLink(value) {
    return /^https?:\/\//i.test(String(value || "").trim());
  }

  function formatNoticeDate(value) {
    const raw = String(value || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      return "";
    }

    const date = new Date(`${raw}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return raw;
    }

    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    }).format(date);
  }

  function normalizeNoticeItems(items) {
    return (Array.isArray(items) ? items : [])
      .map((item) => {
        if (typeof item === "string") {
          const title = item.trim();
          if (!title) return null;
          return {
            title,
            message: "",
            publishedOn: "",
            pinned: false,
            linkLabel: "View Notice",
            linkUrl: "/notice-board"
          };
        }

        if (!item || typeof item !== "object") {
          return null;
        }

        const title = String(item.title || item.message || "").trim();
        if (!title) {
          return null;
        }

        const linkUrl = String(item.linkUrl || "").trim();
        return {
          title,
          message: String(item.message || "").trim(),
          publishedOn: String(item.publishedOn || "").trim(),
          pinned: Boolean(item.pinned),
          linkLabel: String(item.linkLabel || "").trim() || (linkUrl ? "Read Notice" : ""),
          linkUrl
        };
      })
      .filter(Boolean);
  }

  function getFallbackNoticeItems(config) {
    return normalizeNoticeItems(Array.isArray(config.calendar) ? config.calendar.slice(0, 3) : []);
  }

  function buildNoticeLink(item, className) {
    const link = document.createElement("a");
    link.className = className;
    link.href = item.linkUrl || "/notice-board";

    if (isExternalNoticeLink(link.href)) {
      link.target = "_blank";
      link.rel = "noopener noreferrer";
    }

    return link;
  }

  function renderNoticeSummaryList(noticeItems) {
    const ul = document.getElementById("notice-list");
    if (!ul) return;

    const notices = normalizeNoticeItems(noticeItems);
    ul.innerHTML = "";

    if (!notices.length) {
      const li = document.createElement("li");
      li.className = "home-notice-item is-empty";
      li.textContent = "No notices added yet.";
      ul.appendChild(li);
      return;
    }

    notices.forEach((item) => {
      const li = document.createElement("li");
      li.className = "home-notice-item";

      const link = buildNoticeLink(item, "home-notice-link");
      if (item.pinned) {
        link.classList.add("is-pinned");
      }

      const formattedDate = formatNoticeDate(item.publishedOn);
      if (formattedDate) {
        const date = document.createElement("span");
        date.className = "home-notice-date";
        date.textContent = formattedDate;
        link.appendChild(date);
      }

      const title = document.createElement("span");
      title.className = "home-notice-title";
      title.textContent = item.title;
      link.appendChild(title);

      li.appendChild(link);
      ul.appendChild(li);
    });
  }

  function renderNotices(config) {
    renderNoticeSummaryList(getFallbackNoticeItems(config));
  }

  function createNoticeBoardCard(item) {
    const article = document.createElement("article");
    article.className = "notice-board-card";
    if (item.pinned) {
      article.classList.add("is-pinned");
    }

    const meta = document.createElement("div");
    meta.className = "notice-board-card-meta";

    const dateBadge = document.createElement("span");
    dateBadge.className = "notice-board-badge";
    dateBadge.textContent = formatNoticeDate(item.publishedOn) || "School Notice";
    meta.appendChild(dateBadge);

    if (item.pinned) {
      const pinBadge = document.createElement("span");
      pinBadge.className = "notice-board-badge notice-board-badge-pin";
      pinBadge.textContent = "Pinned";
      meta.appendChild(pinBadge);
    }

    const title = document.createElement("h3");
    title.textContent = item.title;

    const message = document.createElement("p");
    message.className = "notice-board-message";
    message.textContent = item.message || "Please contact the school office for full details.";

    article.append(meta, title, message);

    if (item.linkUrl) {
      const actions = document.createElement("div");
      actions.className = "notice-board-card-actions";
      const link = buildNoticeLink(item, "notice-board-card-link");
      link.textContent = item.linkLabel || "Read Notice";
      actions.appendChild(link);
      article.appendChild(actions);
    }

    return article;
  }

  function renderNoticeBoardPage(noticeItems) {
    const grid = document.querySelector("[data-notice-board-grid]");
    if (!grid) return;

    const emptyState = document.querySelector("[data-notice-board-empty]");
    const notices = normalizeNoticeItems(noticeItems);
    const searchInput = document.querySelector("[data-notice-search]");

    function render(query = "") {
      const normalizedQuery = String(query).trim().toLowerCase();
      const filteredNotices = normalizedQuery
        ? notices.filter((item) => `${item.title} ${item.message}`.toLowerCase().includes(normalizedQuery))
        : notices;
      grid.innerHTML = "";
      if (emptyState) emptyState.hidden = Boolean(filteredNotices.length);
      filteredNotices.forEach((item, index) => {
        const card = createNoticeBoardCard(item);
        card.style.setProperty("--notice-stagger", `${index * 72}ms`);
        grid.appendChild(card);
        window.requestAnimationFrame(() => card.classList.add("is-visible"));
      });
    }

    if (searchInput instanceof HTMLInputElement && !searchInput.dataset.searchReady) {
      searchInput.dataset.searchReady = "true";
      searchInput.addEventListener("input", () => render(searchInput.value));
    }
    render(searchInput instanceof HTMLInputElement ? searchInput.value : "");
  }

  function initLiveNoticeBoard(config) {
    if (document.getElementById("notice-list")) {
      renderNoticeSummaryList(getFallbackNoticeItems(config));
      fetchPublicNotices(3).then((notices) => {
        if (!Array.isArray(notices) || !notices.length) {
          return;
        }
        renderNoticeSummaryList(notices);
      });
    }

    if (document.querySelector("[data-notice-board-grid]")) {
      fetchPublicNotices(40).then((notices) => {
        renderNoticeBoardPage(notices);
      });
    }
  }

  function renderStats(config) {
    const wrap = document.getElementById("stats-grid");
    if (!wrap) return;
    wrap.innerHTML = "";
    (config.stats || []).forEach((item) => {
      const box = document.createElement("article");
      box.className = "stat-card";
      box.innerHTML = "<strong></strong><span></span>";
      box.querySelector("strong").textContent = item.value || "";
      box.querySelector("span").textContent = item.label || "";
      wrap.appendChild(box);
    });
  }

  function renderGallery(containerId, config, overrideItems) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    wrap.innerHTML = "";
    const galleryItems =
      Array.isArray(overrideItems) && overrideItems.length
        ? overrideItems
        : containerId === "home-gallery-grid"
          ? HOME_CAMPUS_HIGHLIGHTS
          : (config.gallery || []);
    galleryItems.forEach((path, index) => {
      const item = document.createElement("article");
      item.className = "panel";
      const img = document.createElement("img");
      img.src = path;
      img.alt = "Gallery " + (index + 1);
      img.loading = "lazy";
      img.decoding = "async";
      img.setAttribute("fetchpriority", "low");
      item.appendChild(img);
      wrap.appendChild(item);
    });
  }

  function getHomeHighlightFallbackPool() {
    const presetFiltered = filterHighlightImages(HOME_CAMPUS_HIGHLIGHTS);
    return presetFiltered.length ? presetFiltered : COLLAGE_FALLBACK_IMAGES;
  }

  function getHomeHighlightDisplayCards(imagePool = getHomeHighlightFallbackPool()) {
    const safePool = Array.from(
      new Set(
        (Array.isArray(imagePool) ? imagePool : [])
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    );
    const poolSet = new Set(safePool);
    const featured = HOME_CAMPUS_FEATURED.filter((item) => poolSet.has(item));
    const fill = safePool.filter((item) => !featured.includes(item));

    return {
      safePool,
      displayCards: selectGalleryCards([...featured, ...fill], 3)
    };
  }

  async function renderGalleryAsync(containerId, config, overrideItems) {
    const wrap = document.getElementById(containerId);
    if (!wrap) return [];
    wrap.innerHTML = "";
    const galleryItems =
      Array.isArray(overrideItems) && overrideItems.length
        ? overrideItems
        : containerId === "home-gallery-grid"
          ? HOME_CAMPUS_HIGHLIGHTS
          : (config.gallery || []);
    const uniqueItems = Array.from(
      new Set(
        (galleryItems || [])
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    );
    if (!uniqueItems.length) {
      wrap.innerHTML = "<p class=\"gallery-empty\">No photos available right now.</p>";
      return [];
    }

    uniqueItems.forEach((path, index) => {
      const item = document.createElement("article");
      item.className = "panel";
      const img = document.createElement("img");
      img.src = path;
      img.alt = "Gallery " + (index + 1);
      img.loading = "lazy";
      img.decoding = "async";
      img.setAttribute("fetchpriority", index < 4 ? "high" : "low");
      attachSkeleton(item, img);
      item.appendChild(img);
      wrap.appendChild(item);
    });

    return uniqueItems;
  }

  async function initGalleryPage(config) {
    if (!document.body.classList.contains("gallery-page")) return;
    setupPublicGalleryAutoRefresh();
    const managedAlbums = await fetchManagedGalleryAlbums();
    if (managedAlbums !== null) {
      initManagedGalleryAlbumsPage(managedAlbums);
      return;
    }

    const apiImages = await fetchManagedGalleryImages();
    if (apiImages !== null) {
      await renderGalleryAsync("gallery-grid", config, apiImages.slice(0, GALLERY_MAX_ITEMS));
      initPremiumGalleryPage();
      return;
    }

    const shouldSkipDiscover = isConstrainedDevice();

    const discoveredEvents = shouldSkipDiscover ? [] : await discoverFolderImages(EVENTS_DIR);
    const eventPool = (discoveredEvents.length ? discoveredEvents : EVENTS_PRESET_IMAGES).slice(
      0,
      GALLERY_MAX_PER_FOLDER
    );

    const discoveredCampus = shouldSkipDiscover ? [] : await discoverFolderImages(CAMPUS_DIR);
    const campusPool = (discoveredCampus.length ? discoveredCampus : CAMPUS_PRESET_IMAGES).slice(
      0,
      GALLERY_MAX_PER_FOLDER
    );

    const discoveredTouring = shouldSkipDiscover ? [] : await discoverFolderImages(TOURING_DIR);
    const touringPool = (discoveredTouring.length ? discoveredTouring : TOURING_PRESET_IMAGES).slice(
      0,
      GALLERY_MAX_PER_FOLDER
    );

    const merged = Array.from(new Set([...eventPool, ...campusPool, ...touringPool])).slice(
      0,
      GALLERY_MAX_ITEMS
    );

    await renderGalleryAsync("gallery-grid", config, merged);
    initPremiumGalleryPage();
  }

  function buildGalleryAssetUrl(assetPath, version) {
    const normalizedPath = String(assetPath || "").trim().replace(/^\/+/, "");
    if (!normalizedPath) return "";
    const safeVersion = Math.max(1, Number(version) || 1);
    const suffix = normalizedPath.includes("?") ? "&" : "?";
    return `/${normalizedPath}${suffix}v=${safeVersion}`;
  }

  function getGalleryVideoMimeType(assetPath) {
    const normalizedPath = String(assetPath || "").split("?")[0].toLowerCase();
    if (normalizedPath.endsWith(".webm")) return "video/webm";
    return "video/mp4";
  }

  function setGalleryVideoSource(video, assetPath, version) {
    if (!(video instanceof HTMLVideoElement)) return;
    const src = buildGalleryAssetUrl(assetPath, version);
    video.pause();
    video.removeAttribute("src");
    video.replaceChildren();
    if (!src) {
      video.load();
      return;
    }

    const source = document.createElement("source");
    source.src = src;
    source.type = getGalleryVideoMimeType(assetPath);
    video.src = src;
    video.appendChild(source);
    video.preload = "auto";
    video.load();
  }

  function formatGalleryDuration(seconds) {
    const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0));
    if (!totalSeconds) return "";
    const minutes = Math.floor(totalSeconds / 60);
    const remainingSeconds = totalSeconds % 60;
    return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  function createGalleryMediaNode(photo, options = {}) {
    const mediaType = String(photo?.mediaType || "image").trim().toLowerCase();
    const preferPoster = options.preferPoster !== false;
    const sourcePath =
      mediaType === "video" && !preferPoster
        ? photo.path
        : (photo.thumbnailPath || photo.path);
    const sourceVersion =
      mediaType === "video" && !preferPoster
        ? photo.version
        : (photo.thumbnailPath ? photo.thumbnailVersion : photo.version);
    const src = buildGalleryAssetUrl(sourcePath, sourceVersion);
    if (!src) return null;

    if (mediaType === "video") {
      const video = document.createElement("video");
      setGalleryVideoSource(video, photo.path, photo.version);
      if (preferPoster && photo.thumbnailPath) {
        video.poster = buildGalleryAssetUrl(photo.thumbnailPath, photo.thumbnailVersion);
      }
      video.preload = preferPoster ? "metadata" : "auto";
      video.muted = photo.muted !== false;
      video.playsInline = true;
      video.controls = !preferPoster;
      video.setAttribute("aria-label", photo.title || "Gallery video");
      return video;
    }

    const img = document.createElement("img");
    img.src = src;
    img.alt = photo.title || "Gallery preview";
    img.loading = "lazy";
    img.decoding = "async";
    return img;
  }

  async function fetchManagedGalleryAlbums() {
    try {
      const res = await fetch("/api/gallery-albums", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Request failed for /api/gallery-albums");
      }

      const responseVersion = normalizeGalleryVersion(res.headers.get("x-gallery-version"));
      if (responseVersion) {
        storeStoredGalleryVersion(responseVersion);
      }

      const payload = await res.json();
      if (!Array.isArray(payload)) {
        return [];
      }

      return payload
        .map((album, albumIndex) => {
          const photos = Array.isArray(album?.photos)
            ? album.photos
              .map((photo, photoIndex) => {
                const path = String(photo?.path || "").trim();
                if (!path) return null;
                return {
                  key: `${String(album?.name || albumIndex)}:${String(photo?.name || photoIndex)}`,
                  name: String(photo?.name || `photo-${photoIndex + 1}`).trim() || `photo-${photoIndex + 1}`,
                  path,
                  mediaType: String(photo?.mediaType || "image").trim().toLowerCase() || "image",
                  muted: photo?.muted !== false,
                  thumbnailPath: String(photo?.thumbnailPath || "").trim(),
                  version: Math.max(1, Number(photo?.version) || 1),
                  thumbnailVersion: Math.max(
                    1,
                    Number(photo?.thumbnailVersion) || Number(photo?.version) || 1
                  ),
                };
              })
              .filter(Boolean)
            : [];

          return {
            key: `album:${String(album?.name || albumIndex).trim().toLowerCase() || albumIndex}`,
            name: String(album?.name || "").trim(),
            label: String(album?.label || "Album").trim() || "Album",
            anchor: String(album?.anchor || "").trim(),
            photoCount: Math.max(0, Number(album?.photoCount) || photos.length),
            coverPath: String(album?.coverPath || photos[0]?.path || "").trim(),
            coverThumbnailPath: String(album?.coverThumbnailPath || photos[0]?.thumbnailPath || "").trim(),
            coverVersion: Math.max(1, Number(album?.coverVersion) || Number(photos[0]?.version) || 1),
            coverThumbnailVersion: Math.max(
              1,
              Number(album?.coverThumbnailVersion) ||
              Number(photos[0]?.thumbnailVersion) ||
              Number(photos[0]?.version) ||
              1
            ),
            photos,
          };
        })
        .filter((album) => album.photos.length > 0);
    } catch {
      return null;
    }
  }

  async function fetchManagedGalleryImages() {
    const sessionKey = buildSessionApiCacheKey("gallery-images");
    const cached = readSessionApiCacheValue(sessionKey);
    if (typeof cached !== "undefined") {
      return cached;
    }

    try {
      const res = await fetch("/api/gallery-images", { cache: "no-store" });
      if (!res.ok) {
        throw new Error("Request failed for /api/gallery-images");
      }

      const responseVersion = normalizeGalleryVersion(res.headers.get("x-gallery-version"));
      if (responseVersion) {
        storeStoredGalleryVersion(responseVersion);
      }

      const payload = await res.json();
      const normalized = Array.isArray(payload)
        ? Array.from(
          new Set(
            payload
              .map((item) => String(item || "").trim())
              .filter(Boolean)
          )
        )
        : null;

      return writeSessionApiCacheValue(sessionKey, normalized, GALLERY_IMAGES_SESSION_TTL_MS);
    } catch {
      const stale = readSessionApiCacheValue(sessionKey, { allowExpired: true });
      return typeof stale !== "undefined" ? stale : null;
    }
  }

  function setupPublicGalleryAutoRefresh() {
    if (galleryAutoRefreshInitialized || !document.body.classList.contains("gallery-page")) {
      return;
    }

    galleryAutoRefreshInitialized = true;
    let currentVersion = readStoredGalleryVersion();
    let latestSignalTs = readGalleryRefreshSignal()?.ts || 0;
    let reloadScheduled = false;
    let versionCheckPromise = null;

    function syncCurrentGalleryVersion() {
      const storedVersion = readStoredGalleryVersion();
      if (storedVersion) {
        currentVersion = storedVersion;
      }

      return currentVersion;
    }

    function reloadGallery(nextVersion) {
      if (reloadScheduled) {
        return;
      }

      const normalizedVersion = storeStoredGalleryVersion(nextVersion);
      if (normalizedVersion) {
        currentVersion = normalizedVersion;
      }

      reloadScheduled = true;
      clearGalleryRuntimeCaches();
      window.setTimeout(() => {
        window.location.reload();
      }, 70);
    }

    function handleGalleryRefreshSignal(signal) {
      if (!signal || reloadScheduled) {
        return;
      }

      syncCurrentGalleryVersion();

      if (signal.ts <= latestSignalTs) {
        return;
      }
      latestSignalTs = signal.ts;

      if (!signal.version) {
        reloadGallery(currentVersion);
        return;
      }

      if (!currentVersion || signal.version > currentVersion) {
        reloadGallery(signal.version);
      }
    }

    function checkGalleryVersion() {
      if (reloadScheduled || document.hidden) {
        return Promise.resolve();
      }

      syncCurrentGalleryVersion();

      if (versionCheckPromise) {
        return versionCheckPromise;
      }

      versionCheckPromise = fetchGalleryVersion()
        .then((nextVersion) => {
          if (!nextVersion || reloadScheduled) {
            return;
          }

          if (!currentVersion) {
            currentVersion = storeStoredGalleryVersion(nextVersion);
            return;
          }

          if (nextVersion > currentVersion) {
            reloadGallery(nextVersion);
          }
        })
        .finally(() => {
          versionCheckPromise = null;
        });

      return versionCheckPromise;
    }

    window.addEventListener("storage", (event) => {
      if (event.key !== GALLERY_REFRESH_BROADCAST_KEY || !event.newValue) {
        return;
      }

      handleGalleryRefreshSignal(readGalleryRefreshSignalFromValue(event.newValue));
    });

    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        return;
      }

      handleGalleryRefreshSignal(readGalleryRefreshSignal());
      void checkGalleryVersion();
    });

    window.addEventListener("pageshow", () => {
      handleGalleryRefreshSignal(readGalleryRefreshSignal());
      void checkGalleryVersion();
    });

    window.setInterval(() => {
      void checkGalleryVersion();
    }, GALLERY_VERSION_POLL_INTERVAL_MS);

    void checkGalleryVersion();
  }

  function initManagedGalleryAlbumsPage(managedAlbums) {
    if (!document.body.classList.contains("gallery-page")) return;

    const wrap = document.getElementById("gallery-grid");
    const albumsView = document.getElementById("gallery-albums-view");
    const photosView = document.getElementById("gallery-photos-view");
    const albumsWrap = document.getElementById("gallery-albums");
    const countEl = document.getElementById("gallery-count");
    const albumCountEl = document.getElementById("gallery-album-count");
    const albumTitleEl = document.getElementById("gallery-album-title");
    const backBtn = document.getElementById("gallery-back-btn");
    const showMoreBtn = document.getElementById("gallery-show-more");
    if (!wrap || !albumsView || !photosView || !albumsWrap || !countEl || !albumCountEl || !albumTitleEl || !backBtn) {
      return;
    }

    wrap.innerHTML = "";
    albumsWrap.innerHTML = "";

    const albumsOnly = Array.isArray(managedAlbums) ? managedAlbums.filter((album) => album?.photos?.length) : [];
    if (!albumsOnly.length) {
      countEl.textContent = "No photos available right now.";
      albumCountEl.textContent = "0 albums";
      return;
    }

    const allPhotos = albumsOnly.flatMap((album) =>
      album.photos.map((photo, index) => ({
        ...photo,
        albumKey: album.key,
        albumLabel: album.label,
        title: buildGalleryPhotoTitle(photo.path, index, photo.mediaType),
      }))
    );

    const albums = [
      {
        key: "all",
        label: "All Photos",
        coverPath: albumsOnly[0].coverPath,
        coverThumbnailPath: albumsOnly[0].coverThumbnailPath,
        coverVersion: albumsOnly[0].coverVersion,
        coverThumbnailVersion: albumsOnly[0].coverThumbnailVersion,
        photos: allPhotos,
      },
      ...albumsOnly.map((album) => ({
        ...album,
        photos: album.photos.map((photo, index) => ({
          ...photo,
          albumKey: album.key,
          albumLabel: album.label,
          title: buildGalleryPhotoTitle(photo.path, index, photo.mediaType),
        })),
      })),
    ];
    const albumLookup = new Map(albums.map((album) => [album.key, album]));
    albumCountEl.textContent = `${albumsOnly.length} album${albumsOnly.length === 1 ? "" : "s"}`;

    const albumButtons = new Map();
    albums.forEach((album, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "galleryx-album-card";
      button.dataset.galleryAlbumKey = album.key;

      const thumb = document.createElement("span");
      thumb.className = "galleryx-album-thumb";

      const coverPhoto = {
        path: album.coverPath,
        thumbnailPath: album.coverThumbnailPath,
        version: album.coverVersion,
        thumbnailVersion: album.coverThumbnailVersion,
        mediaType: album.photos[0]?.mediaType || "image",
        title: `${album.label} album cover`,
      };
      const cover = createGalleryMediaNode(coverPhoto, { preferPoster: true });
      if (cover) {
        if (cover instanceof HTMLImageElement) {
          cover.alt = `${album.label} album cover`;
        }
        thumb.appendChild(cover);
      }

      const meta = document.createElement("span");
      meta.className = "galleryx-album-meta";

      const name = document.createElement("strong");
      name.textContent = album.label;

      const count = document.createElement("small");
      count.textContent = `${album.photos.length} item${album.photos.length === 1 ? "" : "s"}`;

      meta.appendChild(name);
      meta.appendChild(count);
      button.appendChild(thumb);
      button.appendChild(meta);
      albumsWrap.appendChild(button);
      albumButtons.set(album.key, button);

      window.setTimeout(() => {
        button.classList.add("is-visible");
      }, 90 + index * 70);

      button.addEventListener("click", () => {
        openAlbum(album.key);
      });
    });

    const PHOTO_PAGE_SIZE = 6;
    let activeAlbumKey = "all";
    let activePhotoItems = [];
    let currentLightboxIndex = 0;
    let showAllPhotos = false;

    const lightbox = document.createElement("div");
    lightbox.className = "galleryx-lightbox";
    lightbox.innerHTML = `
      <button type="button" class="galleryx-lightbox-close" aria-label="Close photo viewer">&times;</button>
      <button type="button" class="galleryx-lightbox-nav galleryx-lightbox-prev" aria-label="Previous photo">&#10094;</button>
      <figure class="galleryx-lightbox-frame">
        <img class="galleryx-lightbox-image" alt="Gallery preview" />
        <video class="galleryx-lightbox-image galleryx-lightbox-video" playsinline controls preload="metadata"></video>
        <figcaption class="galleryx-lightbox-caption"></figcaption>
      </figure>
      <button type="button" class="galleryx-lightbox-nav galleryx-lightbox-next" aria-label="Next photo">&#10095;</button>
    `;
    document.body.appendChild(lightbox);

    const lightboxImage = lightbox.querySelector(".galleryx-lightbox-image");
    const lightboxVideo = lightbox.querySelector(".galleryx-lightbox-video");
    const lightboxCaption = lightbox.querySelector(".galleryx-lightbox-caption");
    const closeBtn = lightbox.querySelector(".galleryx-lightbox-close");
    const prevBtn = lightbox.querySelector(".galleryx-lightbox-prev");
    const nextBtn = lightbox.querySelector(".galleryx-lightbox-next");

    function showAlbumsView() {
      albumsView.classList.remove("is-hidden");
      photosView.classList.add("is-hidden");
      if (showMoreBtn) showMoreBtn.style.display = "none";
    }

    function showPhotosView() {
      albumsView.classList.add("is-hidden");
      photosView.classList.remove("is-hidden");
    }

    function highlightActiveAlbum(albumKey) {
      albumButtons.forEach((button, key) => {
        button.classList.toggle("is-active", key === albumKey);
      });
    }

    function updateLightbox() {
      const photo = activePhotoItems[currentLightboxIndex];
      if (!photo || !lightboxImage || !lightboxVideo || !lightboxCaption) return;
      const mediaType = String(photo.mediaType || "image").trim().toLowerCase();
      if (mediaType === "video") {
        lightboxImage.style.display = "none";
        lightboxImage.removeAttribute("src");
        lightboxVideo.style.display = "block";
        lightboxVideo.muted = photo.muted !== false;
        lightboxVideo.controls = true;
        lightboxVideo.preload = "auto";
        lightboxVideo.poster = photo.thumbnailPath
          ? buildGalleryAssetUrl(photo.thumbnailPath, photo.thumbnailVersion)
          : "";
        setGalleryVideoSource(lightboxVideo, photo.path, photo.version);
      } else {
        lightboxVideo.pause();
        lightboxVideo.style.display = "none";
        lightboxVideo.removeAttribute("src");
        lightboxVideo.replaceChildren();
        lightboxVideo.load();
        lightboxImage.style.display = "block";
        lightboxImage.src = buildGalleryAssetUrl(photo.path, photo.version);
        lightboxImage.alt = photo.title || "Gallery preview";
      }
      const durationLabel = mediaType === "video" ? formatGalleryDuration(photo.durationSeconds) : "";
      lightboxCaption.textContent = [
        photo.title,
        durationLabel,
        `${currentLightboxIndex + 1} / ${activePhotoItems.length}`
      ].filter(Boolean).join(" - ");
    }

    function openLightbox(index) {
      if (!activePhotoItems.length) return;
      currentLightboxIndex = Math.max(0, Math.min(index, activePhotoItems.length - 1));
      updateLightbox();
      lightbox.classList.add("is-open");
      document.body.classList.add("galleryx-lightbox-open");
    }

    function closeLightbox() {
      if (lightboxVideo) {
        lightboxVideo.pause();
      }
      lightbox.classList.remove("is-open");
      document.body.classList.remove("galleryx-lightbox-open");
    }

    function showPrevious() {
      if (!activePhotoItems.length) return;
      currentLightboxIndex =
        (currentLightboxIndex - 1 + activePhotoItems.length) % activePhotoItems.length;
      updateLightbox();
    }

    function showNext() {
      if (!activePhotoItems.length) return;
      currentLightboxIndex = (currentLightboxIndex + 1) % activePhotoItems.length;
      updateLightbox();
    }

    function renderAlbumPhotos(album) {
      const orderedPhotos = Array.isArray(album?.photos) ? album.photos : [];
      const displayPhotos = showAllPhotos ? orderedPhotos : orderedPhotos.slice(0, PHOTO_PAGE_SIZE);
      wrap.innerHTML = "";
      activePhotoItems = displayPhotos;
      activeAlbumKey = album.key;
      albumTitleEl.textContent = album.label;

      displayPhotos.forEach((photo, index) => {
        const card = document.createElement("article");
        card.className = "panel galleryx-card";
        card.dataset.galleryAlbumKey = album.key;
        card.dataset.galleryAlbumLabel = album.label;
        card.style.setProperty("--gallery-delay", `${index * 58}ms`);

        const media = createGalleryMediaNode(photo, { preferPoster: true });
        if (!media) {
          return;
        }
        if (media instanceof HTMLImageElement) {
          media.alt = photo.title;
          media.setAttribute("fetchpriority", index < 2 ? "high" : "low");
        }
        attachSkeleton(card, media);
        card.appendChild(media);

        const overlay = document.createElement("div");
        overlay.className = "galleryx-overlay";

        const chip = document.createElement("span");
        chip.className = "galleryx-chip";
        chip.textContent = String(photo.mediaType || "image").toLowerCase() === "video" ? "Video" : album.label;

        const title = document.createElement("strong");
        title.textContent = photo.title;

        overlay.appendChild(chip);
        overlay.appendChild(title);
        card.appendChild(overlay);
        card.addEventListener("click", () => {
          openLightbox(index);
        });

        wrap.appendChild(card);
        window.requestAnimationFrame(() => {
          card.classList.add("is-visible");
        });
      });

      if (showAllPhotos || orderedPhotos.length <= PHOTO_PAGE_SIZE) {
        countEl.textContent = `${orderedPhotos.length} item${orderedPhotos.length === 1 ? "" : "s"} in this album`;
      } else {
        countEl.textContent = `${displayPhotos.length} of ${orderedPhotos.length} items`;
      }

      if (showMoreBtn) {
        const hasMore = orderedPhotos.length > PHOTO_PAGE_SIZE;
        showMoreBtn.style.display = hasMore ? "inline-flex" : "none";
        showMoreBtn.textContent = showAllPhotos ? "Show Less" : "Show More";
        showMoreBtn.classList.toggle("is-less", showAllPhotos);
      }

      highlightActiveAlbum(album.key);
    }

    function openAlbum(albumKey) {
      const album = albumLookup.get(albumKey) || albumLookup.get("all");
      if (!album) return;
      showAllPhotos = false;
      renderAlbumPhotos(album);
      showPhotosView();
    }

    if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
    if (prevBtn) prevBtn.addEventListener("click", showPrevious);
    if (nextBtn) nextBtn.addEventListener("click", showNext);
    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });

    document.addEventListener("keydown", (event) => {
      if (!lightbox.classList.contains("is-open")) return;
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    });

    backBtn.addEventListener("click", showAlbumsView);
    if (showMoreBtn) {
      showMoreBtn.addEventListener("click", () => {
        const album = albumLookup.get(activeAlbumKey);
        if (!album) return;
        showAllPhotos = !showAllPhotos;
        renderAlbumPhotos(album);
      });
    }

    showAlbumsView();
  }

  function inferGalleryCategory(path, index) {
    const source = String(path || "").toLowerCase();
    if (source.includes("cls") || source.includes("class")) return "classroom";
    if (source.includes("cap") || source.includes("event") || source.includes("sport")) return "events";
    if (source.includes("hig") || source.includes("campus") || source.includes("lab")) return "school";
    const fallback = ["school", "events", "classroom"];
    return fallback[index % fallback.length];
  }

  function formatGalleryLabel(value) {
    const cleaned = String(value || "Album")
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const lower = cleaned.toLowerCase();
    const mapped =
      lower === "campus" || lower === "collage" || lower === "collage higlight"
        ? "school"
        : cleaned;
    return mapped.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  function getGalleryAlbumMeta(path, index) {
    const source = String(path || "")
      .split("?")[0]
      .replace(/\\/g, "/");
    const parts = source.split("/").filter(Boolean);
    const lowerParts = parts.map((part) => part.toLowerCase());
    const photosIndex = lowerParts.lastIndexOf("photos");
    const hasNestedFolder = photosIndex >= 0 && parts.length > photosIndex + 2;

    if (hasNestedFolder) {
      const folderName = parts[photosIndex + 1];
      return {
        key: `folder:${folderName.toLowerCase()}`,
        label: formatGalleryLabel(folderName)
      };
    }

    const category = inferGalleryCategory(source, index);
    return {
      key: `category:${category}`,
      label: formatGalleryLabel(category)
    };
  }

  function buildGalleryPhotoTitle(path, index, mediaType = "image") {
    return String(mediaType || "image").toLowerCase() === "video" ? `Video ${index + 1}` : `Photo ${index + 1}`;
  }

  function initPremiumGalleryPage() {
    if (!document.body.classList.contains("gallery-page")) return;

    const wrap = document.getElementById("gallery-grid");
    const albumsView = document.getElementById("gallery-albums-view");
    const photosView = document.getElementById("gallery-photos-view");
    const albumsWrap = document.getElementById("gallery-albums");
    const countEl = document.getElementById("gallery-count");
    const albumCountEl = document.getElementById("gallery-album-count");
    const albumTitleEl = document.getElementById("gallery-album-title");
    const backBtn = document.getElementById("gallery-back-btn");
    const showMoreBtn = document.getElementById("gallery-show-more");
    const cards = Array.from(wrap.querySelectorAll(".panel"));
    if (!wrap || !albumsView || !photosView || !albumsWrap || !countEl || !albumCountEl || !albumTitleEl || !backBtn) {
      return;
    }

    if (!cards.length) {
      countEl.textContent = "No photos available right now.";
      albumCountEl.textContent = "0 albums";
      return;
    }

    const albumsByKey = new Map();
    const preparedCards = cards
      .map((card, index) => {
        const img = card.querySelector("img");
        if (!img) return null;

        const src = img.getAttribute("src") || "";
        const photoTitle = buildGalleryPhotoTitle(src, index);
        const albumMeta = getGalleryAlbumMeta(src, index);
        card.classList.add("galleryx-card");
        card.dataset.galleryAlbumKey = albumMeta.key;
        card.dataset.galleryAlbumLabel = albumMeta.label;
        card.style.setProperty("--gallery-delay", `${index * 70}ms`);

        img.loading = "lazy";
        img.decoding = "async";

        const overlay = document.createElement("div");
        overlay.className = "galleryx-overlay";

        const chip = document.createElement("span");
        chip.className = "galleryx-chip";
        chip.textContent = albumMeta.label;

        const title = document.createElement("strong");
        title.textContent = photoTitle;

        overlay.appendChild(chip);
        overlay.appendChild(title);
        card.appendChild(overlay);

        if (!albumsByKey.has(albumMeta.key)) {
          albumsByKey.set(albumMeta.key, {
            key: albumMeta.key,
            label: albumMeta.label,
            cover: src,
            indexes: []
          });
        }

        albumsByKey.get(albumMeta.key).indexes.push(index);

        return {
          card,
          img,
          src,
          title: photoTitle,
          albumKey: albumMeta.key,
          albumLabel: albumMeta.label,
          index
        };
      })
      .filter(Boolean);

    if (!preparedCards.length) {
      countEl.textContent = "No photos available right now.";
      albumCountEl.textContent = "0 albums";
      return;
    }

    const albums = [
      {
        key: "all",
        label: "All Photos",
        cover: preparedCards[0].src,
        indexes: preparedCards.map((item) => item.index)
      },
      ...Array.from(albumsByKey.values()).sort((a, b) => a.label.localeCompare(b.label))
    ];
    const albumLookup = new Map(albums.map((album) => [album.key, album]));

    albumCountEl.textContent = `${albums.length} album${albums.length === 1 ? "" : "s"}`;

    const albumButtons = new Map();
    albumsWrap.innerHTML = "";

    albums.forEach((album, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "galleryx-album-card";
      button.dataset.galleryAlbumKey = album.key;

      const thumb = document.createElement("span");
      thumb.className = "galleryx-album-thumb";

      const cover = document.createElement("img");
      cover.src = album.cover;
      cover.alt = `${album.label} album cover`;
      cover.loading = "lazy";
      cover.decoding = "async";
      thumb.appendChild(cover);

      const meta = document.createElement("span");
      meta.className = "galleryx-album-meta";

      const name = document.createElement("strong");
      name.textContent = album.label;

      const count = document.createElement("small");
      count.textContent = `${album.indexes.length} photo${album.indexes.length === 1 ? "" : "s"}`;

      meta.appendChild(name);
      meta.appendChild(count);
      button.appendChild(thumb);
      button.appendChild(meta);

      albumsWrap.appendChild(button);
      albumButtons.set(album.key, button);

      window.setTimeout(() => {
        button.classList.add("is-visible");
      }, 90 + index * 70);

      button.addEventListener("click", () => {
        openAlbum(album.key);
      });
    });

    const PHOTO_PAGE_SIZE = 6;
    let activeAlbumKey = "all";
    let activePhotoIndexes = preparedCards.map((item) => item.index);
    let currentLightboxIndex = 0;
    let showAllPhotos = false;

    const lightbox = document.createElement("div");
    lightbox.className = "galleryx-lightbox";
    lightbox.innerHTML = `
      <button type="button" class="galleryx-lightbox-close" aria-label="Close photo viewer">&times;</button>
      <button type="button" class="galleryx-lightbox-nav galleryx-lightbox-prev" aria-label="Previous photo">&#10094;</button>
      <figure class="galleryx-lightbox-frame">
        <img class="galleryx-lightbox-image" alt="Gallery preview" />
        <figcaption class="galleryx-lightbox-caption"></figcaption>
      </figure>
      <button type="button" class="galleryx-lightbox-nav galleryx-lightbox-next" aria-label="Next photo">&#10095;</button>
    `;
    document.body.appendChild(lightbox);

    const lightboxImage = lightbox.querySelector(".galleryx-lightbox-image");
    const lightboxCaption = lightbox.querySelector(".galleryx-lightbox-caption");
    const closeBtn = lightbox.querySelector(".galleryx-lightbox-close");
    const prevBtn = lightbox.querySelector(".galleryx-lightbox-prev");
    const nextBtn = lightbox.querySelector(".galleryx-lightbox-next");

    function showAlbumsView() {
      albumsView.classList.remove("is-hidden");
      photosView.classList.add("is-hidden");
      if (showMoreBtn) showMoreBtn.style.display = "none";
    }

    function showPhotosView() {
      albumsView.classList.add("is-hidden");
      photosView.classList.remove("is-hidden");
    }

    function highlightActiveAlbum(albumKey) {
      albumButtons.forEach((button, key) => {
        button.classList.toggle("is-active", key === albumKey);
      });
    }

    function showAlbumPhotos(album) {
      const visibleSet = new Set(album.indexes);
      const orderedVisible = preparedCards
        .filter((item) => visibleSet.has(item.index))
        .map((item) => item.index);
      const displayIndexes = showAllPhotos ? orderedVisible : orderedVisible.slice(0, PHOTO_PAGE_SIZE);
      const displaySet = new Set(displayIndexes);

      displayIndexes.forEach((cardIndex, orderIndex) => {
        const item = preparedCards[cardIndex];
        if (!item) return;
        const label = `Photo ${orderIndex + 1}`;
        item.title = label;
        if (item.img) {
          item.img.alt = label;
        }
        const overlayTitle = item.card ? item.card.querySelector(".galleryx-overlay strong") : null;
        if (overlayTitle) {
          overlayTitle.textContent = label;
        }
      });

      preparedCards.forEach((item) => {
        const isVisible = displaySet.has(item.index);
        item.card.classList.toggle("is-filtered-out", !isVisible);

        if (isVisible) {
          item.card.classList.remove("is-visible");
          item.card.style.setProperty("--gallery-delay", `${displayIndexes.indexOf(item.index) * 58}ms`);
          window.requestAnimationFrame(() => {
            item.card.classList.add("is-visible");
          });
        }
      });

      activePhotoIndexes = displayIndexes;
      activeAlbumKey = album.key;
      albumTitleEl.textContent = album.label;
      if (showAllPhotos || orderedVisible.length <= PHOTO_PAGE_SIZE) {
        countEl.textContent = `${orderedVisible.length} photo${orderedVisible.length === 1 ? "" : "s"} in this album`;
      } else {
        countEl.textContent = `${displayIndexes.length} of ${orderedVisible.length} photos`;
      }
      if (showMoreBtn) {
        const hasMore = orderedVisible.length > PHOTO_PAGE_SIZE;
        showMoreBtn.style.display = hasMore ? "inline-flex" : "none";
        showMoreBtn.textContent = showAllPhotos ? "Show Less" : "Show More";
        showMoreBtn.classList.toggle("is-less", showAllPhotos);
      }
      highlightActiveAlbum(album.key);
    }

    function openAlbum(albumKey) {
      const album = albumLookup.get(albumKey) || albumLookup.get("all");
      if (!album) return;
      showAllPhotos = false;
      showAlbumPhotos(album);
      showPhotosView();
    }

    function updateLightbox() {
      const activeIndex = activePhotoIndexes[currentLightboxIndex];
      const photo = preparedCards[activeIndex];
      if (!photo || !lightboxImage || !lightboxCaption) return;
      lightboxImage.src = photo.src;
      lightboxImage.alt = photo.img.alt || photo.title;
      lightboxCaption.textContent = `${photo.title} - ${currentLightboxIndex + 1} / ${activePhotoIndexes.length}`;
    }

    function openLightbox(index) {
      if (!activePhotoIndexes.length) return;
      const resolvedIndex = activePhotoIndexes.indexOf(index);
      if (resolvedIndex === -1) return;
      currentLightboxIndex = resolvedIndex;
      updateLightbox();
      lightbox.classList.add("is-open");
      document.body.classList.add("galleryx-lightbox-open");
    }

    function closeLightbox() {
      lightbox.classList.remove("is-open");
      document.body.classList.remove("galleryx-lightbox-open");
    }

    function showPrevious() {
      if (!activePhotoIndexes.length) return;
      currentLightboxIndex =
        (currentLightboxIndex - 1 + activePhotoIndexes.length) % activePhotoIndexes.length;
      updateLightbox();
    }

    function showNext() {
      if (!activePhotoIndexes.length) return;
      currentLightboxIndex = (currentLightboxIndex + 1) % activePhotoIndexes.length;
      updateLightbox();
    }

    preparedCards.forEach((item) => {
      item.card.addEventListener("click", () => {
        if (item.card.classList.contains("is-filtered-out")) return;
        openLightbox(item.index);
      });
    });

    if (closeBtn) closeBtn.addEventListener("click", closeLightbox);
    if (prevBtn) prevBtn.addEventListener("click", showPrevious);
    if (nextBtn) nextBtn.addEventListener("click", showNext);

    lightbox.addEventListener("click", (event) => {
      if (event.target === lightbox) closeLightbox();
    });

    document.addEventListener("keydown", (event) => {
      if (!lightbox.classList.contains("is-open")) return;
      if (event.key === "Escape") closeLightbox();
      if (event.key === "ArrowLeft") showPrevious();
      if (event.key === "ArrowRight") showNext();
    });

    backBtn.addEventListener("click", showAlbumsView);
    if (showMoreBtn) {
      showMoreBtn.addEventListener("click", () => {
        const album = albumLookup.get(activeAlbumKey);
        if (!album) return;
        showAllPhotos = !showAllPhotos;
        showAlbumPhotos(album);
      });
    }
    showAlbumsView();
  }

  function selectGalleryCards(paths, cardCount) {
    const uniqueItems = Array.from(
      new Set(
        (Array.isArray(paths) ? paths : [])
          .map((item) => String(item || "").trim())
          .filter(Boolean)
      )
    );
    if (!uniqueItems.length) return [];
    const cardsNeeded = Math.max(1, cardCount || uniqueItems.length);
    const cards = [];
    for (let i = 0; i < cardsNeeded; i += 1) {
      cards.push(uniqueItems[i % uniqueItems.length]);
    }
    return cards;
  }

  function sortHighlightImages(paths) {
    return Array.from(paths || []).sort((a, b) => {
      const ax = String(a).match(/hig(\d+)\./i);
      const bx = String(b).match(/hig(\d+)\./i);
      const an = ax ? Number(ax[1]) : Number.POSITIVE_INFINITY;
      const bn = bx ? Number(bx[1]) : Number.POSITIVE_INFINITY;
      if (an !== bn) return an - bn;
      return String(a).localeCompare(String(b));
    });
  }

  function filterHighlightImages(paths) {
    return (paths || []).filter((src) => {
      const normalized = String(src || "").toLowerCase();
      return !HIGHLIGHT_EXCLUDE_FILES.some((name) => normalized.endsWith(name));
    });
  }

  async function discoverFolderImages(folderPath) {
    const normalizedPath = String(folderPath || "").trim();
    if (!normalizedPath) return [];
    if (folderImageRequests.has(normalizedPath)) {
      return folderImageRequests.get(normalizedPath);
    }

    const discoveryRequest = (async () => {
      const cacheKey = `kankai:folder-list:${normalizedPath}`;
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length) {
            return parsed;
          }
        }
      } catch { }

      try {
        const res = await fetch(normalizedPath, { cache: "default" });
        if (!res.ok) return [];
        const html = await res.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, "text/html");
        const base = new URL(normalizedPath, window.location.href);
        const files = Array.from(doc.querySelectorAll("a[href]"))
          .map((link) => link.getAttribute("href") || "")
          .filter((href) => href && !href.startsWith("?") && !href.startsWith("#") && !href.endsWith("/"))
          .map((href) => new URL(href, base).href)
          .filter((href) => IMAGE_FILE_PATTERN.test(href));
        const uniqueFiles = Array.from(new Set(files));
        if (uniqueFiles.length) {
          sessionStorage.setItem(cacheKey, JSON.stringify(uniqueFiles));
        }
        return uniqueFiles;
      } catch {
        return [];
      }
    })();

    folderImageRequests.set(normalizedPath, discoveryRequest);
    return discoveryRequest;
  }

  function startGalleryRotation(containerId, imagePool) {
    if (prefersReducedMotion()) return;
    const constrained = isConstrainedDevice();

    const wrap = document.getElementById(containerId);
    if (!wrap) return;
    if (galleryTimers[containerId]) {
      if (typeof galleryTimers[containerId].destroy === "function") {
        galleryTimers[containerId].destroy();
      } else {
        clearInterval(galleryTimers[containerId]);
      }
      galleryTimers[containerId] = null;
    }

    const pool = Array.from(new Set((imagePool || []).filter(Boolean)));
    if (pool.length < 2) return;

    const panels = Array.from(wrap.querySelectorAll(".panel"));
    if (!panels.length) return;

    const states = panels
      .map((panel, index) => {
        const startIndex = index % pool.length;
        const existingRotator = panel.querySelector(":scope > .gallery-rotator");
        let layerA = existingRotator ? existingRotator.querySelector(".gallery-layer.layer-a") : null;
        let layerB = existingRotator ? existingRotator.querySelector(".gallery-layer.layer-b") : null;

        if (!layerA || !layerB) {
          const sourceImg = panel.querySelector(":scope > img");
          if (!sourceImg) return null;
          const altText = sourceImg.alt || `Gallery ${index + 1}`;

          const rotator = document.createElement("div");
          rotator.className = "gallery-rotator";

          layerA = document.createElement("img");
          layerA.className = "gallery-layer layer-a is-visible";
          layerA.alt = altText;
          layerA.loading = index < 2 ? "eager" : "lazy";
          layerA.decoding = "async";

          layerB = document.createElement("img");
          layerB.className = "gallery-layer layer-b";
          layerB.alt = altText;
          layerB.loading = "lazy";
          layerB.decoding = "async";

          rotator.appendChild(layerA);
          rotator.appendChild(layerB);
          panel.replaceChild(rotator, sourceImg);
        }

        layerA.src = pool[startIndex];
        layerB.src = pool[(startIndex + 1) % pool.length];
        layerA.classList.add("is-visible");
        layerB.classList.remove("is-visible");
        layerA.classList.remove("is-prep");
        layerB.classList.remove("is-prep");

        return {
          layerA,
          layerB,
          showA: true,
          currentIndex: startIndex
        };
      })
      .filter(Boolean);

    if (!states.length) return;

    const rotationIntervalMs = constrained ? 7600 : 5000;
    const rotationLoop = createManagedTimeoutLoop(() => {
      states.forEach((state, index) => {
        const visibleLayer = state.showA ? state.layerA : state.layerB;
        const hiddenLayer = state.showA ? state.layerB : state.layerA;
        const nextIndex = (state.currentIndex + 1) % pool.length;
        preloadImage(pool[(nextIndex + 1) % pool.length]);
        hiddenLayer.src = pool[nextIndex];
        hiddenLayer.classList.add("is-prep");

        window.setTimeout(() => {
          hiddenLayer.classList.add("is-visible");
          visibleLayer.classList.remove("is-visible");
          hiddenLayer.classList.remove("is-prep");
          state.currentIndex = nextIndex;
          state.showA = !state.showA;
        }, 150 + index * 90);
      });
    }, rotationIntervalMs);

    const disconnectVisibility = createVisibilityManagedController(
      wrap,
      {
        onActivate() {
          rotationLoop.start(Math.min(rotationIntervalMs, constrained ? 2400 : 1600));
        },
        onDeactivate() {
          rotationLoop.stop();
        }
      },
      { rootMargin: "220px 0px" }
    );

    galleryTimers[containerId] = {
      destroy() {
        rotationLoop.destroy();
        disconnectVisibility();
      }
    };
  }

  async function initCollageHighlightSection(config) {
    const wrap = document.getElementById("collage-highlight-grid");
    if (!wrap) return;
    const discovered = await discoverFolderImages(COLLAGE_HIGHLIGHT_DIR);
    const discoveredOrdered = sortHighlightImages(discovered);
    const discoveredFiltered = filterHighlightImages(discoveredOrdered);
    const presetFiltered = filterHighlightImages(COLLAGE_HIGHLIGHT_PRESET_IMAGES);
    const imagePool = discoveredFiltered.length ? discoveredFiltered : presetFiltered;
    const safePool = imagePool.length ? imagePool : COLLAGE_FALLBACK_IMAGES;
    const displayCards = selectGalleryCards(safePool, 3);
    renderGallery("collage-highlight-grid", config, displayCards);
    startGalleryRotation("collage-highlight-grid", filterHighlightImages(safePool));
  }

  function initHomeHighlights(config) {
    const wrap = document.getElementById("home-gallery-grid");
    if (!wrap) return;
    const featuredCards = selectGalleryCards(HOME_CAMPUS_FEATURED, 3);
    renderGallery("home-gallery-grid", config, featuredCards);
    startGalleryRotation("home-gallery-grid", HOME_CAMPUS_FEATURED);
  }

  function initHeroSlideshow(config) {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    if (typeof hero._destroyHeroSlideshow === "function") {
      hero._destroyHeroSlideshow();
    }
    const allImages = Array.from(new Set(HOME_HERO_CUSTOM_IMAGES.filter(Boolean)));
    const isMobileViewport = window.matchMedia("(max-width: 900px)").matches;
    const constrained = isConstrainedDevice();
    const reduceMotion = prefersReducedMotion();
    const images = allImages.slice();
    if (!images.length) return;
    const slideIntervalMs = constrained ? (isMobileViewport ? 7600 : 8200) : (isMobileViewport ? 6200 : 6800);

    const layerA = document.getElementById("hero-media-a");
    const layerB = document.getElementById("hero-media-b");
    if (!layerA || !layerB) return;

    let index = 0;
    let showA = true;
    layerA.style.backgroundImage = `url("${images[0]}")`;
    layerB.style.backgroundImage = "";
    layerA.classList.add("show");
    layerB.classList.remove("show");

    if (images.length > 1) {
      scheduleNonCriticalTask(() => {
        preloadImage(images[(index + 1) % images.length]);
      }, { timeout: 1800, fallbackDelay: 420, waitForLoad: true });
    }

    if (images.length === 1 || reduceMotion) return;

    const slideshowLoop = createManagedTimeoutLoop(() => {
      const nextIndex = (index + 1) % images.length;
      const nextImage = images[nextIndex];
      preloadImage(images[(nextIndex + 1) % images.length]);
      if (showA) {
        layerB.style.backgroundImage = `url("${nextImage}")`;
        layerB.classList.add("show");
        layerA.classList.remove("show");
      } else {
        layerA.style.backgroundImage = `url("${nextImage}")`;
        layerA.classList.add("show");
        layerB.classList.remove("show");
      }
      index = nextIndex;
      showA = !showA;
    }, slideIntervalMs);

    const disconnectVisibility = createVisibilityManagedController(
      hero,
      {
        onActivate() {
          slideshowLoop.start(Math.min(slideIntervalMs, constrained ? 2600 : 1800));
        },
        onDeactivate() {
          slideshowLoop.stop();
        }
      },
      { rootMargin: "260px 0px" }
    );

    hero._destroyHeroSlideshow = () => {
      slideshowLoop.destroy();
      disconnectVisibility();
    };
  }

  function initMobileWelcomeAnimation() {
    if (isConstrainedDevice()) return;

    let welcome = document.querySelector(".hero-mobile-welcome");
    if (!welcome) {
      const heroCopy = document.querySelector(".hero-copy");
      if (heroCopy) {
        welcome = document.createElement("p");
        welcome.className = "hero-mobile-welcome";
        welcome.textContent = "Wellcome to Kankai Secondary school";
        heroCopy.prepend(welcome);
      }
    }
    if (!welcome) return;
    if (!window.matchMedia || !window.matchMedia("(max-width: 980px)").matches) return;
    const body = document.body;
    if (body && body.classList.contains("home-page") && body.classList.contains("home-hero")) {
      body.classList.remove("mobile-welcome-ready");
    }
    welcome.style.display = "inline-block";
    welcome.style.opacity = "1";
    const variants = ["welcome-anim-drop", "welcome-anim-left", "welcome-anim-right", "welcome-anim-up"];

    function updateWelcomeOffsets() {
      const header = document.querySelector(".header");
      const headerHeight = header ? header.offsetHeight : 0;
      const welcomeRect = welcome.getBoundingClientRect();
      const distanceFromNav = Math.round(welcomeRect.top - headerHeight);
      const dropDistance = Number.isFinite(distanceFromNav) ? Math.max(0, distanceFromNav) : 160;
      const slideDistance = Math.max(420, Math.round(window.innerWidth * 1.1));
      welcome.style.setProperty("--welcome-drop", `${dropDistance}px`);
      welcome.style.setProperty("--welcome-slide", `${slideDistance}px`);
    }

    function startAnimation() {
      if (welcome.dataset.welcomeStarted === "true") return;
      welcome.dataset.welcomeStarted = "true";
      updateWelcomeOffsets();
      if (body && body.classList.contains("home-page") && body.classList.contains("home-hero")) {
        body.classList.add("mobile-welcome-ready");
      }
      const choice = variants[Math.floor(Math.random() * variants.length)];
      variants.forEach((cls) => welcome.classList.remove(cls));
      void welcome.offsetWidth;
      requestAnimationFrame(() => {
        welcome.classList.add(choice);
      });
      if (body && body.classList.contains("home-page") && body.classList.contains("home-hero")) {
        if (body.dataset.mobileHeroTimer) {
          window.clearTimeout(Number(body.dataset.mobileHeroTimer));
        }
        body.classList.remove("mobile-hero-ready");
        const timerId = window.setTimeout(() => {
          body.classList.add("mobile-hero-ready");
        }, 1000);
        body.dataset.mobileHeroTimer = String(timerId);
      }
    }

    function queueAnimationStart() {
      if (isIndexHomePage()) {
        whenHomepagePopupFlowComplete(({ hadPopup }) => {
          window.setTimeout(startAnimation, hadPopup ? 180 : 40);
        });
        return;
      }

      window.setTimeout(startAnimation, 420);
    }

    if (document.readyState === "complete") {
      queueAnimationStart();
    } else {
      window.addEventListener(
        "load",
        () => {
          queueAnimationStart();
        },
        { once: true }
      );
    }
  }

  function initPublicPages(config) {
    const homeHighlightGrid = document.getElementById("home-gallery-grid");
    if (homeHighlightGrid) {
      const { displayCards } = getHomeHighlightDisplayCards();
      renderGallery("home-gallery-grid", config, displayCards);
    }

    if (document.getElementById("hero-eyebrow")) {
      const isFixedHomeHero = document.body.classList.contains("home-page");
      if (!isFixedHomeHero) {
        setText("hero-eyebrow", config.hero.eyebrow);
        setText("hero-title", config.hero.title);
        setText("hero-description", config.hero.description);
        setLink("hero-cta-primary", config.hero.cta_primary_url, config.hero.cta_primary_text);
        setLink("hero-cta-secondary", config.hero.cta_secondary_url, config.hero.cta_secondary_text);
      }
      renderNotices(config);
      initHeroSlideshow(config);
      initMobileWelcomeAnimation();
    }
    initLiveNoticeBoard(config);
    renderStats(config);
    if (document.body.classList.contains("gallery-page")) {
      initGalleryPage(config);
    } else {
      renderGallery("gallery-grid", config);
      initPremiumGalleryPage();
    }

    if (homeHighlightGrid) {
      scheduleNonCriticalTask(() => {
        initHomeHighlights(config);
      }, { timeout: 1400, fallbackDelay: 180, waitForLoad: true });
    }

    scheduleNonCriticalTask(() => {
      initCollageHighlightSection(config);
    }, { timeout: 1600, fallbackDelay: 200, waitForLoad: true });
  }

  function isIndexHomePage() {
    return document.body.classList.contains("home-page") && document.body.classList.contains("home-hero");
  }

  function buildPopupQueue(settings) {
    const queue = [];
    const version = settings && settings.updatedAt ? String(settings.updatedAt) : "base";

    if (settings && settings.resultPublished && settings.resultPublished.enabled) {
      queue.push({
        id: "result-published",
        title: settings.resultPublished.title || "Result Has Been Published",
        message: settings.resultPublished.message || "The result has been published.",
        image: settings.resultPublished.image || "/photos/cls12.jpg",
        version
      });
    }

    if (settings && settings.entranceOpen && settings.entranceOpen.enabled) {
      queue.push({
        id: "entrance-open",
        title: settings.entranceOpen.title || "Computer Engineering Entrance Exam Is Open",
        message:
          settings.entranceOpen.message ||
          "Computer Engineering entrance exam is open. Contact school administration for details.",
        image: settings.entranceOpen.image || "/photos/571812628_1277087307556453_2291941728688117624_n.jpg",
        version
      });
    }

    return queue.filter((item) => {
      const key = `kankai-index-popup:${item.id}:${item.version}`;
      return sessionStorage.getItem(key) !== "1";
    });
  }

  function normalizeLatestUpdates(updates) {
    const source = Array.isArray(updates) ? updates : [];
    return DEFAULT_LATEST_UPDATES.map((defaultItem, index) => {
      const item = source[index] || {};
      const title = String(item.title || "").trim() || defaultItem.title;
      const message = String(item.message || "").trim() || defaultItem.message;
      return { title, message };
    });
  }

  function applyLatestUpdates(settings) {
    const cards = Array.from(document.querySelectorAll("[data-latest-update-card]"));
    if (!cards.length) return;

    const updates = normalizeLatestUpdates(settings && settings.latestUpdates);
    cards.forEach((card, index) => {
      const update = updates[index];
      if (!update) return;
      const titleNode = card.querySelector("[data-latest-update-title]");
      const messageNode = card.querySelector("[data-latest-update-message]");
      if (titleNode) {
        titleNode.textContent = update.title;
      }
      if (messageNode) {
        messageNode.textContent = update.message;
      }
    });

    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("kankai:latest-updates-refreshed"));
      if (window.ScrollTrigger && typeof window.ScrollTrigger.refresh === "function") {
        window.ScrollTrigger.refresh();
      }
    });
  }

  function initLatestUpdates() {
    if (!document.querySelector("[data-latest-updates-section]")) return;

    initLatestUpdatesProgress();

    fetchIndexPopupSettings("no-store").then((settings) => {
      applyLatestUpdates(settings);
    });
  }

  function initLatestUpdatesProgress() {
    const section = document.querySelector("[data-latest-updates-section]");
    const progress = document.querySelector("[data-latest-updates-progress]");
    if (!section || !progress || progress.dataset.ready === "true") return;

    const fill = progress.querySelector("[data-latest-updates-progress-fill]");
    const dots = Array.from(progress.querySelectorAll("[data-latest-updates-progress-dot]"));
    const cards = Array.from(section.querySelectorAll("[data-latest-update-card]"));
    if (!fill || !cards.length) return;

    progress.dataset.ready = "true";
    let frame = 0;

    const update = () => {
      frame = 0;
      const sectionRect = section.getBoundingClientRect();
      const viewHeight = Math.max(window.innerHeight, 1);
      const travel = Math.max(1, viewHeight + sectionRect.height);
      const value = Math.min(1, Math.max(0, (viewHeight - sectionRect.top) / travel));
      const activeIndex = Math.min(cards.length - 1, Math.floor(value * cards.length));

      fill.style.transform = `scaleX(${Math.max(0.08, value)})`;
      dots.forEach((dot, index) => {
        dot.classList.toggle("is-active", index === activeIndex);
        dot.classList.toggle("is-passed", index < activeIndex);
      });
    };

    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    requestUpdate();
  }

  function initGsapStackedCards() {
    const root = document.querySelector("[data-gsap-stacked-cards]");
    if (!root) return;

    const cards = Array.from(root.querySelectorAll("[data-stack-card]"));
    const progressFill = root.querySelector("[data-stack-progress-fill]");
    const progressDots = Array.from(root.querySelectorAll("[data-stack-progress-dot]"));
    if (cards.length < 2) return;

    const setFallbackState = () => {
      root.classList.remove("is-stack-active");
      root.classList.add("is-stack-fallback");
      if (progressFill) {
        progressFill.style.removeProperty("transform");
        progressFill.style.removeProperty("transform-origin");
      }
      cards.forEach((card) => {
        card.style.removeProperty("z-index");
        card.style.removeProperty("transform");
        card.style.removeProperty("pointer-events");
        card.style.removeProperty("opacity");
        card.style.removeProperty("--stack-shell-opacity");
        card.style.removeProperty("--stack-copy-opacity");
        card.style.removeProperty("--stack-index-opacity");
        card.style.removeProperty("--stack-tag-opacity");
        card.style.removeProperty("--stack-foot-opacity");
        card.style.removeProperty("--stack-card-transform");
        card.style.removeProperty("--stack-copy-shift");
        card.style.removeProperty("--stack-copy-scale");
        card.style.removeProperty("--stack-copy-blur");
        card.style.removeProperty("--stack-chip-shift");
        card.style.removeProperty("--stack-chip-blur");
        card.style.removeProperty("--stack-foot-shift");
        card.style.removeProperty("--stack-foot-blur");
        card.style.removeProperty("--stack-decoration-opacity");
        card.style.removeProperty("--stack-accent-scale");
        card.style.removeProperty("--stack-sheen-shift");
        card.classList.remove("is-stack-front", "is-stack-middle", "is-stack-back");
      });
    };

    if (typeof root._destroyGsapStackedCards === "function") {
      root._destroyGsapStackedCards();
    }
    setFallbackState();

    const stackStates = [
      {
        xPercent: 0,
        yPercent: 0,
        zOffset: 34,
        scale: 1,
        rotate: 0,
        rotateX: 0.1,
        shellOpacity: 1,
        copyOpacity: 1,
        indexOpacity: 1,
        tagOpacity: 1,
        footOpacity: 1,
        copyShift: 0,
        copyScale: 1,
        copyBlur: 0,
        chipShift: 0,
        chipBlur: 0,
        footShift: 0,
        footBlur: 0,
        decorationOpacity: 1,
        accentScale: 1,
        sheenShift: 54,
        depth: 30
      },
      {
        xPercent: 6.2,
        yPercent: 12.2,
        zOffset: -18,
        scale: 0.965,
        rotate: 1.45,
        rotateX: 2.1,
        shellOpacity: 0.96,
        copyOpacity: 0,
        indexOpacity: 0.72,
        tagOpacity: 0.82,
        footOpacity: 0,
        copyShift: 28,
        copyScale: 0.982,
        copyBlur: 9.5,
        chipShift: 12,
        chipBlur: 2.2,
        footShift: 18,
        footBlur: 4.8,
        decorationOpacity: 0.88,
        accentScale: 0.84,
        sheenShift: 92,
        depth: 20
      },
      {
        xPercent: 12.8,
        yPercent: 23.5,
        zOffset: -64,
        scale: 0.927,
        rotate: -1.6,
        rotateX: 3.6,
        shellOpacity: 0.84,
        copyOpacity: 0,
        indexOpacity: 0.44,
        tagOpacity: 0.58,
        footOpacity: 0,
        copyShift: 42,
        copyScale: 0.966,
        copyBlur: 14.5,
        chipShift: 20,
        chipBlur: 4.2,
        footShift: 26,
        footBlur: 7,
        decorationOpacity: 0.72,
        accentScale: 0.68,
        sheenShift: 132,
        depth: 10
      }
    ];

    const depthSlots = [30, 20, 10];
    let syncRaf = 0;
    let isEnabled = false;
    let isViewportActive = false;

    function clampNumber(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function mix(start, end, progress) {
      return start + (end - start) * progress;
    }

    function getStackSlot(cardIndex, activeIndex) {
      return (cardIndex - activeIndex + cards.length) % cards.length;
    }

    function getStackState(cardIndex, activeIndex) {
      return stackStates[Math.min(getStackSlot(cardIndex, activeIndex), stackStates.length - 1)];
    }

    function computeSectionProgress() {
      const rect = root.getBoundingClientRect();
      const topOffset = Math.max(88, getAnchorScrollOffset()) + 20;
      const travelDistance = Math.max(1, rect.height - window.innerHeight + topOffset);
      return clampNumber((-rect.top + topOffset) / travelDistance, 0, 1);
    }

    function applyRenderedCard(item, orderIndex) {
      const card = item.card;
      const transformValue =
        `translate3d(${item.xPercent}%, ${item.yPercent}%, ${item.zOffset}px) ` +
        `rotateX(${item.rotateX}deg) rotate(${item.rotate}deg) scale(${item.scale})`;
      card.style.zIndex = String(depthSlots[orderIndex] || 1);
      card.style.setProperty("--stack-card-transform", transformValue);
      card.style.transform = transformValue;
      card.style.pointerEvents = orderIndex === 0 ? "auto" : "none";
      card.style.opacity = String(item.shellOpacity);
      card.style.setProperty("--stack-shell-opacity", String(item.shellOpacity));
      card.style.setProperty("--stack-copy-opacity", String(item.copyOpacity));
      card.style.setProperty("--stack-index-opacity", String(item.indexOpacity));
      card.style.setProperty("--stack-tag-opacity", String(item.tagOpacity));
      card.style.setProperty("--stack-foot-opacity", String(item.footOpacity));
      card.style.setProperty("--stack-copy-shift", `${item.copyShift}px`);
      card.style.setProperty("--stack-copy-scale", String(item.copyScale));
      card.style.setProperty("--stack-copy-blur", `${item.copyBlur}px`);
      card.style.setProperty("--stack-chip-shift", `${item.chipShift}px`);
      card.style.setProperty("--stack-chip-blur", `${item.chipBlur}px`);
      card.style.setProperty("--stack-foot-shift", `${item.footShift}px`);
      card.style.setProperty("--stack-foot-blur", `${item.footBlur}px`);
      card.style.setProperty("--stack-decoration-opacity", String(item.decorationOpacity));
      card.style.setProperty("--stack-accent-scale", String(item.accentScale));
      card.style.setProperty("--stack-sheen-shift", `${item.sheenShift}%`);
      card.classList.toggle("is-stack-front", orderIndex === 0);
      card.classList.toggle("is-stack-middle", orderIndex === 1);
      card.classList.toggle("is-stack-back", orderIndex === 2);
    }

    function renderStack(progress) {
      const safeProgress = clampNumber(progress, 0, 1);
      const maxStageIndex = cards.length - 1;
      const scaledProgress = safeProgress * maxStageIndex;
      const startStage =
        scaledProgress >= maxStageIndex
          ? Math.max(0, maxStageIndex - 1)
          : Math.floor(scaledProgress);
      const endStage = Math.min(maxStageIndex, startStage + 1);
      const localProgress =
        scaledProgress >= maxStageIndex ? 1 : scaledProgress - startStage;
      const easedProgress = localProgress < 0.5
        ? 4 * localProgress * localProgress * localProgress
        : 1 - Math.pow(-2 * localProgress + 2, 3) / 2;
      const transitionPulse = Math.sin(localProgress * Math.PI);
      const incomingReveal = clampNumber((localProgress - 0.12) / 0.74, 0, 1);
      const footReveal = clampNumber((localProgress - 0.26) / 0.56, 0, 1);
      const outgoingFade = clampNumber(localProgress / 0.54, 0, 1);

      const renderedCards = cards.map((card, cardIndex) => {
        const startState = getStackState(cardIndex, startStage);
        const endState = getStackState(cardIndex, endStage);
        const startSlot = getStackSlot(cardIndex, startStage);
        const endSlot = getStackSlot(cardIndex, endStage);
        const item = {
          card,
          depth: mix(startState.depth, endState.depth, easedProgress),
          xPercent: mix(startState.xPercent, endState.xPercent, easedProgress),
          yPercent: mix(startState.yPercent, endState.yPercent, easedProgress),
          zOffset: mix(startState.zOffset, endState.zOffset, easedProgress),
          scale: mix(startState.scale, endState.scale, easedProgress),
          rotate: mix(startState.rotate, endState.rotate, easedProgress),
          rotateX: mix(startState.rotateX, endState.rotateX, easedProgress),
          shellOpacity: mix(startState.shellOpacity, endState.shellOpacity, easedProgress),
          copyOpacity: mix(startState.copyOpacity, endState.copyOpacity, easedProgress),
          indexOpacity: mix(startState.indexOpacity, endState.indexOpacity, easedProgress),
          tagOpacity: mix(startState.tagOpacity, endState.tagOpacity, easedProgress),
          footOpacity: mix(startState.footOpacity, endState.footOpacity, easedProgress),
          copyShift: mix(startState.copyShift, endState.copyShift, easedProgress),
          copyScale: mix(startState.copyScale, endState.copyScale, easedProgress),
          copyBlur: mix(startState.copyBlur, endState.copyBlur, easedProgress),
          chipShift: mix(startState.chipShift, endState.chipShift, easedProgress),
          chipBlur: mix(startState.chipBlur, endState.chipBlur, easedProgress),
          footShift: mix(startState.footShift, endState.footShift, easedProgress),
          footBlur: mix(startState.footBlur, endState.footBlur, easedProgress),
          decorationOpacity: mix(startState.decorationOpacity, endState.decorationOpacity, easedProgress),
          accentScale: mix(startState.accentScale, endState.accentScale, easedProgress),
          sheenShift: mix(startState.sheenShift, endState.sheenShift, easedProgress)
        };

        if (startSlot === 0 && endSlot === 2) {
          item.xPercent += transitionPulse * 1.6;
          item.yPercent -= transitionPulse * 6.4;
          item.zOffset += transitionPulse * 32;
          item.scale += transitionPulse * 0.02;
          item.rotate -= transitionPulse * 2.7;
          item.rotateX += transitionPulse * 0.8;
          item.shellOpacity = clampNumber(item.shellOpacity - transitionPulse * 0.14, 0.24, 1);
          item.copyOpacity *= 1 - outgoingFade;
          item.tagOpacity = clampNumber(item.tagOpacity - outgoingFade * 0.18, 0.2, 1);
          item.footOpacity *= 1 - clampNumber(localProgress / 0.46, 0, 1);
          item.copyShift -= transitionPulse * 22;
          item.copyScale += transitionPulse * 0.03;
          item.copyBlur += transitionPulse * 1.6;
          item.chipShift -= transitionPulse * 10;
          item.chipBlur += transitionPulse * 0.8;
          item.footShift -= transitionPulse * 12;
          item.footBlur += transitionPulse * 1.1;
          item.decorationOpacity = clampNumber(item.decorationOpacity + transitionPulse * 0.1, 0.2, 1.2);
          item.accentScale = clampNumber(item.accentScale + transitionPulse * 0.18, 0.6, 1.2);
          item.sheenShift = mix(48, 18, outgoingFade);
        } else if (startSlot === 1 && endSlot === 0) {
          item.xPercent -= transitionPulse * 2.2;
          item.yPercent -= transitionPulse * 4.8;
          item.zOffset += transitionPulse * 46;
          item.scale += transitionPulse * 0.026;
          item.rotate -= transitionPulse * 1.8;
          item.rotateX -= transitionPulse * 0.9;
          item.shellOpacity = clampNumber(item.shellOpacity + transitionPulse * 0.08, 0.24, 1);
          item.copyOpacity = Math.max(item.copyOpacity, incomingReveal);
          item.indexOpacity = Math.max(item.indexOpacity, 0.72 + incomingReveal * 0.28);
          item.tagOpacity = Math.max(item.tagOpacity, 0.6 + incomingReveal * 0.4);
          item.footOpacity = Math.max(item.footOpacity, footReveal);
          item.copyShift -= transitionPulse * 14;
          item.copyScale += transitionPulse * 0.04;
          item.copyBlur = Math.max(0, item.copyBlur - incomingReveal * 9);
          item.chipShift -= transitionPulse * 8;
          item.chipBlur = Math.max(0, item.chipBlur - incomingReveal * 2.2);
          item.footShift -= transitionPulse * 10;
          item.footBlur = Math.max(0, item.footBlur - footReveal * 5);
          item.decorationOpacity = clampNumber(item.decorationOpacity + transitionPulse * 0.18, 0.2, 1.2);
          item.accentScale = clampNumber(item.accentScale + transitionPulse * 0.22, 0.6, 1.14);
          item.sheenShift = mix(88, 44, incomingReveal);
        } else if (startSlot === 2 && endSlot === 1) {
          item.xPercent -= transitionPulse * 0.8;
          item.yPercent -= transitionPulse * 1.8;
          item.zOffset += transitionPulse * 18;
          item.scale += transitionPulse * 0.012;
          item.rotate += transitionPulse * 0.6;
          item.rotateX -= transitionPulse * 0.4;
          item.shellOpacity = clampNumber(item.shellOpacity + transitionPulse * 0.04, 0.2, 1);
          item.copyShift -= transitionPulse * 4;
          item.copyBlur = Math.max(0, item.copyBlur - transitionPulse * 1.2);
          item.chipShift -= transitionPulse * 3;
          item.chipBlur = Math.max(0, item.chipBlur - transitionPulse * 0.5);
          item.decorationOpacity = clampNumber(item.decorationOpacity + transitionPulse * 0.08, 0.2, 1.2);
          item.accentScale = clampNumber(item.accentScale + transitionPulse * 0.08, 0.6, 1.04);
          item.sheenShift = mix(124, 94, localProgress);
        }

        return item;
      });

      const orderedCards = renderedCards
        .slice()
        .sort((left, right) => right.depth - left.depth);
      orderedCards.forEach(applyRenderedCard);

      const frontCard = orderedCards[0] ? orderedCards[0].card : null;
      const activeIndex = frontCard ? Number(frontCard.dataset.stackCard || 0) : 0;

      progressDots.forEach((dot, index) => {
        dot.classList.toggle("is-active", index === activeIndex);
        dot.classList.toggle("is-passed", index < activeIndex);
      });

      if (progressFill) {
        progressFill.style.transformOrigin = "top center";
        progressFill.style.transform = `scaleY(${Math.max(0.08, safeProgress)})`;
      }
    }

    function syncStack() {
      syncRaf = 0;
      if (!isEnabled) return;
      renderStack(computeSectionProgress());
    }

    function queueSync() {
      if (syncRaf) return;
      syncRaf = window.requestAnimationFrame(syncStack);
    }

    function enableStack() {
      if (isEnabled) return;
      isEnabled = true;
      root.classList.add("is-stack-active");
      root.classList.remove("is-stack-fallback");
      queueSync();
    }

    function disableStack() {
      isEnabled = false;
      if (syncRaf) {
        window.cancelAnimationFrame(syncRaf);
        syncRaf = 0;
      }
      setFallbackState();
    }

    function syncEnabledState() {
      const canEnhance =
        !prefersReducedMotion() &&
        !shouldUseLiteMotion() &&
        window.innerWidth > 980;
      if (canEnhance && isViewportActive) {
        enableStack();
        queueSync();
      } else {
        disableStack();
      }
    }

    function evaluateMode() {
      syncEnabledState();
    }

    function handleScroll() {
      if (!isEnabled) return;
      queueSync();
    }

    function handleResize() {
      evaluateMode();
      if (isEnabled) {
        queueSync();
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleResize, { passive: true });
    window.addEventListener("load", handleResize, { once: true });
    window.addEventListener("kankai:latest-updates-refreshed", handleResize);

    const disconnectVisibilityController = createVisibilityManagedController(root, {
      rootMargin: "240px 0px",
      onActivate() {
        isViewportActive = true;
        syncEnabledState();
      },
      onDeactivate() {
        isViewportActive = false;
        disableStack();
      }
    });

    evaluateMode();

    root._destroyGsapStackedCards = () => {
      disconnectVisibilityController();
      disableStack();
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("kankai:latest-updates-refreshed", handleResize);
    };
  }

  function initIndexAnnouncementPopup() {
    if (!isIndexHomePage()) {
      completeHomepagePopupFlow(false);
      return;
    }

    const lastCheckedAt = Number(sessionStorage.getItem(POPUP_SETTINGS_CHECK_KEY) || 0);
    if (Date.now() - lastCheckedAt < POPUP_SETTINGS_CHECK_INTERVAL_MS) {
      completeHomepagePopupFlow(false);
      return;
    }

    fetchIndexPopupSettings("default")
      .then((settings) => {
        sessionStorage.setItem(POPUP_SETTINGS_CHECK_KEY, String(Date.now()));
        if (!settings) {
          completeHomepagePopupFlow(false);
          return;
        }
        const queue = buildPopupQueue(settings);
        if (!queue.length) {
          completeHomepagePopupFlow(false);
          return;
        }

        const overlay = document.createElement("div");
        overlay.className = "notice-popup-overlay";
        overlay.innerHTML = `
          <div class="notice-popup-card" role="dialog" aria-modal="true" aria-label="School announcement">
            <button type="button" class="notice-popup-close" aria-label="Close popup">&times;</button>
            <div class="notice-popup-media-wrap">
              <div class="notice-popup-media"></div>
              <div class="notice-popup-ribbon">Official Announcement</div>
              <div class="notice-popup-glow"></div>
            </div>
            <div class="notice-popup-content">
              <div class="notice-popup-head">
                <img class="notice-popup-logo" src="/photos/logo.png" alt="Kankai Secondary School logo" loading="eager" decoding="async" fetchpriority="high" />
                <div>
                  <p class="notice-popup-brand">Kankai Secondary School</p>
                  <p class="notice-popup-subbrand">Sitali, Ilam - Result Portal</p>
                </div>
              </div>
              <div class="notice-popup-badge-row">
                <span class="notice-popup-badge">Latest Notice</span>
                <span class="notice-popup-step"></span>
              </div>
              <h2 class="notice-popup-title"></h2>
              <p class="notice-popup-message"></p>
              <div class="notice-popup-actions">
                <a href="/result" class="btn notice-popup-result-link">Go to Result Page</a>
                <button type="button" class="btn notice-popup-primary">Continue</button>
                <button type="button" class="notice-popup-secondary">No Thanks</button>
              </div>
            </div>
          </div>
        `;

        document.body.appendChild(overlay);
        document.body.classList.add("popup-open");

        const media = overlay.querySelector(".notice-popup-media");
        const title = overlay.querySelector(".notice-popup-title");
        const message = overlay.querySelector(".notice-popup-message");
        const step = overlay.querySelector(".notice-popup-step");
        const card = overlay.querySelector(".notice-popup-card");
        const closeBtn = overlay.querySelector(".notice-popup-close");
        const resultLink = overlay.querySelector(".notice-popup-result-link");
        const primaryBtn = overlay.querySelector(".notice-popup-primary");
        const secondaryBtn = overlay.querySelector(".notice-popup-secondary");

        let index = 0;

        function seenKey(item) {
          return `kankai-index-popup:${item.id}:${item.version}`;
        }

        function renderCurrent() {
          const item = queue[index];
          if (!item) return;

          media.style.backgroundImage = `url("${item.image}")`;
          title.textContent = item.title;
          message.textContent = item.message;
          step.textContent = `Notice ${index + 1} / ${queue.length}`;
          resultLink.style.display = item.id === "result-published" ? "inline-flex" : "none";
          primaryBtn.textContent = index < queue.length - 1 ? "View Next" : "Close Notice";
          card.classList.remove("notice-popup-card-refresh");
          window.requestAnimationFrame(() => {
            card.classList.add("notice-popup-card-refresh");
          });
        }

        function advancePopup() {
          const item = queue[index];
          if (item) {
            sessionStorage.setItem(seenKey(item), "1");
          }

          if (index < queue.length - 1) {
            index += 1;
            renderCurrent();
            return;
          }

          document.removeEventListener("keydown", onEsc);
          document.body.classList.remove("popup-open");
          overlay.remove();
          completeHomepagePopupFlow(true);
        }

        function onEsc(event) {
          if (event.key === "Escape") {
            advancePopup();
          }
        }

        closeBtn.addEventListener("click", advancePopup);
        resultLink.addEventListener("click", () => {
          const item = queue[index];
          if (item) {
            sessionStorage.setItem(seenKey(item), "1");
          }
        });
        primaryBtn.addEventListener("click", advancePopup);
        secondaryBtn.addEventListener("click", advancePopup);
        overlay.addEventListener("click", (event) => {
          if (event.target === overlay) {
            advancePopup();
          }
        });
        document.addEventListener("keydown", onEsc);

        renderCurrent();
      })
      .catch(() => {
        completeHomepagePopupFlow(false);
      });
  }

  function initSimpleForms() {
    const forms = document.querySelectorAll("form[data-static-form]");
    forms.forEach((form) => {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        const status = form.querySelector(".form-status");
        if (status) status.textContent = "Submitted successfully.";
        form.reset();
      });
    });
  }

  function initAdmissionForm() {
    const form = document.querySelector("form[data-admission-form]");
    if (!(form instanceof HTMLFormElement)) return;

    const status = form.querySelector(".form-status");
    const submitButton = form.querySelector('button[type="submit"]');
    const submitLabel = submitButton ? submitButton.textContent : "Submit Admission Request";

    function setStatus(message, tone) {
      if (!status) return;
      status.textContent = message || "";
      status.classList.remove("is-success", "is-error", "is-pending");
      if (tone) {
        status.classList.add(`is-${tone}`);
      }
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeoutId = controller
        ? window.setTimeout(() => controller.abort(), FORM_REQUEST_TIMEOUT_MS)
        : 0;

      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
      }

      setStatus("Sending admission request...", "pending");

      try {
        const response = await fetch(form.action || "/api/admission-request", {
          method: "POST",
          body: new FormData(form),
          signal: controller ? controller.signal : undefined,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error((payload && payload.error) || "Unable to submit the admission request right now.");
        }

        form.reset();
        setStatus(
          (payload && payload.message) || "Admission request sent successfully. We will contact you soon.",
          "success"
        );
      } catch (error) {
        const timeoutMessage =
          "The admission request is taking too long. Please try again or contact the school office directly.";
        setStatus(
          error instanceof DOMException && error.name === "AbortError"
            ? timeoutMessage
            : error instanceof Error
              ? error.message
              : "Unable to submit the admission request right now.",
          "error"
        );
      } finally {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false;
          submitButton.textContent = submitLabel;
        }
      }
    });
  }

  function initContactForm() {
    const form = document.querySelector("form[data-contact-form]");
    if (!(form instanceof HTMLFormElement)) return;

    const status = form.querySelector(".form-status");
    const submitButton = form.querySelector('button[type="submit"]');
    const submitLabel = submitButton ? submitButton.textContent : "Send Inquiry";

    function setStatus(message, tone) {
      if (!status) return;
      status.textContent = message || "";
      status.classList.remove("is-success", "is-error", "is-pending");
      if (tone) {
        status.classList.add(`is-${tone}`);
      }
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timeoutId = controller
        ? window.setTimeout(() => controller.abort(), FORM_REQUEST_TIMEOUT_MS)
        : 0;

      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
        submitButton.textContent = "Sending...";
      }

      setStatus("Sending your message...", "pending");

      try {
        const payload = Object.fromEntries(new FormData(form).entries());
        const response = await fetch(form.action || "/api/contact-request", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller ? controller.signal : undefined,
        });
        const responsePayload = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error((responsePayload && responsePayload.error) || "Unable to send your message right now.");
        }

        form.reset();
        setStatus(
          (responsePayload && responsePayload.message) || "Message sent successfully. We will contact you soon.",
          "success"
        );
      } catch (error) {
        const timeoutMessage =
          "The message is taking too long. Please try again or contact the school office directly.";
        setStatus(
          error instanceof DOMException && error.name === "AbortError"
            ? timeoutMessage
            : error instanceof Error
              ? error.message
              : "Unable to send your message right now.",
          "error"
        );
      } finally {
        if (timeoutId) {
          window.clearTimeout(timeoutId);
        }
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false;
          submitButton.textContent = submitLabel;
        }
      }
    });
  }

  function initNumberInputWheelLock() {
    document.addEventListener(
      "wheel",
      () => {
        const active = document.activeElement;
        if (!(active instanceof HTMLInputElement)) return;
        if (active.type !== "number") return;
        // Avoid wheel-scroll lock when a number input is focused.
        active.blur();
      },
      { passive: true }
    );
  }

  function initNavEffects() {
    const body = document.body;
    const header = document.querySelector(".header");
    if (!header) return;

    let lastY = window.scrollY || 0;
    let ticking = false;
    const SCROLLED_AT = 24;
    const HIDE_AFTER = 18;
    const SHOW_AT_TOP = 10;
    const DIRECTION_DELTA = 1;
    const DESKTOP_MIN_WIDTH = 981;

    function isDesktopViewport() {
      return window.innerWidth >= DESKTOP_MIN_WIDTH;
    }

    function updateScrolledState() {
      const y = window.scrollY || 0;
      const delta = y - lastY;
      const scrollingDown = delta > DIRECTION_DELTA;
      const scrollingUp = delta < -DIRECTION_DELTA;
      const isDesktop = isDesktopViewport();

      body.classList.toggle("nav-scrolled", y > SCROLLED_AT);

      if (isDesktop) {
        body.classList.remove("mobile-drawer-open", "mobile-nav-lock");
      }

      if (!isDesktop) {
        body.classList.remove("nav-hidden");
      } else if (y <= SHOW_AT_TOP || scrollingUp) {
        body.classList.remove("nav-hidden");
      } else if (scrollingDown && y > HIDE_AFTER) {
        body.classList.add("nav-hidden");
      }

      lastY = y;
      ticking = false;
    }

    updateScrolledState();
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          window.requestAnimationFrame(updateScrolledState);
          ticking = true;
        }
      },
      { passive: true }
    );

    window.addEventListener(
      "resize",
      () => {
        updateScrolledState();
      },
      { passive: true }
    );
  }

  function initMobileNavStrip() {
    if (document.body.classList.contains("mobile-nav-ready")) return;

    const nav = document.querySelector(".links");
    if (!nav) return;

    const MOBILE_BREAKPOINT = 980;
    const activeLink = nav.querySelector("a.active");

    function centerActiveLink() {
      if (window.innerWidth > MOBILE_BREAKPOINT || !activeLink) return;
      activeLink.scrollIntoView({ block: "nearest", inline: "center" });
    }

    centerActiveLink();
    window.addEventListener(
      "resize",
      () => {
        centerActiveLink();
      },
      { passive: true }
    );
  }

  function initPremiumMobileNav() {
    const body = document.body;
    const header = document.querySelector(".header");
    const navWrap = document.querySelector(".nav");
    const nav = document.querySelector(".links");
    if (!body || !header || !navWrap || !nav) return;

    const MOBILE_BREAKPOINT = 980;

    if (!nav.id) {
      nav.id = "primary-nav";
    }

    let toggleBtn =
      navWrap.querySelector(".premium-mobile-toggle") ||
      navWrap.querySelector("#appleMobileToggle");

    if (!toggleBtn) {
      toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.className = "premium-mobile-toggle";
      navWrap.insertBefore(toggleBtn, navWrap.firstChild);
    } else {
      toggleBtn.classList.add("premium-mobile-toggle");
    }

    // Keep the mobile toggle at the end of the nav row (right side).
    navWrap.appendChild(toggleBtn);

    toggleBtn.innerHTML = "<span></span><span></span><span></span>";
    toggleBtn.setAttribute("aria-controls", nav.id);
    toggleBtn.setAttribute("aria-label", "Open navigation menu");
    toggleBtn.setAttribute("aria-expanded", "false");

    let backdrop = document.querySelector(".mobile-nav-backdrop");
    if (!backdrop) {
      backdrop = document.createElement("button");
      backdrop.type = "button";
      backdrop.className = "mobile-nav-backdrop";
      backdrop.setAttribute("aria-hidden", "true");
      backdrop.tabIndex = -1;
      body.appendChild(backdrop);
    }

    // Ensure the drawer never stays open after refresh or bfcache restore.
    body.classList.remove("mobile-drawer-open", "mobile-nav-lock", "mobile-nav-open");

    function isMobileViewport() {
      return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function syncMobileTopOffset() {
      const top = Math.ceil(header.getBoundingClientRect().height) + 8;
      body.style.setProperty("--mobile-nav-top", `${top}px`);
    }

    function hardenMobileNavTapTargets() {
      nav.style.setProperty("pointer-events", "auto", "important");
      nav.style.setProperty("z-index", "1100", "important");
      toggleBtn.style.setProperty("z-index", "1200", "important");
      backdrop.style.setProperty("z-index", "1000", "important");
      nav.querySelectorAll("a").forEach(function (link) {
        link.style.setProperty("pointer-events", "auto", "important");
        link.style.setProperty("position", "relative", "important");
        link.style.setProperty("z-index", "2", "important");
        link.style.setProperty("touch-action", "manipulation", "important");
      });
    }

    function resetDesktopNavState() {
      body.classList.remove("mobile-nav-ready", "mobile-drawer-open", "mobile-nav-lock");
      body.style.removeProperty("--mobile-nav-top");
      nav.style.removeProperty("pointer-events");
      nav.style.removeProperty("z-index");
      toggleBtn.style.removeProperty("z-index");
      backdrop.style.removeProperty("z-index");
      nav.querySelectorAll("a").forEach(function (link) {
        link.style.removeProperty("pointer-events");
        link.style.removeProperty("position");
        link.style.removeProperty("z-index");
        link.style.removeProperty("touch-action");
      });
    }

    function syncMobileMode() {
      if (isMobileViewport()) {
        body.classList.add("mobile-nav-ready");
        syncMobileTopOffset();
        hardenMobileNavTapTargets();
      } else {
        resetDesktopNavState();
      }
    }

    function setOpenState(nextOpen) {
      const shouldOpen = Boolean(nextOpen) && isMobileViewport();
      syncMobileMode();
      if (shouldOpen) {
        syncMobileTopOffset();
      }
      body.classList.remove("nav-hidden");
      body.classList.toggle("mobile-drawer-open", shouldOpen);
      body.classList.toggle("mobile-nav-lock", shouldOpen);
      if (!shouldOpen) {
        nav.querySelectorAll(".nav-item.is-open").forEach((item) => item.classList.remove("is-open"));
        nav.querySelectorAll(".nav-subitem.is-open").forEach((item) => item.classList.remove("is-open"));
        nav
          .querySelectorAll("[data-dropdown-trigger], [data-submenu-trigger]")
          .forEach((link) => link.setAttribute("aria-expanded", "false"));
      }
      if (isMobileViewport()) {
        hardenMobileNavTapTargets();
      }
      toggleBtn.setAttribute("aria-expanded", shouldOpen ? "true" : "false");
      toggleBtn.setAttribute(
        "aria-label",
        shouldOpen ? "Close navigation menu" : "Open navigation menu"
      );
      backdrop.setAttribute("aria-hidden", shouldOpen ? "false" : "true");

      if (shouldOpen) {
        const firstMenuLink = nav.querySelector("a[href]");
        if (firstMenuLink instanceof HTMLElement) {
          window.requestAnimationFrame(() => firstMenuLink.focus());
        }
      }
    }

    syncMobileMode();
    setOpenState(false);

    window.addEventListener(
      "pageshow",
      function () {
        if (isMobileViewport()) {
          setOpenState(false);
        }
      },
      { passive: true }
    );

    toggleBtn.addEventListener("click", function () {
      const isOpen = body.classList.contains("mobile-drawer-open");
      if (!isOpen && isMobileViewport() && (window.scrollY || 0) > 12) {
        window.scrollTo({ top: 0, behavior: "smooth" });
        window.setTimeout(function () {
          setOpenState(true);
        }, 240);
        return;
      }

      setOpenState(!isOpen);
    });

    backdrop.addEventListener("click", function () {
      setOpenState(false);
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (!isMobileViewport()) return;
        if (link.hasAttribute("data-dropdown-trigger") || link.hasAttribute("data-submenu-trigger")) {
          // Let the dedicated dropdown controller manage first-tap open and second-tap navigate.
          return;
        }
        setOpenState(false);
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        setOpenState(false);
        toggleBtn.focus();
        return;
      }

      if (event.key !== "Tab" || !body.classList.contains("mobile-drawer-open")) return;
      const focusable = Array.from(
        nav.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])')
      ).filter((item) => item instanceof HTMLElement && item.offsetParent !== null);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        toggleBtn.focus();
      } else if (!event.shiftKey && document.activeElement === toggleBtn) {
        event.preventDefault();
        first.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        toggleBtn.focus();
      }
    });

    window.addEventListener(
      "resize",
      function () {
        syncMobileMode();
        if (!isMobileViewport()) {
          setOpenState(false);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      "scroll",
      function () {
        if (isMobileViewport()) {
          syncMobileTopOffset();
        }
      },
      { passive: true }
    );
  }

  function initNavDropdowns() {
    const nav = document.querySelector(".links");
    if (!nav) return;

    const dropdownItems = Array.from(nav.querySelectorAll(".nav-item.has-dropdown"));
    if (!dropdownItems.length) return;

    const MOBILE_BREAKPOINT = 980;
    const CLOSE_DELAY_MS = 220;

    function isMobileViewport() {
      return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function getMenuHeightVar(menu) {
      if (!menu) return "";
      return menu.classList.contains("nav-submenu")
        ? "--nav-submenu-open-height"
        : "--nav-dropdown-open-height";
    }

    function measureMenuHeight(menu) {
      if (!menu) return 0;
      const scrollHeight = Math.ceil(menu.scrollHeight || 0);
      if (scrollHeight > 0) return scrollHeight;

      return Array.from(menu.children).reduce((total, child) => {
        if (!(child instanceof HTMLElement)) return total;
        const styles = window.getComputedStyle(child);
        const marginTop = parseFloat(styles.marginTop || "0") || 0;
        const marginBottom = parseFloat(styles.marginBottom || "0") || 0;
        return total + child.offsetHeight + marginTop + marginBottom;
      }, 0);
    }

    function syncMenuHeight(menu) {
      if (!menu || !isMobileViewport()) return;
      const heightVar = getMenuHeightVar(menu);
      if (!heightVar) return;
      const measuredHeight = measureMenuHeight(menu);
      if (measuredHeight > 0) {
        menu.style.setProperty(heightVar, `${Math.ceil(measuredHeight)}px`);
      } else {
        menu.style.removeProperty(heightVar);
      }
    }

    function syncRelatedMenuHeights(menu) {
      if (!menu || !isMobileViewport()) return;
      window.requestAnimationFrame(() => {
        syncMenuHeight(menu);
        const parentDropdown = menu.closest(".nav-dropdown");
        if (parentDropdown && parentDropdown !== menu) {
          syncMenuHeight(parentDropdown);
        }
        window.requestAnimationFrame(() => {
          syncMenuHeight(menu);
          if (parentDropdown && parentDropdown !== menu) {
            syncMenuHeight(parentDropdown);
          }
        });
      });
    }

    function syncAllMenuHeights() {
      if (!isMobileViewport()) return;
      nav.querySelectorAll(".nav-dropdown, .nav-submenu").forEach((menu) => {
        syncMenuHeight(menu);
      });
    }

    function closeAllDropdowns() {
      dropdownItems.forEach((item) => {
        item.classList.remove("is-open");
        const trigger = item.querySelector("[data-dropdown-trigger]");
        if (trigger) {
          trigger.setAttribute("aria-expanded", "false");
        }
      });
      nav.querySelectorAll(".nav-subitem.is-open").forEach((subitem) => {
        subitem.classList.remove("is-open");
        const subTrigger = subitem.querySelector("[data-submenu-trigger]");
        if (subTrigger) {
          subTrigger.setAttribute("aria-expanded", "false");
        }
      });
      window.requestAnimationFrame(syncAllMenuHeights);
    }

    dropdownItems.forEach((item) => {
      const trigger = item.querySelector("[data-dropdown-trigger]");
      const menu = item.querySelector(".nav-dropdown");
      if (!trigger || !menu) return;

      let closeTimer = 0;

      function openMenu() {
        window.clearTimeout(closeTimer);
        item.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        syncRelatedMenuHeights(menu);
      }

      function scheduleClose() {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(() => {
          item.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
          syncRelatedMenuHeights(menu);
        }, CLOSE_DELAY_MS);
      }

      function handleEnter() {
        if (isMobileViewport()) return;
        openMenu();
      }

      function handleLeave() {
        if (isMobileViewport()) return;
        scheduleClose();
      }

      trigger.addEventListener("mouseenter", handleEnter);
      trigger.addEventListener("mouseleave", handleLeave);
      menu.addEventListener("mouseenter", handleEnter);
      menu.addEventListener("mouseleave", handleLeave);

      trigger.addEventListener("focus", function () {
        if (!isMobileViewport()) {
          openMenu();
        }
      });

      item.addEventListener("focusout", function (event) {
        if (item.contains(event.relatedTarget)) return;
        scheduleClose();
      });

      trigger.addEventListener("click", function (event) {
        if (!isMobileViewport()) return;
        const isOpen = item.classList.contains("is-open");
        const href = String(trigger.getAttribute("href") || "").trim();
        const canNavigate = Boolean(href && href !== "#");

        if (isOpen && canNavigate) {
          closeAllDropdowns();
          return;
        }

        event.preventDefault();
        closeAllDropdowns();
        if (!isOpen) {
          openMenu();
        }
      });
    });

    const submenuItems = Array.from(nav.querySelectorAll(".nav-subitem.has-submenu"));
    submenuItems.forEach((item) => {
      const trigger = item.querySelector("[data-submenu-trigger]");
      const menu = item.querySelector(".nav-submenu");
      if (!trigger || !menu) return;

      let closeTimer = 0;

      function openMenu() {
        window.clearTimeout(closeTimer);
        item.classList.add("is-open");
        trigger.setAttribute("aria-expanded", "true");
        syncRelatedMenuHeights(menu);
      }

      function scheduleClose() {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(() => {
          item.classList.remove("is-open");
          trigger.setAttribute("aria-expanded", "false");
          syncRelatedMenuHeights(menu);
        }, CLOSE_DELAY_MS);
      }

      function handleEnter() {
        if (isMobileViewport()) return;
        openMenu();
      }

      function handleLeave() {
        if (isMobileViewport()) return;
        scheduleClose();
      }

      trigger.addEventListener("mouseenter", handleEnter);
      trigger.addEventListener("mouseleave", handleLeave);
      menu.addEventListener("mouseenter", handleEnter);
      menu.addEventListener("mouseleave", handleLeave);

      trigger.addEventListener("focus", function () {
        if (!isMobileViewport()) {
          openMenu();
        }
      });

      item.addEventListener("focusout", function (event) {
        if (item.contains(event.relatedTarget)) return;
        scheduleClose();
      });

      trigger.addEventListener("click", function (event) {
        if (!isMobileViewport()) return;
        const isOpen = item.classList.contains("is-open");
        const href = String(trigger.getAttribute("href") || "").trim();
        const canNavigate = Boolean(href && href !== "#");

        if (isOpen && canNavigate) {
          submenuItems.forEach((entry) => {
            entry.classList.remove("is-open");
            const entryTrigger = entry.querySelector("[data-submenu-trigger]");
            if (entryTrigger) {
              entryTrigger.setAttribute("aria-expanded", "false");
            }
          });
          window.requestAnimationFrame(syncAllMenuHeights);
          return;
        }

        event.preventDefault();
        submenuItems.forEach((entry) => {
          entry.classList.remove("is-open");
          const entryTrigger = entry.querySelector("[data-submenu-trigger]");
          if (entryTrigger) {
            entryTrigger.setAttribute("aria-expanded", "false");
          }
        });
        if (!isOpen) {
          openMenu();
        } else {
          window.requestAnimationFrame(syncAllMenuHeights);
        }
      });
    });

    document.addEventListener("click", function (event) {
      if (!isMobileViewport()) return;
      const clickedInside = dropdownItems.some((item) => item.contains(event.target));
      if (!clickedInside) {
        closeAllDropdowns();
      }
    });

    window.addEventListener(
      "resize",
      function () {
        if (!isMobileViewport()) {
          closeAllDropdowns();
          return;
        }
        syncAllMenuHeights();
      },
      { passive: true }
    );

    syncAllMenuHeights();
  }

  function initDesktopNavPill() {
    const nav = document.querySelector(".links");
    if (!nav) return;
    nav.classList.remove("has-nav-pill");
    nav.querySelectorAll(".is-nav-target").forEach((entry) => entry.classList.remove("is-nav-target"));
    const pill = nav.querySelector(".nav-active-pill");
    if (pill) {
      pill.remove();
    }

    let releaseTimer = 0;
    nav.addEventListener("click", (event) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || !shouldAnimatePageLink(link, event)) return;

      const primaryAnchor = resolvePrimaryNavAnchor(link, nav) || link;
      nav.querySelectorAll(".is-nav-target").forEach((entry) => entry.classList.remove("is-nav-target"));
      primaryAnchor.classList.add("is-nav-target");

      window.clearTimeout(releaseTimer);
      releaseTimer = window.setTimeout(() => {
        primaryAnchor.classList.remove("is-nav-target");
      }, PAGE_LEAVE_DELAY_MS + 80);
    });
  }

  function initAppleMobileNav() {
    const toggleBtn = document.getElementById("appleMobileToggle");
    const nav = document.getElementById("primary-nav");
    if (document.body.classList.contains("mobile-nav-ready")) return;
    if (!toggleBtn || !nav || !document.body.classList.contains("home-page")) return;

    const MOBILE_BREAKPOINT = 900;

    function setOpenState(open) {
      document.body.classList.toggle("mobile-nav-open", open);
      toggleBtn.setAttribute("aria-expanded", open ? "true" : "false");
      toggleBtn.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    }

    toggleBtn.addEventListener("click", function () {
      const isOpen = document.body.classList.contains("mobile-nav-open");
      setOpenState(!isOpen);
    });

    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function (event) {
        if (window.innerWidth > MOBILE_BREAKPOINT) return;
        if (link.hasAttribute("data-dropdown-trigger") || link.hasAttribute("data-submenu-trigger")) {
          event.preventDefault();
          return;
        }
        setOpenState(false);
      });
    });

    document.addEventListener("click", function (event) {
      if (window.innerWidth > MOBILE_BREAKPOINT) return;
      if (!document.body.classList.contains("mobile-nav-open")) return;
      if (toggleBtn.contains(event.target) || nav.contains(event.target)) return;
      setOpenState(false);
    });

    window.addEventListener(
      "resize",
      function () {
        if (window.innerWidth > MOBILE_BREAKPOINT) {
          setOpenState(false);
        }
      },
      { passive: true }
    );
  }

  function initScrollReveal() {
    const revealGroups = [
      ".section",
      ".inner-hero",
      ".showcase-copy",
      ".showcase-gallery .showcase-image",
      ".home-why .why-item",
      ".contact-map-grid > *",
      ".stats-grid .stat-card",
      ".news-grid .news-card",
      ".highlights-showcase .section-head",
      "#home-gallery-grid .panel",
      ".about-quickstats .about-stat",
      ".about-story-copy",
      ".about-story-media .panel",
      ".about-mvv-card",
      ".about-pillar",
      ".about-cta",
      ".about-timeline-section",
      ".about-timeline li",
      ".principal-modern-photo",
      ".principal-modern-copy",
      ".principal-hero-copy",
      ".principal-hero-photo",
      ".principal-highlight-card",
      ".principal-quote",
      ".faculty-hero-inner",
      ".contactx-hero",
      ".contactx-info-card",
      ".contactx-form",
      ".contactx-map-card",
      ".contactx-fb-card",
      ".admx-hero",
      ".admx-hero-copy",
      ".admx-hero-media",
      ".admx-form",
      ".admx-help-card",
      ".galleryx-hero-copy",
      ".galleryx-hero-preview",
      ".galleryx-view-head",
      ".facx-card",
      ".notice-board-shell",
      ".notice-board-toolbar",
      ".errorx-copy",
      ".errorx-panel",
      ".errorx-photo-card",
      ".errorx-links-shell",
      ".errorx-link-tile",
      ".info-hero-inner",
      ".info-section-title",
      ".info-card",
      ".info-media",
      ".info-stat-card",
      ".info-timeline-item",
      ".info-highlight-card",
      ".info-gallery img",
      ".info-cta",
      ".longform-block",
      ".footer-grid > div"
    ];
    const revealItems = Array.from(document.querySelectorAll(revealGroups.join(", "))).filter(
      (item) => item instanceof HTMLElement && !item.hasAttribute("data-stack-card")
    );
    const hero = document.body.matches(".home-page.home-hero")
      ? document.querySelector(".hero")
      : null;
    const heroMedia = hero ? Array.from(hero.querySelectorAll(".hero-media")) : [];
    const heroCopy = hero ? hero.querySelector(".hero-copy") : null;

    if (!revealItems.length) return;

    document.body.classList.add("js-reveal");
    const enhancedMotion = !prefersReducedMotion() && !shouldUseLiteMotion();
    document.body.classList.remove("scroll-cinema-ready");
    document.body.classList.remove("scroll-motion-ready");
    document.body.classList.toggle("premium-scroll", enhancedMotion);
    document.body.classList.toggle("premium-scroll-enhanced", enhancedMotion);

    function clamp(value, min, max) {
      return Math.min(max, Math.max(min, value));
    }

    function getSiblingIndex(item, fallbackIndex) {
      if (!(item.parentElement instanceof HTMLElement)) return fallbackIndex;
      const siblings = Array.from(item.parentElement.children).filter(
        (child) => child instanceof HTMLElement
      );
      const siblingIndex = siblings.indexOf(item);
      return siblingIndex >= 0 ? siblingIndex : fallbackIndex;
    }

    function getMotionPreset(item, index) {
      const siblingIndex = getSiblingIndex(item, index);
      const basePreset = {
        style: "soft",
        flow: "center",
        depthY: 0,
        depthScale: 0
      };

      if (
        item.matches(
          ".showcase-gallery .showcase-image, .principal-modern-photo, .principal-hero-photo, .info-media, .info-gallery img, #home-gallery-grid .panel, .galleryx-hero-preview, .admx-hero-media, .errorx-panel, .errorx-photo-card"
        )
      ) {
        return {
          style: "visual",
          flow: "center",
          depthY: siblingIndex % 2 === 0 ? 10 : 8,
          depthScale: 0.008
        };
      }

      if (
        item.matches(
          ".highlights-showcase .section-head, .info-section-title, .galleryx-view-head, .notice-board-toolbar"
        )
      ) {
        return {
          style: "headline",
          flow: "center",
          depthY: 0,
          depthScale: 0
        };
      }

      if (
        item.matches(
          ".showcase-copy, .principal-modern-copy, .principal-hero-copy, .info-hero-inner, .info-cta, .longform-block, .inner-hero, .contactx-hero, .galleryx-hero-copy, .faculty-hero-inner, .admx-hero-copy, .errorx-copy, .about-story-copy, .about-cta"
        )
      ) {
        return {
          style: "copy",
          flow: item.matches(".principal-modern-copy, .principal-hero-copy") ? "right" : "left",
          depthY: 0,
          depthScale: 0
        };
      }

      if (item.matches(".info-card, .contactx-form, .admx-form")) {
        return {
          style: "copy",
          flow:
            item.closest(".info-grid-reverse, .contactx-grid, .admx-apply-grid") &&
              !item.matches(".contactx-info-card")
              ? "right"
              : "left",
          depthY: 0,
          depthScale: 0
        };
      }

      if (item.matches(".contact-map-grid > *, .contactx-grid > *, .contactx-location-grid > *, .principal-highlights > *, .about-quickstats > *, .about-mvv-grid > *, .about-pillars-grid > *, .errorx-links-grid > *")) {
        const directions = ["left", "center", "right"];
        return {
          style: "card",
          flow: directions[siblingIndex] || "center",
          depthY: 0,
          depthScale: 0
        };
      }

      if (item.matches(".about-timeline-section")) {
        return {
          style: "section",
          flow: "center",
          depthY: 0,
          depthScale: 0
        };
      }

      if (item.matches(".about-timeline li")) {
        return {
          style: "card",
          flow: siblingIndex % 2 === 0 ? "left" : "right",
          depthY: 0,
          depthScale: 0
        };
      }

      if (
        item.matches(
          ".stats-grid .stat-card, .news-grid .news-card, .home-why .why-item, .info-stat-card, .info-highlight-card, .info-timeline-item, .footer-grid > div, .contactx-info-card, .contactx-map-card, .contactx-fb-card, .admx-help-card, .galleryx-view-head, .facx-card, .principal-highlight-card, .principal-quote, .notice-board-shell, .errorx-links-shell, .errorx-link-tile, .about-stat, .about-story-media .panel, .about-mvv-card, .about-pillar"
        )
      ) {
        return {
          style: "card",
          flow: "center",
          depthY: 0,
          depthScale: 0
        };
      }

      if (item.matches(".section")) {
        return {
          style: "section",
          flow: "center",
          depthY: 0,
          depthScale: 0
        };
      }

      return basePreset;
    }

    const observerOptions = { threshold: 0.05, rootMargin: "0px 0px -4% 0px" };

    function resetHeroMotion() {
      if (!(hero instanceof HTMLElement)) return;
      hero.style.setProperty("--hero-media-shift", "0px");
      hero.style.setProperty("--hero-media-scale", "1.01");
      hero.style.setProperty("--hero-panel-shift", "0px");
      hero.style.setProperty("--hero-panel-scale", "1");
      hero.style.setProperty("--hero-panel-opacity", "1");
      hero.style.setProperty("--hero-overlay-opacity", "0.96");
    }

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      revealItems.forEach((item) => {
        item.classList.add("in-view");
      });
      resetHeroMotion();
      return;
    }

    if (!enhancedMotion) {
      revealItems.forEach((item) => {
        item.classList.remove("premium-reveal");
        delete item.dataset.premiumStyle;
        delete item.dataset.premiumFlow;
        item.style.removeProperty("--premium-delay");
        item.style.removeProperty("--premium-depth-y");
        item.style.removeProperty("--premium-depth-scale");
      });

      const basicObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("in-view");
          obs.unobserve(entry.target);
        });
      }, observerOptions);

      revealItems.forEach((item) => {
        basicObserver.observe(item);
      });

      resetHeroMotion();
      return;
    }

    const premiumItems = revealItems.map((item, index) => {
      const preset = getMotionPreset(item, index);
      const delayIndex = Math.min(getSiblingIndex(item, index), 4);

      item.classList.remove("scroll-reveal");
      item.classList.add("premium-reveal");
      item.dataset.premiumStyle = preset.style;
      item.dataset.premiumFlow = preset.flow;
      delete item.dataset.motionKind;
      delete item.dataset.motionDirection;
      item.style.setProperty("--premium-delay", `${delayIndex * 58}ms`);
      item.style.setProperty("--premium-depth-y", "0px");
      item.style.setProperty("--premium-depth-scale", "0");

      return { item, ...preset };
    });

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in-view");
        obs.unobserve(entry.target);
      });
    }, observerOptions);

    revealItems.forEach((item) => {
      observer.observe(item);
    });

    const parallaxItems = premiumItems.filter(
      ({ item, style }) =>
        style === "visual" &&
        item.matches(".showcase-gallery .showcase-image, .principal-modern-photo, .info-media")
    );
    if (!parallaxItems.length && !(hero instanceof HTMLElement)) return;
    let motionRaf = 0;

    function syncScrollMotion() {
      motionRaf = 0;
      const viewportHeight = Math.max(window.innerHeight || 0, 1);

      parallaxItems.forEach(({ item, depthY, depthScale }) => {
        const rect = item.getBoundingClientRect();
        if (rect.bottom < -72 || rect.top > viewportHeight + 72) {
          item.style.setProperty("--premium-depth-y", "0px");
          item.style.setProperty("--premium-depth-scale", "0");
          return;
        }

        const centerOffset = clamp(
          (rect.top + rect.height * 0.5 - viewportHeight * 0.52) / viewportHeight,
          -1,
          1
        );
        const scaleDelta = (1 - Math.min(1, Math.abs(centerOffset))) * depthScale * 0.72;

        item.style.setProperty("--premium-depth-y", `${(centerOffset * -depthY * 0.74).toFixed(2)}px`);
        item.style.setProperty("--premium-depth-scale", scaleDelta.toFixed(4));
      });

      if (!(hero instanceof HTMLElement)) return;

      const heroRect = hero.getBoundingClientRect();
      const heroProgress = clamp(
        (-heroRect.top) / Math.max(heroRect.height * 0.9, viewportHeight * 0.78, 1),
        0,
        1
      );

      hero.style.setProperty("--hero-media-shift", `${(heroProgress * 11).toFixed(2)}px`);
      hero.style.setProperty("--hero-media-scale", (1.01 + heroProgress * 0.012).toFixed(4));
      hero.style.setProperty("--hero-panel-shift", `${(heroProgress * -14).toFixed(2)}px`);
      hero.style.setProperty("--hero-panel-scale", (1 - heroProgress * 0.009).toFixed(4));
      hero.style.setProperty("--hero-panel-opacity", (1 - heroProgress * 0.06).toFixed(4));
      hero.style.setProperty("--hero-overlay-opacity", (0.96 - heroProgress * 0.03).toFixed(4));

      heroMedia.forEach((media, index) => {
        media.style.setProperty(
          "--hero-media-shift",
          `${(heroProgress * (index === 0 ? 8 : 11)).toFixed(2)}px`
        );
        media.style.setProperty(
          "--hero-media-scale",
          (1.01 + heroProgress * (index === 0 ? 0.01 : 0.014)).toFixed(4)
        );
      });

      if (heroCopy instanceof HTMLElement) {
        heroCopy.style.setProperty("--hero-panel-shift", `${(heroProgress * -14).toFixed(2)}px`);
        heroCopy.style.setProperty("--hero-panel-scale", (1 - heroProgress * 0.009).toFixed(4));
        heroCopy.style.setProperty("--hero-panel-opacity", (1 - heroProgress * 0.06).toFixed(4));
      }
    }

    function requestMotionSync() {
      if (motionRaf) return;
      motionRaf = window.requestAnimationFrame(syncScrollMotion);
    }

    window.addEventListener("scroll", requestMotionSync, { passive: true });
    window.addEventListener("resize", requestMotionSync, { passive: true });
    window.addEventListener("load", requestMotionSync, { once: true });
    syncScrollMotion();
  }

  function initFacilitiesSectionNav() {
    if (!document.body.classList.contains("facilities-page")) return;

    const navLinks = Array.from(document.querySelectorAll(".facx-hero-tags a[href^='#']"));
    if (!navLinks.length) return;

    const sections = navLinks
      .map((link) => document.querySelector(link.getAttribute("href")))
      .filter(Boolean);

    function setActiveLink(hash) {
      navLinks.forEach((link) => {
        link.classList.toggle("is-active", link.getAttribute("href") === hash);
      });
      sections.forEach((section) => {
        section.classList.toggle("is-targeted", `#${section.id}` === hash);
      });
    }

    function scrollToSection(section) {
      scrollElementWithOffset(section, { behavior: "smooth" });
    }

    navLinks.forEach((link) => {
      link.addEventListener("click", (event) => {
        const targetSelector = link.getAttribute("href");
        const target = targetSelector ? document.querySelector(targetSelector) : null;
        if (!target) return;
        event.preventDefault();
        history.replaceState(null, "", targetSelector);
        setActiveLink(targetSelector);
        scrollToSection(target);
      });
    });

    function syncFromHash() {
      const currentHash = sections.some((section) => `#${section.id}` === window.location.hash)
        ? window.location.hash
        : navLinks[0].getAttribute("href");
      setActiveLink(currentHash);
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
  }

  function initFacebookEmbeds() {
    const frames = Array.from(
      document.querySelectorAll(".fb-card iframe, .contactx-fb-card iframe")
    );
    if (!frames.length) return;

    function updateFrame(frame) {
      const wrapper = frame.closest(".fb-card, .contactx-fb-card");
      if (!wrapper) return;
      const width = Math.max(280, Math.min(500, Math.round(wrapper.clientWidth)));
      const height = Math.max(360, Math.round(width * 1.1));
      if (frame.dataset.fbWidth === String(width) && frame.dataset.fbHeight === String(height)) {
        return;
      }
      const rawSrc = frame.dataset.fbSrc || frame.getAttribute("src");
      if (!rawSrc) return;
      frame.dataset.fbSrc = rawSrc;
      try {
        const url = new URL(rawSrc);
        url.searchParams.set("width", String(width));
        url.searchParams.set("height", String(height));
        frame.setAttribute("src", url.toString());
        frame.dataset.fbWidth = String(width);
        frame.dataset.fbHeight = String(height);
      } catch (error) {
        // Ignore invalid URLs.
      }
    }

    function syncAllFrames() {
      frames.forEach(updateFrame);
    }

    syncAllFrames();
    let resizeTimer;
    window.addEventListener(
      "resize",
      () => {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(syncAllFrames, 180);
      },
      { passive: true }
    );
  }

  function initPrincipalProfile() {
    const principalNodes = Array.from(document.querySelectorAll("[data-principal-profile]"));
    if (!principalNodes.length) return;

    function normalizePrincipalText(value) {
      return String(value || "").trim();
    }

    function normalizePrincipalImage(value) {
      const source = normalizePrincipalText(value);
      if (!source) return "";
      if (/^(?:[a-z]+:)?\/\//i.test(source) || /^(data:|blob:)/i.test(source)) {
        return source;
      }
      return source.startsWith("/") ? source : `/${source.replace(/^\.?\//, "")}`;
    }

    function setPrincipalText(root, selector, value) {
      if (!value) return;
      root.querySelectorAll(selector).forEach((node) => {
        node.textContent = value;
      });
    }

    function applyPrincipalProfile(profile) {
      const name = normalizePrincipalText(profile?.name);
      const role = normalizePrincipalText(profile?.role) || "Principal";
      const roleWithSchool =
        normalizePrincipalText(profile?.roleWithSchool) || `${role}, Kankai Secondary School`;
      const caption = normalizePrincipalText(profile?.caption) || (name ? `${role} ${name}`.trim() : role);
      const alt = normalizePrincipalText(profile?.alt) || caption || name || role;
      const img = normalizePrincipalImage(profile?.img) || "/photos/logo-round.png";

      principalNodes.forEach((root) => {
        setPrincipalText(root, "[data-principal-name]", name || "Principal");
        setPrincipalText(root, "[data-principal-role]", role);
        setPrincipalText(root, "[data-principal-role-school]", roleWithSchool);
        setPrincipalText(root, "[data-principal-caption]", caption);

        root.querySelectorAll("[data-principal-image]").forEach((imgNode) => {
          if (!(imgNode instanceof HTMLImageElement)) return;
          if (img) {
            imgNode.src = img;
          }
          if (alt) {
            imgNode.alt = alt;
          }
        });
      });
    }

    async function loadPrincipalProfile() {
      try {
        const response = await fetch("/api/principal-profile", { cache: "no-store" });
        if (!response.ok) return null;
        const profile = await response.json();
        return profile && typeof profile === "object" ? profile : null;
      } catch {
        return null;
      }
    }

    loadPrincipalProfile().then(applyPrincipalProfile);

    const principalMessageRoot = document.querySelector('[data-principal-message]');
    const principalHomeRoot = document.querySelector('[data-principal-home-message]');
    const principalPageRoot = document.querySelector('[data-principal-page-intro]');
    const principalQuote = document.querySelector('[data-principal-page-quote]');
    if (!principalMessageRoot && !principalHomeRoot && !principalPageRoot && !principalQuote) return;

    function setPrincipalParagraphs(root, selector, value) {
      const bodyNode = root?.querySelector(selector);
      const paragraphs = normalizePrincipalText(value).split(/\n\s*\n/).filter(Boolean);
      if (!bodyNode || !paragraphs.length) return;
      bodyNode.replaceChildren();
      paragraphs.forEach((paragraph) => {
        const node = document.createElement('p');
        node.textContent = paragraph.trim();
        bodyNode.appendChild(node);
      });
    }

    fetchIndexPopupSettings('no-store').then((settings) => {
      if (!settings) return;
      const home = settings.principalHome;
      if (principalHomeRoot && home) {
        setPrincipalText(principalHomeRoot, '[data-principal-home-title]', normalizePrincipalText(home.title));
        setPrincipalText(principalHomeRoot, '[data-principal-home-greeting]', normalizePrincipalText(home.greeting));
        setPrincipalParagraphs(principalHomeRoot, '[data-principal-home-body]', home.body);
      }

      const page = settings.principalPage;
      if (principalPageRoot && page) {
        setPrincipalText(principalPageRoot, '[data-principal-page-eyebrow]', normalizePrincipalText(page.eyebrow));
        setPrincipalText(principalPageRoot, '[data-principal-page-headline]', normalizePrincipalText(page.headline));
        setPrincipalText(principalPageRoot, '[data-principal-page-greeting]', normalizePrincipalText(page.greeting));
        setPrincipalParagraphs(principalPageRoot, '[data-principal-page-body]', page.body);
      }
      if (principalQuote && page?.quote) principalQuote.textContent = page.quote;

      const message = settings.principalMessage;
      if (principalMessageRoot && message) {
        setPrincipalText(principalMessageRoot, '[data-principal-message-title]', normalizePrincipalText(message.title));
        setPrincipalParagraphs(principalMessageRoot, '[data-principal-message-body]', message.body);
      }
    });
  }

  function initTeacherSections() {
    const sectionHost = document.getElementById("facultySections");
    if (!sectionHost) return;

    function teacherEscapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function teacherNormalizeText(value) {
      return String(value || "").trim();
    }

    function teacherNormalizeRoleValue(value) {
      return teacherNormalizeText(value)
        .toLowerCase()
        .replace(/\s+/g, " ");
    }

    function teacherNormalizeSectionValue(value) {
      const normalized = teacherNormalizeText(value)
        .toLowerCase()
        .replace(/\s+/g, "-");

      if (normalized === "management" || normalized === "management-committee") {
        return "management";
      }
      if (normalized === "administrative" || normalized === "administrative-staff" || normalized === "admin-staff") {
        return "administrative";
      }
      if (normalized === "faculty" || normalized === "faculty-members" || normalized === "teacher" || normalized === "teachers") {
        return "faculty";
      }
      return "";
    }

    function teacherGetLeadershipRoleKeyFromRole(role) {
      const normalizedRole = teacherNormalizeRoleValue(role);
      if (!normalizedRole) return "";
      if (
        normalizedRole === "principal" ||
        normalizedRole === "headmaster" ||
        normalizedRole === "head teacher" ||
        (/principal/.test(normalizedRole) && !/vice/.test(normalizedRole))
      ) {
        return "principal";
      }
      if (/vice principal/.test(normalizedRole)) {
        return "vice-principal";
      }
      if (/coordinator/.test(normalizedRole)) {
        return "coordinator";
      }
      return "";
    }

    function teacherGetLeadershipRoleKey(teacher) {
      return teacherGetLeadershipRoleKeyFromRole(teacher.role || teacher.position);
    }

    function teacherGetInitials(name) {
      const parts = teacherNormalizeText(name)
        .split(" ")
        .filter(Boolean)
        .slice(0, 2);
      if (!parts.length) return "FS";
      return parts.map((part) => part[0].toUpperCase()).join("");
    }

    function teacherResolveImagePath(value) {
      const source = teacherNormalizeText(value);
      if (!source) return "";
      if (/^(?:[a-z]+:)?\/\//i.test(source) || /^(?:data:|blob:)/i.test(source)) {
        return source;
      }
      return source.startsWith("/") ? source : `/${source.replace(/^\.?\//, "")}`;
    }

    function inferTeacherDepartment(teacher) {
      const manualDepartment = teacherNormalizeText(teacher.department);
      if (manualDepartment) return manualDepartment;
      const leadershipRoleKey = teacherGetLeadershipRoleKey(teacher);
      if (leadershipRoleKey) {
        return "Leadership";
      }
      const role = teacherNormalizeText(teacher.role).toLowerCase();
      const qualification = teacherNormalizeText(teacher.qualification).toLowerCase();
      const position = teacherNormalizeText(teacher.position).toLowerCase();
      const combined = `${role} ${qualification} ${position}`.toLowerCase();
      if (/computer|ict/.test(qualification)) return "Computer Engineering";
      if (/english/.test(qualification)) return "English";
      if (/math/.test(qualification)) return "Mathematics";
      if (/i-com/.test(qualification)) return "Intermediate in Commerce";
      if (/science|physics|chemistry|biology/.test(qualification)) return "Science";
      if (/accountant|office|security|guard|peon|pune/.test(position) || /accountant|office|security|guard|peon|pune/.test(combined)) return "Office Staff";
      if (/business|management|finance|i-com|commerce/.test(qualification) || /finance/.test(combined)) {
        return "Business Studies";
      }
      if (/physical education|health|pe\b/.test(qualification)) return "Physical Education";
      if (/nepali/.test(qualification) && /social/.test(qualification)) return "Social Studies";
      if (/economics/.test(qualification)) return "Economics";
      if (/social/.test(qualification)) return "Social Studies";
      if (/nepali/.test(qualification)) return "Nepali";
      if (/education|management|planning/.test(qualification)) return "Social Studies";
      return "Social Studies";
    }

    function inferTeacherAcademicDepartment(teacher) {
      const manualDepartment = teacherNormalizeText(teacher.publicDepartment || teacher.academicDepartment || teacher.department);
      if (manualDepartment && manualDepartment !== "Office Staff" && manualDepartment !== "Leadership") {
        return manualDepartment;
      }

      const qualification = teacherNormalizeText(teacher.qualification).toLowerCase();
      const role = teacherNormalizeText(teacher.role).toLowerCase();
      const position = teacherNormalizeText(teacher.position).toLowerCase();
      const combined = `${qualification} ${role} ${position}`.toLowerCase();

      if (/computer|ict/.test(combined)) return "Computer Engineering";
      if (/english/.test(combined)) return "English";
      if (/math/.test(combined)) return "Mathematics";
      if (/i-com/.test(combined)) return "Intermediate in Commerce";
      if (/science|physics|chemistry|biology/.test(combined)) return "Science";
      if (/business|finance|management|commerce/.test(combined)) return "Business Studies";
      if (/physical education/.test(combined)) return "Physical Education";
      if (/\bhealth\b/.test(combined)) return "Physical Education";
      if (/economics/.test(combined)) return "Economics";
      if (/social/.test(combined)) return "Social Studies";
      if (/nepali/.test(combined)) return "Nepali";

      return "";
    }

    function inferTeacherSection(teacher) {
      const manualSection = teacherNormalizeSectionValue(teacher.section);
      if (manualSection) {
        return manualSection;
      }

      const id = teacherNormalizeText(teacher.id).toLowerCase();
      const img = teacherNormalizeText(teacher.img).replace(/^\/+/, "").toLowerCase();
      const role = teacherNormalizeText(teacher.role || teacher.position).toLowerCase();
      const department = teacherNormalizeText(teacher.department).toLowerCase();
      const combined = `${id} ${img} ${role} ${department}`;

      if (
        id.startsWith("management-") ||
        img.startsWith("photos/management/") ||
        /management committee|chairperson|member secretary/.test(combined) ||
        (/\bmember\b/.test(role) && img.includes("/management/"))
      ) {
        return "management";
      }

      if (
        teacherGetLeadershipRoleKey(teacher) ||
        department === "office staff" ||
        /accountant|librarian|security|guard|peon|office staff|administrative staff/.test(combined)
      ) {
        return "administrative";
      }

      return "faculty";
    }

    function formatTeacherDisplayName(teacher) {
      const name = teacherNormalizeText(teacher.name);
      const qualification = teacherNormalizeText(teacher.qualification);
      if (!qualification) return name;
      return `${name} (${qualification})`;
    }

    function getTeacherDepartmentLabel(department) {
      const normalizedDepartment = teacherNormalizeText(department);
      const departmentDisplayMap = {
        "Business Studies": "Account / Business",
        "Physical Education": "Health/Physical education"
      };
      return departmentDisplayMap[normalizedDepartment] || normalizedDepartment;
    }

    function getTeacherSectionDepartment(department) {
      const normalizedDepartment = teacherNormalizeText(department);
      if (normalizedDepartment === "Economics") {
        return "Social Studies";
      }
      return normalizedDepartment;
    }

    function getTeacherSectionLabel(department) {
      const normalizedDepartment = getTeacherSectionDepartment(department);
      const sectionDisplayMap = {
        "Business Studies": "Account / Business",
        "Social Studies": "Social / Economics",
        "Physical Education": "Health/Physical education"
      };
      return sectionDisplayMap[normalizedDepartment] || normalizedDepartment;
    }

    function inferTeacherSubjectLabel(teacher) {
      const qualification = teacherNormalizeText(teacher.qualification).toLowerCase();
      const role = teacherNormalizeText(teacher.role).toLowerCase();
      const position = teacherNormalizeText(teacher.position).toLowerCase();
      const combined = `${qualification} ${role} ${position}`.trim();

      if (/physical education/.test(combined)) return "Physical Education";
      if (/\bhealth\b/.test(combined)) return "Health";
      if (/computer|ict/.test(combined)) return "Computer Engineering";
      if (/english/.test(combined)) return "English";
      if (/math/.test(combined)) return "Mathematics";
      if (/i-com/.test(combined)) return "Intermediate in Commerce";
      if (/science|physics|chemistry|biology/.test(combined)) return "Science";
      if (/business|finance|management|commerce/.test(combined)) return "Business Studies";
      if (/economics/.test(combined)) return "Economics";
      if (/social/.test(combined)) return "Social Studies";
      if (/nepali/.test(combined)) return "Nepali";

      return "";
    }

    function getAdministrativeStaffOrder(teacher) {
      const role = teacherNormalizeText(teacher.role || teacher.position).toLowerCase();
      const department = teacherNormalizeText(teacher.department).toLowerCase();
      const combined = `${role} ${department}`;

      if (teacherGetLeadershipRoleKey(teacher)) return 0;
      if (/accountant/.test(combined)) return 10;
      if (/librarian/.test(combined)) return 20;
      if (/peon|pune/.test(combined)) return 30;
      if (/security|guard/.test(combined)) return 40;
      return 50;
    }

    function getManagementCommitteeOrder(teacher) {
      const departmentOrder = Number(teacher.departmentOrder);
      if (Number.isFinite(departmentOrder) && departmentOrder > 0) {
        return departmentOrder;
      }

      const id = teacherNormalizeText(teacher.id).toLowerCase();
      const match = id.match(/^management-(\d+)$/);
      return match ? 100000 + Number(match[1]) : Number.MAX_SAFE_INTEGER;
    }


    function getTeacherRoleLabel(teacher, sectionKind = "") {
      const roleLabel = teacherNormalizeText(teacher.role || teacher.position);

      if (sectionKind === "management") {
        return roleLabel || "Management Committee";
      }

      if (sectionKind === "administrative") {
        return roleLabel || "Administrative Staff";
      }

      if (sectionKind === "faculty") {
        if (teacherGetLeadershipRoleKey(teacher)) {
          return roleLabel || "Leadership";
        }
        return roleLabel || "Teacher";
      }

      const department =
        teacherNormalizeText(teacher.publicDepartment || teacher.academicDepartment || teacher.department) ||
        inferTeacherDepartment(teacher);
      const subjectLabel = inferTeacherSubjectLabel(teacher);
      if (department && department !== "Office Staff" && department !== "Leadership") {
        return subjectLabel || getTeacherDepartmentLabel(department);
      }
      return teacherNormalizeText(teacher.role || teacher.position || subjectLabel || department || "Faculty") || "Faculty";
    }

    async function loadTeacherData() {
      try {
        const response = await fetch("/api/teachers", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to load teachers.");
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    }

    function installTeacherPhotoFallbacks() {
      sectionHost.querySelectorAll(".faculty-photo-wrap img").forEach((imgNode) => {
        if (!(imgNode instanceof HTMLImageElement)) return;
        const wrap = imgNode.closest(".faculty-photo-wrap");
        if (!(wrap instanceof HTMLElement)) return;
        const fallbackName =
          teacherNormalizeText(imgNode.getAttribute("alt")) ||
          teacherNormalizeText(
            wrap.closest(".faculty-card")?.querySelector(".faculty-card-body h3")?.textContent
          ) ||
          "Faculty";

        const replaceWithFallback = () => {
          if (wrap.querySelector(".faculty-photo-fallback")) return;
          const fallback = document.createElement("span");
          fallback.className = "faculty-photo-fallback";
          fallback.textContent = teacherGetInitials(fallbackName);
          wrap.innerHTML = "";
          wrap.appendChild(fallback);
        };

        if (imgNode.complete && imgNode.naturalWidth === 0) {
          replaceWithFallback();
          return;
        }

        const verifyPaint = () => {
          if (imgNode.naturalWidth > 0) {
            imgNode.style.setProperty("opacity", "1", "important");
            imgNode.style.setProperty("visibility", "visible", "important");
          }
        };
        if (imgNode.complete) {
          verifyPaint();
        } else {
          imgNode.addEventListener("load", verifyPaint, { once: true });
        }

        imgNode.addEventListener("error", replaceWithFallback, { once: true });
      });
    }

    function renderTeacherCard(teacher, index, sectionKind = "") {
      const name = teacherNormalizeText(teacher.name) || formatTeacherDisplayName(teacher);
      const label = getTeacherRoleLabel(teacher, sectionKind);
      const img = teacherResolveImagePath(teacher.img);
      const imageSrc = img
        ? `${img}${img.includes("?") ? "&" : "?"}v=team-photo-20260813`
        : img;
      const alt = teacherNormalizeText(teacher.alt || teacher.name || "Faculty photo");
      const departmentLabel = teacherNormalizeText(teacher.department);
      const qualification = teacherNormalizeText(teacher.qualification) || "Not available";
      const experience = teacherNormalizeText(teacher.experience) || "Not available";
      const email = teacherNormalizeText(teacher.email) || "Not available";
      const isLeadManagementCard = sectionKind === "management" && index === 0;
      const imageLoading = isLeadManagementCard ? "eager" : "lazy";
      const imagePriority = isLeadManagementCard ? "high" : "low";
      const imageDecode = "auto";
      const photo = imageSrc
        ? `<img src="${teacherEscapeHtml(imageSrc)}" alt="${teacherEscapeHtml(alt)}" loading="${imageLoading}" decoding="${imageDecode}" fetchpriority="${imagePriority}" style="display:block;width:100%;height:100%;opacity:1;visibility:visible;object-fit:cover;object-position:center center;" />`
        : `<span class="faculty-photo-fallback">${teacherEscapeHtml(teacherGetInitials(teacher.name))}</span>`;

      return [
        `<article class="faculty-card" style="--stagger: ${index * 90}ms" data-teacher-id="${teacherEscapeHtml(teacher.id)}" data-section="${teacherEscapeHtml(sectionKind)}" data-department="${teacherEscapeHtml(departmentLabel)}">`,
        '  <div class="faculty-card-surface">',
        `    <div class="faculty-photo-wrap">${photo}</div>`,
        '    <div class="faculty-card-body">',
        `      <h3>${teacherEscapeHtml(name)}</h3>`,
        `      <p>${teacherEscapeHtml(label)}</p>`,
        "    </div>",
        "  </div>",
        '  <div class="faculty-card-detail" aria-hidden="true">',
        '    <div class="faculty-card-detail-row">',
        '      <span>Qualification</span>',
        `      <strong>${teacherEscapeHtml(qualification)}</strong>`,
        "    </div>",
        '    <div class="faculty-card-detail-row">',
        '      <span>Experience</span>',
        `      <strong>${teacherEscapeHtml(experience)}</strong>`,
        "    </div>",
        '    <div class="faculty-card-detail-row">',
        '      <span>Email</span>',
        `      <strong title="${teacherEscapeHtml(email)}">${teacherEscapeHtml(email)}</strong>`,
        "    </div>",
        "  </div>",
        "</article>"
      ].join("\n");
    }

    function renderTeacherSection(section, sectionIndex) {
      if (!section.items.length) return "";
      const cards = section.items.map((teacher, cardIndex) => renderTeacherCard(teacher, cardIndex, section.kind)).join("\n");
      return [
        `<section class="faculty-section faculty-section-${teacherEscapeHtml(section.kind)}" id="${teacherEscapeHtml(section.id)}" data-section-kind="${teacherEscapeHtml(section.kind)}" data-section-index="${sectionIndex}" style="--section-delay: ${sectionIndex * 120}ms">`,
        '  <div class="container">',
        '    <div class="faculty-section-head">',
        `      <p>${teacherEscapeHtml(section.kicker)}</p>`,
        `      <h2>${teacherEscapeHtml(section.title)}</h2>`,
        "    </div>",
        `    <div class="faculty-grid">${cards}</div>`,
        "  </div>",
        "</section>"
      ].join("\n");
    }

    function renderTeacherEmptyState(view) {
      const fallbackTitles = {
        management: "School Management Committee",
        administrative: "Administrative Staff",
        faculty: "Faculty Members"
      };
      const fallbackTitle = fallbackTitles[view] || "Faculty Members";
      sectionHost.innerHTML = [
        `<section class="faculty-section is-visible" id="${teacherEscapeHtml(view || "faculty")}">`,
        '  <div class="container">',
        '    <div class="faculty-section-head">',
        '      <p>School Team</p>',
        `      <h2>${teacherEscapeHtml(fallbackTitle)}</h2>`,
        "    </div>",
        '    <div class="faculty-empty">',
        '      <h3>Details coming soon</h3>',
        '      <p>We are updating the latest team information. Please check back shortly.</p>',
        "    </div>",
        "  </div>",
        "</section>"
      ].join("\n");
    }

    function setupTeacherSingleCardCentering() {
      const grids = Array.from(sectionHost.querySelectorAll(".faculty-grid"));
      grids.forEach((grid) => {
        const cards = Array.from(grid.querySelectorAll(".faculty-card"));
        cards.forEach((card) => card.classList.remove("is-single-last"));
        if (!cards.length) return;
        const computed = window.getComputedStyle(grid);
        const columns = computed.gridTemplateColumns.split(" ").filter(Boolean).length;
        if (!columns) return;
        if (cards.length % columns === 1) {
          cards[cards.length - 1].classList.add("is-single-last");
        }
      });
    }

    function installTeacherDirectorySearch() {
      if (sectionHost.dataset.searchReady) return;
      sectionHost.dataset.searchReady = "true";
      const search = document.createElement("input");
      search.type = "search";
      search.className = "faculty-directory-search";
      search.placeholder = "Search staff or department";
      search.setAttribute("aria-label", "Search staff or department");
      search.autocomplete = "off";
      sectionHost.insertAdjacentElement("beforebegin", search);

      search.addEventListener("input", () => {
        const query = search.value.trim().toLowerCase();
        sectionHost.querySelectorAll(".faculty-section").forEach((section) => {
          let matches = 0;
          section.querySelectorAll(".faculty-card").forEach((card) => {
            const isMatch = !query || card.textContent.toLowerCase().includes(query);
            card.hidden = !isMatch;
            if (isMatch) matches += 1;
          });
          section.hidden = matches === 0;
        });
      });
    }

    async function renderTeacherSections() {
      const teacherData = await loadTeacherData();
      const teachersWithDept = teacherData.map((teacher) => ({
        ...teacher,
        section: inferTeacherSection(teacher),
        department: inferTeacherDepartment(teacher),
        academicDepartment: inferTeacherAcademicDepartment(teacher)
      }));

      const management = teachersWithDept
        .filter((teacher) => teacher.section === "management")
        .sort((left, right) => getManagementCommitteeOrder(left) - getManagementCommitteeOrder(right));
      const admin = teachersWithDept
        .filter((teacher) => teacher.section === "administrative")
        .sort((left, right) => getAdministrativeStaffOrder(left) - getAdministrativeStaffOrder(right));
      const faculty = teachersWithDept.filter(
        (teacher) => teacher.section === "faculty" || (teacher.section === "administrative" && teacher.academicDepartment)
      );

      const groups = new Map();
      faculty.forEach((teacher) => {
        const department =
          teacher.department === "Leadership"
            ? teacher.academicDepartment || ""
            : teacher.department || "";
        if (!department) return;

        const sectionDepartment = getTeacherSectionDepartment(department) || department;
        if (!groups.has(sectionDepartment)) {
          groups.set(sectionDepartment, []);
        }
        groups.get(sectionDepartment).push(teacher);
      });

      const sections = [];

      if (management.length) {
        sections.push({
          id: "management",
          kicker: "School Team",
          title: "School Management Committee",
          items: management,
          kind: "management"
        });
      }

      if (admin.length) {
        sections.push({
          id: "administrative",
          kicker: "School Team",
          title: "Administrative Staff",
          items: admin,
          kind: "administrative"
        });
      }

      let firstFaculty = true;
      groups.forEach((items, department) => {
        items.sort((left, right) => {
          const leftOrder = Number(left.departmentOrder);
          const rightOrder = Number(right.departmentOrder);
          const leftHasOrder = Number.isFinite(leftOrder) && leftOrder > 0;
          const rightHasOrder = Number.isFinite(rightOrder) && rightOrder > 0;
          if (leftHasOrder && rightHasOrder && leftOrder !== rightOrder) return leftOrder - rightOrder;
          if (leftHasOrder !== rightHasOrder) return leftHasOrder ? -1 : 1;
          return 0;
        });
        const slug = department
          .toLowerCase()
          .replace(/&/g, "and")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
        sections.push({
          id: firstFaculty ? "faculty" : `faculty-${slug}`,
          kicker: "Faculty Members",
          title: `Faculty Members: ${getTeacherSectionLabel(department)}`,
          items,
          kind: "faculty"
        });
        firstFaculty = false;
      });

      const view = teacherNormalizeText(sectionHost.dataset.view).toLowerCase();
      let visibleSections = sections;

      if (view && view !== "all") {
        if (view === "faculty") {
          visibleSections = sections.filter(
            (section) => section.id === "faculty" || section.id.startsWith("faculty-")
          );
        } else {
          visibleSections = sections.filter((section) => section.id === view);
        }
      }

      if (!visibleSections.length) {
        renderTeacherEmptyState(view);
      } else {
        sectionHost.innerHTML = visibleSections
          .map((section, index) => renderTeacherSection(section, index))
          .join("\n");
      }

      installTeacherPhotoFallbacks();
      if (view !== "management") {
        installTeacherDirectorySearch();
      }

      function scheduleTeacherSingleCardCentering() {
        window.cancelAnimationFrame(scheduleTeacherSingleCardCentering._raf);
        scheduleTeacherSingleCardCentering._raf = window.requestAnimationFrame(setupTeacherSingleCardCentering);
      }

      scheduleTeacherSingleCardCentering();
      let centerResizeTimer;
      window.addEventListener("resize", () => {
        window.clearTimeout(centerResizeTimer);
        centerResizeTimer = window.setTimeout(scheduleTeacherSingleCardCentering, 140);
      });

      const sectionNodes = Array.from(sectionHost.querySelectorAll(".faculty-section"));
      if (!sectionNodes.length) return;

      if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
        sectionNodes.forEach((section) => section.classList.add("is-visible"));
      } else if ("IntersectionObserver" in window) {
        const observer = new IntersectionObserver(
          (entries, obs) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add("is-visible");
              obs.unobserve(entry.target);
            });
          },
          { threshold: 0.18, rootMargin: "0px 0px -10% 0px" }
        );

        sectionNodes.forEach((section) => observer.observe(section));
      } else {
        sectionNodes.forEach((section) => section.classList.add("is-visible"));
      }
    }

    renderTeacherSections();
  }

  async function initResultPortalAccessControl() {
    const resultLinks = Array.from(document.querySelectorAll(".nav-result-link"));
    if (!resultLinks.length) return;

    function applyResultPortalVisibility(isEnabled) {
      document.body.classList.toggle("result-portal-hidden", !isEnabled);
      resultLinks.forEach((link) => {
        link.hidden = !isEnabled;
        link.setAttribute("aria-hidden", isEnabled ? "false" : "true");
        if (isEnabled) {
          link.style.removeProperty("display");
          link.style.removeProperty("visibility");
          link.style.removeProperty("pointer-events");
        } else {
          link.style.setProperty("display", "none", "important");
          link.style.setProperty("visibility", "hidden", "important");
          link.style.setProperty("pointer-events", "none", "important");
        }
      });
    }

    const cachedVisibility = localStorage.getItem(RESULT_PORTAL_VISIBILITY_KEY);
    if (cachedVisibility === "0") {
      applyResultPortalVisibility(false);
    } else if (cachedVisibility === "1") {
      applyResultPortalVisibility(true);
    }

    try {
      const settings = await fetchIndexPopupSettings("no-store");
      if (!settings) return;
      const isEnabled = !settings || !settings.resultPortal || settings.resultPortal.enabled !== false;
      localStorage.setItem(RESULT_PORTAL_VISIBILITY_KEY, isEnabled ? "1" : "0");
      applyResultPortalVisibility(isEnabled);
    } catch {
      // Keep the nav visible if settings can't be loaded.
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const config = loadConfig();
    initRuntimePerformanceMode();
    initSmoothAnchorScroll();
    applyGlobalImagePerfHints();
    initMobileDataSaver();
    initAccessibilityEnhancements();
    initFormFileFeedback();
    initPageTransitions();
    initPublicPages(config);
    initAdmissionForm();
    initContactForm();
    initSimpleForms();
    initNumberInputWheelLock();
    disableRemovedPages();
    syncPrimaryNavState();
    initNavEffects();
    initPremiumMobileNav();
    initNavDropdowns();
    initDesktopNavPill();
    initMobileNavStrip();
    initAppleMobileNav();
    initScrollReveal();
    initFacilitiesSectionNav();
    initPrincipalProfile();
    initTeacherSections();
    initResultPortalAccessControl();
    initIndexAnnouncementPopup();

    scheduleNonCriticalTask(() => {
      initLatestUpdates();
      initGsapStackedCards();
    }, { timeout: 1400 });

    scheduleNonCriticalTask(() => {
      scheduleIdlePrefetch();
    }, { timeout: 2200, fallbackDelay: 260, waitForLoad: true });

    scheduleNonCriticalTask(() => {
      initFacebookEmbeds();
    }, { timeout: 1800, waitForLoad: true });
  });
})();
