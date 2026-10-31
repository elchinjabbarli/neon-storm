/* NEON STORM — game.js : çekirdek oynanış (silahlar, düşmanlar, boss, XP, meta) */
'use strict';
const GAME = (() => {
  const { rand, irand, clamp, dist2, TAU, keys, joy, shake, hitstop, flash,
    burst, ftext, hash, qbuf } = ENG;
  const ctx = ENG.ctx;
  const state = ENG.state;

  // ==================== KAYIT / META ====================
  const SAVE_KEY = 'neonstorm_save_v1';
  const DEF_META = {
    v: 1, coins: 0, runs: 0, daily: '', tutorial: false,
    best: { score: 0, time: 0, kills: 0, mstone: null },
    upgrades: { hp: 0, dmg: 0, spd: 0, mag: 0, rfr: 0, rev: 0 },
    ach: {},
    settings: { sfx: true, music: true, haptics: true },
    chars: { vektor: true },
    char: 'vektor',
    quests: null,
    board: [],
    aid: '',
  };
  let META = (() => {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      if (d && d.upgrades) {
        return {
          ...JSON.parse(JSON.stringify(DEF_META)), ...d,
          upgrades: { ...DEF_META.upgrades, ...d.upgrades },
          settings: { ...DEF_META.settings, ...d.settings },
          best: { ...DEF_META.best, ...d.best },
          chars: { vektor: true, ...(d.chars || {}) },
          board: Array.isArray(d.board) ? d.board : [],
          char: d.char || 'vektor',
        };
      }
    } catch (e) { }
    return JSON.parse(JSON.stringify(DEF_META));
  })();
  const save = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(META)); } catch (e) { } };
  const upVal = id => META.upgrades[id] || 0;
  // v2.12 (hedef F): haptic tek nokta — önce Expo kabuğu NATIVE_BRIDGE.haptic (RN Vibration;
  // WKWebView'de navigator.vibrate çalışmaz), köprü yoksa/hata verirse web fallback.
  // routeNative disiplini: köprü true dönerse fallback atlanır (çift titreşim yok).
  const vib = pattern => { try { if (!META.settings.haptics) return; CORE.routeNative(window.NATIVE_BRIDGE, 'haptic', pattern, () => { if (navigator.vibrate) navigator.vibrate(pattern); }); } catch (e) { } };

  // ==================== İÇERİK TANIMLARI ====================
  const UPGRADES = [
    { id: 'hp',  name: 'YAPI DAYANIKLILIĞI', desc: '+12 maks can / seviye',        max: 5, cost: l => 60 + l * 95 },
    { id: 'dmg', name: 'ATEŞ GÜCÜ',          desc: '+8% toplam hasar / seviye',    max: 5, cost: l => 80 + l * 120 },
    { id: 'spd', name: 'İTKİ MOTORU',        desc: '+6% hareket hızı / seviye',    max: 5, cost: l => 70 + l * 110 },
    { id: 'mag', name: 'MIKNATIS ALANI',     desc: '+22% toplama alanı / seviye',  max: 5, cost: l => 50 + l * 80 },
    { id: 'rfr', name: 'SOĞUTMA SİSTEMİ',    desc: '-5% silah bekleme / seviye',   max: 5, cost: l => 90 + l * 130 },
    { id: 'rev', name: 'YEDEK ÇEKİRDEK',     desc: '+1 otomatik diriliş hakkı',    max: 2, cost: l => 400 + l * 650 },
  ];

  const ACHS = [
    { id: 'firstblood', name: 'İLK TEMAS',      desc: 'İlk düşmanını yok et',     coins: 25,  check: s => s.kills >= 1 },
    { id: 'k100',       name: 'FIRTINA BAŞLIYOR', desc: '100 düşman yok et',      coins: 60,  check: s => s.kills >= 100 },
    { id: 'k1000',      name: 'EFSANE AVCI',    desc: '1.000 düşman yok et',      coins: 200, check: s => s.kills >= 1000 },
    { id: 't2',         name: 'ISINIYORUM',     desc: '2 dakika hayatta kal',     coins: 40,  check: s => s.time >= 120 },
    { id: 't5',         name: 'FIRTINA GEÇTİ',  desc: '5 dakika hayatta kal',     coins: 100, check: s => s.time >= 300 },
    { id: 't10',        name: 'ÖLÜMSÜZ',        desc: '10 dakika hayatta kal',    coins: 300, check: s => s.time >= 600 },
    { id: 'lv10',       name: 'EVRİM',          desc: 'Seviye 10 ulaş',           coins: 50,  check: s => s.level >= 10 },
    { id: 'lv20',       name: 'AŞIRI YÜK',      desc: 'Seviye 20 ulaş',           coins: 120, check: s => s.level >= 20 },
    { id: 'boss1',      name: 'DEV AVCISI',     desc: 'Bir boss yok et',          coins: 150, check: s => s.bossKills >= 1 },
    { id: 'evo1',       name: 'TRANSANDANS',    desc: 'Bir silah evrimleştir',    coins: 250, check: s => s.evolutions >= 1 },
  ];

  const WMAX = 8;
  const WEAPONS = {
    pulse:  { name: 'NEON PULSE',       icon: '✦', color: '#22d3ee', desc: 'En yakın hedefe otomatik plazma atışı.', evPassive: 'dmg',   evoName: 'NEON SURGE',   evoDesc: 'Atışlar 3 düşmanı deler.' },
    blades: { name: 'YÖRÜNGE KILIÇLARI', icon: '✧', color: '#7dffa8', desc: 'Etrafında dönen keskin plazma kılıçlar.', evPassive: 'speed', evoName: 'SAWSTORM',    evoDesc: 'Daha büyük ve hızlı kılıçlar.' },
    nova:   { name: 'NOVA PATLAMASI',   icon: '◎', color: '#fbbf24', desc: 'Periyodik şok dalgası — alan hasarı.',   evPassive: 'hp',    evoName: 'SUPERNOVA',   evoDesc: 'Çok daha geniş yıkım yarıçapı.' },
    chain:  { name: 'ŞİMŞEK ZİNCİRİ',   icon: '↯', color: '#a78bfa', desc: 'Düşmanlar arasında zıplayan elektrik.',  evPassive: 'frate', evoName: 'TEMPEST',     evoDesc: 'Zıplama sayısı iki katına çıkar.' },
    frost:  { name: 'BUZ ALANI',        icon: '❋', color: '#67e8f9', desc: 'Yavaşlatan dondurucu aura.',             evPassive: 'magnet', evoName: 'MUTLAK SIFIR', evoDesc: 'Düşmanlar %60 yavaşlar.' },
    missile:{ name: 'GÜDÜMLÜ FÜZE',     icon: '➤', color: '#fb7185', desc: 'Hedefini kovalayan patlayıcı füzeler.',  evPassive: 'regen', evoName: 'FIRTINA SÜRÜSÜ', evoDesc: 'Aynı anda iki füze atılır.' },
  };
  const PASSIVES = {
    dmg:    { name: 'GÜÇ ÇEKİRDEĞİ', desc: '+10% hasar',          icon: '◆', color: '#f87171' },
    frate:  { name: 'AŞIRI YÜKLEME', desc: '-6% bekleme süresi',  icon: '◈', color: '#fbbf24' },
    speed:  { name: 'İTKİ',          desc: '+8% hareket hızı',    icon: '▲', color: '#7dffa8' },
    hp:     { name: 'ZIRH PLAKASI',  desc: '+16 maks can',        icon: '■', color: '#60a5fa' },
    magnet: { name: 'MIKNATIS',      desc: '+25% toplama alanı',  icon: '●', color: '#c084fc' },
    regen:  { name: 'NANO ONARIM',   desc: '+0.6 can/sn',         icon: '✚', color: '#34d399' },
  };

  const ETYPES = {
    grunt:   { hp: 16,  sp: 74,  r: 13, dmg: 8,  color: '#ff4d6d', sc: 10,  xp: 1,  coin: 0.25 },
    swarm:   { hp: 8,   sp: 128, r: 9,  dmg: 5,  color: '#ffb84d', sc: 6,   xp: 1,  coin: 0.2 },
    tank:    { hp: 95,  sp: 34,  r: 22, dmg: 16, color: '#c77dff', sc: 30,  xp: 4,  coin: 1 },
    shooter: { hp: 26,  sp: 52,  r: 12, dmg: 10, color: '#38bdf8', sc: 20,  xp: 2,  coin: 0.5, ranged: true },
    splitter:{ hp: 34,  sp: 62,  r: 15, dmg: 9,  color: '#7dffa8', sc: 18,  xp: 2,  coin: 0.4, split: 'mini' },
    mini:    { hp: 9,   sp: 100, r: 7,  dmg: 4,  color: '#a7f3d0', sc: 4,   xp: 1,  coin: 0.1 },
    boss:    { hp: 900,  sp: 42, r: 40, dmg: 26, color: '#ff2d55', sc: 600, xp: 30, coin: 12, boss: true,
               shootCd: 2.6, bullets: 10, bulletSp: 150, bulletDmg: 12 },
    // v2.9 boss çeşitliliği: panzer = yavaş tank duvar, bombacı = hızlı mermi yağmuru (CORE.ETYPES ile birebir)
    panzer:  { hp: 1500, sp: 26, r: 46, dmg: 30, color: '#ff6b6b', sc: 750, xp: 36, coin: 14, boss: true,
               shootCd: 3.0, bullets: 12, bulletSp: 130, bulletDmg: 14 },
    bombaci: { hp: 700,  sp: 60, r: 34, dmg: 22, color: '#ffd166', sc: 700, xp: 33, coin: 13, boss: true,
               shootCd: 1.7, bullets: 16, bulletSp: 190, bulletDmg: 10 },
    // v2.14 3. boss: şaman = çevre iyileştirme (CORE.ETYPES ile birebir; heal tablosu tablo sürüşlü)
    shaman:  { hp: 1000, sp: 46, r: 36, dmg: 24, color: '#a3e635', sc: 720, xp: 34, coin: 13, boss: true,
               shootCd: 2.2, bullets: 8, bulletSp: 160, bulletDmg: 10,
               heal: { r: 260, pct: 0.05, cd: 3.0 } },
  };

  // ==================== RUN DURUMU ====================
  let run = null;
  let menuT = 0;

  const xpNeed = l => Math.floor(5 + (l - 1) * 3 + Math.pow(l, 1.55) * 1.6);

  function newRun() {
    const CH = META2.CHARS[META.char] || CORE.CHARS[META.char] || CORE.CHARS.vektor;
    const mods = CH.mods || {};
    const wArr = CH.weapons || ['pulse'];
    const m2 = META2.runMods(META.char);
    const pend = META2.takePending();
    run = {
      t: 0, spawnT: 0.2, bossT: pend.dungeonCfg && pend.dungeonCfg.bossEvery ? pend.dungeonCfg.bossEvery : 90, bossWarn: 0,
      firstDrop: false, // v2.8: ilk ekipman kasası (t=120 garanti)
      m2, stageCfg: pend.stageCfg || null, dungeonCfg: pend.dungeonCfg || null,
      stageResult: null, dungeonResult: null,
      mod: pend.stageCfg ? { hpMul: pend.stageCfg.hpMul, dmgMul: pend.stageCfg.dmgMul, spawnMul: pend.stageCfg.spawnMul }
        : (pend.dungeonCfg ? { hpMul: 1, dmgMul: 1, spawnMul: 1.6 } : null),
      char: META.char,
      charMods: mods,
      favLeft: 3, // v2.13: ilk 3 kart seçiminde pilot favori garantisi
      player: {
        x: 0, y: 0, r: 13,
        hp: Math.floor((100 + upVal('hp') * 12) * (mods.hp || 1) * m2.hp),
        maxhp: Math.floor((100 + upVal('hp') * 12) * (mods.hp || 1) * m2.hp),
        speed: 215 * (mods.spd || 1) * m2.spd, level: 1, xp: 0, xpNext: xpNeed(1), regen: m2.regen, inv: 0,
        face: 0, moving: false,
        weapons: wArr.map((id, i) => ({ id, lvl: 1 + (i === 0 && mods.startLvl ? mods.startLvl : 0), cd: i === 0 ? 0.3 : 0.8, evo: false, ang: rand(0, TAU) })),
        passives: {}, revives: upVal('rev'),
      },
      enemies: [], bullets: [], ebullets: [], gems: [], coins: [],
      rings: [], bolts: [], missiles: [], marks: [],   // v2.28 marks: kasa açılış kalıcı izi (yerde sönen paten — juice 3. halka)
      cratesOpened: 0,                     // v2.29: bu koşuda açılan kasa sayısı — ölüm ekranı satırı (hedef B+E)
      kills: 0, bossKills: 0, evolutions: 0, score: 0,
      milestones: [],                      // v2.15 radar: [{id,t}] — ilk av/seviye/boss + ölüm
      combo: 0, comboT: 0, coinsEarned: 0,
      reviveUsed: false, counted: false, x2Used: false,
      pendingLevels: 0, choices: [], rerollUsed: false,
      achT: 0, runId: Math.random(),
    };
    return run;
  }

  const p = () => run.player;
  // v2.15 (hedef E/G): ilk 90 sn radarı — koşu olay damgası (her id bir kez; ANLT'ye de gider)
  function mstone(id) {
    if (!run || run.milestones.some(m => m.id === id)) return;
    const m = { id, t: Math.round(run.t) };
    run.milestones.push(m);
    // v2.16: mod etiketi — zindan bossu (12sn) normal beklentisi (90sn) kirletmesin (kalibrasyon dersi)
    ANLT.track('milestone', { mid: id, t: m.t, mode: run.dungeonCfg ? 'zindan' : 'normal' });
  }
  const hasEvo = id => { const w = run.player.weapons.find(w => w.id === id); return !!(w && w.evo); };

  // ==================== DOĞUŞ (SPAWN) ====================
  function spawnPool(t) {
    const pool = ['grunt', 'grunt', 'grunt'];
    if (t > 50) pool.push('swarm', 'swarm');
    if (t > 110) pool.push('tank');
    if (t > 150) pool.push('shooter');
    if (t > 210) pool.push('splitter');
    return pool;
  }

  function spawnEnemy(type, x, y) {
    const T = ETYPES[type];
    if (x === undefined) {
      const a = rand(0, TAU), R = Math.hypot(ENG.W(), ENG.H()) / 2 + 70;
      x = p().x + Math.cos(a) * R; y = p().y + Math.sin(a) * R;
    }
    const elite = run.t > 300 && type !== 'mini' && Math.random() < 0.06;
    const hpS = 1 + run.t / 42, dmgS = 1 + run.t / 160, spS = Math.min(1.35, 1 + run.t / 900);
    const hp = T.hp * hpS * (elite ? 4 : 1) * (run.mod ? run.mod.hpMul : 1);
    run.enemies.push({
      type, x, y, r: T.r * (elite ? 1.35 : 1), hp, maxhp: hp,
      sp: T.sp * spS * (elite ? 0.9 : 1), dmg: T.dmg * dmgS * (run.mod ? run.mod.dmgMul : 1), elite,
      boss: !!T.boss, // v2.7 KÖK FIX: T.boss kopyalanmıyordu → killEnemy boss dalı, coin yağmuru, 3×XP,
                      // QUESTS 'boss', bossKills ve başarım sessizce çalışmıyordu
      phase: rand(0, TAU), hitCd: 0, slow: 0, shootT: rand(1, 2.5), bladeCd: 0,
      healT: rand(1.5, 3), // v2.14: şaman şifa atımı sayacı (ilk atım erken gelmesin)
    });
  }

  function spawnTick(dt) {
    run.spawnT -= dt;
    if (run.spawnT > 0) return;
    run.spawnT = CORE.spawnInterval(run.t) * EXP.factor('spawn_pace') / (run.mod ? run.mod.spawnMul : 1);
    if (run.enemies.length > 240) return;
    // v2.8 (hedef E): CORE.spawnCount ilk 30 sn'de garanti akış (>=2) verir
    const n = CORE.spawnCount(run.t) + irand(0, 2);
    const pool = spawnPool(run.t);
    for (let i = 0; i < n; i++) spawnEnemy(pool[irand(0, pool.length - 1)]);
  }

  // ==================== DÜŞMAN GÜNCELLEME ====================
  function updEnemies(dt) {
    const pl = p();
    for (let i = run.enemies.length - 1; i >= 0; i--) {
      const e = run.enemies[i];
      const T = ETYPES[e.type];
      if (e.slow > 0) e.slow -= dt;
      const sf = e.slow > 0 ? (hasEvo('frost') ? 0.4 : 0.62) : 1;
      const a = Math.atan2(pl.y - e.y, pl.x - e.x);
      let mx = Math.cos(a) * e.sp * sf, my = Math.sin(a) * e.sp * sf;

      if (T.ranged) {
        const d = Math.hypot(pl.x - e.x, pl.y - e.y);
        if (d < 230) { mx *= -0.7; my *= -0.7; }
        e.shootT -= dt;
        if (e.shootT <= 0 && d < 560) {
          e.shootT = 2.4;
          run.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 175, vy: Math.sin(a) * 175, r: 5, dmg: e.dmg, life: 4 });
        }
      }
      if (e.type === 'swarm') { e.phase += dt * 6; mx += Math.cos(e.phase) * 42; my += Math.sin(e.phase) * 42; }
      // v2.14 şaman (hedef E/F): çevre düşmanları periyodik iyileştirir — tablo sürüşlü (T.heal).
      // Oyuncu cezası: alan kontrolü olmadan sürü kilitlenir → nova/frost önceliği, şamanı önce kes.
      if (T.heal) {
        e.healT -= dt;
        if (e.healT <= 0) {
          e.healT = T.heal.cd;
          let healed = 0;
          for (const o of run.enemies) {
            if (o === e || o.dead || o.boss) continue;
            if (dist2(o.x, o.y, e.x, e.y) < T.heal.r * T.heal.r && o.hp < o.maxhp) {
              o.hp = Math.min(o.maxhp, o.hp + o.maxhp * T.heal.pct);
              healed++;
              if (healed <= 6) ftext(o.x, o.y - o.r - 4, '+', '#4ade80', 12, 0.5);
            }
          }
          if (healed) {
            run.rings.push({ x: e.x, y: e.y, r: 8, R: T.heal.r, life: 0.35, max: 0.35, spd: 300, color: '#4ade80' });
            ftext(e.x, e.y - e.r - 10, 'ŞİFA', '#4ade80', 13, 0.8);
            AUDIO.sfx('gem');
          }
        }
      }
      if (T.boss) {
        // v2.9: üç boss tipi de tablo sürücülü (shootCd/bullets/bulletSp) — varyant davranışı
        e.phase += dt; e.shootT -= dt;
        if (e.shootT <= 0) {
          e.shootT = T.shootCd || 2.6;
          const nb = T.bullets || 10, bs = T.bulletSp || 150, bd = T.bulletDmg || 12;
          for (let k = 0; k < nb; k++) {
            const b = (k / nb) * TAU + e.phase;
            run.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(b) * bs, vy: Math.sin(b) * bs, r: 6, dmg: bd, life: 5 });
          }
          shake(4); AUDIO.sfx('zap');
        }
      }
      e.x += mx * dt; e.y += my * dt;
      if (e.hitCd > 0) e.hitCd -= dt;
      if (e.bladeCd > 0) e.bladeCd -= dt;

      const rr = e.r + pl.r;
      if (dist2(e.x, e.y, pl.x, pl.y) < rr * rr && e.hitCd <= 0) {
        e.hitCd = 0.55;
        damagePlayer(e.dmg);
        e.x -= Math.cos(a) * 6; e.y -= Math.sin(a) * 6;
      }
    }
  }

  // ==================== HASAR ====================
  function damagePlayer(d) {
    const pl = p();
    if (pl.inv > 0 || state.mode !== 'play') return;
    pl.hp -= d;
    pl.inv = 0.4;
    flash('#f43f5e', 0.14); shake(5); vib(45);
    AUDIO.sfx('hurt');
    burst(pl.x, pl.y, '#fb7185', 10, 200, 0.4, 3);
    if (pl.hp <= 0) {
      if (pl.revives > 0) {
        pl.revives--; pl.hp = pl.maxhp * 0.6; pl.inv = 2.5;
        AUDIO.sfx('revive'); UI.toast('YEDEK ÇEKİRDEK AKTİF', 'info');
        flash('#fbbf24', 0.4); vib([40, 30, 40]);  // JUICE 3. KALEM (v2.30): aynı mikro-sekans — iki yol tutarlı
        for (let i = run.enemies.length - 1; i >= 0; i--) {
          const e = run.enemies[i];
          if (dist2(e.x, e.y, pl.x, pl.y) < 420 * 420) {
            burst(e.x, e.y, ETYPES[e.type].color, 8, 220, 0.4, 3);
            run.enemies.splice(i, 1);
          }
        }
        shake(12, 0.5);
      } else {
        pl.hp = 0;
        gameOver();
      }
    }
  }

  function damageEnemy(e, dmg, crit) {
    e.hp -= dmg;
    AUDIO.sfx('hit');
    // v2.29 (hedef F): kritik vuruş GÖRÜNÜR — yüzük criti (m2.crit) bugüne kadar sayıda gizliydi;
    // kritik: kırmızı + '!' + mikro-hitstop (godot punch deseni), normal beyaz, elite altın korunur
    if (crit) {
      ftext(e.x, e.y - e.r - 6, Math.round(dmg) + '!', '#f43f5e', e.boss ? 22 : 16, 0.7);
      hitstop(0.03);
    }
    else ftext(e.x, e.y - e.r - 6, String(Math.round(dmg)),
      e.elite ? '#fbbf24' : '#fff', e.boss ? 18 : 13, 0.55);
    if (e.hp <= 0 && !e.dead) { e.dead = true; killEnemy(e); }
  }

  function killEnemy(e) {
    const T = ETYPES[e.type];
    run.kills++;
    if (run.kills === 1) mstone('ilk_av');
    QUESTS.onEvent('kill', 1);
    if (e.boss) { QUESTS.onEvent('boss', 1); ANLT.track('boss_kill', { t: Math.floor(run.t) }); vib([60, 40, 60]); }
    run.combo++; run.comboT = 3;
    run.score += Math.round(T.sc * (1 + run.combo * 0.02));
    burst(e.x, e.y, T.color, e.boss ? 60 : (e.elite ? 18 : 8), e.boss ? 340 : 170, 0.5, e.boss ? 5 : 3);
    if (e.boss) {
      // v2.7 boss kill juice (hedef F, godot hitstop deseni): don → beyaz flaş → büyük sarsıntı → haptic dizi
      shake(14, 0.6); AUDIO.sfx('bossDown');
      flash('#ffffff', 0.18);
      ftext(e.x, e.y - 70, 'BOSS AVLANDI!', '#fbbf24', 24, 1.4);
      run.bossKills++;
      hitstop(0.12);
      vib([30, 40, 80]);
      // v2.25: HER 2. BOSSA kasa — koşu #21 ölçümü (balance_sim.bossCrateFlow): tam sıklık tam-SSR
      // fusion 8 günde (< 10 gün eşiği — ⬡ taş hattının bedava-yavaş/⬡-hızlı ayrımını ezer);
      // yarı sıklık 10 gün ✓. bossKills % 2 === 1 → İLK kill garanti (90sn boss ödülü taçlanır),
      // sonra her 2.'de bir. Evo sinyali dropCrate'ten bedava gelir (zincir aynı kapıdan).
      if (run.bossKills % 2 === 1) dropCrate(e.x, e.y, true);
    } else AUDIO.sfx('kill');
    dropGem(e.x, e.y, T.xp * (e.elite ? 3 : 1) * (e.boss ? 3 : 1));
    if (e.boss) { for (let k = 0; k < 5; k++) dropCoin(e.x + rand(-40, 40), e.y + rand(-40, 40), 3); }
    else if (Math.random() < T.coin) dropCoin(e.x, e.y, 1);
    if (T.split) for (let k = 0; k < 2; k++) spawnEnemy(T.split, e.x + rand(-14, 14), e.y + rand(-14, 14));
  }

  function dropGem(x, y, v) {
    run.gems.push({ x: x + rand(-6, 6), y: y + rand(-6, 6), v, r: 8 });
    if (run.gems.length > 260) { const g = run.gems.shift(); p().xp += g.v; }
  }
  function dropCoin(x, y, v) {
    run.coins.push({ x: x + rand(-6, 6), y: y + rand(-6, 6), v, r: 7, t: rand(0, TAU) });
  }
  // v2.8 (hedef E): ilk ekipman kasası — 2. dakikada garantili düşer, toplayan parçayı alır
  // v2.23 (hedef E+B): kasa evo bayrağı taşır — evo-ready oyuncu için sinyalli kasa (mor kapak)
  // v2.24 (hedef B+E, istihbarat #1 devam): boss bayrağı — kasa ailesi büyüdü (boss kill kasası);
  // evo sinyali tek noktadan dropCrate'e bağlı: boss kasası da mor kapak + toast zincirinden geçer
  function dropCrate(x, y, boss) {
    const pl = p();
    const er = CORE.evoReady(pl.weapons, pl.passives, WEAPONS);
    run.coins.push({ x, y, v: 0, r: 13, t: rand(0, TAU), crate: true, evo: er.ready, evoId: er.id, boss: !!boss });
    ftext(x, y - 26, boss ? 'BOSS KASASI!' : 'EPMAN KUTUSU!', '#fbbf24', boss ? 17 : 16, 1.4);
    AUDIO.sfx('buy'); vib([20, 40, 20]);
  }

  // ==================== TOPLANABİLİRLER ====================
  function updPickups(dt) {
    const pl = p();
    const mag = (80 * (1 + 0.22 * upVal('mag'))) * (1 + 0.25 * (pl.passives.magnet || 0)) * (run.m2 ? run.m2.mag : 1);
    for (let i = run.gems.length - 1; i >= 0; i--) {
      const g = run.gems[i];
      const d2 = dist2(g.x, g.y, pl.x, pl.y);
      if (d2 < mag * mag) {
        const d = Math.sqrt(d2) || 1;
        g.x += (pl.x - g.x) / d * 460 * dt; g.y += (pl.y - g.y) / d * 460 * dt;
        g.pull = true;                                        // v2.32: çekim sahada görünür
      } else g.pull = false;
      if (d2 < 26 * 26) {
        run.gems.splice(i, 1);
        pl.xp += g.v; AUDIO.sfx('gem');
        burst(g.x, g.y, '#67e8f9', 4, 120, 0.3, 2);
      }
    }
    for (let i = run.coins.length - 1; i >= 0; i--) {
      const c = run.coins[i];
      const d2 = dist2(c.x, c.y, pl.x, pl.y);
      if (d2 < mag * 1.6 * (mag * 1.6)) {
        const d = Math.sqrt(d2) || 1;
        c.x += (pl.x - c.x) / d * 520 * dt; c.y += (pl.y - c.y) / d * 520 * dt;
        c.pull = true;                                        // v2.32: çekim sahada görünür
      } else c.pull = false;
      if (d2 < 26 * 26) {
        run.coins.splice(i, 1);
        if (c.crate) {
          // v2.8: kasa → garantili normal (N) ekipman parçası + sesli kutlama
          // v2.31 (hedef B): kaynak etiketi — itemLog'a BOSS/koşu ayrımıyla girer
          const it = META2.grantItem('N', c.boss ? 'BOSS kasası' : 'koşu kasası');
          ftext(pl.x, pl.y - 34, (c.boss ? 'BOSS KASASI: ' : '') + (it && it.name ? it.name : 'EPMAN') + ' KAZANDIN', '#fbbf24', 15, 1.6);
          // v2.23 (hedef E+B): kasa açılışında EVRİME HAZİR sinyali (istihbarat #1) —
          // ensureEvo garantisi sonraki SVY kartında EVRİM olarak oyuncuya görünür
          const er = CORE.evoReady(pl.weapons, pl.passives, WEAPONS);
          if (er.ready) UI.toast('EVRİME HAZİR — sonraki SVY kartında EVRİM GARANTİLİ!', 'info');
          else UI.toast((c.boss ? 'BOSS KASASI' : 'İLK EKİPMAN') + ': EKİPMAN panelinden kuşan!', 'info');
          // v2.28 (hedef F — juice, drop+pickup zincirinin 3. halkası): KATMANLI kutlama —
          // (1) yerde kalıcı iz (marks: ~6 sn sönen paten — sahnada iz kalır),
          // (2) mevcut ana patlama korunur, (3) hızlı ikinci dalga, (4) negatif grav yükselen kor.
          // İz rengi v2.25 hiyerarşisi: evo mor > boss altın > normal camgöbeği.
          run.marks.push({ x: c.x, y: c.y, r: 14, life: 6, max: 6, color: c.evo ? '#a78bfa' : (c.boss ? '#fbbf24' : '#22d3ee') });
          if (run.marks.length > 24) run.marks.shift(); // sahne birikmez
          burst(c.x, c.y, c.evo ? '#a78bfa' : '#fbbf24', 16, 200, 0.5, 4);
          burst(c.x, c.y, '#fff7d6', 12, 330, 0.65, 3);            // hızlı ikinci dalga
          burst(c.x, c.y, c.evo ? '#c4b5fd' : '#fde68a', 8, 80, 1.2, 2.5, -140); // yükselen kor
          shake(c.boss ? 8 : 5); AUDIO.sfx('bossDown'); vib([30, 50, 90]);
          ANLT.track('first_item', { t: Math.floor(run.t), evo: !!er.ready, boss: !!c.boss }); // v2.24: kaynak etiketi (v2.16 bağlam dersi)
          run.cratesOpened++;                  // v2.29: ölüm ekranı 'BU KOŞUDA N KASA AÇTIN' kaynağı
          continue;
        }
        run.coinsEarned += c.v;
        QUESTS.onEvent('coin', c.v);
        AUDIO.sfx('coin');
        burst(c.x, c.y, '#fbbf24', 5, 130, 0.3, 2);
      }
    }
  }

  // ==================== OYUNCU ====================
  function updPlayer(dt) {
    const pl = p();
    let dx = 0, dy = 0;
    if (keys.KeyW || keys.ArrowUp) dy -= 1;
    if (keys.KeyS || keys.ArrowDown) dy += 1;
    if (keys.KeyA || keys.ArrowLeft) dx -= 1;
    if (keys.KeyD || keys.ArrowRight) dx += 1;
    if (joy.active) { dx += joy.dx; dy += joy.dy; }
    const len = Math.hypot(dx, dy);
    pl.moving = len > 0.08;
    if (pl.moving) {
      dx /= len; dy /= len;
      const sp = pl.speed * (1 + 0.06 * upVal('spd')) * (1 + 0.08 * (pl.passives.speed || 0));
      pl.x += dx * sp * dt; pl.y += dy * sp * dt;
      pl.face = Math.atan2(dy, dx);
      if (Math.random() < 0.5) burst(pl.x - dx * 10, pl.y - dy * 10, '#22d3ee', 1, 60, 0.25, 2);
    }
    if (pl.inv > 0) pl.inv -= dt;
    const rg = 0.6 * (pl.passives.regen || 0) + (run.m2 ? run.m2.regen : 0);
    if (rg > 0 && pl.hp < pl.maxhp) pl.hp = Math.min(pl.maxhp, pl.hp + rg * dt);
  }

  function checkLevel() {
    const pl = p();
    while (pl.xp >= pl.xpNext) {
      pl.xp -= pl.xpNext;
      pl.level++;
      pl.xpNext = xpNeed(pl.level);
      run.pendingLevels++;
      if (pl.level === 2) mstone('ilk_seviye');      // v2.15 radar: ilk seviye atlama
      QUESTS.onEvent('level', pl.level);
      vib(30);
    }
    if (run.pendingLevels > 0 && state.mode === 'play') openLevelUp();
  }

  // ==================== GÜNCELLEME ====================
  function update(dt) {
    // aşama/zindan süre kontrolü — başarıyla bitiş
    if (run.stageCfg && run.t >= run.stageCfg.duration) { stageClear(); return; }
    if (run.dungeonCfg && run.t >= run.dungeonCfg.duration) { dungeonEnd(); return; }
    run.t += dt;
    updPlayer(dt);
    spawnTick(dt);
    // v2.8 (hedef E): 2. dakikada garantili ilk ekipman kasası — ekipmansız ilerleme hissi kalmasın
    if (!run.firstDrop && run.t >= CORE.FIRST_ITEM_T) {
      run.firstDrop = true;
      dropCrate(p().x + 70, p().y);
    }
    updEnemies(dt);
    updWeapons(dt);
    updBullets(dt);
    updPickups(dt);
    updFx(dt);
    checkLevel();

    if (run.comboT > 0) { run.comboT -= dt; if (run.comboT <= 0) run.combo = 0; }

    // boss zamanlayıcı
    run.bossT -= dt;
    if (run.bossT <= 3 && run.bossWarn <= 0 && run.bossT > 0) { run.bossWarn = run.bossT; }
    if (run.bossWarn > 0) run.bossWarn -= dt;
    if (run.bossT <= 0) {
      run.bossT = run.dungeonCfg && run.dungeonCfg.bossEvery ? run.dungeonCfg.bossEvery : 90; run.bossWarn = 0;
      const bid = CORE.pickBoss();                     // v2.14: üçlü çekiliş — panzer / bombacı / şaman (%33)
      spawnEnemy(bid);
      mstone('ilk_boss');                              // v2.15 radar: ilk boss teması
      AUDIO.sfx('boss'); shake(3, 0.18); vib([40, 30, 60]);
      ftext(p().x, p().y - 120, 'BOSS: ' + (CORE.BOSS_NAMES[bid] || 'DEV') + ' · ÖDÜL ZAMANI!', '#fbbf24', 24, 1.2);   // v2.15: boss türü artık görünür
    }

    // uzamsal karma
    hash.clear();
    for (const e of run.enemies) hash.insert(e);

    // düşman cesetlerini temizle
    for (let i = run.enemies.length - 1; i >= 0; i--) {
      if (run.enemies[i].dead) run.enemies.splice(i, 1);
    }

    // başarımlar (1sn'de bir)
    run.achT -= dt;
    if (run.achT <= 0) {
      run.achT = 1;
      checkAchievements();
      QUESTS.onEvent('time', Math.floor(run.t));
    }
  }

  function updFx(dt) {
    ENG.updateParts(dt); ENG.updateTexts(dt);
    // v2.28: kasa izi ömrü — yavaş söner (6 sn), sahnede birikmez
    for (let i = run.marks.length - 1; i >= 0; i--) {
      const m = run.marks[i]; m.life -= dt;
      if (m.life <= 0) run.marks.splice(i, 1);
    }
    for (let i = run.rings.length - 1; i >= 0; i--) {
      const r = run.rings[i]; r.life -= dt; r.r += r.spd * dt;
      if (r.life <= 0) run.rings.splice(i, 1);
    }
    for (let i = run.bolts.length - 1; i >= 0; i--) {
      const b = run.bolts[i]; b.life -= dt;
      if (b.life <= 0) run.bolts.splice(i, 1);
    }
  }

  function updBullets(dt) {
    const pl = p();
    // oyuncu mermileri
    for (let i = run.bullets.length - 1; i >= 0; i--) {
      const b = run.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) { run.bullets.splice(i, 1); continue; }
      hash.query(b.x, b.y, b.r + 30, qbuf);
      let removed = false;
      for (const e of qbuf) {
        if (e.dead) continue;
        const rr = e.r + b.r;
        if (dist2(b.x, b.y, e.x, e.y) < rr * rr) {
          damageEnemy(e, b.dmg, b.crit);
          burst(b.x, b.y, b.color, 3, 110, 0.25, 2);
          b.pierce--;
          if (b.pierce <= 0) {
            run.bullets.splice(i, 1); removed = true;
            break;
          }
        }
      }
      if (removed) continue;
    }
    // düşman mermileri
    for (let i = run.ebullets.length - 1; i >= 0; i--) {
      const b = run.ebullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      if (b.life <= 0) { run.ebullets.splice(i, 1); continue; }
      const rr = b.r + pl.r;
      if (dist2(b.x, b.y, pl.x, pl.y) < rr * rr) {
        run.ebullets.splice(i, 1);
        damagePlayer(b.dmg);
      }
    }
    if (run.bullets.length > 320) run.bullets.splice(0, run.bullets.length - 320);
  }

  // ==================== SİLAHLAR ====================
  function cdMul() {
    const pl = p();
    return Math.max(0.4, (1 - 0.05 * upVal('rfr')) * (1 - 0.06 * (pl.passives.frate || 0)));
  }
  function wdmg(id) {
    const base = { pulse: 11, nova: 24, chain: 16, missile: 32 }[id] || 10;
    const w = p().weapons.find(w => w.id === id);
    let d = base * (1 + 0.22 * (w.lvl - 1));
    d *= (1 + 0.08 * upVal('dmg')) * (1 + 0.10 * (p().passives.dmg || 0));
    const m2 = run.m2 || { dmg: 1, crit: 0 };
    d *= m2.dmg;
    wlastCrit = Math.random() < m2.crit;   // v2.29: crit bayrağı vuruş kaynağına taşınır (projeye/fire anında)
    if (wlastCrit) d *= 2;                 // ekipman kritiği (yüzük)
    return d;
  }
  let wlastCrit = false;                   // v2.29: son wdmg çağrısının crit durumu (sıralı çağrıcılar hemen okur)
  function wcd(id, lvl) {
    const base = { pulse: 0.55, nova: 3.2, chain: 1.6, missile: 2.4 }[id] || 1;
    return Math.max(0.12, base * Math.pow(0.93, lvl - 1));
  }
  function nearestEnemy(x, y, maxD) {
    let best = null, bd = maxD * maxD;
    for (const e of run.enemies) {
      if (e.dead) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  function updWeapons(dt) {
    const pl = p();
    const m = cdMul();
    for (const w of pl.weapons) {
      if (w.id === 'blades') { updBlades(w, dt); continue; }
      if (w.id === 'frost') { updFrost(w, dt); continue; }
      if (w.id === 'missile') { updMissiles(dt); }
      w.cd -= dt;
      if (w.cd <= 0) { fire(w, m); w.cd = wcd(w.id, w.lvl) / (w.evo ? 1.15 : 1); }
    }
  }

  function fire(w, m) {
    const pl = p();
    if (w.id === 'pulse') {
      const tgt = nearestEnemy(pl.x, pl.y, 640);
      const n = 1 + Math.floor((w.lvl - 1) / 2);
      const baseA = tgt ? Math.atan2(tgt.y - pl.y, tgt.x - pl.x) : pl.face;
      for (let i = 0; i < n; i++) {
        const a = baseA + (i - (n - 1) / 2) * 0.14;
        run.bullets.push({
          x: pl.x, y: pl.y, vx: Math.cos(a) * 560, vy: Math.sin(a) * 560,
          r: 5, dmg: wdmg('pulse'), crit: wlastCrit, pierce: w.evo ? 3 : 1, life: 1.3, color: '#22d3ee',
        });
      }
      AUDIO.sfx('shoot');
    }
    else if (w.id === 'nova') {
      let R = 120 + w.lvl * 16;
      if (w.evo) R *= 1.6;
      run.rings.push({ x: pl.x, y: pl.y, r: 14, R, life: 0.35, max: 0.35, spd: (R - 14) / 0.35, color: '#fbbf24' });
      hash.query(pl.x, pl.y, R, qbuf);
      let hits = 0;
      for (const e of qbuf) {
        if (e.dead) continue;
        if (dist2(pl.x, pl.y, e.x, e.y) < (R + e.r) * (R + e.r)) { damageEnemy(e, wdmg('nova'), wlastCrit); hits++; }
      }
      if (hits > 4) hitstop(0.04);
      AUDIO.sfx('nova');
    }
    else if (w.id === 'chain') {
      let cur = nearestEnemy(pl.x, pl.y, 400);
      if (!cur) return;
      let jumps = 2 + Math.floor(w.lvl / 2);
      if (w.evo) jumps *= 2;
      const pts = [{ x: pl.x, y: pl.y }];
      const hitSet = new Set();
      let dmg = wdmg('chain');
      for (let j = 0; j < jumps && cur; j++) {
        pts.push({ x: cur.x, y: cur.y });
        hitSet.add(cur);
        damageEnemy(cur, dmg, wlastCrit);   // zincir tek roll: ilk hit crit bayrağı zincir boyunca taşınır
        dmg *= 0.85;
        let next = null, bd = 230 * 230;
        for (const e of run.enemies) {
          if (e.dead || hitSet.has(e)) continue;
          const d = dist2(cur.x, cur.y, e.x, e.y);
          if (d < bd) { bd = d; next = e; }
        }
        cur = next;
      }
      run.bolts.push({ pts, life: 0.13, max: 0.13 });
      AUDIO.sfx('zap');
    }
    else if (w.id === 'missile') {
      const n = w.evo ? 2 : 1;
      for (let i = 0; i < n; i++) {
        const tgt = nearestEnemy(pl.x + rand(-200, 200), pl.y + rand(-200, 200), 700);
        const a = tgt ? Math.atan2(tgt.y - pl.y, tgt.x - pl.x) + rand(-0.5, 0.5) : rand(0, TAU);
        run.missiles.push({
          x: pl.x, y: pl.y, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120,
          spd: 300 + w.lvl * 18, dmg: wdmg('missile'), crit: wlastCrit, life: 3.2,
          target: tgt, turn: 4.2, color: '#fb7185',
        });
      }
      AUDIO.sfx('shoot');
    }
  }

  function updBlades(w, dt) {
    const pl = p();
    const n = 2 + Math.floor((w.lvl - 1) / 2) + (w.evo ? 1 : 0);
    const R = w.evo ? 96 : 72;
    const spin = (2.1 + w.lvl * 0.13) * (w.evo ? 1.35 : 1);
    w.ang += spin * dt;
    w.pos = [];
    for (let i = 0; i < n; i++) {
      const a = w.ang + (i / n) * TAU;
      const bx = pl.x + Math.cos(a) * R, by = pl.y + Math.sin(a) * R;
      w.pos.push({ x: bx, y: by });
      hash.query(bx, by, 22, qbuf);
      for (const e of qbuf) {
        if (e.dead || e.bladeCd > 0) continue;
        const rr = e.r + 14;
        if (dist2(bx, by, e.x, e.y) < rr * rr) {
          e.bladeCd = 0.38;
          damageEnemy(e, wdmg('blades') * 0.85, wlastCrit);
          burst(bx, by, '#7dffa8', 3, 130, 0.25, 2);
        }
      }
    }
  }

  function updFrost(w, dt) {
    const pl = p();
    w.cd -= dt;
    if (w.cd > 0) return;
    w.cd = 0.5;
    let R = 105 + w.lvl * 14;
    if (w.evo) R = 155;
    hash.query(pl.x, pl.y, R, qbuf);
    for (const e of qbuf) {
      if (e.dead) continue;
      if (dist2(pl.x, pl.y, e.x, e.y) < (R + e.r) * (R + e.r)) {
        e.slow = 0.55;
        damageEnemy(e, wdmg('frost') * 0.3, wlastCrit);
      }
    }
  }

  function updMissiles(dt) {
    for (let i = run.missiles.length - 1; i >= 0; i--) {
      const m = run.missiles[i];
      m.life -= dt;
      if (m.life <= 0) { run.missiles.splice(i, 1); continue; }
      if (!m.target || m.target.dead) m.target = nearestEnemy(m.x, m.y, 600);
      if (m.target) {
        const a = Math.atan2(m.target.y - m.y, m.target.x - m.x);
        const ca = Math.atan2(m.vy, m.vx);
        let da = a - ca;
        while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
        const na = ca + clamp(da, -m.turn * dt, m.turn * dt);
        m.vx = Math.cos(na) * m.spd; m.vy = Math.sin(na) * m.spd;
      }
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (Math.random() < 0.6) burst(m.x, m.y, '#fb7185', 1, 40, 0.2, 2);
      hash.query(m.x, m.y, 26, qbuf);
      for (const e of qbuf) {
        if (e.dead) continue;
        const rr = e.r + 8;
        if (dist2(m.x, m.y, e.x, e.y) < rr * rr) {
          burst(m.x, m.y, '#fb7185', 16, 260, 0.4, 3);
          run.rings.push({ x: m.x, y: m.y, r: 8, R: 74, life: 0.25, max: 0.25, spd: 260, color: '#fb7185' });
          for (const e2 of qbuf) {
            if (e2.dead) continue;
            if (dist2(m.x, m.y, e2.x, e2.y) < 80 * 80) damageEnemy(e2, m.dmg * (e2 === e ? 1 : 0.6), m.crit);
          }
          AUDIO.sfx('explode');
          run.missiles.splice(i, 1);
          break;
        }
      }
    }
  }

  // ==================== SEVİYE ATLAMA ====================
  // v2.13: pilot favori silahları (20MTD sinerjisi dersi) — tek kaynak
  const favWeapons = () => ((CORE.CHARS[META.char] || CORE.CHARS.vektor).weapons || []);
  function buildChoices() {
    const pl = p();
    const fav = favWeapons();
    // v2.13: ilk 3 kart seçiminde favori silah garantisi (reroll dahil), sonrasında yalnız ağırlık
    const favGuarantee = (run.favLeft || 0) > 0;
    if (favGuarantee) run.favLeft--;
    const pool = [];
    for (const w of pl.weapons) {
      if (w.lvl < WMAX) pool.push({ kind: 'wup', id: w.id, w: 1.1 });
      if (!w.evo && w.lvl >= 5 && (pl.passives[WEAPONS[w.id].evPassive] || 0) >= 1)
        pool.push({ kind: 'evo', id: w.id, w: 0.55 });
    }
    if (pl.weapons.length < 6) for (const id in WEAPONS) {
      if (!pl.weapons.find(x => x.id === id)) pool.push({ kind: 'wnew', id, w: 0.9 });
    }
    for (const id in PASSIVES) if ((pl.passives[id] || 0) < 5) pool.push({ kind: 'pas', id, w: 0.85 });
    CORE.applyFav(pool, fav);
    const out = [];
    while (out.length < 3 && pool.length) {
      let tot = 0; for (const o of pool) tot += o.w;
      let r = Math.random() * tot, i = 0;
      for (; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) break; }
      const c = pool.splice(Math.min(i, pool.length - 1), 1)[0];
      out.push(c);
    }
    if (favGuarantee) CORE.ensureFav(out, pool, fav);
    CORE.ensureEvo(out, pool); // v2.14: evo-ready iken EVRİM kartı İLK sırada garanti (ağırlık 0.55 kaçınlması bitti)
    while (out.length < 3) out.push(out.length === 0 ? { kind: 'heal' } : { kind: 'coin' });
    return out;
  }

  function choiceMeta(c) {
    if (c.kind === 'wup') {
      const W_ = WEAPONS[c.id], w = p().weapons.find(x => x.id === c.id);
      // v2.10 (hedef E): SVY 4→5 son yükseltme — evrim eşiğini müjdeleyen altın kart
      const evoNear = !!(w && CORE.wupEvoNear(w.lvl));
      const pasName = PASSIVES[W_.evPassive] ? PASSIVES[W_.evPassive].name : 'ilgili pasif';
      // v2.11 (hedef E): her silah kartında EVO ilerleme çubuğu (SVY pips + pasif tik)
      const prog = w ? CORE.evoProg(w.lvl, p().passives[W_.evPassive] || 0) : null;
      return {
        icon: W_.icon, color: W_.color,
        cls: 'r-up' + (evoNear ? ' r-evopath' : ''),
        rt: evoNear ? 'EVO YOLU' : 'YÜKSELME',
        nm: W_.name + ' SVY ' + (w.lvl + 1),
        ds: evoNear
          ? 'Evrime son adım! SVY 5 + ' + pasName + ' → EVRİM kartı açılır'
          : 'Güçlenir: +hasar, daha hızlı atış',
        evoBand: evoNear,
        evoProg: prog,
        fav: favWeapons().includes(c.id), // v2.13: pilot favori rozeti
      };
    }
    if (c.kind === 'wnew') {
      const W_ = WEAPONS[c.id];
      return { icon: W_.icon, color: W_.color, cls: 'r-new', rt: 'YENİ SİLAH', nm: W_.name, ds: W_.desc, fav: favWeapons().includes(c.id) };
    }
    if (c.kind === 'pas') {
      const P_ = PASSIVES[c.id];
      return { icon: P_.icon, color: P_.color, cls: 'r-pas', rt: 'PASİF', nm: P_.name, ds: P_.desc };
    }
    if (c.kind === 'evo') {
      const W_ = WEAPONS[c.id];
      // v2.23: EVRİM kartı göründüğü an garantidir (ensureEvo ilk sıraya alır) — oyuncuya söylenir
      return { icon: W_.icon, color: '#a78bfa', cls: 'r-evo', rt: 'EVRİM · GARANTİLİ', nm: W_.evoName, ds: W_.evoDesc };
    }
    // v2.24 (hedef G — istihbarat #3): 6/6 dolulukta heal/coin kartları ds notu taşır —
    // oyuncu neden yeni silah görmediğini anlar (wcap-chip 'DOLU' ile aynı tavan)
    const full = p().weapons.length >= 6;
    if (c.kind === 'heal') return { icon: '✚', color: '#34d399', cls: 'r-pas', rt: 'PASİF', nm: 'ONARIM', ds: 'Maks canın %35 kadarını yenile' + CORE.slotsNote(full) };
    return { icon: '◈', color: '#fbbf24', cls: 'r-new', rt: 'BONUS', nm: 'KALKAN PİLİ', ds: 'Bu run içinde +30 coin' + CORE.slotsNote(full) };
  }

  function openLevelUp() {
    run.rerollUsed = false;
    run.choices = buildChoices();
    AUDIO.sfx('levelup');
    state.mode = 'levelup';
    UI.renderLevelUp(run.choices, run.rerollUsed);
  }

  function applyChoice(c) {
    const pl = p();
    if (c.kind === 'wnew') pl.weapons.push({ id: c.id, lvl: 1, cd: 0, evo: false, ang: rand(0, TAU) });
    else if (c.kind === 'wup') { const w = pl.weapons.find(x => x.id === c.id); if (w) w.lvl++; }
    else if (c.kind === 'pas') {
      pl.passives[c.id] = (pl.passives[c.id] || 0) + 1;
      if (c.id === 'hp') { pl.maxhp += 16; pl.hp += 16; }
    }
    else if (c.kind === 'evo') {
      const w = pl.weapons.find(x => x.id === c.id);
      if (w) w.evo = true;
      run.evolutions++;
      AUDIO.sfx('evolve');
      UI.toast('EVRİM: ' + WEAPONS[c.id].evoName, 'info');
    }
    else if (c.kind === 'heal') pl.hp = Math.min(pl.maxhp, pl.hp + pl.maxhp * 0.35);
    else if (c.kind === 'coin') run.coinsEarned += 30;
  }

  function choose(i) {
    if (!run || state.mode !== 'levelup' || !run.choices[i]) return;
    applyChoice(run.choices[i]);
    AUDIO.sfx('pick');
    run.pendingLevels--;
    if (run.pendingLevels > 0) {
      run.choices = buildChoices();
      UI.renderLevelUp(run.choices, run.rerollUsed);
    } else {
      state.mode = 'play';
      UI.sync();
    }
  }

  function reroll() {
    if (!run || state.mode !== 'levelup' || run.rerollUsed) return;
    run.rerollUsed = true;
    run.choices = buildChoices();
    UI.renderLevelUp(run.choices, true);
    AUDIO.sfx('ui');
  }

  // ==================== BAŞARIMLAR ====================
  function checkAchievements() {
    const s = { kills: run.kills, time: run.t, level: run.player.level, bossKills: run.bossKills, evolutions: run.evolutions };
    for (const a of ACHS) {
      if (!META.ach[a.id] && a.check(s)) {
        META.ach[a.id] = true;
        META.coins += a.coins;
        save();
        UI.toast('BAŞARIM: ' + a.name + ' (+' + a.coins + ' ◈)');
        AUDIO.sfx('buy');
      }
    }
  }

  // ==================== AŞAMA / ZİNDAN BİTİŞİ ====================
  function stageClear() {
    const sc = run.stageCfg;
    const pl = p();
    const res = { kills: run.kills, hpFrac: Math.max(0, pl.hp / pl.maxhp) };
    const out = META2.completeStage(sc.ch, sc.st, res);
    run.stageResult = out;
    run.nearMiss = null; // başarı ekranı: "az kalsın" satırı yok
    run.counted = true;
    const pc = META2.takePendingCoins();
    if (pc) META.coins += pc;
    state.mode = 'over';
    save();
    ANLT.track('stage_clear', { ch: sc.ch, st: sc.st, stars: out.stars });
    AUDIO.sfx('buy');
    vib([60, 40, 60]);
    UI.gameOver();
  }

  function dungeonEnd() {
    const dc = run.dungeonCfg;
    const res = dc.kind === 'boss' ? { bosses: run.bossKills, kills: run.kills } : { kills: run.kills };
    const rw = META2.dungeonReward(dc.kind, res);
    run.dungeonResult = rw;
    run.nearMiss = null; // başarı ekranı: "az kalsın" satırı yok
    run.counted = true;
    const pc = META2.takePendingCoins();
    if (pc) META.coins += pc;
    state.mode = 'over';
    save();
    ANLT.track('dungeon_end', { kind: dc.kind, ...res });
    UI.gameOver();
  }

  // ==================== OYUN SONU ====================
  // v2.7: "az kalsın" motivasyon satırı (hedef E) — canlı veriyi META2.nearMiss saf motoruna verir
  function nearMissInfo() {
    if (!run) return null;
    const boss = run.enemies ? run.enemies.find(e => e.boss && !e.dead) : null;
    const bossHpPct = boss ? Math.max(1, Math.ceil((boss.hp / boss.maxhp) * 100)) : 0;
    const pr = META2.prog();
    const nextStage = pr ? 'Bölüm ' + pr.ch + '-' + pr.st : null;
    return META2.nearMiss({
      bossHpPct,
      score: Math.round(run.score), bestScore: META.best.score,
      time: Math.floor(run.t), bestTime: META.best.time,
      nextStage,
    });
  }
  function gameOver() {
    state.mode = 'over';
    run.nearMiss = nearMissInfo();
    if (!run.counted) {
      run.counted = true;
      META2.onRunEnd({ kills: run.kills, time: run.t });
      const pc = META2.takePendingCoins();
      if (pc) META.coins += pc;
      const c = Math.floor(run.kills * 0.5 + run.t * 0.9 + run.player.level * 6 + run.bossKills * 40);
      run.coinsEarned += c;
      META.coins += c; META.runs++;
      META.best.score = Math.max(META.best.score, Math.round(run.score));
      META.best.time = Math.max(META.best.time, Math.floor(run.t));
      META.best.kills = Math.max(META.best.kills, run.kills);
      META.best.mstone = CORE.bestProgress(META.best.mstone, run.milestones);   // v2.15: kalıcı 'en iyi ilerleme'
      BOARD.submit({ score: run.score, time: run.t, kills: run.kills, level: run.player.level, char: run.char, ts: Date.now() });
      QUESTS.onRunEnd();
      save();
    }
    // v2.15: ölüm anı damgası — diriliş sonrası tekrar ölümde güncellenir (son ölüm basar)
    run.milestones = run.milestones.filter(m => m.id !== 'olum');
    run.milestones.push({ id: 'olum', t: Math.round(run.t) });
    ANLT.track('run_end', {
      time: Math.floor(run.t), kills: run.kills, level: run.player.level,
      score: Math.round(run.score), coins: run.coinsEarned, char: run.char, bossKills: run.bossKills,
      mode: run.dungeonCfg ? 'zindan' : 'normal',                                   // v2.16 kalibrasyon ayrımı
    });
    vib(180);
    AUDIO.sfx('explode');
    UI.gameOver();
  }

  function revive() {
    if (!run || !run.counted || run.reviveUsed) return;
    run.reviveUsed = true;
    const pl = p();
    pl.hp = pl.maxhp * 0.6; pl.inv = 2.5;
    for (let i = run.enemies.length - 1; i >= 0; i--) {
      const e = run.enemies[i];
      if (dist2(e.x, e.y, pl.x, pl.y) < 420 * 420) {
        burst(e.x, e.y, ETYPES[e.type].color, 8, 220, 0.4, 3);
        run.enemies.splice(i, 1);
      }
    }
    AUDIO.sfx('revive');
    // JUICE 3. KALEM (v2.30): diriliş mikro-sekansı — ölümden dönüş hissi (hedef F+E)
    flash('#fbbf24', 0.4); vib([40, 30, 40]);
    state.mode = 'play';
    UI.sync();
    UI.toast('DİRİLDİN — DEVAM ET', 'info');
  }

  function doubleCoins() {
    if (!run || run.x2Used) return false;
    run.x2Used = true;
    META.coins += run.coinsEarned;
    save();
    return true;
  }
  // v2.7: reklam ödülü köprüsü (hedef A+D) — x2 reklamı sonrası seçenekli ödül:
  // 'coin' → koşu coinlerini 2 katı (eski davranış) · 'gold' → +500 ⬡ · 'oz' → +30 ✧
  // Tek kullanım: x2Used guard'ı her üç seçenek için ortak.
  function applyX2Reward(kind) {
    if (!run || run.x2Used) return null;
    run.x2Used = true;
    if (kind === 'gold') { META2.addGold(500); save(); return 'gold'; }
    if (kind === 'oz') { META2.addOz(30); save(); return 'oz'; }
    META.coins += run.coinsEarned;
    save();
    return 'coin';
  }

  // ==================== AKIŞ KONTROLÜ ====================
  function startRun() {
    newRun();
    state.mode = 'play';
    UI.sync();
    QUESTS.ensureDaily();
    ANLT.track('run_start', { char: run.char });
    if (!META.tutorial) {
      META.tutorial = true; save();
      state.mode = 'pause';
      UI.sync();
      UI.showTutorial();
    }
  }
  function toMenu() { run = null; state.mode = 'menu'; UI.sync(); UI.refreshMenu(); }
  function resume() { if (state.mode === 'pause') { state.mode = 'play'; UI.sync(); } }
  function togglePause() {
    if (state.mode === 'play') { state.mode = 'pause'; UI.sync(); }
    else if (state.mode === 'pause') { state.mode = 'play'; UI.sync(); }
  }
  function buy(id) {
    const u = UPGRADES.find(x => x.id === id);
    if (!u) return false;
    const lvl = upVal(id);
    if (lvl >= u.max) return false;
    const cost = u.cost(lvl);
    if (META.coins < cost) { AUDIO.sfx('deny'); return false; }
    META.coins -= cost;
    META.upgrades[id] = lvl + 1;
    save();
    AUDIO.sfx('buy');
    return true;
  }

  function buyChar(id) {
    const c = CORE.CHARS[id];
    if (!c || META.chars[id]) return false;
    if (META.coins < c.cost) { AUDIO.sfx('deny'); return false; }
    META.coins -= c.cost;
    META.chars[id] = true;
    save();
    AUDIO.sfx('buy');
    ANLT.track('char_unlock', { id });
    return true;
  }
  function selectChar(id) {
    if (!ownChar(id)) return false;
    META.char = id;
    save();
    AUDIO.sfx('ui');
    return true;
  }
  const allChars = () => ({ ...CORE.CHARS, ...META2.CHARS });
  const ownChar = id => !!(META.chars[id] || META2.owned(id));

  const getHud = () => run ? ({
    hp: run.player.hp, maxhp: run.player.maxhp, xp: run.player.xp, xpNext: run.player.xpNext,
    level: run.player.level, time: run.t, kills: run.kills, coins: run.coinsEarned,
    bossWarn: run.bossWarn, combo: run.combo, revives: run.player.revives,
    bossType: (() => { const b = run.enemies.find(e => e.boss); return b ? b.type : null; })(),   // v2.16 kalıcı boss etiketi
    evoReady: CORE.evoReady(run.player.weapons, run.player.passives, WEAPONS).ready, // v2.23 EVRİME HAZİR rozeti
    evoCrate: run.coins.some(c => c.crate && c.evo),   // v2.23: sahada sinyalli kasa var mı
    bossCrate: run.coins.some(c => c.crate && c.boss), // v2.25: sahada boss kasası var mı (test/telemetri kancası)
  }) : null;

  // ==================== RENDER ====================
  function poly(x, y, r, n, rot) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const a = rot + (i / n) * TAU;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }
  const mod = (v, m) => ((v % m) + m) % m;

  function drawGrid(camX, camY, off) {
    const W = ENG.W(), H = ENG.H(), sp = 90;
    ctx.strokeStyle = 'rgba(34,211,238,0.07)'; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = mod(-camX + (off || 0), sp); x < W; x += sp) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
    for (let y = mod(-camY + (off || 0), sp); y < H; y += sp) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
    ctx.stroke();
  }

  function drawStars(camX, camY) {
    const W = ENG.W(), H = ENG.H();
    ctx.fillStyle = 'rgba(148,180,255,0.5)';
    for (let i = 0; i < 70; i++) {
      const bx = (i * 713.7) % 4000, by = (i * 311.3) % 4000;
      const sx = mod(bx - camX * 0.35, W), sy = mod(by - camY * 0.35, H);
      const s = 0.6 + (i % 3) * 0.5;
      ctx.globalAlpha = 0.18 + (i % 5) * 0.07;
      ctx.fillRect(sx, sy, s, s);
    }
    ctx.globalAlpha = 1;
  }

  // v2.32 (hedef F — juice 4. kalem, koşu #28 işi 3): MIKNATIS İZİ — v2.29 'sıradaki aday:
  // mag' dersinin kapanışı ('her meta-stat için SAHNEDE karşılık'). Çekim (gem 460 / coin 520
  // px/s) sahnada görünmezdi — çekim anında pickup'tan oyuncuya ince iz (alpha 0.28, 'lighter'
  // drawWorld içinde). Renk ailesi: gem kristal #67e8f9 · coin/kasa altın #fbbf24. Perf:
  // pickup başına 1 çizgi (p95 bütçesi 0.038ms/8ms — güvenli).
  function drawPullTrails(pl) {
    for (const g of run.gems) {
      if (!g.pull) continue;
      ctx.globalAlpha = 0.28; ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(g.x, g.y);
      ctx.lineTo(g.x + (pl.x - g.x) * 0.3, g.y + (pl.y - g.y) * 0.3); ctx.stroke();
    }
    for (const c of run.coins) {
      if (!c.pull) continue;
      ctx.globalAlpha = 0.28; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(c.x, c.y);
      ctx.lineTo(c.x + (pl.x - c.x) * 0.3, c.y + (pl.y - c.y) * 0.3); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld() {
    const pl = p();
    const W = ENG.W(), H = ENG.H();
    drawGrid(pl.x, pl.y, 0);
    drawStars(pl.x, pl.y);
    ctx.save();
    ctx.translate(W / 2 - pl.x, H / 2 - pl.y);

    // buz aurası
    const fw = pl.weapons.find(w => w.id === 'frost');
    if (fw) {
      const R = fw.evo ? 155 : 105 + fw.lvl * 14;
      ctx.globalAlpha = 0.07; ctx.fillStyle = '#67e8f9';
      ctx.beginPath(); ctx.arc(pl.x, pl.y, R, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.5; ctx.strokeStyle = '#67e8f9'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pl.x, pl.y, R, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // v2.28: kasa açılış kalıcı izi — en altta (grid/stars üstü, entity altı): yer pateni
    for (const m of run.marks) {
      const a = Math.min(1, m.life / m.max) * 0.42;
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = a; ctx.strokeStyle = m.color; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.stroke();
      ctx.globalAlpha = a * 0.5; ctx.fillStyle = m.color;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 0.55, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // şok halkaları
    for (const r of run.rings) {
      ctx.globalAlpha = Math.max(0, r.life / r.max);
      ctx.strokeStyle = r.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(r.x, r.y, r.r, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // kristaller
    ctx.globalCompositeOperation = 'lighter';
    for (const g of run.gems) {
      const col = g.v >= 20 ? '#f0abfc' : (g.v >= 5 ? '#7dffa8' : '#67e8f9');
      ctx.fillStyle = col;
      poly(g.x, g.y, 5, 4, Math.PI / 4); ctx.fill();
    }
    // coinler (+ v2.8 ekipman kasası: altın sandık, daha büyük, nabız gibi parlar)
    for (const c of run.coins) {
      if (c.crate) {
        // v2.25 (hedef E+G — handoff yedek işi): BOSS kasası altın-zirve görünüm — pickup beklemeden
        // sahadan ayrışır (v2.16 dersi: kalıcı kanıt oyuncu bilgisiyle aynı kapıdan). Hiyerarşi:
        // evo (mor) > boss (altın-zirve + BOSS yazısı) > normal (amber).
        const s = 1 + Math.sin(run.t * (c.evo ? 5 : (c.boss ? 7 : 5))) * 0.12;
        ctx.save();
        ctx.translate(c.x, c.y); ctx.scale(s, s);
        ctx.fillStyle = c.evo ? '#7c3aed' : (c.boss ? '#fbbf24' : '#f59e0b');
        ctx.fillRect(-11, -9, 22, 18);
        ctx.fillStyle = c.evo ? '#ddd6fe' : (c.boss ? '#fffbeb' : '#fde68a');
        ctx.fillRect(-11, -2.5, 22, 5);
        ctx.strokeStyle = c.evo ? '#c4b5fd' : (c.boss ? '#fef08a' : '#fffbeb'); ctx.lineWidth = 2;
        ctx.strokeRect(-11, -9, 22, 18);
        if (c.evo) { ctx.fillStyle = '#e9d5ff'; ctx.font = 'bold 11px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('EVO', 0, 6.5); }
        else if (c.boss) { ctx.fillStyle = '#7c2d12'; ctx.font = 'bold 9px Orbitron, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('BOSS', 0, 6); }
        ctx.restore();
        continue;
      }
      const s = 4 + Math.sin(c.t + run.t * 6) * 1.2;
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath(); ctx.arc(c.x, c.y, s, 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
    drawPullTrails(pl);                                    // v2.32: mıknatıs izi (fonksiyon üstte)
    // mermiler
    for (const b of run.bullets) {
      ctx.strokeStyle = b.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.016, b.y - b.vy * 0.016); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
    }
    for (const b of run.ebullets) {
      ctx.fillStyle = '#fb7185';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fecdd3';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.45, 0, TAU); ctx.fill();
    }
    for (const m of run.missiles) {
      const a = Math.atan2(m.vy, m.vx);
      ctx.save(); ctx.translate(m.x, m.y); ctx.rotate(a);
      ctx.fillStyle = '#fb7185';
      poly(0, 0, 6, 3, 0); ctx.fill();
      ctx.restore();
    }
    ctx.globalCompositeOperation = 'source-over';

    // düşmanlar
    for (const e of run.enemies) {
      const T = ETYPES[e.type];
      ctx.fillStyle = T.color;
      if (e.type === 'grunt') { poly(e.x, e.y, e.r, 4, e.phase * 0.5); ctx.fill(); }
      else if (e.type === 'swarm') { poly(e.x, e.y, e.r, 3, Math.atan2(pl.y - e.y, pl.x - e.x)); ctx.fill(); }
      else if (e.type === 'tank') { poly(e.x, e.y, e.r, 6, e.phase * 0.3); ctx.fill(); }
      else if (e.type === 'shooter') { poly(e.x, e.y, e.r, 4, e.phase); ctx.fill(); }
      else if (e.type === 'splitter') {
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill();
        ctx.strokeStyle = T.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 4, 0, TAU); ctx.stroke();
      }
      else if (e.type === 'mini') { ctx.beginPath(); ctx.arc(e.x, e.y, e.r, 0, TAU); ctx.fill(); }
      else if (T.boss) {
        // v2.9: üç boss varyantı da aynı altıgen çizim, varyant rengiyle (shadowColor = T.color)
        ctx.save();
        ctx.shadowColor = T.color; ctx.shadowBlur = 24;
        poly(e.x, e.y, e.r, 6, e.phase * 0.5); ctx.fill();
        ctx.fillStyle = '#7f1d2d';
        poly(e.x, e.y, e.r * 0.55, 3, -e.phase); ctx.fill();
        ctx.restore();
      }
      if (e.elite) {
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 5, 0, TAU); ctx.stroke();
      }
      if (e.hp < e.maxhp && !e.boss) {
        const w = e.r * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(e.x - e.r, e.y - e.r - 8, w, 3);
        ctx.fillStyle = '#ff4d6d';
        ctx.fillRect(e.x - e.r, e.y - e.r - 8, w * Math.max(0, e.hp / e.maxhp), 3);
      }
    }
    if (run.enemies.some(e => e.boss && !e.dead)) {
      const b = run.enemies.find(e => e.boss && !e.dead);
      const w = 120;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(b.x - w / 2, b.y - b.r - 18, w, 6);
      ctx.fillStyle = '#ff2d55';
      ctx.fillRect(b.x - w / 2, b.y - b.r - 18, w * Math.max(0, b.hp / b.maxhp), 6);
    }

    // yörünge kılıçları
    const bw = pl.weapons.find(w => w.id === 'blades');
    if (bw && bw.pos) {
      ctx.save();
      ctx.shadowColor = '#7dffa8'; ctx.shadowBlur = 10;
      ctx.fillStyle = '#7dffa8';
      for (const pos of bw.pos) {
        ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(bw.ang + Math.PI / 2);
        poly(0, 0, 14, 3, 0); ctx.fill();
        ctx.restore();
      }
      ctx.restore();
    }

    // şimşek zincirleri
    ctx.globalCompositeOperation = 'lighter';
    for (const b of run.bolts) {
      ctx.globalAlpha = Math.max(0, b.life / b.max);
      ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (let i = 0; i < b.pts.length - 1; i++) {
        const a = b.pts[i], c = b.pts[i + 1];
        ctx.moveTo(a.x, a.y);
        const mx = (a.x + c.x) / 2 + rand(-9, 9), my = (a.y + c.y) / 2 + rand(-9, 9);
        ctx.lineTo(mx, my); ctx.lineTo(c.x, c.y);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';

    // oyuncu
    ctx.save();
    ctx.translate(pl.x, pl.y); ctx.rotate(pl.face);
    if (pl.inv > 0 && Math.floor(pl.inv * 20) % 2 === 0) ctx.globalAlpha = 0.35;
    ctx.shadowColor = '#22d3ee'; ctx.shadowBlur = 16;
    ctx.fillStyle = '#22d3ee';
    ctx.beginPath();
    ctx.moveTo(15, 0); ctx.lineTo(-10, 9); ctx.lineTo(-5, 0); ctx.lineTo(-10, -9);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;

    // parçacık + yazılar (dünya uzayında)
    ENG.drawParts();
    ENG.drawTexts();
    ctx.restore();
  }

  function drawMenuBg(dt) {
    menuT += dt;
    drawGrid(menuT * 24, menuT * 16, 0);
    if (Math.random() < 0.07) {
      const cols = ['#22d3ee', '#a78bfa', '#f0abfc', '#fbbf24'];
      burst(rand(0, ENG.W()), rand(0, ENG.H()), cols[irand(0, 3)], 3, 55, 1.3, 2);
    }
  }

  function render(dt) {
    ENG.beginDraw();
    if (run && state.mode !== 'menu') drawWorld();
    else { drawMenuBg(dt); ENG.drawParts(); }
    ENG.endDraw();
  }

  // ==================== BOOT / API ====================
  function boot() {
    AUDIO.setSfx(META.settings.sfx);
    AUDIO.setMusic(META.settings.music);
    if (ENG.debug) document.getElementById('fps').classList.remove('hidden');
    QUESTS.init(META, save);
    EXP.init(META, save);
    ANLT.init({ meta: META, version: '1.1.0' });
    BOARD.init(META, save);
    try {
      const cfg = JSON.parse(localStorage.getItem('neonstorm_cfg') || '{}');
      if (cfg.boardUrl) BOARD.setRemote(cfg.boardUrl);
    } catch (e) { }
    window.addEventListener('error', ev => ANLT.track('error', { msg: String(ev.message || '').slice(0, 200) }));
    window.addEventListener('unhandledrejection', ev => ANLT.track('error', { msg: String(ev.reason || '').slice(0, 200) }));
    const params = new URLSearchParams(location.search);
    if (params.has('autostart')) {
      META.tutorial = true; save();
      startRun();
    }
    ENG.start(update, render);
  }

  const GOD = new URLSearchParams(location.search).has('god');
  if (GOD) {
    // test modu: oyuncu hasar almaz
    const _dp = damagePlayer;
    damagePlayer = function () { };
  }

  return {
    update, render, boot,
    startRun, toMenu, resume, togglePause, choose, reroll, buy, revive, doubleCoins,
    buyChar, selectChar,
    // v2.0 gelir motoru
    META2: () => META2, allChars, ownChar,
    startStage: (ch, st) => { if (!META2.startStage(ch, st)) return false; startRun(); return true; },
    startDungeon: kind => { if (!META2.startDungeon(kind)) return false; startRun(); return true; },
    stageResult: () => run ? run.stageResult : null,
    dungeonResult: () => run ? run.dungeonResult : null,
    addMetaCoins: n => { META.coins += n; save(); },
    // v2.20: ekran otomasyonu + QA kancası (getHud deseni) — gerçek spawn yolunu çağırır,
    // alan elle kopyalamaz (v2.7 kök-bug dersi: kopya liste eksikse davranış sessiz kırılır)
    spawnEnemy: (type, x, y) => spawnEnemy(type, x, y),
    questInfo: () => QUESTS.info(),
    claimQuest: i => QUESTS.claim(i),
    claimWeekly: () => QUESTS.claimWeekly(),
    boardTop: () => BOARD.top(),
    expAll: () => EXP.all(),
    charId: () => META.char,
    getHud, rerollUsed: () => run ? run.rerollUsed : true,
    choiceMetaOf: choiceMeta,
    x2Used: () => run ? run.x2Used : true,
    applyX2Reward,
    goInfo: () => run ? ({
      time: run.t, kills: run.kills, level: run.player.level, score: Math.round(run.score),
      coins: run.coinsEarned, revivable: !run.reviveUsed, best: META.best,
      newBest: Math.round(run.score) >= META.best.score && Math.round(run.score) > 0,
      nearMiss: run.nearMiss || null,
      milestones: run.milestones.slice(), bestMstone: META.best.mstone || null,   // v2.15 radar
      crates: run.cratesOpened || 0,    // v2.29: ölüm ekranı 'BU KOŞUDA N KASA AÇTIN' satırı
    }) : null,
    META: () => META, WEAPONS, PASSIVES, UPGRADES, ACHS, run: () => run, state,
  };
})();
