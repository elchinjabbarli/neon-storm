/* NEON STORM — meta.js : v2.0 gelir motoru mantığı (DOM'suz, Node testine uyumlu)
   Gacha (pity) + ekipman + bölüm haritası + zindanlar + battle pass + paket mağazası.
   Kalıcılık: localStorage 'neonstorm_meta2_v1' */
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
    v: 2,
    gold: D.START_GOLD, oz: D.START_OZ, shards: 0,
    stones: { N: 0, R: 0, SR: 0 },                                        // v2.16 kademe anahtarlı taş stoğu
    pity: 0, pulls: 0,
    owned: { vektor: true, pyra: false, glacia: false, nova9: false },   // gacha ile açılanlar
    stars: {},                                                            // pilotId → yıldız (1..5)
    items: [],                                                            // {id, slot, rar, lvl, fam}
    itemLog: [],                                                          // v2.31: son-5 düşme kaynağı {r, src} — hedef B görünürlük
    equipped: {},                                                         // slot → item id
    nextItemId: 1,
    prog: { ch: 1, st: 1, stars: {}, firstClear: {}, triple: {} },        // ch/st: sıradaki aşama
    dungeons: { d: '', gold: 0, essence: 0, boss: 0 },
    pass: { season: '', xp: 0, lvl: 1, premium: false, claimedFree: {}, claimedPrem: {} },
    bundles: {},                                                          // id → true
    daily: { last: '', streak: 0 },                                       // v2.6 günlük giriş serisi
    adCrate: { d: '', n: 0 },                                             // v2.9 bedava kasa (günlük ≤3)
    stats: { pullsTotal: 0, stagesCleared: 0, dungeonsDone: 0 },
  });

  let S = null;
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) { const d = JSON.parse(raw); if (d && d.v === 2) { S = { ...DEF(), ...d }; migrateStones(S); return; } }
    } catch (e) { }
    S = DEF();
    save();
  }
  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { } }
  function state() { return S; }
  function resetForTest() { S = DEF(); save(); }   // v2.36: disk de sıfırlansın — eski profil reload'da dirilmesin (koşu #31 sweep dersi; test-only fn, oyuncu akışına dokunmaz)

  // ==================== GACHA ====================
  function rollRarity() {
    S.pity++;
    let ssr = D.RATES.SSR;
    if (S.pity >= D.PITY.soft) ssr += D.PITY.softStep * (S.pity - D.PITY.soft + 1);
    if (S.pity >= D.PITY.hard) return 'SSR';                    // sert garanti
    const r = rng();
    if (r < ssr) return 'SSR';
    if (r < ssr + D.RATES.SR) return 'SR';
    if (r < ssr + D.RATES.SR + D.RATES.R) return 'R';
    return 'N';
  }
  function poolOf(rar) {
    const ids = [];
    for (const id in D.NEW_PILOTS) if (D.NEW_PILOTS[id].rar === rar) ids.push(id);
    for (const id in D.CORE_PILOTS) if (D.CORE_PILOTS[id] === rar) ids.push(id);
    return ids;
  }
  // tek çekiliş → {pilot, rar, dupe, shards}
  function pullOnce() {
    const rar = rollRarity();
    const pool = poolOf(rar);
    const id = pool[Math.floor(rng() * pool.length)];
    S.pulls++; S.stats.pullsTotal++;
    let dupe = false, gain = 0;
    if (S.owned[id]) { dupe = true; gain = D.RARITY[rar].shards; S.shards += gain; }
    else { S.owned[id] = true; }
    if (rar === 'SSR') S.pity = 0;                              // pity reset
    return { id, rar, dupe, shards: gain };
  }
  function pull1() {
    if (S.oz < D.PULL_COST) return null;
    S.oz -= D.PULL_COST;
    const r = pullOnce();
    save();
    return [r];
  }
  function pull10() {
    if (S.oz < D.PULL10_COST) return null;
    S.oz -= D.PULL10_COST;
    const out = [];
    for (let i = 0; i < 10; i++) out.push(pullOnce());
    save();
    return out;
  }
  function pityInfo() { return { pity: S.pity, soft: D.PITY.soft, hard: D.PITY.hard }; }
  // İSTİHBARAT #4 (v2.30): gacha oran görünürlüğü — tek doğruluk kaynağı D.RATES; UI metni buradan
  // üretilir (elle yazma yasak). Kademe sırası sabit: SSR→SR→R→N. round sum testi ±1 toleranslı.
  function ratesLine() {
    return ['SSR', 'SR', 'R', 'N'].map(k => k + ' %' + Math.round(D.RATES[k] * 100)).join(' · ');
  }

  // ---------- yıldız ----------
  function starLevel(id) { return S.stars[id] || 0; }
  function starUp(id) {
    const cur = starLevel(id);
    if (!S.owned[id] || cur >= D.STAR_MAX) return false;
    const cost = D.STAR_COST[cur];
    if (S.shards < cost) return false;
    S.shards -= cost;
    S.stars[id] = cur + 1;
    save();
    return true;
  }
  function starBonus(id) {
    const st = starLevel(id);
    return { dmg: 1 + D.STAR_BONUS.dmg * st, hp: 1 + D.STAR_BONUS.hp * st };
  }

  // ==================== EKİPMAN ====================
  function rollItemRar() {
    const r = rng(), R = D.ITEM_RATES;
    if (r < R.SSR) return 'SSR';
    if (r < R.SSR + R.SR) return 'SR';
    if (r < R.SSR + R.SR + R.R) return 'R';
    return 'N';
  }
  function makeItem(rar, src) {
    const slot = D.SLOTS[Math.floor(rng() * D.SLOTS.length)];
    const fam = D.FAMILIES[Math.floor(rng() * D.FAMILIES.length)];
    const it = { id: S.nextItemId++, slot, rar, lvl: 0, fam };
    S.items.push(it);
    // v2.31 (hedef B — koşu #27 işi 2): drop-kaynağı günlüğü — TEK ÜRETİM NOKTASI burası
    // (grantItem + fuseItems ikisi de makeItem çağırır). Son-5 halka tampon: eski kayıt
    // itemLog'suz geldiğinde de güvenli (S.itemLog spread DEF'ten [] gelir).
    if (!S.itemLog) S.itemLog = [];
    S.itemLog.push({ r: it.rar, src: src || 'bilinmeyen' });
    if (S.itemLog.length > 5) S.itemLog = S.itemLog.slice(-5);
    return it;
  }
  function grantItem(rar, src) { const it = makeItem(rar || rollItemRar(), src); save(); return it; }
  // v2.31: en yeni başta (renderEquip doğrudan basar)
  function itemLog() { return (S.itemLog || []).slice().reverse(); }
  // v2.31 (hedef C+D — koşu #27 işi 3): çek x10 sonuç özeti — v2.30 ratesLine'ın devamı.
  // Saf sayım fn: [{rar}×10] → 'N×6 · R×3 · SR×1'. Artan sıra N→R→SR→SSR (payoff sonda),
  // sıfır kademe atlanır (boş sonuç → ''). UI metni ELLE yazılmaz — tek doğruluk kaynağı burası.
  function pullSummary(res) {
    const n = {};
    (res || []).forEach(r => { n[r.rar] = (n[r.rar] || 0) + 1; });
    return ['N', 'R', 'SR', 'SSR'].filter(k => n[k]).map(k => k + '×' + n[k]).join(' · ');
  }
  function itemStat(it) { return D.statValue(it.slot, it.rar, it.lvl); }
  // v2.32 (hedef B+G — koşu #28 işi 2): KUŞANMA KARŞILAŞTIRMASI — parçanın o anki kuşanılanla
  // stat farkı (itemLog'un doğal devamı; 'stat ekranda var' ilkesi — v2.29 dersi).
  // SAF: yalnız S.items + D.statValue okur; UI etiketini d.stat'tan üretir (elle yazma yasak).
  function itemDelta(id) {
    const it = S.items.find(x => x.id === id);
    if (!it) return null;
    const curIt = S.items.find(x => x.id === S.equipped[it.slot]);
    const cur = curIt ? D.statValue(it.slot, curIt.rar, curIt.lvl) : 0;
    const next = D.statValue(it.slot, it.rar, it.lvl);
    return { cur, next, d: next - cur, stat: D.SLOT_INFO[it.slot].stat, slot: it.slot };
  }
  // v2.33 (hedef B — koşu #29 işi 3): envanter KAZANÇ SIRASI — delta karar bilgisinin 2. yarısı.
  // Boşta parçalar KUŞANILIRSA deltasına göre azalan (en iyi kazanç üstte), kuşanmışlar sonda;
  // eşitlikte slot sırası + id (gruplama korunur, kararsız sıra yok); null-delta (bilinmeyen id)
  // en sona düşer — çökmez. SAF: sıralı id dizisi döner, S MUTASYON YAPMAZ.
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
  // v2.35 (hedef B+G — koşu #31 işi 2): kuşanmış parçaların AİLE SAYIMI — equipMods ile AYNI hesap
  // (tek doğruluk kaynağı; UI set satırı bunu setBonusLine'a verir). SAF: S MUTASYON YAPMAZ.
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
  // v2.35 (hedef B+G — koşu #31 işi 2): AİLE SETİ BONUSU GÖRÜNÜRLÜĞÜ — equipMods seti UYGULUYOR
  // ama oyuncu göremiyordu (v2.29 'stat ekranda var' ilkesinin son kör noktası).
  // SAF: counts → 'AİLE SETİ: STROM ×3 → +5% HASAR · 1 parça kaldı | HALO ×2 → +5% HASAR · 2 parça kaldı'
  // Kaynaklar ELLE YAZILMAZ: bonus D.SET_BONUS, aile adı D.FAM_NAME, stat adı D.STAT_NAME.
  // Kademeler equipMods ile aynı kümülatif mantık (≥2 / ≥4 / ≥6 hepsi eklenir); n<2 aile sessiz;
  // aile sırası D.FAMILIES (deterministik); kademe yoksa '' (UI satırı gizler — nazik boşluk).
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
      if (st === 'crit' || st === 'regen') m[st] += v;
      else m[st] += v;              // dmg/hp/spd/mag: additive multiplier birikimi
    }
    const famCount = famCounts();   // v2.35: aile sayımı TEK yerde (UI set satırıyla aynı hesap)
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
  // pilot yıldız + ekipman + set → run çarpanları
  function runMods(charId) {
    const sb = starBonus(charId);
    const em = equipMods();
    return {
      dmg: sb.dmg * em.dmg,
      hp: sb.hp * em.hp,
      spd: em.spd,
      mag: em.mag,
      crit: em.crit,
      regen: em.regen,
    };
  }

  // ==================== BİRLEŞTİRME (FUSION) — v2.6 ====================
  // 3 aynı nadirlik (kuşanmamış) → 1 üst nadirlik. N→R→SR→SSR; SSR zirve, füzyonlanamaz.
  const FUSE_CHAIN = D.FUSE_FROM.concat('SSR');              // ['N','R','SR','SSR']
  function isEquipped(id) { for (const k in S.equipped) if (S.equipped[k] === id) return true; return false; }
  function fuseCounts() {
    const c = { N: 0, R: 0, SR: 0, SSR: 0 };
    for (const it of S.items) if (!isEquipped(it.id)) c[it.rar] = (c[it.rar] || 0) + 1;
    return c;
  }
  function fuseItems(rar) {
    const idx = FUSE_CHAIN.indexOf(rar);
    if (idx < 0 || idx >= FUSE_CHAIN.length - 1) return null;  // SSR / bilinmeyen → ret
    const pool = S.items.filter(it => it.rar === rar && !isEquipped(it.id));
    if (pool.length < D.FUSE_COUNT) return null;
    pool.sort((a, b) => a.lvl - b.lvl);                        // düşük lvl önce harcanır (oyuncu lehine)
    const used = pool.slice(0, D.FUSE_COUNT);
    for (const u of used) S.items.splice(S.items.findIndex(x => x.id === u.id), 1);
    const it = makeItem(FUSE_CHAIN[idx + 1], 'birleştirme');
    save();
    // v2.8 (hedef E): birleştirme artık günlük 'fuse' görevini sayar (quests yüklüyse)
    try { if (typeof QUESTS !== 'undefined' && QUESTS.onEvent) QUESTS.onEvent('fuse', 1); } catch (e) { }
    return it;
  }

  // ==================== YÜKSELTME TAŞI (v2.15, hedef B — v2.16 kademeli ekonomi) ====================
  // Ekipman = ana sistem: taş, birleştirme zincirinin (N→R→SR→SSR) hızlı alternatifi.
  // Füzyon bedava ama 3 aynı parça ister; taş ⬡ altınla alınır, 1 parçayı garanti atlatır.
  // v2.16 (hedef A): fiyat kademeli — N→R 150 / R→SR 250 / SR→SSR 500 (SSR'a toplam 900⬡).
  // Stok KADEME ANAHTARLI: taş N stoğu yalnız N parçayı atlar. Neden: genel stok + kademeli
  // fiyat = "N stoğunu 150'ye al, sonra SR parçada yak" açığı; anahtarlı stok açığı kökten kapatır.
  const STONE_TIERS = { N: 150, R: 250, SR: 500 };
  const RAR_CHAIN = ['N', 'R', 'SR', 'SSR'];
  // v2.16 göç: v2.15 kayıtları sayısal stones taşır — 250⬡ ödediler, R kademesi (250) karşılığı
  // R stoğuna sayılır; değer kaybı sıfır, kullanılabilirlik R+ envanterde korunur.
  function migrateStones(d) {
    if (!d || typeof d !== 'object') return d;
    if (typeof d.stones === 'number') d.stones = { N: 0, R: d.stones, SR: 0 };
    else if (!d.stones || typeof d.stones !== 'object') d.stones = { N: 0, R: 0, SR: 0 };
    else d.stones = { N: d.stones.N | 0, R: d.stones.R | 0, SR: d.stones.SR | 0 };
    return d;
  }
  function stoneTotals() { const t = S.stones || {}; return (t.N | 0) + (t.R | 0) + (t.SR | 0); }
  // vitrin satırı: envanterdeki EN UCUZ uygulanabilir atlamanın kademesi (parça yoksa N)
  function stoneNextTier() {
    for (const rar of ['N', 'R', 'SR']) if (S.items.some(x => x.rar === rar)) return rar;
    return 'N';
  }
  function stoneInfo() {
    const tier = stoneNextTier();
    return { n: stoneTotals(), tiers: { N: S.stones.N | 0, R: S.stones.R | 0, SR: S.stones.SR | 0 },
      price: STONE_TIERS, nextTier: tier, nextPrice: STONE_TIERS[tier] };
  }
  function buyStone(tier) {
    const t = tier || stoneNextTier();
    if (!(t in STONE_TIERS) || S.gold < STONE_TIERS[t]) return false;
    S.gold -= STONE_TIERS[t];
    S.stones[t] = (S.stones[t] | 0) + 1;
    save();
    return true;
  }
  function useStone(itemId) {
    const it = S.items.find(x => x.id === itemId);
    if (!it) return null;
    const i = RAR_CHAIN.indexOf(it.rar);
    if (i < 0 || i >= RAR_CHAIN.length - 1) return null;      // SSR zirve → taş yakılmaz
    if (!((S.stones[it.rar] | 0) > 0)) return null;           // v2.16: yanlış kademenin taşı yakılmaz
    S.stones[it.rar]--;
    it.rar = RAR_CHAIN[i + 1];
    save();
    return it;
  }

  // ==================== GÜNLÜK GİRİŞ SERİSİ — v2.6 ====================
  function yesterdayKey() {
    const dt = new Date(now().getTime() - 86400000);
    return dt.toISOString().slice(0, 10);
  }
  // canClaim + sıradaki/son gün (1..7) + seri
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
    if (S.daily.last === today) return null;                   // bugün alındı
    S.daily.streak = S.daily.last === yesterdayKey() ? S.daily.streak + 1 : 1;
    S.daily.last = today;
    const day = ((S.daily.streak - 1) % 7) + 1;
    const r = D.DAILY_REWARDS[day - 1];
    applyReward(r);
    if (r.item) grantItem(r.item, 'günlük ödül');
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

  // ==================== ÖLÜM EKRANI MOTİVASYONU (v2.7, hedef E) ====================
  // Saf fonksiyon (test-first): koşu sonunda "az kalsın X'e çıkacaktın" satırını üretir.
  // Öncelik: canlı BOSS > rekor SKOR > rekor SÜRE > sıradaki AŞAMA.
  function nearMiss(o) {
    if (!o) return null;
    if (o.bossHpPct > 0) return { kind: 'boss', pct: o.bossHpPct };
    const recDiff = o.bestScore > 50 && o.score < o.bestScore
      ? o.bestScore - o.score : 0;
    if (recDiff > 0 && recDiff <= Math.max(100, Math.floor(o.bestScore * 0.12)))
      return { kind: 'record', diff: recDiff };
    const tDiff = o.bestTime > 60 && o.time < o.bestTime
      ? o.bestTime - o.time : 0;
    if (tDiff > 0 && tDiff <= 20)
      return { kind: 'time', diff: Math.ceil(tDiff) };
    if (o.nextStage) return { kind: 'stage', name: o.nextStage };
    return null;
  }
  // sonuç: {kills, hpFrac} → yıldız + ödül
  function completeStage(ch, st, res) {
    if (S.prog.ch !== ch || S.prog.st !== st) return null;      // yalnız sıradaki aşama
    let stars = 1;
    if (res.kills >= D.stageKillThr(st)) stars++;
    if (res.hpFrac >= D.STAR_HP_THR) stars++;
    const key = ch + '-' + st;
    const prev = S.prog.stars[key] || 0;
    if (stars > prev) S.prog.stars[key] = stars;
    S.stats.stagesCleared++;
    // ilerleme: sonraki aşama/bölüm
    let first = null;
    const fcKey = 'fc-' + key;
    if (!S.prog.firstClear[fcKey]) {
      S.prog.firstClear[fcKey] = true;
      first = {
        coins: D.FIRST_CLEAR.coins(ch),
        gold: D.FIRST_CLEAR.gold(ch),
        oz: D.FIRST_CLEAR.oz(ch),
        item: rollItemRar(),
      };
      S._pendCoins = (S._pendCoins || 0) + first.coins;   // v2.5 fix: coins META2'de alan yoktu → NaN ve ödül kaybı; oyun takePendingCoins ile alır
      S.gold += first.gold; S.oz += first.oz;
    }
    // bölüm bitti mi?
    let advanced = null;
    let triple = null;
    if (st >= D.STAGES_PER_CH) {
      let all3 = true;
      for (let i = 1; i <= D.STAGES_PER_CH; i++) if ((S.prog.stars[ch + '-' + i] || 0) < 3) all3 = false;
      if (all3 && !S.prog.triple['t-' + ch]) {
        S.prog.triple['t-' + ch] = true;
        triple = { oz: D.TRIPLE_BONUS.oz, item: D.TRIPLE_BONUS.item };
        S.oz += triple.oz;
      }
      if (ch < D.CHAPTERS.length) { S.prog = { ...S.prog, ch: ch + 1, st: 1 }; advanced = { ch: ch + 1 }; }
    } else {
      S.prog = { ...S.prog, st: st + 1 };
      advanced = { st: st + 1 };
    }
    if (triple && triple.item) grantItem(triple.item, 'bölüm ödülü');
    if (first && first.item) grantItem(first.item, 'bölüm ödülü');
    addPassXp(D.BP.stageXp);
    save();
    return { stars, first, triple, advanced };
  }

  // ==================== ZİNDANLAR ====================
  // ---------- başlatma kuyruğu (game.js startRun tüketir) ----------
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
    if (S.dungeons.d !== dk) S.dungeons = { d: dk, gold: 0, essence: 0, boss: 0 };
  }
  function dungeonStatus() {
    ensureDungeons();
    const out = {};
    for (const k in D.DUNGEONS) out[k] = { left: D.DUNGEONS[k].entries - S.dungeons[k], total: D.DUNGEONS[k].entries };
    return out;
  }
  function consumeDungeon(kind) {
    ensureDungeons();
    if (!D.DUNGEONS[kind]) return false;
    if (S.dungeons[kind] >= D.DUNGEONS[kind].entries) return false;
    S.dungeons[kind]++;
    save();
    return true;
  }
  function dungeonReward(kind, res) {
    const r = D.DUNGEON_REWARD[kind](res);
    if (r.gold) S.gold += r.gold;
    if (r.oz) S.oz += r.oz;
    S.stats.dungeonsDone++;
    addPassXp(D.DUNGEON_XP);
    save();
    return r;
  }

  // ==================== BATTLE PASS: YILDIZ YOLU ====================
  function seasonKey(d) {
    const dt = d || now();
    const t = new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
    const day = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - day);
    const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    const w = Math.ceil((((t - y0) / 86400000) + 1) / 7);
    return t.getUTCFullYear() + '-W' + String(w).padStart(2, '0');
  }
  function ensurePass() {
    const sk = seasonKey();
    if (S.pass.season !== sk) {
      // v2.13 (Survivor.io dersi): sezon değişiminde %30 EXP taşınır — sıfırlama kayıp hissi vermesin
      const carry = (typeof CORE !== 'undefined' && CORE.passCarry) ? CORE.passCarry(S.pass.xp) : 0;
      S.pass = { season: sk, xp: carry, lvl: 1, premium: S.pass.premium, claimedFree: {}, claimedPrem: {}, carry };
    }
  }
  function addPassXp(n) {
    ensurePass();
    S.pass.xp += n;
    while (S.pass.lvl < D.BP.levels && S.pass.xp >= D.BP.need(S.pass.lvl)) {
      S.pass.xp -= D.BP.need(S.pass.lvl);
      S.pass.lvl++;
    }
    if (S.pass.lvl >= D.BP.levels) S.pass.xp = 0;
    save();
  }
  function onRunEnd(res) {
    ensurePass();
    const xp = D.BP.runXp(res.kills, res.time);
    addPassXp(xp);
    return xp;
  }
  function passInfo() {
    ensurePass();
    return { lvl: S.pass.lvl, xp: S.pass.xp, need: D.BP.need(S.pass.lvl), premium: S.pass.premium, levels: D.BP.levels, season: S.pass.season, claimedFree: S.pass.claimedFree, claimedPrem: S.pass.claimedPrem, carry: S.pass.carry || 0 };
  }
  function claimPass(track, lvl) {
    ensurePass();
    if (lvl > S.pass.lvl) return null;
    if (track === 'free') {
      if (S.pass.claimedFree[lvl]) return null;
      S.pass.claimedFree[lvl] = true;
      const r = D.PASS_FREE(lvl);
      applyReward(r);
      save();
      return r;
    }
    if (track === 'prem') {
      if (!S.pass.premium || S.pass.claimedPrem[lvl]) return null;
      S.pass.claimedPrem[lvl] = true;
      const r = D.PASS_PREM(lvl);
      applyReward(r);
      if (r.item) grantItem(r.item, 'sezon pass');
      save();
      return r;
    }
    return null;
  }
  function applyReward(r) {
    if (r.coins) S._pendCoins = (S._pendCoins || 0) + r.coins;   // ◈ META tarafına game.js taşır
    if (r.gold) S.gold += r.gold;
    if (r.oz) S.oz += r.oz;
  }
  function takePendingCoins() { const c = S._pendCoins || 0; S._pendCoins = 0; return c; }

  // ==================== PAKET MAĞAZASI ====================
  function buyBundle(id) {
    const b = D.BUNDLES[id];
    if (!b) return null;
    if (b.once && S.bundles[id]) return null;
    // GERÇEK IAP BAĞLANTI NOKTASI (Faz 38): makbuz doğrulaması burada yapılacak.
    S.bundles[id] = true;
    if (b.oz) S.oz += b.oz;
    if (b.gold) S.gold += b.gold;
    if (b.premium) { ensurePass(); S.pass.premium = true; }
    let item = null;
    if (b.item) item = grantItem(b.item, 'mağaza paketi');
    save();
    return { ok: true, oz: b.oz || 0, gold: b.gold || 0, premium: !!b.premium, item };
  }
  function bundleOwned(id) { return !!S.bundles[id]; }

  // ==================== PARA EKLE/YÜKLE ====================
  function addGold(n) { S.gold += n; save(); }

  // ==================== BEDAVA KASA İZLE (v2.9, hedef D) ====================
  // Ölüm ekranında rewarded reklam → gacha çekilişi nadirliğinde ekipman. Günlük ≤3.
  const AD_CRATE_DAILY = 3;
  function adCrateStatus() {
    const today = dayKey();
    if (S.adCrate.d !== today) { S.adCrate = { d: today, n: 0 }; }        // gün değişti → haklar taze
    return { count: S.adCrate.n, left: Math.max(0, AD_CRATE_DAILY - S.adCrate.n), max: AD_CRATE_DAILY };
  }
  function watchCrate() {
    const st = adCrateStatus();
    if (st.left <= 0) return null;                                        // günlük tavan dolu
    S.adCrate.n++;
    const it = grantItem(rollItemRar(), 'bedava kasa');                   // çekiliş nadirliği
    save();
    return it;
  }
  function addOz(n) { S.oz += n; save(); }
  function addShards(n) { S.shards += n; save(); }
  function currencies() { return { gold: S.gold, oz: S.oz, shards: S.shards }; }

  // ==================== BİRLEŞİK KARAKTER LİSTESİ ====================
  const CHARS = (() => {
    const out = {};
    for (const id in D.NEW_PILOTS) {
      const p = D.NEW_PILOTS[id];
      out[id] = { name: p.name, desc: p.desc, color: p.color, cost: 0, weapons: p.weapons, mods: p.mods, gachaRar: p.rar };
    }
    return out;
  })();
  function owned(id) { return !!(S.owned[id]); }
  function gachaCatalog() { return { ...D.CORE_PILOTS, ...{ zenith: 'SSR', aurora: 'SSR', nexus: 'SR', volt: 'SR', cinder: 'SR', onyx: 'R', jade: 'R', scrap: 'N' } }; }

  load();
  return {
    // çekirdek
    state, save, resetForTest, setRng, setNow,
    // gacha
    pull1, pull10, pityInfo, ratesLine, pullSummary, starLevel, starUp, starBonus, owned, gachaCatalog, CHARS,
    // ekipman
    grantItem, itemLog, itemDelta, invGainOrder, famCounts, setBonusLine, inventory, equipped, equip, upgradeItem, sellItem, equipMods, runMods, itemStat,
    // fusion + günlük seri (v2.6) + yükseltme taşı (v2.15)
    fuseItems, fuseCounts, dailyStatus, claimDaily,
    adCrateStatus, watchCrate, stoneInfo, buyStone, useStone, migrateStones,
    // harita
    prog, unlocked, stageConfig, completeStage, startStage, startDungeon, takePending,
    // ölüm ekranı motivasyonu (v2.7)
    nearMiss,
    // zindan
    dungeonStatus, consumeDungeon, dungeonReward,
    // battle pass
    passInfo, addPassXp, onRunEnd, claimPass, takePendingCoins,
    // mağaza
    buyBundle, bundleOwned,
    // para
    addGold, addOz, addShards, currencies,
  };
})();
globalThis.META2 = META2;
