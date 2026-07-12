/**
 * Nesab — Live Content Layer v1.0
 * ─────────────────────────────────────────────────────────────────────────────
 * Binds landing-page copy to Firestore `site_content/landing` so the dashboard
 * can edit the website text with no developer and no redeploy.
 *
 * How it works:
 *  1. Any element tagged with data-live="<section>.<field>" is a live slot.
 *  2. On load we apply a cached copy from localStorage instantly (no flash),
 *     then fetch the fresh document from the Firestore REST API and re-apply.
 *  3. Values are written with textContent only (no HTML injection possible).
 *  4. If the document, the field, or the network is missing, the hardcoded
 *     text already in the HTML stays as-is — the page never breaks.
 *
 * Reads are public (see firestore.rules: site_content → allow read: if true).
 * Writes happen only from the dashboard (authenticated admins).
 */
(function () {
  "use strict";

  var PROJECT_ID = "nesab-26771";
  var API_KEY = "AIzaSyA4lkLR9bumW1Jb7FmmZgN5Ry3qZHC5_dE"; // same public web key used by this page
  var DOC_URL =
    "https://firestore.googleapis.com/v1/projects/" + PROJECT_ID +
    "/databases/(default)/documents/site_content/landing?key=" + API_KEY;
  var CACHE_KEY = "nesab_live_landing_v1";

  /** Decode a Firestore REST `fields` object into a plain JS object. */
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
    if ("mapValue" in v) return decodeFields(v.mapValue.fields || {});
    if ("arrayValue" in v) return (v.arrayValue.values || []).map(decodeValue);
    return null;
  }

  /** Resolve "section.field" against a nested object. */
  function getPath(obj, path) {
    var parts = path.split(".");
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur == null || typeof cur !== "object") return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  /** Apply a decoded content object to every [data-live] slot. */
  function applyContent(data) {
    if (!data) return;
    var slots = document.querySelectorAll("[data-live]");
    for (var i = 0; i < slots.length; i++) {
      var el = slots[i];
      var value = getPath(data, el.getAttribute("data-live"));
      if (typeof value === "string" && value.replace(/\s/g, "") !== "") {
        el.textContent = value;
      }
    }
  }

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (e) { /* storage full/blocked — non-fatal */ }
  }

  function refresh() {
    if (typeof fetch !== "function") return;
    fetch(DOC_URL)
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (doc) {
        if (!doc || !doc.fields) return;
        var data = decodeFields(doc.fields);
        applyContent(data);
        writeCache(data);
      })
      .catch(function () { /* offline / rules not deployed yet — fallback text stays */ });
  }

  function init() {
    applyContent(readCache()); // instant paint from cache
    refresh();                 // then live update from Firestore
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
