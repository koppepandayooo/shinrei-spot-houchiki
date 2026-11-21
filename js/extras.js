'use strict';
/* =========================================================
 * 追加機能：仲間・転生・音量・デイリーボーナス・ランキング
 * （game.js の S / V / fmt などを使う。game.js のあとに読み込む）
 * ========================================================= */

/* ---------- 仲間 ---------- */
const compEls = {};
function compCost(c) {
  const lv = S.comp[c.id];
  return lv === 0 ? c.join : Math.ceil(c.base * Math.pow(c.growth, lv - 1));
}
function compEffect(c) {
  const lv = S.comp[c.id];
  const next = Math.min(c.max, lv + 1);
  const arrow = lv > 0 && lv < c.max;
  switch (c.id) {
    case 'cat':
      return lv === 0
        ? '約30秒ごとに、探索12秒分のフィルムを拾ってくる'
        : `約${Math.round(catInterval(lv))}秒ごとに、探索${catAmountSec(lv)}秒分のフィルムを拾ってくる` +
            (arrow ? `（次：${catAmountSec(next)}秒分）` : '');
    case 'kohai':
      return `撮影報酬 ×${fmt(kohaiMult(Math.max(1, lv)))}` + (arrow ? ` → ×${fmt(kohaiMult(next))}` : '');
    case 'vet':
      return `探索収入 ×${fmt(vetMult(Math.max(1, lv)))}` + (arrow ? ` → ×${fmt(vetMult(next))}` : '');
  }
  return '';
}
function buildCompanions() {
  const box = $('#tab-companions');
  box.innerHTML = '<p class="note tab-note">フィルムで仲間をむかえて、なかよし度を上げると効果がアップします。仲間は転生しても残ります。</p>';
  COMPANIONS.forEach((c) => {
    const el = document.createElement('div');
    el.className = 'card comp';
    el.innerHTML = `
      <div class="comp-pic"><img alt=""></div>
      <div class="comp-main">
        <div class="comp-name"></div>
        <div class="comp-lv"></div>
        <p class="comp-desc"></p>
        <div class="comp-eff"></div>
      </div>
      <button type="button" class="btn comp-btn"></button>`;
    el.querySelector('.comp-btn').addEventListener('click', () => joinCompanion(c.id));
    box.appendChild(el);
    compEls[c.id] = {
      el,
      img: el.querySelector('img'),
      name: el.querySelector('.comp-name'),
      lv: el.querySelector('.comp-lv'),
      desc: el.querySelector('.comp-desc'),
      eff: el.querySelector('.comp-eff'),
      btn: el.querySelector('.comp-btn'),
    };
  });
  refreshCompanions();
}
function refreshCompanions() {
  COMPANIONS.forEach((c) => {
    const e = compEls[c.id];
    if (!e) return;
    const lv = S.comp[c.id];
    // 一度仲間になったら、転生でスポットが最初に戻っても仲間のまま（ロック表示にしない）
    const locked = S.comp[c.id] === 0 && S.unlocked < c.req;
    e.el.classList.toggle('locked', locked);
    e.el.classList.toggle('joined', lv > 0);
    const pic = Sprites.compImage(c.id);
    const src = pic ? pic.src : Sprites.compURL(c.id, locked);
    if (e.img.getAttribute('src') !== src) e.img.src = src;
    e.img.style.width = pic ? pic.width * (c.id === 'cat' ? 2 : 1) * 0.75 + 'px' : '';
    e.img.style.filter = locked && pic ? 'brightness(0) opacity(0.55)' : '';
    // 画面と同じく、進む向き（右）を向かせる
    e.img.style.transform = pic && (c.id === 'cat' || c.id === 'vet') ? 'scaleX(-1)' : '';
    e.name.textContent = locked ? '？？？' : c.name;
    e.desc.textContent = locked ? `「${STAGES[c.req - 1].name}」で出会えるかもしれない…` : c.desc;
    e.eff.textContent = locked ? '' : compEffect(c);
    e.lv.textContent = lv > 0 ? `なかよし度 Lv${lv}${lv >= c.max ? '（最大）' : ''}` : locked ? '' : 'まだ仲間ではない';
    if (locked) {
      e.btn.textContent = '🔒';
      e.btn.disabled = true;
      e.btn.classList.remove('affordable');
      return;
    }
    if (lv >= c.max) {
      e.btn.textContent = 'MAX';
      e.btn.disabled = true;
      e.btn.classList.remove('affordable');
      return;
    }
    const cost = compCost(c);
    e.btn.innerHTML = `${lv === 0 ? '仲間にする' : 'なかよし度UP'}<br><img class="icon-s" src="${Sprites.iconURL('film')}" alt="">${fmt(cost)}`;
    const ok = S.film >= cost;
    e.btn.disabled = !ok;
    e.btn.classList.toggle('affordable', ok);
  });
  const notice = COMPANIONS.some((c) => S.unlocked >= c.req && S.comp[c.id] === 0 && S.film >= c.join);
  $('#tabBtnComp').classList.toggle('notice', notice);
}
function joinCompanion(id) {
  const c = COMPANIONS.find((x) => x.id === id);
  if (!c || (S.comp[id] === 0 && S.unlocked < c.req) || S.comp[id] >= c.max) return;
  const cost = compCost(c);
  if (S.film < cost) return;
  S.film -= cost;
  S.comp[id]++;
  if (S.comp[id] === 1) {
    Sound.unlock();
    log(`${c.name}が仲間になった！`, 'gold');
    toast(`${c.name}が仲間になった！`);
  } else {
    Sound.buy();
  }
  checkAchievements();
  refreshCompanions();
  refreshUI(true);
  save();
}
// 黒猫がときどきフィルムを拾ってくる
V.catT = 20;
V.catHop = 0;
function updateCompanions(dt) {
  V.catHop = Math.max(0, V.catHop - dt);
  if (S.comp.cat <= 0) return;
  V.catT -= dt;
  if (V.catT > 0) return;
  V.catT = catInterval() * (0.8 + Math.random() * 0.4);
  const amount = ratePerSec() * catAmountSec();
  gain(amount);
  V.catHop = 0.5;
  Sound.sweep(1100, 1500, 0.14, 'triangle', 0.03);
  floatText('クロがフィルムを拾ってきた +' + fmt(amount), ((YURA_CX - 12) / SW) * 100, ((GY - 22) / SH) * 100, 'auto', 1600);
  if (Math.random() < 0.3) log(`黒猫のクロが、どこかからフィルムをくわえて戻ってきた。 +${fmt(amount)}`);
}

/* ---------- 転生（お祓いを受けて出直す） ---------- */
// 1周の稼ぎの記録値
const runScore = (run = S.runTotal) =>
  run > REBIRTH.base ? Math.floor(REBIRTH.perDecade * Math.log10(run / REBIRTH.base)) : 0;
// 記録値が v になるのに必要な「今回の獲得フィルム」
const rebirthNeed = (v) => REBIRTH.base * Math.pow(10, v / REBIRTH.perDecade);
// いま転生したらもらえる踏破ボーナス（初回だけ）
function firstBonusNow() {
  let b = 0;
  const list = [];
  for (const id in REBIRTH.firstBonus) {
    if (S.firstBonus[id] || !spotOpen(S, id)) continue;
    b += REBIRTH.firstBonus[id];
    list.push(STAGES[stageIndex(id)].name);
  }
  return { b, list };
}
// いま転生したらもらえる霊感（最高記録を超えた分＋踏破ボーナス）
const rebirthGain = () => Math.max(0, runScore() - S.bestRunScore) + firstBonusNow().b;
const canRebirth = () => S.unlocked >= REBIRTH.minSpots && rebirthGain() >= 1;
function buildRebirth() {
  const box = document.createElement('div');
  box.className = 'card rebirth';
  box.id = 'rebirthBox';
  box.innerHTML = `
    <h3>転生（お祓いを受けて出直す）</h3>
    <p class="note">フィルム・装備・解放したスポットが最初に戻るかわりに、<b>霊感</b>を得ます。霊感1につき、すべての収入が+10%（ずっと残ります）。仲間・心霊写真・実績は残ります。</p>
    <p class="note">霊感は「1周で稼いだフィルム」の<b>最高記録を更新した分</b>だけ増えます。奥まで進んでたくさん稼いでから転生するほどお得です。初めて旧吹上隧道・八王子城跡まで行って転生したときは、踏破ボーナスもあります。</p>
    <dl class="rebirth-stats">
      <dt>いまの霊感</dt><dd id="rbNow">0</dd>
      <dt>今回の記録／最高記録</dt><dd id="rbScore">0 / 0</dd>
      <dt>いま転生すると</dt><dd id="rbGain">+0</dd>
      <dt>転生後の収入</dt><dd id="rbMult">×1</dd>
    </dl>
    <button type="button" class="btn" id="rbBtn">転生する</button>
    <p class="note" id="rbReq"></p>`;
  $('#tab-upgrades').appendChild(box);
  $('#rbBtn').addEventListener('click', doRebirth);
}
function refreshRebirth() {
  if (!$('#rbNow')) return;
  const g = rebirthGain();
  const fb = firstBonusNow();
  const cur = runScore();
  $('#rbNow').textContent = `${fmt(S.reikan)}（収入 ×${fmt(reikanMult())}）`;
  $('#rbScore').textContent = `${cur} / ${S.bestRunScore}`;
  $('#rbGain').textContent = `+${fmt(g)}` + (fb.b ? `（踏破ボーナス+${fb.b}込み）` : '');
  $('#rbMult').textContent = `×${fmt(reikanMult(S.reikan + g))}`;
  const ok = canRebirth();
  $('#rbBtn').disabled = !ok;
  $('#rbBtn').classList.toggle('affordable', ok);
  $('#rbReq').textContent =
    S.unlocked < REBIRTH.minSpots
      ? `「${STAGES[REBIRTH.minSpots - 1].name}」を解放すると転生できるようになります。`
      : `最高記録を+1更新するまで：あと ${fmt(Math.max(0, rebirthNeed(Math.max(cur, S.bestRunScore) + 1) - S.runTotal))} フィルム`;
}
async function doRebirth() {
  if (!canRebirth()) return;
  const g = rebirthGain();
  const yes = await askConfirm({
    title: '本当に転生しますか？',
    html:
      `霊感 <b>+${g}</b>（収入 ×${fmt(reikanMult())} → <b>×${fmt(reikanMult(S.reikan + g))}</b>）<br><br>` +
      'フィルム・装備・解放したスポットは最初に戻ります。<br>仲間・心霊写真・実績は残ります。',
    ok: '転生する',
    cancel: 'やめる',
  });
  if (!yes || !canRebirth()) return;
  const gainNow = rebirthGain();
  const fbNow = firstBonusNow();
  S.reikan += gainNow;
  S.bestRunScore = Math.max(S.bestRunScore, runScore());
  for (const id in REBIRTH.firstBonus) if (spotOpen(S, id)) S.firstBonus[id] = true;
  S.rebirths++;
  S.film = 0;
  S.runTotal = 0;
  for (const k in S.lv) S.lv[k] = 0;
  S.unlocked = 1;
  S.stage = 0;
  S.secretOpen = false; // 隠しスポットは、八王子城跡まで登り直すとまた行ける
  V.ghost = null;
  V.scroll = 0;
  V.cycle = 0;
  V.fade = 1;
  V.prayedK = null;
  V.pray = 0;
  if (V.step) endStep('timeout');
  Sound.chime();
  log(`お祓いを受けて、ゆらは出直すことにした。 霊感 +${gainNow}` + (fbNow.b ? `（踏破ボーナス：${fbNow.list.join('・')}）` : ''), 'gold');
  showModal('転生しました', `霊感 <b>+${gainNow}</b>（合計 ${fmt(S.reikan)}）` + (fbNow.b ? `<br><small>踏破ボーナス +${fbNow.b}（${fbNow.list.join('・')}）を含みます</small>` : '') + `<br>これからの収入は <b>×${fmt(reikanMult())}</b> になります。<br><br><small>${STAGES[0].name}からやり直し。仲間たちも一緒です。</small>`);
  buildSpots();
  buildCollection();
  refreshCompanions();
  checkAchievements();
  refreshUI(true);
  save();
  autoSubmit();
}

/* ---------- 表示の設定：撮影フラッシュの色（白／黒） ---------- */
function setupFlashColor() {
  const btns = document.querySelectorAll('.flash-color button');
  const sync = () => btns.forEach((b) => b.classList.toggle('active', b.dataset.color === S.flashColor));
  btns.forEach((b) =>
    b.addEventListener('click', () => {
      S.flashColor = b.dataset.color;
      sync();
      V.flash = 0.55; // 試しに光らせる
      save();
    })
  );
  sync();
}

/* ---------- 音量 ---------- */
function setupVolume() {
  const bind = (id, key, preview) => {
    const input = $(id);
    const label = $(id + 'Val');
    input.value = Math.round(S.vol[key] * 100);
    label.textContent = input.value + '%';
    input.addEventListener('input', () => {
      S.vol[key] = input.value / 100;
      label.textContent = input.value + '%';
      Sound.setVolumes(S.vol.sfx, S.vol.amb);
    });
    input.addEventListener('change', () => {
      Sound.ambientStart();
      if (preview) preview();
      save();
    });
  };
  bind('#volSfx', 'sfx', () => Sound.shutter());
  bind('#volAmb', 'amb', null);
}

/* ---------- デイリーボーナス（端末の日付で判定） ---------- */
function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function checkDaily() {
  const now = new Date();
  const today = dateKey(now);
  if (S.daily.last === today) return;
  const y = new Date(now);
  y.setDate(y.getDate() - 1);
  S.daily.streak = S.daily.last === dateKey(y) ? S.daily.streak + 1 : 1;
  S.daily.last = today;
  S.daily.best = Math.max(S.daily.best || 0, S.daily.streak);
  const idx = (S.daily.streak - 1) % DAILY.length;
  const day = DAILY[idx];
  const amount = Math.max(ratePerSec() * day.min * 60, clickReward() * 20 * (idx + 1), 50 * (idx + 1));
  gain(amount);
  if (day.reikan) S.reikan += day.reikan;
  const cells = DAILY.map((d, i) => {
    const cls = i < idx ? 'got' : i === idx ? 'today' : '';
    return `<span class="daily-cell ${cls} ${d.reikan ? 'big' : ''}">${i + 1}日目${i < idx ? '<br>✓' : i === idx ? '<br>★' : '<br>　'}</span>`;
  }).join('');
  showModal(
    'デイリーボーナス',
    `<div class="daily-row">${cells}</div>` +
      `連続 <b>${S.daily.streak}</b> 日目！<br>` +
      `<span class="big-gain"><img class="icon-s" src="${Sprites.iconURL('film')}" alt="">+${fmt(amount)}</span>` +
      (day.reikan ? `<br><b class="gold">7日目の特別ボーナス：霊感 +${day.reikan}</b>` : '') +
      `<br><small>明日も開くと、もっともらえます。</small>`,
    '受け取る'
  );
  log(`デイリーボーナス（${S.daily.streak}日目） +${fmt(amount)} フィルム`, 'gold');
  checkAchievements();
  save();
}

/* ---------- 設定・ランキングのパネル（ヘッダーのボタンで開く） ---------- */
function openSheet(id) {
  document.querySelectorAll('.sheet').forEach((s) => s.classList.add('hidden'));
  $('#' + id).classList.remove('hidden');
  document.body.classList.add('sheet-open');
}
function closeSheets() {
  document.querySelectorAll('.sheet').forEach((s) => s.classList.add('hidden'));
  document.body.classList.remove('sheet-open');
}
function setupSheets() {
  $('#icoSettings').src = Sprites.iconURL('gear');
  $('#icoRank').src = Sprites.iconURL('trophy');
  $('#btnSettings').addEventListener('click', () => {
    refreshUI(true);
    openSheet('settingsPanel');
  });
  $('#btnRank').addEventListener('click', openRanking);
  document.querySelectorAll('.sheet').forEach((sheet) => {
    sheet.querySelector('.sheet-close').addEventListener('click', closeSheets);
    // 外側（暗いところ）をタップしても閉じる
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) closeSheets();
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSheets();
  });
}

/* ---------- オンラインランキング（Cloudflare Workers に送る） ----------
 * 名前を一度登録すれば、あとは自動で送信する：
 *  - プレイしている間、30分ごと
 *  - スポットを移動したとき（新しいスポットを解放したときも）
 *  - ランキングを開いたとき・「更新」を押したとき
 *  - 転生したとき
 *  - ゲームを閉じる・別のアプリに切り替えるとき
 * サーバーは同じ人からの送信を20秒に1回までしか受け付けないので、
 * 間隔が短すぎるときは、受け付けられるようになってからまとめて1回送る */
let rankBusy = false;
let rankLastScore = -1; // 最後に送ったスコア
let rankLastSpot = 0; // 最後に送った到達スポット
let rankLastAt = 0; // 最後に送った時刻
let rankTimer = null; // 後で送る予約
const RANK_MIN_GAP = 25 * 1000; // サーバーの制限（20秒）より少し長く
const RANK_AUTO_EVERY = 30 * 60 * 1000; // プレイ中の自動送信の間隔
// ランキングに出すスポット：これまでに到達した一番奥（転生して最初に戻っても下がらない）
// 1〜7＝通常スポット（弱い順）、8＝隠しスポット。サーバーも、同じ人の記録は一番奥のものを残す
const reachedSpotNo = () => (S.secretSeen || S.secretOpen ? STAGES.length : Math.max(S.unlocked, S.bestUnlocked || 1));
// 前回送ったときから、スコアか到達スポットが変わったか
const rankDirty = () => Math.floor(S.total) > rankLastScore || reachedSpotNo() !== rankLastSpot;
function ensurePlayerId() {
  if (S.playerId) return S.playerId;
  S.playerId =
    window.crypto && crypto.randomUUID
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
          const r = (crypto.getRandomValues(new Uint8Array(1))[0] & 15) | 0;
          return (ch === 'x' ? r : (r & 3) | 8).toString(16);
        });
  return S.playerId;
}
const rankURL = (path) => RANKING_API.replace(/\/$/, '') + path;
async function rankFetch(path, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    // ブラウザに古い一覧を使い回させない
    const res = await fetch(rankURL(path), { cache: 'no-store', ...opts, signal: ctrl.signal });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  } finally {
    clearTimeout(timer);
  }
}
function rankMsg(text, ok) {
  const el = $('#rankMsg');
  el.textContent = text;
  el.className = 'code-msg ' + (ok ? 'ok' : 'ng');
}
function scorePayload() {
  return JSON.stringify({
    id: ensurePlayerId(),
    name: S.playerName,
    score: Math.floor(S.total),
    spot: reachedSpotNo(),
    rebirths: S.rebirths,
    photos: S.ghosts,
  });
}
function updateRankUI(editing) {
  const joined = !!S.playerName && !editing;
  $('#rankForm').classList.toggle('hidden', joined);
  $('#rankJoined').classList.toggle('hidden', !joined);
  $('#rankHead').textContent = joined ? 'ランキングに参加中' : S.playerName ? '名前を変更' : '名前を登録して参加';
  $('#rankNote').textContent = joined
    ? 'スコアは「総獲得フィルム」です。'
    : 'スコアは「総獲得フィルム」です。名前を登録すると参加できます（12文字まで・ログイン不要）。';
  $('#rankMeName').textContent = S.playerName;
  $('#rankSend').textContent = S.playerName ? '変更' : '登録';
  refreshBoardButtons();
  if (!joined) $('#rankName').value = S.playerName;
}
function setupRanking() {
  const enabled = !!RANKING_API;
  $('#rankOff').classList.toggle('hidden', enabled);
  $('#rankOn').classList.toggle('hidden', !enabled);
  updateRankUI(false);
  if (!enabled) return;
  $('#rankSend').addEventListener('click', registerName);
  $('#rankName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') registerName();
  });
  $('#rankRename').addEventListener('click', () => {
    updateRankUI(true);
    $('#rankName').focus();
  });
  // 「更新」：自分の最新のスコアを送ってから、一覧を読み直す
  $('#rankReload').addEventListener('click', async () => {
    if (S.playerName && rankDirty() && Date.now() - rankLastAt >= RANK_MIN_GAP) await submitScore(false);
    else queueSubmit();
    await loadRanking();
  });
  setupBoard();
  // プレイしている間は30分ごとに自動送信（画面が見えているときだけ）
  setInterval(() => {
    if (!document.hidden) autoSubmit();
  }, RANK_AUTO_EVERY);
  // ゲームを閉じる・裏に回すときにも送る（ページが閉じても届く sendBeacon を使う）
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) beaconSubmit();
  });
  window.addEventListener('pagehide', beaconSubmit);
}
function cleanName(s) {
  return Array.from(
    String(s)
      .replace(/[\u0000-\u001f\u007f<>]/g, '')
      .trim()
  )
    .slice(0, 12)
    .join('');
}
async function registerName() {
  const name = cleanName($('#rankName').value);
  if (!name) {
    rankMsg('名前を入力してください（12文字まで）。', false);
    return;
  }
  S.playerName = name;
  save();
  updateRankUI(false);
  rankLastAt = 0; // 名前の変更はすぐ送る
  await submitScore(true);
  await loadRanking();
}
// スコアか到達スポットが変わっていれば送る（間隔が短すぎるときは、あとで送る予約をする）
function autoSubmit() {
  if (!RANKING_API || !S.playerName || tabPaused) return;
  if (!rankDirty()) return;
  queueSubmit();
}
function queueSubmit() {
  if (!RANKING_API || !S.playerName || tabPaused) return;
  clearTimeout(rankTimer);
  rankTimer = null;
  const wait = RANK_MIN_GAP - (Date.now() - rankLastAt);
  if (wait <= 0 && !rankBusy) {
    if (rankDirty()) submitScore(false);
    return;
  }
  rankTimer = setTimeout(queueSubmit, Math.max(wait, 1000) + 500);
}
// スポットを移動したとき（game.js の goStage から呼ぶ）
function onStageChangedForRanking() {
  if (RANKING_API && S.playerName) queueSubmit();
}
function beaconSubmit() {
  if (!RANKING_API || !S.playerName || !navigator.sendBeacon || tabPaused) return;
  if (!rankDirty() || Date.now() - rankLastAt < RANK_MIN_GAP) return;
  // text/plain で送ると事前確認（プリフライト）なしで届く。サーバーは中身を JSON として読む
  const ok = navigator.sendBeacon(rankURL('/api/score'), new Blob([scorePayload()], { type: 'text/plain' }));
  if (ok) {
    rankLastScore = Math.floor(S.total);
    rankLastSpot = reachedSpotNo();
    rankLastAt = Date.now();
  }
}
async function submitScore(manual) {
  if (!RANKING_API || rankBusy || !S.playerName) return;
  if (!manual && Date.now() - rankLastAt < RANK_MIN_GAP) return;
  rankBusy = true;
  const score = Math.floor(S.total);
  const spot = reachedSpotNo();
  if (manual) rankMsg('送信中…', true);
  try {
    const { status, data } = await rankFetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: scorePayload(),
    });
    if (status === 200 && data.ok) {
      rankLastScore = score;
      rankLastSpot = spot;
      rankLastAt = Date.now();
      if (!S.ranked) {
        S.ranked = true;
        checkAchievements();
        save();
      }
      if (manual) rankMsg(`登録しました！ いまの順位：${data.rank}位`, true);
      loadBoard();
      // 送っている間にさらに変わっていたら（スポットを続けて移動したときなど）、あとでもう一度
      if (rankDirty()) queueSubmit();
    } else if (status === 429) {
      rankLastAt = Date.now();
      if (manual) rankMsg('少し前に送信したばかりです。しばらくすると自動で送られます。', true);
      setTimeout(queueSubmit, 0); // 受け付けられるようになったら送る
    } else if (manual) {
      rankMsg(`送信できませんでした（${data.error || status}）。`, false);
    }
  } catch (e) {
    if (manual) rankMsg('サーバーにつながりませんでした。時間をおいて試してください。', false);
  } finally {
    rankBusy = false;
  }
}
async function openRanking() {
  openSheet('rankPanel');
  updateRankUI(false);
  if (!RANKING_API) return;
  $('#rankMsg').textContent = '';
  // 参加中なら、最新のスコアを送ってからランキングを表示
  if (S.playerName && rankDirty() && Date.now() - rankLastAt >= RANK_MIN_GAP) await submitScore(false);
  else if (S.playerName) queueSubmit();
  await loadRanking();
}
const SPOT_SHORT = ['電話ボックス', '陵北大橋', '旧満地', '道了堂', '旧小峰', '旧吹上', '八王子城', '旧旧吹上'];
/* ネタバレ防止：ランキングの到達スポットは、見ている本人がまだ到達（解放）していなければ「？？？」にする。
 * 隠しスポットは、本人が一度でもたどり着いたことがある場合だけ名前を出す */
function rankSpotLabel(spot) {
  const i = (spot || 1) - 1;
  const st = STAGES[i];
  if (!st) return '';
  const known = st.secret ? !!S.secretSeen : i < Math.max(S.unlocked, S.bestUnlocked || 1);
  return known ? SPOT_SHORT[i] || st.name : '？？？';
}
function renderRankRows(list, entries) {
  list.innerHTML = '';
  if (!entries.length) list.innerHTML = '<li class="rank-empty">まだ誰も登録していません。一番乗りのチャンス！</li>';
  entries.forEach((e) => {
    const li = document.createElement('li');
    li.className = 'rank-row' + (e.me ? ' me' : '') + (e.rank <= 3 ? ' top' + e.rank : '');
    const no = document.createElement('span');
    no.className = 'rank-no';
    no.textContent = e.rank;
    const nm = document.createElement('span');
    nm.className = 'rank-name';
    nm.textContent = e.name;
    const meta = document.createElement('span');
    meta.className = 'rank-meta';
    meta.textContent = rankSpotLabel(e.spot);
    const sc = document.createElement('span');
    sc.className = 'rank-score';
    sc.textContent = fmt(e.score);
    const rb = document.createElement('span');
    rb.className = 'rank-rb';
    rb.textContent = `転生${e.rebirths || 0}`;
    li.append(no, nm, meta, sc, rb);
    list.appendChild(li);
  });
}
// データ削除のとき、ランキングの自分の記録も消す
async function deleteRankingEntry(id) {
  try {
    const { status } = await rankFetch('/api/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    return status === 200;
  } catch (e) {
    return false;
  }
}
// 常に表示するランキング（上位10人と自分の順位）
// 参加者が少ないうちは、PCでは1行の細い帯にする
function renderBoard(data) {
  document.querySelectorAll('.rb-list').forEach((el) => renderRankRows(el, data.entries.slice(0, 10)));
  const me = data.me ? `${S.playerName || 'あなた'}：${data.me.rank}位` : S.playerName ? '' : '未参加';
  document.querySelectorAll('.rb-me').forEach((el) => (el.textContent = me));
}
function refreshBoardButtons() {
  document.querySelectorAll('.rb-open').forEach((b) => (b.textContent = S.playerName ? 'TOP50' : '参加する'));
}
async function loadBoard() {
  if (!RANKING_API) return;
  refreshBoardButtons();
  try {
    const { status, data } = await rankFetch('/api/ranking?limit=10&id=' + encodeURIComponent(ensurePlayerId()));
    if (status !== 200 || !Array.isArray(data.entries)) throw new Error(String(status));
    renderBoard(data);
  } catch (e) {
    document.querySelectorAll('.rb-list').forEach((el) => (el.innerHTML = '<li class="rank-empty">ランキングを読み込めませんでした。</li>'));
  }
}
function setupBoard() {
  if (!RANKING_API) return;
  document.querySelectorAll('.rank-board').forEach((b) => b.classList.remove('hidden'));
  document.querySelectorAll('.rb-ico').forEach((i) => (i.src = Sprites.iconURL('trophy')));
  document.querySelectorAll('.rb-open').forEach((b) => b.addEventListener('click', openRanking));
  loadBoard();
  // 30秒ごとに一覧を読み直す（画面が見えているときだけ）
  setInterval(() => {
    if (!document.hidden) loadBoard();
  }, 30 * 1000);
}
async function loadRanking() {
  if (!RANKING_API) return;
  const list = $('#rankList');
  list.innerHTML = '<li class="rank-empty">読み込み中…</li>';
  try {
    const { status, data } = await rankFetch('/api/ranking?limit=50&id=' + encodeURIComponent(ensurePlayerId()));
    if (status !== 200 || !Array.isArray(data.entries)) throw new Error(String(status));
    renderRankRows(list, data.entries);
    renderBoard(data);
    $('#rankMine').textContent = data.me ? `あなたの順位：${data.me.rank}位（${fmt(data.me.score)}）` : S.playerName ? '' : 'まだ参加していません';
  } catch (e) {
    list.innerHTML = '<li class="rank-empty">ランキングを読み込めませんでした。</li>';
  }
}

/* ---------- 定期的な表示更新 ---------- */
setInterval(() => {
  if (typeof S === 'undefined') return;
  refreshCompanions();
  refreshRebirth();
  if ($('#rankScore')) $('#rankScore').textContent = fmt(S.total);
}, 400);
