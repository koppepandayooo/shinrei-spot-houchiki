'use strict';
/* =========================================================
 * 現実の時刻・天気との連動
 *
 *  ・時刻：日の出・日の入りの時刻から、昼／夕方（明け方）／夜を決める。
 *    天気が取れないときも、日本時間の日付からおおよその日の出・日の入りを計算するので、時刻の連動は続く。
 *  ・天気：Open-Meteo（https://open-meteo.com/ ・APIキー不要・非営利なら無料）から
 *    各スポットのあたりの「いまの天気」を取る。データは CC BY 4.0（クレジット表記が必要）。
 *    取れないとき・古すぎるときは天気なし（いつもの表示）に戻す。
 *  ・リクエストは30分に1回まで（全スポット分をまとめて1回）。結果はブラウザに保存して使い回す。
 * ========================================================= */

/* 各スポットのおおよその位置（天気を取るためだけに使う。数百m〜1km程度のずれは天気には影響しない）
 *  満地トンネル・道了堂・八王子城：Wikipedia の座標
 *  それ以外：地図上のおおよその位置 */
const WEATHER_SPOTS = {
  phone: [35.652, 139.279], // 八王子霊園（八王子市裏高尾町）
  ryohoku: [35.6815, 139.2716], // 陵北大橋（北浅川・八王子市。東京の橋クラブの位置）
  manji: [35.7575, 139.2922], // 満地峠（あきる野市／青梅市）
  doryodo: [35.6248, 139.3489], // 道了堂跡（八王子市鑓水）
  komine: [35.709, 139.257], // 小峰峠（八王子市／あきる野市）
  fukiage: [35.806, 139.291], // 吹上峠（青梅市）
  hachioji: [35.653, 139.2522], // 八王子城跡（八王子市元八王子町）
  kyukyu: [35.806, 139.291], // 旧旧吹上隧道（吹上峠）
};

const Weather = (() => {
  const KEY = 'shinrei-houchi-weather-v1';
  const REFRESH = 30 * 60 * 1000; // 30分ごとに取り直す
  const STALE = 3 * 60 * 60 * 1000; // 3時間より古い天気は使わない
  const RETRY = 5 * 60 * 1000; // 失敗したら5分あけて再挑戦
  const IDS = Object.keys(WEATHER_SPOTS);
  let data = null; // { at, spots: { id: { code, precip, cloud, sunrise, sunset } } }
  let status = 'idle'; // idle / loading / ok / error
  let nextTry = 0;
  let timer = null;
  let onChange = null;

  function loadCache() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && d.at && d.spots) data = d;
    } catch (e) {}
  }
  function saveCache() {
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) {}
  }

  async function fetchNow() {
    if (status === 'loading') return;
    status = 'loading';
    nextTry = Date.now() + RETRY;
    const lat = IDS.map((id) => WEATHER_SPOTS[id][0]).join(',');
    const lon = IDS.map((id) => WEATHER_SPOTS[id][1]).join(',');
    const url =
      'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
      '&current=weather_code,precipitation,cloud_cover' +
      '&daily=sunrise,sunset&forecast_days=1&timezone=Asia%2FTokyo&timeformat=unixtime';
    try {
      const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
      const tm = ctrl ? setTimeout(() => ctrl.abort(), 10000) : null;
      const res = await fetch(url, ctrl ? { signal: ctrl.signal } : {});
      if (tm) clearTimeout(tm);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      let j = await res.json();
      if (!Array.isArray(j)) j = [j]; // 1か所だけのときは配列にならない
      if (j.length !== IDS.length) throw new Error('length');
      const spots = {};
      IDS.forEach((id, i) => {
        const r = j[i] || {};
        const c = r.current || {};
        const dl = r.daily || {};
        if (!Number.isFinite(c.weather_code)) throw new Error('no data');
        spots[id] = {
          code: c.weather_code,
          precip: Number.isFinite(c.precipitation) ? c.precipitation : 0,
          cloud: Number.isFinite(c.cloud_cover) ? c.cloud_cover : 0,
          sunrise: dl.sunrise && Number.isFinite(dl.sunrise[0]) ? dl.sunrise[0] * 1000 : null,
          sunset: dl.sunset && Number.isFinite(dl.sunset[0]) ? dl.sunset[0] * 1000 : null,
        };
      });
      data = { at: Date.now(), spots };
      saveCache();
      status = 'ok';
      nextTry = Date.now() + REFRESH;
    } catch (e) {
      status = 'error';
      nextTry = Date.now() + RETRY;
    }
    if (onChange) onChange();
  }

  function tick() {
    if (document.hidden) return;
    if (Date.now() >= nextTry) fetchNow();
  }

  function start(cb) {
    onChange = cb || null;
    loadCache();
    // 保存してある天気がまだ新しければ、すぐには取りに行かない
    nextTry = data && Date.now() - data.at < REFRESH ? data.at + REFRESH : 0;
    if (data && Date.now() - data.at < STALE) status = 'ok';
    tick();
    if (!timer) timer = setInterval(tick, 60 * 1000);
    document.addEventListener('visibilitychange', tick);
  }

  /* ---------- 天気コード（WMO）を、ゲームで使う種類に ---------- */
  function kindOf(code) {
    if (code === 45 || code === 48) return 'fog';
    if (code >= 95) return 'storm';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
    if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
    if (code === 3) return 'cloudy';
    if (code === 2) return 'partly';
    return 'clear';
  }
  const KIND_LABEL = { clear: '晴れ', partly: '晴れ時々くもり', cloudy: 'くもり', fog: '霧', rain: '雨', snow: '雪', storm: '雷雨' };
  const KIND_ICON = { clear: '☀', partly: '⛅', cloudy: '☁', fog: '🌫', rain: '☂', snow: '❄', storm: '⚡' };
  // 雨の強さ（0.3〜1）
  function intensityOf(code, precip) {
    if ([51, 56, 61, 66, 80].includes(code)) return Math.max(0.35, Math.min(1, 0.35 + precip * 0.15));
    if ([53, 63, 81, 71, 73, 85].includes(code)) return Math.max(0.6, Math.min(1, 0.5 + precip * 0.1));
    return 0.9;
  }

  /* ---------- 日の出・日の入り（天気が取れないときの目安） ----------
   * 東京あたり（東経139.3度）の、日本時間でのおおよその時刻。数分〜十数分のずれは気にしない */
  function approxSun(nowMs) {
    const jst = new Date(nowMs + 9 * 3600 * 1000);
    const y = jst.getUTCFullYear();
    const doy = (Date.UTC(y, jst.getUTCMonth(), jst.getUTCDate()) - Date.UTC(y, 0, 1)) / 86400000;
    const len = 12.2 + 2.35 * Math.cos((2 * Math.PI * (doy - 172)) / 365); // 昼の長さ（時間）
    const eot = 0.13 * Math.sin((4 * Math.PI * (doy - 81)) / 365) - 0.12 * Math.sin((2 * Math.PI * (doy - 81)) / 365);
    const noon = 12 - (139.3 - 135) / 15 - eot; // 南中時刻（日本時間）
    const day0 = Date.UTC(y, jst.getUTCMonth(), jst.getUTCDate()) - 9 * 3600 * 1000; // 日本時間の0時
    return { sunrise: day0 + (noon - len / 2) * 3600e3, sunset: day0 + (noon + len / 2) * 3600e3 };
  }

  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  /**
   * いまの環境
   *  day  : 0（夜）〜 1（昼）
   *  warm : 夕焼け・朝焼けの強さ 0〜1
   *  kind : 天気の種類（'none' は天気なし＝いつもの表示）
   */
  function env(stageId, enabled = true) {
    if (!enabled) return { day: 0, warm: 0, kind: 'none', rain: 0, cloud: 0, phase: 'night', live: false, off: true };
    const nowMs = Date.now();
    const fresh = data && nowMs - data.at < STALE ? data.spots[stageId] || data.spots[IDS[0]] : null;
    let sun = approxSun(nowMs);
    // 取ってきた日の出・日の入りが今日のものなら、そちらを使う
    if (fresh && fresh.sunrise && fresh.sunset && Math.abs(fresh.sunrise - sun.sunrise) < 3 * 3600e3) {
      sun = { sunrise: fresh.sunrise, sunset: fresh.sunset };
    }
    const m = 60e3;
    const day = Math.min(clamp01((nowMs - (sun.sunrise - 25 * m)) / (50 * m)), clamp01(((sun.sunset + 25 * m) - nowMs) / (50 * m)));
    const warm = Math.max(clamp01(1 - Math.abs(nowMs - (sun.sunset - 10 * m)) / (55 * m)), clamp01(1 - Math.abs(nowMs - sun.sunrise) / (40 * m)) * 0.8);
    const morning = Math.abs(nowMs - sun.sunrise) < Math.abs(nowMs - sun.sunset);
    let kind = 'none';
    let rain = 0;
    let cloud = 0;
    if (fresh) {
      kind = kindOf(fresh.code);
      cloud = clamp01(fresh.cloud / 100);
      if (kind === 'rain' || kind === 'storm' || kind === 'snow') rain = intensityOf(fresh.code, fresh.precip);
      if (kind === 'cloudy' || kind === 'fog' || rain) cloud = Math.max(cloud, 0.85);
    }
    // 雨や厚い雲のときは夕焼けが弱まる
    const w = warm * (1 - 0.75 * cloud);
    const phase = warm > 0.4 ? (morning ? 'dawn' : 'dusk') : day > 0.5 ? 'day' : 'night';
    return { day, warm: w, kind, rain, cloud, phase, live: !!fresh, sunrise: sun.sunrise, sunset: sun.sunset };
  }

  const PHASE_LABEL = { day: '昼', dusk: '夕方', dawn: '明け方', night: '夜' };
  function label(e) {
    const time = new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit' });
    const p = PHASE_LABEL[e.phase];
    if (e.off) return { icon: '🌙', text: '連動オフ（いつもの夜）', time };
    if (e.kind === 'none') return { icon: e.phase === 'day' ? '☀' : '🌙', text: `${p}・天気は取得できませんでした`, time };
    const icon = e.kind === 'clear' && e.phase !== 'day' ? '🌙' : KIND_ICON[e.kind];
    return { icon, text: `${p}・${KIND_LABEL[e.kind]}`, time };
  }
  const isWet = (e) => e.kind === 'rain' || e.kind === 'storm';

  return { start, env, label, isWet, status: () => status, updatedAt: () => (data ? data.at : 0), refresh: fetchNow };
})();
