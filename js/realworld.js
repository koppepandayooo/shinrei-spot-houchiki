'use strict';
/* =========================================================
 * 現実の時刻・天気 → ゲームへの反映
 *  ・画面左上に「いまの時間帯・天気」を表示（タップで詳しく）
 *  ・夜・夕方（逢魔が時）・雨の日は心霊写真が出やすい
 *  ・雨の日だけ出る心霊写真、雨の日の足音イベント（報酬1.5倍）
 *  ・雷雨の日は、ときどき雷が光って鳴る
 *  ・設定で連動をオフにすると、これまでどおりの「いつもの夜」になる
 * 天気データ：Open-Meteo.com（CC BY 4.0）
 * ========================================================= */

const ENV_NONE = { day: 0, warm: 0, kind: 'none', rain: 0, cloud: 0, phase: 'night', live: false };
let envNow = ENV_NONE;
let envTimer = 0;
let envLastKind = null;

function refreshEnv() {
  try {
    envNow = Weather.env(STAGES[S.stage].id, S.realWorld !== false);
  } catch (e) {
    envNow = ENV_NONE;
  }
  updateWeatherBadge();
}

// 心霊写真の出やすさ（出現間隔を割る数）
function envGhostMult(e = envNow) {
  let m = 1;
  if (e.phase === 'night') m *= 1.15;
  if (e.phase === 'dusk' || e.phase === 'dawn') m *= 1.25; // 逢魔が時
  if (Weather.isWet(e)) m *= 1.2;
  else if (e.kind === 'fog') m *= 1.1;
  return m;
}
const envIsWet = () => Weather.isWet(envNow);

function effectLines(e = envNow) {
  const lines = [];
  if (e.off) return ['連動はオフです（いつもの夜の表示）。'];
  if (e.phase === 'night') lines.push('夜：心霊写真が少し出やすい（+15%）');
  if (e.phase === 'dusk' || e.phase === 'dawn') lines.push('逢魔が時：心霊写真が出やすい（+25%）');
  if (Weather.isWet(e)) {
    lines.push('雨：心霊写真が出やすい（+20%）');
    lines.push('雨の日だけの心霊写真が出ることがある');
    lines.push('足音イベントの撮影成功ボーナスが1.5倍');
  } else if (e.kind === 'fog') lines.push('霧：心霊写真が少し出やすい（+10%）');
  if (!lines.length) lines.push('いまは特別な効果はありません。');
  return lines;
}

function updateWeatherBadge() {
  const el = $('#wxBadge');
  if (!el) return;
  const l = Weather.label(envNow);
  $('#wxText').textContent = `${l.icon} ${l.text}`;
  $('#wxTime').textContent = l.time;
}

function openWeatherInfo() {
  const e = envNow;
  const l = Weather.label(e);
  const st = STAGES[S.stage];
  const up = Weather.updatedAt();
  const when = up ? new Date(up).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' }) : null;
  const sun = (ms) => new Date(ms).toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
  const html =
    `<p>${escapeHtml(st.name)}のあたり：<b>${escapeHtml(l.text)}</b>（日本時間 ${l.time}）</p>` +
    (e.off ? '' : `<p><small>日の出 ${sun(e.sunrise)}・日の入り ${sun(e.sunset)}${e.live ? '' : '（目安）'}</small></p>`) +
    `<ul class="wx-effects">${effectLines(e).map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>` +
    (e.off
      ? ''
      : e.live
        ? `<p><small>天気は ${when} に取得（30分ごとに更新）。</small></p>`
        : '<p><small>天気を取得できなかったので、天気なし（いつもの表示）にしています。時間帯は端末の時計から決めています。</small></p>') +
    '<p><small>現実の天気は <a href="https://open-meteo.com/" target="_blank" rel="noopener">Weather data by Open-Meteo.com</a>' +
    '（<a href="https://creativecommons.org/licenses/by/4.0/deed.ja" target="_blank" rel="noopener">CC BY 4.0</a>）のデータを、ゲームの演出に使っています。連動は設定でオフにできます。</small></p>';
  showModal('いまの時間と天気', html);
}

function setupRealWorld() {
  const badge = $('#wxBadge');
  if (badge) {
    // ゲーム画面のタップ（撮影）として扱わない
    badge.addEventListener('pointerdown', (ev) => ev.stopPropagation());
    $('#wxBtn').addEventListener('click', openWeatherInfo);
  }
  const btn = $('#realWorldBtn');
  const sync = () => {
    if (btn) btn.textContent = `現実の時刻・天気と連動：${S.realWorld !== false ? 'ON' : 'OFF'}`;
  };
  if (btn)
    btn.addEventListener('click', () => {
      S.realWorld = S.realWorld === false;
      sync();
      refreshEnv();
      save();
    });
  sync();
  Weather.start(() => {
    refreshEnv();
    // 天気が変わったら、ひとこと
    if (envLastKind && envNow.kind !== envLastKind && !envNow.off) {
      if (Weather.isWet(envNow)) log('……雨が降ってきた。', 'ghost');
      else if (Weather.isWet({ kind: envLastKind })) log('雨が上がったみたい。');
    }
    envLastKind = envNow.kind;
  });
  refreshEnv();
  envLastKind = envNow.kind;
}

/* 毎フレーム（game.js の update から）：環境の更新と、雷 */
function updateRealWorld(dt) {
  envTimer -= dt;
  if (envTimer <= 0) {
    envTimer = 2; // 2秒ごとに時刻を見直す（昼→夕方→夜はゆっくり変わる）
    refreshEnv();
  }
  if (V.bolt > 0) V.bolt = Math.max(0, V.bolt - dt * 2.6);
  if (envNow.kind === 'storm') {
    V.boltT = (V.boltT == null ? 6 : V.boltT) - dt;
    if (V.boltT <= 0) {
      V.boltT = 8 + Math.random() * 18;
      V.bolt = 1;
      const near = Math.random();
      setTimeout(() => {
        V.bolt = Math.max(V.bolt, 0.6); // 2回目の光
      }, 120);
      // トンネルの中では、光は見えず、音だけが小さくこもって聞こえる
      setTimeout(() => Sound.thunder(near, insideNow()), 300 + (1 - near) * 2200);
    }
  }
}
