document.addEventListener("DOMContentLoaded", function () {
  const root = document.documentElement;
  const themeToggle = document.querySelector(".nesab-theme-toggle");
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  const storageKey = "nesab_theme_mode";
  const systemTheme = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
  const nav = document.querySelector(".nesab-nav");
  const toggle = document.querySelector(".nesab-nav-toggle");
  const navLinksContainer = document.getElementById("site-nav");
  const navLinks = Array.from(document.querySelectorAll('.nesab-nav-links .nesab-link[href^="#"]'));
  const allAnchors = Array.from(document.querySelectorAll('a[href^="#"]'));

  function readStoredTheme() {
    try {
      const storedTheme = window.localStorage.getItem(storageKey);
      return storedTheme === "dark" || storedTheme === "light" ? storedTheme : null;
    } catch (error) {
      return null;
    }
  }

  function getPreferredTheme() {
    return systemTheme && systemTheme.matches ? "dark" : "light";
  }

  function syncTheme(theme) {
    const isDark = theme === "dark";

    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", isDark);

    if (themeToggle) {
      themeToggle.setAttribute("aria-pressed", String(isDark));
      themeToggle.setAttribute("aria-label", isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن");
      themeToggle.setAttribute("title", isDark ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن");
    }

    if (themeColorMeta) {
      themeColorMeta.setAttribute("content", isDark ? "#000000" : "#ffffff");
    }

    var logoSrc = isDark ? "assets/header_logo_dark.png" : "assets/header_logo_light.png";
    var navLogo = document.getElementById("nav-brand-logo");
    var footerLogo = document.getElementById("footer-brand-logo");
    if (navLogo) navLogo.src = logoSrc;
    if (footerLogo) footerLogo.src = logoSrc;
  }

  function applyTheme(theme, persist) {
    syncTheme(theme);

    if (!persist) {
      return;
    }

    try {
      window.localStorage.setItem(storageKey, theme);
    } catch (error) {
      /* Ignore storage write failures. */
    }
  }

  function getOffset() {
    return (nav ? nav.offsetHeight : 0) + 16;
  }

  function closeMenu() {
    if (!toggle || !navLinksContainer) {
      return;
    }

    toggle.classList.remove("is-active");
    toggle.setAttribute("aria-expanded", "false");
    navLinksContainer.classList.remove("is-open");
    document.body.classList.remove("nav-open");
  }

  function openMenu() {
    if (!toggle || !navLinksContainer) {
      return;
    }

    toggle.classList.add("is-active");
    toggle.setAttribute("aria-expanded", "true");
    navLinksContainer.classList.add("is-open");
    document.body.classList.add("nav-open");
  }

  function toggleMenu() {
    if (!toggle || !navLinksContainer) {
      return;
    }

    if (navLinksContainer.classList.contains("is-open")) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function scrollToHash(hash) {
    const target = document.querySelector(hash);
    if (!target) {
      return;
    }

    const top = target.getBoundingClientRect().top + window.scrollY - getOffset();
    window.scrollTo({ top, behavior: "smooth" });
  }

  function updateNavState() {
    if (!nav) {
      return;
    }

    nav.classList.toggle("is-scrolled", window.scrollY > 10);
  }

  function updateActiveLink() {
    const marker = getOffset() + 80;
    let currentId = "home";

    navLinks.forEach(function (link) {
      const hash = link.getAttribute("href");
      const section = hash ? document.querySelector(hash) : null;
      if (!section) {
        return;
      }

      if (section.offsetTop <= window.scrollY + marker) {
        currentId = section.id;
      }
    });

    navLinks.forEach(function (link) {
      const isActive = link.getAttribute("href") === "#" + currentId;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "page");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  }

  syncTheme(readStoredTheme() || getPreferredTheme());

  if (toggle) {
    toggle.addEventListener("click", toggleMenu);
  }

  if (themeToggle) {
    themeToggle.addEventListener("click", function () {
      const nextTheme = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(nextTheme, true);
    });
  }

  if (systemTheme) {
    const handleSystemThemeChange = function (event) {
      if (readStoredTheme()) {
        return;
      }

      syncTheme(event.matches ? "dark" : "light");
    };

    if (typeof systemTheme.addEventListener === "function") {
      systemTheme.addEventListener("change", handleSystemThemeChange);
    } else if (typeof systemTheme.addListener === "function") {
      systemTheme.addListener(handleSystemThemeChange);
    }
  }

  allAnchors.forEach(function (anchor) {
    const hash = anchor.getAttribute("href");
    if (!hash || hash === "#") {
      return;
    }

    anchor.addEventListener("click", function (event) {
      const target = document.querySelector(hash);
      if (!target) {
        return;
      }

      event.preventDefault();
      closeMenu();
      scrollToHash(hash);
    });
  });

  document.addEventListener("click", function (event) {
    if (!nav || !navLinksContainer || !navLinksContainer.classList.contains("is-open")) {
      return;
    }

    if (!nav.contains(event.target)) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeMenu();
    }
  });

  window.addEventListener("resize", function () {
    if (window.innerWidth > 980) {
      closeMenu();
    }
    updateActiveLink();
  });

  window.addEventListener("scroll", function () {
    updateNavState();
    updateActiveLink();
  }, { passive: true });

  updateNavState();
  updateActiveLink();
});
