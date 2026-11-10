/* NEON STORM — analytics.js : olay telemetrisi (çevrimdışı dayanıklı, Node uyumlu) */
'use strict';
const ANLT = (() => {
  const MAX_BUFFER = 250;
  const FLUSH_EVERY = 30000;
  let endpoint = '', version = '1.1.0', aid = 'anon';
  let buffer = [], sessId = null, t0 = 0, timer = null;
  let storage = null;

  function getStorage() {
    try { if (typeof localStorage !== 'undefined') return localStorage; } catch (e) { }
    return null;
  }
  const STORE_KEY = 'neonstorm_anlt_v1';

  function loadBuffer() {
    try {
      const s = getStorage();
      if (s) buffer = JSON.parse(s.getItem(STORE_KEY) || '[]') || [];
    } catch (e) { buffer = []; }
    if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
  }
  function persist() {
    try {
      const s = getStorage();
      if (s) s.setItem(STORE_KEY, JSON.stringify(buffer.slice(-MAX_BUFFER)));
    } catch (e) { }
  }

  function init(opts) {
    opts = opts || {};
    endpoint = opts.endpoint || '';
    version = opts.version || version;
    if (opts.meta && opts.meta.aid) aid = opts.meta.aid;
    storage = getStorage();
    sessId = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    t0 = Date.now();
    loadBuffer();
    track('session_start', { v: version });
    if (typeof setInterval !== 'undefined') timer = setInterval(tryFlush, FLUSH_EVERY);
  }

  function track(name, props) {
    const ev = {
      n: name,
      ts: Date.now(),
      sess: sessId,
      aid,
      v: version,
      p: props || {},
    };
    buffer.push(ev);
    if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
    persist();
    return ev;
  }

  async function tryFlush() {
    if (!endpoint || !buffer.length) return false;
    const batch = buffer.splice(0, 100);
    try {
      if (typeof fetch !== 'undefined') {
        const r = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: batch }),
        });
        if (r.ok) { persist(); return true; }
        buffer = batch.concat(buffer); persist();
        return false;
      }
    } catch (e) {
      buffer = batch.concat(buffer); persist();
    }
    return false;
  }

  const stats = () => ({
    count: buffer.length,
    sess: sessId,
    endpoint: endpoint || '(kapalı — yerel tampon)',
    uptime: t0 ? Math.floor((Date.now() - t0) / 1000) : 0,
  });
  const peek = n => buffer.slice(-(n || 10));
  function stop() { if (timer && typeof clearInterval !== 'undefined') clearInterval(timer); }

  // ---------- v2.50 (koşu #46) ÜRETİM HATA KANALI (handoff işi 2 — D+E-araç, ölçüm-önce)
  // sweep consErr (v2.49) yalnız YEREL oturumu kanıtlar; canlı ziyaretçide JS hatası olursa
  // kova boş kalıyordu. Kanal sahibi analytics (telemetri modülü) — core.js DOM'suz saf
  // katmandır (başlık sözleşmesi); handoff metni KOD'a göre düzeltildi, niyet korundu (v2.49 ders b).
  const MAX_PAGE_ERRORS = 10;          // sel kapısı — çökme-döngüsü 250'lik kovayı süpürmesin
  let errInstalled = false, errCount = 0;

  function fmtErrMsg(m) {
    let s = '';
    try { s = String(m === null || m === undefined ? '' : m).replace(/\s+/g, ' ').trim(); } catch (e) { s = ''; }
    return s.length ? s.slice(0, 120) : '?';
  }

  function pageErrorProps(err) {
    let raw = '';
    try {
      if (err && typeof err === 'object') {
        if (err.message !== undefined) raw = err.message;
        else if (err.reason !== undefined) raw = err.reason;
        else raw = err.type || err;
      } else raw = err;
    } catch (e) { raw = ''; }
    const msg = fmtErrMsg(raw);
    let vp = '-', mod = '-';
    try { if (typeof window !== 'undefined' && window.innerWidth) vp = window.innerWidth + 'x' + window.innerHeight; } catch (e) { }
    try { if (globalThis.GAME && GAME.state && GAME.state.mode) mod = GAME.state.mode; } catch (e) { }
    return { msg, vp, mod };
  }

  function onPageError(payload) {
    if (errCount >= MAX_PAGE_ERRORS) return;   // sel kapısı
    errCount++;
    try { track('page_error', pageErrorProps(payload)); } catch (e) { }
  }

  function installErrorChannel() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return false;
    if (errInstalled) return 'already';
    errInstalled = true;
    errCount = 0;
    window.addEventListener('error', e => onPageError(e));
    window.addEventListener('unhandledrejection', e => onPageError(e));
    return true;
  }

  function _errReset() { errInstalled = false; errCount = 0; }

  return { init, track, tryFlush, stats, peek, stop, installErrorChannel, fmtErrMsg, pageErrorProps, _errReset };
})();
globalThis.ANLT = ANLT;
// v2.50: modül-yükü auto-install — ANLT.init'ten ÖNCEki hatalar da kanala düşer (sess:null dürüst kayıt)
if (typeof window !== 'undefined') { try { ANLT.installErrorChannel(); } catch (e) { } }
