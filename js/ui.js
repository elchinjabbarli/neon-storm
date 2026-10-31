/* NEON STORM — ui.js : menüler, mağaza, başarımlar, HUD, akış */
'use strict';
const UI = (() => {
  const $ = id => document.getElementById(id);
  // v2.28: 'pay-overlay' listede — GERİ basınca sync() sahte-satın-alma panelini kapatır; yoksa
  // panel menüde havada asılı kalır, oyuncu 3 sn tıklayamaz ve geri sayım MENÜDEYKEN satın almayı tamamlardı
  // (v2.26 comment-trap ailesi: .overlay eklerken OVERLAYS kaydı şart — v2.27 dersi)
  const OVERLAYS = ['menu', 'shop', 'ach', 'how', 'levelup', 'pause', 'gameover', 'quests', 'daily', 'board', 'collect', 'equip', 'map', 'dungeons', 'pass', 'reward-choice', 'pay-overlay'];
  let sub = null; // menü alt ekranları
  let collectTab = 'pulls'; // v2.6: ÇAĞRI paneli sekmesi (pulls | pilots)

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
      else if (sub === 'collect') { renderCollect(); $('collect').classList.remove('hidden'); applyCollectTab(); }
      else if (sub === 'daily') { renderDaily(); $('daily').classList.remove('hidden'); }
      else if (sub === 'equip') { renderEquip(); $('equip').classList.remove('hidden'); }
      else if (sub === 'map') { renderMap(); $('map').classList.remove('hidden'); }
      else if (sub === 'dungeons') { renderDungeons(); $('dungeons').classList.remove('hidden'); }
      else if (sub === 'pass') { renderPass(); $('pass').classList.remove('hidden'); }
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

  // ==================== MAĞAZA ====================
  function renderShop() {
    const M = GAME.META();
    $('shop-coins').textContent = M.coins;
    const list = $('shop-list');
    list.innerHTML = '';
    for (const u of GAME.UPGRADES) {
      const lvl = M.upgrades[u.id] || 0;
      const maxed = lvl >= u.max;
      const cost = maxed ? 0 : u.cost(lvl);
      const item = document.createElement('div');
      item.className = 'shop-item';
      let pips = '';
      for (let i = 0; i < u.max; i++) pips += '<span class="pip' + (i < lvl ? ' full' : '') + '"></span>';
      item.innerHTML =
        '<div class="shop-info"><div class="shop-name">' + u.name + '</div>' +
        '<div class="shop-desc">' + u.desc + '</div><div class="pips">' + pips + '</div></div>' +
        '<button class="btn shop-buy" data-id="' + u.id + '"' + (maxed ? ' disabled' : '') + '>' +
        (maxed ? 'MAKS' : '◈ ' + cost) + '</button>';
      list.appendChild(item);
    }
    list.querySelectorAll('button[data-id]').forEach(b => {
      b.addEventListener('click', () => {
        if (GAME.buy(b.dataset.id)) { AUDIO.sfx('buy'); renderShop(); }
        else AUDIO.sfx('deny');
      });
    });
    // v2.7: gerçek para paketleri (hedef D) — buyBundle bağlantı noktası + sahte ödeme akışı
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
      if (b.oz) parts.push('✧' + b.oz);
      if (b.gold) parts.push('⬡' + b.gold);
      if (b.premium) parts.push('PREMIUM YOL');
      if (b.item) parts.push(b.item + ' EKİPMAN');
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
        (m.fav ? '<div class="fav-badge">PİLOT FAVÖRİ</div>' : '') + // v2.13 pilot sinerjisi
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
        ? '+' + it.reward + '◈' + (it.bonus.gold ? ' +' + it.bonus.gold + '⬡' : '') + (it.bonus.oz ? ' +' + it.bonus.oz + '✧' : '')
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
          toast('GÖREV ÖDÜLÜ: +' + it.reward + ' ◈' + (it.bonus && it.bonus.gold ? ' +' + it.bonus.gold + '⬡' : '') + (it.bonus && it.bonus.oz ? ' +' + it.bonus.oz + '✧' : ''), 'info');
          renderQuests();
        }
      });
      return el;
    };
    info.items.forEach((it, i) => list.appendChild(mk(it, () => GAME.claimQuest(i), 'GÜNLÜK')));
    if (info.weekly) list.appendChild(mk(info.weekly, () => GAME.claimWeekly(), 'HAFTALIK'));
  }

  // ==================== PİLOTLAR ====================
  // v2.6: PİLOTLAR artık ÇAĞRI panelinin sekmesi (kendi overlay'i yok)
  function renderChars() {
    const M = GAME.META();
    const list = $('col-pilot-list');
    list.innerHTML = '';
    for (const id in GAME.allChars()) {
      const c = GAME.allChars()[id];
      const owned = GAME.ownChar(id);
      const sel = M.char === id;
      const el = document.createElement('div');
      el.className = 'shop-item char-item' + (sel ? ' selected' : '');
      el.innerHTML =
        '<div class="shop-info"><div class="shop-name" style="color:' + c.color + '">' + c.name + (sel ? ' · AKTİF' : '') + '</div>' +
        '<div class="shop-desc">' + c.desc + '</div></div>' +
        '<button class="btn shop-buy"' + (sel ? ' disabled' : '') + '>' +
        (owned ? (sel ? 'AKTİF' : 'SEÇ') : (c.gachaRar ? 'ÇEKİLİŞTE' : (c.cost > 0 ? '◈ ' + c.cost : 'SEÇ'))) + '</button>';
      el.querySelector('button').addEventListener('click', () => {
        if (owned) { GAME.selectChar(id); AUDIO.sfx('ui'); renderChars(); }
        else if (GAME.buyChar(id)) { toast('PİLOT AÇILDI: ' + c.name, 'info'); AUDIO.sfx('buy'); renderChars(); }
        else AUDIO.sfx('deny');
      });
      list.appendChild(el);
    }
  }

  // v2.6: ÇAĞRI paneli sekme geçişi
  function applyCollectTab() {
    const pulls = collectTab !== 'pilots';
    $('tab-pulls').classList.toggle('active', pulls);
    $('tab-pilots').classList.toggle('active', !pulls);
    $('col-pull-sec').classList.toggle('hidden', !pulls);
    $('col-pilot-sec').classList.toggle('hidden', pulls);
    if (!pulls) renderChars();
  }

  // ==================== GÜNLÜK ÖDÜL (v2.6) ====================
  function dailyRewardText(r) {
    const parts = [];
    if (r.coins) parts.push('◈ ' + r.coins);
    if (r.gold) parts.push('⬡ ' + r.gold);
    if (r.oz) parts.push('✧ ' + r.oz);
    if (r.item) parts.push(r.item + ' PARÇA');
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
      const ch = GAME.allChars()[r.char] || CORE.CHARS.vektor;
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

  // ==================== TOPLAMA (GACHA) ====================
  const RARNAME = { N: 'NORMAL', R: 'NADİR', SR: 'SÜPER NADİR', SSR: 'EFSANEVİ' };
  const RARCOLOR = { N: '#9ca3af', R: '#22d3ee', SR: '#a78bfa', SSR: '#fbbf24' };
  function renderCollect() {
    const M2 = GAME.META2();
    const c = M2.currencies();
    $('col-oz').textContent = c.oz;
    $('col-shards').textContent = c.shards;
    const pit = M2.pityInfo();
    $('col-pity').textContent = pit.pity + '/' + pit.hard;
    // İSTİHBARAT #4 (v2.30): oran görünürlüğü — metin META RATES kaynağından (elle yazma yasak)
    $('col-rates').textContent = M2.ratesLine();
    // yıldızlar
    const st = $('col-stars');
    st.innerHTML = '';
    const all = GAME.allChars();
    for (const id in all) {
      const lvl = M2.starLevel(id);
      const own = GAME.ownChar(id);
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.innerHTML =
        '<div class="shop-info"><div class="shop-name" style="color:' + (all[id].color || '#22d3ee') + '">' + all[id].name +
        ' <span style="color:' + (all[id].gachaRar ? RARCOLOR[all[id].gachaRar] : '#22d3ee') + '">' + (all[id].gachaRar ? RARNAME[all[id].gachaRar] : '') + '</span></div>' +
        '<div class="shop-desc">★' + lvl + ' · +%' + (lvl * 4) + ' hasar +%' + (lvl * 3) + ' can' + (own ? '' : ' · SAHİP DEĞİL') + '</div></div>' +
        '<button class="btn shop-buy" data-id="' + id + '"' + (!own || lvl >= 5 ? ' disabled' : '') + '>' +
        (lvl >= 5 ? 'MAKS' : 'YILDIZ ◇ ' + [10, 20, 40, 80, 160][lvl]) + '</button>';
      st.appendChild(el);
    }
    st.querySelectorAll('button[data-id]').forEach(b => {
      b.addEventListener('click', () => {
        if (M2.starUp(b.dataset.id)) { AUDIO.sfx('buy'); toast('YILDIZ YÜKSELDİ!', 'info'); renderCollect(); }
        else AUDIO.sfx('deny');
      });
    });
  }
  function showPulls(res) {
    const box = $('col-results');
    box.innerHTML = '';
    // v2.31 (hedef C+D — koşu #27 işi 3): çek x10 özeti — v2.30 ratesLine'ın devamı. 10
    // çekilişin değeri tek bakışta ('N×6 · R×3 · SR×1'); metin pullSummary'den (elle yazma yasak)
    const sum = GAME.META2().pullSummary(res);
    if (sum) {
      const sEl = document.createElement('div');
      sEl.className = 'muted';
      sEl.style.cssText = 'font-size:12px; padding:4px 0 6px; border-bottom:1px solid rgba(255,255,255,.08); margin-bottom:6px';
      sEl.textContent = 'ÖZET: ' + sum;
      box.appendChild(sEl);
    }
    res.forEach(r => {
      const ch = GAME.allChars()[r.id];
      const el = document.createElement('div');
      el.className = 'board-row' + (r.rar === 'SSR' ? ' gold' : '');
      el.innerHTML =
        '<div class="rk" style="color:' + RARCOLOR[r.rar] + '">' + r.rar + '</div>' +
        '<div class="bd-info"><div class="bd-name" style="color:' + (ch ? ch.color : '#fff') + '">' + (ch ? ch.name : r.id) +
        (r.dupe ? ' <span class="muted">(tekrar → ◇' + r.shards + ')</span>' : ' <b style="color:#4ade80">YENİ!</b>') + '</div>' +
        '<div class="bd-sub">' + RARNAME[r.rar] + '</div></div>';
      box.appendChild(el);
    });
    // v2.4: çekiliş sonucunu otomatik görünür yap (kullanıcı aramasın)
    try { box.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (e) { }
  }

  // ==================== EKİPMAN ====================
  function renderEquip() {
    const M2 = GAME.META2();
    const c = M2.currencies();
    $('eq-gold').textContent = c.gold;
    $('eq-shards').textContent = c.shards;
    const slots = $('eq-slots');
    slots.innerHTML = '';
    const inv = M2.inventory();
    const eq = M2.equipped();
    const SLOTNAME = { weapon: 'KANON', armor: 'ZIRH', helm: 'KASK', boots: 'BOT', ring: 'YÜZÜK', amulet: 'KOLYE' };
    // v2.33 (hedef B+G — koşu #29 işi 2): stat etiket haritası renderEquip başına alındı —
    // hem slot satırı hem envanter satırı aynı kaynaktan (SLOT_INFO stat anahtarı; elle yazma yasak)
    const STATNAME = META_DATA.STAT_NAME;   // v2.35: tek kaynak — kopya tanım kaldırıldı
    for (const s in SLOTNAME) {
      const it = inv.find(x => x.id === eq[s]);
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.innerHTML =
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
    // v2.6: birleştirme satırları (3 aynı nadirlik → 1 üst)
    const fuseBox = $('eq-fuse');
    fuseBox.innerHTML = '';
    // v2.26 (hedef G+B — handoff işi 3): kasa ailesi rehberi — #eq-fuse İÇİNDE (kutu zaten
    // max-height + overflow-y'li; net panel yüksekliği değişmez, kutu içeride kayar —
    // v2.19 panel-taşma dersi: yeni içerik scroll'lu kapsayıcıya girer)
    // v2.31 (hedef B — koşu #27 işi 2): SON DÜŞME kaynak günlüğü — parça akışı nereden
    // geliyor oyuncu görsün (kasa ailesi değeri oyuncu bilgisi). #eq-fuse İÇİNDE İLK satır
    // (kutu max-height + overflow-y'li — net panel yüksekliği değişmez, v2.26 dersi).
    const log = M2.itemLog();
    const logEl = document.createElement('p');
    logEl.className = 'muted';
    logEl.style.cssText = 'margin:0 0 8px; font-size:11px; line-height:1.45; text-align:left';
    logEl.textContent = log.length
      ? 'SON DÜŞME: ' + log.map(e => e.src + ' (' + e.r + ')').join(' · ')
      : 'SON DÜŞME: henüz parça yok — kasalar düşmanlardan ve bosstan düşer';
    fuseBox.appendChild(logEl);
    const guide = document.createElement('p');
    guide.className = 'muted';
    guide.style.cssText = 'margin:0 0 8px; font-size:11px; line-height:1.45; text-align:left';
    guide.textContent = 'KASALAR: koşu kasası (düşman drop) · BOSS KASASI her 2. bossta (altın kapak) · ' +
      'ölüm ekranı bedava kasa (günlük 3). YOL: 3 aynı → birleştirme (N→R→SR→SSR) veya ' +
      'YÜKSELTME TAŞI (⬡150/250/500, nadirliği garanti atlar).';
    fuseBox.appendChild(guide);
    // v2.15 (hedef B): YÜKSELTME TAŞI satırı — v2.16 kademeli fiyat (N→R 150 / R→SR 250 / SR→SSR 500)
    const stone = M2.stoneInfo();
    const JUMPTXT = { N: 'N→R', R: 'R→SR', SR: 'SR→SSR' };
    const stEl = document.createElement('div');
    stEl.className = 'shop-item';
    stEl.innerHTML =
      '<div class="shop-info"><div class="shop-name" style="color:#a3e635">YÜKSELTME TAŞI ×' + stone.n + '</div>' +
      '<div class="shop-desc">Sıradaki: ' + JUMPTXT[stone.nextTier] + ' · ⬡ ' + stone.nextPrice + ' — nadirliği garanti atlatır</div></div>' +
      '<button class="btn shop-buy" data-stone-buy' + (c.gold >= stone.nextPrice ? '' : ' disabled') + '>SATIN AL ⬡ ' + stone.nextPrice + '</button>';
    fuseBox.appendChild(stEl);
    fuseBox.querySelectorAll('[data-stone-buy]').forEach(b => b.addEventListener('click', () => {
      if (M2.buyStone(stone.nextTier)) { AUDIO.sfx('buy'); toast('YÜKSELTME TAŞI (' + JUMPTXT[stone.nextTier] + ') ALINDI — stok: ' + M2.stoneInfo().n, 'info'); renderEquip(); }
      else AUDIO.sfx('deny');
    }));
    const fc = M2.fuseCounts();
    for (const rar of META_DATA.FUSE_FROM) {
      const next = META_DATA.FUSE_FROM.indexOf(rar) < META_DATA.FUSE_FROM.length - 1
        ? ['N', 'R', 'SR', 'SSR'][META_DATA.FUSE_FROM.indexOf(rar) + 1] : 'SSR';
      const can = fc[rar] >= 3;
      const el = document.createElement('div');
      el.className = 'shop-item';
      el.innerHTML =
        '<div class="shop-info"><div class="shop-name" style="color:' + RARCOLOR[rar] + '">3× ' + RARNAME[rar] + '</div>' +
        '<div class="shop-desc">→ 1 ' + RARNAME[next] + ' · stok: ' + fc[rar] + '/3</div></div>' +
        '<button class="btn shop-buy" data-fuse="' + rar + '"' + (can ? '' : ' disabled') + '>BİRLEŞTİR</button>';
      fuseBox.appendChild(el);
    }
    fuseBox.querySelectorAll('button[data-fuse]').forEach(b => b.addEventListener('click', () => {
      const nit = M2.fuseItems(b.dataset.fuse);
      if (nit) { AUDIO.sfx('buy'); toast('BİRLEŞTİ: ' + RARNAME[nit.rar] + ' parça!', 'info'); renderEquip(); }
      else AUDIO.sfx('deny');
    }));
    const list = $('eq-inv');
    list.innerHTML = '';
    if (!inv.length) list.innerHTML = '<p class="muted">Envanter boş — bölüm ödüllerinden ekipman kazan.</p>';
    // v2.32: stat etiket haritası renderEquip başına taşındı (slot satırı da aynı kaynağı kullanır)
    // v2.33 (hedef B — koşu #29 işi 3): envanter KAZANÇ SIRASI — satırlar META2.invGainOrder
    // sırasıyla basılır: en iyi KUŞANILIRSA kazancı üstte, kuşanmışlar sonda (satır çizimi
    // v2.32 ile aynı — yalnız iterasyon sırası değişti; tek doğruluk kaynağı meta.js)
    const rank = new Map(M2.invGainOrder(inv).map((id, i) => [id, i]));
    inv.slice().sort((a, b) => (rank.get(a.id) || 0) - (rank.get(b.id) || 0)).forEach(it => {
      const isEq = eq[it.slot] === it.id;
      const rIdx = ['N', 'R', 'SR', 'SSR'].indexOf(it.rar);
      const nextRar = rIdx >= 0 && rIdx < 3 ? ['N', 'R', 'SR', 'SSR'][rIdx + 1] : null;
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
        '<button class="btn shop-buy" data-up="' + it.id + '"' + (it.lvl >= META_DATA.ITEM_LVL_MAX ? ' disabled' : '') + '>YÜKSELT ⬡ ' + META_DATA.itemUpgradeCost(it.rar, it.lvl) + (it.lvl < META_DATA.ITEM_LVL_MAX ? ' · +' + Math.round(META_DATA.itemUpgradeGain(it.slot, it.rar, it.lvl) * 100) + '% ' + STATNAME[META_DATA.SLOT_INFO[it.slot].stat] : '') + '</button>' +
        (nextRar ? '<button class="btn shop-buy" data-stone="' + it.id + '"' + ((stone.tiers[it.rar] | 0) > 0 ? '' : ' disabled') + '>TAŞ ▲ ' + RARNAME[nextRar] + '</button>' : '') + '</div>';
      list.appendChild(el);
    });
    list.querySelectorAll('button[data-eq]').forEach(b => b.addEventListener('click', () => {
      if (M2.equip(+b.dataset.eq)) { AUDIO.sfx('ui'); renderEquip(); }
    }));
    list.querySelectorAll('button[data-up]').forEach(b => b.addEventListener('click', () => {
      if (M2.upgradeItem(+b.dataset.up)) { AUDIO.sfx('buy'); renderEquip(); }
      else AUDIO.sfx('deny');
    }));
    // v2.15: taş kullanımı — nadirlik garanti atlar, stoktan düşer
    list.querySelectorAll('button[data-stone]').forEach(b => b.addEventListener('click', () => {
      const nit = M2.useStone(+b.dataset.stone);
      if (nit) { AUDIO.sfx('buy'); toast('NADİRLİK YÜKSELDİ: ' + RARNAME[nit.rar] + ' — stok: ' + M2.stoneInfo().n, 'info'); renderEquip(); }
      else AUDIO.sfx('deny');
    }));
    const m = M2.equipMods();
    $('eq-total').textContent = 'TOPLAM: hasar +' + Math.round((m.dmg - 1) * 100) + '% · can +' + Math.round((m.hp - 1) * 100) + '% · hız +' + Math.round((m.spd - 1) * 100) + '% · kritik +' + Math.round(m.crit * 100) + '% · yenilenme +' + m.regen.toFixed(1) + '/sn';
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
      essence: { name: 'ÖZ ZİNDANI', desc: '90 sn · Yıldız Özü hasadı' },
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

  // ==================== YILDIZ YOLU ====================
  function renderPass() {
    const M2 = GAME.META2();
    const inf = M2.passInfo();
    // v2.13: sezon taşınma notu (Survivor.io dersi) — carry > 0 ise gösterilir
    $('pass-info').innerHTML = 'SEVİYE <b>' + inf.lvl + '/' + inf.levels + '</b> · SEZON <b>' + inf.season + '</b> · PREMIUM <b>' + (inf.premium ? 'AÇIK' : 'KAPALI') + '</b>' +
      (inf.carry > 0 ? ' · <span class="carry-note">TAŞINAN +' + inf.carry + ' XP</span>' : '');
    $('pass-bar').style.width = Math.min(100, (inf.xp / inf.need) * 100) + '%';
    $('btn-pass-premium').style.display = inf.premium ? 'none' : '';
    const tr = $('pass-track');
    tr.innerHTML = '';
    const fC = inf.claimedFree || {}, pC = inf.claimedPrem || {};
    for (let l = Math.max(1, inf.lvl - 2); l <= Math.min(inf.levels, inf.lvl + 5); l++) {
      const el = document.createElement('div');
      el.className = 'shop-item';
      const fDone = !!fC[l], pDone = !!pC[l];
      el.innerHTML =
        '<div class="shop-info"><div class="shop-name">Kademe ' + l + (l <= inf.lvl ? ' ✓' : '') + '</div>' +
        '<div class="shop-desc">ÜCRETSİZ: ✧10 + ◈' + (l % 5 === 0 ? 150 : 50) + (l % 3 === 0 ? ' + ⬡200' : '') + ' | PREMIUM: ✧25 + ◈' + (l % 5 === 0 ? 300 : 100) + (l % 3 === 0 ? ' + ⬡400' : '') + (l % 5 === 0 ? ' + ekipman' : '') + '</div></div>' +
        '<div class="btn-row"><button class="btn shop-buy" data-pf="' + l + '"' + (fDone || l > inf.lvl ? ' disabled' : '') + '>' + (fDone ? 'ALINDI' : 'ÜCRETSİZ AL') + '</button>' +
        '<button class="btn shop-buy" data-pp="' + l + '"' + (pDone || l > inf.lvl || !inf.premium ? ' disabled' : '') + '>' + (pDone ? 'ALINDI' : 'PREM AL') + '</button></div>';
      tr.appendChild(el);
    }
    tr.querySelectorAll('button[data-pf]').forEach(b => b.addEventListener('click', () => {
      const r = M2.claimPass('free', +b.dataset.pf);
      if (r) { AUDIO.sfx('buy'); const pc = M2.takePendingCoins(); if (pc) GAME.addMetaCoins(pc); renderPass(); }
      else AUDIO.sfx('deny');
    }));
    tr.querySelectorAll('button[data-pp]').forEach(b => b.addEventListener('click', () => {
      const r = M2.claimPass('prem', +b.dataset.pp);
      if (r) { AUDIO.sfx('buy'); const pc = M2.takePendingCoins(); if (pc) GAME.addMetaCoins(pc); renderPass(); }
      else AUDIO.sfx('deny');
    }));
  }

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
      if (sr.first) extra += ' · İLK TEMİZLİK: ◈' + sr.first.coins + ' ⬡' + sr.first.gold + ' ✧' + sr.first.oz + ' + EKİPMAN';
      if (sr.triple) extra += ' · 3★ BÖLÜM BONUSU: ✧' + sr.triple.oz;
      $('go-stats').innerHTML =
        'YILDIZ <b style="color:#fbbf24">' + '★'.repeat(sr.stars) + '</b> · AV <b>' + g.kills + '</b>' + extra +
        '<br>KAZANILAN COIN <b>◈ ' + g.coins + '</b>';
      $('btn-x2').style.display = 'none';
      $('btn-revive').style.display = 'none';
      $('btn-adcrate').style.display = 'none';
    } else if (dr) {
      nmEl.classList.add('hidden');
      $('go-timeline').classList.add('hidden'); $('go-bestprog').classList.add('hidden');
      $('go-title').textContent = 'ZİNDAN TAMAMLANDI';
      const parts = [];
      if (dr.gold) parts.push('⬡ ' + dr.gold);
      if (dr.oz) parts.push('✧ ' + dr.oz);
      $('go-stats').innerHTML =
        'AV <b>' + g.kills + '</b> · ÖDÜL <b style="color:#fbbf24">' + parts.join(' + ') + '</b>' +
        '<br>KAZANILAN COIN <b>◈ ' + g.coins + '</b>';
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
    $('go-stats').innerHTML =
      'SÜRE <b>' + fmtT(g.time) + '</b> · SKOR <b>' + g.score + '</b><br>' +
      'AV <b>' + g.kills + '</b> · SEVİYE <b>' + g.level + '</b><br>' +
      'KAZANILAN COIN <b>◈ ' + g.coins + '</b>' +
      // v2.29 (hedef E+B): kasa ailesi oyuncu bilgisi — kaç kasa açtı (0 ise nazikçe gizli)
      (g.crates ? '<br>BU KOŞUDA <b style="color:#fbbf24">' + g.crates + '</b> KASA AÇTIN' : '');
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
    // v2.9 (hedef D): BEDAVA KASA İZLE — günlük ≤3 rewarded reklam kasası
    const crate = GAME.META2().adCrateStatus();
    $('btn-adcrate').textContent = 'BEDAVA KASA İZLE — EKİPMAN KAZAN (' + crate.left + '/' + crate.max + ')';
    $('btn-adcrate').style.display = crate.left > 0 ? '' : 'none';
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
    $('reward-choice').classList.remove('hidden');
  }
  function hideRewardChoice() {
    $('reward-choice').classList.add('hidden');
  }

  // ==================== PAKET SATIN ALMA (v2.8: native StoreKit ↔ web sim) ====================
  // Köprü sözleşmesi: buyBundle(id) → Promise<boolean> (true = satın alma onaylı)
  function creditBundle(id) {
    const r = GAME.META2().buyBundle(id);
    if (r) {
      AUDIO.sfx('buy');
      const parts = [];
      if (r.oz) parts.push('✧' + r.oz);
      if (r.gold) parts.push('⬡' + r.gold);
      if (r.premium) parts.push('PREMIUM');
      if (r.item) parts.push('EKİPMAN');
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
    // v2.0 gelir motoru panelleri
    $('btn-map').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'map'; sync(); });
    $('btn-collect').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'collect'; sync(); });
    $('btn-equip').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'equip'; sync(); });
    $('btn-dungeons').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'dungeons'; sync(); });
    $('btn-pass').addEventListener('click', () => { AUDIO.sfx('ui'); sub = 'pass'; sync(); });
    $('btn-map-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-collect-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-equip-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-dungeons-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-pass-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-pull1').addEventListener('click', () => {
      const r = GAME.META2().pull1();
      if (r) { AUDIO.sfx('buy'); showPulls(r); renderCollect(); } else AUDIO.sfx('deny');
    });
    // v2.6: ÇAĞRI sekme butonları + günlük ödül
    $('tab-pulls').addEventListener('click', () => { AUDIO.sfx('ui'); collectTab = 'pulls'; applyCollectTab(); });
    $('tab-pilots').addEventListener('click', () => { AUDIO.sfx('ui'); collectTab = 'pilots'; applyCollectTab(); });
    $('btn-daily-claim').addEventListener('click', () => {
      const r = GAME.META2().claimDaily();
      if (r) { AUDIO.sfx('buy'); toast('GÜN ' + r.day + ' ÖDÜLÜ ALINDI · SERİ ' + r.streak, 'info'); renderDaily(); refreshMenu(); }
      else AUDIO.sfx('deny');
    });
    $('btn-daily-back').addEventListener('click', () => { AUDIO.sfx('ui'); sub = null; sync(); });
    $('btn-pull10').addEventListener('click', () => {
      const r = GAME.META2().pull10();
      if (r) { AUDIO.sfx('buy'); showPulls(r); renderCollect(); } else AUDIO.sfx('deny');
    });
    $('btn-pass-premium').addEventListener('click', () => {
      if (GAME.META2().buyBundle('pass')) { AUDIO.sfx('buy'); toast('PREMIUM AKTİF!', 'info'); renderPass(); }
      else AUDIO.sfx('deny');
    });
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
      if (r === 'gold') { AUDIO.sfx('buy'); toast('ÖDÜL: +500 ⬡ ALTIN', 'info'); }
      else if (r === 'oz') { AUDIO.sfx('buy'); toast('ÖDÜL: +30 ✧ ÖZ', 'info'); }
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
    // v2.9: bedava kasa — showAd zaten NATIVE_BRIDGE yolunu kullanır (web'de sim)
    $('btn-adcrate').addEventListener('click', () => {
      showAd(() => {
        const it = GAME.META2().watchCrate();
        if (it) {
          AUDIO.sfx('buy');
          // v2.24 (hedef E+B, istihbarat #1 devam): kasa ailesi evo sinyali — ölüm ekranı
          // kasası da evoReady bakar; az-kalsın ailesi motivasyonu (hedef E ölüm ekranı)
          const h = (GAME.getHud ? GAME.getHud() : null);
          const evGo = !!(h && h.evoReady);
          toast('KASA AÇILDI: ' + it.rar + ' EKİPMAN — EKİPMAN panelinden kuşan' +
            (evGo ? ' · EVRİME HAZİR koşu: EVRİM kartı bu koşuda kaçtı!' : ''), 'info');
        }
        const crate = GAME.META2().adCrateStatus();
        $('btn-adcrate').textContent = 'BEDAVA KASA İZLE — EKİPMAN KAZAN (' + crate.left + '/' + crate.max + ')';
        $('btn-adcrate').style.display = crate.left > 0 ? '' : 'none';
        // v2.26 boş-canvas bugfix: sync() mode='over' dalında overlay açmaz (OVERLAYS listesini
        // gizler) → oyuncu kasa reklamından sonra boş canvas'ta kalıyordu (koşu #22 canlı smoke
        // bulgusu; tek çıkış sayfa yenilemekti). x2 (gameOver) + revive (play) akışlarındaki
        // desenle uyum: ödül sonrası gameOver() ölüm ekranını yeniden doldurur ve gösterir.
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
