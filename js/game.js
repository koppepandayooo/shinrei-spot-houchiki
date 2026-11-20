'use strict';
/* =========================================================
 * ゲーム本体：状態・計算・セーブ・UI・メインループ
 * ========================================================= */

const SAVE_KEY = 'shinrei-houchi-save-v1';
const $ = (s) => document.querySelector(s);

/* ---------- 状態 ---------- */
function defaultState() {
  return {
    film: 0,
    total: 0,
    lv: { flash: 0, camera: 0, moped: 0, amulet: 0, ofuda: 0, ir: 0, sensor: 0 },
    runTotal: 0, // 今回（転生してから）の獲得フィルム
    reikan: 0, // 霊感（転生で得る永久ボーナス）
    rebirths: 0, // 転生回数
    comp: { cat: 0, kohai: 0, vet: 0 }, // 仲間のなかよし度（0 = まだ仲間ではない）
    daily: { last: '', streak: 0, best: 0 }, // デイリーボーナス
    vol: { sfx: 0.7, amb: 0.7 }, // 音量
    playerId: '', // ランキング用のID（端末ごと）
    playerName: '', // ランキングに出す名前
    ranked: false,
    unlocked: 1,
    stage: 0,
    clicks: 0,
    ghosts: 0,
    photos: {}, // { ghostId: { n: 撮影枚数, first: 初撮影の時刻 } }
    ach: {}, // { 実績ID: 達成時刻 }
    steps: { win: 0, lose: 0, run: 0 }, // 足音イベントの結果
    maxAway: 0, // 最長の放置時間（秒）
    explores: 0,
    muted: false,
    buyMode: 'x1', // アップグレードの購入数（x1 / x10 / max）
    created: Date.now(),
    lastSave: Date.now(),
  };
}
let S = defaultState();

// 読み込んだデータを安全な形にそろえる（localStorage・セーブコード共通）
function normalize(d) {
  if (!d || typeof d !== 'object' || !d.lv) throw new Error('invalid');
  // ※ base は入れ子の初期値（lv・comp など）を取り出すためだけに使う。
  //   Object.assign(base, d) だと base.lv が d.lv に置き換わり、新しく増えた項目の初期値が入らないため
  const base = defaultState();
  const s = Object.assign(defaultState(), d);
  s.lv = Object.assign(base.lv, d.lv);
  for (const k in s.lv) s.lv[k] = Math.max(0, s.lv[k] | 0);
  s.photos = d.photos && typeof d.photos === 'object' ? d.photos : {};
  s.ach = d.ach && typeof d.ach === 'object' ? d.ach : {};
  s.steps = Object.assign(base.steps, d.steps || {});
  s.maxAway = +d.maxAway || 0;
  s.comp = Object.assign(base.comp, d.comp || {});
  for (const k in s.comp) s.comp[k] = Math.max(0, s.comp[k] | 0);
  s.daily = Object.assign(base.daily, d.daily || {});
  s.vol = Object.assign(base.vol, d.vol || {});
  // 転生機能より前のセーブは、これまでの総獲得を「今回の獲得」とみなす
  s.runTotal = d.runTotal == null ? +d.total || 0 : Math.max(0, +d.runTotal || 0);
  s.reikan = Math.max(0, +d.reikan || 0);
  s.rebirths = Math.max(0, d.rebirths | 0);
  s.playerName = String(d.playerName || '').slice(0, 12);
  if (!BUY_MODES.some((m) => m.id === s.buyMode)) s.buyMode = 'x1';
  s.achInit = !!d.achInit;
  s.unlocked = Math.min(Math.max(1, s.unlocked | 0), STAGES.length);
  s.stage = Math.min(Math.max(0, s.stage | 0), s.unlocked - 1);
  if (!Number.isFinite(s.film) || s.film < 0) s.film = 0;
  if (!Number.isFinite(s.total) || s.total < s.film) s.total = s.film;
  if (!Number.isFinite(s.runTotal)) s.runTotal = s.total;
  return s;
}

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    S = normalize(JSON.parse(raw));
    return true;
  } catch (e) {
    console.warn('セーブデータの読み込みに失敗しました', e);
    return false;
  }
}
function save() {
  // 計算ミスなどで数値が壊れていたら、壊れたデータで上書きしない
  if (!Number.isFinite(S.film) || !Number.isFinite(S.total)) {
    console.error('セーブを中止しました：フィルムの値が不正です', S.film, S.total);
    return;
  }
  S.lastSave = Date.now();
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(S));
  } catch (e) {
    /* プライベートモード等で保存できない場合は無視 */
  }
}

/* ---------- セーブコード（書き出し／読み込み） ----------
 * 形式: YURA1-<チェックサム>-<JSONをUTF-8→Base64にしたもの>
 * サーバー不要。文字列をコピー＆ペーストして別の端末やブラウザへ引っ越せる */
const CODE_PREFIX = 'YURA1';
function checksum(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}
function fromBase64(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
function exportCode() {
  save();
  const body = toBase64(JSON.stringify(S));
  return `${CODE_PREFIX}-${checksum(body)}-${body}`;
}
function importCode(code) {
  const clean = String(code).replace(/\s+/g, '');
  const m = /^YURA1-([0-9a-z]+)-([A-Za-z0-9+/=]+)$/.exec(clean);
  if (!m) throw new Error('コードの形式が正しくありません。最初の「YURA1-」から最後まで、全部コピーされているか確認してください。');
  if (checksum(m[2]) !== m[1]) throw new Error('コードが途中で欠けているか、書き換わっています。もう一度コピーしてみてください。');
  let data;
  try {
    data = normalize(JSON.parse(fromBase64(m[2])));
  } catch (e) {
    throw new Error('セーブデータとして読み込めませんでした。');
  }
  return data;
}

/* ---------- 計算式 ---------- */
const milestone = (lv) => Math.pow(2, Math.floor(lv / 10)); // 10レベルごとに2倍
const flashMult = (lv = S.lv.flash) => (1 + 0.5 * lv) * milestone(lv);
const cameraMult = (lv = S.lv.camera) => (1 + lv) * milestone(lv);
const exploreDur = (lv = S.lv.moped) => Math.max(0.5, 4 / (1 + 0.25 * lv));
// すべての収入にかかる倍率（霊感＋赤外線カメラ）
const reikanMult = (pts = S.reikan) => 1 + REBIRTH.bonusPerPoint * pts;
const irMult = (lv = S.lv.ir) => 1 + 0.25 * lv;
const globalMult = () => reikanMult() * irMult();
// 仲間の効果（なかよし度 lv。0 = いない）
const kohaiMult = (lv = S.comp.kohai) => (lv > 0 ? 1.5 + 0.15 * (lv - 1) : 1); // 撮影
const vetMult = (lv = S.comp.vet) => (lv > 0 ? 1.4 + 0.12 * (lv - 1) : 1); // 探索
const catInterval = (lv = S.comp.cat) => 32 / (1 + 0.05 * (lv - 1)); // 黒猫がフィルムを拾ってくる間隔（秒）
const catAmountSec = (lv = S.comp.cat) => 12 + 3 * (lv - 1); // 何秒分の探索収入を拾ってくるか
// 上位装備
const ofudaMult = (lv = S.lv.ofuda) => 1 + 0.5 * lv; // 心霊写真ボーナス
const ghostIntervalMult = (lv = S.lv.ofuda) => Math.max(0.55, 1 - 0.03 * lv); // 幽霊の出現間隔
const rareChance = (lv = S.lv.sensor) => 0.25 + 0.03 * lv;
const stepWinRate = (lv = S.lv.sensor) => 0.55 + 0.02 * lv;

const exploreReward = () => 3 * STAGES[S.stage].mult * flashMult() * vetMult() * globalMult();
const ratePerSec = () => exploreReward() / exploreDur();
const clickReward = () => STAGES[S.stage].mult * cameraMult() * kohaiMult() * globalMult();
const offlineCapHours = (lv = S.lv.amulet) => 8 + 2 * lv;

function upgradeCost(u) {
  return Math.ceil(u.base * Math.pow(u.growth, S.lv[u.id]));
}
function isMax(u) {
  return u.max != null && S.lv[u.id] >= u.max;
}

function gain(n) {
  if (!Number.isFinite(n) || n <= 0) return;
  S.runTotal += n;
  S.film += n;
  S.total += n;
}

/* ---------- 数値表示（日本語の単位） ---------- */
function fmt(n) {
  if (!isFinite(n)) return '∞';
  if (n < 10 && n % 1 !== 0) return n.toFixed(1);
  if (n < 1e4) return Math.floor(n).toLocaleString('ja-JP');
  const units = [['京', 1e16], ['兆', 1e12], ['億', 1e8], ['万', 1e4]];
  for (const [u, v] of units) {
    if (n >= v) {
      const x = n / v;
      const s = x >= 1000 ? Math.floor(x).toLocaleString('ja-JP') : x >= 100 ? x.toFixed(0) : x >= 10 ? x.toFixed(1) : x.toFixed(2);
      return s + u;
    }
  }
  return String(Math.floor(n));
}
function fmtTime(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}時間${m}分`;
  if (m > 0) return `${m}分${sec % 60}秒`;
  return `${sec}秒`;
}

/* ---------- 効果音（中身は js/sound.js） ---------- */
const sfxShutter = () => Sound.shutter();
const sfxTone = (f1, f2, dur, type, vol) => Sound.sweep(f1, f2, dur, type, vol);
const sfxBuy = () => Sound.buy();
const sfxGhost = () => Sound.ghostCatch();

/* ---------- 表示用の一時状態 ---------- */
const V = {
  t: 0,
  scroll: 0,
  frame: 0,
  frameT: 0,
  blink: false,
  blinkT: 3,
  flash: 0,
  miniFlash: 0,
  fade: 0,
  flicker: false,
  flickerT: 0,
  ghost: null,
  ghostTimer: 25,
  cycle: 0,
  pauseT: 0,
  autoPhotoT: 6,
  hop: 0, // タップ時のジャンプ（残り秒）
  pray: 0, // 滝の前で手を合わせている残り秒
  prayedK: null, // 最後に手を合わせた滝
  calm: false, // 御主殿の滝の近く（怪異を起こさない）
  fallsVol: 0, // 滝の音の大きさ（0..1）
  gait: 0, // 歩行の位相（ラジアン）
  walkW: 0, // 歩行の重み（0..1）
  tilt: 0, // 体の傾き（度）
  moveT: 0, // 前へ進んでいる残り秒
  idleT: 3, // 次に進み出すまでの秒
  yuraDy: 0, // ゆらの上下オフセット（メイン座標）
  step: null, // 足音イベント
  stepTimer: 75,
  achTimer: 0,
  lastLogT: -99,
  stage: 0,
};

/* ---------- ログ ---------- */
const logs = [];
function log(msg, cls = '') {
  logs.unshift({ msg, cls });
  if (logs.length > 30) logs.pop();
  V.lastLogT = V.t;
  renderLogs();
}
function renderLogs() {
  const sceneLog = $('#sceneLog');
  sceneLog.innerHTML = '';
  logs.slice(0, 2).forEach((l, i) => {
    const d = document.createElement('div');
    d.className = 'log-line ' + l.cls + (i === 0 ? ' new' : ' old');
    d.textContent = l.msg;
    sceneLog.appendChild(d);
  });
  const full = $('#logList');
  if (full) {
    full.innerHTML = '';
    logs.forEach((l) => {
      const li = document.createElement('li');
      li.className = l.cls;
      li.textContent = l.msg;
      full.appendChild(li);
    });
  }
}

/* ---------- ふわっと出る数字 ---------- */
function floatText(text, xPct, yPct, cls = '', ms = 1100) {
  const el = document.createElement('div');
  el.className = 'float ' + cls;
  el.textContent = text;
  el.style.left = xPct + '%';
  el.style.top = yPct + '%';
  $('#floats').appendChild(el);
  setTimeout(() => el.remove(), ms);
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2200);
}

/* ---------- モーダル ---------- */
const modalQueue = [];
function showModal(title, html, btn = 'OK') {
  if (!$('#modal').classList.contains('hidden')) {
    modalQueue.push([title, html, btn]);
    return;
  }
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modalOk').textContent = btn;
  $('#modal').classList.remove('hidden');
}
function hideModal() {
  $('#modal').classList.add('hidden');
  const next = modalQueue.shift();
  if (next) showModal(...next);
}

/* ---------- 放置報酬 ---------- */
function grantOffline(sec, isStartup) {
  if (sec < 5) return;
  S.maxAway = Math.max(S.maxAway || 0, sec);
  const capSec = offlineCapHours() * 3600;
  const used = Math.min(sec, capSec);
  const amount = ratePerSec() * used;
  gain(amount);
  const capped = sec > capSec;
  if (sec >= 60 || isStartup) {
    showModal(
      'おかえりなさい',
      `ゆらは <b>${fmtTime(used)}</b> のあいだ<br>「${STAGES[S.stage].name}」を探索していました。<br><br>` +
        `<span class="big-gain"><img class="icon-s" src="${Sprites.iconURL('film')}" alt="">+${fmt(amount)}</span><br>` +
        (capped ? `<small>（放置の上限は ${offlineCapHours()} 時間。お守りで延ばせます）</small>` : ''),
      '受け取る'
    );
  } else {
    toast(`放置ボーナス +${fmt(amount)} フィルム`);
  }
  log(`放置中に ${fmt(amount)} フィルムを手に入れた`, 'gold');
  save();
}

/* ---------- 操作 ---------- */
function onTap(ev) {
  if (V.pray > 0) return; // 手を合わせている間は静かに
  const wrap = $('#sceneWrap');
  const rect = wrap.getBoundingClientRect();
  const xPct = ((ev.clientX - rect.left) / rect.width) * 100;
  const yPct = ((ev.clientY - rect.top) / rect.height) * 100;

  const r = clickReward();
  gain(r);
  S.clicks++;
  V.flash = 0.55;
  V.hop = HOP_TIME;
  sfxShutter();
  floatText('+' + fmt(r), xPct, yPct);
  $('#tapHint').classList.add('gone');

  const g = V.ghost;
  if (g && !g.caught && g.age > 0.3) catchGhost(g);
}

function catchGhost(g) {
  const def = GHOSTS.find((d) => d.id === g.type) || GHOSTS[0];
  g.caught = true;
  g.caughtT = 0;
  const bonus = Math.max(clickReward() * 15, ratePerSec() * 45) * (def.rare ? 3 : 1) * ofudaMult();
  gain(bonus);
  S.ghosts++;
  const isNew = !S.photos[def.id];
  const p = S.photos[def.id] || (S.photos[def.id] = { n: 0, first: Date.now() });
  p.n++;
  sfxGhost();
  const img = Sprites.ghost(def.id);
  floatText('心霊写真！ +' + fmt(bonus), ((g.x + img.width / 2) / SW) * 100, (g.y / SH) * 100, 'ghost');
  log(`心霊写真「${def.name}」が撮れた！ +${fmt(bonus)} フィルム`, 'ghost');
  if (isNew) {
    toast(`📷 新しい心霊写真「${def.name}」を手に入れた！`);
    $('#tabBtnRecords').classList.add('notice');
  }
  buildCollection();
  checkSecretSpot();
  checkAchievements();
  save();
}

function pickGhostType() {
  const pool = GHOSTS.filter((d) => d.stage === S.stage);
  const rare = pool.filter((d) => d.rare);
  const common = pool.filter((d) => !d.rare);
  const list = rare.length && Math.random() < rareChance() ? rare : common.length ? common : pool;
  return list[Math.floor(Math.random() * list.length)].id;
}

/* ---------- まとめ買い ---------- */
const BUY_MODES = [
  { id: 'x1', label: '×1' },
  { id: 'x10', label: '×10' },
  { id: 'max', label: 'MAX' },
];
const costAt = (u, lv) => Math.ceil(u.base * Math.pow(u.growth, lv));

/**
 * 今の購入モードで何レベル分買うか・合計いくらかを計算する
 *  x1 / x10 : 決まった数（レベル上限があればそこまで）
 *  max      : 所持フィルムで買える最大数（1つも買えないときは1つ分の価格を表示）
 */
function buyPlan(u, mode = S.buyMode) {
  if (u.req && S.unlocked < u.req) return { n: 0, cost: 0, ok: false, maxed: false, locked: true };
  const lv0 = S.lv[u.id];
  const room = u.max != null ? u.max - lv0 : Infinity;
  if (room <= 0) return { n: 0, cost: 0, ok: false, maxed: true };
  const want = Math.min(mode === 'x1' ? 1 : mode === 'x10' ? 10 : Infinity, room);
  let n = 0;
  let cost = 0;
  while (n < want && n < 100000) {
    const c = costAt(u, lv0 + n);
    if (mode === 'max' && cost + c > S.film) break;
    cost += c;
    n++;
  }
  if (n === 0) {
    n = 1;
    cost = costAt(u, lv0);
  }
  return { n, cost, ok: S.film >= cost, maxed: false };
}

function buy(id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u) return;
  const p = buyPlan(u);
  if (!p.ok) return;
  const before = S.lv[id];
  S.film -= p.cost;
  S.lv[id] += p.n;
  sfxBuy();
  const after = S.lv[id];
  if ((id === 'flash' || id === 'camera') && Math.floor(after / 10) > Math.floor(before / 10)) {
    toast(`${u.name} Lv${after}！効果が${Math.pow(2, Math.floor(after / 10) - Math.floor(before / 10))}倍に！`);
  } else if (p.n > 1) {
    toast(`${u.name} Lv${before} → Lv${after}（${p.n}個まとめ買い）`);
  }
  checkAchievements();
  refreshUI(true);
  save();
}

function setBuyMode(mode) {
  S.buyMode = mode;
  document.querySelectorAll('.buy-mode button').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
  refreshUI(true);
  save();
}

function unlockNext() {
  if (S.unlocked >= STAGES.length) return;
  const st = STAGES[S.unlocked];
  if (st.secret || S.film < st.unlock) return;
  S.film -= st.unlock;
  S.unlocked++;
  Sound.unlock();
  log(`新しいスポット「${st.name}」へ行けるようになった！`, 'gold');
  goStage(S.unlocked - 1);
  save();
}

function goStage(i) {
  if (i >= S.unlocked || i === S.stage) return;
  V.fade = 1;
  S.stage = i;
  V.cycle = 0;
  V.ghost = null;
  log(`ゆらは「${STAGES[i].name}」にやってきた。`);
  buildSpots();
  buildCollection();
  refreshUI(true);
  save();
}

/* ---------- UI構築 ---------- */
const upgEls = {};
function buildUpgrades() {
  const box = $('#tab-upgrades');
  box.innerHTML = '';
  const bar = document.createElement('div');
  bar.className = 'buy-mode';
  bar.innerHTML = '<span>購入数</span>' + BUY_MODES.map((m) => `<button type="button" data-mode="${m.id}">${m.label}</button>`).join('');
  bar.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === S.buyMode);
    b.addEventListener('click', () => setBuyMode(b.dataset.mode));
  });
  box.appendChild(bar);
  UPGRADES.forEach((u) => {
    const el = document.createElement('button');
    el.className = 'card upg';
    el.type = 'button';
    el.innerHTML = `
      <img class="icon" src="${Sprites.iconURL(u.icon)}" alt="">
      <div class="upg-main">
        <div class="upg-head"><span class="upg-name">${u.name}</span><span class="upg-lv">Lv<b>0</b><i></i></span></div>
        <div class="upg-desc">${u.desc}</div>
        <div class="upg-eff"></div>
      </div>
      <div class="upg-cost"><small class="upg-n"></small><div class="upg-price"><img class="icon-s" src="${Sprites.iconURL('film')}" alt=""><span></span></div></div>`;
    el.addEventListener('click', () => buy(u.id));
    box.appendChild(el);
    upgEls[u.id] = {
      el,
      name: el.querySelector('.upg-name'),
      desc: el.querySelector('.upg-desc'),
      icon: el.querySelector('.icon'),
      lv: el.querySelector('.upg-lv b'),
      to: el.querySelector('.upg-lv i'),
      eff: el.querySelector('.upg-eff'),
      n: el.querySelector('.upg-n'),
      cost: el.querySelector('.upg-price span'),
    };
  });
}

function upgradeEffect(u, n = 1) {
  const lv = S.lv[u.id];
  const max = isMax(u);
  const to = lv + n;
  switch (u.id) {
    case 'flash':
      return `探索報酬 ×${fmt(flashMult(lv))}` + (max ? '' : ` → ×${fmt(flashMult(to))}`);
    case 'camera': {
      const m = STAGES[S.stage].mult;
      return `撮影 +${fmt(m * cameraMult(lv))}` + (max ? '' : ` → +${fmt(m * cameraMult(to))}`);
    }
    case 'moped':
      return `探索 ${exploreDur(lv).toFixed(2)}秒` + (max ? '' : ` → ${exploreDur(to).toFixed(2)}秒`);
    case 'amulet':
      return `放置上限 ${offlineCapHours(lv)}時間` + (max ? '' : ` → ${offlineCapHours(to)}時間`);
    case 'ofuda':
      return `心霊写真 ×${fmt(ofudaMult(lv))}` + (max ? '' : ` → ×${fmt(ofudaMult(to))}`) + `・出現間隔 ${Math.round(ghostIntervalMult(max ? lv : to) * 100)}%`;
    case 'ir':
      return `全収入 ×${fmt(irMult(lv))}` + (max ? '' : ` → ×${fmt(irMult(to))}`);
    case 'sensor':
      return `レア ${Math.round(rareChance(max ? lv : to) * 100)}%・足音成功 ${Math.round(stepWinRate(max ? lv : to) * 100)}%`;
  }
  return '';
}

let spotBtn = null;
function buildSpots() {
  const box = $('#tab-spots');
  box.innerHTML = '';
  spotBtn = null;
  STAGES.forEach((st, i) => {
    const unlocked = i < S.unlocked;
    if (st.secret && !unlocked) return;
    const isNext = i === S.unlocked;
    const cur = i === S.stage;
    const el = document.createElement('div');
    el.className = 'card spot' + (cur ? ' current' : '') + (unlocked ? '' : ' locked') + (isNext ? ' next' : '');
    const named = unlocked || isNext;
    el.innerHTML = `
      <div class="spot-head">
        <span class="spot-no">${i + 1}</span>
        <div class="spot-title"><div class="spot-name">${named ? st.name : '？？？'}</div>
        <div class="spot-area">${named ? st.area : '場所不明'}</div></div>
        <span class="spot-mult">報酬×${fmt(st.mult)}</span>
      </div>
      <div class="spot-body">
        <div class="spot-thumb">
          <img src="${Scene.thumb(i, !unlocked)}" alt="">
          ${unlocked ? '' : '<span class="spot-q">？</span>'}
        </div>
        <p class="spot-desc">${unlocked ? st.desc : `<span class="hint-label">ヒント</span>${st.hint}`}</p>
      </div>
      <div class="spot-act"></div>`;
    const act = el.querySelector('.spot-act');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn';
    if (cur) {
      b.textContent = '探索中…';
      b.disabled = true;
    } else if (unlocked) {
      b.textContent = 'ここへ行く';
      b.addEventListener('click', () => goStage(i));
    } else if (isNext) {
      b.innerHTML = `解放する <img class="icon-s" src="${Sprites.iconURL('film')}" alt="">${fmt(st.unlock)}`;
      b.addEventListener('click', unlockNext);
      spotBtn = { b, cost: st.unlock };
    } else {
      b.textContent = '🔒 ロック中';
      b.disabled = true;
    }
    act.appendChild(b);
    box.appendChild(el);
  });
}

function buildRecords() {
  $('#soundBtn').addEventListener('click', () => {
    S.muted = !S.muted;
    Sound.setVolumes(S.vol.sfx, S.vol.amb);
  Sound.setMuted(S.muted);
    refreshUI(true);
    save();
  });
  $('#resetBtn').addEventListener('click', () => {
    if (!confirm('セーブデータを削除して最初からやり直します。よろしいですか？')) return;
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {}
    S = defaultState();
    logs.length = 0;
    log('ゆらの心霊スポット巡りが、また始まった…');
    V.ghost = null;
    buildSpots();
    buildCollection();
    refreshUI(true);
    save();
  });

  // セーブコード
  const box = $('#codeBox');
  const msg = $('#codeMsg');
  const showMsg = (text, ok) => {
    msg.textContent = text;
    msg.className = 'code-msg ' + (ok ? 'ok' : 'ng');
  };
  $('#exportBtn').addEventListener('click', async () => {
    box.value = exportCode();
    box.focus();
    box.select();
    try {
      await navigator.clipboard.writeText(box.value);
      showMsg('コードをコピーしました。メモ帳などに貼り付けて保管してください。', true);
    } catch (e) {
      showMsg('コードを表示しました。選択してコピーしてください。', true);
    }
  });
  $('#importBtn').addEventListener('click', () => {
    if (!box.value.trim()) {
      showMsg('上の欄にセーブコードを貼り付けてから押してください。', false);
      return;
    }
    let data;
    try {
      data = importCode(box.value);
    } catch (e) {
      showMsg(e.message, false);
      return;
    }
    const sum = `フィルム ${fmt(data.film)}／解放スポット ${data.unlocked}か所／心霊写真 ${Object.keys(data.photos).length}種`;
    if (!confirm(`このセーブデータを読み込みますか？\n${sum}\n\n※いまの進行状況は上書きされます。`)) return;
    S = data;
    S.lastSave = Date.now();
    V.ghost = null;
    V.cycle = 0;
    V.fade = 1;
    logs.length = 0;
    log(`セーブコードを読み込んだ。ゆらは「${STAGES[S.stage].name}」にいる。`, 'gold');
    buildSpots();
    buildCollection();
    refreshUI(true);
    save();
    box.value = '';
    showMsg('読み込みました！', true);
  });
}

function buildCollection() {
  const grid = $('#photoGrid');
  if (!grid) return;
  grid.innerHTML = '';
  let got = 0;
  GHOSTS.forEach((g) => {
    const p = S.photos[g.id];
    if (p) got++;
    const known = g.stage < S.unlocked;
    const el = document.createElement('div');
    el.className = 'photo' + (p ? ' got' : '') + (g.rare ? ' rare' : '');
    el.innerHTML = `
      <div class="photo-img"><img src="${Sprites.ghostURL(g.id, !p)}" alt="">${p ? '' : '<span>？</span>'}</div>
      <div class="photo-name">${p ? g.name : '？？？'}${g.rare ? '<em>★レア</em>' : ''}</div>
      <div class="photo-meta">${known ? STAGES[g.stage].name : '未知のスポット'}${p ? `・${p.n}枚` : ''}</div>
      <div class="photo-desc">${p ? g.desc : known ? 'このスポットのどこかに出るらしい…' : 'まだ見ぬ場所に潜んでいる。'}</div>`;
    grid.appendChild(el);
  });
  $('#photoCount').textContent = `${got} / ${GHOSTS.length}`;
}

let uiTimer = 0;
function refreshUI(force) {
  $('#film').textContent = fmt(S.film);
  $('#rate').textContent = fmt(ratePerSec());
  $('#clickVal').textContent = fmt(clickReward());
  $('#stageName').textContent = STAGES[S.stage].name;

  UPGRADES.forEach((u) => {
    const e = upgEls[u.id];
    const p = buyPlan(u);
    e.el.classList.toggle('locked', !!p.locked);
    if (p.locked) {
      e.name.textContent = '？？？';
      e.desc.textContent = `「${STAGES[u.req - 1].name}」を解放すると手に入る上位装備。`;
      e.icon.style.filter = 'brightness(0) opacity(0.5)';
      e.lv.textContent = '-';
      e.to.textContent = '';
      e.eff.textContent = '';
      e.n.textContent = '';
      e.cost.textContent = '🔒';
      e.el.disabled = true;
      e.el.classList.remove('affordable');
      return;
    }
    e.name.textContent = u.name;
    e.desc.textContent = u.desc;
    e.icon.style.filter = '';
    e.lv.textContent = S.lv[u.id];
    e.to.textContent = p.maxed ? '（最大）' : ` → Lv${S.lv[u.id] + p.n}`;
    e.eff.textContent = upgradeEffect(u, p.n);
    e.n.textContent = p.maxed ? '' : p.n > 1 || S.buyMode !== 'x1' ? `×${p.n} 合計` : '';
    e.cost.textContent = p.maxed ? 'MAX' : fmt(p.cost);
    e.el.disabled = !p.ok;
    e.el.classList.toggle('affordable', p.ok);
  });

  if (spotBtn) {
    const ok = S.film >= spotBtn.cost;
    spotBtn.b.disabled = !ok;
    spotBtn.b.classList.toggle('affordable', ok);
  }
  const spotTab = $('#tabBtnSpots');
  spotTab.classList.toggle('notice', !!spotBtn && S.film >= spotBtn.cost);

  if (force || $('#tab-records').offsetParent) {
    $('#stTotal').textContent = fmt(S.total);
    $('#stClicks').textContent = S.clicks.toLocaleString('ja-JP');
    $('#stGhosts').textContent = S.ghosts.toLocaleString('ja-JP');
    $('#stExplores').textContent = S.explores.toLocaleString('ja-JP');
    $('#stCap').textContent = offlineCapHours() + '時間';
    $('#stStart').textContent = new Date(S.created).toLocaleDateString('ja-JP');
    $('#soundBtn').textContent = S.muted ? '音：OFF' : '音：ON';
  }
}

function setupTabs() {
  document.querySelectorAll('.tabs button').forEach((b) => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
      if (b.dataset.tab === 'records') b.classList.remove('notice');
      document.querySelectorAll('.tab-body').forEach((x) => x.classList.toggle('hidden', x.id !== 'tab-' + b.dataset.tab));
      refreshUI(true);
    });
  });
}

/* ---------- 懐中電灯の光の半径（低解像度ピクセル） ---------- */
const HOP_TIME = 0.32;
// よちよち歩き
const WALK_TILT_DEG = 2; // 左右の傾き（±度）
const WALK_BOUNCE = 4; // 上下のバウンド（メイン座標px）
const STEPS_PER_SEC = 3; // 1秒あたりの歩数
const WALK_EASE = 5; // 歩き出し・止まりのなめらかさ
function lightRadius() {
  const th = STAGES[S.stage].theme;
  const k = th.interior ? th.interior.light : 1.15;
  return 36 * k * (1 + 0.012 * Math.min(S.lv.flash, 40));
}

/* ---------- 隠しスポット：旧旧吹上隧道 ---------- */
function checkSecretSpot() {
  const i = STAGES.findIndex((st) => st.secret);
  if (i < 0 || S.unlocked !== i) return; // 直前のスポットまで解放済みのときだけ
  const st = STAGES[i];
  if (S.ghosts < st.secretPhotos) return;
  S.unlocked = i + 1;
  sfxTone(220, 110, 1.4, 'sine', 0.12);
  log(`……山道の先に、もうひとつの隧道が口を開けている。「${st.name}」が現れた！`, 'ghost');
  showModal(
    '新たなスポットが現れた',
    `心霊写真を撮り続けるうちに、ゆらは<br>地図にない古い山道を見つけた。<br><br><b>「${st.name}」</b><br><small>スポット一覧から行くことができます。</small>`,
    '行ってみる'
  );
  buildSpots();
  buildCollection();
  save();
}

/* ---------- 実績 ---------- */
const achQueue = [];
let achShowing = false;
function checkAchievements(silent) {
  let changed = false;
  ACHIEVEMENTS.forEach((a) => {
    if (S.ach[a.id]) return;
    let ok = false;
    try {
      ok = a.check(S);
    } catch (e) {
      ok = false;
    }
    if (!ok) return;
    S.ach[a.id] = Date.now();
    changed = true;
    if (!silent) {
      achQueue.push(a);
      log(`実績「${a.name}」を達成！`, 'gold');
    }
  });
  if (changed) {
    buildAchievements();
    if (!silent) $('#tabBtnRecords').classList.add('notice');
    showNextAch();
  }
}
function showNextAch() {
  if (achShowing || !achQueue.length) return;
  const a = achQueue.shift();
  achShowing = true;
  const el = $('#achToast');
  el.querySelector('.ach-name').textContent = a.name;
  el.querySelector('.ach-desc').textContent = a.desc;
  el.classList.add('show');
  Sound.achievement();
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => {
      achShowing = false;
      showNextAch();
    }, 350);
  }, 2600);
}
function buildAchievements() {
  const list = $('#achList');
  if (!list) return;
  list.innerHTML = '';
  let got = 0;
  ACHIEVEMENTS.forEach((a) => {
    const done = !!S.ach[a.id];
    if (done) got++;
    const hidden = a.secret && !done;
    const li = document.createElement('li');
    li.className = 'ach' + (done ? ' done' : '');
    li.innerHTML = `
      <span class="ach-icon">${done ? '★' : '☆'}</span>
      <div class="ach-text">
        <div class="ach-title">${hidden ? '？？？' : a.name}</div>
        <div class="ach-cond">${hidden ? 'ひみつの実績' : a.desc}</div>
      </div>
      <span class="ach-date">${done ? new Date(S.ach[a.id]).toLocaleDateString('ja-JP') : ''}</span>`;
    list.appendChild(li);
  });
  $('#achCount').textContent = `${got} / ${ACHIEVEMENTS.length}`;
}

/* ---------- 御主殿の滝 ----------
 * 落城のとき多くの女性や家族が命を落とした場所。
 * 近くでは心霊写真・足音・人魂などの怪異を起こさず、
 * 滝の前ではゆらが足を止めて静かに手を合わせる（少しだけフィルムがもらえる） */
const PRAY_TIME = 3.2;
const CALM_RANGE = 120; // 滝の中心からこの距離（低解像度px）までは怪異なし
const PRAY_DX = 30; // 手を合わせる位置（滝の中心がゆらの右 30px）
function startPrayer(k) {
  V.prayedK = k;
  V.pray = PRAY_TIME;
  V.moveT = 0;
  if (V.step) endStep('timeout');
  log('ゆらは御主殿の滝の前で足を止め、静かに手を合わせた。', 'pray');
  floatText('静かに手を合わせる', (YURA_CX / SW) * 100, ((GY - 44) / SH) * 100, 'pray', 2600);
  Sound.chime();
}
function finishPrayer() {
  const bonus = Math.max(ratePerSec() * 10, clickReward() * 3);
  gain(bonus);
  floatText('+' + fmt(bonus), (YURA_CX / SW) * 100, ((GY - 36) / SH) * 100, 'auto');
  log(`ゆらは一礼して、御主殿の滝をあとにした。 フィルム +${fmt(bonus)}`);
}

/* ---------- 足音イベント ---------- */
const STEP_LIMIT = 10; // 選ばないまま過ぎると何も起きない
function sfxSteps() {
  Sound.steps();
}
function setupStepEvent() {
  const box = $('#stepEvent');
  // ゲーム画面のタップ（撮影）として扱わない
  box.addEventListener('pointerdown', (e) => e.stopPropagation());
  $('#stepRun').addEventListener('click', () => endStep('run'));
  $('#stepShoot').addEventListener('click', () => endStep('shoot'));
}
function startStep() {
  V.step = { left: STEP_LIMIT };
  $('#stepEvent').classList.remove('hidden');
  log('……足音が聞こえる', 'ghost');
  sfxSteps();
}
function endStep(choice) {
  if (!V.step) return;
  V.step = null;
  V.stepTimer = 70 + Math.random() * 70;
  $('#stepEvent').classList.add('hidden');
  if (choice === 'timeout') {
    log('足音は、いつのまにか遠ざかっていった。');
  } else if (choice === 'run') {
    S.steps.run++;
    log('ゆらは足音から逃げ出した。……何も起きなかった。');
  } else if (Math.random() < stepWinRate()) {
    const bonus = Math.max(ratePerSec() * 120, clickReward() * 40);
    gain(bonus);
    S.steps.win++;
    V.flash = 0.8;
    V.hop = HOP_TIME;
    sfxShutter();
    sfxGhost();
    floatText('足音の正体を激写！ +' + fmt(bonus), 62, 30, 'ghost');
    log(`振り向きざまにシャッターを切った！ 何かが写っている… +${fmt(bonus)} フィルム`, 'ghost');
  } else {
    const loss = Math.min(S.film * 0.1, Math.max(ratePerSec() * 20, clickReward() * 6));
    S.film = Math.max(0, S.film - loss);
    S.steps.lose++;
    V.flash = 0.5;
    sfxShutter();
    floatText('-' + fmt(loss), 62, 30, 'loss');
    log(`……誰もいない。驚いた拍子にフィルムを ${fmt(loss)} 枚落としてしまった。`);
  }
  checkAchievements();
  save();
}

/* ---------- 更新 ---------- */
function update(dt) {
  V.t += dt;

  // 放置収入（少しずつ）
  gain(ratePerSec() * dt);

  // 探索サイクル（見た目と演出用）
  V.cycle += dt / exploreDur();
  while (V.cycle >= 1) {
    V.cycle -= 1;
    S.explores++;
    if (exploreDur() >= 1.5 || S.explores % 3 === 0) {
      floatText('+' + fmt(exploreReward() * (exploreDur() >= 1.5 ? 1 : 3)), (YURA_CX / SW) * 100, ((GY - 36) / SH) * 100, 'auto');
    }
    if (!V.calm && V.t - V.lastLogT > 9 && Math.random() < 0.35) {
      const st = STAGES[S.stage];
      const pool = Math.random() < 0.8 ? st.lines : COMMON_LINES;
      log(pool[Math.floor(Math.random() * pool.length)]);
    }
  }

  // 御主殿の滝の近くか（八王子城跡のみ）
  const falls = Scene.fallsNear(S.stage, V.scroll);
  V.calm = !!falls && Math.abs(falls.dx) < CALM_RANGE;
  V.fallsVol = falls ? Math.max(0, Math.min(1, 1 - Math.abs(falls.dx) / 140)) : 0;
  // 滝がゆらのすぐ右に見える位置で立ち止まる（滝を体で隠さないように）
  if (falls && V.pray <= 0 && V.prayedK !== falls.k && falls.dx <= PRAY_DX + 1 && falls.dx > PRAY_DX - 6) startPrayer(falls.k);
  if (V.pray > 0) {
    V.pray -= dt;
    V.moveT = 0;
    V.idleT = Math.max(V.idleT, 0.8);
    if (V.pray <= 0) finishPrayer();
  }

  // ゆらの動き：待機中は小さく上下にゆれ、ときどき「よちよち歩き」で前へ進む。タップで跳ねる
  const speed = 1 + 0.08 * Math.min(S.lv.moped, 25);
  const walking = V.moveT > 0;
  if (walking) {
    V.moveT -= dt;
    if (V.moveT <= 0) V.idleT = 2 + Math.random() * 3;
  } else {
    V.idleT -= dt;
    if (V.idleT <= 0) V.moveT = 1.2 + Math.random() * 1.2;
  }
  // 歩き出し・止まりをなめらかにする重み（0=待機, 1=歩行）
  V.walkW = Math.max(0, Math.min(1, V.walkW + (walking ? 1 : -1) * dt * WALK_EASE));
  if (V.walkW > 0) {
    // 1歩 = 位相 π。左右の足に体重が乗るたびに傾きが反転する
    V.gait += dt * Math.PI * STEPS_PER_SEC * Math.min(speed, 1.6);
    V.scroll += 26 * speed * dt * V.walkW;
  }
  const sway = Math.sin(V.gait); // -1..1（左右の傾き）
  const step = Math.abs(Math.cos(V.gait)); // 1=両足がそろって体が一番高い、0=着地
  V.tilt = sway * WALK_TILT_DEG * V.walkW;
  let dy = -step * WALK_BOUNCE * V.walkW; // 歩調に合わせたバウンド
  dy += Math.sin(V.t * 2.4) * 1.5 * (1 - V.walkW); // 待機中の小さなゆれ
  V.autoPhotoT -= dt;
  if (V.autoPhotoT <= 0 && V.moveT <= 0) {
    V.miniFlash = 0.9;
    V.autoPhotoT = 6 + Math.random() * 5;
  }
  if (V.pray > 0) {
    // 静かにうつむく
    const p = 1 - V.pray / PRAY_TIME;
    dy += Math.sin(Math.min(1, p * 1.6) * Math.PI * 0.5) * 3 * Math.min(1, V.pray / 0.4);
  }
  if (V.hop > 0) {
    V.hop = Math.max(0, V.hop - dt);
    const p = 1 - V.hop / HOP_TIME;
    dy += -Math.sin(p * Math.PI) * 10;
  }
  V.yuraDy = Math.round(dy);

  // まばたき
  V.blinkT -= dt;
  if (V.blinkT <= 0) {
    V.blink = !V.blink;
    V.blinkT = V.blink ? 0.12 : 2.5 + Math.random() * 3;
  }

  // 懐中電灯のちらつき
  V.flickerT -= dt;
  if (V.flicker && V.flickerT <= 0) V.flicker = false;
  else if (!V.flicker && Math.random() < dt * 0.04) {
    V.flicker = true;
    V.flickerT = 0.08 + Math.random() * 0.15;
  }

  // 幽霊の出現（滝の近くでは出さず、出ていたら静かに消す）
  if (V.ghost && V.calm && !V.ghost.caught && !V.ghost.quiet) {
    V.ghost.quiet = true;
    V.ghost.life = Math.min(V.ghost.life, V.ghost.age + 0.8);
  }
  if (V.ghost) {
    const g = V.ghost;
    g.age += dt;
    g.x += Math.sin(V.t * 0.8) * dt * 4;
    if (g.caught) {
      g.caughtT += dt;
      if (g.caughtT > 0.6) V.ghost = null;
    } else if (g.age > g.life) {
      V.ghost = null;
      if (!g.quiet) log('気配は消えてしまった…');
    }
  } else if (!V.calm) {
    V.ghostTimer -= dt;
    if (V.ghostTimer <= 0) {
      V.ghostTimer = (30 + Math.random() * 35) * ghostIntervalMult();
      V.ghost = { type: pickGhostType(), x: 104 + Math.random() * 64, y: 20 + Math.random() * 34, age: 0, life: 7, caught: false, caughtT: 0 };
      log('……何かいる。今だ、撮影して！', 'ghost');
      Sound.ghostAppear();
    }
  }

  // 足音イベント
  if (V.step) {
    V.step.left -= dt;
    $('#stepTimer').style.width = Math.max(0, (V.step.left / STEP_LIMIT) * 100) + '%';
    if (V.step.left <= 0) endStep('timeout');
  } else if (!V.ghost && !V.calm && V.pray <= 0 && $('#modal').classList.contains('hidden')) {
    V.stepTimer -= dt;
    if (V.stepTimer <= 0) startStep();
  }

  // 実績・隠しスポット
  V.achTimer += dt;
  if (V.achTimer > 1) {
    V.achTimer = 0;
    checkAchievements();
    checkSecretSpot();
  }

  // 環境音（風・水滴・滝）
  Sound.ambientUpdate(dt, V.t, !!STAGES[S.stage].theme.interior, V.fallsVol);
  updateCompanions(dt);

  V.flash = Math.max(0, V.flash - dt * 4);
  V.miniFlash = Math.max(0, V.miniFlash - dt * 3);
  V.fade = Math.max(0, V.fade - dt * 1.8);

  const pct = (V.cycle * 100).toFixed(1) + '%';
  $('#exploreFill').style.width = pct;
}

/* ---------- メインループ ---------- */
let last = performance.now();
let saveTimer = 0;
function frame(now) {
  const dt = Math.min(0.25, (now - last) / 1000);
  last = now;
  update(dt);
  Scene.render({
    stage: S.stage,
    t: V.t,
    scroll: V.scroll,
    frame: V.frame,
    blink: V.blink,
    flash: V.flash,
    miniFlash: V.miniFlash,
    fade: V.fade,
    flicker: V.flicker,
    ghost: V.ghost,
    yuraDy: V.yuraDy,
    yuraTilt: V.tilt,
    calm: V.calm,
    gait: V.gait,
    walkW: V.walkW,
    catHop: V.catHop,
    comps: { cat: S.comp.cat > 0, kohai: S.comp.kohai > 0, vet: S.comp.vet > 0 },
    lightR: lightRadius(),
  });
  uiTimer += dt;
  if (uiTimer > 0.15) {
    uiTimer = 0;
    refreshUI(false);
  }
  saveTimer += dt;
  if (saveTimer > 5) {
    saveTimer = 0;
    save();
  }
  requestAnimationFrame(frame);
}

/* ---------- 起動 ---------- */
let hiddenAt = null;
function start() {
  const had = load();
  Sprites.loadYuraImage('img/yura_pixel.png');
  Sprites.loadCompImages({ cat: 'img/comp_cat.png', kohai: 'img/comp_kohai.png', vet: 'img/comp_vet.png' });
  Sound.setMuted(S.muted);
  // ブラウザの決まりで、音は最初の操作のあとから鳴らせる
  document.addEventListener('pointerdown', () => Sound.ambientStart(), { passive: true });
  Scene.init($('#scene'));
  Backdrop.init();
  buildUpgrades();
  buildSpots();
  buildRecords();
  buildCollection();
  buildAchievements();
  buildCompanions();
  buildRebirth();
  setupVolume();
  setupRanking();
  setupStepEvent();
  setupTabs();
  // 実績機能より前のセーブは、達成済みの実績を通知なしで記録する
  checkAchievements(!S.achInit);
  S.achInit = true;
  $('#disclaimer').textContent = DISCLAIMER;
  $('#filmIcon').src = Sprites.iconURL('film');

  const wrap = $('#sceneWrap');
  wrap.addEventListener('pointerdown', (e) => {
    if (e.button != null && e.button !== 0) return;
    onTap(e);
  });
  $('#modalOk').addEventListener('click', hideModal);

  if (had) {
    log(`ゆらは「${STAGES[S.stage].name}」の探索を再開した。`);
    const away = (Date.now() - S.lastSave) / 1000;
    if (away > 30) grantOffline(away, true);
    checkDaily();
  } else {
    log('ゆらの心霊スポット巡りが始まった…');
    log('画面をタップすると撮影できるよ！', 'gold');
    checkDaily();
  }

  // タブを閉じずに裏に回した場合も、戻ったときに経過分をまとめて計算
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      hiddenAt = Date.now();
      Sound.suspend();
      save();
    } else if (hiddenAt) {
      const away = (Date.now() - hiddenAt) / 1000;
      hiddenAt = null;
      Sound.resume();
      last = performance.now();
      grantOffline(away, false);
      checkDaily(); // 日付が変わっていたらデイリーボーナス
    }
  });
  window.addEventListener('pagehide', save);
  window.addEventListener('beforeunload', save);

  refreshUI(true);
  save();
  requestAnimationFrame((t) => {
    last = t;
    requestAnimationFrame(frame);
  });
}

document.addEventListener('DOMContentLoaded', start);
