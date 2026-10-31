/* NEON STORM — core.js : saf mantık katmanı (DOM'suz; Node testlerinde de çalışır)
   Tek doğruluk kaynağı: formüller, karakter tanımları, görev üretimi, A/B kovalama, ekonomi. */
'use strict';
const CORE = (() => {

  // ---------- yardımcılar
  function hash32(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

  // ---------- oyun formülleri (game.js ile birebir uyumlu)
  const xpNeed = l => Math.floor(5 + (l - 1) * 3 + Math.pow(l, 1.55) * 1.6);

  const ETYPES = {
    grunt:   { hp: 16,  sp: 74,  r: 13, dmg: 8,  sc: 10,  xp: 1,  coin: 0.25 },
    swarm:   { hp: 8,   sp: 128, r: 9,  dmg: 5,  sc: 6,   xp: 1,  coin: 0.2 },
    tank:    { hp: 95,  sp: 34,  r: 22, dmg: 16, sc: 30,  xp: 4,  coin: 1 },
    shooter: { hp: 26,  sp: 52,  r: 12, dmg: 10, sc: 20,  xp: 2,  coin: 0.5 },
    splitter:{ hp: 34,  sp: 62,  r: 15, dmg: 9,  sc: 18,  xp: 2,  coin: 0.4 },
    mini:    { hp: 9,   sp: 100, r: 7,  dmg: 4,  sc: 4,   xp: 1,  coin: 0.1 },
    boss:    { hp: 900,  sp: 42, r: 40, dmg: 26, sc: 600, xp: 30, coin: 12, boss: true,
               shootCd: 2.6, bullets: 10, bulletSp: 150, bulletDmg: 12 },
    // v2.9 boss çeşitliliği (hedef E/F): panzer = tanky duvar, bombacı = hızlı mermi yağmuru
    panzer:  { hp: 1500, sp: 26, r: 46, dmg: 30, sc: 750, xp: 36, coin: 14, boss: true,
               shootCd: 3.0, bullets: 12, bulletSp: 130, bulletDmg: 14 },
    bombaci: { hp: 700,  sp: 60, r: 34, dmg: 22, sc: 700, xp: 33, coin: 13, boss: true,
               shootCd: 1.7, bullets: 16, bulletSp: 190, bulletDmg: 10 },
    // v2.14 3. boss tipi (hedef E/F): şaman = çevre düşmanları periyodik iyileştirir —
    // oyuncuyu alan kontrolüne (nova/frost önceliği) ve şamanı önce kesmeye zorlar.
    // heal tablosu tablo sürüşlü: r yarıçap, pct maxhp yüzdesi, cd atım aralığı.
    shaman:  { hp: 1000, sp: 46, r: 36, dmg: 24, sc: 720, xp: 34, coin: 13, boss: true,
               shootCd: 2.2, bullets: 8, bulletSp: 160, bulletDmg: 10,
               heal: { r: 260, pct: 0.05, cd: 3.0 } },
  };

  // v2.9: boss varyant seçimi — v2.14 ile ÜÇLÜ çekiliş %33/33/33 (rngVal verilirse deterministik)
  const pickBoss = rngVal => {
    const r = (rngVal === undefined ? Math.random() : rngVal);
    return r < 1 / 3 ? 'panzer' : (r < 2 / 3 ? 'bombaci' : 'shaman');
  };

  function spawnPool(t) {
    const pool = ['grunt', 'grunt', 'grunt'];
    if (t > 50) pool.push('swarm', 'swarm');
    if (t > 110) pool.push('tank');
    if (t > 150) pool.push('shooter');
    if (t > 210) pool.push('splitter');
    return pool;
  }
  const spawnScale = t => ({
    hp: 1 + t / 42,
    dmg: 1 + t / 160,
    sp: Math.min(1.35, 1 + t / 900),
  });
  const spawnInterval = t => clamp(0.92 - t / 420, 0.34, 0.92);
  // v2.8 (hedef E): ilk 30 sn garanti düşman akışı — survivor açılışı hiç boş geçmesin
  const spawnCount = t => Math.max(1 + Math.floor(t / 40), t < 30 ? 2 : 1);
  // v2.8 (hedef E): ilk ekipman kasası 2. dakikada garantili düşer (dropCrate)
  const FIRST_ITEM_T = 120;

  // v2.10 (hedef E): evrim eşiği — silah SVY 5'e ulaşınca (evPassive ≥1 ile) EVRİM kartı açılır.
  // SVY 4→5 son yükseltme kartı 'EVO YOLU' bandı taşır: oyuncu evrimi hedef olarak görür.
  const EVO_LVL = 5;
  const wupEvoNear = lvl => lvl === EVO_LVL - 1;
  // v2.11 (hedef E): EVO ilerleme çubuğu verisi — her silah yükseltme kartında gösterilir.
  const evoProg = (lvl, pasLvl) => ({
    lv: clamp(lvl, 0, EVO_LVL),
    lvMax: EVO_LVL,
    pas: (pasLvl || 0) >= 1 ? 1 : 0,
    ready: lvl >= EVO_LVL && (pasLvl || 0) >= 1,
  });

  // v2.23 (hedef E+B, pazar istihbaratı #1 kapanışı): takım geneli EVRİME HAZİR sinyali.
  // ensureEvo (v2.14) garantisi koddaydı ama oyuncu GÖRMÜYORDU (v2.11 pip dersi: kanıt
  // oyuncu bilgisiyle aynı kapıdan geçer). evoProg.ready per-silah doğrulamasının
  // takım dökümü: buildChoices'taki evo-şeritle BİREBİR aynı eşiği kullanır.
  function evoReady(weapons, passives, WEAPONS) {
    if (!Array.isArray(weapons)) return { ready: false, id: null };
    const pw = passives || {};
    for (const w of weapons) {
      if (!w || w.evo) continue;
      const W_ = WEAPONS && WEAPONS[w.id];
      if (!W_) continue;
      if (evoProg(w.lvl, pw[W_.evPassive]).ready) return { ready: true, id: w.id };
    }
    return { ready: false, id: null };
  }

  // v2.8 (hedef D): web placeholder ↔ native SDK geçiş yönlendiricisi.
  // bridge[name](arg) varsa onu kullanır; yoksa / hata verirse / undefined dönerse
  // sim (web placeholder) akışına düşer. Promise dönerse aynen iletilir (native async).
  function routeNative(bridge, name, arg, fallback) {
    if (bridge && typeof bridge[name] === 'function') {
      try {
        const r = bridge[name](arg);
        if (r && typeof r.then === 'function') return r;
        if (r !== undefined) return r;
      } catch (e) { /* native sdk hatası → sim akış */ }
    }
    return fallback();
  }

  // v2.13: pilot favori silah sinerjisi (20MTD dersi) — saf yardımcılar
  const FAV_MULT = 2.0;
  function applyFav(pool, favIds) {
    if (!Array.isArray(favIds) || !favIds.length || !Array.isArray(pool)) return pool;
    for (const o of pool) {
      if ((o.kind === 'wup' || o.kind === 'wnew') && favIds.includes(o.id)) o.w *= FAV_MULT;
    }
    return pool;
  }
  function ensureFav(out, pool, favIds) {
    if (!Array.isArray(favIds) || !favIds.length || !Array.isArray(out) || !Array.isArray(pool)) return out;
    const isFav = o => (o.kind === 'wup' || o.kind === 'wnew') && favIds.includes(o.id);
    if (out.some(isFav)) return out;
    const idx = pool.findIndex(isFav);
    if (idx < 0) return out;
    out.unshift(pool.splice(idx, 1)[0]);
    if (out.length > 3) out.pop();
    return out;
  }
  // v2.24 (hedef G — istihbarat #3 mikro kalanı): 6/6 silah slotu dolu iken heal/coin
  // kartlarının ds notu — oyuncu neden yeni silah görmediğini kart üzerinden öğrenir
  // (wcap-chip 'DOLU · heal/coin akışı' etiketiyle aynı gerçeği iki yerde söyler).
  function slotsNote(full) {
    return full ? ' · Silah slotları dolu — havuzda yeni silah yok' : '';
  }

  // v2.14: EVRİM kartı garantisi (Survivor.io kasa dersi — istihbarat #1): evo-ready iken
  // (silah SVY 5 + ev pasifi ≥1) havuzdaki EVRİM kartı İLK sırada GARANTİLİ — ağırlık 0.55
  // yüzünden kaçınlma dönemi bitti. ensureFav deseninin aynısı: havuzdan öne alınır, tavan 3 korunur.
  function ensureEvo(out, pool) {
    if (!Array.isArray(out) || !Array.isArray(pool)) return out;
    const isEvo = o => o.kind === 'evo';
    if (out.some(isEvo)) return out;
    const idx = pool.findIndex(isEvo);
    if (idx < 0) return out;
    out.unshift(pool.splice(idx, 1)[0]);
    if (out.length > 3) out.pop();
    return out;
  }
  // v2.13: battle pass sezon taşınması (Survivor.io dersi) — %30 EXP carryover
  const PASS_CARRY = 0.3;
  function passCarry(xp) { return Math.floor(Math.max(0, xp || 0) * PASS_CARRY); }

  // silah DPS tablosu (denge simülasyonu için)
  const WEAPON_BASICS = {
    pulse:   { dmg: 11, cd: 0.55, note: 'tek hedef, evo 3 pierce' },
    blades:  { dmg: 10, cd: 0.38, note: 'kılıç başına 0.85x, 2+ kılıç' },
    nova:    { dmg: 24, cd: 3.2,  note: 'alan hasarı' },
    chain:   { dmg: 16, cd: 1.6,  note: '2+ zıplama, 0.85 zayıflama' },
    frost:   { dmg: 10, cd: 0.5,  note: '0.3x hasar + yavaşlatma' },
    missile: { dmg: 32, cd: 2.4,  note: 'alan patlaması' },
  };
  function weaponDps(id, lvl, evo, dmgMul, frMul) {
    const b = WEAPON_BASICS[id]; if (!b) return 0;
    dmgMul = dmgMul || 1; frMul = frMul || 1;
    const lvlMul = 1 + 0.22 * (lvl - 1);
    const cd = Math.max(0.12, b.cd * Math.pow(0.93, lvl - 1)) * frMul;
    let hits = 1;
    if (id === 'pulse') hits = 1 + Math.floor((lvl - 1) / 2);
    if (id === 'blades') hits = 2 + Math.floor((lvl - 1) / 2) + (evo ? 1 : 0);
    if (id === 'chain') hits = 2 + Math.floor(lvl / 2);
    let per = b.dmg * lvlMul * dmgMul;
    if (id === 'blades') per *= 0.85;
    if (id === 'frost') per *= 0.3;
    if (id === 'chain') { let s = 0, d = per; for (let j = 0; j < hits; j++) { s += d; d *= 0.85; } per = s / cd; return per; }
    if (id === 'missile' && evo) hits = 2;
    return (per * hits) / cd;
  }

  // meta mağaza (game.js UPGRADES kopyası)
  const UPGRADES = [
    { id: 'hp',  name: 'YAPI DAYANIKLILIĞI', desc: '+12 maks can / seviye',       max: 5, cost: l => 60 + l * 95 },
    { id: 'dmg', name: 'ATEŞ GÜCÜ',          desc: '+8% toplam hasar / seviye',   max: 5, cost: l => 80 + l * 120 },
    { id: 'spd', name: 'İTKİ MOTORU',        desc: '+6% hareket hızı / seviye',   max: 5, cost: l => 70 + l * 110 },
    { id: 'mag', name: 'MIKNATIS ALANI',     desc: '+22% toplama alanı / seviye', max: 5, cost: l => 50 + l * 80 },
    { id: 'rfr', name: 'SOĞUTMA SİSTEMİ',    desc: '-5% silah bekleme / seviye',  max: 5, cost: l => 90 + l * 130 },
    { id: 'rev', name: 'YEDEK ÇEKİRDEK',     desc: '+1 otomatik diriliş hakkı',   max: 2, cost: l => 400 + l * 650 },
  ];
  const upgradeCost = (id, lvl) => {
    const u = UPGRADES.find(x => x.id === id);
    if (!u) return Infinity;
    return u.cost(lvl);
  };
  const totalMaxCost = () => {
    let s = 0;
    for (const u of UPGRADES) for (let l = 0; l < u.max; l++) s += u.cost(l);
    return s;
  };
  // run sonu coin ödülü (game.js gameOver kopyası)
  const rewardCoins = (kills, t, level, bossKills) =>
    Math.floor(kills * 0.5 + t * 0.9 + level * 6 + bossKills * 40);

  // ---------- pilotlar (karakter koleksiyonu)
  const CHARS = {
    vektor: { name: 'VEKTOR',  desc: 'Dengeli protokol pilotu. Standart ateş gücü.', color: '#22d3ee', cost: 0,    weapons: ['pulse'], mods: {} },
    pyra:   { name: 'PYRA',    desc: '+15% hasar, -10% maks can. Agresif çizgi.',    color: '#fb923c', cost: 800,  weapons: ['pulse'], mods: { dmg: 1.15, hp: 0.9 } },
    glacia: { name: 'GLACIA',  desc: 'Buz alanıyla başlar, +%15 maks can, -5% hız.', color: '#67e8f9', cost: 1200, weapons: ['pulse', 'frost'], mods: { hp: 1.15, spd: 0.95 } },
    nova9:  { name: 'NOVA-9',  desc: '-12% bekleme süresi, +%5 hasar. Deneysel gövde.', color: '#f0abfc', cost: 2000, weapons: ['pulse'], mods: { frate: 0.88, dmg: 1.05 } },
  };
  const charMods = id => (CHARS[id] || CHARS.vektor).mods || {};

  // ---------- A/B deneyleri (deterministik kovalama)
  const EXPERIMENTS = {
    spawn_pace: { desc: 'Doğuş temposu', split: 50, variants: ['normal', 'fast'], map: { normal: 1, fast: 0.85 } },
    daily_reward: { desc: 'Günlük ödül tutarı', split: 50, variants: ['c150', 'c200'], map: { c150: 150, c200: 200 } },
  };
  function bucket(userId, expId) {
    const e = EXPERIMENTS[expId]; if (!e) return 'control';
    return (hash32(String(userId) + '::' + expId) % 100) < e.split ? e.variants[0] : e.variants[1];
  }

  // ---------- görev üretimi (deterministik)
  const QUEST_TEMPLATES = [
    { type: 'kill',  goal: 150, text: '150 düşman yok et' },
    { type: 'coin',  goal: 60,  text: '60 coin topla' },
    { type: 'time',  goal: 240, text: 'Toplam 4 dakika hayatta kal' },
    { type: 'level', goal: 12,  text: 'Bir run içinde seviye 12 ulaş' },
    { type: 'boss',  goal: 1,   text: '1 boss yok et' },
    { type: 'boss',  goal: 2,   text: '2 boss yok et' },
    { type: 'fuse',  goal: 1,   text: '1 ekipman birleştir' },
    { type: 'fuse',  goal: 2,   text: '2 ekipman birleştir' },
    { type: 'runs',  goal: 3,   text: '3 run tamamla' },
    { type: 'kill',  goal: 250, text: '250 düşman yok et' },
    { type: 'coin',  goal: 100, text: '100 coin topla' },
  ];
  const WEEKLY_TEMPLATES = [
    { type: 'kill', goal: 1200, text: 'Haftada 1.200 düşman yok et' },
    { type: 'coin', goal: 400,  text: 'Haftada 400 coin topla' },
    { type: 'boss', goal: 5,    text: 'Haftada 5 boss yok et' },
    { type: 'time', goal: 1800, text: 'Haftada 30 dakika hayatta kal' },
  ];
  const DAILY_REWARDS = [120, 150, 120];
  // v2.10 (hedef A/E): 3. günlük görev ⬡+✧ karışımı — ekipman/yıldız ekonomisine görev musluğu.
  // (toplam ◈ 450→390; karşılığında +100⬡ ekipman hattına, +15✧ yıldız hattına günlük akış)
  const DAILY_BONUS = [null, null, { gold: 100, oz: 15 }];
  const WEEKLY_REWARD = 600;
  // v2.11 (hedef A/E): haftalık %50 karışım varyantı — 400◈+300⬡ (rng hafta bazlı deterministik).
  const WEEKLY_MIX = { reward: 400, bonus: { gold: 300 } };

  function rollDaily(dateStr) {
    const rng = mulberry32(hash32('daily::' + dateStr));
    const pool = QUEST_TEMPLATES.slice();
    const out = [];
    for (let i = 0; i < 3 && pool.length; i++) {
      const idx = Math.floor(rng() * pool.length);
      const t = pool.splice(idx, 1)[0];
      out.push({ ...t, reward: DAILY_REWARDS[i], bonus: DAILY_BONUS[i] || undefined, prog: 0, claimed: false });
    }
    return out;
  }
  function rollWeekly(weekStr) {
    const rng = mulberry32(hash32('weekly::' + weekStr));
    const t = WEEKLY_TEMPLATES[Math.floor(rng() * WEEKLY_TEMPLATES.length)];
    // v2.11: ikinci rng çekimi — aynı hafta için hep aynı varyant (deterministik)
    if (rng() < 0.5) return { ...t, reward: WEEKLY_MIX.reward, bonus: WEEKLY_MIX.bonus, prog: 0, claimed: false };
    return { ...t, reward: WEEKLY_REWARD, prog: 0, claimed: false };
  }

  // ---------- skor/submit makullük kontrolü (anti-hile, istemci+sunucu ortak kurallar)
  function plausible(sub) {
    if (!sub || typeof sub !== 'object') return false;
    const { score, time, kills, level, bossKills } = sub;
    if (!Number.isFinite(score) || !Number.isFinite(time) || !Number.isFinite(kills)) return false;
    if (score < 0 || time < 0 || kills < 0) return false;
    if (time > 3600) return false;
    if (kills > time * 30 + 100) return false;                    // sn başına 30 av makul üstü
    if (score > kills * 900 + 5000) return false;                 // skor-av üst sınırı
    if (Number.isFinite(level) && level > 10 + time / 10) return false;
    if (Number.isFinite(bossKills) && bossKills > time / 60 + 2) return false;
    return true;
  }

  // ---------- İLK 90 SN RADARI (v2.15, hedef E/G) ----------
  // Koşu olay damgaları: oyun killEnemy/checkLevel/boss-spawn'da mstone çağırır,
  // gameOver ölüm anını ekler; ölüm ekranı mini çizelge + kalıcı 'en iyi ilerleme' gösterir.
  const MSTONES = { ilk_av: 'İLK AV', ilk_seviye: 'İLK SEVİYE', ilk_boss: 'İLK BOSS' };
  const BOSS_NAMES = { panzer: 'PANZER', bombaci: 'BOMBACI', shaman: 'ŞAMAN' };   // v2.14 bossu artık görünür
  function fmtClock(s) {
    s = Math.max(0, Math.floor(Number(s) || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function mstoneLine(ms) {
    if (!Array.isArray(ms)) return [];
    const order = Object.keys(MSTONES);
    const out = [];
    for (const id of order) {
      const m = ms.find(x => x && x.id === id && Number.isFinite(x.t));
      if (m) out.push(MSTONES[id] + ' ' + fmtClock(m.t));
    }
    return out;
  }
  function bestProgress(prev, ms) {
    const order = Object.keys(MSTONES);
    let hi = null;
    for (const m of (Array.isArray(ms) ? ms : [])) {
      if (!m || !MSTONES[m.id] || !Number.isFinite(m.t)) continue;
      if (!hi || order.indexOf(m.id) > order.indexOf(hi.id)) hi = m;
    }
    if (!hi) return prev && MSTONES[prev.id] ? prev : { id: null, t: 0 };
    if (!prev || !MSTONES[prev.id]) return { id: hi.id, t: hi.t };
    if (order.indexOf(hi.id) > order.indexOf(prev.id)) return { id: hi.id, t: hi.t };
    if (hi.id === prev.id && hi.t < prev.t) return { id: prev.id, t: hi.t };
    return prev;
  }

  // ---------- denge simülasyonu yardımcıları
  function timeToKill(type, weapon, lvl, evo, t, dmgMul) {
    const S = spawnScale(t);
    const hp = ETYPES[type].hp * S.hp;
    const dps = weaponDps(weapon, lvl, evo, dmgMul, 1);
    return dps > 0 ? hp / dps : Infinity;
  }

  return {
    hash32, mulberry32, clamp,
    xpNeed, ETYPES, spawnPool, spawnScale, spawnInterval, spawnCount, pickBoss,
    WEAPON_BASICS, weaponDps, UPGRADES, upgradeCost, totalMaxCost, rewardCoins,
    EVO_LVL, wupEvoNear, evoProg,
    CHARS, charMods, EXPERIMENTS, bucket,
    QUEST_TEMPLATES, WEEKLY_TEMPLATES, DAILY_REWARDS, DAILY_BONUS, WEEKLY_REWARD, WEEKLY_MIX, rollDaily, rollWeekly,
    FIRST_ITEM_T, routeNative,
    plausible, timeToKill,
    applyFav, ensureFav, ensureEvo, passCarry, evoReady, slotsNote,
    MSTONES, BOSS_NAMES, fmtClock, mstoneLine, bestProgress,
  };
})();
globalThis.CORE = CORE;
