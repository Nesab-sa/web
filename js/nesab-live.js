/**
 * Nesab — Live Display Layer v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Renders three dashboard-controlled features on every page, with no redeploy:
 *
 *  1. Announcement header bar  ← public_config/header
 *     (text / colors / link / schedule / per-page targeting / dismissible)
 *  2. Maintenance mode overlay ← public_config/maintenance
 *     (message + automatic end time)
 *  3. Per-page SEO             ← public_config/seo
 *     (title / meta description / meta keywords keyed by page slug)
 *  4. Products/tools cards sync ← categories collection
 *     (web landing + app index: names/descriptions follow the dashboard,
 *      hidden tools disappear)
 *  5. App index editable texts ← site_content/appIndex
 *     (elements tagged data-live="<path>", same pattern as the web landing)
 *
 * Design safety:
 *  - When both features are OFF (or docs missing / network down) this script
 *    renders NOTHING and touches NOTHING — pages stay pixel-identical.
 *  - When the banner is ON it shifts the page's own fixed header + body down
 *    via inline styles only, and restores them exactly when hidden.
 *  - All text is applied with textContent (no HTML injection possible).
 *
 * Usage: <script src="nesab-live.js" data-surface="app" defer></script>
 *        data-surface is "app" (app.nesab.sa pages) or "web" (nesab.sa).
 *
 * Reads are public (firestore.rules: public_config → read: true).
 * Writes happen only from the dashboard (authenticated admins).
 */
(function () {
  "use strict";

  // ── Configuration ──────────────────────────────────────────────────────────
  var PROJECT_ID = "nesab-26771";
  var API_KEY = "AIzaSyA4lkLR9bumW1Jb7FmmZgN5Ry3qZHC5_dE"; // public web key (same as the pages' own Firebase config)
  var BASE_URL = "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
    "/databases/(default)/documents/public_config/";
  var CACHE_KEY = "nesab_live_display_v1";
  var DISMISS_KEY = "nesab_header_dismissed_v1";

  var BANNER_ID = "nesab-live-banner";
  var OVERLAY_ID = "nesab-live-maintenance";

  // Selectors of the pages' own fixed top headers (app pages use .hdr /
  // .page-header, the web site uses .nesab-nav). Shifted down while the
  // banner is visible, restored when it is not.
  var FIXED_HEADER_SELECTORS = [".hdr", ".page-header", ".nesab-nav"];

  // ── Context ────────────────────────────────────────────────────────────────
  function currentSurface() {
    var el = document.currentScript ||
      document.querySelector('script[src*="nesab-live"]');
    var s = el && el.getAttribute("data-surface");
    return s === "web" ? "web" : "app";
  }

  function currentSlug() {
    var path = (location.pathname || "/").split("/").pop() || "index.html";
    var slug = path.replace(/\.html?$/i, "");
    return slug === "" ? "index" : slug;
  }

  var SURFACE = currentSurface();
  var SLUG = currentSlug();

  // ── Firestore REST decoding ────────────────────────────────────────────────
  function decodeFields(fields) {
    var out = {};
    for (var key in fields) {
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        out[key] = decodeValue(fields[key]);
      }
    }
    return out;
  }

  function decodeValue(v) {
    if (!v || typeof v !== "object") return null;
    if ("stringValue" in v) return v.stringValue;
    if ("integerValue" in v) return Number(v.integerValue);
    if ("doubleValue" in v) return v.doubleValue;
    if ("booleanValue" in v) return v.booleanValue;
    if ("timestampValue" in v) return v.timestampValue;
    if ("nullValue" in v) return null;
    if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodeValue);
    return null;
  }

  // نميّز صراحةً بين ثلاث حالات:
  //  - كائن الإعداد  → المستند موجود ومفعّل
  //  - ABSENT ({__absent:true}) → المستند غير موجود (404) = الميزة مطفأة عمداً
  //  - null → فشل شبكة حقيقي = نُبقي آخر قيمة من الكاش (لا نُطفئ بالخطأ)
  var ABSENT = { __absent: true };
  function fetchDoc(docId) {
    return fetch(BASE_URL + docId + "?key=" + API_KEY)
      .then(function (res) {
        if (!res.ok) return ABSENT; // 404 وغيره = غير موجود/مطفأ
        return res.json().then(function (doc) {
          return doc && doc.fields ? decodeFields(doc.fields) : ABSENT;
        });
      })
      .catch(function () { return null; }); // فشل شبكة = أبقِ الكاش
  }

  // دمج ثلاثي: absent→مطفأ (null)، فشل شبكة (null)→الكاش، وإلا→النتيجة الحيّة.
  function resolveDoc(result, cachedValue) {
    if (result === null) return cachedValue || null;      // شبكة فشلت
    if (result && result.__absent) return null;           // غير موجود = مطفأ
    return result;                                        // قيمة حيّة
  }

  // ── Shared helpers ─────────────────────────────────────────────────────────
  function parseTime(value) {
    if (!value) return null;
    var t = Date.parse(value);
    return isNaN(t) ? null : t;
  }

  function withinSchedule(cfg, now) {
    var start = parseTime(cfg.startAt);
    var end = parseTime(cfg.endAt);
    if (start !== null && now < start) return false;
    if (end !== null && now > end) return false;
    return true;
  }

  function targetsSurface(cfg) {
    if (SURFACE === "app") return cfg.showOnApp !== false;
    return cfg.showOnWeb !== false;
  }

  function targetsPage(cfg) {
    if (cfg.allPages !== false) return true;
    var pages = cfg.pages;
    if (!Array.isArray(pages)) return false;
    for (var i = 0; i < pages.length; i++) {
      if (pages[i] === SLUG) return true;
    }
    return false;
  }

  function isHexColor(value) {
    return typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value);
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function writeCache(data) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); }
    catch (e) { /* storage blocked — non-fatal */ }
  }

  // ── Announcement banner ────────────────────────────────────────────────────
  // Elements displaced while the banner is visible. Their offsets track the
  // banner's REAL rendered height live (ResizeObserver + window resize), so
  // text wrap, font swap, or viewport changes can never leave a stale gap.
  var shiftTargets = []; // [{el, prop, prevInline, base}]
  var bannerObserver = null;
  var bannerResizeHandler = null;

  function collectShiftTargets() {
    shiftTargets = [{
      el: document.body,
      prop: "marginTop",
      prevInline: document.body.style.marginTop,
      base: parseFloat(getComputedStyle(document.body).marginTop) || 0
    }];
    for (var i = 0; i < FIXED_HEADER_SELECTORS.length; i++) {
      var els = document.querySelectorAll(FIXED_HEADER_SELECTORS[i]);
      for (var j = 0; j < els.length; j++) {
        if (getComputedStyle(els[j]).position === "fixed") {
          shiftTargets.push({
            el: els[j],
            prop: "top",
            prevInline: els[j].style.top,
            base: parseFloat(getComputedStyle(els[j]).top) || 0
          });
        }
      }
    }
  }

  function applyShift(h) {
    for (var i = 0; i < shiftTargets.length; i++) {
      var t = shiftTargets[i];
      t.el.style[t.prop] = (t.base + h) + "px";
    }
  }

  function clearShift() {
    for (var i = shiftTargets.length - 1; i >= 0; i--) {
      var t = shiftTargets[i];
      t.el.style[t.prop] = t.prevInline;
    }
    shiftTargets = [];
  }

  function hideBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (bannerObserver) {
      bannerObserver.disconnect();
      bannerObserver = null;
    }
    if (bannerResizeHandler) {
      window.removeEventListener("resize", bannerResizeHandler);
      bannerResizeHandler = null;
    }
    clearShift();
  }

  function bannerSignature(cfg) {
    return [cfg.text, cfg.link, cfg.startAt, cfg.endAt].join("|");
  }

  function wasDismissed(cfg) {
    if (cfg.dismissible === false) return false;
    try { return sessionStorage.getItem(DISMISS_KEY) === bannerSignature(cfg); }
    catch (e) { return false; }
  }

  function rememberDismissed(cfg) {
    try { sessionStorage.setItem(DISMISS_KEY, bannerSignature(cfg)); }
    catch (e) { /* non-fatal */ }
  }

  function renderBanner(cfg) {
    hideBanner();

    var active = cfg && cfg.enabled === true &&
      typeof cfg.text === "string" && cfg.text.trim() !== "" &&
      targetsSurface(cfg) && targetsPage(cfg) &&
      withinSchedule(cfg, Date.now()) && !wasDismissed(cfg);
    if (!active) return;

    var bg = isHexColor(cfg.bgColor) ? cfg.bgColor : "#7c3aed";
    var fg = isHexColor(cfg.textColor) ? cfg.textColor : "#ffffff";

    var bar = document.createElement("div");
    bar.id = BANNER_ID;
    bar.setAttribute("dir", "rtl");
    bar.style.cssText =
      "position:fixed;top:0;right:0;left:0;z-index:2147482000;" +
      "display:flex;align-items:center;justify-content:center;gap:10px;" +
      "padding:9px 40px 9px 14px;box-sizing:border-box;" +
      "font-family:'Cairo','Readex Pro',system-ui,sans-serif;" +
      "font-size:14px;font-weight:600;line-height:1.5;text-align:center;" +
      "background:" + bg + ";color:" + fg + ";" +
      "box-shadow:0 2px 8px rgba(0,0,0,.18);";

    // الرابط يُقبل فقط إن كان http(s) أو مساراً نسبياً — يمنع javascript:/data: URIs.
    var linkOk = typeof cfg.link === "string" && cfg.link.trim() !== "" &&
      /^(https?:\/\/|\/)/i.test(cfg.link.trim());
    var content;
    if (linkOk) {
      content = document.createElement("a");
      content.href = cfg.link.trim();
      content.target = "_blank";
      content.rel = "noopener noreferrer";
      content.style.cssText =
        "color:inherit;text-decoration:underline;text-underline-offset:3px;";
    } else {
      content = document.createElement("span");
    }
    content.textContent = cfg.text;
    bar.appendChild(content);

    if (cfg.dismissible !== false) {
      var close = document.createElement("button");
      close.type = "button";
      close.setAttribute("aria-label", "إغلاق الشريط");
      close.textContent = "✕";
      close.style.cssText =
        "position:absolute;left:10px;top:50%;transform:translateY(-50%);" +
        "background:none;border:none;cursor:pointer;color:inherit;" +
        "font-size:15px;line-height:1;padding:4px;opacity:.85;";
      close.onclick = function () {
        rememberDismissed(cfg);
        hideBanner();
      };
      bar.appendChild(close);
    }

    document.body.appendChild(bar);

    // Shift the page down by the banner's live rendered height —
    // inline styles only, kept in sync with wraps and viewport changes.
    collectShiftTargets();
    var syncShift = function () {
      var current = document.getElementById(BANNER_ID);
      if (!current) return;
      applyShift(Math.ceil(current.getBoundingClientRect().height));
    };
    syncShift();
    if (typeof ResizeObserver === "function") {
      bannerObserver = new ResizeObserver(syncShift);
      bannerObserver.observe(bar);
    }
    bannerResizeHandler = syncShift;
    window.addEventListener("resize", bannerResizeHandler);

    // Auto-hide the moment the schedule window closes.
    var end = parseTime(cfg.endAt);
    if (end !== null) {
      var remaining = end - Date.now();
      if (remaining > 0 && remaining < 2147483647) {
        setTimeout(hideBanner, remaining + 500);
      }
    }
  }

  // ── Maintenance overlay ────────────────────────────────────────────────────
  var maintenanceTimer = null;

  function hideMaintenance() {
    var el = document.getElementById(OVERLAY_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
    if (document.body.style.overflow === "hidden") {
      document.body.style.overflow = "";
    }
    if (maintenanceTimer) {
      clearInterval(maintenanceTimer);
      maintenanceTimer = null;
    }
  }

  function formatRemaining(ms) {
    var total = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(total / 3600);
    var m = Math.floor((total % 3600) / 60);
    var s = total % 60;
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    return pad(h) + ":" + pad(m) + ":" + pad(s);
  }

  function renderMaintenance(cfg) {
    hideMaintenance();

    var now = Date.now();
    var end = cfg ? parseTime(cfg.endAt) : null;
    var active = cfg && cfg.enabled === true && targetsSurface(cfg) &&
      (end === null || now < end);
    if (!active) return;

    var overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("dir", "rtl");
    overlay.setAttribute("role", "alert");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;display:flex;" +
      "flex-direction:column;align-items:center;justify-content:center;" +
      "gap:14px;padding:24px;box-sizing:border-box;text-align:center;" +
      "background:rgba(10,12,24,.96);color:#fff;" +
      "font-family:'Cairo','Readex Pro',system-ui,sans-serif;";

    var icon = document.createElement("div");
    icon.textContent = "🛠️";
    icon.style.cssText = "font-size:44px;line-height:1;";
    overlay.appendChild(icon);

    var title = document.createElement("div");
    title.textContent = "الموقع تحت الصيانة";
    title.style.cssText = "font-size:22px;font-weight:700;";
    overlay.appendChild(title);

    var msg = document.createElement("div");
    msg.textContent =
      (typeof cfg.message === "string" && cfg.message.trim() !== "")
        ? cfg.message
        : "نعمل حالياً على تحسين الخدمة — نعود إليكم قريباً بإذن الله.";
    msg.style.cssText =
      "font-size:15px;line-height:1.9;max-width:520px;opacity:.92;";
    overlay.appendChild(msg);

    if (end !== null) {
      var timer = document.createElement("div");
      timer.style.cssText =
        "font-size:15px;font-weight:700;direction:ltr;" +
        "background:rgba(255,255,255,.1);border-radius:10px;padding:8px 18px;";
      overlay.appendChild(timer);

      var tick = function () {
        var left = end - Date.now();
        if (left <= 0) {
          hideMaintenance(); // auto end — the page becomes usable again
          return;
        }
        timer.textContent = formatRemaining(left);
      };
      tick();
      maintenanceTimer = setInterval(tick, 1000);
    }

    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";
  }

  // ── Per-page SEO ───────────────────────────────────────────────────────────
  function upsertMeta(name, content) {
    var el = document.querySelector('meta[name="' + name + '"]');
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute("name", name);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function applySeo(cfg) {
    // cfg.pages = { "<slug>": {title, description, keywords} }
    if (!cfg || !cfg.pages || typeof cfg.pages !== "object") return;
    var page = cfg.pages[SLUG];
    if (!page || typeof page !== "object") return;
    if (typeof page.title === "string" && page.title.trim() !== "") {
      document.title = page.title;
    }
    if (typeof page.description === "string" && page.description.trim() !== "") {
      upsertMeta("description", page.description);
    }
    if (typeof page.keywords === "string" && page.keywords.trim() !== "") {
      upsertMeta("keywords", page.keywords);
    }
  }

  // ── Products/tools cards ← categories collection ──────────────────────────
  // بطاقات الأدوات تتبع «إدارة الفئات والمحتوى» في الداشبورد:
  //  - موقع nesab.sa: بطاقات .nesab-product-card في الصفحة الرئيسية
  //  - فهرس التطبيق app.nesab.sa/index: بطاقات .link-card
  // الاسم والوصف يتحدثان، والأداة الموقوفة (isActive=false) تختفي —
  // وعند غياب البيانات تبقى البطاقات المدمجة كما هي.
  function fetchCategories() {
    return fetch(
      "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
      "/databases/(default)/documents/categories?pageSize=300&key=" + API_KEY
    )
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (body) {
        if (!body || !Array.isArray(body.documents)) return null;
        return body.documents.map(function (doc) {
          var d = decodeFields(doc.fields || {});
          d._id = (doc.name || "").split("/").pop();
          return d;
        });
      })
      .catch(function () { return null; });
  }

  function linkTail(url) {
    var last = (url || "").split("?")[0].split("#")[0].split("/").pop() || "";
    return last.replace(/\.html?$/i, "");
  }

  // مطابقة الأداة: تطابق تام لذيل الرابط أو معرّف المستند فقط —
  // بلا احتواء جزئي حتى لا تُطابَق بطاقة بفئة خاطئة عند تداخل الأسماء.
  function matchTool(slug, cats) {
    for (var j = 0; j < cats.length; j++) {
      var link = (cats[j].calculatorLink || "").toString();
      if (linkTail(link) === slug || cats[j]._id === slug) return cats[j];
    }
    return null;
  }

  var PRODUCT_CARD_KINDS = [
    { surface: "web", card: ".nesab-product-card",
      name: ".nesab-product-name", desc: ".nesab-product-desc" },
    { surface: "app", onlySlug: "index", card: ".link-card",
      name: ".info h3", desc: ".info p" }
  ];

  function applyProducts(cats) {
    if (!Array.isArray(cats)) return;
    for (var k = 0; k < PRODUCT_CARD_KINDS.length; k++) {
      var kind = PRODUCT_CARD_KINDS[k];
      if (kind.surface !== SURFACE) continue;
      if (kind.onlySlug && kind.onlySlug !== SLUG) continue;
      var cards = document.querySelectorAll(kind.card);
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        var slug = linkTail(card.getAttribute("href") || card.href || "");
        if (!slug || slug === "index") continue;
        var match = matchTool(slug, cats);
        if (!match) continue;
        if (match.isActive === false) {
          card.style.display = "none";
          continue;
        }
        card.style.display = "";
        var nameEl = card.querySelector(kind.name);
        var descEl = card.querySelector(kind.desc);
        if (nameEl && typeof match.arabicName === "string" &&
            match.arabicName.trim() !== "") {
          nameEl.textContent = match.arabicName;
        }
        if (descEl && typeof match.description === "string" &&
            match.description.trim() !== "") {
          descEl.textContent = match.description;
        }
      }
    }
  }

  // ── App index editable texts ← site_content/appIndex ──────────────────────
  function fetchAppIndexContent() {
    return fetch(
      "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
      "/databases/(default)/documents/site_content/appIndex?key=" + API_KEY
    )
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (doc) {
        return doc && doc.fields ? decodeFields(doc.fields) : null;
      })
      .catch(function () { return null; });
  }

  function getPath(obj, path) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function applyLiveSlots(data) {
    if (!data) return;
    var slots = document.querySelectorAll("[data-live]");
    for (var i = 0; i < slots.length; i++) {
      var value = getPath(data, slots[i].getAttribute("data-live"));
      if (typeof value === "string" && value.replace(/\s/g, "") !== "") {
        slots[i].textContent = value;
      }
    }
  }

  // ── Orchestration ──────────────────────────────────────────────────────────
  function applyAll(data) {
    if (!data) return;
    try { renderBanner(data.header || null); } catch (e) { /* isolate failures */ }
    try { renderMaintenance(data.maintenance || null); } catch (e) { /* isolate */ }
    try { applySeo(data.seo || null); } catch (e) { /* isolate */ }
    try { applyProducts(data.categories || null); } catch (e) { /* isolate */ }
    try { applyLiveSlots(data.appIndex || null); } catch (e) { /* isolate */ }
  }

  function refresh() {
    if (typeof fetch !== "function" || typeof Promise === "undefined") return;
    var wants = [fetchDoc("header"), fetchDoc("maintenance"), fetchDoc("seo")];
    // مزامنة بطاقات الأدوات: الصفحة الرئيسية للموقع + فهرس التطبيق
    var needsProducts =
      (SURFACE === "web" &&
        document.querySelector(".nesab-product-card") !== null) ||
      (SURFACE === "app" && SLUG === "index" &&
        document.querySelector(".link-card") !== null);
    if (needsProducts) wants.push(fetchCategories());
    // نصوص فهرس التطبيق القابلة للتحرير (عناصر data-live)
    var needsAppIndex = SURFACE === "app" && SLUG === "index" &&
      document.querySelector("[data-live]") !== null;
    if (needsAppIndex) wants.push(fetchAppIndexContent());
    Promise.all(wants)
      .then(function (results) {
        var cached = readCache() || {};
        var next = 3;
        var catsResult = needsProducts ? results[next++] : null;
        var appIndexResult = needsAppIndex ? results[next++] : null;
        var data = {
          header: resolveDoc(results[0], cached.header),
          maintenance: resolveDoc(results[1], cached.maintenance),
          seo: resolveDoc(results[2], cached.seo),
          categories: catsResult !== null ? catsResult : cached.categories || null,
          appIndex: appIndexResult !== null ? appIndexResult : cached.appIndex || null
        };
        applyAll(data);
        writeCache(data);
      });
  }

  // رسم فوري من الكاش للميزات النصية غير المُزيحة فقط (SEO/فهرس/بطاقات) —
  // لا نرسم الهيدر/الصيانة من الكاش لتفادي وميضٍ لو أُطفئت لاحقاً (يُرسمان
  // بعد الجلب الحيّ فقط).
  function applyCachedNonBlocking(data) {
    if (!data) return;
    try { applySeo(data.seo || null); } catch (e) { /* isolate */ }
    try { applyProducts(data.categories || null); } catch (e) { /* isolate */ }
    try { applyLiveSlots(data.appIndex || null); } catch (e) { /* isolate */ }
  }

  function init() {
    applyCachedNonBlocking(readCache()); // رسم فوري آمن (بلا هيدر/صيانة)
    refresh();                           // الحالة الحيّة من Firestore
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
