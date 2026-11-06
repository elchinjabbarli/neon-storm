/* NEON STORM — audio.js : WebAudio sentez motoru (sıfır varlık) */
'use strict';
const AUDIO = (() => {
  let ctx = null, sfxG = null, musG = null;
  let sfxOn = true, musOn = true;
  let lastShot = 0, lastHit = 0, lastGem = 0, lastHurt = 0, lastUi = 0;
  let musicTimer = null, step = 0;
  let live = 0; // aktif SFX osilatör sayısı (karışıklığı önleme sınırı)
  const LIVE_MAX = 26;
  function slot() { if (live >= LIVE_MAX) return false; live++; return true; }
  function free() { live = Math.max(0, live - 1); }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    sfxG = ctx.createGain(); sfxG.connect(ctx.destination);
    musG = ctx.createGain(); musG.connect(ctx.destination);
    sfxG.gain.value = sfxOn ? 0.5 : 0;
    musG.gain.value = musOn ? 0.26 : 0;
    startMusic();
  }

  function setSfx(v) { sfxOn = v; if (sfxG) sfxG.gain.value = v ? 0.5 : 0; }
  function setMusic(v) { musOn = v; if (musG) musG.gain.value = v ? 0.26 : 0; }

  // ---- temel ton
  function tone(o) {
    if (!ctx || !sfxOn) return;
    const type = o.type || 'square';
    const f0 = o.f0 || 440, f1 = (o.f1 !== undefined ? o.f1 : f0);
    const d = o.d || 0.1, v = o.v || 0.2, delay = o.delay || 0;
    const t0 = ctx.currentTime + delay;
    if (!slot()) return;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.onended = free;
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f0), t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + d);
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    osc.connect(g); g.connect(sfxG);
    osc.start(t0); osc.stop(t0 + d + 0.03);
  }

  function noise(o) {
    if (!ctx || !sfxOn) return;
    const d = o.d || 0.3, v = o.v || 0.3, f = o.f || 800, delay = o.delay || 0;
    const t0 = ctx.currentTime + delay;
    if (!slot()) return;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * d), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = 'lowpass'; flt.frequency.value = f;
    const g = ctx.createGain(); g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
    src.connect(flt); flt.connect(g); g.connect(sfxG);
    src.start(t0);
  }

  const SFX_MAP = {
    shoot() { const n = performance.now(); if (n - lastShot < 55) return; lastShot = n;
      tone({ type: 'sawtooth', f0: 720 + Math.random() * 80, f1: 170, d: 0.07, v: 0.07 }); },
    hit()   { const n = performance.now(); if (n - lastHit < 45) return; lastHit = n;
      tone({ type: 'square', f0: 210, f1: 90, d: 0.05, v: 0.09 }); },
    kill()  { tone({ type: 'triangle', f0: 500, f1: 110, d: 0.13, v: 0.16 }); },
    explode() { noise({ d: 0.3, v: 0.26, f: 900 }); tone({ type: 'sine', f0: 140, f1: 30, d: 0.3, v: 0.3 }); },
    gem()   { const n = performance.now(); if (n - lastGem < 60) return; lastGem = n;
      tone({ type: 'sine', f0: 900, f1: 1400, d: 0.07, v: 0.09 }); },
    coin()  { tone({ type: 'square', f0: 1150, f1: 1700, d: 0.09, v: 0.09 }); },
    hurt()  { const n = performance.now(); if (n - lastHurt < 120) return; lastHurt = n;
      tone({ type: 'sawtooth', f0: 190, f1: 55, d: 0.2, v: 0.2 }); noise({ d: 0.14, v: 0.12, f: 500 }); },
    levelup() { tone({ type: 'triangle', f0: 523, d: 0.12, v: 0.2 });
      tone({ type: 'triangle', f0: 659, d: 0.12, v: 0.2, delay: 0.09 });
      tone({ type: 'triangle', f0: 784, d: 0.2, v: 0.22, delay: 0.18 }); },
    pick()  { tone({ type: 'sine', f0: 660, f1: 990, d: 0.07, v: 0.12 }); },
    ui()    { const n = performance.now(); if (n - lastUi < 50) return; lastUi = n;
      tone({ type: 'sine', f0: 620, f1: 880, d: 0.05, v: 0.09 }); },
    // BOSS: düşen dron (kayıp algısı) yerine YÜKSENEN alarm — heyecan dili
    boss()  { tone({ type: 'square', f0: 330, f1: 330, d: 0.14, v: 0.16 });
      tone({ type: 'square', f0: 495, f1: 495, d: 0.14, v: 0.17, delay: 0.16 });
      tone({ type: 'square', f0: 660, f1: 880, d: 0.3, v: 0.2, delay: 0.32 });
      noise({ d: 0.25, v: 0.08, f: 1200 }); },
    // BOSS ölümü: zafer fanfarı — ödül diline geçiş
    bossDown() { [523, 659, 784, 1047].forEach((f, i) =>
      tone({ type: 'triangle', f0: f, d: 0.18, v: 0.2, delay: i * 0.09 }));
      tone({ type: 'sine', f0: 1568, f1: 1568, d: 0.35, v: 0.12, delay: 0.38 }); },
    revive(){ tone({ type: 'triangle', f0: 330, f1: 880, d: 0.4, v: 0.25 }); },
    buy()   { tone({ type: 'square', f0: 800, f1: 1250, d: 0.1, v: 0.12 });
      tone({ type: 'square', f0: 1250, f1: 1600, d: 0.12, v: 0.1, delay: 0.08 }); },
    deny()  { tone({ type: 'square', f0: 220, f1: 160, d: 0.12, v: 0.15 }); },
    nova()  { noise({ d: 0.22, v: 0.22, f: 1400 }); tone({ type: 'sine', f0: 300, f1: 60, d: 0.25, v: 0.2 }); },
    zap()   { const n = performance.now(); if (n - lastHit < 40) return; lastHit = n;
      tone({ type: 'sawtooth', f0: 1400, f1: 300, d: 0.06, v: 0.06 }); },
    evolve(){ [392, 523, 659, 784, 1047].forEach((f, i) =>
      tone({ type: 'triangle', f0: f, d: 0.16, v: 0.2, delay: i * 0.08 })); },
  };

  // isimle ses çalma dağıtıcısı
  function sfx(name) {
    const f = SFX_MAP[name];
    if (f) f();
  }

  // ---- prosedürel müzik: 16 adımlı bas + arp döngüsü (A minör)
  const BASS = [0, 0, 12, 0, 3, 0, 10, 0, 5, 5, 17, 5, 3, 3, 15, 10];
  const ARP  = [12, null, 15, 19, null, 15, 12, null, 17, null, 12, 15, null, 19, 22, 19];
  let spb = 60 / 112 / 2;

  function mtone(t, type, f, d, v) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type; osc.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    osc.connect(g); g.connect(musG);
    osc.start(t); osc.stop(t + d + 0.03);
  }

  function startMusic() {
    if (musicTimer) return;
    musicTimer = setInterval(() => {
      if (!ctx || !musOn) return;
      const t = ctx.currentTime + 0.08;
      mtone(t, 'sine', 55 * Math.pow(2, BASS[step % 16] / 12), spb * 1.7, 0.3);
      const a = ARP[step % 16];
      if (a !== null) mtone(t, 'triangle', 220 * Math.pow(2, a / 12), spb * 0.8, 0.08);
      if (step % 4 === 0) { /* bas vuruş: zaten bass var */ }
      step++;
    }, spb * 1000);
  }

  // ilk kullanıcı hareketiyle kilidi aç
  const unlock = () => { init(); };
  document.addEventListener('pointerdown', unlock, { once: false });
  document.addEventListener('keydown', unlock, { once: false });

  return { init, setSfx, setMusic, sfx };
})();
