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

  return { init, track, tryFlush, stats, peek, stop };
})();
globalThis.ANLT = ANLT;
