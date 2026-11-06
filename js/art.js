/* NEON STORM — art.js : v3.0 GÖRSEL DEVRİM — premium vektör sprite atölyesi
 * Tüm varlıklar (gemi, düşman, boss, kristal, coin, kasa, mermi) tek seferde
 * offscreen canvas'a 3× supersample ile çizilir; oyun içinde tek drawImage.
 * Sonuç: tam anti-aliased, gradyan gölgeli, rim-light'lı, 4K'da bile jilet gibi.
 * Prensipler: ışık sol-üstten · her gövdede 3 katman (taban/panel/çekirdek) ·
 * parlak hat + yumuşak dış parıltı sprite'a pişirilmiş (runtime shadowBlur YOK). */
'use strict';
const ART = (() => {

  // ---------- yardımcılar ----------
  const TAU = Math.PI * 2;
  const SS = 3;                                   // supersample — DPR 2 + 4K'da kristal netlik

  function hex2rgb(h) {
    h = h.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(h, a) { const [r, g, b] = hex2rgb(h); return `rgba(${r},${g},${b},${a})`; }
  function shade(h, amt) {                         // amt>0 beyaza, amt<0 siyaha yaklaşır
    const [r, g, b] = hex2rgb(h);
    const f = v => Math.round(amt > 0 ? v + (255 - v) * amt : v * (1 + amt));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }

  function mk(R, margin, fn) {                     // R: dünya yarıçapı, margin: parıltı payu
    const size = Math.max(4, Math.ceil(R * margin * 2 * SS));
    const cv = document.createElement('canvas');
    cv.width = cv.height = size;
    const c = cv.getContext('2d');
    c.translate(size / 2, size / 2);
    c.scale(SS, SS);
    c.lineJoin = 'round'; c.lineCap = 'round';
    fn(c);
    return { cv, half: size / (2 * SS) };
  }
  function whiten(spr) {                           // vuruş anı beyaz silüet
    const cv = document.createElement('canvas');
    cv.width = spr.cv.width; cv.height = spr.cv.height;
    const c = cv.getContext('2d');
    c.drawImage(spr.cv, 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, cv.width, cv.height);
    return { cv, half: spr.half };
  }
  function draw(g, spr, x, y, rot, scale, alpha) {
    const s = spr.half * (scale || 1);
    if (alpha !== undefined) g.globalAlpha = alpha;
    if (rot) {
      g.save(); g.translate(x, y); g.rotate(rot);
      g.drawImage(spr.cv, -s, -s, s * 2, s * 2);
      g.restore();
    } else {
      g.drawImage(spr.cv, x - s, y - s, s * 2, s * 2);
    }
    if (alpha !== undefined) g.globalAlpha = 1;
  }

  // ---------- yol yardımcıları ----------
  function poly(c, n, r, rot, sk) {                // düzenli çokgen (sk: x ölçek)
    c.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + i / n * TAU;
      const px = Math.cos(a) * r * (sk || 1), py = Math.sin(a) * r;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }
  function star(c, spikes, R, r, rot) {
    c.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const a = rot + i / (spikes * 2) * TAU, rr = i % 2 ? r : R;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i ? c.lineTo(px, py) : c.moveTo(px, py);
    }
    c.closePath();
  }
  function rr(c, x, y, w, h, r) {                  // yuvarlak köşeli dikdörtgen
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function orb(c, x, y, r, col, coreA) {           // yumuşak ışıma küresi
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba('#ffffff', coreA === undefined ? .95 : coreA));
    g.addColorStop(.25, rgba(col, .85));
    g.addColorStop(1, rgba(col, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
  }
  function bodyGrad(c, col, x0, y0, x1, y1) {      // sol-üst ışıklı gövde gradyanı
    const g = c.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, shade(col, .5));
    g.addColorStop(.55, col);
    g.addColorStop(1, shade(col, -.55));
    return g;
  }

  // ================================================================
  //  OYUNCU GEMİLERİ — sağa bakar (rot = pl.face)
  // ================================================================
  function shipSprite(col, kind) {
    return mk(15, 1.75, c => {
      // --- parıltı altlığı
      c.shadowColor = rgba(col, .9); c.shadowBlur = 12;

      if (kind === 'glacia') {
        // kristal gövde — keskin fasetlar
        c.beginPath();
        c.moveTo(16, 0); c.lineTo(4, -8); c.lineTo(-4, -12); c.lineTo(-11, -5);
        c.lineTo(-8, 0); c.lineTo(-11, 5); c.lineTo(-4, 12); c.lineTo(4, 8);
        c.closePath();
        c.fillStyle = bodyGrad(c, col, -10, -12, 6, 12); c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = rgba('#ffffff', .55); c.lineWidth = 1.4; c.stroke();
        // iç faset hatları
        c.strokeStyle = rgba(shade(col, -.5), .8); c.lineWidth = 1.1;
        c.beginPath(); c.moveTo(16, 0); c.lineTo(-2, -3); c.lineTo(-11, -5); c.moveTo(16, 0); c.lineTo(-2, 3); c.lineTo(-11, 5); c.stroke();
        // buz çekirdeği
        orb(c, 1.5, 0, 5, col, .9);
      } else if (kind === 'nova9') {
        // deneysel iğne + enerji halkaları
        c.beginPath();
        c.moveTo(19, 0); c.quadraticCurveTo(2, -6.5, -8, -5); c.lineTo(-13, -3);
        c.lineTo(-10, 0); c.lineTo(-13, 3); c.lineTo(-8, 5); c.quadraticCurveTo(2, 6.5, 19, 0);
        c.closePath();
        c.fillStyle = bodyGrad(c, col, -12, -6, 16, 6); c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = rgba('#ffffff', .5); c.lineWidth = 1.3; c.stroke();
        // enerji sargıları
        c.strokeStyle = rgba(col, .95); c.lineWidth = 2;
        c.beginPath(); c.ellipse(3, 0, 2.2, 6.5, 0, 0, TAU); c.stroke();
        c.beginPath(); c.ellipse(8.5, 0, 1.7, 4.6, 0, 0, TAU); c.stroke();
        orb(c, 3, 0, 3.2, col, 1);
      } else if (kind === 'pyra') {
        // geniş delta + çift pençe
        c.beginPath();
        c.moveTo(14, 0); c.lineTo(9, -3.5); c.lineTo(15, -4.5); c.lineTo(1, -11);
        c.lineTo(-9, -9); c.lineTo(-5, -2.6); c.lineTo(-10, 0); c.lineTo(-5, 2.6);
        c.lineTo(-9, 9); c.lineTo(1, 11); c.lineTo(15, 4.5); c.lineTo(9, 3.5);
        c.closePath();
        c.fillStyle = bodyGrad(c, col, -9, -11, 14, 11); c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = rgba('#ffffff', .5); c.lineWidth = 1.5; c.stroke();
        // omurga
        c.strokeStyle = rgba(shade(col, -.45), .9); c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(13, 0); c.lineTo(-6, 0); c.stroke();
        // kokpit
        const cg = c.createRadialGradient(2, -1, 0, 2, 0, 4.5);
        cg.addColorStop(0, '#ffffff'); cg.addColorStop(.4, rgba(col, .9)); cg.addColorStop(1, rgba(col, .15));
        c.fillStyle = cg;
        c.beginPath(); c.ellipse(2, 0, 4.5, 2.6, 0, 0, TAU); c.fill();
        c.strokeStyle = rgba('#ffffff', .75); c.lineWidth = .9; c.stroke();
      } else {
        // vektör — dengeli süzülen dart
        c.beginPath();
        c.moveTo(17, 0); c.quadraticCurveTo(3, -7.5, -6, -6.4); c.lineTo(-13, -8.6);
        c.lineTo(-8.5, -2.4); c.lineTo(-11, 0); c.lineTo(-8.5, 2.4); c.lineTo(-13, 8.6);
        c.lineTo(-6, 6.4); c.quadraticCurveTo(3, 7.5, 17, 0);
        c.closePath();
        c.fillStyle = bodyGrad(c, col, -12, -8, 15, 8); c.fill();
        c.shadowBlur = 0;
        c.strokeStyle = rgba('#ffffff', .55); c.lineWidth = 1.4; c.stroke();
        // kanat aksanı
        c.strokeStyle = rgba(shade(col, .65), .95); c.lineWidth = 1.7;
        c.beginPath(); c.moveTo(2, -5.6); c.lineTo(-10.5, -7.6); c.moveTo(2, 5.6); c.lineTo(-10.5, 7.6); c.stroke();
        // kokpit
        const cg = c.createRadialGradient(4, -1, 0, 4, 0, 4.8);
        cg.addColorStop(0, '#ffffff'); cg.addColorStop(.45, rgba(col, .85)); cg.addColorStop(1, rgba(col, .1));
        c.fillStyle = cg;
        c.beginPath(); c.ellipse(4, 0, 4.8, 2.5, 0, 0, TAU); c.fill();
        c.strokeStyle = rgba('#ffffff', .7); c.lineWidth = .9; c.stroke();
        // burun feneri
        orb(c, 12.5, 0, 2, col, 1);
      }

      // --- egzoz lüleri (tüm gemilerde ortak dil)
      const ny = kind === 'pyra' ? 4.2 : (kind === 'nova9' ? 2.6 : 3.4);
      for (const s of [-1, 1]) {
        c.fillStyle = shade(col, -.68);
        rr(c, -12.4, s * ny - 1.6, 4.6, 3.2, 1.4); c.fill();
        c.strokeStyle = rgba(shade(col, -.3), .9); c.lineWidth = .8; c.stroke();
        c.fillStyle = rgba('#fff8e8', .95);
        rr(c, -11.9, s * ny - .7, 1.5, 1.4, .7); c.fill();
      }
    });
  }

  // ================================================================
  //  DÜŞMANLAR
  // ================================================================
  const E = {};

  // grunt — fasetli dörtgen dron (döner) — v3.01: X çehelonu yerine göz-yarığı + iç plaka
  E.grunt = mk(13, 2.0, c => {
    const col = '#ff4d6d';
    // dış hale
    const halo = c.createRadialGradient(0, 0, 4, 0, 0, 17);
    halo.addColorStop(0, rgba(col, .3)); halo.addColorStop(1, rgba(col, 0));
    c.fillStyle = halo;
    c.beginPath(); c.arc(0, 0, 17, 0, TAU); c.fill();
    // gövde
    c.shadowColor = rgba(col, .9); c.shadowBlur = 11;
    poly(c, 4, 12.2, Math.PI / 4);
    c.fillStyle = bodyGrad(c, col, -9, -9, 9, 9); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = rgba('#ffffff', .55); c.lineWidth = 1.5; c.stroke();
    // iç plaka — hafif döndürülmüş eşkenar
    poly(c, 4, 8.4, Math.PI / 4);
    c.fillStyle = rgba(shade(col, .32), .9); c.fill();
    c.strokeStyle = rgba(shade(col, -.45), .95); c.lineWidth = 1.2; c.stroke();
    // göz yarığı — yatay kor + dikey bebek
    c.fillStyle = '#fff5f7';
    c.beginPath(); c.ellipse(0, 0, 4.6, 1.7, 0, 0, TAU); c.fill();
    c.fillStyle = '#2a0410';
    c.beginPath(); c.ellipse(0, 0, 1.4, 2.6, 0, 0, TAU); c.fill();
    orb(c, 0, 0, 2.2, col, 1);
    // yan kanatçıklar
    c.fillStyle = shade(col, -.62);
    for (const s of [-1, 1]) { c.save(); c.translate(0, s * 12.6); poly(c, 3, 3.6, -s * Math.PI / 2); c.fill(); c.restore(); }
  });

  // swarm — zıpkın (oyuncuya bakar)
  E.swarm = mk(10, 2.1, c => {
    const col = '#ffb84d';
    c.shadowColor = rgba(col, .85); c.shadowBlur = 8;
    c.beginPath();
    c.moveTo(11, 0); c.lineTo(-2.5, -6.2); c.lineTo(-7.5, -9); c.lineTo(-4.5, -2.6);
    c.lineTo(-6.5, 0); c.lineTo(-4.5, 2.6); c.lineTo(-7.5, 9); c.lineTo(-2.5, 6.2);
    c.closePath();
    c.fillStyle = bodyGrad(c, col, -7, -9, 10, 9); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = rgba('#ffffff', .55); c.lineWidth = 1.3; c.stroke();
    // sırt çizgisi
    c.strokeStyle = rgba(shade(col, -.5), .9); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(9, 0); c.lineTo(-4, 0); c.stroke();
    // göz
    orb(c, 4.5, 0, 2.6, col, 1);
    // itki parıltısı
    orb(c, -6, 0, 3.4, '#ff6b6b', .9);
  });

  // tank — zırhlı altıgen kale (döner)
  E.tank = mk(22, 1.65, c => {
    const col = '#c77dff';
    c.shadowColor = rgba(col, .8); c.shadowBlur = 12;
    poly(c, 6, 21, 0);
    c.fillStyle = bodyGrad(c, col, -16, -16, 16, 16); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = rgba('#ffffff', .42); c.lineWidth = 2; c.stroke();
    // iç plaka
    poly(c, 6, 14.5, Math.PI / 6);
    c.fillStyle = rgba(shade(col, .28), .95); c.fill();
    c.strokeStyle = rgba(shade(col, -.45), .95); c.lineWidth = 1.6; c.stroke();
    // köşe perçinleri
    c.fillStyle = shade(col, .55);
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      c.beginPath(); c.arc(Math.cos(a) * 17.4, Math.sin(a) * 17.4, 1.7, 0, TAU); c.fill();
    }
    // dikişler
    c.strokeStyle = rgba(shade(col, -.5), .8); c.lineWidth = 1.4;
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      c.moveTo(Math.cos(a) * 14.5 * Math.cos(Math.PI / 6) , Math.sin(a) * 14.5);
      c.lineTo(Math.cos(a) * 21, Math.sin(a) * 21);
    }
    c.stroke();
    // çekirdek
    orb(c, 0, 0, 6.5, col, 1);
    c.strokeStyle = rgba('#ffffff', .8); c.lineWidth = 1.2;
    c.beginPath(); c.arc(0, 0, 8.2, 0, TAU); c.stroke();
  });

  // shooter — göz tareti (döner)
  E.shooter = mk(12, 1.95, c => {
    const col = '#38bdf8';
    c.shadowColor = rgba(col, .85); c.shadowBlur = 9;
    // dış nişangah halkası (4 kesik yay)
    c.strokeStyle = rgba(col, .95); c.lineWidth = 3.2;
    for (let i = 0; i < 4; i++) {
      const a0 = i * Math.PI / 2 + .32;
      c.beginPath(); c.arc(0, 0, 10.6, a0, a0 + Math.PI / 2 - .64); c.stroke();
    }
    c.shadowBlur = 0;
    // iris gövde
    const g = c.createRadialGradient(-3, -3, 1, 0, 0, 9.6);
    g.addColorStop(0, shade(col, .55)); g.addColorStop(.6, col); g.addColorStop(1, shade(col, -.6));
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 9.2, 0, TAU); c.fill();
    c.strokeStyle = rgba('#ffffff', .5); c.lineWidth = 1.3; c.stroke();
    // göz bebeği
    orb(c, 1.6, 0, 5, '#ffffff', 1);
    c.fillStyle = '#082036';
    c.beginPath(); c.ellipse(2.4, 0, 2.2, 3.4, 0, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)';
    c.beginPath(); c.arc(3.4, -1.4, 1, 0, TAU); c.fill();
    // üst anten çentiği
    c.fillStyle = shade(col, .6);
    c.beginPath(); c.moveTo(0, -13.4); c.lineTo(2.4, -9.4); c.lineTo(-2.4, -9.4); c.closePath(); c.fill();
  });

  // splitter — bölünen hücre (salınır)
  E.splitter = mk(15, 1.75, c => {
    const col = '#7dffa8';
    c.shadowColor = rgba(col, .8); c.shadowBlur = 10;
    // zar
    const g = c.createRadialGradient(-4, -4, 2, 0, 0, 14.2);
    g.addColorStop(0, rgba(shade(col, .5), .95)); g.addColorStop(.62, rgba(col, .8)); g.addColorStop(1, rgba(shade(col, -.35), .55));
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 13.6, 0, TAU); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = rgba('#eafff3', .75); c.lineWidth = 1.6; c.stroke();
    // iç zar halkası (kesik)
    c.strokeStyle = rgba(col, .8); c.lineWidth = 1.4; c.setLineDash([4, 3]);
    c.beginPath(); c.arc(0, 0, 8.6, 0, TAU); c.stroke();
    c.setLineDash([]);
    // ikiz çekirdek — bölünme vaadi
    for (const s of [-1, 1]) {
      const n = c.createRadialGradient(s * 3.4 - 1, -1, 0, s * 3.4, 0, 4.6);
      n.addColorStop(0, '#f2fff8'); n.addColorStop(.5, shade(col, .3)); n.addColorStop(1, shade(col, -.45));
      c.fillStyle = n;
      c.beginPath(); c.arc(s * 3.4, 0, 4.4, 0, TAU); c.fill();
      c.strokeStyle = rgba(shade(col, -.35), .8); c.lineWidth = 1; c.stroke();
    }
  });

  // mini — spor
  E.mini = mk(7.5, 2.0, c => {
    const col = '#a7f3d0';
    c.shadowColor = rgba(col, .8); c.shadowBlur = 6;
    // kuyruk dikenleri
    c.fillStyle = shade(col, -.35);
    for (const a of [2.35, Math.PI - .8, Math.PI + .8]) {
      c.save(); c.rotate(a);
      c.beginPath(); c.moveTo(-4, 0); c.lineTo(-9.5, -1.8); c.lineTo(-9.5, 1.8); c.closePath(); c.fill();
      c.restore();
    }
    // gövde
    const g = c.createRadialGradient(-2, -2, .5, 0, 0, 6.4);
    g.addColorStop(0, shade(col, .55)); g.addColorStop(.65, col); g.addColorStop(1, shade(col, -.4));
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 5.8, 0, TAU); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = rgba('#ffffff', .6); c.lineWidth = 1; c.stroke();
    orb(c, 1.2, 0, 2.4, col, 1);
  });

  // boss — taçlı altıgen savaş lordu (döner)
  E.boss = mk(40, 1.6, c => {
    const col = '#ff2d55';
    c.shadowColor = rgba(col, .9); c.shadowBlur = 18;
    // taç dikenleri
    for (let i = 0; i < 6; i++) {
      const a = i / 6 * TAU;
      c.save(); c.rotate(a);
      const g = c.createLinearGradient(0, -38, 0, -50);
      g.addColorStop(0, col); g.addColorStop(1, shade(col, .75));
      c.fillStyle = g;
      c.beginPath(); c.moveTo(-6, -33); c.lineTo(0, -50); c.lineTo(6, -33); c.closePath(); c.fill();
      c.restore();
    }
    // ana gövde
    poly(c, 6, 36, 0);
    c.fillStyle = bodyGrad(c, col, -26, -26, 26, 26); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = rgba('#ffffff', .45); c.lineWidth = 2.4; c.stroke();
    // orta plaka
    poly(c, 6, 27, Math.PI / 6);
    c.fillStyle = rgba(shade(col, -.35), .95); c.fill();
    c.strokeStyle = rgba(shade(col, .55), .9); c.lineWidth = 1.8; c.stroke();
    // iç plaka
    poly(c, 6, 19, 0);
    c.fillStyle = bodyGrad(c, col, -14, -14, 14, 14); c.fill();
    // yan pilonlar
    for (const s of [-1, 1]) {
      c.save(); c.rotate(s * Math.PI / 3);
      c.fillStyle = shade(col, -.55);
      rr(c, -5, -46, 10, 14, 3); c.fill();
      c.strokeStyle = rgba(shade(col, .3), .8); c.lineWidth = 1.4; c.stroke();
      orb(c, 0, -40, 3.4, col, 1);
      c.restore();
    }
    // üç loplü çekirdek — "azı dişler"
    c.fillStyle = shade(col, -.72);
    c.beginPath(); c.moveTo(-12, -6); c.lineTo(12, -6); c.lineTo(7, 4); c.lineTo(-7, 4); c.closePath(); c.fill();
    c.strokeStyle = rgba('#ffd9e1', .8); c.lineWidth = 1.6; c.stroke();
    c.fillStyle = '#fff';
    for (const dx of [-7, 0, 7]) { c.beginPath(); c.moveTo(dx - 2.6, -6); c.lineTo(dx + 2.6, -6); c.lineTo(dx, -0.5); c.closePath(); c.fill(); }
    orb(c, 0, 0, 13, col, .55);
  });

  // panzer — çift zırhlı sur (döner)
  E.panzer = mk(46, 1.6, c => {
    const col = '#ff6b6b';
    c.shadowColor = rgba(col, .85); c.shadowBlur = 20;
    poly(c, 6, 42, 0);
    c.fillStyle = bodyGrad(c, shade(col, -.25), -30, -30, 30, 30); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = rgba('#ffd9d9', .5); c.lineWidth = 3; c.stroke();
    // ikinci zırh
    poly(c, 6, 34, Math.PI / 6);
    c.fillStyle = bodyGrad(c, col, -24, -24, 24, 24); c.fill();
    c.strokeStyle = rgba(shade(col, -.55), 1); c.lineWidth = 2; c.stroke();
    // perçinler ×8
    c.fillStyle = shade(col, .5);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU + Math.PI / 8;
      c.beginPath(); c.arc(Math.cos(a) * 38, Math.sin(a) * 38, 2.4, 0, TAU); c.fill();
    }
    // ön kalkan barı
    c.fillStyle = shade(col, -.6);
    rr(c, -20, -31, 40, 9, 4); c.fill();
    c.strokeStyle = rgba(shade(col, .4), .9); c.lineWidth = 1.6; c.stroke();
    // kor yarıkları ×3
    for (const dx of [-10, 0, 10]) {
      c.fillStyle = rgba('#ffe3e8', .95);
      rr(c, dx - 4.5, -29.4, 9, 4, 2); c.fill();
      orb(c, dx, -27.4, 5, col, .8);
    }
    // merkez çekirdek
    orb(c, 0, 0, 10, col, 1);
    c.strokeStyle = rgba('#ffffff', .85); c.lineWidth = 1.6;
    c.beginPath(); c.arc(0, 0, 12.5, 0, TAU); c.stroke();
  });

  // bombacı — tehlike şeritli bombardıman gövdesi
  E.bombaci = mk(34, 1.65, c => {
    const col = '#ffd166';
    c.shadowColor = rgba(col, .85); c.shadowBlur = 16;
    // gövde
    const g = c.createLinearGradient(0, -30, 0, 30);
    g.addColorStop(0, shade(col, .45)); g.addColorStop(.5, col); g.addColorStop(1, shade(col, -.55));
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 28, 0, TAU); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = rgba('#fffbe8', .5); c.lineWidth = 2; c.stroke();
    // tehlike şeritleri (daire içine kırpık)
    c.save();
    c.beginPath(); c.arc(0, 0, 26.4, 0, TAU); c.clip();
    c.fillStyle = rgba('#3b2b05', .8);
    c.save(); c.rotate(-.5);
    for (const dx of [-22, -6, 10]) { c.fillRect(dx, -34, 8, 68); }
    c.restore();
    c.restore();
    // kapak parlaması
    c.strokeStyle = rgba('#ffffff', .3); c.lineWidth = 5;
    c.beginPath(); c.arc(0, 0, 24, -2.3, -1.1); c.stroke();
    // bomba yatağı
    const bg = c.createRadialGradient(-2, -2, 1, 0, 0, 11);
    bg.addColorStop(0, '#fff8e7'); bg.addColorStop(.5, shade(col, .1)); bg.addColorStop(1, shade(col, -.7));
    c.fillStyle = bg;
    c.beginPath(); c.arc(0, 0, 10.4, 0, TAU); c.fill();
    c.strokeStyle = rgba(shade(col, -.5), 1); c.lineWidth = 2; c.stroke();
    c.fillStyle = '#2b1c02';
    c.beginPath(); c.arc(0, 0, 4.4, 0, TAU); c.fill();
    // kuyruk yüzgeçleri
    c.fillStyle = shade(col, -.45);
    for (const a of [.7, 2.45, 4.15]) {
      c.save(); c.rotate(a);
      c.beginPath(); c.moveTo(26, -3); c.lineTo(38, -7); c.lineTo(38, 7); c.lineTo(26, 3); c.closePath(); c.fill();
      c.restore();
    }
    orb(c, 0, 0, 6, col, .9);
  });

  // şaman — rün halkalı mistik kuka
  E.shaman = mk(36, 1.65, c => {
    const col = '#a3e635';
    c.shadowColor = rgba(col, .85); c.shadowBlur = 16;
    // kuka
    c.beginPath();
    c.moveTo(0, -32);
    c.quadraticCurveTo(26, -14, 20, 26);
    c.quadraticCurveTo(0, 20, -20, 26);
    c.quadraticCurveTo(-26, -14, 0, -32);
    c.closePath();
    c.fillStyle = bodyGrad(c, col, -14, -30, 14, 26); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = rgba('#f4ffd9', .55); c.lineWidth = 2; c.stroke();
    // iç gölge
    c.beginPath();
    c.moveTo(0, -24);
    c.quadraticCurveTo(17, -10, 13, 18);
    c.quadraticCurveTo(0, 13.5, -13, 18);
    c.quadraticCurveTo(-17, -10, 0, -24);
    c.closePath();
    c.fillStyle = rgba(shade(col, -.68), .65); c.fill();
    // göz — badem
    c.beginPath(); c.ellipse(0, -4, 10.5, 6, 0, 0, TAU);
    c.fillStyle = '#0c1a03'; c.fill();
    c.strokeStyle = rgba('#eaffc4', .9); c.lineWidth = 1.6; c.stroke();
    orb(c, 0, -4, 5.5, col, 1);
    c.fillStyle = '#fff';
    c.beginPath(); c.ellipse(1.4, -4, 1.9, 3, 0, 0, TAU); c.fill();
    // rün halkası — elmas runes
    for (let i = 0; i < 7; i++) {
      const a = i / 7 * TAU;
      c.save(); c.translate(Math.cos(a) * 24, Math.sin(a) * 24); c.rotate(a + Math.PI / 4);
      const rg = c.createLinearGradient(-3, 0, 3, 0);
      rg.addColorStop(0, shade(col, .6)); rg.addColorStop(1, shade(col, -.25));
      c.fillStyle = rg;
      c.fillRect(-3, -1.7, 6, 3.4);
      c.restore();
      orb(c, Math.cos(a) * 24, Math.sin(a) * 24, 3.2, col, .7);
    }
    // yan fısıltı kavisleri
    c.strokeStyle = rgba(col, .75); c.lineWidth = 2;
    c.beginPath(); c.moveTo(-24, -6); c.quadraticCurveTo(-31, 2, -25, 12); c.stroke();
    c.beginPath(); c.moveTo(24, -6); c.quadraticCurveTo(31, 2, 25, 12); c.stroke();
  });

  // ================================================================
  //  TOPLANABİLİRLER
  // ================================================================
  function gemSprite(col, R, big) {
    return mk(R, 2.3, c => {
      // dış hale — nebula içinde yüzen kristal hissi
      const halo = c.createRadialGradient(0, 0, R * .3, 0, 0, R * 2.15);
      halo.addColorStop(0, rgba(col, .38));
      halo.addColorStop(.5, rgba(col, .14));
      halo.addColorStop(1, rgba(col, 0));
      c.fillStyle = halo;
      c.beginPath(); c.arc(0, 0, R * 2.15, 0, TAU); c.fill();
      c.shadowColor = rgba(col, .95); c.shadowBlur = 10;
      if (big) star(c, 4, R * 1.05, R * .42, 0);
      else {
        c.beginPath();
        c.moveTo(0, -R); c.lineTo(R * .58, -R * .22); c.lineTo(R * .36, R * .9);
        c.lineTo(-R * .36, R * .9); c.lineTo(-R * .58, -R * .22);
        c.closePath();
      }
      const g = c.createLinearGradient(-R, -R, R * .6, R);
      g.addColorStop(0, shade(col, .65)); g.addColorStop(.5, col); g.addColorStop(1, shade(col, -.45));
      c.fillStyle = g; c.fill();
      c.shadowBlur = 0;
      c.strokeStyle = rgba('#ffffff', .75); c.lineWidth = 1.2; c.stroke();
      // faset çizgileri
      c.strokeStyle = rgba(shade(col, -.4), .7); c.lineWidth = 1;
      c.beginPath();
      c.moveTo(0, -R); c.lineTo(0, R * .9);
      c.moveTo(-R * .58, -R * .22); c.lineTo(0, R * .12); c.lineTo(R * .58, -R * .22);
      c.stroke();
      // iç kor
      orb(c, 0, -R * .1, R * .5, col, .95);
      // tepe parıltısı
      c.fillStyle = 'rgba(255,255,255,.95)';
      c.beginPath(); c.arc(-R * .22, -R * .45, R * .1 + .6, 0, TAU); c.fill();
    });
  }
  const gems = { small: gemSprite('#67e8f9', 6, false), mid: gemSprite('#7dffa8', 7.4, false), big: gemSprite('#f0abfc', 9.4, true) };

  const coin = mk(7.5, 1.9, c => {
    const col = '#fbbf24';
    c.shadowColor = rgba(col, .9); c.shadowBlur = 6;
    const g = c.createRadialGradient(-2.2, -2.4, .6, 0, 0, 7);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(.55, col); g.addColorStop(1, shade(col, -.5));
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 6.4, 0, TAU); c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = rgba('#fff7d6', .85); c.lineWidth = 1.1; c.stroke();
    // iç halka
    c.strokeStyle = rgba(shade(col, -.4), .75); c.lineWidth = .9;
    c.beginPath(); c.arc(0, 0, 4.6, 0, TAU); c.stroke();
    // altıgen amblem
    poly(c, 6, 3, 0);
    c.fillStyle = rgba(shade(col, -.55), .9); c.fill();
    // speküler yay
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.4;
    c.beginPath(); c.arc(0, 0, 5.2, -2.4, -1.25); c.stroke();
  });

  function crateSprite(kind) {                     // 'n' | 'boss' | 'evo'
    const col = kind === 'evo' ? '#a78bfa' : (kind === 'boss' ? '#fde047' : '#f59e0b');
    const w = kind === 'n' ? 13 : 14.5, h = kind === 'n' ? 11 : 12.5;
    return mk(16, 1.8, c => {
      c.shadowColor = rgba(col, .9); c.shadowBlur = 11;
      const g = c.createLinearGradient(0, -h, 0, h);
      g.addColorStop(0, shade(col, .5)); g.addColorStop(.5, col); g.addColorStop(1, shade(col, -.5));
      c.fillStyle = g;
      rr(c, -w, -h, w * 2, h * 2, 3.5); c.fill();
      c.shadowBlur = 0;
      c.strokeStyle = rgba('#ffffff', .65); c.lineWidth = 1.6; c.stroke();
      // kapak bandı
      c.fillStyle = rgba(shade(col, .55), .95);
      rr(c, -w, -h * .32, w * 2, h * .55, 2); c.fill();
      c.strokeStyle = rgba(shade(col, -.45), .8); c.lineWidth = 1; c.stroke();
      // köşe perçinleri
      c.fillStyle = shade(col, .7);
      for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
        c.beginPath(); c.arc(sx * (w - 3), sy * (h - 3), 1.3, 0, TAU); c.fill();
      }
      // amblem
      c.save(); c.translate(0, h * .45);
      if (kind === 'evo') {                        // evrim şimşeği
        c.fillStyle = '#f5f3ff';
        c.beginPath(); c.moveTo(1.8, -5.4); c.lineTo(-2.6, .4); c.lineTo(-.2, .4);
        c.lineTo(-1.8, 5.4); c.lineTo(2.6, -.6); c.lineTo(.2, -.6); c.closePath(); c.fill();
        c.strokeStyle = '#312e81'; c.lineWidth = .8; c.stroke();
      } else if (kind === 'boss') {                // taç
        c.fillStyle = '#78350f';
        c.beginPath(); c.moveTo(-4.6, 2.6); c.lineTo(-4.6, -2.2); c.lineTo(-2.3, -.2);
        c.lineTo(0, -3.4); c.lineTo(2.3, -.2); c.lineTo(4.6, -2.2); c.lineTo(4.6, 2.6);
        c.closePath(); c.fill();
        c.fillStyle = '#fde047';
        c.fillRect(-4.6, 2.2, 9.2, 1.5);
      } else {                                     // yıldız
        star(c, 5, 4.4, 1.9, -Math.PI / 2);
        c.fillStyle = '#fff7d6'; c.fill();
        c.strokeStyle = '#92400e'; c.lineWidth = .7; c.stroke();
      }
      c.restore();
      // üst speküler
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(-w + 3.5, -h + 2.6); c.lineTo(w - 4.5, -h + 2.6); c.stroke();
    });
  }
  const crates = { n: crateSprite('n'), boss: crateSprite('boss'), evo: crateSprite('evo') };

  // ================================================================
  //  MERMİLER & SİLAH GÖRSELLERİ
  // ================================================================
  const orbCache = {};
  function bulletOrb(col) {
    if (orbCache[col]) return orbCache[col];
    orbCache[col] = mk(5, 3.4, c => {
      // iz (arkaya doğru degrade kuyruk)
      const g = c.createLinearGradient(-13, 0, 2, 0);
      g.addColorStop(0, rgba(col, 0)); g.addColorStop(1, rgba(col, .55));
      c.strokeStyle = g; c.lineWidth = 3.4; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-13, 0); c.lineTo(1, 0); c.stroke();
      orb(c, 0, 0, 6.4, col, 1);
    });
    return orbCache[col];
  }
  const ebullet = mk(5.5, 3.2, c => {
    const g = c.createRadialGradient(0, 0, 0, 0, 0, 7.4);
    g.addColorStop(0, '#fff5f7'); g.addColorStop(.3, '#fb7185'); g.addColorStop(.7, rgba('#e11d48', .55)); g.addColorStop(1, rgba('#e11d48', 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, 7.4, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,205,215,.9)'; c.lineWidth = 1.1;
    c.beginPath(); c.arc(0, 0, 3.1, 0, TAU); c.stroke();
  });
  const missile = mk(8, 2.3, c => {
    const col = '#fb7185';
    // alev
    const fg = c.createLinearGradient(-14, 0, -5, 0);
    fg.addColorStop(0, rgba('#fde68a', 0)); fg.addColorStop(.6, rgba('#fb923c', .8)); fg.addColorStop(1, '#fff7ed');
    c.fillStyle = fg;
    c.beginPath(); c.moveTo(-5, -2.2); c.lineTo(-14.5, 0); c.lineTo(-5, 2.2); c.closePath(); c.fill();
    // gövde
    c.fillStyle = shade(col, -.55);
    rr(c, -6.5, -2.4, 9, 4.8, 2.2); c.fill();
    c.strokeStyle = rgba('#ffe4e9', .8); c.lineWidth = 1; c.stroke();
    // burun
    c.beginPath(); c.moveTo(10.5, 0); c.lineTo(2.5, -2.6); c.lineTo(2.5, 2.6); c.closePath();
    c.fillStyle = col; c.fill();
    // yüzgeçler
    c.fillStyle = shade(col, -.4);
    c.beginPath(); c.moveTo(-6.5, -2.4); c.lineTo(-9.5, -5); c.lineTo(-4.5, -2.2); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(-6.5, 2.4); c.lineTo(-9.5, 5); c.lineTo(-4.5, 2.2); c.closePath(); c.fill();
    orb(c, 3, 0, 2.2, col, 1);
  });
  const bladeSpr = mk(14, 1.7, c => {
    const col = '#7dffa8';
    // hilal: dış yay − iç yay
    c.beginPath();
    c.arc(0, 0, 13.5, -1.05, 1.05);
    c.arc(4.4, 0, 11, 1.02, -1.02, true);
    c.closePath();
    const g = c.createLinearGradient(-12, 0, 12, 0);
    g.addColorStop(0, rgba(col, .25)); g.addColorStop(.75, col); g.addColorStop(1, '#f2fff8');
    c.fillStyle = g;
    c.shadowColor = rgba(col, .9); c.shadowBlur = 8;
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = rgba('#eafff3', .85); c.lineWidth = 1.1; c.stroke();
  });

  // ================================================================
  //  PARILTI NOKTASI (yıldız/toz/toz zerre için)
  // ================================================================
  const dotCache = {};
  function glowDot(col) {
    if (dotCache[col]) return dotCache[col];
    dotCache[col] = mk(4, 1.6, c => {
      const g = c.createRadialGradient(0, 0, 0, 0, 0, 6.2);
      g.addColorStop(0, '#ffffff'); g.addColorStop(.35, rgba(col, .9)); g.addColorStop(1, rgba(col, 0));
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, 6.2, 0, TAU); c.fill();
    });
    return dotCache[col];
  }

  // ---------- beyaz vuruş silüetleri ----------
  const EFlash = {};
  for (const k of Object.keys(E)) EFlash[k] = whiten(E[k]);
  const shipCache = {}, shipFlashCache = {};

  // ---------- API ----------
  return {
    SS, rgba, shade, draw, poly, star, rr, orb,
    ship(id) {
      if (!shipCache[id]) {
        const kind = id === 'vektor' ? 'vektor' : id;
        const col = { vektor: '#22d3ee', pyra: '#fb923c', glacia: '#67e8f9', nova9: '#f0abfc' }[id] || '#22d3ee';
        shipCache[id] = shipSprite(col, kind);
        shipFlashCache[id] = whiten(shipCache[id]);
      }
      return shipCache[id];
    },
    shipFlash(id) { this.ship(id); return shipFlashCache[id]; },
    enemy(t) { return E[t] || E.grunt; },
    enemyFlash(t) { return EFlash[t] || EFlash.grunt; },
    gem(v) { return v >= 20 ? gems.big : (v >= 5 ? gems.mid : gems.small); },
    coin: () => coin,
    crate(kind) { return crates[kind] || crates.n; },
    bullet: bulletOrb,
    ebullet: () => ebullet,
    missile: () => missile,
    blade: () => bladeSpr,
    dot: glowDot,
  };
})();
