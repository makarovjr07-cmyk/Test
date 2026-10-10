(function () {
  const PAGE_TRANSITION_SESSION_KEY = 'kankai:page-transition';
  const PAGE_TRANSITION_MAX_AGE_MS = 15000;
  const PAGE_LEAVE_DELAY_MS = 220;
  const PAGE_ENTER_CLEANUP_MS = 1250;
  const GALLERY_REFRESH_BROADCAST_KEY = 'kankai:gallery-refresh';
  const prefetchedPageHrefs = new Set();

  function createLoader() {
    const overlay = document.createElement('div');
    overlay.className = 'loading-overlay';
    overlay.innerHTML = '<div class="spinner" aria-label="Loading"></div>';
    document.body.appendChild(overlay);
    return overlay;
  }

  function normalizeNavigationUrl(hrefLike) {
    try {
      if (hrefLike instanceof URL) {
        const copy = new URL(hrefLike.href);
        copy.hash = '';
        return copy;
      }

      const url = new URL(String(hrefLike || ''), window.location.href);
      url.hash = '';
      return url;
    } catch {
      return null;
    }
  }

  function getNavigationSignature(hrefLike) {
    const url = normalizeNavigationUrl(hrefLike);
    return url ? `${url.pathname}${url.search}` : '';
  }

  function readPendingPageTransition() {
    try {
      const raw = sessionStorage.getItem(PAGE_TRANSITION_SESSION_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.href !== 'string' || typeof parsed.ts !== 'number') {
        sessionStorage.removeItem(PAGE_TRANSITION_SESSION_KEY);
        return null;
      }

      if (Date.now() - parsed.ts > PAGE_TRANSITION_MAX_AGE_MS) {
        sessionStorage.removeItem(PAGE_TRANSITION_SESSION_KEY);
        return null;
      }

      return parsed;
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

  function storePendingPageTransition(hrefLike) {
    const signature = getNavigationSignature(hrefLike);
    if (!signature) return;

    try {
      sessionStorage.setItem(
        PAGE_TRANSITION_SESSION_KEY,
        JSON.stringify({
          href: signature,
          ts: Date.now(),
        })
      );
    } catch {
      // Ignore storage failures.
    }
  }

  function normalizeGalleryVersion(value) {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  function broadcastGalleryRefresh(reason, version) {
    try {
      localStorage.setItem(
        GALLERY_REFRESH_BROADCAST_KEY,
        JSON.stringify({
          reason: String(reason || 'gallery-update').trim() || 'gallery-update',
          version: normalizeGalleryVersion(version),
          ts: Date.now(),
        })
      );
    } catch {
      // Ignore storage failures.
    }
  }

  function prefetchDocument(hrefLike) {
    const url = normalizeNavigationUrl(hrefLike);
    if (!url || url.origin !== window.location.origin) return;

    const signature = getNavigationSignature(url);
    const currentSignature = `${window.location.pathname}${window.location.search}`;
    if (!signature || signature === currentSignature || prefetchedPageHrefs.has(signature)) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url.href;
    link.as = 'document';
    document.head.appendChild(link);
    prefetchedPageHrefs.add(signature);
  }

  function shouldAnimatePageLink(link, event) {
    if (!link) return false;

    if (event) {
      if (event.defaultPrevented) return false;
      if (typeof event.button === 'number' && event.button !== 0) return false;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
    }

    const rawHref = String(link.getAttribute('href') || '').trim();
    if (!rawHref) return false;
    if (rawHref.startsWith('#')) return false;
    if (/^(mailto:|tel:|javascript:)/i.test(rawHref)) return false;
    if (link.hasAttribute('download')) return false;
    if (link.dataset.noPageTransition != null) return false;
    const target = String(link.getAttribute('target') || '').trim().toLowerCase();
    if (target && target !== '_self') return false;

    const url = normalizeNavigationUrl(rawHref);
    if (!url || url.origin !== window.location.origin) return false;

    const currentSignature = `${window.location.pathname}${window.location.search}`;
    if (`${url.pathname}${url.search}` === currentSignature) return false;

    return true;
  }

  function setupPublicPageTransitions() {
    if (
      !document.body.classList.contains('result-home-page') &&
      !document.body.classList.contains('result-view-page')
    ) {
      return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const supportsNativeNavigationTransition =
      'onpageswap' in window || 'onpagereveal' in window;
    const startSignature = `${window.location.pathname}${window.location.search}`;

    function triggerPageEnter() {
      const pending = readPendingPageTransition();
      if (!pending || pending.href !== startSignature) return;

      const startAnimation = () => {
        document.documentElement.classList.remove('is-page-transitioning');
        document.body.classList.remove('is-page-leaving');

        window.requestAnimationFrame(() => {
          document.body.classList.add('is-page-entering');
          window.setTimeout(() => {
            document.body.classList.remove('is-page-entering');
          }, PAGE_ENTER_CLEANUP_MS);
        });

        clearPendingPageTransition();
      };

      if (prefersReducedMotion || supportsNativeNavigationTransition) {
        clearPendingPageTransition();
        return;
      }

      if (document.readyState === 'complete') {
        window.setTimeout(startAnimation, 70);
      } else {
        window.addEventListener(
          'load',
          () => {
            window.setTimeout(startAnimation, 70);
          },
          { once: true }
        );
      }
    }

    function handlePageLinkClick(event) {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!shouldAnimatePageLink(link, event)) return;

      const destination = normalizeNavigationUrl(link.href);
      if (!destination) return;

      event.preventDefault();
      if (document.body.classList.contains('is-page-leaving')) return;

      prefetchDocument(destination);
      storePendingPageTransition(destination);
      document.body.classList.remove('mobile-drawer-open', 'mobile-nav-lock', 'mobile-nav-open');
      document.documentElement.classList.add('is-page-transitioning');
      document.body.classList.remove('is-page-entering');
      document.body.classList.add('is-page-leaving');

      window.setTimeout(() => {
        window.location.href = destination.href;
      }, PAGE_LEAVE_DELAY_MS);
    }

    function warmPageLink(event) {
      const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!shouldAnimatePageLink(link)) return;
      prefetchDocument(link.href);
    }

    document.addEventListener('pointerover', warmPageLink, { passive: true });
    document.addEventListener('focusin', warmPageLink);
    document.addEventListener('touchstart', warmPageLink, { passive: true });

    if (!prefersReducedMotion && !supportsNativeNavigationTransition) {
      document.addEventListener('click', handlePageLinkClick);
    }

    window.addEventListener('pageshow', () => {
      document.documentElement.classList.remove('is-page-transitioning');
      document.body.classList.remove('is-page-leaving');
      document.body.classList.remove('is-page-entering');
    });

    triggerPageEnter();
  }

  function setupLoadingOverlay() {
    const loader = createLoader();
    window.__kankaiLoadingOverlay = loader;
    const forms = document.querySelectorAll('form[data-loading="true"]');

    forms.forEach((form) => {
      form.addEventListener('submit', (event) => {
        window.setTimeout(() => {
          if (!event.defaultPrevented) {
            loader.classList.add('active');
          }
        }, 0);
      });
    });
  }

  function setupUppercaseInputs() {
    const uppercaseInputs = document.querySelectorAll('.js-uppercase');

    uppercaseInputs.forEach((input) => {
      input.addEventListener('input', () => {
        input.value = input.value.toUpperCase();
      });
    });
  }

  function setupPasswordToggles() {
    const toggles = document.querySelectorAll('[data-password-toggle]');

    toggles.forEach((toggle) => {
      const targetId = toggle.getAttribute('data-password-toggle');
      if (!targetId) {
        return;
      }

      const input = document.getElementById(targetId);
      if (!input || !(input instanceof HTMLInputElement)) {
        return;
      }

      function syncToggleState() {
        const isHidden = input.type === 'password';
        toggle.textContent = isHidden ? 'Show' : 'Hide';
        toggle.setAttribute('aria-pressed', isHidden ? 'false' : 'true');
        toggle.setAttribute('aria-label', isHidden ? 'Show password' : 'Hide password');
      }

      toggle.addEventListener('click', () => {
        input.type = input.type === 'password' ? 'text' : 'password';
        syncToggleState();
        input.focus();
      });

      syncToggleState();
    });
  }

  function setupNumberInputWheelLock() {
    document.addEventListener(
      'wheel',
      () => {
        const active = document.activeElement;
        if (!(active instanceof HTMLInputElement)) {
          return;
        }
        if (active.type !== 'number') {
          return;
        }
        // Allow normal page scrolling while editing marks in number fields.
        active.blur();
      },
      { passive: true }
    );
  }

  function setupResultViewRedirect() {
    if (!document.body.classList.contains('result-view-page')) {
      return;
    }

    const navigationEntries = performance.getEntriesByType('navigation');
    const navEntry = navigationEntries && navigationEntries[0];
    const isReload = navEntry && navEntry.type === 'reload';
    const redirectTarget = '/result';
    const redirectDelayMs = 30 * 60 * 1000;

    if (isReload) {
      window.location.replace(redirectTarget);
      return;
    }

    window.setTimeout(() => {
      window.location.replace(redirectTarget);
    }, redirectDelayMs);
  }

  function setupAdminSessionGuard() {
    if (!window.location.pathname.startsWith('/admin')) {
      return;
    }
    if (window.location.pathname === '/admin/login') {
      return;
    }

    const guardRoot = document.querySelector('[data-admin-session-guard]');
    if (!(guardRoot instanceof HTMLElement)) {
      return;
    }

    const statusUrl = String(guardRoot.getAttribute('data-admin-session-status-url') || '/admin/session-status').trim();
    const lockUrl = String(guardRoot.getAttribute('data-admin-lock-url') || '/admin/lock').trim();
    const csrfToken = String(guardRoot.getAttribute('data-admin-csrf-token') || '').trim();
    const idleTimeoutRaw = Number.parseInt(guardRoot.getAttribute('data-admin-idle-timeout') || '', 10);
    const idleTimeoutMs = Number.isFinite(idleTimeoutRaw) ? Math.max(60 * 1000, idleTimeoutRaw) : 5 * 60 * 1000;
    const checkIntervalMs = Math.min(Math.max(30 * 1000, Math.floor(idleTimeoutMs / 2)), 2 * 60 * 1000);
    const tabHeartbeatMs = 2000;
    const tabStaleMs = 8000;
    let nextTarget = `${window.location.pathname}${window.location.search}`;
    const currentUrl = new URL(window.location.href);
    const adminTakeoverRequested = currentUrl.searchParams.get('admintakeover') === '1';
    let allowForcedClaim = adminTakeoverRequested;
    const adminTabIdStorageKey = 'kankai:admin-tab-id';
    const adminTabLockStorageKey = 'kankai:admin-active-tab';
    const tabId = (() => {
      let existing = '';
      try {
        existing = String(sessionStorage.getItem(adminTabIdStorageKey) || '').trim();
      } catch (error) {
        existing = '';
      }

      if (existing) {
        return existing;
      }

      const created =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `admin-tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

      try {
        sessionStorage.setItem(adminTabIdStorageKey, created);
      } catch (error) {
        // Ignore storage failures and keep using the in-memory tab id.
      }

      return created;
    })();
    let idleTimer = 0;
    let periodicTimer = 0;
    let tabHeartbeatTimer = 0;
    let redirected = false;
    let lastCheckAt = 0;
    let inFlightCheck = null;

    function markTabReady() {
      document.body.classList.remove('admin-single-tab-pending');
      document.body.classList.add('admin-single-tab-ready');
    }

    function readActiveTabLock() {
      try {
        const raw = localStorage.getItem(adminTabLockStorageKey);
        if (!raw) {
          return null;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed.tabId !== 'string' || typeof parsed.ts !== 'number') {
          localStorage.removeItem(adminTabLockStorageKey);
          return null;
        }

        return parsed;
      } catch (error) {
        return null;
      }
    }

    function isTabLockFresh(lock) {
      return Boolean(lock && typeof lock.ts === 'number' && Date.now() - lock.ts < tabStaleMs);
    }

    function doesCurrentTabOwnLock(lock) {
      return Boolean(lock && lock.tabId === tabId && isTabLockFresh(lock));
    }

    function writeActiveTabLock() {
      try {
        localStorage.setItem(
          adminTabLockStorageKey,
          JSON.stringify({
            tabId,
            ts: Date.now(),
          })
        );
      } catch (error) {
        // Ignore storage failures; the session-status check still protects server access.
      }
    }

    function releaseActiveTabLock() {
      const currentLock = readActiveTabLock();
      if (!doesCurrentTabOwnLock(currentLock)) {
        return;
      }

      try {
        localStorage.removeItem(adminTabLockStorageKey);
      } catch (error) {
        // Ignore storage failures.
      }
    }

    function claimActiveTabLock(force) {
      const currentLock = readActiveTabLock();
      if (force || !currentLock || !isTabLockFresh(currentLock) || currentLock.tabId === tabId) {
        writeActiveTabLock();
        markTabReady();
        return true;
      }
      return false;
    }

    function buildLoginRedirect(reason) {
      const params = new URLSearchParams();
      params.set('next', nextTarget || '/admin/dashboard');
      if (reason === 'singletab') {
        params.set('singletab', '1');
      } else if (reason === 'security') {
        params.set('security', '1');
      } else if (reason === 'expired') {
        params.set('expired', '1');
      }
      return `/admin/login?${params.toString()}`;
    }

    function redirectToLogin(reason, redirectUrl) {
      if (redirected) {
        return;
      }
      redirected = true;
      window.location.replace(redirectUrl || buildLoginRedirect(reason));
    }

    async function lockAdminSession(reason) {
      if (redirected) {
        return;
      }

      redirected = true;
      window.clearTimeout(idleTimer);
      window.clearInterval(periodicTimer);
      window.clearInterval(tabHeartbeatTimer);
      releaseActiveTabLock();

      try {
        await fetch(lockUrl, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          keepalive: true,
          headers: {
            Accept: 'application/json',
            'X-Requested-With': 'XMLHttpRequest',
            'X-CSRF-Token': csrfToken,
          },
        });
      } catch (error) {
        // Ignore network issues and continue redirecting to login.
      }

      window.location.replace(buildLoginRedirect(reason || 'expired'));
    }

    function resetIdleTimer() {
      if (redirected) {
        return;
      }

      window.clearTimeout(idleTimer);
      idleTimer = window.setTimeout(() => {
        void lockAdminSession('expired');
      }, idleTimeoutMs);
    }

    async function checkAdminSession(force) {
      if (redirected) {
        return false;
      }

      if (!claimActiveTabLock(allowForcedClaim)) {
        redirectToLogin('singletab');
        return false;
      }

      allowForcedClaim = false;

      const now = Date.now();
      if (!force && now - lastCheckAt < 15000) {
        markTabReady();
        return true;
      }

      if (inFlightCheck) {
        return inFlightCheck;
      }

      lastCheckAt = now;
      const url = new URL(statusUrl, window.location.origin);
      url.searchParams.set('next', nextTarget || '/admin/dashboard');

      inFlightCheck = fetch(url.toString(), {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
        },
      })
        .then(async (response) => {
          if (response.ok) {
            markTabReady();
            return true;
          }

          let payload = null;
          try {
            payload = await response.json();
          } catch (error) {
            payload = null;
          }

          redirectToLogin(payload && payload.reason ? payload.reason : 'expired', payload && payload.redirect);
          return false;
        })
        .catch(() => true)
        .finally(() => {
          inFlightCheck = null;
        });

      return inFlightCheck;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        resetIdleTimer();
        void checkAdminSession(true);
      }
    }

    const activityHandler = () => {
      resetIdleTimer();
    };

    ['pointerdown', 'keydown', 'scroll', 'touchstart'].forEach((eventName) => {
      window.addEventListener(eventName, activityHandler, { passive: eventName !== 'keydown' });
    });

    window.addEventListener('storage', (event) => {
      if (event.key !== adminTabLockStorageKey || redirected) {
        return;
      }

      const currentLock = readActiveTabLock();
      if (currentLock && isTabLockFresh(currentLock) && currentLock.tabId !== tabId) {
        redirectToLogin('singletab');
      }
    });

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', () => {
      resetIdleTimer();
      void checkAdminSession(true);
    });
    window.addEventListener('pageshow', () => {
      resetIdleTimer();
      void checkAdminSession(true);
    });

    periodicTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void checkAdminSession(true);
      }
    }, checkIntervalMs);

    tabHeartbeatTimer = window.setInterval(() => {
      if (redirected) {
        return;
      }

      if (!claimActiveTabLock(false)) {
        redirectToLogin('singletab');
        return;
      }

      writeActiveTabLock();
    }, tabHeartbeatMs);

    window.addEventListener('pagehide', () => {
      window.clearInterval(tabHeartbeatTimer);
      releaseActiveTabLock();
    });

    window.addEventListener('beforeunload', () => {
      releaseActiveTabLock();
    });

    resetIdleTimer();
    void checkAdminSession(true);

    if (adminTakeoverRequested) {
      allowForcedClaim = false;
      currentUrl.searchParams.delete('admintakeover');
      nextTarget = `${currentUrl.pathname}${currentUrl.search}`;
      window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    }
  }

  function setupAdminRefreshLogout() {
    if (!window.location.pathname.startsWith('/admin')) {
      return;
    }
    if (window.location.pathname === '/admin/login') {
      return;
    }
  }

  function setupAdminSmoothAnchors() {
    if (!window.location.pathname.startsWith('/admin')) {
      return;
    }
    if (window.location.pathname === '/admin/login') {
      return;
    }

    const prefersReducedMotion =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function getHashTarget(hashValue) {
      const hash = String(hashValue || '').trim();
      if (!hash || hash === '#') {
        return null;
      }

      try {
        const target = document.querySelector(hash);
        return target instanceof HTMLElement ? target : null;
      } catch (error) {
        const fallbackId = hash.replace(/^#/, '');
        const target = document.getElementById(fallbackId);
        return target instanceof HTMLElement ? target : null;
      }
    }

    function focusHashTarget(target) {
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const addedTabIndex = !target.hasAttribute('tabindex');
      if (addedTabIndex) {
        target.setAttribute('tabindex', '-1');
      }

      try {
        target.focus({ preventScroll: true });
      } catch (error) {
        target.focus();
      }

      if (addedTabIndex) {
        target.addEventListener(
          'blur',
          () => {
            target.removeAttribute('tabindex');
          },
          { once: true }
        );
      }
    }

    function smoothScrollToTarget(target) {
      if (!(target instanceof HTMLElement)) {
        return;
      }

      focusHashTarget(target);
      target.scrollIntoView({
        block: 'start',
        inline: 'nearest',
        behavior: prefersReducedMotion ? 'auto' : 'smooth',
      });
    }

    function scrollToCurrentHash() {
      const target = getHashTarget(window.location.hash);
      if (!(target instanceof HTMLElement)) {
        return;
      }

      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          smoothScrollToTarget(target);
        });
      });
    }

    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const link = target.closest('a[href*="#"]');
      if (!(link instanceof HTMLAnchorElement)) {
        return;
      }

      const destination = new URL(link.href, window.location.href);
      const current = new URL(window.location.href);
      if (
        destination.origin !== current.origin ||
        destination.pathname !== current.pathname ||
        destination.search !== current.search ||
        !destination.hash
      ) {
        return;
      }

      const hashTarget = getHashTarget(destination.hash);
      if (!(hashTarget instanceof HTMLElement)) {
        return;
      }

      event.preventDefault();
      window.history.pushState({}, '', `${current.pathname}${current.search}${destination.hash}`);
      smoothScrollToTarget(hashTarget);
    });

    window.addEventListener('hashchange', () => {
      scrollToCurrentHash();
    });

    if (window.location.hash) {
      window.setTimeout(scrollToCurrentHash, 110);
    }
  }

  function setupNavEffects() {
    const body = document.body;
    const header = document.querySelector('.header');
    if (!header) {
      return;
    }

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

    function update() {
      const y = window.scrollY || 0;
      const delta = y - lastY;
      const scrollingDown = delta > DIRECTION_DELTA;
      const scrollingUp = delta < -DIRECTION_DELTA;
      const isDesktop = isDesktopViewport();

      body.classList.toggle('nav-scrolled', y > SCROLLED_AT);

      if (isDesktop) {
        body.classList.remove('mobile-drawer-open', 'mobile-nav-lock');
      }

      if (!isDesktop) {
        body.classList.remove('nav-hidden');
      } else if (y <= SHOW_AT_TOP || scrollingUp) {
        body.classList.remove('nav-hidden');
      } else if (scrollingDown && y > HIDE_AFTER) {
        body.classList.add('nav-hidden');
      }

      lastY = y;
      ticking = false;
    }

    window.addEventListener(
      'scroll',
      () => {
        if (!ticking) {
          window.requestAnimationFrame(update);
          ticking = true;
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'resize',
      () => {
        update();
      },
      { passive: true }
    );

    update();
  }

  function setupMobileNavStrip() {
    if (document.body.classList.contains('mobile-nav-ready')) {
      return;
    }

    const nav = document.querySelector('.links');
    if (!nav) {
      return;
    }

    const MOBILE_BREAKPOINT = 900;
    const activeLink = nav.querySelector('a.active');

    function centerActiveLink() {
      if (window.innerWidth > MOBILE_BREAKPOINT || !activeLink) {
        return;
      }
      activeLink.scrollIntoView({ block: 'nearest', inline: 'center' });
    }

    centerActiveLink();
    window.addEventListener(
      'resize',
      () => {
        centerActiveLink();
      },
      { passive: true }
    );
  }

  function setupPremiumMobileNav() {
    const body = document.body;
    const header = document.querySelector('.header');
    const navWrap = document.querySelector('.nav');
    const nav = document.querySelector('.links');
    if (!body || !header || !navWrap || !nav) {
      return;
    }

    const MOBILE_BREAKPOINT = 980;
    if (!nav.id) {
      nav.id = 'primary-nav';
    }

    let toggleBtn =
      navWrap.querySelector('.premium-mobile-toggle') ||
      navWrap.querySelector('#appleMobileToggle');

    if (!toggleBtn) {
      toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.id = 'appleMobileToggle';
      toggleBtn.className = 'premium-mobile-toggle';
      navWrap.appendChild(toggleBtn);
    } else {
      toggleBtn.classList.add('premium-mobile-toggle');
    }

    // Match the main site header layout by keeping the mobile toggle at the end of the nav row.
    navWrap.appendChild(toggleBtn);

    toggleBtn.innerHTML = '<span></span><span></span><span></span>';
    toggleBtn.setAttribute('aria-controls', nav.id);
    toggleBtn.setAttribute('aria-label', 'Open navigation menu');
    toggleBtn.setAttribute('aria-expanded', 'false');

    let backdrop = document.querySelector('.mobile-nav-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('button');
      backdrop.type = 'button';
      backdrop.className = 'mobile-nav-backdrop';
      backdrop.setAttribute('aria-hidden', 'true');
      backdrop.tabIndex = -1;
      body.appendChild(backdrop);
    }

    function isMobileViewport() {
      return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function syncMobileTopOffset() {
      const top = Math.ceil(header.getBoundingClientRect().height) + 8;
      body.style.setProperty('--mobile-nav-top', `${top}px`);
    }

    function hardenMobileNavTapTargets() {
      nav.style.setProperty('pointer-events', 'auto', 'important');
      nav.style.setProperty('z-index', '1100', 'important');
      toggleBtn.style.setProperty('z-index', '1200', 'important');
      backdrop.style.setProperty('z-index', '1000', 'important');
      nav.querySelectorAll('a').forEach((link) => {
        link.style.setProperty('pointer-events', 'auto', 'important');
        link.style.setProperty('position', 'relative', 'important');
        link.style.setProperty('z-index', '2', 'important');
        link.style.setProperty('touch-action', 'manipulation', 'important');
      });
    }

    function resetDesktopNavState() {
      body.classList.remove('mobile-nav-ready', 'mobile-drawer-open', 'mobile-nav-lock');
      body.style.removeProperty('--mobile-nav-top');
      nav.style.removeProperty('pointer-events');
      nav.style.removeProperty('z-index');
      toggleBtn.style.removeProperty('z-index');
      backdrop.style.removeProperty('z-index');
      nav.querySelectorAll('a').forEach((link) => {
        link.style.removeProperty('pointer-events');
        link.style.removeProperty('position');
        link.style.removeProperty('z-index');
        link.style.removeProperty('touch-action');
      });
    }

    function syncMobileMode() {
      if (isMobileViewport()) {
        body.classList.add('mobile-nav-ready');
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
      body.classList.remove('nav-hidden');
      body.classList.toggle('mobile-drawer-open', shouldOpen);
      body.classList.toggle('mobile-nav-lock', shouldOpen);
      if (isMobileViewport()) {
        hardenMobileNavTapTargets();
      }
      toggleBtn.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
      toggleBtn.setAttribute(
        'aria-label',
        shouldOpen ? 'Close navigation menu' : 'Open navigation menu'
      );
      backdrop.setAttribute('aria-hidden', shouldOpen ? 'false' : 'true');
    }

    syncMobileMode();
    setOpenState(false);

    toggleBtn.addEventListener('click', () => {
      const isOpen = body.classList.contains('mobile-drawer-open');
      setOpenState(!isOpen);
    });

    backdrop.addEventListener('click', () => {
      setOpenState(false);
    });

    nav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', (event) => {
        if (!isMobileViewport()) {
          return;
        }
        if (link.hasAttribute('data-dropdown-trigger') || link.hasAttribute('data-submenu-trigger')) {
          const href = String(link.getAttribute('href') || '').trim();
          const parentItem = link.closest('.nav-item.has-dropdown, .nav-subitem.has-submenu');
          const canNavigate =
            href &&
            href !== '#' &&
            parentItem &&
            parentItem.classList.contains('is-open');

          if (!canNavigate) {
            event.preventDefault();
            return;
          }

          setOpenState(false);
          return;
        }
        setOpenState(false);
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        setOpenState(false);
      }
    });

    window.addEventListener(
      'resize',
      () => {
        syncMobileMode();
        if (!isMobileViewport()) {
          setOpenState(false);
        }
      },
      { passive: true }
    );

    window.addEventListener(
      'scroll',
      () => {
        if (isMobileViewport()) {
          syncMobileTopOffset();
        }
      },
      { passive: true }
    );
  }

  function setupNavDropdowns() {
    const nav = document.querySelector('.links');
    if (!nav) {
      return;
    }

    const dropdownItems = Array.from(nav.querySelectorAll('.nav-item.has-dropdown'));
    if (!dropdownItems.length) {
      return;
    }

    const MOBILE_BREAKPOINT = 980;
    const CLOSE_DELAY_MS = 150;

    function isMobileViewport() {
      return window.innerWidth <= MOBILE_BREAKPOINT;
    }

    function closeAllDropdowns() {
      dropdownItems.forEach((item) => {
        item.classList.remove('is-open');
        const trigger = item.querySelector('[data-dropdown-trigger]');
        if (trigger) {
          trigger.setAttribute('aria-expanded', 'false');
        }
      });
      nav.querySelectorAll('.nav-subitem.is-open').forEach((subitem) => {
        subitem.classList.remove('is-open');
        const subTrigger = subitem.querySelector('[data-submenu-trigger]');
        if (subTrigger) {
          subTrigger.setAttribute('aria-expanded', 'false');
        }
      });
    }

    dropdownItems.forEach((item) => {
      const trigger = item.querySelector('[data-dropdown-trigger]');
      const menu = item.querySelector('.nav-dropdown');
      if (!trigger || !menu) {
        return;
      }

      let closeTimer = 0;

      function openMenu() {
        window.clearTimeout(closeTimer);
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }

      function scheduleClose() {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(() => {
          item.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
        }, CLOSE_DELAY_MS);
      }

      function handleEnter() {
        if (isMobileViewport()) {
          return;
        }
        openMenu();
      }

      function handleLeave() {
        if (isMobileViewport()) {
          return;
        }
        scheduleClose();
      }

      trigger.addEventListener('mouseenter', handleEnter);
      trigger.addEventListener('mouseleave', handleLeave);
      menu.addEventListener('mouseenter', handleEnter);
      menu.addEventListener('mouseleave', handleLeave);

      trigger.addEventListener('focus', () => {
        if (!isMobileViewport()) {
          openMenu();
        }
      });

      item.addEventListener('focusout', (event) => {
        if (item.contains(event.relatedTarget)) {
          return;
        }
        scheduleClose();
      });

      trigger.addEventListener('click', (event) => {
        if (!isMobileViewport()) {
          return;
        }
        const isOpen = item.classList.contains('is-open');
        const href = String(trigger.getAttribute('href') || '').trim();
        const canNavigate = Boolean(href && href !== '#');

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

    const submenuItems = Array.from(nav.querySelectorAll('.nav-subitem.has-submenu'));
    submenuItems.forEach((item) => {
      const trigger = item.querySelector('[data-submenu-trigger]');
      const menu = item.querySelector('.nav-submenu');
      if (!trigger || !menu) {
        return;
      }

      let closeTimer = 0;

      function openMenu() {
        window.clearTimeout(closeTimer);
        item.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }

      function scheduleClose() {
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(() => {
          item.classList.remove('is-open');
          trigger.setAttribute('aria-expanded', 'false');
        }, CLOSE_DELAY_MS);
      }

      function handleEnter() {
        if (isMobileViewport()) {
          return;
        }
        openMenu();
      }

      function handleLeave() {
        if (isMobileViewport()) {
          return;
        }
        scheduleClose();
      }

      trigger.addEventListener('mouseenter', handleEnter);
      trigger.addEventListener('mouseleave', handleLeave);
      menu.addEventListener('mouseenter', handleEnter);
      menu.addEventListener('mouseleave', handleLeave);

      trigger.addEventListener('focus', () => {
        if (!isMobileViewport()) {
          openMenu();
        }
      });

      item.addEventListener('focusout', (event) => {
        if (item.contains(event.relatedTarget)) {
          return;
        }
        scheduleClose();
      });

      trigger.addEventListener('click', (event) => {
        if (!isMobileViewport()) {
          return;
        }
        const isOpen = item.classList.contains('is-open');
        const href = String(trigger.getAttribute('href') || '').trim();
        const canNavigate = Boolean(href && href !== '#');

        if (isOpen && canNavigate) {
          submenuItems.forEach((entry) => {
            entry.classList.remove('is-open');
            const entryTrigger = entry.querySelector('[data-submenu-trigger]');
            if (entryTrigger) {
              entryTrigger.setAttribute('aria-expanded', 'false');
            }
          });
          return;
        }

        event.preventDefault();
        submenuItems.forEach((entry) => {
          entry.classList.remove('is-open');
          const entryTrigger = entry.querySelector('[data-submenu-trigger]');
          if (entryTrigger) {
            entryTrigger.setAttribute('aria-expanded', 'false');
          }
        });
        if (!isOpen) {
          openMenu();
        }
      });
    });

    document.addEventListener('click', (event) => {
      if (!isMobileViewport()) {
        return;
      }
      const clickedInside = dropdownItems.some((item) => item.contains(event.target));
      if (!clickedInside) {
        closeAllDropdowns();
      }
    });

    window.addEventListener(
      'resize',
      () => {
        if (!isMobileViewport()) {
          closeAllDropdowns();
        }
      },
      { passive: true }
    );
  }

  function setupTeacherTableToggle() {
    const table = document.querySelector('.teacher-table');
    if (!table) {
      return;
    }

    const rows = Array.from(table.querySelectorAll('[data-teacher-row]'));
    if (!rows.length) {
      return;
    }

    const limit = Math.max(1, Number(table.getAttribute('data-initial-limit') || 6));
    const tableCard = table.closest('.teacher-table-card');
    const countEl = (tableCard || document).querySelector('.js-teacher-count');
    const toggleBtn = (tableCard || document).querySelector('.js-teacher-toggle');
    const searchInput = (tableCard || document).querySelector('[data-teacher-search]');
    const sectionFilter = (tableCard || document).querySelector('[data-teacher-section-filter]');
    const emptyState = (tableCard || document).querySelector('[data-teacher-empty-state]');
    let expanded = false;

    function normalizeTeacherSection(value) {
      const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ');

      if (!normalized || normalized === 'all' || normalized === 'all sections') {
        return '';
      }

      if (normalized.includes('management')) {
        return 'management';
      }

      if (normalized.includes('administrative') || normalized.includes('admin staff')) {
        return 'administrative';
      }

      if (normalized.includes('faculty') || normalized.includes('teacher')) {
        return 'faculty';
      }

      return normalized;
    }

    function getFilteredRows() {
      const query = String(searchInput && 'value' in searchInput ? searchInput.value : '')
        .trim()
        .toLowerCase();
      const selectedSection = normalizeTeacherSection(sectionFilter && 'value' in sectionFilter ? sectionFilter.value : '');

      return rows.filter((row) => {
        const rowSection = normalizeTeacherSection(row.getAttribute('data-section') || row.textContent || '');
        const haystack = String(row.getAttribute('data-search-text') || row.textContent || '').toLowerCase();
        const matchesQuery = !query || haystack.includes(query);
        const matchesSection = !selectedSection || rowSection === selectedSection;
        return matchesQuery && matchesSection;
      });
    }

    function update() {
      const filteredRows = getFilteredRows();
      const total = rows.length;
      const filteredTotal = filteredRows.length;
      const visible = expanded ? filteredTotal : Math.min(limit, filteredTotal);
      const hasQuery = Boolean(searchInput && String(searchInput.value || '').trim());
      const hasSectionFilter = Boolean(sectionFilter && String(sectionFilter.value || '').trim());
      const hasActiveFilter = hasQuery || hasSectionFilter;

      rows.forEach((row) => {
        row.hidden = true;
        row.classList.add('is-hidden');
      });
      filteredRows.forEach((row, index) => {
        const shouldHide = !expanded && index >= limit;
        row.hidden = shouldHide;
        row.classList.toggle('is-hidden', shouldHide);
      });

      if (emptyState) {
        emptyState.hidden = filteredTotal !== 0;
      }

      if (table) {
        table.hidden = filteredTotal === 0;
      }

      if (tableCard) {
        tableCard.classList.toggle('is-filter-empty', filteredTotal === 0);
      }

      if (countEl) {
        if (hasActiveFilter) {
          if (filteredTotal === 0) {
            countEl.textContent = `No matches in ${total} records`;
          } else if (expanded || filteredTotal <= limit) {
            countEl.textContent = `Showing ${filteredTotal} matching records`;
          } else {
            countEl.textContent = `Showing ${visible} of ${filteredTotal} matches`;
          }
        } else if (expanded || total <= limit) {
          countEl.textContent = `Showing ${total} records`;
        } else {
          countEl.textContent = `Showing ${visible} of ${total}`;
        }
      }

      if (toggleBtn) {
        if (filteredTotal <= limit || filteredTotal === 0) {
          toggleBtn.hidden = true;
        } else {
          toggleBtn.hidden = false;
          toggleBtn.textContent = expanded ? 'Show Less' : 'See More';
          toggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
        }
      }
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        expanded = !expanded;
        update();
      });
    }

    if (searchInput instanceof HTMLInputElement) {
      searchInput.addEventListener('input', () => {
        expanded = false;
        update();
      });
    }

    if (sectionFilter instanceof HTMLSelectElement) {
      sectionFilter.addEventListener('change', () => {
        expanded = false;
        update();
      });
    }

    update();
  }

  function setupTeacherLivePreview() {
    const form = document.querySelector('[data-teacher-admin-form]');
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const nameInput = form.querySelector('input[name="name"]');
    const roleInput = form.querySelector('[data-teacher-role-select]');
    const departmentInput = form.querySelector('[data-teacher-department-select]');
    const sectionInput = form.querySelector('select[name="section"]');
    const positionInput = form.querySelector('[data-teacher-card-position]');
    const qualificationInput = form.querySelector('input[name="qualification"]');
    const experienceInput = form.querySelector('input[name="experience"]');
    const emailInput = form.querySelector('input[name="email"]');
    const imagePathInput = form.querySelector('[data-teacher-photo-path]');
    const positionScope = form.querySelector('[data-teacher-position-scope]');
    const positionHelp = form.querySelector('[data-teacher-position-help]');
    const roleGroups = Array.from(roleInput?.querySelectorAll('[data-teacher-role-group]') || []);
    const generalFields = Array.from(form.querySelectorAll('[data-teacher-general-field]'));
    const liveName = document.querySelector('[data-teacher-live-name]');
    const liveRole = document.querySelector('[data-teacher-live-role]');
    const liveQualification = document.querySelector('[data-teacher-live-qualification]');
    const liveImage = document.querySelector('[data-teacher-live-image]');
    const liveFallback = document.querySelector('[data-teacher-live-fallback]');

    if (!(nameInput instanceof HTMLInputElement) || !(roleInput instanceof HTMLSelectElement)) {
      return;
    }

    function syncSectionOptions() {
      const isManagement = sectionInput instanceof HTMLSelectElement && sectionInput.value === 'management';
      const managementRoles = ['Chairperson', 'Member', 'Member Secretary'];
      const staffRoles = [
        'Teacher',
        'Instructor',
        'Principal',
        'Vice Principal',
        'Accountant',
        'Security',
        'Peon',
        'Computer Instructor',
        'Assistant Instructor',
        'Lab Assistant',
        'Computer Engineering Coordinator'
      ];
      const allOptions = Array.from(roleInput.options);

      allOptions.forEach((option) => {
        const optionValue = String(option.value || '').trim();
        const isManagementOption = managementRoles.includes(optionValue);
        const isStaffOption = staffRoles.includes(optionValue);
        const isCustomOption = !isManagementOption && !isStaffOption && optionValue.length > 0;
        const shouldShow = isManagement ? isManagementOption : !isManagementOption || isCustomOption;

        option.hidden = !shouldShow;
        option.disabled = !shouldShow;
        option.style.display = shouldShow ? '' : 'none';
      });

      const selectedRole = String(roleInput.value || '').trim();
      const isAllowedRole = isManagement
        ? managementRoles.includes(selectedRole)
        : (staffRoles.includes(selectedRole) || !managementRoles.includes(selectedRole));

      if (!isAllowedRole) {
        roleInput.value = isManagement ? 'Member' : 'Teacher';
      }

      generalFields.forEach((field) => {
        field.hidden = isManagement;
        field.style.display = isManagement ? 'none' : '';
      });
      if (departmentInput instanceof HTMLSelectElement) departmentInput.required = !isManagement;
      if (experienceInput instanceof HTMLInputElement) experienceInput.required = !isManagement;
      if (emailInput instanceof HTMLInputElement) emailInput.required = !isManagement;
      if (positionInput instanceof HTMLSelectElement) positionInput.required = isManagement;
      if (imagePathInput instanceof HTMLInputElement) imagePathInput.required = isManagement;
      if (positionScope) positionScope.textContent = isManagement ? 'Management Committee' : 'Section';
      if (positionHelp) {
        positionHelp.textContent = isManagement
          ? 'Choose where this card appears in the committee: 1 is first, 2 is second, and so on.'
          : 'Use Position in Section to choose the order: 1 is first, 2 is second, 3 is third. Leave it empty to add the profile last.';
      }
    }

    function syncComputerRoleOptions() {
      const isComputerFaculty =
        departmentInput instanceof HTMLSelectElement &&
        sectionInput instanceof HTMLSelectElement &&
        departmentInput.value === 'Computer Engineering' &&
        sectionInput.value === 'faculty';

      Array.from(roleInput.options).forEach((option) => {
        if (!option.dataset.computerRole) return;
        const keepSelected = option.selected;
        option.hidden = !isComputerFaculty && !keepSelected;
        option.disabled = !isComputerFaculty && !keepSelected;
      });
    }

    function normalizePhotoPath(value) {
      return String(value || '').trim().replace(/^\/+/, '');
    }

    function getInitials(value) {
      return String(value || '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part.charAt(0).toUpperCase())
        .join('') || 'TR';
    }

    function updatePreview() {
      const name = String(nameInput.value || '').trim() || 'Teacher Name';
      const role = String(roleInput.value || '').trim() || 'Role / Position';
      const qualification =
        qualificationInput instanceof HTMLInputElement && String(qualificationInput.value || '').trim()
          ? String(qualificationInput.value || '').trim()
          : 'Qualification will appear here';
      const imagePath =
        imagePathInput instanceof HTMLInputElement ? normalizePhotoPath(imagePathInput.value) : '';

      if (liveName) {
        liveName.textContent = name;
      }
      if (liveRole) {
        liveRole.textContent = role;
      }
      if (liveQualification) {
        liveQualification.textContent = qualification;
      }
      if (liveFallback) {
        liveFallback.textContent = getInitials(name);
      }
      if (liveImage instanceof HTMLImageElement) {
        if (imagePath) {
          liveImage.src = `/${imagePath}`;
          liveImage.alt = name;
          liveImage.hidden = false;
          if (liveFallback) {
            liveFallback.hidden = true;
          }
        } else {
          liveImage.hidden = true;
          liveImage.removeAttribute('src');
          if (liveFallback) {
            liveFallback.hidden = false;
          }
        }
      }
    }

    if (liveImage instanceof HTMLImageElement) {
      liveImage.addEventListener('error', () => {
        liveImage.hidden = true;
        liveImage.removeAttribute('src');
        if (liveFallback) {
          liveFallback.hidden = false;
        }
      });
    }

    [nameInput, roleInput, qualificationInput, imagePathInput, departmentInput, sectionInput].forEach((input) => {
      if (!(input instanceof HTMLInputElement) && !(input instanceof HTMLSelectElement)) {
        return;
      }
      input.addEventListener('input', () => {
        syncSectionOptions();
        syncComputerRoleOptions();
        updatePreview();
      });
      input.addEventListener('change', () => {
        syncSectionOptions();
        syncComputerRoleOptions();
        updatePreview();
      });
    });

    syncSectionOptions();
    syncComputerRoleOptions();
    updatePreview();
  }

  function setupTeacherPhotoUpload() {
    const form = document.querySelector('[data-teacher-admin-form]');
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const csrfInput = form.querySelector('input[name="_csrf"]');
    const nameInput = form.querySelector('input[name="name"]');
    const pathInput = form.querySelector('[data-teacher-photo-path]');
    const fileInput = form.querySelector('[data-teacher-file-input]');
    const dropzone = form.querySelector('[data-teacher-dropzone]');
    const triggerButton = form.querySelector('[data-teacher-file-trigger]');
    const status = form.querySelector('[data-teacher-upload-status]');
    const submitButton = form.querySelector('[data-teacher-submit]');

    if (
      !(csrfInput instanceof HTMLInputElement) ||
      !(pathInput instanceof HTMLInputElement) ||
      !(fileInput instanceof HTMLInputElement) ||
      !(dropzone instanceof HTMLElement) ||
      !(triggerButton instanceof HTMLButtonElement) ||
      !(status instanceof HTMLElement)
    ) {
      return;
    }

    const allowedMimeTypes = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);
    const allowedFilePattern = /\.(?:gif|jpe?g|png|webp)$/i;
    const maxPhotoBytes = 8 * 1024 * 1024;
    let isUploading = false;
    function setStatus(message, tone) {
      status.textContent = message;
      status.classList.remove('is-error', 'is-success');
      if (tone === 'error' || tone === 'success') {
        status.classList.add(`is-${tone}`);
      }
    }

    function normalizePhotoPath(value) {
      return String(value || '')
        .trim()
        .replace(/^\/+/, '');
    }

    function setUploading(nextUploading) {
      isUploading = Boolean(nextUploading);
      dropzone.classList.toggle('is-uploading', isUploading);
      triggerButton.disabled = isUploading;
      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = isUploading;
      }
    }

    async function uploadPhoto(file) {
      const teacherName = nameInput instanceof HTMLInputElement ? nameInput.value.trim() : '';
      const uploadUrl =
        `/admin/teachers/upload-photo?teacherName=${encodeURIComponent(teacherName)}` +
        `&fileName=${encodeURIComponent(file.name || 'teacher-photo')}`;

      let payload = null;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-CSRF-Token': csrfInput.value,
        },
        body: file,
      });

      const responseType = String(response.headers.get('content-type') || '').toLowerCase();
      if (responseType.includes('application/json')) {
        payload = await response.json();
      } else {
        const text = await response.text();
        payload = { error: text };
      }

      if (!response.ok) {
        throw new Error((payload && payload.error) || 'Photo upload failed.');
      }

      return payload || {};
    }

    async function handleSelectedFile(file) {
      if (!(file instanceof File)) {
        return;
      }

      const looksSupported =
        allowedMimeTypes.has(String(file.type || '').toLowerCase()) || allowedFilePattern.test(file.name || '');
      if (!looksSupported) {
        setStatus('Use JPG, PNG, WEBP, or GIF image files only.', 'error');
        return;
      }

      if (file.size > maxPhotoBytes) {
        setStatus('Image is too large. Use a file smaller than 8 MB.', 'error');
        return;
      }

      setUploading(true);
      setStatus(`Uploading ${file.name}...`, null);

      try {
        const payload = await uploadPhoto(file);
        if (!payload.path) {
          throw new Error('Uploaded image path was not returned.');
        }

        pathInput.value = payload.path;
        pathInput.dispatchEvent(new Event('change', { bubbles: true }));
        setStatus(payload.message || 'Photo uploaded successfully.', 'success');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Photo upload failed.';
        setStatus(message, 'error');
      } finally {
        setUploading(false);
        fileInput.value = '';
      }
    }

    function openFilePicker() {
      if (isUploading) {
        return;
      }
      fileInput.click();
    }

    triggerButton.addEventListener('click', openFilePicker);
    dropzone.addEventListener('click', openFilePicker);
    dropzone.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') {
        return;
      }
      event.preventDefault();
      openFilePicker();
    });

    ['dragenter', 'dragover'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        if (!isUploading) {
          dropzone.classList.add('is-dragover');
        }
      });
    });

    ['dragleave', 'dragend', 'drop'].forEach((eventName) => {
      dropzone.addEventListener(eventName, (event) => {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
      });
    });

    dropzone.addEventListener('drop', (event) => {
      if (isUploading) {
        return;
      }
      const files = event.dataTransfer && event.dataTransfer.files;
      if (!files || !files.length) {
        return;
      }
      handleSelectedFile(files[0]);
    });

    fileInput.addEventListener('change', () => {
      const files = fileInput.files;
      if (!files || !files.length) {
        return;
      }
      handleSelectedFile(files[0]);
    });

    pathInput.addEventListener('change', () => {
      const nextPath = normalizePhotoPath(pathInput.value);
      if (!nextPath) {
        setStatus('Drop an image here and the saved path will fill in automatically.', null);
        return;
      }
      setStatus('Photo path updated.', 'success');
    });

    form.addEventListener('submit', (event) => {
      if (!isUploading) {
        return;
      }
      event.preventDefault();
      setStatus('Please wait for the photo upload to finish before saving the teacher.', 'error');
    });

  }

  function initializeGalleryAlbumToggle(album) {
    if (!(album instanceof HTMLElement)) {
      return;
    }

    const toggleButton = album.querySelector('[data-gallery-album-toggle]');
    if (!(toggleButton instanceof HTMLButtonElement)) {
      return;
    }

    const showMoreLabel =
      String(toggleButton.getAttribute('data-show-more-label') || '').trim() || 'Show More Photos';
    const showLessLabel =
      String(toggleButton.getAttribute('data-show-less-label') || '').trim() || 'Show Less Photos';

    function syncToggleLabel() {
      const expanded = !album.classList.contains('is-collapsed');
      toggleButton.textContent = expanded ? showLessLabel : showMoreLabel;
      toggleButton.setAttribute('aria-expanded', expanded ? 'true' : 'false');
    }

    syncToggleLabel();
    if (toggleButton.dataset.galleryToggleBound === '1') {
      return;
    }

    toggleButton.dataset.galleryToggleBound = '1';
    toggleButton.addEventListener('click', () => {
      album.classList.toggle('is-collapsed');
      syncToggleLabel();
    });
  }

  function setupGalleryAdminUploads() {
    const root = document.querySelector('[data-gallery-admin-page]');
    if (!(root instanceof HTMLElement)) {
      return;
    }

    const csrfToken = String(root.getAttribute('data-csrf-token') || '').trim();
    if (!csrfToken) {
      return;
    }

    const allowedMimeTypes = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']);
    const allowedFilePattern = /\.(?:gif|jpe?g|png|webp|mp4|webm)$/i;
    const maxPhotoBytes = 12 * 1024 * 1024;
    const maxVideoBytes = 15 * 1024 * 1024;
    const maxThumbLongEdge = 640;
    const maxPhotoLongEdge = 1600;
    const photoJpegQuality = 0.82;
    const thumbJpegQuality = 0.72;

    function setStatus(statusNode, message, tone) {
      if (!(statusNode instanceof HTMLElement)) {
        return;
      }

      statusNode.textContent = message;
      statusNode.classList.remove('is-error', 'is-success');
      if (tone === 'error' || tone === 'success') {
        statusNode.classList.add(`is-${tone}`);
      }
    }

    function buildAssetSrc(assetPath, version) {
      const normalizedPath = String(assetPath || '').trim().replace(/^\/+/, '');
      if (!normalizedPath) {
        return '';
      }

      const safeVersion = Math.max(1, Number(version) || 1);
      return `/${normalizedPath}?v=${safeVersion}`;
    }

    function readNumericNodeValue(node) {
      if (!(node instanceof HTMLElement)) {
        return 0;
      }

      const match = String(node.textContent || '').match(/\d+/);
      return match ? Number(match[0]) || 0 : 0;
    }

    function setNumericNodeValue(node, value, labelSingular, labelPlural) {
      if (!(node instanceof HTMLElement)) {
        return;
      }

      const safeValue = Math.max(0, Number(value) || 0);
      const label = safeValue === 1 ? labelSingular : labelPlural;
      node.textContent = `${safeValue} ${label}`;
    }

    function updateMetricNode(selector, delta) {
      const node = root.querySelector(selector);
      if (!(node instanceof HTMLElement)) {
        return;
      }

      const nextValue = Math.max(0, readNumericNodeValue(node) + Number(delta || 0));
      node.textContent = String(nextValue);
    }

    function getScaledDimensions(width, height, maxLongEdge) {
      const sourceWidth = Math.max(1, Number(width) || 1);
      const sourceHeight = Math.max(1, Number(height) || 1);
      const largestEdge = Math.max(sourceWidth, sourceHeight);
      const scale = largestEdge > maxLongEdge ? maxLongEdge / largestEdge : 1;
      return {
        width: Math.max(1, Math.round(sourceWidth * scale)),
        height: Math.max(1, Math.round(sourceHeight * scale)),
        resized: scale < 0.999,
      };
    }

    function canvasToBlob(canvas, type, quality) {
      return new Promise((resolve, reject) => {
        if (!(canvas instanceof HTMLCanvasElement)) {
          reject(new Error('Canvas is not available.'));
          return;
        }

        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Unable to prepare image.'));
              return;
            }
            resolve(blob);
          },
          type,
          quality
        );
      });
    }

    async function loadImageSourceFromFile(file) {
      if (typeof createImageBitmap === 'function') {
        const bitmap = await createImageBitmap(file);
        return {
          source: bitmap,
          width: bitmap.width,
          height: bitmap.height,
          cleanup() {
            if (typeof bitmap.close === 'function') {
              bitmap.close();
            }
          },
        };
      }

      const objectUrl = URL.createObjectURL(file);
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve({
            source: img,
            width: img.naturalWidth || img.width,
            height: img.naturalHeight || img.height,
            cleanup() {
              URL.revokeObjectURL(objectUrl);
            },
          });
        };
        img.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Unable to read image.'));
        };
        img.src = objectUrl;
      });
    }

    async function loadVideoSourceFromFile(file) {
      const objectUrl = URL.createObjectURL(file);
      return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        let settled = false;
        let timeoutId = 0;
        const cleanupOnFail = () => {
          if (!settled) {
            URL.revokeObjectURL(objectUrl);
          }
        };
        const finish = () => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeoutId);
          resolve({
            source: video,
            width: video.videoWidth || 1280,
            height: video.videoHeight || 720,
            cleanup() {
              video.pause();
              video.removeAttribute('src');
              video.load();
              URL.revokeObjectURL(objectUrl);
            },
          });
        };

        video.muted = true;
        video.playsInline = true;
        video.preload = 'auto';
        video.addEventListener('error', () => {
          window.clearTimeout(timeoutId);
          cleanupOnFail();
          reject(new Error('Unable to read video preview.'));
        }, { once: true });
        video.addEventListener('loadedmetadata', () => {
          const duration = Number(video.duration) || 0;
          const targetTime = duration > 0.8 ? Math.min(1, Math.max(0.25, duration * 0.15)) : 0;
          try {
            if (!targetTime) {
              finish();
              return;
            }

            video.addEventListener('seeked', finish, { once: true });
            video.currentTime = Math.min(targetTime, Math.max(0, duration - 0.1));
          } catch {
            finish();
          }
        }, { once: true });
        timeoutId = window.setTimeout(() => {
          cleanupOnFail();
          reject(new Error('Video preview timed out.'));
        }, 8000);
        video.src = objectUrl;
        video.load();
      });
    }

    function drawImageToCanvas(source, width, height) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Number(width) || 1);
      canvas.height = Math.max(1, Number(height) || 1);

      const context = canvas.getContext('2d', { alpha: false });
      if (!context) {
        return null;
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      return canvas;
    }

    function createNamedUploadFile(blob, fileName, type) {
      if (typeof File === 'function') {
        return new File([blob], fileName, { type });
      }

      blob.name = fileName;
      return blob;
    }

    async function prepareGalleryUploadAssets(file) {
      const normalizedName = String(file?.name || 'gallery-photo').trim() || 'gallery-photo';
      const normalizedType = String(file?.type || '').trim().toLowerCase();
      const isVideo = normalizedType.startsWith('video/') || /\.(?:mp4|webm)$/i.test(normalizedName);
      if (isVideo) {
        let loadedVideo = null;
        try {
          loadedVideo = await loadVideoSourceFromFile(file);
          const baseName = normalizedName.replace(/\.[^.]+$/u, '') || 'gallery-video';
          const thumbSize = getScaledDimensions(loadedVideo.width, loadedVideo.height, maxThumbLongEdge);
          const thumbCanvas = drawImageToCanvas(loadedVideo.source, thumbSize.width, thumbSize.height);
          const thumbnailBlob = thumbCanvas instanceof HTMLCanvasElement
            ? await canvasToBlob(thumbCanvas, 'image/jpeg', thumbJpegQuality)
            : null;
          return {
            photoFile: file,
            thumbnailFile: thumbnailBlob
              ? createNamedUploadFile(thumbnailBlob, `${baseName}.jpg`, 'image/jpeg')
              : null,
          };
        } catch {
          return {
            photoFile: file,
            thumbnailFile: null,
          };
        } finally {
          if (loadedVideo) loadedVideo.cleanup();
        }
      }

      const isGif = normalizedType === 'image/gif' || /\.gif$/i.test(normalizedName);
      if (isGif) {
        return {
          photoFile: file,
          thumbnailFile: null,
        };
      }

      let loadedSource = null;
      try {
        loadedSource = await loadImageSourceFromFile(file);
      } catch (error) {
        return {
          photoFile: file,
          thumbnailFile: null,
        };
      }

      const baseName = normalizedName.replace(/\.[^.]+$/u, '') || 'gallery-photo';
      try {
        const photoSize = getScaledDimensions(loadedSource.width, loadedSource.height, maxPhotoLongEdge);
        const thumbSize = getScaledDimensions(loadedSource.width, loadedSource.height, maxThumbLongEdge);
        const photoCanvas = drawImageToCanvas(loadedSource.source, photoSize.width, photoSize.height);
        const thumbCanvas = drawImageToCanvas(loadedSource.source, thumbSize.width, thumbSize.height);

        if (!(photoCanvas instanceof HTMLCanvasElement)) {
          return {
            photoFile: file,
            thumbnailFile: null,
          };
        }

        const photoBlob = await canvasToBlob(photoCanvas, 'image/jpeg', photoJpegQuality);
        const thumbnailBlob = thumbCanvas instanceof HTMLCanvasElement
          ? await canvasToBlob(thumbCanvas, 'image/jpeg', thumbJpegQuality)
          : null;

        const optimizedPhotoFile = createNamedUploadFile(photoBlob, `${baseName}.jpg`, 'image/jpeg');
        const thumbnailFile = thumbnailBlob
          ? createNamedUploadFile(thumbnailBlob, `${baseName}.jpg`, 'image/jpeg')
          : null;
        const originalIsJpeg = /^image\/jpe?g$/i.test(normalizedType) || /\.jpe?g$/i.test(normalizedName);
        const shouldKeepOriginal = !photoSize.resized && originalIsJpeg && optimizedPhotoFile.size >= file.size;

        return {
          photoFile: shouldKeepOriginal ? file : optimizedPhotoFile,
          thumbnailFile,
        };
      } finally {
        loadedSource.cleanup();
      }
    }

    function createGalleryMediaPreview(photo, albumLabel) {
      const mediaType = String(photo?.mediaType || 'image').trim().toLowerCase();
      const sourcePath = mediaType === 'video' ? photo.path : (photo.thumbnailPath || photo.path);
      const sourceVersion = mediaType === 'video'
        ? photo.version
        : (photo.thumbnailPath ? photo.thumbnailVersion : photo.version);
      const src = buildAssetSrc(sourcePath, sourceVersion);
      if (!src) {
        return null;
      }

      if (mediaType === 'video') {
        const video = document.createElement('video');
        const source = document.createElement('source');
        source.src = src;
        source.type = String(photo.path || '').toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4';
        video.src = src;
        video.appendChild(source);
        if (photo.thumbnailPath) {
          video.poster = buildAssetSrc(photo.thumbnailPath, photo.thumbnailVersion);
        }
        video.muted = photo.muted !== false;
        video.playsInline = true;
        video.preload = 'auto';
        video.controls = true;
        video.load();
        return video;
      }

      const img = document.createElement('img');
      img.src = src;
      img.alt = `${albumLabel} photo`;
      img.loading = 'lazy';
      img.decoding = 'async';
      return img;
    }

    function ensureGalleryPhotoGrid(album) {
      let grid = album.querySelector('[data-gallery-photo-grid]');
      if (grid instanceof HTMLElement) {
        return grid;
      }

      grid = document.createElement('div');
      grid.className = 'gallery-admin-photo-grid';
      grid.setAttribute('data-gallery-photo-grid', '');

      const emptyState = album.querySelector('[data-gallery-empty-state]');
      const toggleWrap = album.querySelector('.gallery-admin-toggle-wrap');
      if (emptyState instanceof HTMLElement) {
        emptyState.remove();
      }

      if (toggleWrap instanceof HTMLElement) {
        album.insertBefore(grid, toggleWrap);
      } else {
        album.appendChild(grid);
      }

      return grid;
    }

    function ensureGalleryAlbumToggle(album) {
      if (!(album instanceof HTMLElement)) {
        return;
      }

      const photoGrid = album.querySelector('[data-gallery-photo-grid]');
      const photoCount = photoGrid instanceof HTMLElement
        ? photoGrid.querySelectorAll('.gallery-admin-photo-card').length
        : 0;
      if (photoCount <= 6 || album.querySelector('[data-gallery-album-toggle]')) {
        initializeGalleryAlbumToggle(album);
        return;
      }

      album.classList.add('is-collapsed');

      const toggleWrap = document.createElement('div');
      toggleWrap.className = 'gallery-admin-toggle-wrap';

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-ghost btn-small gallery-admin-toggle';
      button.setAttribute('data-gallery-album-toggle', '');
      button.setAttribute('data-show-more-label', 'Show More Photos');
      button.setAttribute('data-show-less-label', 'Show Less Photos');
      button.setAttribute('aria-expanded', 'false');
      button.textContent = 'Show More Photos';

      toggleWrap.appendChild(button);
      album.appendChild(toggleWrap);
      initializeGalleryAlbumToggle(album);
    }

    function createGalleryAdminPhotoCard(albumName, albumLabel, photo) {
      if (!photo || typeof photo !== 'object') {
        return null;
      }

      const article = document.createElement('article');
      article.className = 'gallery-admin-photo-card';

      const media = document.createElement('div');
      media.className = 'gallery-admin-photo-media';
      const mediaPreview = createGalleryMediaPreview(photo, albumLabel);
      if (mediaPreview instanceof HTMLElement) {
        media.appendChild(mediaPreview);
      }
      const mediaType = document.createElement('span');
      mediaType.className = 'gallery-admin-media-type';
      mediaType.textContent = String(photo.mediaType || '').toLowerCase() === 'video' ? 'Video' : 'Photo';
      media.appendChild(mediaType);

      const copy = document.createElement('div');
      copy.className = 'gallery-admin-photo-copy';
      const strong = document.createElement('strong');
      strong.title = photo.name || 'Gallery photo';
      strong.textContent = photo.name || 'Gallery photo';
      const meta = document.createElement('span');
      const sizeLabel = photo.sizeLabel || '';
      const modifiedLabel = photo.modifiedLabel || '';
      meta.textContent = [sizeLabel, modifiedLabel].filter(Boolean).join(' · ');
      copy.appendChild(strong);
      copy.appendChild(meta);
      if (String(photo.mediaType || '').toLowerCase() === 'video') {
        const audioMeta = document.createElement('span');
        audioMeta.textContent = photo.muted === false ? 'Video audio: unmuted' : 'Video audio: muted';
        copy.appendChild(audioMeta);

        const audioForm = document.createElement('form');
        audioForm.action = '/admin/gallery/photos/audio';
        audioForm.method = 'POST';
        audioForm.className = 'inline-form gallery-admin-photo-form gallery-admin-audio-form';

        const audioCsrfInput = document.createElement('input');
        audioCsrfInput.type = 'hidden';
        audioCsrfInput.name = '_csrf';
        audioCsrfInput.value = csrfToken;

        const audioAlbumInput = document.createElement('input');
        audioAlbumInput.type = 'hidden';
        audioAlbumInput.name = 'albumName';
        audioAlbumInput.value = albumName;

        const audioPhotoInput = document.createElement('input');
        audioPhotoInput.type = 'hidden';
        audioPhotoInput.name = 'photoName';
        audioPhotoInput.value = photo.name || '';

        const audioLabel = document.createElement('label');
        audioLabel.className = 'gallery-admin-video-audio';
        const audioCheckbox = document.createElement('input');
        audioCheckbox.type = 'checkbox';
        audioCheckbox.name = 'muted';
        audioCheckbox.value = '1';
        audioCheckbox.checked = photo.muted !== false;
        audioLabel.appendChild(audioCheckbox);
        audioLabel.appendChild(document.createTextNode(' Mute video'));

        const audioButton = document.createElement('button');
        audioButton.type = 'submit';
        audioButton.className = 'btn-ghost btn-small';
        audioButton.textContent = 'Save Audio';

        audioForm.appendChild(audioCsrfInput);
        audioForm.appendChild(audioAlbumInput);
        audioForm.appendChild(audioPhotoInput);
        audioForm.appendChild(audioLabel);
        audioForm.appendChild(audioButton);
        copy.appendChild(audioForm);
      }

      const form = document.createElement('form');
      form.action = '/admin/gallery/photos/delete';
      form.method = 'POST';
      form.className = 'inline-form gallery-admin-photo-form';
      form.setAttribute('data-confirm', 'Remove this photo from the album?');

      const csrfInput = document.createElement('input');
      csrfInput.type = 'hidden';
      csrfInput.name = '_csrf';
      csrfInput.value = csrfToken;

      const albumInput = document.createElement('input');
      albumInput.type = 'hidden';
      albumInput.name = 'albumName';
      albumInput.value = albumName;

      const photoInput = document.createElement('input');
      photoInput.type = 'hidden';
      photoInput.name = 'photoName';
      photoInput.value = photo.name || '';

      const submitButton = document.createElement('button');
      submitButton.type = 'submit';
      submitButton.className = 'btn-danger btn-small';
      submitButton.textContent = 'Remove';

      form.appendChild(csrfInput);
      form.appendChild(albumInput);
      form.appendChild(photoInput);
      form.appendChild(submitButton);

      article.appendChild(media);
      article.appendChild(copy);
      article.appendChild(form);
      form.addEventListener('submit', (event) => {
        const message = String(form.getAttribute('data-confirm') || '').trim() || 'Are you sure?';
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      });

      return article;
    }

    function applyUploadedPhotoUpdate(box, payload) {
      const album = box.closest('[data-gallery-album]');
      if (!(album instanceof HTMLElement) || !payload || typeof payload !== 'object') {
        return;
      }

      const photo = payload.photo;
      if (!photo || typeof photo !== 'object') {
        return;
      }
      const albumLabelNode = album.querySelector('.gallery-admin-album-copy h4');
      const albumLabel = albumLabelNode instanceof HTMLElement
        ? String(albumLabelNode.textContent || '').trim()
        : String(payload.albumName || '').trim();

      const grid = ensureGalleryPhotoGrid(album);
      const photoCountNode = album.querySelector('[data-gallery-album-photo-count]');
      const emptyState = album.querySelector('[data-gallery-empty-state]');
      const wasEmpty = emptyState instanceof HTMLElement || readNumericNodeValue(photoCountNode) === 0;
      const card = createGalleryAdminPhotoCard(payload.albumName || '', albumLabel, photo);
      if (card instanceof HTMLElement) {
        grid.prepend(card);
      }

      const nextPhotoCount = grid.querySelectorAll('.gallery-admin-photo-card').length;
      setNumericNodeValue(photoCountNode, nextPhotoCount, 'photo', 'photos');
      updateMetricNode('[data-gallery-total-photos]', 1);
      if (wasEmpty) {
        updateMetricNode('[data-gallery-empty-albums]', -1);
      }
      ensureGalleryAlbumToggle(album);
    }

    async function uploadPhoto(albumName, preparedUpload, options = {}) {
      const uploadUrl = `/admin/gallery/upload-photo?albumName=${encodeURIComponent(albumName)}`;
      const formData = new FormData();
      formData.append('photo', preparedUpload.photoFile, preparedUpload.photoFile.name || 'gallery-photo');
      formData.append('videoMuted', options.videoMuted === false ? '0' : '1');
      if (preparedUpload.thumbnailFile) {
        formData.append(
          'thumbnail',
          preparedUpload.thumbnailFile,
          preparedUpload.thumbnailFile.name || 'gallery-thumbnail.jpg'
        );
      }

      let payload = null;
      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'X-CSRF-Token': csrfToken,
        },
        body: formData,
      });

      const responseType = String(response.headers.get('content-type') || '').toLowerCase();
      if (responseType.includes('application/json')) {
        payload = await response.json();
      } else {
        const text = await response.text();
        payload = { error: text };
      }

      if (!response.ok) {
        throw new Error((payload && payload.error) || 'Photo upload failed.');
      }

      return payload || {};
    }

    document.querySelectorAll('[data-gallery-upload-box]').forEach((box) => {
      const albumName = String(box.getAttribute('data-album-name') || '').trim();
      const albumAnchor = String(box.getAttribute('data-album-anchor') || '').trim();
      const fileInput = box.querySelector('[data-gallery-file-input]');
      const triggerButton = box.querySelector('[data-gallery-file-trigger]');
      const status = box.querySelector('[data-gallery-upload-status]');

      if (
        !albumName ||
        !(fileInput instanceof HTMLInputElement) ||
        !(triggerButton instanceof HTMLButtonElement)
      ) {
        return;
      }

      let isUploading = false;
      let latestGalleryVersion = normalizeGalleryVersion(root.getAttribute('data-gallery-version'));

      function setUploading(nextUploading) {
        isUploading = Boolean(nextUploading);
        triggerButton.disabled = isUploading;
        fileInput.disabled = isUploading;
        box.classList.toggle('is-uploading', isUploading);
      }

      async function handleFiles(fileList) {
        const files = Array.from(fileList || []);
        if (!files.length || isUploading) {
          return;
        }

        const validFiles = [];
        for (const file of files) {
          const isVideoFile =
            String(file.type || '').toLowerCase().startsWith('video/') ||
            /\.(?:mp4|webm)$/i.test(file.name || '');
          const looksSupported =
            allowedMimeTypes.has(String(file.type || '').toLowerCase()) ||
            allowedFilePattern.test(file.name || '');

          if (!looksSupported) {
            setStatus(status, `Skip ${file.name}: use JPG, PNG, WEBP, GIF, MP4, or WEBM only.`, 'error');
            continue;
          }

          if (file.size > (isVideoFile ? maxVideoBytes : maxPhotoBytes)) {
            setStatus(
              status,
              `Skip ${file.name}: ${isVideoFile ? 'video' : 'file'} must be smaller than ${isVideoFile ? '15' : '12'} MB.`,
              'error'
            );
            continue;
          }

          validFiles.push(file);
        }

        if (!validFiles.length) {
          return;
        }

        setUploading(true);
        let successCount = 0;
        let failureCount = 0;
        let lastMessage = '';

        try {
          for (const file of validFiles) {
            setStatus(status, `Preparing ${file.name}...`, null);
            try {
              const preparedUpload = await prepareGalleryUploadAssets(file);
              setStatus(status, `Uploading ${file.name}...`, null);
              const payload = await uploadPhoto(albumName, preparedUpload);
              latestGalleryVersion = Math.max(
                latestGalleryVersion,
                normalizeGalleryVersion(payload && payload.galleryVersion)
              );
              applyUploadedPhotoUpdate(box, payload);
              successCount += 1;
            } catch (error) {
              failureCount += 1;
              lastMessage = error instanceof Error ? error.message : 'Photo upload failed.';
            }
          }
        } finally {
          setUploading(false);
          fileInput.value = '';
        }

        if (successCount > 0) {
          const summary =
            failureCount > 0
              ? `${successCount} item(s) uploaded. ${failureCount} failed.`
              : `${successCount} item(s) uploaded successfully.`;
          if (albumAnchor) {
            window.history.replaceState(null, '', `#${albumAnchor}`);
          }
          if (latestGalleryVersion > 0) {
            root.setAttribute('data-gallery-version', String(latestGalleryVersion));
          }
          broadcastGalleryRefresh('gallery-media-uploaded', latestGalleryVersion);
          setStatus(status, summary, failureCount > 0 ? 'error' : 'success');
          return;
        }

        setStatus(status, lastMessage || 'Gallery upload failed.', 'error');
      }

      triggerButton.addEventListener('click', () => {
        if (isUploading) {
          return;
        }
        fileInput.click();
      });

      fileInput.addEventListener('change', () => {
        const files = fileInput.files;
        if (!files || !files.length) {
          return;
        }
        handleFiles(files);
      });

      ['dragenter', 'dragover'].forEach((eventName) => {
        box.addEventListener(eventName, (event) => {
          event.preventDefault();
          if (!isUploading) {
            box.classList.add('is-dragging');
          }
        });
      });

      ['dragleave', 'drop'].forEach((eventName) => {
        box.addEventListener(eventName, (event) => {
          event.preventDefault();
          box.classList.remove('is-dragging');
          if (eventName === 'drop' && !isUploading) {
            handleFiles(event.dataTransfer?.files);
          }
        });
      });
    });
  }

  function setupGalleryAdminRefreshSignals() {
    const root = document.querySelector('[data-gallery-admin-page]');
    if (!(root instanceof HTMLElement)) {
      return;
    }

    const successAlert = root.querySelector('.alert-success');
    const successMessage = successAlert instanceof HTMLElement ? String(successAlert.textContent || '').trim() : '';
    if (successMessage) {
      broadcastGalleryRefresh('gallery-admin-success', root.getAttribute('data-gallery-version'));
    }

    try {
      const currentUrl = new URL(window.location.href);
      let didChange = false;
      ['message', 'error'].forEach((key) => {
        if (currentUrl.searchParams.has(key)) {
          currentUrl.searchParams.delete(key);
          didChange = true;
        }
      });

      if (didChange) {
        window.history.replaceState({}, '', `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
      }
    } catch {
      // Ignore URL cleanup failures.
    }
  }

  function setupGalleryAdminAlbumToggles() {
    document.querySelectorAll('[data-gallery-album]').forEach((album) => {
      initializeGalleryAlbumToggle(album);
    });
  }

  function setupConfirmForms() {
    const forms = Array.from(document.querySelectorAll('form[data-confirm]'));
    if (!forms.length) {
      return;
    }

    forms.forEach((form) => {
      form.addEventListener('submit', (event) => {
        const message = String(form.getAttribute('data-confirm') || '').trim() || 'Are you sure?';
        if (!window.confirm(message)) {
          event.preventDefault();
        }
      });
    });
  }

  function setupClearDbFlow() {
    const form = document.getElementById('clearDbForm');
    const popup = document.getElementById('clearDbPopup');
    const confirmDelete = document.getElementById('confirmDelete');
    const adminPassword = document.getElementById('adminPassword');
    const confirmExport = document.getElementById('confirmExport');
    const popupCancel = document.getElementById('clearDbPopupCancel');
    const popupSubmit = document.getElementById('clearDbPopupSubmit');

    if (!(form instanceof HTMLFormElement) || !(popup instanceof HTMLElement)) {
      return;
    }

    let popupApproved = false;

    function closePopup() {
      popup.hidden = true;
      document.body.classList.remove('modal-open');
      popupApproved = false;
      if (window.__kankaiLoadingOverlay instanceof HTMLElement) {
        window.__kankaiLoadingOverlay.classList.remove('active');
      }
      if (confirmExport instanceof HTMLInputElement) {
        confirmExport.checked = false;
      }
    }

    function openPopup() {
      popup.hidden = false;
      document.body.classList.add('modal-open');
    }

    if (popupCancel instanceof HTMLButtonElement) {
      popupCancel.addEventListener('click', () => {
        closePopup();
      });
    }

    popup.addEventListener('click', (event) => {
      if (event.target === popup) {
        closePopup();
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !popup.hidden) {
        closePopup();
      }
    });

    if (popupSubmit instanceof HTMLButtonElement) {
      popupSubmit.addEventListener('click', (event) => {
        if (!(confirmExport instanceof HTMLInputElement) || !confirmExport.checked) {
          event.preventDefault();
          confirmExport?.focus();
          return;
        }

        popupApproved = true;
      });
    }

    form.addEventListener('submit', (event) => {
      if (popupApproved) {
        popupApproved = false;
        return;
      }

      const hasDeleteCheck = confirmDelete instanceof HTMLInputElement && confirmDelete.checked;
      const hasPassword = adminPassword instanceof HTMLInputElement && String(adminPassword.value || '').trim().length > 0;

      if (!hasDeleteCheck || !hasPassword) {
        return;
      }

      event.preventDefault();
      openPopup();
      if (confirmExport instanceof HTMLInputElement) {
        confirmExport.focus();
      }
    });
  }

  function setupAdminAddResultForm() {
    const subjectsContainer = document.getElementById('subjectsContainer');
    const subjectCountSelect = document.getElementById('subjectCount');
    const addSubjectButton = document.getElementById('addSubjectRow');
    const subjectCountBadge = document.getElementById('subjectCountBadge');
    const subjectLiveCount = document.getElementById('subjectLiveCount');
    const classSelect = document.getElementById('class');
    const sectionSelect = document.getElementById('section');

    if (!subjectsContainer || !subjectCountSelect || !addSubjectButton) {
      return;
    }

    const MIN_SUBJECTS = 6;
    const MAX_SUBJECTS = 9;
    const SUBJECT_MODE_CONFIG = {
      '75-25': { theoryMax: 75, practicalMax: 25 },
      '50-50': { theoryMax: 50, practicalMax: 50 },
    };
    const AUTO_SUBJECT_PRESETS = {
      'class 9|c': [
        'Website Design',
        'Fundamentals of Electro-System',
        'Fundamentals of Computer and Application',
        'Programming Principle & Concept in C Language',
        'Mathematics',
        'English',
        'Nepali',
        'Optional Mathematics',
        'Science',
      ],
      'class 9|a': ['Science', 'English', 'Nepali', 'Math', 'Economics', 'Social', 'Education'],
      'class 9|b': ['Science', 'English', 'Nepali', 'Math', 'Economics', 'Account', 'Social'],
      'class 10|c': [
        'Math',
        'Opt Math',
        'Science',
        'Digital Design & Microprocessor',
        'Data Based Management System',
        'Computer Hardware, Electronics Repair & Maintenance',
        'Data Structure & OOP Concept using C++',
        'English',
        'Nepali',
      ],
      'class 10|a': ['Education', 'Science', 'Math', 'Nepali', 'Social', 'English', 'Economics'],
      'class 10|b': ['Science', 'English', 'Nepali', 'Math', 'Economics', 'Account', 'Social'],
      'class 11|c': [
        'Mathematics',
        'Physics',
        'Chemistry',
        'Programming in Java',
        'Computer Organization & Architecture',
        'Web & Mobile Application Development',
        'Operating System',
        'English',
        'Nepali',
      ],
      'class 12|c': [
        'Physics',
        'Chemistry',
        'Mathematics',
        'Software Engineering and Project',
        'Contemporary Technology',
        'Computer Network',
        'Visual Programming',
        'English',
        'Social Studies',
      ],
    };
    let lastAppliedPresetKey = '';

    function getRows() {
      return Array.from(subjectsContainer.querySelectorAll('[data-subject-row]'));
    }

    function getModeConfig(mode) {
      return SUBJECT_MODE_CONFIG[mode] || SUBJECT_MODE_CONFIG['75-25'];
    }

    function normalizeSubjectNameForMatch(subjectName) {
      return String(subjectName || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    function inferSubjectModeFromName(subjectName) {
      const normalizedName = normalizeSubjectNameForMatch(subjectName);
      if (!normalizedName) {
        return '75-25';
      }

      const computerSubjectNames = new Set([
        'website design',
        'fundamentals of electro system',
        'fundamentals of computer and application',
        'programming principle concept in c language',
        'digital design microprocessor',
        'data based management system',
        'computer hardware electronics repair maintenance',
        'data structure oop concept using c',
        'java',
        'programming in java',
        'aoc',
        'computer organization architecture',
        'wmat',
        'web mobile application development',
        'os',
        'operating system',
        'software engineering and project',
        'contemporary technology',
        'computer network',
        'visual programming',
        'computer science',
        'computer',
      ]);

      return isComputerSubjectName(normalizedName, computerSubjectNames) ? '50-50' : '75-25';
    }

    function isComputerSubjectName(subjectName, knownComputerSubjects) {
      const normalizedName = normalizeSubjectNameForMatch(subjectName);
      const knownSubjects = knownComputerSubjects || new Set();
      if (knownSubjects.has(normalizedName)) {
        return true;
      }

      return /\b(computer|programming|software|website|web design|java|microprocessor|database|data base|data structure|visual programming|operating system|electro system|aoc|wmat|os)\b/.test(normalizedName);
    }

    function validateMarksInput(input, maxValue) {
      if (!(input instanceof HTMLInputElement)) {
        return;
      }

      const rawValue = String(input.value || '').trim();
      if (!rawValue) {
        return;
      }

      const numericValue = Number(rawValue);
      if (!Number.isFinite(numericValue) || numericValue <= maxValue) {
        return;
      }

      window.alert("You can't put over maximum marks.");
      input.value = String(maxValue);
      input.focus();
    }

    function validateRowMarks(row) {
      if (!(row instanceof HTMLElement)) {
        return true;
      }

      const modeInput = row.querySelector('input[name="subjectMode[]"]');
      const thInput = row.querySelector('input[name="th[]"]');
      const prInput = row.querySelector('input[name="pr[]"]');
      const mode = modeInput instanceof HTMLInputElement ? modeInput.value : '75-25';
      const config = getModeConfig(mode);

      validateMarksInput(thInput, config.theoryMax);
      validateMarksInput(prInput, config.practicalMax);
      return true;
    }

    function applySubjectMode(row, nextMode) {
      if (!(row instanceof HTMLElement)) {
        return;
      }

      const nameInput = row.querySelector('input[name="subjectName[]"]');
      const computerSubject = isComputerSubjectName(nameInput instanceof HTMLInputElement ? nameInput.value : '');
      const mode = computerSubject
        ? '50-50'
        : (Object.prototype.hasOwnProperty.call(SUBJECT_MODE_CONFIG, nextMode) ? nextMode : '75-25');
      const hiddenInput = row.querySelector('input[name="subjectMode[]"]');
      const thInput = row.querySelector('input[name="th[]"]');
      const prInput = row.querySelector('input[name="pr[]"]');
      const buttons = row.querySelectorAll('[data-mode-button]');
      const config = getModeConfig(mode);

      if (hiddenInput instanceof HTMLInputElement) {
        hiddenInput.value = mode;
      }

      buttons.forEach((button) => {
        if (button instanceof HTMLButtonElement) {
          button.classList.toggle('is-active', button.dataset.mode === mode);
          button.setAttribute('aria-pressed', button.dataset.mode === mode ? 'true' : 'false');
          button.disabled = computerSubject && button.dataset.mode !== '50-50';
          button.setAttribute('aria-disabled', button.disabled ? 'true' : 'false');
        }
      });

      row.classList.toggle('is-computer-subject', computerSubject);

      if (thInput instanceof HTMLInputElement) {
        thInput.max = String(config.theoryMax);
        thInput.placeholder = `TH (0-${config.theoryMax})`;
        if (thInput.value !== '') {
          thInput.value = String(Math.min(Number(thInput.value) || 0, config.theoryMax));
        }
      }

      if (prInput instanceof HTMLInputElement) {
        prInput.max = String(config.practicalMax);
        prInput.placeholder = `INR (0-${config.practicalMax})`;
        if (prInput.value !== '') {
          prInput.value = String(Math.min(Number(prInput.value) || 0, config.practicalMax));
        }
      }

      validateRowMarks(row);
    }

    function applyInferredModeFromRowName(row) {
      if (!(row instanceof HTMLElement)) {
        return;
      }

      const nameInput = row.querySelector('input[name="subjectName[]"]');
      if (!(nameInput instanceof HTMLInputElement)) {
        return;
      }

      applySubjectMode(row, inferSubjectModeFromName(nameInput.value));
    }

    function createSubjectRow(values, animate) {
      const subject = values || {};
      const subjectMode = subject.mode === '50-50' ? '50-50' : '75-25';
      const modeConfig = getModeConfig(subjectMode);
      const row = document.createElement('div');
      row.className = 'subject-row glass-soft';
      row.setAttribute('data-subject-row', '');
      if (animate) {
        row.classList.add('subject-row-added');
      }

      row.innerHTML = [
        '<input name="subjectName[]" type="text" placeholder="Subject Name" required />',
        '<input name="credit[]" type="number" min="0" step="0.01" placeholder="Credit Hour" value="4" required />',
        `<div class="subject-mode-group" data-subject-mode-group>
          <input name="subjectMode[]" type="hidden" value="${subjectMode}" />
          <button type="button" class="subject-mode-option ${subjectMode === '75-25' ? 'is-active' : ''}" data-mode-button data-mode="75-25" aria-pressed="${subjectMode === '75-25' ? 'true' : 'false'}">75 / 25</button>
          <button type="button" class="subject-mode-option ${subjectMode === '50-50' ? 'is-active' : ''}" data-mode-button data-mode="50-50" aria-pressed="${subjectMode === '50-50' ? 'true' : 'false'}">50 / 50</button>
        </div>`,
        `<input name="th[]" type="number" min="0" max="${modeConfig.theoryMax}" step="0.01" placeholder="TH (0-${modeConfig.theoryMax})" required />`,
        `<input name="pr[]" type="number" min="0" max="${modeConfig.practicalMax}" step="0.01" placeholder="INR (0-${modeConfig.practicalMax})" value="0" required />`,
        '<button type="button" class="btn-remove-subject">Remove</button>',
      ].join('');

      row.querySelector('input[name="subjectName[]"]').value = subject.name || '';
      row.querySelector('input[name="credit[]"]').value = subject.credit || '4';
      row.querySelector('input[name="th[]"]').value = subject.th || '';
      const prInput = row.querySelector('input[name="pr[]"]');
      if (prInput) {
        const prValue =
          subject.pr === '' || subject.pr === null || typeof subject.pr === 'undefined'
            ? '0'
            : subject.pr;
        prInput.value = prValue;
      }

      applySubjectMode(row, subjectMode);

      return row;
    }

    function updateControls() {
      const rows = getRows();
      const rowCount = rows.length;

      subjectCountSelect.value = String(rowCount);
      addSubjectButton.style.display = rowCount < MAX_SUBJECTS ? 'inline-flex' : 'none';
      if (subjectCountBadge) {
        subjectCountBadge.textContent = `${rowCount} Rows`;
      }
      if (subjectLiveCount) {
        subjectLiveCount.textContent = `${rowCount} / ${MAX_SUBJECTS}`;
      }

      rows.forEach((row) => {
        const removeButton = row.querySelector('.btn-remove-subject');
        if (removeButton instanceof HTMLButtonElement) {
          removeButton.disabled = rowCount <= MIN_SUBJECTS;
        }
      });
    }

    function clampRowCount(value) {
      return Math.max(MIN_SUBJECTS, Math.min(MAX_SUBJECTS, Number(value) || MIN_SUBJECTS));
    }

    function syncRowsToCount(targetCount, animateNewRows) {
      const desiredCount = clampRowCount(targetCount);
      let rows = getRows();

      while (rows.length < desiredCount) {
        subjectsContainer.appendChild(createSubjectRow({}, animateNewRows));
        rows = getRows();
      }

      while (rows.length > desiredCount) {
        rows[rows.length - 1].remove();
        rows = getRows();
      }

      updateControls();
    }

    function getPresetKey() {
      const classValue = String((classSelect && classSelect.value) || '').trim().toLowerCase();
      const sectionValue = String((sectionSelect && sectionSelect.value) || '').trim().toLowerCase();
      return `${classValue}|${sectionValue}`;
    }

    function applyAutoSubjectPreset(subjectNames) {
      if (!Array.isArray(subjectNames) || subjectNames.length === 0) {
        return;
      }

      const targetCount = clampRowCount(subjectNames.length);
      syncRowsToCount(targetCount, true);

      const rows = getRows();
      rows.forEach((row, index) => {
        const nameInput = row.querySelector('input[name="subjectName[]"]');
        const creditInput = row.querySelector('input[name="credit[]"]');
        const thInput = row.querySelector('input[name="th[]"]');
        const prInput = row.querySelector('input[name="pr[]"]');
        const modeInput = row.querySelector('input[name="subjectMode[]"]');
        const nextName = String(subjectNames[index] || '').trim();

        if (nameInput instanceof HTMLInputElement) {
          nameInput.value = nextName;
        }
        if (modeInput instanceof HTMLInputElement) {
          modeInput.value = inferSubjectModeFromName(nextName);
        }
        if (creditInput instanceof HTMLInputElement && !creditInput.value) {
          creditInput.value = '4';
        }
        if (thInput instanceof HTMLInputElement) {
          thInput.value = '';
        }
        if (prInput instanceof HTMLInputElement) {
          prInput.value = '0';
        }

        applySubjectMode(row, inferSubjectModeFromName(nextName));
      });

      updateControls();
    }

    function tryApplyPresetFromClassSection() {
      const presetKey = getPresetKey();
      const subjectPreset = AUTO_SUBJECT_PRESETS[presetKey];

      if (!subjectPreset) {
        lastAppliedPresetKey = '';
        return;
      }

      if (lastAppliedPresetKey === presetKey) {
        return;
      }

      applyAutoSubjectPreset(subjectPreset);
      lastAppliedPresetKey = presetKey;
    }

    subjectCountSelect.addEventListener('change', function () {
      lastAppliedPresetKey = '';
      syncRowsToCount(this.value, true);
    });

    addSubjectButton.addEventListener('click', () => {
      lastAppliedPresetKey = '';
      syncRowsToCount(getRows().length + 1, true);
    });

    subjectsContainer.addEventListener('click', (event) => {
      const target = event.target;
      if (target instanceof HTMLButtonElement && target.hasAttribute('data-mode-button')) {
        const row = target.closest('[data-subject-row]');
        applySubjectMode(row, target.dataset.mode || '75-25');
        return;
      }

      if (!(target instanceof HTMLElement) || !target.classList.contains('btn-remove-subject')) {
        return;
      }

      const rows = getRows();
      if (rows.length <= MIN_SUBJECTS) {
        return;
      }

      const row = target.closest('[data-subject-row]');
      if (row) {
        row.remove();
        lastAppliedPresetKey = '';
        updateControls();
      }
    });

    subjectsContainer.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (target.name !== 'th[]' && target.name !== 'pr[]') {
        return;
      }

      validateRowMarks(target.closest('[data-subject-row]'));
    });

    subjectsContainer.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (target.name === 'subjectName[]') {
        applyInferredModeFromRowName(target.closest('[data-subject-row]'));
        return;
      }

      if (target.name !== 'th[]' && target.name !== 'pr[]') {
        return;
      }

      validateRowMarks(target.closest('[data-subject-row]'));
    });

    const resultForm = subjectsContainer.closest('form');
    if (resultForm instanceof HTMLFormElement) {
      resultForm.addEventListener('submit', (event) => {
        const rows = getRows();
        rows.forEach((row) => {
          validateRowMarks(row);
        });

        const hasInvalidValue = rows.some((row) => {
          const modeInput = row.querySelector('input[name="subjectMode[]"]');
          const thInput = row.querySelector('input[name="th[]"]');
          const prInput = row.querySelector('input[name="pr[]"]');
          const mode = modeInput instanceof HTMLInputElement ? modeInput.value : '75-25';
          const config = getModeConfig(mode);
          const thValue = Number(thInput instanceof HTMLInputElement ? thInput.value : '');
          const prValue = Number(prInput instanceof HTMLInputElement ? prInput.value : '');

          return (
            (Number.isFinite(thValue) && thValue > config.theoryMax) ||
            (Number.isFinite(prValue) && prValue > config.practicalMax)
          );
        });

        if (hasInvalidValue) {
          event.preventDefault();
        }
      });
    }

    if (classSelect) {
      classSelect.addEventListener('change', tryApplyPresetFromClassSection);
    }

    if (sectionSelect) {
      sectionSelect.addEventListener('change', tryApplyPresetFromClassSection);
    }

    syncRowsToCount(subjectCountSelect.value, false);
    getRows().forEach((row) => {
      const nameInput = row.querySelector('input[name="subjectName[]"]');
      if (nameInput instanceof HTMLInputElement && isComputerSubjectName(nameInput.value)) {
        applySubjectMode(row, '50-50');
      }
    });
  }

  function setupDashboardWorkspace() {
    if (!document.body.classList.contains('admin-dashboard-page')) return;

    const search = document.querySelector('[data-dashboard-results-search]');
    const table = document.querySelector('[data-dashboard-results-table]');
    if (search instanceof HTMLInputElement && table instanceof HTMLTableElement) {
      search.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase();
        table.querySelectorAll('tbody tr').forEach((row) => {
          if (!(row instanceof HTMLTableRowElement)) return;
          row.hidden = Boolean(query) && !row.textContent.toLowerCase().includes(query);
        });
      });
    }

    document.querySelectorAll('.admin-dashboard-page form').forEach((form) => {
      form.addEventListener('submit', () => {
        const submit = form.querySelector('button[type="submit"]');
        if (!(submit instanceof HTMLButtonElement)) return;
        submit.disabled = true;
        submit.dataset.originalLabel = submit.textContent || '';
        submit.textContent = 'Saving...';
        form.setAttribute('aria-busy', 'true');
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupLoadingOverlay();
    setupUppercaseInputs();
    setupPasswordToggles();
    setupNumberInputWheelLock();
    setupPublicPageTransitions();
    setupResultViewRedirect();
    setupAdminSessionGuard();
    setupAdminRefreshLogout();
    setupAdminSmoothAnchors();
    setupNavEffects();
    setupPremiumMobileNav();
    setupNavDropdowns();
    setupMobileNavStrip();
    setupTeacherTableToggle();
    setupTeacherLivePreview();
    setupTeacherPhotoUpload();
    setupGalleryAdminAlbumToggles();
    setupGalleryAdminRefreshSignals();
    setupGalleryAdminUploads();
    setupConfirmForms();
    setupClearDbFlow();
    setupAdminAddResultForm();
    setupDashboardWorkspace();
  });
})();
