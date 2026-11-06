/* NEON STORM — meta_data.js : v2.0 gelir motoru veri tabloları (DOM'suz, Node testine uyumlu)
   Gacha + ekipman + bölüm haritası + zindanlar + battle pass + mağaza paketleri */
'use strict';
const META_DATA = (() => {

  // ---------- Nadirlik ----------
  const RARITY = {
    N:   { mult: 1.0,  shards: 3,  color: '#9ca3af', name: 'NORMAL' },
    R:   { mult: 1.35, shards: 6,  color: '#22d3ee', name: 'NADİR' },
    SR:  { mult: 1.8,  shards: 12, color: '#a78bfa', name: 'SÜPER NADİR' },
    SSR: { mult: 2.4,  shards: 25, color: '#fbbf24', name: 'EFSANEVİ' },
  };
  const RATES = { SSR: 0.02, SR: 0.10, R: 0.33, N: 0.55 };
  const PITY = { soft: 40, softStep: 0.08, hard: 50 };
  const ITEM_RATES = { SSR: 0.03, SR: 0.15, R: 0.37, N: 0.45 };

  // ---------- Pilot yıldızları (v2.5: üstel maliyet eğrisi — tüm yıldız haftalarca sürmeli) ----------
  const STAR_MAX = 5;
  const STAR_COST = [40, 100, 250, 600, 1500];  // shards maliyeti ×2.5 üstel (toplam 2490)
  const STAR_BONUS = { dmg: 0.05, hp: 0.04 };   // yıldız başı — maliyetle dengeli

  // ---------- Pilot havuzu (gacha) ----------
  const CORE_PILOTS = { vektor: 'R', pyra: 'R', glacia: 'SR', nova9: 'SR' };
  const NEW_PILOTS = {
    zenith: { rar: 'SSR', name: 'ZENITH',  desc: 'Başlangıçta +1 silah seviyesi, +%20 hasar. Protokolün zirvesi.',  color: '#fbbf24', weapons: ['pulse'],      mods: { dmg: 1.20, startLvl: 1 } },
    aurora: { rar: 'SSR', name: 'AURORA',  desc: 'Frost alanıyla başlar, +%12 can, +%8 hız. Kutup ışığı protokolü.', color: '#c4b5fd', weapons: ['pulse', 'frost'], mods: { hp: 1.12, spd: 1.08 } },
    nexus:  { rar: 'SR',  name: 'NEXUS',   desc: 'Şimşek zinciriyle başlar, +%10 hasar.',                            color: '#67e8f9', weapons: ['pulse', 'chain'], mods: { dmg: 1.10 } },
    volt:   { rar: 'SR',  name: 'VOLT',    desc: 'Füze rampasıyla başlar, -%8 bekleme.',                             color: '#fde047', weapons: ['pulse', 'missile'], mods: { frate: 0.92 } },
    cinder: { rar: 'SR',  name: 'CINDER',  desc: '+%18 hasar, -%8 can. Yanan öfke.',                                 color: '#fb923c', weapons: ['pulse'],      mods: { dmg: 1.18, hp: 0.92 } },
    onyx:   { rar: 'R',   name: 'ONYX',    desc: '+%10 can, +%5 hız. Karanlık gövde.',                               color: '#94a3b8', weapons: ['pulse'],      mods: { hp: 1.10, spd: 1.05 } },
    jade:   { rar: 'R',   name: 'JADE',    desc: '+%8 hasar, +%8 can. Dengeli yeşil hat.',                           color: '#4ade80', weapons: ['pulse'],      mods: { dmg: 1.08, hp: 1.08 } },
    scrap:  { rar: 'N',   name: 'SCRAP',   desc: 'Hurdadan yekpe: +%5 hasar.',                                       color: '#6b7280', weapons: ['pulse'],      mods: { dmg: 1.05 } },
  };

  // ---------- Ekipman ----------
  const SLOTS = ['weapon', 'armor', 'helm', 'boots', 'ring', 'amulet'];
  const SLOT_INFO = {
    weapon: { name: 'KANON',    stat: 'dmg',   base: 0.08, icon: '✦' },
    armor:  { name: 'ZIRH',     stat: 'hp',    base: 0.08, icon: '⬢' },
    helm:   { name: 'KASK',     stat: 'regen', base: 0.40, icon: '◉' },
    boots:  { name: 'BOT',      stat: 'spd',   base: 0.05, icon: '⌁' },
    ring:   { name: 'YÜZÜK',    stat: 'crit',  base: 0.04, icon: '◎' },
    amulet: { name: 'KOLYE',    stat: 'mag',   base: 0.15, icon: '◈' },
  };
  const ITEM_LVL_MAX = 50;                        // v2.5: uzun vadeli geliştirme yolu (20→50)
  const ITEM_GROWTH = 0.12;                       // seviye başı çarpan (50. seviyede ×7 stat)
  const itemUpgradeCost = (rar, lvl) => Math.floor(80 * RARITY[rar].mult * Math.pow(lvl + 1, 1.55));  // v2.5: daha dik üstel eğri
  const statValue = (slot, rar, lvl) => SLOT_INFO[slot].base * RARITY[rar].mult * (1 + ITEM_GROWTH * lvl);
  // v2.34 (hedef B+G — koşu #30 işi 2): YÜKSELTME KAZANÇ ÖNİZLEMESİ — bir sonraki seviyenin
  // getireceği stat artışı. SAF: statValue(slot,rar,lvl+1) − statValue(slot,rar,lvl)
  // (elle yazma yasak — statValue tek doğruluk kaynağı; UI '· +12% HASAR' biçiminde basar).
  // ITEM_LVL_MAX üstü çağrı güvenli (UI düğmeyi disabled yapar, hesap bozulmaz).
  const itemUpgradeGain = (slot, rar, lvl) => statValue(slot, rar, lvl + 1) - statValue(slot, rar, lvl);

  const FAMILIES = ['A', 'B', 'C', 'D', 'E'];
  const FAM_NAME = { A: 'STROM', B: 'VANTA', C: 'HALO', D: 'RIFT', E: 'PULSE' };
  const SET_BONUS = { 2: { dmg: 0.05 }, 4: { hp: 0.10 }, 6: { dmg: 0.15, spd: 0.08 } };
  // v2.35 (hedef G — koşu #31): stat adları TEK KAYNAK — ui.js STATNAME + setBonusLine buradan
  // okur (kopya tanım yasak; SLOT_INFO.stat anahtarlarıyla birebir).
  const STAT_NAME = { dmg: 'HASAR', hp: 'CAN', regen: 'REGEN', spd: 'HIZ', crit: 'KRİTİK', mag: 'MIKNATIS' };

  // ---------- v2.6: BİRLEŞTİRME (fusion) ----------
  // N→R→SR→SSR zinciri; SSR zirve, füzyonlanamaz. 3 aynı nadirlik → 1 üst nadirlik.
  const FUSE_FROM = ['N', 'R', 'SR'];
  const FUSE_COUNT = 3;

  // ---------- v2.6: GÜNLÜK GİRİŞ SERİSİ (7 gün döngü) ----------
  const DAILY_REWARDS = [
    { coins: 200 },                    // gün 1
    { coins: 300 },                    // gün 2
    { gold: 600 },                     // gün 3
    { coins: 400, oz: 50 },            // gün 4
    { gold: 1200 },                    // gün 5
    { coins: 600, gold: 800 },         // gün 6
    { oz: 500, item: 'SR' },           // gün 7: büyük ödül
  ];

  // ---------- Bölüm haritası ----------
  const CHAPTERS = [
    'NEON KIYI', 'ÇELİK ÇÖL', 'KUANTUM PAZAR', 'SİNYAL KAYBI', 'SİM VERGİSİ',
    'HAFIZA FIRTINASI', 'ELEKTRİK BAHÇESİ', 'GÖLGE PROTOKOL', 'SIFIR NOKTASI',
    'SON SUNUCU', 'ÇEKİRDEK KAOS', 'YILDIZ FALLARI',
  ];
  const STAGES_PER_CH = 10;
  const stageDuration = st => 60 + 10 * st;       // 1→70sn … 10→160sn
  const stageKillThr = st => 50 + 25 * st;        // 2. yıldız eşiği
  const STAR_HP_THR = 0.5;                        // 3. yıldız: bitişte can ≥ %50
  const chapterScale = {
    hp:    (ch, st) => 1 + (ch - 1) * 0.35 + st * 0.03,
    dmg:   (ch)     => 1 + (ch - 1) * 0.12,
    spawn: (ch)     => 1 + (ch - 1) * 0.08,
  };
  const FIRST_CLEAR = {
    coins: ch => 80 + 20 * ch,
    gold:  ch => 300 + 60 * ch,
    oz:    ch => 60 + 10 * ch,
  };
  const TRIPLE_BONUS = { oz: 150, item: 'SSR' };  // bölümün tümü 3★ → tek seferlik

  // ---------- Zindanlar ----------
  const DUNGEONS = {
    gold:    { name: 'ALTIN ZİNDANI',   entries: 2, dur: 90, desc: 'Öldürme başına altın yağmuru' },
    essence: { name: 'ÖZ ZİNDANI',      entries: 2, dur: 90, desc: 'Yıldız Özü toplama hattı' },
    boss:    { name: 'BOSS SALDIRISI',  entries: 1, dur: 60, bossEvery: 12, desc: 'Kesintisiz boss akını' },
  };
  const DUNGEON_REWARD = {
    gold:    r => ({ gold: 800 + r.kills * 8 }),
    essence: r => ({ oz: 30 + Math.floor(r.kills * 0.6) }),
    boss:    r => ({ gold: 600 + r.bosses * 150, oz: 40 + r.bosses * 15 }),
  };
  const DUNGEON_XP = 40;

  // ---------- Battle Pass: YILDIZ YOLU ----------
  const BP = {
    levels: 30,
    need: lvl => 100 + lvl * 40,
    runXp: (kills, time) => Math.min(120, Math.floor(kills * 0.2 + time * 0.4)),
    stageXp: 60,
    dungeonXp: DUNGEON_XP,
  };
  const PASS_FREE = lvl => ({ oz: 10, coins: lvl % 5 === 0 ? 150 : 50, gold: lvl % 3 === 0 ? 200 : 0 });
  const PASS_PREM = lvl => ({ oz: 25, coins: lvl % 5 === 0 ? 300 : 100, gold: lvl % 3 === 0 ? 400 : 0, item: lvl % 5 === 0 ? 'R' : null });

  // ---------- Mağaza paketleri (simüle IAP — gerçek SDK bağlantı noktası Faz 38) ----------
  const BUNDLES = {
    starter:  { price: 4.99, once: true, oz: 1200, gold: 5000, item: 'SR', name: 'BAŞLANGIÇ PAKETİ' },
    oz_pack:  { price: 9.99, oz: 3000, name: 'YILDIZ ÖZÜ KUTUSU' },
    gold_pack:{ price: 2.99, gold: 12000, name: 'ALTIN KUTUSU' },
    pass:     { price: 9.99, premium: true, name: 'YILDIZ YOLU · PREMIUM' },
  };

  const PULL_COST = 100;      // öz / tekli çekiliş
  const PULL10_COST = 900;    // %10 indirim
  const START_OZ = 300;       // yeni oyuncu başlangıç özü
  const START_GOLD = 1000;

  return {
    RARITY, RATES, PITY, ITEM_RATES, CORE_PILOTS, NEW_PILOTS,
    SLOTS, SLOT_INFO, ITEM_LVL_MAX, ITEM_GROWTH, itemUpgradeCost, itemUpgradeGain, statValue,
    FAMILIES, FAM_NAME, SET_BONUS, STAT_NAME,
    FUSE_FROM, FUSE_COUNT, DAILY_REWARDS,
    CHAPTERS, STAGES_PER_CH, stageDuration, stageKillThr, STAR_HP_THR, chapterScale,
    FIRST_CLEAR, TRIPLE_BONUS,
    DUNGEONS, DUNGEON_REWARD, DUNGEON_XP,
    BP, PASS_FREE, PASS_PREM, BUNDLES,
    PULL_COST, PULL10_COST, START_OZ, START_GOLD,
    STAR_MAX, STAR_COST, STAR_BONUS,
  };
})();
globalThis.META_DATA = META_DATA;
