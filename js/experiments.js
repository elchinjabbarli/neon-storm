/* NEON STORM — experiments.js : A/B test + özellik bayrağı katmanı (deterministik kovalama) */
'use strict';
const EXP = (() => {
  let meta = null, saveFn = null;
  const over = {}; // uzaktan yapılandırma ile ezilebilir: { 'spawn_pace': 'fast' }

  function init(metaRef, save) {
    meta = metaRef; saveFn = save;
    if (!meta.aid) { meta.aid = 'p' + Math.random().toString(36).slice(2, 10); if (saveFn) saveFn(); }
    if (!meta.ab) meta.ab = {};
  }

  // Oyuncunun tüm deneylerdeki kovalarını sabitle (tutarlılık için)
  function ensureAll() {
    if (!meta || !meta.ab) return {};
    for (const id in CORE.EXPERIMENTS) {
      if (!(id in meta.ab)) {
        meta.ab[id] = CORE.bucket(meta.aid, id);
        if (saveFn) saveFn();
      }
    }
    return meta.ab;
  }

  function variant(id) {
    if (!meta) return 'control';
    ensureAll();
    if (over[id]) return over[id];
    return meta.ab[id] || 'control';
  }

  // sayısal etki haritası: spawn_pace 'fast' → 0.85 çarpanı gibi
  function factor(id) {
    const e = CORE.EXPERIMENTS[id];
    const v = variant(id);
    return (e && e.map && e.map[v] !== undefined) ? e.map[v] : 1;
  }

  function setOverride(id, v) { over[id] = v; }
  function all() { return meta && meta.ab ? { ...meta.ab } : {}; }

  return { init, variant, factor, all, setOverride, ensureAll };
})();
globalThis.EXP = EXP;
