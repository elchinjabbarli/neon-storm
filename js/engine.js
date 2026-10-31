/* NEON STORM — engine.js : döngü, girdi, parçacık, kamera, uzamsal karma */
'use strict';
const ENG = (() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let W = window.innerWidth, H = window.innerHeight, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.floor(W * DPR); canvas.height = Math.floor(H * DPR);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 100));
  resize();

  // ---------- yardımcılar
  const TAU = Math.PI * 2;
  const rand = (a, b) => a + Math.random() * (b - a);
  const irand = (a, b) => Math.floor(rand(a, b + 1));
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist2 = (x1, y1, x2, y2) => { const dx = x2 - x1, dy = y2 - y1; return dx * dx + dy * dy; };

  // ---------- klavye
  const keys = {};
  window.addEventListener('keydown', e => {
    keys[e.code] = true;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', e => { keys[e.code] = false; });

  // ---------- sanal joystick (yalnız dokunmatik)
  const joy = { active: false, dx: 0, dy: 0, id: null, ox: 0, oy: 0 };
  const joyEl = document.getElementById('joystick');
  const knob = document.getElementById('joy-knob');

  function placeJoy(x, y) { joyEl.style.left = (x - 70) + 'px'; joyEl.style.top = (y - 70) + 'px'; }
  function moveJoy(x, y) {
    if (!joy.active) return;
    let dx = x - joy.ox, dy = y - joy.oy;
    const d = Math.hypot(dx, dy), max = 52;
    if (d > max) { dx = dx / d * max; dy = dy / d * max; }
    joy.dx = dx / max; joy.dy = dy / max;
    knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  }
  function joyStart(x, y, id) {
    joy.active = true; joy.id = id; joy.ox = x; joy.oy = y;
    joyEl.classList.add('on'); placeJoy(x, y); moveJoy(x, y);
  }
  function joyEnd() {
    joy.active = false; joy.dx = 0; joy.dy = 0; joy.id = null;
    joyEl.classList.remove('on'); knob.style.transform = 'translate(0,0)';
  }

  canvas.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    if (!joy.active) { joyStart(e.clientX, e.clientY, e.pointerId); }
  }, { passive: true });
  canvas.addEventListener('pointermove', e => {
    if (joy.active && e.pointerId === joy.id) moveJoy(e.clientX, e.clientY);
  }, { passive: true });
  const endP = e => { if (e.pointerId === joy.id) joyEnd(); };
  canvas.addEventListener('pointerup', endP, { passive: true });
  canvas.addEventListener('pointercancel', endP, { passive: true });

  // ---------- kamera sarsıntısı / hit-stop / flaş
  let shakeT = 0, shakeMag = 0, hitstopT = 0, flashT = 0, flashCol = '#f43f5e';
  function shake(m, t) { shakeMag = Math.max(shakeMag, m); shakeT = Math.max(shakeT, t || 0.25); }
  function hitstop(t) { hitstopT = Math.max(hitstopT, t || 0.05); }
  function flash(c, t) { flashCol = c; flashT = t || 0.16; }

  // ---------- parçacık havuzu
  const P_MAX = 720;
  const parts = []; for (let i = 0; i < P_MAX; i++) parts.push({ life: 0 });
  let pIdx = 0;
  function burst(x, y, color, n, speed, life, size, grav) {
    n = n || 8; speed = speed || 180; life = life || 0.5; size = size || 3; grav = grav || 0;
    for (let i = 0; i < n; i++) {
      const p = parts[pIdx = (pIdx + 1) % P_MAX];
      const a = rand(0, TAU), s = rand(speed * 0.3, speed);
      p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = life * rand(0.6, 1.25); p.max = p.life;
      p.color = color; p.size = rand(size * 0.5, size * 1.5); p.grav = grav;
    }
  }
  function updateParts(dt) {
    for (const p of parts) if (p.life > 0) {
      p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= 0.985; p.vy *= 0.985; p.vy += p.grav * dt;
    }
  }
  function drawParts() {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const p of parts) if (p.life > 0) {
      const a = p.life / p.max;
      ctx.globalAlpha = a; ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a + 0.4, 0, TAU); ctx.fill();
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }

  // ---------- yüzen yazılar
  const texts = [];
  function ftext(x, y, str, color, size, life) {
    color = color || '#fff'; size = size || 14; life = life || 0.7;
    texts.push({ x, y, str, color, size, life, max: life });
    if (texts.length > 90) texts.shift();
  }
  function updateTexts(dt) {
    for (let i = texts.length - 1; i >= 0; i--) {
      const t = texts[i]; t.life -= dt; t.y -= 44 * dt;
      if (t.life <= 0) texts.splice(i, 1);
    }
  }
  function drawTexts() {
    ctx.textAlign = 'center';
    for (const t of texts) {
      ctx.globalAlpha = Math.min(1, (t.life / t.max) * 2.2);
      ctx.fillStyle = t.color;
      ctx.font = 'bold ' + t.size + 'px Rajdhani, sans-serif';
      ctx.fillText(t.str, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------- uzamsal karma (spatial hash)
  class Hash {
    constructor(cell) { this.cell = cell || 96; this.map = new Map(); }
    clear() { this.map.clear(); }
    insert(e) {
      const k = Math.floor(e.x / this.cell) + ',' + Math.floor(e.y / this.cell);
      let a = this.map.get(k); if (!a) { a = []; this.map.set(k, a); }
      a.push(e);
    }
    query(x, y, r, out) {
      out.length = 0; const c = this.cell;
      const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
      const y0 = Math.floor((y - r) / c), y1 = Math.floor((y + r) / c);
      for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
        const a = this.map.get(cx + ',' + cy);
        if (a) for (const e of a) out.push(e);
      }
      return out;
    }
  }
  const hash = new Hash(96), qbuf = [];

  // ---------- döngü
  const state = { mode: 'menu' };
  let updateFn = null, renderFn = null;
  let last = performance.now(), fpsN = 0, fpsT = 0, fps = 60;

  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05;
    fpsN++; fpsT += dt;
    if (fpsT >= 0.5) { fps = Math.round(fpsN / fpsT); fpsN = 0; fpsT = 0; }
    if (hitstopT > 0) { hitstopT -= dt; dt *= 0.06; }
    if (state.mode === 'play') { try { updateFn(dt); } catch (err) { trap(err); } }
    try { renderFn(dt); } catch (err) { trap(err); }
  }

  function start(update, render) { updateFn = update; renderFn = render; requestAnimationFrame(frame); }

  function beginDraw() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = '#05060e'; ctx.fillRect(0, 0, W, H);
    if (shakeT > 0) {
      shakeT -= 1 / 60;
      const m = shakeMag * Math.max(0, shakeT) * 4;
      ctx.translate(rand(-m, m), rand(-m, m));
      if (shakeT <= 0) shakeMag = 0;
    }
  }
  function endDraw() {
    if (flashT > 0) {
      flashT -= 1 / 60;
      ctx.save(); ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.globalAlpha = Math.max(0, flashT) * 2.2;
      ctx.fillStyle = flashCol; ctx.fillRect(0, 0, W, H);
      ctx.restore(); ctx.globalAlpha = 1;
    }
  }

  // ---------- hata yakalayıcı (headless test için görünür)
  function trap(err) {
    const el = document.getElementById('err');
    if (el) { el.classList.remove('hidden'); el.textContent = 'HATA: ' + (err && err.message ? err.message : err); }
    console.error(err);
  }
  window.addEventListener('error', e => trap(e.error || e.message));

  const params = new URLSearchParams(location.search);
  const debug = params.has('debug');

  return {
    canvas, ctx, rand, irand, clamp, lerp, dist2, TAU, keys, joy,
    shake, hitstop, flash, burst, updateParts, drawParts, ftext, updateTexts, drawTexts,
    hash, qbuf, start, state, W: () => W, H: () => H, fps: () => fps, debug, trap,
    beginDraw, endDraw,
  };
})();
