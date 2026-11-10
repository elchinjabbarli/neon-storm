/* NEON STORM — meta.js : v4.0 SANDIK ÇAĞI mantığı (DOM'suz, Node testine uyumlu)
   Kökten yeniden tasarım (kullanıcı emri): gacha/pilot SİLİNDİ, sezon-yolu (battle-geçidi) SİLİNDİ,
   ekipman kazanımının TEK yolu sandıktır. Sandık yalnız bölüm ilk temizliğinden düşer,
   açmak için ANAHTAR ister (anahtar: zindan veya ⬡ altın). Meta üç direk:
   EKİPMAN + MAĞAZA (anahtar/paket) + PREMİUM UÇAKLAR.
   Kalıcılık: localStorage 'neonstorm_meta2_v1' — şema v3 (v2 göç: meta.js migrateV2) */
'use strict';
const META2 = (() => {
  const D = META_DATA;
  const SAVE_KEY = 'neonstorm_meta2_v1';

  // ---------- enjekte edilebilir rng / zaman (test determinizmi) ----------
  let rng = Math.random;
  let now = () => new Date();
  function setRng(f) { rng = f || Math.random; }
  function setNow(f) { now = f || (() => new Date()); }

  // ---------- durum ----------
  const DEF = () => ({
    v: 3,
    gold: D.START_GOLD, keys: D.START_KEYS,
    chests: [],                                                           // [{id, src, ch}] — sandık YALNIZ bölümden düşer
    nextChestId: 1,
    items: [],                                                            // {id, slot, rar, lvl, fam}
    itemLog: [],                                                          // son-5 düşme kaynağı {r, src}
    equipped: {},                                                         // slot → item id
    nextItemId: 1,
    planes: { vektor: true },                                             // sahip olunan uçaklar (premium uçaklar)
    prog: { ch: 1, st: 1, stars: {}, firstClear: {}, triple: {} },        // ch/st: sıradaki aşama
    dungeons: { d: '', gold: 0, key: 0, boss: 0 },
    bundles: {},                                                          // id → true
    daily: { last: '', streak: 0 },
    adKey: { d: '', n: 0 },                                               // v4.0: bedava anahtar reklamı (günlük ≤3)
    stats: { chestsOpened: 0, stagesCleared: 0, dungeonsDone: 0 },
  });

  let S = null;
  // v4.0 göç: v2 şeması (oz/shards/stones/pity/pulls/stars/sezon/pilots) → v3 SANDIK ÇAĞI.
  // Dürüstlük: değerler KAYBOLMAZ — ✧öz→⬡altın (×4), ◇parça→⬡altın (×40), taşlar→⬡iade (kademe fiyatı).
  // items/equipped SIFIRLANIR (eski kazanım yolları kapatıldı; yeni kimlik: ekipman yalnız sandıktan).
  // Anahtar telafisi: +2 (zincir hemen yaşanabilsin). Uçaklar: yalnız VEKTÖR hediye (premium uçaklar ◈/IAP).
  function migrateV2(d) {
    const g = typeof d.gold === 'number' ? d.gold : D.START_GOLD;
    const oz = typeof d.oz === 'number' ? d.oz : 0;
    const shards = typeof d.shards === 'number' ? d.shards : 0;
    const st = d.stones && typeof d.stones === 'object' ? d.stones : {};
    const stoneGold = ((st.N | 0) * 150) + ((st.R | 0) * 250) + ((st.SR | 0) * 500);
    const base = DEF();
    base.gold = g + oz * 4 + shards * 40 + stoneGold;
    base.keys = D.START_KEYS;
    base.daily = d.daily && typeof d.daily === 'object' ? d.daily : base.daily;
    base.bundles = d.bundles && typeof d.bundles === 'object' ? d.bundles : {};
    base.prog = d.prog && typeof d.prog === 'object' ? d.prog : base.prog;
    if (base.prog.firstClear) delete base.prog.firstClear;   // sandıklar yeniden kazanılabilsin (tek seferlik telafi)
    base.stats = { chestsOpened: 0, stagesCleared: (d.stats && d.stats.stagesCleared) || 0, dungeonsDone: (d.stats && d.stats.dungeonsDone) || 0 };
    return base;
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d && d.v === 3) { S = { ...DEF(), ...d }; return; }
        if (d && d.v === 2) { S = migrateV2(d); save(); return; }
      }
    } catch (e) { }
    S = DEF();
    save();
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
  function state() { return S; }
  function resetForTest() { S = DEF(); save(); }

  // ==================== SANDIK + ANAHTAR (v4.0 TEK KAZANIM ZİNCİRİ) ====================
  // Kazanım sözleşmesi: sandık YALNIZ completeStage (bölüm ilk temizlik) üretir.
  // Açılış YALNIZ anahtarla (zindan/mağaza/reklam) veya ⬡ altınla.
  function grantChest(src, ch) {
    const c = { id: S.nextChestId++, src: src || 'bölüm', ch: Math.max(1, ch | 0 || 1) };
    S.chests.push(c);
    return c;
  }
  function chestCount() { return S.chests.length; }
  function chests() { return S.chests.slice(); }
  function keyInfo() { return { keys: S.keys, cost: D.KEY_COST_GOLD }; }
  function rollChestRar(ch) {
    const r = rng(), R = D.chestRates(ch);
    if (r < R.SSR) return 'SSR';
    if (r < R.SSR + R.SR) return 'SR';
    if (r < R.SSR + R.SR + R.R) return 'R';
    return 'N';
  }
  // açılış: useGold=true → anahtar yoksa ⬡ ile açar; aksi halde anahtar harcar.
  // dönüş: {item, rar, paidWith:'anahtar'|'altın'} | null (neden: 'sandık yok'|'anahtar yok')
  function openChest(useGold) {
    if (!S.chests.length) return null;
    let paidWith = 'anahtar';
    if (S.keys > 0) { S.keys--; }
    else if (useGold && S.gold >= D.KEY_COST_GOLD) { S.gold -= D.KEY_COST_GOLD; paidWith = 'altın'; }
    else return null;
    const chest = S.chests.shift();
    const it = makeItem(rollChestRar(chest.ch), 'sandık (' + chest.src + ')');
    S.stats.chestsOpened++;
    save();
    // sandık açılışı günlük 'chest' görevini sayar (quests yüklüyse)
    try { if (typeof QUESTS !== 'undefined' && QUESTS.onEvent) QUESTS.onEvent('chest', 1); } catch (e) { }
    return { item: it, rar: it.rar, paidWith, chest };
  }

  // ==================== EKİPMAN ====================
  function makeItem(rar, src) {
    const slot = D.SLOTS[Math.floor(rng() * D.SLOTS.length)];
    const fam = D.FAMILIES[Math.floor(rng() * D.FAMILIES.length)];
    const it = { id: S.nextItemId++, slot, rar, lvl: 0, fam };
    S.items.push(it);
    if (!S.itemLog) S.itemLog = [];
    S.itemLog.push({ r: it.rar, src: src || 'bilinmeyen' });
    if (S.itemLog.length > 5) S.itemLog = S.itemLog.slice(-5);
    return it;
  }
  function itemLog() { return (S.itemLog || []).slice().reverse(); }
  function itemStat(it) { return D.statValue(it.slot, it.rar, it.lvl); }
  // kuşanma karşılaştırması — parçanın o anki kuşanılanla stat farkı
  function itemDelta(id) {
    const it = S.items.find(x => x.id === id);
    if (!it) return null;
    const curIt = S.items.find(x => x.id === S.equipped[it.slot]);
    const cur = curIt ? D.statValue(it.slot, curIt.rar, curIt.lvl) : 0;
    const next = D.statValue(it.slot, it.rar, it.lvl);
    return { cur, next, d: next - cur, stat: D.SLOT_INFO[it.slot].stat, slot: it.slot };
  }
  // envanter KAZANÇ SIRASI — kuşanılabilir en iyi kazanç üstte, kuşanmışlar sonda
  function invGainOrder(inv) {
    const list = (inv || []).map(it => {
      const dl = itemDelta(it.id);
      return {
        id: it.id,
        isEq: !!it.slot && S.equipped[it.slot] === it.id,
        d: dl ? dl.d : -Infinity,
        si: Math.max(0, D.SLOTS.indexOf(it.slot)),
      };
    });
    list.sort((a, b) => (a.isEq - b.isEq) || (b.d - a.d) || (a.si - b.si) || (a.id - b.id));
    return list.map(x => x.id);
  }
  // kuşanmış parçaların aile sayımı (set bonusu TEK hesap)
  function famCounts() {
    const c = {};
    for (const slot of D.SLOTS) {
      const id = S.equipped[slot];
      if (!id) continue;
      const it = S.items.find(x => x.id === id);
      if (it) c[it.fam] = (c[it.fam] || 0) + 1;
    }
    return c;
  }
  function setBonusLine(counts) {
    const c = counts || {};
    const parts = [];
    for (const f of D.FAMILIES) {
      const n = c[f] || 0;
      if (n < 2) continue;
      const gains = [];
      for (const tier of [2, 4, 6]) {
        if (n >= tier && D.SET_BONUS[tier]) {
          for (const k in D.SET_BONUS[tier]) {
            gains.push('+' + Math.round(D.SET_BONUS[tier][k] * 100) + '% ' + (D.STAT_NAME[k] || k));
          }
        }
      }
      let seg = (D.FAM_NAME[f] || f) + ' ×' + n + ' → ' + gains.join(' + ');
      const nextTier = [2, 4, 6].find(t => t > n);
      if (nextTier) seg += ' · ' + (nextTier - n) + ' parça kaldı';
      parts.push(seg);
    }
    return parts.length ? 'AİLE SETİ: ' + parts.join(' | ') : '';
  }
  function inventory() { return S.items.slice(); }
  function equipped() { return { ...S.equipped }; }
  function equip(itemId) {
    const it = S.items.find(x => x.id === itemId);
    if (!it) return false;
    S.equipped[it.slot] = itemId;
    save();
    return true;
  }
  function upgradeItem(itemId) {
    const it = S.items.find(x => x.id === itemId);
    if (!it || it.lvl >= D.ITEM_LVL_MAX) return false;
    const cost = D.itemUpgradeCost(it.rar, it.lvl);
    if (S.gold < cost) return false;
    S.gold -= cost;
    it.lvl++;
    save();
    return true;
  }
  function sellItem(itemId) {
    const i = S.items.findIndex(x => x.id === itemId);
    if (i < 0) return 0;
    const it = S.items[i];
    if (S.equipped[it.slot] === itemId) delete S.equipped[it.slot];
    const val = Math.floor(40 * D.RARITY[it.rar].mult * (1 + it.lvl * 0.5));
    S.items.splice(i, 1);
    S.gold += val;
    save();
    return val;
  }
  // kuşanmış 6 parçadan toplu mod + aile seti bonusu
  function equipMods() {
    const m = { dmg: 1, hp: 1, spd: 1, mag: 1, crit: 0, regen: 0 };
    for (const slot of D.SLOTS) {
      const id = S.equipped[slot];
      if (!id) continue;
      const it = S.items.find(x => x.id === id);
      if (!it) continue;
      const v = itemStat(it);
      const st = D.SLOT_INFO[slot].stat;
      m[st] += v;              // dmg/hp/spd/mag: additive multiplier birikimi; crit/regen: düz ekleme
    }
    const famCount = famCounts();
    const addSet = b => { for (const k in b) m[k] += b[k]; };
    for (const f in famCount) {
      const same = famCount[f];
      if (same >= 2) addSet(D.SET_BONUS[2]);
      if (same >= 4) addSet(D.SET_BONUS[4]);
      if (same >= 6) addSet(D.SET_BONUS[6]);
    }
    m.crit = Math.min(0.5, m.crit);
    return m;
  }
  // v4.0: pilot yıldızı YOK — run çarpanı = uçak modsu (game.js uygular) × ekipman
  function runMods() { return equipMods(); }

  // ==================== GÜNLÜK GİRİŞ SERİSİ ====================
  function yesterdayKey() {
    const dt = new Date(now().getTime() - 86400000);
    return dt.toISOString().slice(0, 10);
  }
  function dailyStatus() {
    const canClaim = S.daily.last !== dayKey();
    let day;
    if (canClaim) {
      const nextStreak = S.daily.last === yesterdayKey() ? S.daily.streak + 1 : 1;
      day = ((nextStreak - 1) % 7) + 1;
    } else {
      day = ((S.daily.streak - 1) % 7) + 1;
    }
    return { canClaim, day, streak: S.daily.streak, rewards: D.DAILY_REWARDS };
  }
  function claimDaily() {
    const today = dayKey();
    if (S.daily.last === today) return null;
    S.daily.streak = S.daily.last === yesterdayKey() ? S.daily.streak + 1 : 1;
    S.daily.last = today;
    const day = ((S.daily.streak - 1) % 7) + 1;
    const r = D.DAILY_REWARDS[day - 1];
    applyReward(r);
    save();
    return { day, streak: S.daily.streak, reward: r };
  }

  // ==================== BÖLÜM HARİTASI ====================
  function prog() { return S.prog; }
  function unlocked(ch, st) {
    if (ch < 1 || ch > D.CHAPTERS.length || st < 1 || st > D.STAGES_PER_CH) return false;
    if (ch < S.prog.ch) return true;
    if (ch > S.prog.ch) return false;
    return st <= S.prog.st;
  }
  function stageConfig(ch, st) {
    return {
      ch, st,
      duration: D.stageDuration(st),
      hpMul: D.chapterScale.hp(ch, st),
      dmgMul: D.chapterScale.dmg(ch),
      spawnMul: D.chapterScale.spawn(ch),
    };
  }

  // ==================== ÖLÜM EKRANI MOTİVASYONU ====================
  const NM_BOSS_PCT_MAX = 50;
  function nearMissRecordBand(best) { return Math.max(100, Math.floor((best || 0) * 0.12)); }
  const NM_REC_SCORE_SHARE = 0.25;
  function nearMiss(o) {
    if (!o) return null;
    if (o.bossHpPct > 0 && o.bossHpPct <= NM_BOSS_PCT_MAX) return { kind: 'boss', pct: o.bossHpPct };
    const recDiff = o.bestScore > 50 && o.score < o.bestScore
      ? o.bestScore - o.score : 0;
    if (recDiff > 0 && recDiff <= nearMissRecordBand(o.bestScore) && recDiff <= Math.floor(o.score * NM_REC_SCORE_SHARE))
      return { kind: 'record', diff: recDiff };
    const tDiff = o.bestTime > 60 && o.time < o.bestTime
      ? o.bestTime - o.time : 0;
    if (tDiff > 0 && tDiff <= 20)
      return { kind: 'time', diff: Math.ceil(tDiff) };
    if (o.nextStage) return { kind: 'stage', name: o.nextStage };
    return null;
  }
  // ==================== AŞAMA TAMAMLIK (SANDIĞIN TEK DOĞUM YERİ) ====================
  // İlk temizlik → SANDIK (her bölümde 1 ekipman garantisi) + ◈/⬡.
  // Tekrar temizlik → yalnız ◈/⬡ (RECLEAR) — sandık farm edilemez.
  function completeStage(ch, st, res) {
    if (S.prog.ch !== ch || S.prog.st !== st) return null;      // yalnız sıradaki aşama
    let stars = 1;
    if (res.kills >= D.stageKillThr(st)) stars++;
    if (res.hpFrac >= D.STAR_HP_THR) stars++;
    const key = ch + '-' + st;
    const prev = S.prog.stars[key] || 0;
    if (stars > prev) S.prog.stars[key] = stars;
    S.stats.stagesCleared++;
    let first = null;
    let chest = null;
    const fcKey = 'fc-' + key;
    if (!S.prog.firstClear[fcKey]) {
      S.prog.firstClear[fcKey] = true;
      first = {
        coins: D.FIRST_CLEAR.coins(ch),
        gold: D.FIRST_CLEAR.gold(ch),
      };
      chest = grantChest(D.CHEST_SRC.stage, ch);               // HER BÖLÜMDE 1 SANDIK = 1 EKİPMAN
      S._pendCoins = (S._pendCoins || 0) + first.coins;
      S.gold += first.gold;
    } else {
      const rc = { coins: D.RECLEAR.coins(ch), gold: D.RECLEAR.gold(ch) };
      S._pendCoins = (S._pendCoins || 0) + rc.coins;
      S.gold += rc.gold;
      first = { coins: rc.coins, gold: rc.gold, reclear: true };
    }
    // bölüm bitti mi?
    let advanced = null;
    let triple = null;
    if (st >= D.STAGES_PER_CH) {
      let all3 = true;
      for (let i = 1; i <= D.STAGES_PER_CH; i++) if ((S.prog.stars[ch + '-' + i] || 0) < 3) all3 = false;
      if (all3 && !S.prog.triple['t-' + ch]) {
        S.prog.triple['t-' + ch] = true;
        triple = { keys: D.TRIPLE_BONUS.keys };
        S.keys += triple.keys;
      }
      if (ch < D.CHAPTERS.length) { S.prog = { ...S.prog, ch: ch + 1, st: 1 }; advanced = { ch: ch + 1 }; }
    } else {
      S.prog = { ...S.prog, st: st + 1 };
      advanced = { st: st + 1 };
    }
    save();
    return { stars, first, chest, triple, advanced };
  }

  // ==================== ZİNDANLAR ====================
  let pending = null;                                   // {stage:{ch,st}} | {dungeon:kind}
  function startStage(ch, st) {
    if (!unlocked(ch, st)) return false;
    pending = { stage: { ch, st } };
    return true;
  }
  function startDungeon(kind) {
    if (!D.DUNGEONS[kind]) return false;
    ensureDungeons();
    if (S.dungeons[kind] >= D.DUNGEONS[kind].entries) return false;
    pending = { dungeon: kind };
    return true;
  }
  function takePending() {
    const p = pending;
    pending = null;
    if (!p) return {};
    if (p.stage) return { stageCfg: stageConfig(p.stage.ch, p.stage.st) };
    if (p.dungeon) {
      S.dungeons[p.dungeon]++;
      save();
      return { dungeonCfg: { kind: p.dungeon, duration: D.DUNGEONS[p.dungeon].dur, bossEvery: D.DUNGEONS[p.dungeon].bossEvery || 0 } };
    }
    return {};
  }

  function dayKey(d) { const dt = d || now(); return dt.toISOString().slice(0, 10); }
  function ensureDungeons() {
    const dk = dayKey();
    if (S.dungeons.d !== dk) S.dungeons = { d: dk, gold: 0, key: 0, boss: 0 };
  }
  function dungeonStatus() {
    ensureDungeons();
    const out = {};
    for (const k in D.DUNGEONS) out[k] = { left: D.DUNGEONS[k].entries - S.dungeons[k], total: D.DUNGEONS[k].entries };
    return out;
  }
  function dungeonReward(kind, res) {
    const r = D.DUNGEON_REWARD[kind](res);
    if (r.gold) S.gold += r.gold;
    if (r.keys) S.keys += r.keys;
    S.stats.dungeonsDone++;
    save();
    return r;
  }

  // ==================== MAĞAZA ====================
  function buyKey() {
    if (S.gold < D.KEY_COST_GOLD) return false;
    S.gold -= D.KEY_COST_GOLD;
    S.keys++;
    save();
    return true;
  }
  function buyBundle(id) {
    const b = D.BUNDLES[id];
    if (!b) return null;
    if (b.once && S.bundles[id]) return null;
    // GERÇEK IAP BAĞLANTI NOKTASI (Faz 38): makbuz doğrulaması burada yapılacak.
    S.bundles[id] = true;
    if (b.gold) S.gold += b.gold;
    if (b.keys) S.keys += b.keys;
    save();
    return { ok: true, gold: b.gold || 0, keys: b.keys || 0 };
  }
  function bundleOwned(id) { return !!S.bundles[id]; }

  // ==================== PREMİUM UÇAKLAR ====================
  // ◈ coin satın alımı game.js'te (META.coins tek doğruluk kaynağı orada); META2 yalnız sahiplik tutar.
  function planeOf(id) { return D.PLANES[id] || D.PLANES[D.DEFAULT_PLANE]; }
  function planes() { return D.PLANES; }
  function planeOwned(id) { return !!S.planes[id]; }
  function grantPlane(id) {
    if (!D.PLANES[id]) return false;
    S.planes[id] = true;
    save();
    return true;
  }

  // ==================== PARA EKLE ====================
  function applyReward(r) {
    if (r.coins) S._pendCoins = (S._pendCoins || 0) + r.coins;
    if (r.gold) S.gold += r.gold;
    if (r.keys) S.keys += r.keys;
  }
  function takePendingCoins() { const c = S._pendCoins || 0; S._pendCoins = 0; return c; }
  function addGold(n) { S.gold += n; save(); }
  function addKeys(n) { S.keys += n; save(); }
  function currencies() { return { gold: S.gold, keys: S.keys }; }

  // ==================== BEDAVA ANAHTAR İZLE (v4.0 — rewarded, Tavan D) ====================
  // Eski 'bedava kasa' SİLİNDİ (ekipman kazanımı yalnız sandıktan); reklam artık ANAHTAR verir.
  const AD_KEY_DAILY = 3;
  function adKeyStatus() {
    const today = dayKey();
    if (S.adKey.d !== today) { S.adKey = { d: today, n: 0 }; }
    return { count: S.adKey.n, left: Math.max(0, AD_KEY_DAILY - S.adKey.n), max: AD_KEY_DAILY };
  }
  function watchKeyAd() {
    const st = adKeyStatus();
    if (st.left <= 0) return null;
    S.adKey.n++;
    S.keys++;
    save();
    return { keys: 1, left: st.left - 1, max: st.max };
  }

  load();
  return {
    // çekirdek
    state, save, resetForTest, setRng, setNow,
    // sandık + anahtar
    grantChest, chestCount, chests, keyInfo, openChest, buyKey, rollChestRar,
    load,   // kalıcılık testi (gidiş-dönüş)
    // ekipman
    itemLog, itemDelta, invGainOrder, famCounts, setBonusLine, inventory, equipped, equip, upgradeItem, sellItem, equipMods, runMods, itemStat,
    makeItem,                                     // test/ölüm-ekrani yok — yalnız sandık üretir (dış kullanım yasak değil, kaynak etiketi şart)
    // günlük seri
    dailyStatus, claimDaily,
    // harita
    prog, unlocked, stageConfig, completeStage, startStage, startDungeon, takePending,
    // ölüm ekranı motivasyonu
    nearMiss, nearMissRecordBand,
    // zindan
    dungeonStatus, dungeonReward,
    // mağaza + paketler
    buyBundle, bundleOwned,
    // premium uçaklar
    planeOf, planes, planeOwned, grantPlane,
    // para
    addGold, addKeys, currencies, applyReward, takePendingCoins,
    // bedava anahtar reklamı
    adKeyStatus, watchKeyAd,
    // v4.0 göç (test)
    migrateV2,
  };
})();
globalThis.META2 = META2;
