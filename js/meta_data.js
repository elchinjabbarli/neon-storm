/* NEON STORM — meta_data.js : v4.0 SANDIK ÇAĞI veri tabloları (DOM'suz, Node testine uyumlu)
   Kökten yeniden tasarım (kullanıcı emri): Çağrı (gacha+pilotlar) SİLİNDİ, Yıldız Yolu SİLİNDİ,
   eski ekipman kazanım yolları (füzyon/taş/parça/reklam kasası/koşu kasası ekipmanı) SİLİNDİ.
   TEK KAZANIM = EKİPMAN: sandık yalnız bölümlerin ilk temizlik ödülü olarak düşer,
   sandığı açmak ANAHTAR ister (anahtar: zindan veya ⬡ altın). Meta üç direk:
   EKİPMAN + MAĞAZA + PREMİUM UÇAKLAR. */
'use strict';
const META_DATA = (() => {

  // ---------- Nadirlik (ekipman) ----------
  const RARITY = {
    N:   { mult: 1.0,  color: '#9ca3af', name: 'NORMAL' },
    R:   { mult: 1.35, color: '#22d3ee', name: 'NADİR' },
    SR:  { mult: 1.8,  color: '#a78bfa', name: 'SÜPER NADİR' },
    SSR: { mult: 2.4,  color: '#fbbf24', name: 'EFSANEVİ' },
  };
  // sandık içi nadirlik zarı — BAZ oranlar; bölüm ölçeği chestRates(ch) ile N'den SR/SSR'a kaydırır
  const ITEM_RATES = { SSR: 0.03, SR: 0.15, R: 0.37, N: 0.45 };
  // bölüm (chapter) şansı: her bölüm SSR +1% (tavan +5%), SR +2% (tavan +25%) — N'den alınır
  const CHEST_LUCK = { ssrStep: 0.01, ssrMax: 0.05, srStep: 0.02, srMax: 0.25 };
  function chestRates(ch) {
    const k = Math.max(0, (ch || 1) - 1);
    const ssr = Math.min(ITEM_RATES.SSR + CHEST_LUCK.ssrMax, ITEM_RATES.SSR + CHEST_LUCK.ssrStep * k);
    const sr = Math.min(ITEM_RATES.SR + CHEST_LUCK.srMax, ITEM_RATES.SR + CHEST_LUCK.srStep * k);
    const r = ITEM_RATES.R;
    const n = Math.max(0, 1 - ssr - sr - r);
    return { SSR: ssr, SR: sr, R: r, N: n };
  }

  // ---------- Ekipman (slotlar + stat eğrisi KORUNDU — kazanım yolu değişti, sistem çekirdeği değil) ----------
  const SLOTS = ['weapon', 'armor', 'helm', 'boots', 'ring', 'amulet'];
  const SLOT_INFO = {
    weapon: { name: 'KANON',    stat: 'dmg',   base: 0.08, icon: '✦' },
    armor:  { name: 'ZIRH',     stat: 'hp',    base: 0.08, icon: '⬢' },
    helm:   { name: 'KASK',     stat: 'regen', base: 0.40, icon: '◉' },
    boots:  { name: 'BOT',      stat: 'spd',   base: 0.05, icon: '⌁' },
    ring:   { name: 'YÜZÜK',    stat: 'crit',  base: 0.04, icon: '◎' },
    amulet: { name: 'KOLYE',    stat: 'mag',   base: 0.15, icon: '◈' },
  };
  const ITEM_LVL_MAX = 50;
  const ITEM_GROWTH = 0.12;
  const itemUpgradeCost = (rar, lvl) => Math.floor(80 * RARITY[rar].mult * Math.pow(lvl + 1, 1.55));
  const statValue = (slot, rar, lvl) => SLOT_INFO[slot].base * RARITY[rar].mult * (1 + ITEM_GROWTH * lvl);
  const itemUpgradeGain = (slot, rar, lvl) => statValue(slot, rar, lvl + 1) - statValue(slot, rar, lvl);

  const FAMILIES = ['A', 'B', 'C', 'D', 'E'];
  const FAM_NAME = { A: 'STROM', B: 'VANTA', C: 'HALO', D: 'RIFT', E: 'PULSE' };
  const SET_BONUS = { 2: { dmg: 0.05 }, 4: { hp: 0.10 }, 6: { dmg: 0.15, spd: 0.08 } };
  const STAT_NAME = { dmg: 'HASAR', hp: 'CAN', regen: 'REGEN', spd: 'HIZ', crit: 'KRİTİK', mag: 'MIKNATIS' };

  // ---------- SANDIK + ANAHTAR (v4.0 tek kazanım zinciri) ----------
  const KEY_COST_GOLD = 400;        // mağazadan anahtar fiyatı (⬡)
  const START_KEYS = 2;             // yeni profil: zincir hemen yaşanabilsin
  const CHEST_SRC = { stage: 'bölüm ilk temizlik' };
  const RECLEAR = {                 // tekrar temizlik (sandık YOK — yalnız para)
    coins: ch => 40 + 10 * ch,
    gold: ch => 150 + 30 * ch,
  };

  // ---------- PREMİUM UÇAKLAR (v4.0 — pilot/gacha'nın yerine geçen tek kimlik sistemi) ----------
  // cost: ◈ coin fiyatı · iap: simüle gerçek-paralı PREMIUM uçak (Tavan D: IAP + rewarded)
  const PLANES = {
    vektor: { name: 'VEKTÖR',   desc: 'Dengeli standart gövde. Her pilotun ilk uçağı.',        color: '#22d3ee', cost: 0,     weapons: ['pulse'], mods: {} },
    scrap:  { name: 'SCRAP',    desc: 'Hurdadan yekpe: +%5 hasar.',                            color: '#6b7280', cost: 400,   weapons: ['pulse'], mods: { dmg: 1.05 } },
    onyx:   { name: 'ONYX',     desc: '+%10 can, +%5 hız. Karanlık gövde.',                    color: '#94a3b8', cost: 900,   weapons: ['pulse'], mods: { hp: 1.10, spd: 1.05 } },
    jade:   { name: 'JADE',     desc: '+%8 hasar, +%8 can. Dengeli yeşil hat.',                color: '#4ade80', cost: 1400,  weapons: ['pulse'], mods: { dmg: 1.08, hp: 1.08 } },
    pyra:   { name: 'PYRA',     desc: '+%15 hasar, -%10 maks can. Agresif çizgi.',             color: '#fb923c', cost: 2000,  weapons: ['pulse'], mods: { dmg: 1.15, hp: 0.9 } },
    nexus:  { name: 'NEXUS',    desc: 'Şimşek zinciriyle başlar, +%10 hasar.',                 color: '#67e8f9', cost: 2600,  weapons: ['pulse', 'chain'], mods: { dmg: 1.10 } },
    volt:   { name: 'VOLT',     desc: 'Füze rampasıyla başlar, -%8 bekleme.',                  color: '#fde047', cost: 3200,  weapons: ['pulse', 'missile'], mods: { frate: 0.92 } },
    cinder: { name: 'CINDER',   desc: '+%18 hasar, -%8 can. Yanan öfke.',                      color: '#fb923c', cost: 3800,  weapons: ['pulse'], mods: { dmg: 1.18, hp: 0.92 } },
    glacia: { name: 'GLACIA',   desc: 'Buz alanıyla başlar, +%15 can, -%5 hız.',               color: '#67e8f9', cost: 4400,  weapons: ['pulse', 'frost'], mods: { hp: 1.15, spd: 0.95 } },
    nova9:  { name: 'NOVA-9',   desc: '-%12 bekleme, +%5 hasar. Deneysel gövde.',              color: '#f0abfc', cost: 5200,  weapons: ['pulse'], mods: { frate: 0.88, dmg: 1.05 } },
    aurora: { name: 'AURORA',   desc: 'PREMIUM · Kutup ışığı protokolü: buz alanı, +%12 can, +%8 hız.', color: '#c4b5fd', iap: 4.99, premium: true, weapons: ['pulse', 'frost'], mods: { hp: 1.12, spd: 1.08 } },
    zenith: { name: 'ZENITH',   desc: 'PREMIUM · Protokolün zirvesi: +1 başlangıç silah seviyesi, +%20 hasar.', color: '#fbbf24', iap: 9.99, premium: true, weapons: ['pulse'], mods: { dmg: 1.20, startLvl: 1 } },
  };
  const DEFAULT_PLANE = 'vektor';

  // ---------- GÜNLÜK GİRİŞ SERİSİ (7 gün döngü — ✧öz KALDIRILDI, anahtar aktarıldı) ----------
  const DAILY_REWARDS = [
    { coins: 200 },                    // gün 1
    { coins: 300 },                    // gün 2
    { gold: 600 },                     // gün 3
    { coins: 400, keys: 1 },           // gün 4
    { gold: 1200 },                    // gün 5
    { coins: 600, gold: 800 },         // gün 6
    { keys: 3, gold: 1000 },           // gün 7: büyük ödül
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
  };
  const TRIPLE_BONUS = { keys: 3 };               // bölümün tümü 3★ → tek seferlik ANAHTAR

  // ---------- Zindanlar (ÖZ ZİNDANI → ANAHTAR ZİNDANI) ----------
  const DUNGEONS = {
    gold: { name: 'ALTIN ZİNDANI',    entries: 2, dur: 90, desc: 'Öldürme başına altın yağmuru' },
    key:  { name: 'ANAHTAR ZİNDANI',  entries: 2, dur: 90, desc: 'Anahtar hasadı — sandıkların tek ücretsiz kapısı' },
    boss: { name: 'BOSS SALDIRISI',   entries: 1, dur: 60, bossEvery: 12, desc: 'Kesintisiz boss akını' },
  };
  const DUNGEON_REWARD = {
    gold: r => ({ gold: 800 + r.kills * 8 }),
    key:  r => ({ keys: 1 + Math.floor(r.kills / 25), gold: 200 + r.kills * 2 }),
    boss: r => ({ gold: 600 + r.bosses * 200 }),
  };
  const DUNGEON_XP_NOTE = 'v4.0: battle pass kaldırıldı — zindan XP alanı yoktur';

  // ---------- Mağaza paketleri (simüle IAP — gerçek SDK bağlantı noktası Faz 38) ----------
  const BUNDLES = {
    starter:  { price: 4.99, once: true, gold: 5000, keys: 5, name: 'BAŞLANGIÇ PAKETİ' },
    key_pack: { price: 1.99, keys: 10, name: 'ANAHTAR KUTUSU' },
    gold_pack:{ price: 2.99, gold: 12000, name: 'ALTIN KUTUSU' },
  };

  const START_GOLD = 1000;

  return {
    RARITY, ITEM_RATES, CHEST_LUCK, chestRates,
    SLOTS, SLOT_INFO, ITEM_LVL_MAX, ITEM_GROWTH, itemUpgradeCost, itemUpgradeGain, statValue,
    FAMILIES, FAM_NAME, SET_BONUS, STAT_NAME,
    KEY_COST_GOLD, START_KEYS, CHEST_SRC, RECLEAR,
    PLANES, DEFAULT_PLANE, DAILY_REWARDS,
    CHAPTERS, STAGES_PER_CH, stageDuration, stageKillThr, STAR_HP_THR, chapterScale,
    FIRST_CLEAR, TRIPLE_BONUS,
    DUNGEONS, DUNGEON_REWARD, DUNGEON_XP_NOTE,
    BUNDLES, START_GOLD,
  };
})();
globalThis.META_DATA = META_DATA;
