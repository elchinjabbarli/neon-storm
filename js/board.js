/* NEON STORM — board.js : liderlik tablosu (yerel + opsiyonel uzak sunucu) */
'use strict';
const BOARD = (() => {
  let meta = null, saveFn = null, remoteUrl = '';
  const MAX = 10;

  function init(metaRef, save) { meta = metaRef; saveFn = save; if (!Array.isArray(meta.board)) meta.board = []; }
  function setRemote(url) { remoteUrl = url || ''; }

  function submit(entry) {
    if (!CORE.plausible({ ...entry, level: entry.level, bossKills: 0 })) {
      // makullük dışıysa yalnız yerel kaba alma (sunucu da reddeder)
      return false;
    }
    entry = {
      name: 'PILOT-' + String(meta.aid || 'anon').slice(-4).toUpperCase(),
      score: Math.round(entry.score), time: Math.floor(entry.time), kills: entry.kills,
      level: entry.level || 1, char: entry.char || 'vektor', ts: entry.ts || Date.now(),
    };
    meta.board.push(entry);
    meta.board.sort((a, b) => b.score - a.score);
    if (meta.board.length > MAX) meta.board.length = MAX;
    if (saveFn) saveFn();
    if (remoteUrl) { try { submitRemote(entry); } catch (e) { } }
    return true;
  }

  async function submitRemote(entry) {
    if (!remoteUrl || typeof fetch === 'undefined') return false;
    try {
      const r = await fetch(remoteUrl + '/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
      return r.ok;
    } catch (e) { return false; }
  }

  async function fetchTop() {
    if (!remoteUrl || typeof fetch === 'undefined') return null;
    try {
      const r = await fetch(remoteUrl + '/top');
      if (!r.ok) return null;
      const j = await r.json();
      return Array.isArray(j.top) ? j.top : null;
    } catch (e) { return null; }
  }

  const top = () => (meta && meta.board ? meta.board.slice() : []);

  return { init, setRemote, submit, top, fetchTop, MAX };
})();
globalThis.BOARD = BOARD;
