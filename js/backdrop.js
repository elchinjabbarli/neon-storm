/* NEON STORM — backdrop.js : v3.0 — derin uzay sahne katmanları
 * 5 paralaks katman: taban degrade → nebula bulutları (2 karo, screen karışım)
 * → uzak yıldız alanı ×2 → yakın parlak yıldızlar (göz kırpma) → toz zerreleri
 * + ince ızgara + ara sıra kayan yıldız. Hepsi önceden karo canvas'a pişirilir;
 * kare başına maliyet sadece birkaç drawImage. Kare karesiz, tamamen yumuşak. */
'use strict';
const BACKDROP = (() => {
  const TAU = Math.PI * 2;

  // ---------- deterministik RNG (görüntü her yüklemede aynı) ----------
  function mulberry32(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // ---------- nebula karo üretimi ----------
  function makeNebula(seed, hues) {
    const S = 640, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const rng = mulberry32(seed);
    for (let i = 0; i < 14; i++) {
      const x = rng() * S, y = rng() * S;
      const r = 90 + rng() * 190;
      const col = hues[Math.floor(rng() * hues.length)];
      const a = .05 + rng() * .09;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(${col},${a})`);
      g.addColorStop(.55, `rgba(${col},${a * .38})`);
      g.addColorStop(1, `rgba(${col},0)`);
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    // hafif yıldız tozu serp
    for (let i = 0; i < 90; i++) {
      const x = rng() * S, y = rng() * S, r = .3 + rng() * .9;
      c.fillStyle = `rgba(190,210,255,${.05 + rng() * .12})`;
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    }
    return cv;
  }
  const nebA = makeNebula(1207, ['79,70,229', '99,52,199', '30,64,120']);   // indigo-menekşe
  const nebB = makeNebula(8811, ['13,115,144', '86,50,160', '155,60,110']); // camgöbeği-macenta

  // ---------- yıldız alanı karoları ----------
  function makeStars(seed, count, rMin, rMax, glint) {
    const S = 760, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const rng = mulberry32(seed);
    for (let i = 0; i < count; i++) {
      const x = rng() * S, y = rng() * S;
      const r = rMin + rng() * (rMax - rMin);
      const warm = rng() < .18;
      const g = c.createRadialGradient(x, y, 0, x, y, r * 3.2);
      g.addColorStop(0, warm ? 'rgba(255,235,205,.95)' : 'rgba(215,232,255,.95)');
      g.addColorStop(.3, warm ? 'rgba(255,215,170,.4)' : 'rgba(170,205,255,.4)');
      g.addColorStop(1, 'rgba(160,190,255,0)');
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r * 3.2, 0, TAU); c.fill();
      c.fillStyle = 'rgba(245,250,255,.95)';
      c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
      if (glint && r > (rMin + rMax) * .52) {         // büyük yıldızlara artı parıltı
        c.strokeStyle = 'rgba(230,240,255,.28)';
        c.lineWidth = 1;
        const L = r * 5.5;
        c.beginPath();
        c.moveTo(x - L, y); c.lineTo(x + L, y);
        c.moveTo(x, y - L); c.lineTo(x, y + L);
        c.stroke();
      }
    }
    return cv;
  }
  const starsFar = makeStars(4242, 150, .5, 1.1, false);
  const starsMid = makeStars(777, 95, .8, 1.7, false);
  const starsNear = makeStars(31337, 55, 1.2, 2.6, true);

  // ---------- önrenderlenmiş parlak nokta (toz + göz kırpmada kullanılır) ----------
  const dotCv = (() => {
    const S = 48, cv = document.createElement('canvas');
    cv.width = cv.height = S;
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(.35, 'rgba(205,225,255,.55)');
    g.addColorStop(1, 'rgba(180,210,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, S, S);
    return cv;
  })();
  function blitDot(g, x, y, r, a) {
    g.globalAlpha = a;
    g.drawImage(dotCv, x - r, y - r, r * 2, r * 2);
  }

  // ---------- toz zerreleri (dünyada sabit, paralaks .8) ----------
  const DUST_N = 34;
  const dust = [];
  { const rng = mulberry32(909);
    for (let i = 0; i < DUST_N; i++) {
      dust.push({ x: rng() * 2600, y: rng() * 2600, r: .8 + rng() * 1.9, ph: rng() * TAU, sp: .4 + rng() * .8 });
    }
  }

  // ---------- kayan yıldız ----------
  let shoot = null, shootT = 5;
  function updShoot(dt) {
    if (shoot) {
      shoot.t += dt;
      if (shoot.t > shoot.dur) shoot = null;
    } else {
      shootT -= dt;
      if (shootT <= 0) {
        shootT = 7 + Math.random() * 9;
        const a = Math.PI * .72 + Math.random() * .5;
        shoot = { x: Math.random() * 1.1 - .05, y: Math.random() * .45, a, t: 0, dur: .8, len: 130 + Math.random() * 120 };
      }
    }
  }

  const mod = (v, m) => ((v % m) + m) % m;

  // karo çizimi: ekranı kaplayacak şekilde yinele
  function tile(c, img, ox, oy, W, H, alpha, op) {
    const S = img.width;
    c.save();
    if (op) c.globalCompositeOperation = op;
    c.globalAlpha = alpha;
    const sx = mod(ox, S) - S, sy = mod(oy, S) - S;
    for (let x = sx; x < W; x += S)
      for (let y = sy; y < H; y += S)
        c.drawImage(img, x, y);
    c.restore();
  }

  // ---------- ana çizim ----------
  // g: canvas ctx (DPR transform zaten uygulanmış, birim = ekran px)
  function draw(g, camX, camY, t, dt, W, H) {
    // 1) taban — merkezden dışa koyulaşan derin gradyan
    const bg = g.createRadialGradient(W * .5, H * .42, 0, W * .5, H * .42, Math.max(W, H) * .78);
    bg.addColorStop(0, '#0b1026');
    bg.addColorStop(.55, '#070a1a');
    bg.addColorStop(1, '#04050e');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);

    // 2) nebula bulutları — çok yavaş paralaks + zamansal salınım
    tile(g, nebA, -camX * .045 + Math.sin(t * .021) * 26, -camY * .045 + Math.cos(t * .017) * 20, W, H, .85, 'screen');
    tile(g, nebB, -camX * .085 + 320 - Math.cos(t * .013) * 30, -camY * .085 + 210 + Math.sin(t * .019) * 24, W, H, .6, 'screen');

    // 3) yıldız katmanları (3 derinlik)
    tile(g, starsFar, -camX * .14, -camY * .14, W, H, .5);
    tile(g, starsMid, -camX * .28, -camY * .28, W, H, .7);
    tile(g, starsNear, -camX * .5, -camY * .5, W, H, .9);

    // 4) yakın katman göz kırpması — karonun üstüne seyrek canlı parıltılar
    const rng = mulberry32(5150);
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 10; i++) {
      const bx = rng() * 760, by = rng() * 760;
      const S = 760;
      const sx = mod(bx - camX * .5, S), sy = mod(by - camY * .5, S);
      // kenarlara taşan karo yıldızları: ekran içindeyse çiz
      for (let ox = -1; ox <= Math.ceil(W / S); ox++)
        for (let oy = -1; oy <= Math.ceil(H / S); oy++) {
          const x = sx + ox * S, y = sy + oy * S;
          if (x < -10 || x > W + 10 || y < -10 || y > H + 10) continue;
          const tw = .18 + .8 * Math.max(0, Math.sin(t * (1.1 + i * .23) + i * 2.7));
          blitDot(g, x, y, 6 + (i % 3) * 2, .8 * tw);
        }
    }
    g.restore();
    g.globalAlpha = 1;

    // 5) toz zerreleri — dünyada sabit noktalar, .78 paralaks, yumuşak salınım
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < DUST_N; i++) {
      const d = dust[i];
      const S = 2600;
      const x = mod(d.x - camX * .78, S) - 300, y = mod(d.y - camY * .78, S) - 300;
      if (x < -8 || x > W + 8 || y < -8 || y > H + 8) continue;
      const a = .12 + .2 * (0.5 + 0.5 * Math.sin(t * d.sp + d.ph));
      blitDot(g, x, y, d.r * 3.4, a);
    }
    g.restore();
    g.globalAlpha = 1;

    // 6) kayan yıldız
    updShoot(dt);
    if (shoot) {
      const p = shoot.t / shoot.dur;
      const cx = shoot.x * W + Math.cos(shoot.a) * shoot.len * p * 3.2;
      const cy = shoot.y * H + Math.sin(shoot.a) * shoot.len * p * 3.2;
      const tx = cx - Math.cos(shoot.a) * shoot.len;
      const ty = cy - Math.sin(shoot.a) * shoot.len;
      const fade = Math.sin(p * Math.PI);
      const sg = g.createLinearGradient(tx, ty, cx, cy);
      sg.addColorStop(0, 'rgba(200,225,255,0)');
      sg.addColorStop(.7, `rgba(210,235,255,${.4 * fade})`);
      sg.addColorStop(1, `rgba(255,255,255,${.95 * fade})`);
      g.save();
      g.globalCompositeOperation = 'lighter';
      g.strokeStyle = sg; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(tx, ty); g.lineTo(cx, cy); g.stroke();
      g.restore();
    }
  }

  // ---------- oyun ızgarası — sahne düzleminde çok ince ----------
  function drawGrid(g, camX, camY, W, H) {
    const sp = 90;
    g.save();
    g.strokeStyle = 'rgba(56,189,248,0.05)';
    g.lineWidth = 1;
    g.beginPath();
    for (let x = mod(-camX, sp); x < W; x += sp) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = mod(-camY, sp); y < H; y += sp) { g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke();
    // her 4. çizgi hafif belirgin (derinlik hissi)
    g.strokeStyle = 'rgba(99,102,241,0.075)';
    g.beginPath();
    const sp4 = sp * 4;
    for (let x = mod(-camX, sp4); x < W; x += sp4) { g.moveTo(x, 0); g.lineTo(x, H); }
    for (let y = mod(-camY, sp4); y < H; y += sp4) { g.moveTo(0, y); g.lineTo(W, y); }
    g.stroke();
    g.restore();
  }

  // ---------- menü modu: yavaş otomatik kamera ----------
  function drawMenu(g, t, dt, W, H) {
    draw(g, t * 34, t * 12, t, dt, W, H);
  }

  return { draw, drawMenu, drawGrid };
})();
