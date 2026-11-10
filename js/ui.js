/* NEON STORM — ui.js : menüler, mağaza, başarımlar, HUD, akış */
'use strict';
const UI = (() => {
  const $ = id => document.getElementById(id);
  // v2.28: 'pay-overlay' listede — GERİ basınca sync() sahte-satın-alma panelini kapatır; yoksa
  // panel menüde havada asılı kalır, oyuncu 3 sn tıklayamaz ve geri sayım MENÜDEYKEN satın almayı tamamlardı
  // (v2.26 comment-trap ailesi: .overlay eklerken OVERLAYS kaydı şart — v2.27 dersi)
  // v4.0: 'collect' (ÇAĞRI) + 'pass' (YILDIZ YOLU) KÖKTEN SİLİNDİ → 'planes' (PREMİUM UÇAKLAR) eklendi
  const OVERLAYS = ['menu', 'shop', 'ach', 'how', 'levelup', 'pause', 'gameover', 'quests', 'daily', 'board', 'equip', 'map', 'dungeons', 'planes', 'reward-choice', 'pay-overlay'];
  let sub = null; // menü alt ekranları

  // ==================== SENKRON ====================
  function sync() {
    const m = ENG.state.mode;
    OVERLAYS.forEach(o => $(o).classList.add('hidden'));
    if (m === 'menu') {
      if (sub === 'shop') { renderShop(); $('shop').classList.remove('hidden'); }
      else if (sub === 'ach') { renderAch(); $('ach').classList.remove('hidden'); }
      else if (sub === 'how') { $('how').classList.remove('hidden'); }
      else if (sub === 'quests') { renderQuests(); $('quests').classList.remove('hidden'); }
      else if (sub === 'board') { renderBoard(); $('board').classList.remove('hidden'); }
      else if (sub === 'daily') { renderDaily(); $('daily').classList.remove('hidden'); }
      else if (sub === 'equip') { renderEquip(); $('equip').classList.remove('hidden'); }
      else if (sub === 'map') { renderMap(); $('map').classList.remove('hidden'); }
      else if (sub === 'dungeons') { renderDungeons(); $('dungeons').classList.remove('hidden'); }
      else if (sub === 'planes') { renderPlanes(); $('planes').classList.remove('hidden'); }
      else $('menu').classList.remove('hidden');
    }
    else if (m === 'levelup') $('levelup').classList.remove('hidden');
    else if (m === 'pause') { renderPauseStats(); $('pause').classList.remove('hidden'); }
    else if (m === 'over') { /* gameOver() doldurur */ }
    $('hud').classList.toggle('hidden', !(m === 'play' || m === 'levelup' || m === 'pause'));
  }

  // ==================== MENÜ ====================
  function refreshMenu() {
    const M = GAME.META();
    $('menu-coins').textContent = M.coins;
    const b = M.best;
    $('menu-stats').innerHTML =
      'EN İYİ SKOR <b>' + b.score + '</b> · EN UZUN <b>' + fmtT(b.time) + '</b> · TOP AV <b>' + b.kills + '</b><br>' +
      'OYNANAN RUN <b>' + M.runs + '</b> · BAŞARIM <b>' + Object.keys(M.ach).length + '/' + GAME.ACHS.length + '</b>';
    // v2.6: günlük ödül alınabilirse çip parlasın
    try {
      const d = GAME.META2().dailyStatus();
      $('btn-daily').classList.toggle('pulse', !!d.canClaim);
      $('btn-daily').textContent = d.canClaim ? 'GÜNLÜK ÖDÜL ●' : 'GÜNLÜK ÖDÜL';
    } catch (e) { }
    syncToggles();
  }

  function fmtT(s) {
    s = Math.floor(s || 0);
    const m = Math.floor(s / 60), r = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
  }

  function syncToggles() {
    const M = GAME.META();
    const s = 'SES: ' + (M.settings.sfx ? 'AÇIK' : 'KAPALI');
    const mu = 'MÜZİK: ' + (M.settings.music ? 'AÇIK' : 'KAPALI');
    const ha = 'TİTREŞİM: ' + (M.settings.haptics ? 'AÇIK' : 'KAPALI');
    $('tg-sfx').textContent = s; $('tg-sfx2').textContent = s;
    $('tg-music').textContent = mu; $('tg-music2').textContent = mu;
    $('tg-hap').textContent = ha; $('tg-hap2').textContent = ha;
  }

  function toggleSfx() {
    const M = GAME.META();
    M.settings.sfx = !M.settings.sfx;
    AUDIO.setSfx(M.settings.sfx);
    try { localStorage.setItem('neonstorm_save_v1', JSON.stringify(M)); } catch (e) { }
    syncToggles(); AUDIO.sfx('ui');
  }
  function toggleMusic() {
    const M = GAME.META();
    M.settings.music = !M.settings.music;
    AUDIO.setMusic(M.settings.music);
    try { localStorage.setItem('neonstorm_save_v1', JSON.stringify(M)); } catch (e) { }
    syncToggles(); AUDIO.sfx('ui');
  }
  function toggleHaptics() {
    const M = GAME.META();
    M.settings.haptics = !M.settings.haptics;
    try { localStorage.setItem('neonstorm_save_v1', JSON.stringify(M)); } catch (e) { }
    syncToggles(); AUDIO.sfx('ui');
    if (M.settings.haptics && navigator.vibrate) { try { navigator.vibrate(30); } catch (e) { } }
  }

  // ==================== MAĞAZA (v4.0: ANAHTAR + PAKETLER — kalıcı yükseltme KÖKTEN SİLİNDİ) ====================
  // Güç yolu TEK: ekipman. Mağaza yalnız ANAHTAR (⬡) ve IAP-sim paketler satar.
  function renderShop() {
    const M2 = GAME.META2();
    const c = M2.currencies();
    $('shop-gold').textContent = c.gold;
    $('shop-keys').textContent = c.keys;
    const box = $('shop-keys-box');
    const ki = M2.keyInfo();
    box.innerHTML = '';
    const el = document.createElement('div');
    el.className = 'shop-item';
    el.innerHTML =
      '<div class="shop-info"><div class="shop-name">🔑 ANAHTAR ×1</div>' +
      '<div class="shop-desc">Sandığı açar — her sandık 1 ekipman · Ücretsiz yol: ANAHTAR ZİNDANI (günlük 2)</div></div>' +
      '<button class="btn shop-buy" data-buy-key' + (c.gold >= ki.cost ? '' : ' disabled') + '>⬡ ' + ki.cost + '</button>';
    box.appendChild(el);
    box.querySelectorAll('[data-buy-key]').forEach(b => b.addEventListener('click', () => {
      if (M2.buyKey()) { AUDIO.sfx('buy'); toast('ANAHTAR ALINDI 🔑 — EKİPMAN panelinden sandığı aç', 'info'); renderShop(); }
      else AUDIO.sfx('deny');
    }));
    // v4.1 (koşu #75 handoff işi 2): SANDIK EKONOMİSİ altı EKİPMAN NADİRLİK rehberi —
    // 430×932'de son kart altı 221px boşluk ölçüldü; kart içerik-sonu boşluğunu bilgiyle doldurur.
    // Oranlar META_DATA.ITEM_RATES'ten (veri-tek-kaynak — literal yüzde kopyası yasak), renkler RARCOLOR'dan.
    const rarCard = $('shop-rarity-card');
    if (rarCard) {
      const rates = META_DATA.ITEM_RATES; // { SSR: 0.03, SR: 0.15, R: 0.37, N: 0.45 } — baz oranlar
      const order = ['SSR', 'SR', 'R', 'N'];
      const cr = META_DATA.chestRates(1); // bölüm-1 örnek zarı — { SSR, SR, R, N } (chestRates sözleşmesi)
      rarCard.innerHTML =
        '<b>NADİRLİK REHBERİ — SANDIKTA NE ÇIKAR?</b>' +
        order.map(r => '<div class="rar-row"><span class="rar-dot" style="background:' + RARCOLOR[r] + '"></span>' +
          '<span class="rar-name" style="color:' + RARCOLOR[r] + '">' + RARNAME[r] + ' (' + r + ')</span>' +
          '<span class="rar-val">güç ×' + (META_DATA.RARITY[r].mult).toFixed(2) + ' · baz %' + Math.round(rates[r] * 100) + '</span></div>').join('') +
        '<div class="rar-note">Derin bölümler gerçek ödül: her bölüm SSR +1% (tavan +5%) · SR +2% (tavan +25%)' +
        ' · Bölüm 1 zarı: SSR %' + Math.round(cr.SSR * 100) + ' / SR %' + Math.round(cr.SR * 100) + '. Ekipman Sv1-' + META_DATA.ITEM_LVL_MAX + ' — YÜKSELT ile ⬡ altınla beslenir.</div>';
    }
    // v2.7 → v4.0: gerçek para paketleri (hedef D) — buyBundle bağlantı noktası + sahte ödeme akışı
    renderBundles();
  }

  function renderBundles() {
    const bl = $('shop-bundles');
    if (!bl) return;
    const B = META_DATA.BUNDLES;
    bl.innerHTML = '';
    Object.keys(B).forEach(id => {
      const b = B[id];
      const own = GAME.META2().bundleOwned(id);
      const parts = [];
      if (b.gold) parts.push('⬡' + b.gold);
      if (b.keys) parts.push('🔑' + b.keys);
      const done = b.once && own;
      const el = document.createElement('div');
      el.className = 'shop-item bundle-item';
      el.innerHTML =
        '<div class="shop-info"><div class="shop-name">' + b.name + (b.once ? ' · TEK SEFERLİK' : '') + '</div>' +
        '<div class="shop-desc">' + parts.join(' + ') + '</div></div>' +
        '<button class="btn shop-buy" data-bundle="' + id + '"' + (done ? ' disabled' : '') + '>' +
        (done ? 'ALINDI' : '$' + b.price.toFixed(2)) + '</button>';
      bl.appendChild(el);
    });
    bl.querySelectorAll('button[data-bundle]').forEach(btn => btn.addEventListener('click', () => showPurchase(btn.dataset.bundle)));
  }

  // ==================== BAŞARIMLAR ====================
  function renderAch() {
    const M = GAME.META();
    const list = $('ach-list');
    list.innerHTML = '';
    for (const a of GAME.ACHS) {
      const done = !!M.ach[a.id];
      const item = document.createElement('div');
      item.className = 'ach-item' + (done ? ' done' : '');
      item.innerHTML =
        '<div class="ach-mark">' + (done ? '✓' : '—') + '</div>' +
        '<div><div class="ach-name">' + a.name + '</div><div class="ach-desc">' + a.desc + '</div></div>' +
        '<div class="ach-reward">◈ ' + a.coins + '</div>';
      list.appendChild(item);
    }
  }

  // ==================== SEVİYE KARTLARI ====================
  function renderLevelUp(choices, rerollUsed) {
    const wrap = $('lu-cards');
    // v2.13: silah doluluk çipi (Survivor.io slot disiplini) — tavan 6
    const r = GAME.run();
    const wc = (r && r.player && Array.isArray(r.player.weapons)) ? r.player.weapons.length : 0;
    wrap.innerHTML = '<div class="wcap-chip' + (wc >= 6 ? ' full' : '') + '">SİLAH ' + wc + '/6' +
      (wc >= 6 ? ' — DOLU · heal/coin akışı' : '') + '</div>';
    choices.forEach((c, i) => {
      const m = GAME.choiceMetaOf(c);
      const el = document.createElement('div');
      el.className = 'card ' + m.cls;
      el.style.color = m.color;
      // v2.11: EVO ilerleme çubuğu — her silah yükseltme kartında (SVY pips + pasif tik)
      let progHtml = '';
      if (m.evoProg) {
        const P = m.evoProg;
        let pips = '';
        for (let k = 0; k < P.lvMax; k++) pips += '<i class="ep-pip' + (k < P.lv ? ' done' : '') + '"></i>';
        progHtml = '<div class="evo-prog" title="EVRİM önkoşulu: SVY ' + P.lv + '/' + P.lvMax +
          ' + ilgili pasif"><span class="ep-pips">' + pips + '</span>' +
          '<span class="ep-pas' + (P.pas ? ' done' : '') + '">PASİF ' + (P.pas ? '✓' : '—') + '</span></div>';
      }
      el.innerHTML =
        (m.evoBand ? '<div class="evo-band">EVOLUSYON!</div>' : '') + // v2.10 EVO YOLU
        (m.fav ? '<div class="fav-badge">UÇAK SİNERJİSİ</div>' : '') + // v4.0: pilot yerine uçak sinerjisi
        '<div class="rt">' + m.rt + '</div>' +
        '<div class="ic">' + m.icon + '</div>' +
        '<div class="nm">' + m.nm + '</div>' +
        '<div class="ds">' + m.ds + '</div>' +
        progHtml;
      el.addEventListener('click', () => GAME.choose(i));
      wrap.appendChild(el);
    });
    $('btn-reroll').textContent = 'YENİDEN ÇEK (' + (rerollUsed ? '0' : '1') + ')';
    $('btn-reroll').disabled = rerollUsed;
    sync();
  }

  // ==================== GÖREVLER ====================
  function renderQuests() {
    const info = GAME.questInfo();
    const list = $('quest-list');
    list.innerHTML = '';
    $('quest-coins').textContent = GAME.META().coins;
    if (!info) { list.innerHTML = '<p class="muted">Görevler henüz hazır değil — bir run başlat.</p>'; return; }
    const mk = (it, claimFn, label) => {
      const el = document.createElement('div');
      el.className = 'shop-item quest-item' + (it.claimed ? ' done' : '');
      const pct = Math.min(100, (it.prog / it.goal) * 100);
      // v2.10: karışık ödül gösterimi (3. günlük görev ◈+⬡+✧)
      // v2.12 bugfix: WEEKLY_MIX bonus yalnız gold taşır — parça bazlı koşullu dizim,
      // aksi halde "+400◈ +300⬡ +undefined✧" panelde görünüyor.
      const rewTxt = it.bonus
        ? '+' + it.reward + '◈' + (it.bonus.gold ? ' +' + it.bonus.gold + '⬡' : '')
        : '+' + it.reward + ' ◈';
      el.innerHTML =
        '<div class="shop-info"><div class="shop-name">' + label + '</div>' +
        '<div class="shop-desc">' + it.text + ' — ' + Math.floor(it.prog) + '/' + it.goal + '</div>' +
        '<div class="prog"><div class="prog-fill" style="width:' + pct + '%"></div></div></div>' +
        '<button class="btn shop-buy"' + (it.claimed || it.prog < it.goal ? ' disabled' : '') + '>' +
        (it.claimed ? 'ALINDI' : rewTxt) + '</button>';
      if (!it.claimed && it.prog >= it.goal) el.querySelector('button').addEventListener('click', () => {
        if (claimFn()) {
          AUDIO.sfx('buy');
          toast('GÖREV ÖDÜLÜ: +' + it.reward + ' ◈' + (it.bonus && it.bonus.gold ? ' +' + it.bonus.gold + '⬡' : ''), 'info');
          renderQuests();
        }
      });
      return el;
    };
    info.items.forEach((it, i) => list.appendChild(mk(it, () => GAME.claimQuest(i), 'GÜNLÜK')));
    if (info.weekly) list.appendChild(mk(info.weekly, () => GAME.claimWeekly(), 'HAFTALIK'));
  }

  // ==================== PREMİUM UÇAKLAR (v4.0) ====================
  // gacha/pilotlar SİLİNDİ — uçaklar ◈ coin (10 gövde) veya IAP-sim PREMIUM (AURORA/ZENITH)
  function renderPlanes() {
    const M = GAME.META();
    const M2 = GAME.META2();
    $('pl-coins').textContent = M.coins;
    const list = $('pl-list');
    list.innerHTML = '';
    const all = M2.planes();
    for (const id in all) {
      const pl = all[id];
      const owned = M2.planeOwned(id);
      const sel = M.char === id;
      const el = document.createElement('div');
      el.className = 'shop-item plane-item' + (sel ? ' selected' : '');
      el.innerHTML =
        '<div class="shop-info"><div class="shop-name" style="color:' + pl.color + '">' + pl.name +
        (pl.premium ? ' <span style="color:#fbbf24">★ PREMIUM</span>' : '') + (sel ? ' · AKTİF' : '') + '</div>' +
        '<div class="shop-desc">' + pl.desc + '</div></div>' +
        '<button class="btn shop-buy" data-plane="' + id + '"' + (sel ? ' disabled' : '') + '>' +
        (sel ? 'AKTİF' : owned ? 'SEÇ' : (pl.iap ? '$' + pl.iap.toFixed(2) + ' · SİM' : '◈ ' + pl.cost)) + '</button>';
      el.querySelector('button').addEventListener('click', () => {
        if (owned) { if (GAME.selectPlane(id)) { AUDIO.sfx('ui'); renderPlanes(); } }
        else if (pl.iap) { showPurchase('plane-' + id); }   // sahte ödeme akışı → creditBundle plane yolu
        else if (GAME.buyPlane(id)) { toast('UÇAK AÇILDI: ' + pl.name, 'info'); AUDIO.sfx('buy'); renderPlanes(); }
        else AUDIO.sfx('deny');
      });
      list.appendChild(el);
    }
  }

  // ==================== GÜNLÜK ÖDÜL (v2.6) ====================
  function dailyRewardText(r) {
    const parts = [];
    if (r.coins) parts.push('◈ ' + r.coins);
    if (r.gold) parts.push('⬡ ' + r.gold);
    if (r.keys) parts.push('🔑 ' + r.keys);
    return parts.join(' + ');
  }
  function renderDaily() {
    const M2 = GAME.META2();
    const st = M2.dailyStatus();
    $('daily-streak').innerHTML = 'SERİ: <b>' + st.streak + '</b> GÜN' + (st.canClaim ? ' · SIRA: GÜN ' + st.day : ' · BUGÜN ALINDI');
    const grid = $('daily-grid');
    grid.innerHTML = '';
    for (let d = 1; d <= 7; d++) {
      const r = st.rewards[d - 1];
      const done = st.canClaim ? d < st.day : d <= st.day;
      const cell = document.createElement('div');
      cell.className = 'daily-cell' + (st.canClaim && d === st.day ? ' today' : '') + (done ? ' done' : '');
      cell.innerHTML = '<div class="dc-day">GÜN ' + d + '</div><div class="dc-rw">' + dailyRewardText(r) + '</div>';
      grid.appendChild(cell);
    }
    const btn = $('btn-daily-claim');
    btn.disabled = !st.canClaim;
    btn.textContent = st.canClaim ? 'ÖDÜLÜ AL — GÜN ' + st.day : 'BUGÜN ALINDI';
    btn.classList.toggle('primary', st.canClaim);
  }

  // ==================== SIRALAMA ====================
  function renderBoard() {
    const list = $('board-list');
    list.innerHTML = '';
    const rows = GAME.boardTop();
    if (!rows.length) {
      list.innerHTML = '<p class="muted">Henüz kayıt yok — ilk rekoru sen yaz.</p>';
      return;
    }
    rows.forEach((r, i) => {
      const ch = GAME.planeOf(r.char);
      const el = document.createElement('div');
      el.className = 'board-row' + (i === 0 ? ' gold' : '');
      el.innerHTML =
        '<div class="rk">' + (i + 1) + '</div>' +
        '<div class="bd-info"><div class="bd-name">' + r.name + ' <span style="color:' + ch.color + '">' + ch.name + '</span></div>' +
        '<div class="bd-sub">' + fmtT(r.time) + ' · ' + r.kills + ' av · SVY ' + (r.level || 1) + '</div></div>' +
        '<div class="bd-score">' + r.score + '</div>';
      list.appendChild(el);
    });
  }

  // ==================== TOPLAMA (GACHA) v4.0 KÖKTEN SİLİNDİ ====================
  // ÇAĞRI paneli, çekiliş, pity, pilot yıldızları — hepsi gitti. Nadirlik adları ekipman için kalır.
  const RARNAME = { N: 'NORMAL', R: 'NADİR', SR: 'SÜPER NADİR', SSR: 'EFSANEVİ' };
  const RARCOLOR = { N: '#9ca3af', R: '#22d3ee', SR: '#a78bfa', SSR: '#fbbf24' };

  // ==================== EKİPMAN — SANDIK ÇAĞI (v4.0) ====================
  function renderEquip() {
    const M2 = GAME.META2();
    const c = M2.currencies();
    $('eq-gold').textContent = c.gold;
    $('eq-keys').textContent = M2.keyInfo().keys;
    $('eq-chests').textContent = M2.chestCount();
    // v4.0: SANDIK kutusu — açma TEK kanal: anahtar (zindan/mağaza/reklam) veya ⬡ altın
    const chestBox = $('eq-chest-box');
    chestBox.innerHTML = '';
    const ki = M2.keyInfo();
    const nCh = M2.chestCount();
    const chEl = document.createElement('div');
    chEl.className = 'shop-item chest-item' + (nCh ? ' has' : '');
    chEl.innerHTML =
      '<div class="shop-info"><div class="shop-name" style="color:#fbbf24">📦 SANDIK ×' + nCh + '</div>' +
      '<div class="shop-desc">' + (nCh
        ? 'Her sandık 1 EKİPMAN içerir · Anahtar: 🔑' + ki.keys + ' veya ⬡' + ki.cost + ' altın'
        : 'Sandık bölümlerin İLK temizlik ödülüdür — her bölümde 1 ekipman') + '</div></div>' +
      '<div class="btn-row">' +
      '<button class="btn shop-buy" data-chest-open' + (!nCh || ki.keys <= 0 ? ' disabled' : '') + '>🔑 ANAHTARLA AÇ</button>' +
      '<button class="btn shop-buy" data-chest-gold' + (!nCh || c.gold < ki.cost ? ' disabled' : '') + '>⬡ ' + ki.cost + ' İLE AÇ</button></div>';
    chestBox.appendChild(chEl);
    chestBox.querySelectorAll('[data-chest-open]').forEach(b => b.addEventListener('click', () => {
      const r = M2.openChest(false);
      if (r) { AUDIO.sfx('buy'); toast('SANDIK AÇILDI: ' + RARNAME[r.rar] + ' EKİPMAN — YUVALARDAN KUŞAN!', 'info'); renderEquip(); }
      else AUDIO.sfx('deny');
    }));
    chestBox.querySelectorAll('[data-chest-gold]').forEach(b => b.addEventListener('click', () => {
      const r = M2.openChest(true);
      if (r) { AUDIO.sfx('buy'); toast('SANDIK AÇILDI (⬡' + ki.cost + ' ALTIN): ' + RARNAME[r.rar] + ' EKİPMAN!', 'info'); renderEquip(); }
      else AUDIO.sfx('deny');
    }));
    const slots = $('eq-slots');
    slots.innerHTML = '';
    const inv = M2.inventory();
    const eq = M2.equipped();
    const SLOTNAME = { weapon: 'KANON', armor: 'ZIRH', helm: 'KASK', boots: 'BOT', ring: 'YÜZÜK', amulet: 'KOLYE' };
    // v4.1 (VLM eleştirisi: 'kartlar boş/sıska'): yuva ikonları + nadirlik kenar vurgusu —
    // tam-ekran tile'lar artık dolu görünür; ikonlar oyunun mevcut emoji-diliyle uyumlu (🔑📦⬡ ailesi)
    const SLOTICO = { weapon: '🔫', armor: '🛡️', helm: '🪖', boots: '👟', ring: '💍', amulet: '📿' };
    // v2.33 (hedef B+G — koşu #29 işi 2): stat etiket haritası renderEquip başına alındı —
    // hem slot satırı hem envanter satırı aynı kaynaktan (SLOT_INFO stat anahtarı; elle yazma yasak)
    const STATNAME = META_DATA.STAT_NAME;   // v2.35: tek kaynak — kopya tanım kaldırıldı
    for (const s in SLOTNAME) {
      const it = inv.find(x => x.id === eq[s]);
      const el = document.createElement('div');
      el.className = 'shop-item eq-tile' + (it ? ' rar-' + it.rar : '');
      el.innerHTML =
        '<div class="eq-ico"' + (it ? ' style="color:' + RARCOLOR[it.rar] + '"' : '') + '>' + SLOTICO[s] + '</div>' +
        '<div class="shop-info"><div class="shop-name">' + SLOTNAME[s] + '</div>' +
        // v2.33: kuşanılan parçanın stat DEĞERİ slot satırında ('— CAN +21%') — v2.32 delta
        // zincirinin son halkası (v2.29 'stat ekranda var' ilkesi 6 slot satırına da taşınır);
        // değer itemStat tek çağrısından (envanter satırındaki dl.next ile aynı ölçek)
        '<div class="shop-desc">' + (it ? (RARNAME[it.rar] + ' · Sv' + it.lvl + '/' + META_DATA.ITEM_LVL_MAX + ' · Aile ' + it.fam + ' — ' + STATNAME[META_DATA.SLOT_INFO[s].stat] + ' +' + Math.round(M2.itemStat(it) * 100) + '%') : '<span class="muted">boş</span>') + '</div></div>' +
        // v2.34 (hedef B+A — koşu #30 işi 3): slot satırına YÜKSELT düğmesi — ⬡ lavabosuna
        // tek tık erişim (önceki '⬡ X' salt metindi; envanterde aramak gerekiyordu). Düğme metni
        // kazanç önizlemesi taşır (itemUpgradeGain SAF fn — elle yazma yasak); taş satırının
        // shop-info+button deseni (320px kanıtlı). Gold yetersizse disabled; Sv50'de düğme yok.
        (it && it.lvl < META_DATA.ITEM_LVL_MAX
          ? '<button class="btn shop-buy" data-up-slot="' + s + '"' + (c.gold < META_DATA.itemUpgradeCost(it.rar, it.lvl) ? ' disabled' : '') + '>YÜKSELT ⬡ ' + META_DATA.itemUpgradeCost(it.rar, it.lvl) + ' · +' + Math.round(META_DATA.itemUpgradeGain(it.slot, it.rar, it.lvl) * 100) + '% ' + STATNAME[META_DATA.SLOT_INFO[s].stat] + '</button>'
          : '');
      slots.appendChild(el);
    }
    slots.querySelectorAll('button[data-up-slot]').forEach(b => b.addEventListener('click', () => {
      const id = M2.equipped()[b.dataset.upSlot];
      if (id && M2.upgradeItem(id)) { AUDIO.sfx('buy'); renderEquip(); }
      else AUDIO.sfx('deny');
    }));
    // v4.0 KÖKTEN SİLİNDİ: birleştirme (füzyon) + YÜKSELTME TAŞI + eski kasa-rehberi —
    // kazanım TEK kanal: sandık → anahtar. Ekipman paneli: SANDIK + YUVALAR + ENVANTER (⬡ yükseltme).
    const log = M2.itemLog();
    const logEl = document.createElement('p');
    logEl.className = 'muted';
    logEl.style.cssText = 'margin:0 0 8px; font-size:11px; line-height:1.45; text-align:left; color:#a9b8d4';
    logEl.textContent = log.length
      ? 'SON SANDIK: ' + log.map(e => e.src + ' (' + e.r + ')').join(' · ')
      : 'SON SANDIK: henüz parça yok — bölüm temizle, sandık düşsün';
    chestBox.appendChild(logEl);
    const list = $('eq-inv');
    list.innerHTML = '';
    if (!inv.length) list.innerHTML = '<p class="muted">Envanter boş — bölüm temizle, sandığı anahtarla aç.</p>';
    // v2.32: stat etiket haritası renderEquip başına taşındı (slot satırı da aynı kaynağı kullanır)
    // v2.33 (hedef B — koşu #29 işi 3): envanter KAZANÇ SIRASI — satırlar META2.invGainOrder
    // sırasıyla basılır: en iyi KUŞANILIRSA kazancı üstte, kuşanmışlar sonda (satır çizimi
    // v2.32 ile aynı — yalnız iterasyon sırası değişti; tek doğruluk kaynağı meta.js)
    const rank = new Map(M2.invGainOrder(inv).map((id, i) => [id, i]));
    inv.slice().sort((a, b) => (rank.get(a.id) || 0) - (rank.get(b.id) || 0)).forEach(it => {
      const isEq = eq[it.slot] === it.id;
      // v2.32: delta satırı — kuşanmışta mevcut değer, boşta KUŞANILIRSA farkı (işaretli %)
      const dl = M2.itemDelta(it.id);
      const pct = v => (v >= 0 ? '+' : '−') + Math.abs(Math.round(v * 100)) + '%';
      const deltaTxt = isEq
        ? ' · <span style="color:#4ade80">' + STATNAME[dl.stat] + ' ' + pct(dl.next) + '</span>'
        : (dl.d >= 0
          ? ' · <span style="color:#4ade80">KUŞANILIRSA ' + STATNAME[dl.stat] + ' +' + Math.round(dl.d * 100) + '%</span>'
          : ' · <span class="muted">KUŞANILIRSA ' + STATNAME[dl.stat] + ' −' + Math.abs(Math.round(dl.d * 100)) + '% (mevcut iyi)</span>');
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.innerHTML =
        '<div class="shop-info"><div class="shop-name" style="color:' + RARCOLOR[it.rar] + '">' + SLOTNAME[it.slot] + ' · ' + RARNAME[it.rar] + '</div>' +
        '<div class="shop-desc">Sv' + it.lvl + ' · Aile ' + it.fam + ' (' + (isEq ? 'kuşanmış' : 'boşta') + ')' + deltaTxt + '</div></div>' +
        '<div class="btn-row"><button class="btn shop-buy" data-eq="' + it.id + '"' + (isEq ? ' disabled' : '') + '>' + (isEq ? 'KUŞANILDI' : 'KUŞAN') + '</button>' +
        '<button class="btn shop-buy" data-up="' + it.id + '"' + (it.lvl >= META_DATA.ITEM_LVL_MAX ? ' disabled' : '') + '>YÜKSELT ⬡ ' + META_DATA.itemUpgradeCost(it.rar, it.lvl) + (it.lvl < META_DATA.ITEM_LVL_MAX ? ' · +' + Math.round(META_DATA.itemUpgradeGain(it.slot, it.rar, it.lvl) * 100) + '% ' + STATNAME[META_DATA.SLOT_INFO[it.slot].stat] : '') + '</button>' + '</div>';
      list.appendChild(el);
    });
    list.querySelectorAll('button[data-eq]').forEach(b => b.addEventListener('click', () => {
      if (M2.equip(+b.dataset.eq)) { AUDIO.sfx('ui'); renderEquip(); }
    }));
    list.querySelectorAll('button[data-up]').forEach(b => b.addEventListener('click', () => {
      if (M2.upgradeItem(+b.dataset.up)) { AUDIO.sfx('buy'); renderEquip(); }
      else AUDIO.sfx('deny');
    }));
    const m = M2.equipMods();
    $('eq-total').textContent = 'TOPLAM: hasar +' + Math.round((m.dmg - 1) * 100) + '% · can +' + Math.round((m.hp - 1) * 100) + '% · hız +' + Math.round((m.spd - 1) * 100) + '% · kritik +' + Math.round(m.crit * 100) + '% · yenilenme +' + m.regen.toFixed(1) + '/sn · mıknatıs +' + Math.round((m.mag - 1) * 100) + '%';
    // v2.35 (hedef B+G — koşu #31): aile seti bonusu — equipMods'un UYGULADIĞI seti oyuncuya söyler
    // (kaynak: M2.setBonusLine + M2.famCounts — equipMods ile aynı hesap, elle yazma yasak).
    // Kademe yoksa satır gizlenir (nazik boşluk — v2.24 boş-durum dersi).
    const setEl = $('eq-set');
    const sline = M2.setBonusLine(M2.famCounts());
    if (sline) { setEl.textContent = sline; setEl.style.display = 'block'; }
    else { setEl.textContent = ''; setEl.style.display = 'none'; }
  }

  // ==================== BÖLÜMLER ====================
  function renderMap() {
    const M2 = GAME.META2();
    const p = M2.prog();
    const list = $('map-list');
    list.innerHTML = '';
    for (let ch = 1; ch <= 12; ch++) {
      const unlockedCh = ch <= p.ch;
      const head = document.createElement('div');
      head.className = 'shop-item';
      let starsTotal = 0;
      for (let i = 1; i <= 10; i++) starsTotal += (p.stars[ch + '-' + i] || 0);
      head.innerHTML = '<div class="shop-info"><div class="shop-name" style="color:' + (unlockedCh ? '#22d3ee' : '#4b5563') + '">' +
        ch + '. ' + (unlockedCh ? chText(ch) : '??? KİLİTLİ') + '</div>' +
        '<div class="shop-desc">★ ' + starsTotal + '/30</div></div>';
      list.appendChild(head);
      if (!unlockedCh) continue;
      const row = document.createElement('div');
      row.className = 'btn-row';
      row.style.flexWrap = 'wrap';
      for (let s = 1; s <= 10; s++) {
        const open = M2.unlocked(ch, s);
        const st = p.stars[ch + '-' + s] || 0;
        const b = document.createElement('button');
        b.className = 'btn small' + (open && st === 0 ? ' primary' : '');
        b.disabled = !open;
        b.textContent = st ? (s + ' ' + '★'.repeat(st)) : (open ? s + ' ▶' : s + ' 🔒');
        if (open) b.addEventListener('click', () => {
          AUDIO.sfx('ui');
          if (GAME.startStage(ch, s)) sub = null; else toast('Bu aşama kilitli', 'info');
        });
        row.appendChild(b);
      }
      list.appendChild(row);
    }
  }
  const chText = ch => ['NEON KIYI', 'ÇELİK ÇÖL', 'KUANTUM PAZAR', 'SİNYAL KAYBI', 'SİM VERGİSİ', 'HAFIZA FIRTINASI', 'ELEKTRİK BAHÇESİ', 'GÖLGE PROTOKOL', 'SIFIR NOKTASI', 'SON SUNUCU', 'ÇEKİRDEK KAOS', 'YILDIZ FALLARI'][ch - 1] || '?';

  // ==================== ZİNDANLAR ====================
  function renderDungeons() {
    const M2 = GAME.META2();
    const st = M2.dungeonStatus();
    const list = $('dn-list');
    list.innerHTML = '';
    const DN = {
      gold: { name: 'ALTIN ZİNDANI', desc: '90 sn · öldürme başına altın' },
      key: { name: 'ANAHTAR ZİNDANI', desc: '90 sn · 🔑 anahtar hasadı — sandıkların ücretsiz kapısı' },
      boss: { name: 'BOSS SALDIRISI', desc: '60 sn · kesintisiz boss akını' },
    };
    for (const k in DN) {
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.innerHTML =
        '<div class="shop-info"><div class="shop-name">' + DN[k].name + '</div><div class="shop-desc">' + DN[k].desc + '</div></div>' +
        '<button class="btn shop-buy" data-dn="' + k + '"' + (st[k].left <= 0 ? ' disabled' : '') + '>' +
        (st[k].left > 0 ? 'BAŞLA (' + st[k].left + ')' : 'BİTTİ') + '</button>';
      list.appendChild(el);
    }
    list.querySelectorAll('button[data-dn]').forEach(b => b.addEventListener('click', () => {
      AUDIO.sfx('ui');
      if (GAME.startDungeon(b.dataset.dn)) sub = null;
      else AUDIO.sfx('deny');
    }));
  }

  // ==================== YILDIZ YOLU v4.0 KÖKTEN SİLİNDİ ====================
  // battle pass (sezon/XP/premium takip) kaldırıldı — kullanıcı emri. Sezon kanalı YOK.

  // ==================== DURAKLAT / OYUN SONU ====================
  function renderPauseStats() {
    const h = GAME.getHud();
    if (!h) return;
    $('pause-stats').innerHTML =
      'SÜRE <b>' + fmtT(h.time) + '</b> · SEVİYE <b>' + h.level + '</b> · AV <b>' + h.kills + '</b><br>' +
      'CAN <b>' + Math.ceil(h.hp) + '/' + h.maxhp + '</b> · DİRİLİŞ HAKKI <b>' + h.revives + '</b>';
  }

  function gameOver() {
    const g = GAME.goInfo();
    if (!g) return;
    const sr = GAME.stageResult();
    const dr = GAME.dungeonResult();
    const nmEl = $('go-nearmiss');
    const retryEl = $('btn-retry');
    retryEl.classList.remove('pulse');
    if (sr) {
      nmEl.classList.add('hidden');
      $('go-timeline').classList.add('hidden'); $('go-bestprog').classList.add('hidden');
      $('go-title').textContent = 'AŞAMA TAMAMLANDI ' + '★'.repeat(sr.stars);
      let extra = '';
      // v4.0: ilk temizlik → SANDIK (1 ekipman garantisi) · tekrar → ⬡/◈ · 3★ bölüm → ANAHTAR
      if (sr.first && !sr.first.reclear) extra += ' · İLK TEMİZLİK: ◈' + sr.first.coins + ' ⬡' + sr.first.gold + ' + 📦 SANDIK (1 EKİPMAN)';
      if (sr.first && sr.first.reclear) extra += ' · TEKRAR TEMİZLİK: ◈' + sr.first.coins + ' ⬡' + sr.first.gold;
      if (sr.triple) extra += ' · 3★ BÖLÜM: 🔑' + sr.triple.keys + ' ANAHTAR';
      // v2.39 (hedef F juice): satırlar .go-line bloğu — sıralı giriş CSS'te (gofade)
      $('go-stats').innerHTML = CORE.goStatsHtml([
        'YILDIZ <b style="color:#fbbf24">' + '★'.repeat(sr.stars) + '</b> · AV <b>' + g.kills + '</b>' + extra,
        CORE.coinLine(g.coins, g.x2Coin),
      ]);
      $('btn-x2').style.display = 'none';
      $('btn-revive').style.display = 'none';
      $('btn-adcrate').style.display = 'none';
    } else if (dr) {
      nmEl.classList.add('hidden');
      $('go-timeline').classList.add('hidden'); $('go-bestprog').classList.add('hidden');
      $('go-title').textContent = 'ZİNDAN TAMAMLANDI';
      const parts = [];
      if (dr.gold) parts.push('⬡ ' + dr.gold);
      if (dr.keys) parts.push('🔑 ' + dr.keys + ' ANAHTAR');
      // v2.39 (hedef F juice): sıralı giriş — yukarıdaki desenle aynı
      $('go-stats').innerHTML = CORE.goStatsHtml([
        'AV <b>' + g.kills + '</b> · ÖDÜL <b style="color:#fbbf24">' + parts.join(' + ') + '</b>',
        CORE.coinLine(g.coins, g.x2Coin),
      ]);
      $('btn-x2').style.display = 'none';
      $('btn-revive').style.display = 'none';
      $('btn-adcrate').style.display = 'none';
    } else {
    // v2.7: "az kalsın" motivasyon satırı (hedef E) + TEKRAR OYNA vurgusu
    const nm = g.nearMiss;
    if (nm) {
      nmEl.classList.remove('hidden');
      nmEl.textContent =
        nm.kind === 'boss' ? 'AZ KALSIN! BOSS %' + nm.pct + ' CANLA KAÇTI' :
        nm.kind === 'record' ? 'AZ KALSIN! REKORA SADECE ' + nm.diff + ' PUAN KALMIŞTI' :
        nm.kind === 'time' ? 'AZ KALSIN! REKOR KOŞUNDAN ' + nm.diff + 's UZUN YAŞAYACAKTIN' :
        'SIRADAKİ HEDEF: ' + nm.name;
      retryEl.classList.add('pulse');
    } else nmEl.classList.add('hidden');
    $('go-title').textContent = 'SİSTEM ÇÖKTÜ';
    $('go-newbest').classList.toggle('hidden', !g.newBest);
    // v2.39 (hedef F juice — handoff işi 3): satırlar .go-line bloğu — sıralı giriş CSS'te;
    // boş satırlar (x2Kind/crates yok) goStatsHtml içinde filtrelenir — nazik boşluk korunur
    $('go-stats').innerHTML = CORE.goStatsHtml([
      'SÜRE <b>' + fmtT(g.time) + '</b> · SKOR <b>' + g.score + '</b>',
      'AV <b>' + g.kills + '</b> · SEVİYE <b>' + g.level + '</b>',
      CORE.coinLine(g.coins, g.x2Coin),
      // v2.38 (hedef G): gold/oz x2 seçimi kalıcı yansıma — coin yolu rewardLine'dan geçmez (boş metin)
      g.x2Kind ? CORE.rewardLine(g.x2Kind) : '',
      // v2.29 (hedef E+B): kasa ailesi oyuncu bilgisi — kaç kasa açtı (0 ise nazikçe gizli)
      g.crates ? 'BU KOŞUDA <b style="color:#fbbf24">' + g.crates + '</b> ALTIN KASASI AÇTIN' : '',
    ]);
    // v2.15 (hedef E/G): İLK 90 SN RADARI — olay damgası çizelgesi + kalıcı en iyi ilerleme
    const tl = $('go-timeline'), bpEl = $('go-bestprog');
    const line = CORE.mstoneLine(g.milestones);
    if (line.length) { tl.classList.remove('hidden'); tl.textContent = line.join(' · '); }
    else tl.classList.add('hidden');
    const bp = g.bestMstone;
    if (bp && bp.id) {
      bpEl.classList.remove('hidden');
      bpEl.textContent = 'EN İYİ İLERLEME: ' + (CORE.MSTONES[bp.id] || '') + ' ' + CORE.fmtClock(bp.t);
    } else bpEl.classList.add('hidden');
    $('btn-x2').style.display = GAME.x2Used() ? 'none' : '';
    $('btn-revive').style.display = g.revivable ? '' : 'none';
    // v4.0 (hedef D): BEDAVA ANAHTAR İZLE — günlük ≤3 rewarded reklam anahtarı (ekipman yalnız sandıktan)
    const adk = GAME.META2().adKeyStatus();
    $('btn-adcrate').textContent = 'BEDAVA ANAHTAR İZLE — SANDIK AÇ (' + adk.left + '/' + adk.max + ')';
    $('btn-adcrate').style.display = adk.left > 0 ? '' : 'none';
    }
    sync();
    $('gameover').classList.remove('hidden');
    $('hud').classList.add('hidden');
  }

  // ==================== TOAST & REKLAM ====================
  function toast(txt, cls) {
    const t = document.createElement('div');
    t.className = 'toast' + (cls ? ' ' + cls : '');
    t.textContent = txt;
    $('toasts').appendChild(t);
    setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .4s'; }, 2600);
    setTimeout(() => t.remove(), 3100);
  }

  // v2.8 (hedef D): NATIVE_BRIDGE varsa gerçek SDK (AdMob), yoksa web sim akışı.
  // Köprü sözleşmesi: showAd() → Promise<void> (reklam bitince resolve)
  function showAd(cb) {
    const done = () => { if (cb) cb(); };
    const B = (typeof window !== 'undefined' && window.NATIVE_BRIDGE) || null;
    const r = CORE.routeNative(B, 'showAd', null, () => undefined);
    if (r !== undefined) { // köprü devrede → reklam native'de oynar
      if (r && typeof r.then === 'function') r.then(done, done);
      else done();
      return;
    }
    // web placeholder: 3 sn sahte reklam
    $('ad-overlay').classList.remove('hidden');
    let n = 3;
    $('ad-count').textContent = n;
    const iv = setInterval(() => {
      n--;
      $('ad-count').textContent = n;
      if (n <= 0) {
        clearInterval(iv);
        $('ad-overlay').classList.add('hidden');
        done();
      }
    }, 1000);
  }

  // ==================== REKLAM ÖDÜLÜ SEÇİMİ (v2.7, hedef A+D) ====================
  function renderRewardChoice() {
    // v2.39 (hedef D+G — handoff işi 2): coin kartı somut değer — '◈ N → 2N (×2!)'
    // (goInfo().coins kaynaklı, elle yazma yok; 0 coin'de statik açıklama kalır — nazik)
    const g = GAME.goInfo();
    if (g && g.coins > 0) $('rc-coin-note').textContent = CORE.coinGainLabel(g.coins);
    // v2.40 → v4.0: gold/key kartları X2_REWARDS'tan beslenir — elle sayı yok
    $('rc-gold-note').textContent = CORE.x2CardLabel('gold');
    $('rc-key-note').textContent = CORE.x2CardLabel('key');
    $('reward-choice').classList.remove('hidden');
  }
  function hideRewardChoice() {
    $('reward-choice').classList.add('hidden');
  }

  // ==================== PAKET SATIN ALMA (v2.8: native StoreKit ↔ web sim) ====================
  // Köprü sözleşmesi: buyBundle(id) → Promise<boolean> (true = satın alma onaylı)
  function creditBundle(id) {
    // v4.0: PREMIUM uçak IAP-sim yolu ('plane-aurora' / 'plane-zenith') — paket tablosundan geçmez
    if (id.indexOf('plane-') === 0) {
      const pid = id.slice(6);
      const pl = GAME.META2().planeOf(pid);
      if (pl && GAME.META2().grantPlane(pid)) {
        AUDIO.sfx('buy');
        toast('PREMIUM UÇAK AÇILDI: ' + pl.name + ' — UÇAKLAR panelinden seç', 'info');
        sync();
      } else toast('UÇAK ZATEN SAHİPSİN');
      return;
    }
    const r = GAME.META2().buyBundle(id);
    if (r) {
      AUDIO.sfx('buy');
      const parts = [];
      if (r.gold) parts.push('⬡' + r.gold);
      if (r.keys) parts.push('🔑' + r.keys);
      toast('SATIN ALMA TAMAM: ' + parts.join(' + '), 'info');
      sync();
    } else toast('PAKET ZATEN ALINMIŞ');
  }
  // Web: 3 sn sahte ödeme akışı → buyBundle bağlantı noktası (Faz 38'de gerçek StoreKit).
  // v2.28 akış hijyeni (koşu #24 taraması, comment-trap gözüyle):
  // 1) in-flight guard — pay-overlay görünürken yeni geri sayım başlamaz (tek sayaçta çift interval
  //    birikir, iki kredi tetiklenirdi; tekrarlı paketlerde çift ücret görünümü).
  // 2) interval abort — sync() (GERİ dahil) paneli dışarıdan gizlediyse geri sayım İPTAL: kredi YOK.
  //    (sync artık OVERLAYS'tan pay-overlay'ı gizliyor — kapanışın sahibi belirsizdi.)
  function showPurchase(id) {
    const ov = $('pay-overlay');
    if (!ov.classList.contains('hidden')) return; // in-flight guard: geri sayım zaten sürüyor
    const B = (typeof window !== 'undefined' && window.NATIVE_BRIDGE) || null;
    if (B && typeof B.buyBundle === 'function') {
      // native yol: StoreKit köprüsü onay dönerse yerel kredi uygulanır
      const r = CORE.routeNative(B, 'buyBundle', id, () => false);
      const apply = ok => { if (ok) creditBundle(id); else toast('SATIN ALMA İPTAL'); };
      if (r && typeof r.then === 'function') r.then(apply, () => apply(false));
      else apply(r);
      return;
    }
    ov.classList.remove('hidden');
    let n = 3;
    $('pay-count').textContent = n;
    const iv = setInterval(() => {
      if (ov.classList.contains('hidden')) { // dışarıdan gizlendi (sync/GERİ) → iptal, kredi YOK
        clearInterval(iv);
        toast('SATIN ALMA İPTAL');
        return;
      }
      n--;
      $('pay-count').textContent = n;
      if (n <= 0) {
        clearInterval(iv);
        ov.classList.add('hidden');
        creditBundle(id);
      }
    }, 1000);
  }

  function showTutorial() {
    $('tutorial').classList.remove('hidden');
  }

  // ==================== HUD ====================
  // v4.0: KUŞANILMIŞ EKİPMAN ŞERİDİ — giyilenler oyun içinde üstte (kullanıcı emri).
  // İmza-önbellekli: kuşanma değişmeden DOM yeniden yazılmaz (100ms interval maliyeti sıfır).
  let gearSig = '';
  function renderGear() {
    const M2 = GAME.META2();
    const eq = M2.equipped();
    const inv = M2.inventory();
    let sig = '';
    const cells = META_DATA.SLOTS.map(s => {
      const it = inv.find(x => x.id === eq[s]);
      sig += s + ':' + (it ? it.id + '.' + it.rar + '.' + it.lvl : '-') + '|';
      return { s, it };
    });
    if (sig === gearSig) return;
    gearSig = sig;
    const el = $('hud-gear');
    if (!el) return;
    el.innerHTML = cells.map(c => {
      const info = META_DATA.SLOT_INFO[c.s];
      const col = c.it ? META_DATA.RARITY[c.it.rar].color : '#334155';
      const txtCol = c.it ? col : '#64748b';
      const title = c.it ? info.name + ' · ' + META_DATA.RARITY[c.it.rar].name + ' · Sv' + c.it.lvl + ' · Aile ' + c.it.fam : info.name + ' (boş)';
      return '<span class="gear-chip' + (c.it ? ' on' : '') + '" style="border-color:' + col + ';color:' + txtCol + '" title="' + title + '">' + info.icon + '</span>';
    }).join('');
  }
  function updateHud() {
    const h = GAME.getHud();
    if (!h) return;
    $('hp-bar').style.width = Math.max(0, (h.hp / h.maxhp) * 100) + '%';
    $('hp-text').textContent = Math.ceil(Math.max(0, h.hp)) + '/' + h.maxhp;
    $('xp-bar').style.width = Math.min(100, (h.xp / h.xpNext) * 100) + '%';
    $('timer').textContent = fmtT(h.time);
    $('kills').textContent = 'AV ' + h.kills;
    $('coins-hud').textContent = '◈ ' + h.coins;
    $('lvl-badge').textContent = 'SVY ' + h.level;
    renderGear();   // v4.0: kuşanılan ekipman şeridi (üstte)
    const comboEl = $('combo');
    if (h.combo >= 5) {
      if (!comboEl.classList.contains('show') || comboEl.textContent !== 'x' + h.combo + ' KOMBO') {
        comboEl.classList.remove('show'); void comboEl.offsetWidth;
        comboEl.classList.add('show');
      }
      comboEl.textContent = 'x' + h.combo + ' KOMBO';
    } else comboEl.classList.remove('show');
    // v2.16 (hedef G, VS netlik dersi): boss yaşarken etiket KALICI DOM bannerında —
    // 1.2 sn'lik ftext yalnız juice; Maestro/oyuncu için "BOSS: TÜR" okunur ve kalır
    const bb = $('boss-banner');
    if (h.bossType) { bb.textContent = 'BOSS: ' + (CORE.BOSS_NAMES[h.bossType] || 'DEV') + ' · ÖDÜL ZAMANI!'; bb.classList.remove('hidden'); }
    else { bb.textContent = 'BOSS YAKLAŞIYOR — ÖDÜL YOLDA!'; bb.classList.toggle('hidden', !(h.bossWarn > 0)); }
    // v2.23 (hedef E+B): EVRİME HAZİR kalıcı rozeti — ensureEvo (v2.14) garantisi artık
    // oyuncu bilgisi (v2.16 ftext dersi: kalıcı DOM, 1.2 sn'lik ftext yalnız juice)
    const ec = $('evo-chip');
    if (ec) { ec.classList.toggle('hidden', !h.evoReady); if (h.evoReady && !ec.dataset.on) { ec.dataset.on = '1'; } else if (!h.evoReady) delete ec.dataset.on; }
    if (ENG.debug) $('fps').textContent = 'FPS ' + ENG.fps();
  }

  // ==================== GÜNLÜK ÖDÜL ====================
  function dailyCheck() {
    const M = GAME.META();
    const today = new Date().toISOString().slice(0, 10);
    if (M.daily !== today) {
      M.daily = today;
      let amount = EXP.factor('daily_reward');
      if (amount === 1) amount = 150; // deney tanımsızsa varsayılan
      M.coins += amount;
      try { localStorage.setItem('neonstorm_save_v1', JSON.stringify(M)); } catch (e) { }
      QUESTS.ensureDaily();
      setTimeout(() => toast('GÜNLÜK ÖDÜL: +' + amount + ' ◈'), 600);
      refreshMenu();
    }
  }

  // ==================== BAĞLAMA ====================
  function init() {
    $('btn-play').addEventListener('click', () => { AUDIO.init(); AUDIO.sfx('ui'); sub = null; GAME.startRun(); });
    $('btn-shop').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'shop'; sync(); });
    $('btn-ach').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'ach'; sync(); });
    $('btn-how').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'how'; sync(); });
    $('btn-quests').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'quests'; sync(); });
    $('btn-board').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'board'; sync(); });
    $('btn-daily').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'daily'; sync(); });
    // v4.0 gelir motoru panelleri — ÇAĞRI ve YILDIZ YOLU KALDIRILDI, PREMİUM UÇAKLAR eklendi
    $('btn-map').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'map'; sync(); });
    $('btn-equip').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'equip'; sync(); });
    $('btn-dungeons').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'dungeons'; sync(); });
    $('btn-planes').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'planes'; sync(); });
    $('btn-map-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-equip-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-dungeons-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-planes-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-daily-claim').addEventListener('click', () => {
      const r = GAME.META2().claimDaily();
      if (r) { AUDIO.sfx('buy'); toast('GÜN ' + r.day + ' ÖDÜLÜ ALINDI · SERİ ' + r.streak, 'info'); renderDaily(); refreshMenu(); }
      else AUDIO.sfx('deny');
    });
    $('btn-daily-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-quests-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-board-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-shop-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-ach-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-how-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-pause').addEventListener('click', () => { AUDIO.sfx('ui'); GAME.togglePause(); });
    $('btn-resume').addEventListener('click', () => { AUDIO.sfx('ui'); GAME.resume(); });
    $('btn-quit').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; GAME.toMenu(); });
    $('btn-reroll').addEventListener('click', () => GAME.reroll());
    $('btn-retry').addEventListener('click', () => { AUDIO.sfx('ui'); GAME.startRun(); });
    $('btn-go-menu').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; GAME.toMenu(); });
    $('btn-x2').addEventListener('click', () => showAd(() => {
      // v2.7: reklam sonrası ödül SEÇİMİ (x2 coin / +500⬡ / +30✧) — hedef A+D
      if (GAME.x2Used()) return;
      renderRewardChoice();
    }));
    document.querySelectorAll('#reward-choice [data-x2]').forEach(b => b.addEventListener('click', () => {
      hideRewardChoice();
      const r = GAME.applyX2Reward(b.dataset.x2);
      if (r === 'gold') { AUDIO.sfx('buy'); toast('ÖDÜL: +' + CORE.X2_REWARDS.gold + ' ⬡ ALTIN', 'info'); }   // v2.38: sayı tek kaynak
      else if (r === 'key') { AUDIO.sfx('buy'); toast('ÖDÜL: +' + CORE.X2_REWARDS.key + ' 🔑 ANAHTAR', 'info'); }   // v4.0
      else if (r) { AUDIO.sfx('buy'); toast('COINLER x2: ◈ ' + (GAME.goInfo() ? GAME.goInfo().coins : 0)); }
      gameOver();
    }));
    // v2.27 (hedef G — handoff işi 3): VAZGEÇ — seçim zorunlu değil; reklam izlendi,
    // ödül hakkı tüketilmez (applyX2Reward çağrılmaz, x2Used=false kalır → x2 tekrar izlenebilir);
    // gameOver() ölüm ekranını geri getirir (v2.26 comment-trap deseni: sync tek başına yetmez)
    $('btn-x2-cancel').addEventListener('click', () => {
      AUDIO.sfx('ui');
      hideRewardChoice();
      gameOver();
    });
    $('btn-revive').addEventListener('click', () => showAd(() => GAME.revive()));
    // v4.0: bedava ANAHTAR — reklam anahtar verir (ekipman kazanımı yalnız sandıktan; Tavan D kanalı)
    $('btn-adcrate').addEventListener('click', () => {
      showAd(() => {
        const r = GAME.META2().watchKeyAd();
        if (r) {
          AUDIO.sfx('buy');
          toast('ANAHTAR KAZANDIN: 🔑' + r.keys + ' — EKİPMAN panelinden sandığı aç!', 'info');
        }
        const adk = GAME.META2().adKeyStatus();
        $('btn-adcrate').textContent = 'BEDAVA ANAHTAR İZLE — SANDIK AÇ (' + adk.left + '/' + adk.max + ')';
        $('btn-adcrate').style.display = adk.left > 0 ? '' : 'none';
        // v2.26 boş-canvas bugfix: sync() mode='over' dalında overlay açmaz (OVERLAYS listesini
        // gizler) → oyuncu reklamdan sonra boş canvas'ta kalıyordu (koşu #22 canlı smoke
        // bulgusu). Ödül sonrası gameOver() ölüm ekranını yeniden doldurur ve gösterir.
        gameOver();
      });
    });
    $('btn-tut-ok').addEventListener('click', () => {
      AUDIO.sfx('ui');
      $('tutorial').classList.add('hidden');
      GAME.resume();
    });
    $('tg-sfx').addEventListener('click', toggleSfx);
    $('tg-sfx2').addEventListener('click', toggleSfx);
    $('tg-music').addEventListener('click', toggleMusic);
    $('tg-music2').addEventListener('click', toggleMusic);
    $('tg-hap').addEventListener('click', toggleHaptics);
    $('tg-hap2').addEventListener('click', toggleHaptics);

    window.addEventListener('keydown', e => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        if (ENG.state.mode === 'play' || ENG.state.mode === 'pause') GAME.togglePause();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && ENG.state.mode === 'play') GAME.togglePause();
    });

    setInterval(updateHud, 100);
    GAME.boot();
    QUESTS.ensureDaily();
    refreshMenu();
    dailyCheck();
    sync();
  }

  return { init, sync, refreshMenu, renderLevelUp, gameOver, toast, showAd, showTutorial };
})();

window.addEventListener('DOMContentLoaded', () => UI.init());
