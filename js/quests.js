/* NEON STORM — quests.js : günlük/haftalık görev motoru (DOM'suz, Node testine uyumlu) */
'use strict';
const QUESTS = (() => {
  let meta = null, saveFn = null;

  function init(metaRef, save) { meta = metaRef; saveFn = save; }

  const dateStr = d => (d || new Date()).toISOString().slice(0, 10);
  function weekStr(d) {
    const dt = d || new Date();
    const t = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const w = Math.ceil((((t - y0) / 86400000) + 1) / 7);
    return t.getUTCFullYear() + '-W' + String(w).padStart(2, '0');
  }

  function ensureDaily(dd, ww) {
    const d = dd || dateStr();
    const w = ww || weekStr();
    if (!meta.quests || meta.quests.d !== d) {
      meta.quests = {
        d, w,
        items: CORE.rollDaily(d),
        weekly: (meta.quests && meta.quests.w === w && meta.quests.weekly) ? meta.quests.weekly : CORE.rollWeekly(w),
      };
      if (saveFn) saveFn();
    } else if (!meta.quests.weekly || meta.quests.w !== w) {
      meta.quests.w = w;
      meta.quests.weekly = CORE.rollWeekly(w);
      if (saveFn) saveFn();
    }
    return meta.quests;
  }

  function apply(type, v, mode) {
    const q = meta.quests; if (!q) return;
    const list = [...(q.items || []), q.weekly].filter(Boolean);
    for (const it of list) {
      if (it.type !== type || it.claimed) continue;
      if (mode === 'max') it.prog = Math.max(it.prog, v);
      else it.prog += v;
      if (it.prog > it.goal) it.prog = it.goal;
    }
  }

  // mode: 'add' birikimli, 'max' tekillik bazlı
  const EVENT_MODES = { kill: 'add', coin: 'add', boss: 'add', runs: 'add', time: 'max', level: 'max', fuse: 'add' };
  function onEvent(type, v) {
    if (!meta || !meta.quests) return;
    apply(type, v, EVENT_MODES[type] || 'add');
    if (saveFn) saveFn();
  }

  function onRunEnd() { onEvent('runs', 1); }

  // v2.10/11: ödül uygulama — ◈ payı meta'ya, ⬡/✧ bonusu varsa META2'ye (yoksa güvenli).
  function applyReward(it) {
    meta.coins += it.reward;
    if (it.bonus && globalThis.META2 && typeof globalThis.META2.addGold === 'function') {
      try {
        if (it.bonus.gold) META2.addGold(it.bonus.gold);
        if (it.bonus.oz) META2.addOz(it.bonus.oz);
      } catch (e) { /* ödül kaybı olmasın — ◈ payı güvende */ }
    }
  }

  function claim(index) {
    const q = meta.quests; if (!q) return false;
    const list = [...(q.items || [])];
    const it = list[index];
    if (!it || it.claimed || it.prog < it.goal) return false;
    it.claimed = true;
    applyReward(it);
    if (saveFn) saveFn();
    return true;
  }
  function claimWeekly() {
    const q = meta.quests; if (!q || !q.weekly) return false;
    const it = q.weekly;
    if (it.claimed || it.prog < it.goal) return false;
    it.claimed = true;
    applyReward(it);   // v2.11: haftalık karışım varyantı da (400◈+300⬡) aynı hatta akar
    if (saveFn) saveFn();
    return true;
  }

  const info = () => meta && meta.quests ? JSON.parse(JSON.stringify(meta.quests)) : null;

  return { init, ensureDaily, onEvent, onRunEnd, claim, claimWeekly, info, dateStr, weekStr };
})();
globalThis.QUESTS = QUESTS;
