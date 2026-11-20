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
    const locked = S.unlocked < c.req;
    e.el.classList.toggle('locked', locked);
    e.el.classList.toggle('joined', lv > 0);
    e.img.src = Sprites.compURL(c.id, locked);
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
  if (!c || S.unlocked < c.req || S.comp[id] >= c.max) return;
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
const rebirthGain = () => Math.floor(Math.sqrt(S.runTotal / REBIRTH.divisor));
const canRebirth = () => S.unlocked >= REBIRTH.minSpots && rebirthGain() >= 1;
function buildRebirth() {
  const box = document.createElement('div');
  box.className = 'card rebirth';
  box.id = 'rebirthBox';
  box.innerHTML = `
    <h3>転生（お祓いを受けて出直す）</h3>
    <p class="note">フィルム・装備・解放したスポットが最初に戻るかわりに、<b>霊感</b>を得ます。霊感1につき、すべての収入が+10%（ずっと残ります）。仲間・心霊写真・実績は残ります。</p>
    <dl class="rebirth-stats">
      <dt>いまの霊感</dt><dd id="rbNow">0</dd>
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
  $('#rbNow').textContent = `${fmt(S.reikan)}（収入 ×${fmt(reikanMult())}）`;
  $('#rbGain').textContent = `+${fmt(g)}`;
  $('#rbMult').textContent = `×${fmt(reikanMult(S.reikan + g))}`;
  const ok = canRebirth();
  $('#rbBtn').disabled = !ok;
  $('#rbBtn').classList.toggle('affordable', ok);
  $('#rbReq').textContent =
    S.unlocked < REBIRTH.minSpots
      ? `「${STAGES[REBIRTH.minSpots - 1].name}」を解放すると転生できるようになります。`
      : g < 1
        ? `今回の獲得フィルムが ${fmt(REBIRTH.divisor)} を超えると霊感が得られます。`
        : `次の霊感+1まで：あと ${fmt(Math.pow(g + 1, 2) * REBIRTH.divisor - S.runTotal)} フィルム`;
}
function doRebirth() {
  if (!canRebirth()) return;
  const g = rebirthGain();
  if (!confirm(`転生しますか？\n\n霊感 +${g}（収入 ×${fmt(reikanMult(S.reikan + g))} に）\n\nフィルム・装備・解放したスポットは最初に戻ります。\n仲間・心霊写真・実績は残ります。`)) return;
  S.reikan += g;
  S.rebirths++;
  S.film = 0;
  S.runTotal = 0;
  for (const k in S.lv) S.lv[k] = 0;
  S.unlocked = 1;
  S.stage = 0;
  V.ghost = null;
  V.scroll = 0;
  V.cycle = 0;
  V.fade = 1;
  V.prayedK = null;
  V.pray = 0;
  if (V.step) endStep('timeout');
  Sound.chime();
  log(`お祓いを受けて、ゆらは出直すことにした。 霊感 +${g}`, 'gold');
  showModal('転生しました', `霊感 <b>+${g}</b>（合計 ${fmt(S.reikan)}）<br>これからの収入は <b>×${fmt(reikanMult())}</b> になります。<br><br><small>旧小峰トンネルからやり直し。仲間たちも一緒です。</small>`);
  buildSpots();
  buildCollection();
  refreshCompanions();
  checkAchievements();
  refreshUI(true);
  save();
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

/* ---------- オンラインランキング（Cloudflare Workers に送る） ---------- */
let rankBusy = false;
let rankAutoT = 0;
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
async function rankFetch(path, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(RANKING_API.replace(/\/$/, '') + path, { ...opts, signal: ctrl.signal });
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
function setupRanking() {
  const enabled = !!RANKING_API;
  $('#rankOff').classList.toggle('hidden', enabled);
  $('#rankOn').classList.toggle('hidden', !enabled);
  $('#rankName').value = S.playerName;
  if (!enabled) return;
  $('#rankSend').addEventListener('click', () => submitScore(true));
  $('#rankReload').addEventListener('click', loadRanking);
  // ランキングタブを開いたときに読み込む
  document.querySelector('.tabs button[data-tab="ranking"]').addEventListener('click', loadRanking);
  // 名前を登録済みなら、10分ごとに自動で送信
  setInterval(() => {
    rankAutoT++;
    if (S.playerName && !document.hidden) submitScore(false);
  }, 10 * 60 * 1000);
}
function cleanName(s) {
  return String(s)
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .trim()
    .slice(0, 12);
}
async function submitScore(manual) {
  if (!RANKING_API || rankBusy) return;
  const name = cleanName(manual ? $('#rankName').value : S.playerName);
  if (!name) {
    if (manual) rankMsg('名前を入力してください（12文字まで）。', false);
    return;
  }
  S.playerName = name;
  $('#rankName').value = name;
  rankBusy = true;
  if (manual) rankMsg('送信中…', true);
  try {
    const { status, data } = await rankFetch('/api/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ensurePlayerId(),
        name,
        score: Math.floor(S.total),
        spot: S.unlocked,
        rebirths: S.rebirths,
        photos: S.ghosts,
      }),
    });
    if (status === 200 && data.ok) {
      S.ranked = true;
      if (manual) rankMsg(`送信しました！ いまの順位：${data.rank}位`, true);
      checkAchievements();
      save();
      if (manual) await loadRanking();
    } else if (status === 429) {
      if (manual) rankMsg('送信が早すぎます。少し待ってからもう一度どうぞ。', false);
    } else {
      if (manual) rankMsg(`送信できませんでした（${data.error || status}）。`, false);
    }
  } catch (e) {
    if (manual) rankMsg('サーバーにつながりませんでした。時間をおいて試してください。', false);
  } finally {
    rankBusy = false;
  }
}
const SPOT_SHORT = ['旧小峰', '道了堂', '八王子城', '旧吹上', '旧旧吹上'];
async function loadRanking() {
  if (!RANKING_API) return;
  const list = $('#rankList');
  list.innerHTML = '<li class="rank-empty">読み込み中…</li>';
  try {
    const { status, data } = await rankFetch('/api/ranking?limit=50&id=' + encodeURIComponent(ensurePlayerId()));
    if (status !== 200 || !Array.isArray(data.entries)) throw new Error(String(status));
    list.innerHTML = '';
    if (!data.entries.length) list.innerHTML = '<li class="rank-empty">まだ誰も登録していません。一番乗りのチャンス！</li>';
    data.entries.forEach((e) => {
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
      meta.textContent = `${SPOT_SHORT[(e.spot || 1) - 1] || ''}${e.rebirths ? `・転生${e.rebirths}` : ''}`;
      const sc = document.createElement('span');
      sc.className = 'rank-score';
      sc.textContent = fmt(e.score);
      li.append(no, nm, meta, sc);
      list.appendChild(li);
    });
    $('#rankMine').textContent = data.me ? `あなたの順位：${data.me.rank}位（${fmt(data.me.score)}）` : 'まだ登録されていません';
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
