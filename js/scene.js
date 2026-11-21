'use strict';
/* =========================================================
 * シーン描画
 *  - 背景・演出：192x108 の低解像度で描いて3倍に拡大
 *  - ゆら：576x324 のメインキャンバスにドット絵画像（縦96px）をそのまま描く
 * ========================================================= */

const SW = 192;
const SH = 108;
const GY = 88; // 地面の高さ（低解像度座標）
const SCALE = 3; // 背景を何倍に拡大して表示するか
const MW = SW * SCALE; // メインキャンバス（ゆらはこの解像度で描く）
const MH = SH * SCALE;
const YURA_CX = 76; // ゆらの中心X（低解像度座標）
const YURA_LY = 72; // 懐中電灯の光の中心Y（低解像度座標）
const YURA_CAM = { x: 72, y: 72 }; // カメラの位置（自動撮影のフラッシュ用）
const LIGHT_SWAY = 3; // 体が2度傾いたときに光の中心がずれる量（低解像度px）

function hash(n) {
  n = (n | 0) ^ 0x9e3779b9;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
function noise1(x, seed) {
  const i = Math.floor(x);
  const f = x - i;
  const a = hash(i * 374761 + seed);
  const b = hash((i + 1) * 374761 + seed);
  const u = f * f * (3 - 2 * f);
  return a + (b - a) * u;
}

const Scene = (() => {
  let ctx; // 現在の描画先（低解像度）
  let mctx; // メイン
  let bg, fx, dark, dctx, vignette, skyC;
  let lights = [];
  let SIL = false; // シルエット描画中

  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }

  function init(canvas) {
    mctx = canvas.getContext('2d');
    mctx.imageSmoothingEnabled = false;
    bg = mk(SW, SH);
    bg.getContext('2d', { willReadFrequently: true }); // 昼・夕方の色調整で毎フレーム読み書きする
    skyC = mk(SW, SH);
    fx = mk(SW, SH);
    dark = mk(SW, SH);
    dctx = dark.getContext('2d');
    vignette = mk(SW, SH);
    const vg = vignette.getContext('2d');
    const grad = vg.createRadialGradient(SW / 2, SH / 2, SH * 0.45, SW / 2, SH / 2, SW * 0.62);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.65)');
    vg.fillStyle = grad;
    vg.fillRect(0, 0, SW, SH);
  }

  /* ---------- 汎用ヘルパー ---------- */
  function rect(x, y, w, h, col) {
    ctx.fillStyle = col;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }
  function circ(cx, cy, r, col) {
    ctx.fillStyle = col;
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5);
      ctx.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2 + 1, 1);
    }
  }
  function arch(cx, topY, r, col) {
    ctx.fillStyle = col;
    for (let y = topY; y < GY; y++) {
      const dy = y - (topY + r);
      const hw = dy < 0 ? Math.floor(Math.sqrt(r * r - dy * dy)) : r;
      ctx.fillRect(Math.round(cx - hw), y, hw * 2, 1);
    }
  }
  function cedar(x, h, col) {
    x = Math.round(x);
    ctx.fillStyle = col;
    ctx.fillRect(x - 1, GY - 6, 2, 6);
    for (let r = 0; r < h; r++) {
      const hw = Math.floor(r * 0.3) + (r % 5 === 4 ? 1 : 0);
      ctx.fillRect(x - hw, GY - 6 - h + r, hw * 2 + 1, 1);
    }
  }

  /* ---------- 現実の時刻・天気（Weather.env の値）---------- */
  const NIGHT_ENV = { day: 0, warm: 0, kind: 'none', rain: 0, cloud: 0 };
  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixHex(a, b, k) {
    if (k <= 0) return a;
    if (k >= 1) return b;
    const A = hexToRgb(a);
    const B = hexToRgb(b);
    const c = A.map((v, i) => Math.round(v + (B[i] - v) * k));
    return '#' + ((1 << 24) | (c[0] << 16) | (c[1] << 8) | c[2]).toString(16).slice(1);
  }
  // 昼の空（晴れ／くもり・雨）と、夕焼け・朝焼けの空。上から下へ4段
  const SKY_DAY = ['#3f7fc4', '#5a95d2', '#7cafe0', '#a6cbea'];
  const SKY_OVER = ['#6e7884', '#7e8893', '#9099a3', '#a3abb4'];
  const SKY_RAIN = ['#4c545e', '#5a626c', '#69717a', '#79818a'];
  const SKY_DUSK = ['#2c2c5c', '#68406e', '#c25e58', '#f0a060'];
  function skyBands(th, E) {
    const over = E.rain > 0 ? SKY_RAIN : SKY_OVER;
    return th.sky.map((night, i) => {
      const dayCol = mixHex(SKY_DAY[i] || SKY_DAY[3], over[i] || over[3], E.cloud);
      let c = mixHex(night, dayCol, E.day);
      c = mixHex(c, mixHex(SKY_DUSK[i] || SKY_DUSK[3], over[i] || over[3], E.cloud * 0.6), E.warm * 0.85);
      return c;
    });
  }
  // 流れる雲（くもり・雨の日に多く、濃くなる）
  function clouds(E, t) {
    const n = Math.round(2 + E.cloud * 7);
    const col = mixHex(mixHex('#1a1e2a', E.rain > 0 ? '#7a828c' : '#e4e8ee', E.day), '#a86a62', E.warm * 0.6);
    for (let i = 0; i < n; i++) {
      const w = 30 + Math.floor(hash(i * 5 + 3) * 34);
      const x = Math.floor(((i * 53 + t * (1.2 + (i % 3) * 0.5)) % (SW + w + 20)) - w - 10);
      const y = 4 + Math.floor(hash(i * 11) * 34);
      ctx.globalAlpha = 0.25 + 0.55 * E.cloud;
      rect(x, y, w, 3, col);
      rect(x + 5, y - 2, w - 12, 2, col);
      rect(x + 3, y + 3, w - 8, 1, col);
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- 空 ---------- */
  function sky(th, t, E = NIGHT_ENV) {
    const bands = E === NIGHT_ENV ? th.sky : skyBands(th, E);
    const bh = Math.ceil(GY / bands.length);
    bands.forEach((c, i) => rect(0, i * bh, SW, bh + 1, c));
    for (let i = 1; i < bands.length; i++) {
      const y = i * bh;
      ctx.fillStyle = bands[i];
      for (let x = 0; x < SW; x += 2) ctx.fillRect(x, y - 1, 1, 1);
      ctx.fillStyle = bands[i - 1];
      for (let x = 1; x < SW; x += 2) ctx.fillRect(x, y, 1, 1);
    }
    for (let i = 0; i < 45; i++) {
      const x = Math.floor(hash(i * 3 + 1) * SW);
      const y = Math.floor(hash(i * 7 + 2) * 50);
      const a = (0.35 + 0.35 * Math.sin(t * (1 + hash(i) * 2) + i)) * (1 - E.day) * (1 - E.cloud) * (1 - E.warm * 0.6);
      if (a < 0.02) continue;
      ctx.fillStyle = `rgba(230,235,255,${a.toFixed(2)})`;
      ctx.fillRect(x, y, 1, 1);
    }
    // 昼の太陽・夕日（雲が厚いと見えない）
    const sunA = (1 - E.cloud) * Math.max(E.day * (1 - E.warm), E.warm);
    if (sunA > 0.05) {
      const dusk = E.warm > 0.3;
      const sx = dusk ? 28 : 34;
      const sy = dusk ? 40 : 15;
      ctx.globalAlpha = sunA;
      circ(sx, sy, 12, dusk ? 'rgba(255,170,90,0.14)' : 'rgba(255,255,235,0.16)');
      circ(sx, sy, 8, dusk ? 'rgba(255,170,90,0.2)' : 'rgba(255,255,235,0.24)');
      circ(sx, sy, 5, dusk ? '#ffb070' : '#fffdf0');
      ctx.globalAlpha = 1;
    }
    if (E.cloud > 0.15) clouds(E, t);
    const moonA = (1 - E.day) * (1 - E.cloud);
    if (th.moon !== false && moonA < 0.05) {
      // 昼・雲の日は月を描かない
    } else if (th.moon !== false) {
      ctx.globalAlpha = moonA;
      circ(160, 16, 12, 'rgba(230,225,190,0.05)');
      circ(160, 16, 9, 'rgba(230,225,190,0.06)');
      circ(160, 16, 6, '#e8e4c9');
      circ(163, 14, 5, bands[0]);
      ctx.globalAlpha = 1;
    } else {
      // トンネルの舞台は月を隠す雲
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(((i * 61 + t * 1.5) % (SW + 60)) - 40);
        const y = 8 + i * 7;
        ctx.fillStyle = 'rgba(40,44,60,0.35)';
        ctx.fillRect(x, y, 44, 3);
        ctx.fillRect(x + 6, y - 2, 28, 2);
      }
    }
  }

  /* ---------- 山・木 ---------- */
  function mountains(col, par, base, amp, freq, seed, scroll) {
    ctx.fillStyle = col;
    const off = Math.floor(scroll * par);
    for (let x = 0; x < SW; x++) {
      const wx = x + off;
      const h = base + amp * noise1(wx * freq, seed) + amp * 0.35 * noise1(wx * freq * 3.1, seed + 7);
      ctx.fillRect(x, Math.floor(GY - h), 1, Math.ceil(h));
    }
  }
  function treeline(col, par, base, seed, scroll) {
    ctx.fillStyle = col;
    const off = Math.floor(scroll * par);
    for (let x = 0; x < SW; x++) {
      const wx = x + off;
      const cell = Math.floor(wx / 7);
      const cx = wx - cell * 7;
      const th = base + Math.floor(hash(cell * 13 + seed) * 10);
      const h = Math.max(base - 6, th - Math.abs(cx - 3) * 3);
      ctx.fillRect(x, GY - h, 1, h);
    }
  }

  function ground(th, scroll, stageIdx) {
    if (th.girder) return bridgeGround(th, scroll);
    rect(0, GY, SW, SH - GY, th.ground);
    rect(0, GY, SW, 2, th.groundTop);
    const off = Math.floor(scroll);
    if (th.line) {
      ctx.fillStyle = th.line;
      const y = GY + 11;
      for (let x = -(off % 20); x < SW; x += 20) ctx.fillRect(x, y, 9, 1);
      // 路肩の白線
      ctx.fillStyle = 'rgba(200,200,190,0.18)';
      ctx.fillRect(0, GY + 3, SW, 1);
    }
    ctx.fillStyle = th.pebble;
    for (let i = Math.floor(off / 5); i < (off + SW) / 5 + 1; i++) {
      const r = hash(i * 7 + 3 + stageIdx * 999);
      if (r < 0.45) continue;
      const x = i * 5 - off + Math.floor(hash(i) * 4);
      const y = GY + 3 + Math.floor(hash(i * 3 + 1) * (SH - GY - 4));
      ctx.fillRect(x, y, r > 0.88 ? 2 : 1, 1);
    }
  }

  /* 陵北大橋：白い欄干と背の高い街灯（橋の上）、路面の下に赤い橋桁とコンクリートの橋脚、その下に北浅川。
   * ずっと橋の上をまっすぐ進む。ところどころに、写真で確認できた「最高速度40」「駐車禁止」の標識と、
   * 赤白の視線誘導標（上に橙色の反射板）がある（東京の橋クラブ・全国心霊マップの写真による） */
  const RY_P = 640; // 標識などがくり返す間隔（地面の座標）
  // 橋脚（コンクリートの柱）
  function ryPiers(off) {
    for (let k = Math.floor((off - RY_P) / RY_P); k <= Math.floor((off + SW) / RY_P); k++) {
      for (const at of [150, 470]) {
        const x = k * RY_P + at - off;
        if (x < -8 || x > SW) continue;
        rect(x, GY + 12, 6, SH - GY - 12, '#4e5256');
        rect(x, GY + 12, 1, SH - GY - 12, '#62666a');
      }
    }
  }
  // 標識と視線誘導標（ゆらの後ろ側）
  function rySigns(off) {
    for (let k = Math.floor((off - RY_P) / RY_P); k <= Math.floor((off + SW) / RY_P) + 1; k++) {
      const base = k * RY_P - off;
      // 標識：最高速度40（上）と駐車禁止（下）
      const sx = base + 110;
      if (sx > -10 && sx < SW + 10) {
        rect(sx, GY - 40, 1, 40, '#d8dadc');
        circ(sx, GY - 40, 4, '#c83030');
        circ(sx, GY - 40, 3, '#f0f0f0');
        rect(sx - 2, GY - 41, 1, 3, '#2a50b0');
        rect(sx, GY - 41, 2, 3, '#2a50b0');
        circ(sx, GY - 31, 4, '#c83030');
        circ(sx, GY - 31, 3, '#2a50b0');
        for (let i = -2; i <= 2; i++) rect(sx + i, GY - 31 + i, 1, 1, '#c83030');
      }
      // 赤白の視線誘導標（上に橙色の反射板）
      for (const dx of [128, 134, 140]) {
        const x = base + dx;
        if (x < -2 || x > SW) continue;
        rect(x, GY - 7, 1, 7, '#e8e8e8');
        rect(x, GY - 5, 1, 1, '#c83030');
        rect(x, GY - 3, 1, 1, '#c83030');
        rect(x, GY - 8, 1, 1, '#e08a30');
      }
    }
  }
  function bridgeGround(th, scroll) {
    const off = Math.floor(scroll);
    // 川（橋の下）
    rect(0, GY + 12, SW, SH - GY - 12, '#0c1624');
    ctx.fillStyle = 'rgba(150,180,220,0.25)';
    for (let i = 0; i < 14; i++) {
      const x = Math.floor((((i * 37 - scroll * 0.3) % SW) + SW) % SW);
      ctx.fillRect(x, GY + 15 + (i % 5) * 2, 4 + (i % 3), 1);
    }
    // 路面（アスファルトと縁石）
    rect(0, GY, SW, 3, th.ground);
    rect(0, GY, SW, 1, th.groundTop);
    // 赤い橋桁（補剛材の縦すじ）
    rect(0, GY + 3, SW, 9, th.girder);
    rect(0, GY + 3, SW, 1, '#b84040');
    rect(0, GY + 10, SW, 2, th.girderDark);
    ctx.fillStyle = th.girderDark;
    for (let x = -(off % 14); x < SW; x += 14) ctx.fillRect(x, GY + 4, 1, 6);
    ryPiers(off);
  }
  // 橋の欄干（ゆらの後ろ側）と街灯
  function bridgeRail(th, scroll, t) {
    const off = Math.floor(scroll);
    // 欄干：上の手すりと中段の横桟、細い支柱
    rect(0, GY - 12, SW, 2, th.rail);
    rect(0, GY - 7, SW, 1, th.railDark);
    ctx.fillStyle = th.railDark;
    for (let x = -(off % 6); x < SW; x += 6) ctx.fillRect(x, GY - 10, 1, 10);
    rySigns(off);
    // 街灯（背の高い、先が曲がった柱）
    const P = 96;
    for (let k = Math.floor((off - 40) / P); k <= Math.floor((off + SW) / P); k++) {
      const x = k * P - off + 30;
      rect(x, GY - 52, 2, 52, '#8a9098');
      rect(x + 1, GY - 54, 7, 2, '#8a9098');
      rect(x + 7, GY - 53, 4, 2, '#5a6068');
      const on = hash(k * 71) > 0.12; // ときどき消えている街灯がある
      if (on) {
        rect(x + 7, GY - 51, 4, 1, '#fff2c8');
        lights.push({ x: x + 9, y: GY - 48, r: 30 });
      }
    }
  }

  function foreground(scroll, E = NIGHT_ENV) {
    const off = Math.floor(scroll * 1.35);
    ctx.fillStyle = mixHex('#05050a', '#26301f', E.day * (1 - 0.3 * E.cloud));
    for (let x = 0; x < SW; x++) {
      const wx = x + off;
      const n = noise1(wx * 0.08, 77);
      if (n < 0.55) continue;
      const h = Math.floor((n - 0.55) * 18) + (hash(wx) > 0.7 ? 2 : 0);
      ctx.fillRect(x, SH - h, 1, h);
    }
  }

  /* ---------- トンネル（旧小峰：コンクリート／吹上：レンガ） ---------- */
  function tunnelPortal(k, sx, th, brick, t, bars = brick) {
    const w = 60;
    const h = 44;
    const top = GY - h;
    const cx = sx + w / 2;
    ctx.fillStyle = th.mound;
    for (let dx = -30; dx < w + 30; dx++) {
      const e = Math.min(dx + 30, w + 30 - dx);
      const mh = Math.min(h + 18, 6 + e * 1.3) + Math.floor(hash(k * 131 + dx) * 2);
      ctx.fillRect(Math.round(sx + dx), Math.floor(GY - mh), 1, Math.ceil(mh));
    }
    rect(sx, top, w, h, brick ? th.brick : th.portal);
    if (brick) {
      ctx.fillStyle = th.brickDark;
      let row = 0;
      for (let y = top + 2; y < GY; y += 3, row++) {
        ctx.fillRect(Math.round(sx), y, w, 1);
        for (let x = (row % 2) * 3; x < w; x += 6) ctx.fillRect(Math.round(sx + x), y - 2, 1, 2);
      }
      // 煉瓦の色むら
      for (let i = 0; i < 26; i++) {
        const x = Math.floor(hash(k * 7 + i * 13) * (w / 6)) * 6 + 1;
        const y = top + 3 + Math.floor(hash(k * 11 + i * 5) * ((h - 4) / 3)) * 3;
        rect(sx + x, y, 4, 2, i % 2 ? '#7c4030' : '#5a2a20');
      }
    } else {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      for (let i = 0; i < 10; i++) {
        const x = Math.floor(hash(k * 17 + i) * w);
        const l = 4 + Math.floor(hash(k * 23 + i) * 18);
        ctx.fillRect(Math.round(sx + x), top + 2, 1, l);
      }
    }
    rect(sx - 2, top - 3, w + 4, 3, brick ? th.brickDark : th.portalLight);
    rect(cx - 6, top + 3, 12, 5, '#2a2a2e');
    rect(cx - 5, top + 4, 10, 3, brick ? '#5a4a40' : '#55595c');
    arch(cx, GY - 38, 21, brick ? '#8a5040' : '#5d6266');
    if (brick) {
      // 迫石（アーチの煉瓦）
      ctx.fillStyle = th.brickDark;
      for (let a = 0; a <= 12; a++) {
        const ang = Math.PI + (a / 12) * Math.PI;
        ctx.fillRect(Math.round(cx + Math.cos(ang) * 20), Math.round(GY - 17 + Math.sin(ang) * 20), 1, 1);
      }
    }
    arch(cx, GY - 36, 19, '#08080b');
    arch(cx, GY - 28, 12, '#000');
    ctx.fillStyle = th.moss;
    for (let i = 0; i < 40; i++) {
      const x = Math.floor(hash(k * 41 + i) * (w + 4)) - 2;
      const y = top - 3 + Math.floor(Math.pow(hash(k * 59 + i), 2) * (h * 0.7));
      ctx.fillRect(Math.round(sx + x), y, 1 + (i % 3 === 0 ? 1 : 0), 1);
    }
    if (bars) {
      ctx.fillStyle = '#4a4a52';
      for (let x = -17; x <= 17; x += 4) {
        const yTop = GY - 17 - Math.sqrt(Math.max(0, 19 * 19 - x * x));
        ctx.fillRect(Math.round(cx + x), Math.ceil(yTop) + 1, 1, GY - Math.ceil(yTop) - 1);
      }
      ctx.fillRect(Math.round(cx - 18), GY - 14, 36, 1);
      ctx.fillRect(Math.round(cx - 18), GY - 26, 36, 1);
    }
    if (SIL) {
      // シルエットでもトンネルだとわかるよう、坑口と笠石の縁を抜く
      ctx.globalCompositeOperation = 'destination-out';
      arch(cx, GY - 38, 21, '#000');
      rect(sx - 3, top - 4, w + 6, 1, '#000');
      rect(sx - 3, top - 4, 1, h + 4, '#000');
      rect(sx + w + 2, top - 4, 1, h + 4, '#000');
      ctx.globalCompositeOperation = 'source-over';
      arch(cx, GY - 37, 20, '#000');
      return;
    }
    if ((t * 0.37 + k * 1.7) % 9 < 0.35) {
      ctx.fillStyle = '#ff3b3b';
      ctx.fillRect(Math.round(cx - 3), GY - 14, 1, 1);
      ctx.fillRect(Math.round(cx + 2), GY - 14, 1, 1);
    }
  }

  /* ---------- 八王子霊園の電話ボックス（道ばたの電話ボックス・生け垣・ガードレール・街灯） ---------- */
  function hedge(x0, w, th) {
    for (let x = 0; x < w; x++) {
      const h = 7 + Math.floor(noise1((x0 + x) * 0.2, 5) * 3);
      rect(x0 + x, GY - h, 1, h, th.hedge);
      if (hash(Math.floor(x0 + x) * 3) > 0.6) rect(x0 + x, GY - h, 1, 1, th.hedgeTop);
    }
  }
  function phoneBooth(x, t) {
    x = Math.round(x);
    const top = GY - 31;
    // 屋根と赤い帯（古いタイプの電話ボックス）
    rect(x - 1, top - 2, 16, 2, '#9aa0a6');
    rect(x, top, 14, 3, '#c0302e');
    // 枠とガラス（中の明かりで光っている）
    rect(x, top + 3, 14, 28, '#c8ccd0');
    rect(x + 1, top + 4, 12, 26, '#bfe8cf');
    rect(x + 1, top + 4, 12, 3, '#e8fff0');
    rect(x + 7, top + 4, 1, 26, '#9aa4a8');
    rect(x + 1, top + 16, 12, 1, '#9aa4a8');
    // 緑の公衆電話（台の上）
    rect(x + 3, top + 13, 5, 4, '#2f9a50');
    rect(x + 3, top + 12, 5, 1, '#46c06a');
    rect(x + 2, top + 17, 8, 1, '#6a7074');
    // 受話器は、ごくたまに（約25秒に1回、0.4秒ほど）かすかに揺れる
    const RING_EVERY = 25;
    const win = Math.floor(t / RING_EVERY);
    const at = 4 + hash(win * 7 + 3) * (RING_EVERY - 8); // その25秒のうち、いつ揺れるか
    const ph = t - win * RING_EVERY - at;
    const sway = ph > 0 && ph < 0.4 && Math.floor(ph * 10) % 2 === 0 ? 1 : 0;
    rect(x + 4 + sway, top + 11, 3, 1, '#1e5a30');
    lights.push({ x: x + 7, y: top + 14, r: 26 });
  }
  function guardrailWhite(sx, w) {
    for (let i = 0; i <= w; i += 10) rect(sx + i, GY - 7, 1, 7, '#8a8e92');
    rect(sx, GY - 8, w + 1, 2, '#e6e8ea');
    rect(sx, GY - 6, w + 1, 1, '#9a9ea2');
  }
  function streetLight(x, t, k) {
    x = Math.round(x);
    rect(x, GY - 44, 2, 44, '#5a5e66');
    rect(x, GY - 44, 8, 2, '#5a5e66');
    rect(x + 6, GY - 42, 4, 2, '#3a3e44');
    rect(x + 6, GY - 40, 4, 1, '#fff0c0');
    lights.push({ x: x + 8, y: GY - 38, r: 26 });
  }
  function utilityPole(x, th) {
    x = Math.round(x);
    rect(x, GY - 56, 2, 56, '#3a3836');
    rect(x - 4, GY - 50, 10, 1, '#3a3836');
    ctx.fillStyle = 'rgba(20,20,24,0.8)';
    for (let i = -60; i < 60; i += 1) ctx.fillRect(x + i, GY - 49 + Math.round(Math.abs(i) * 0.04), 1, 1);
  }
  function house(x, w, h, k) {
    x = Math.round(x);
    rect(x, GY - h, w, h, '#151a1e');
    for (let i = 0; i < w / 2 + 2; i++) rect(x - 2 + i, GY - h - Math.min(i, w / 2 + 2 - i) * 0.6 - 1, 1, 2, '#11151a');
    if (hash(k * 13) > 0.4) rect(x + Math.floor(w / 3), GY - h + 4, 4, 3, '#e8c878');
  }
  function phone(k, sx, th, t) {
    const m = ((k % 3) + 3) % 3;
    if (m === 0) {
      hedge(sx - 10, 120, th);
      guardrailWhite(sx - 8, 40);
      phoneBooth(sx + 44, t);
      streetLight(sx + 84, t, k);
    } else if (m === 1) {
      house(sx + 6, 26, 18, k);
      house(sx + 50, 22, 16, k + 1);
      hedge(sx - 10, 120, th);
      utilityPole(sx + 40, th);
    } else {
      cedar(sx + 10, 38, th.midTree);
      cedar(sx + 26, 30, th.midTree);
      hedge(sx - 10, 120, th);
      guardrailWhite(sx + 40, 60);
      utilityPole(sx + 92, th);
    }
  }

  /* ---------- 陵北大橋（遠くの川原の木々。欄干と街灯は bridgeRail で描く） ---------- */
  function ryohoku(k, sx, th, t) {
    // 対岸の川原の木立（低く）
    for (let i = 0; i < 4; i++) circ(sx + 10 + i * 22 + Math.floor(hash(k * 5 + i) * 8), GY - 16, 6 + Math.floor(hash(k * 9 + i) * 4), th.midTree);
  }

  /* ---------- 旧満地トンネル（外から見た坑口：煉瓦張りで卵形の開口。シルエット用） ---------- */
  function manjiPortal(k, sx, th, t) {
    const w = 58;
    const h = 46;
    const top = GY - h;
    const cx = sx + w / 2;
    ctx.fillStyle = th.mound;
    for (let dx = -26; dx < w + 26; dx++) {
      const e = Math.min(dx + 26, w + 26 - dx);
      const mh = Math.min(h + 16, 6 + e * 1.3);
      ctx.fillRect(Math.round(sx + dx), Math.floor(GY - mh), 1, Math.ceil(mh));
    }
    rect(sx, top, w, h, th.brick);
    ctx.fillStyle = th.brickDark;
    let row = 0;
    for (let y = top + 2; y < GY; y += 3, row++) {
      ctx.fillRect(Math.round(sx), y, w, 1);
      for (let x = (row % 2) * 3; x < w; x += 6) ctx.fillRect(Math.round(sx + x), y - 2, 1, 2);
    }
    rect(sx - 2, top - 3, w + 4, 3, th.brickDark);
    rect(cx - 6, top + 3, 12, 5, '#2a2a2e');
    // 卵形の開口（縦長の楕円）
    const egg = (rx, ry, cy, col) => {
      ctx.fillStyle = col;
      for (let y = Math.ceil(cy - ry); y < GY; y++) {
        const dy = (y - cy) / ry;
        const hw = y < cy ? Math.floor(rx * Math.sqrt(Math.max(0, 1 - dy * dy))) : rx;
        ctx.fillRect(Math.round(cx - hw), y, hw * 2, 1);
      }
    };
    egg(19, 30, GY - 12, '#8a8a84');
    egg(17, 28, GY - 12, '#1a1a1c');
    if (SIL) {
      ctx.globalCompositeOperation = 'destination-out';
      egg(19, 30, GY - 12, '#000');
      ctx.globalCompositeOperation = 'source-over';
      egg(18, 29, GY - 12, '#000');
    }
  }
  function manji(k, sx, th, t) {
    if (((k % 2) + 2) % 2 === 0) manjiPortal(k, sx, th, t);
    else {
      cedar(sx + 8, 40, th.midTree);
      cedar(sx + 30, 34, th.midTree);
      cedar(sx + 60, 44, th.midTree);
    }
  }

  /* ---------- 旧小峰トンネル：夜の山道 ---------- */
  function guardrail(sx) {
    for (let i = 0; i < 5; i++) rect(sx + i * 9, GY - 6, 1, 6, '#6c6f70');
    rect(sx - 1, GY - 7, 38, 2, '#8a8d8e');
    rect(sx + 14, GY - 7, 8, 2, '#5b4a3a');
  }
  function curveMirror(sx) {
    const x = Math.round(sx);
    rect(x, GY - 30, 1, 30, '#c8642a');
    circ(x, GY - 34, 5, '#c8642a');
    circ(x, GY - 34, 4, '#566a80');
    rect(x - 2, GY - 37, 2, 2, '#9fb4cc');
  }
  function warnSign(sx) {
    const x = Math.round(sx);
    rect(x, GY - 22, 1, 22, '#7a7c80');
    for (let i = 0; i < 6; i++) rect(x - i, GY - 34 + i, i * 2 + 1, 1, '#d8b030');
    for (let i = 0; i < 5; i++) rect(x - 4 + i, GY - 28 + i, 9 - i * 2, 1, '#d8b030');
    rect(x - 1, GY - 31, 3, 1, '#1a1a1a');
    rect(x + 1, GY - 32, 1, 3, '#1a1a1a');
    rect(x - 1, GY - 30, 1, 3, '#1a1a1a');
  }
  function komine(k, sx, th, t) {
    const m = ((k % 2) + 2) % 2;
    if (m === 0) tunnelPortal(k, sx, th, true, t, false);
    else {
      cedar(sx + 2, 36 + Math.floor(hash(k) * 12), th.midTree);
      cedar(sx + 18, 46 + Math.floor(hash(k + 5) * 10), th.midTree);
      if (hash(k * 3) > 0.5) curveMirror(sx + 34);
      else warnSign(sx + 34);
      guardrail(sx + 44);
      cedar(sx + 90, 32, th.midTree);
    }
  }

  /* ---------- 道了堂跡：お堂のシルエット ---------- */
  function lantern(x, th, t, k) {
    x = Math.round(x);
    const S = th.stone;
    const D = th.stoneDark;
    rect(x - 5, GY - 3, 10, 3, D);
    rect(x - 3, GY - 6, 6, 3, S);
    rect(x - 2, GY - 14, 4, 8, S);
    rect(x - 1, GY - 14, 1, 8, D);
    rect(x - 5, GY - 16, 10, 2, D);
    rect(x - 4, GY - 22, 8, 6, S);
    const lit = Math.sin(t * 1.3 + k * 2.1) > 0.55;
    rect(x - 2, GY - 21, 4, 3, lit ? '#7fd0ff' : '#141218');
    if (lit) lights.push({ x, y: GY - 19, r: 12 });
    rect(x - 6, GY - 24, 12, 2, D);
    rect(x - 4, GY - 26, 8, 2, S);
    rect(x - 2, GY - 27, 4, 1, S);
    rect(x - 1, GY - 29, 2, 2, D);
  }
  function jizo(x, th, base = GY) {
    x = Math.round(x);
    rect(x - 4, base - 2, 8, 2, th.stoneDark);
    rect(x - 3, base - 9, 6, 7, th.stone);
    rect(x - 2, base - 13, 4, 4, th.stone);
    rect(x - 1, base - 14, 2, 1, th.stone);
    rect(x - 3, base - 9, 6, 3, '#8a2a30');
    rect(x - 1, base - 12, 1, 1, th.stoneDark);
    rect(x + 1, base - 12, 1, 1, th.stoneDark);
  }
  /* お堂の跡地（お堂は1983年に解体されて今はない）。
   * 石段の上に、柱を支えていた礎石と石碑、お地蔵さまが残る小さな公園のような場所 */
  // 落ち葉（茶色・こげ茶・くすんだ橙）
  function leaves(x0, w, y0, h, seed, n) {
    const cols = ['#5a4630', '#4a3424', '#7a5030', '#6a5a3a'];
    for (let i = 0; i < n; i++) {
      const x = x0 + Math.floor(hash(seed + i * 7) * w);
      const y = y0 + Math.floor(hash(seed + i * 13 + 1) * h);
      ctx.fillStyle = cols[i % cols.length];
      ctx.fillRect(Math.round(x), Math.round(y), 1 + (i % 3 === 0 ? 1 : 0), 1);
    }
  }
  // 丸い石を積んだ山の上のお地蔵さま。まわりを木の杭と縄で囲む
  function jizoMound(x, th, seed) {
    x = Math.round(x);
    // 丸い石の山
    for (let r = 0; r < 4; r++) {
      const w = 16 - r * 3;
      for (let i = 0; i < w; i += 3) {
        const c = hash(seed + r * 31 + i) > 0.5 ? th.stone : th.stoneDark;
        circ(x - w / 2 + i + 1, GY - 1 - r * 2, 1, c);
      }
    }
    jizo(x - 3, th, GY - 7);
    jizo(x + 4, th, GY - 6);
    // 木の杭と、杭のあいだに張った縄
    const posts = [x - 12, x - 4, x + 4, x + 12];
    posts.forEach((px) => rect(px, GY - 7, 1, 7, '#5a4028'));
    ctx.fillStyle = '#b8a880';
    for (let i = 0; i + 1 < posts.length; i++) {
      for (let xx = posts[i]; xx <= posts[i + 1]; xx++) {
        const sag = Math.round(Math.sin(((xx - posts[i]) / (posts[i + 1] - posts[i])) * Math.PI) * 1);
        ctx.fillRect(xx, GY - 6 + sag, 1, 1);
      }
    }
  }
  /* お堂の跡地（お堂は1983年に解体されて今はない）。
   * 石段の上の平らな跡地に、低い縁石で囲まれた長方形の土台の跡だけが残る。中には落ち葉が積もっている */
  function ruins(cx, base, th) {
    rect(cx - 30, base - 5, 60, 2, th.stoneDark);
    rect(cx - 30, base - 5, 60, 1, th.stone);
    rect(cx - 34, base - 2, 68, 2, th.stoneDark);
    rect(cx - 34, base - 2, 68, 1, th.stone);
    rect(cx - 34, base - 4, 4, 2, th.stoneDark);
    rect(cx + 30, base - 4, 4, 2, th.stoneDark);
    // 囲みの中と縁石の上の落ち葉
    leaves(cx - 30, 60, base - 4, 2, 101, 34);
    leaves(cx - 34, 68, base - 6, 1, 211, 10);
    leaves(cx - 34, 68, base - 3, 1, 307, 12);
  }
  function doryodo(k, sx, th, t) {
    if (k % 2 === 0) {
      const cx = sx + 44;
      for (let i = 0; i < 6; i++) {
        const w = 40 - i * 3;
        rect(cx - w / 2, GY - (i + 1) * 3, w, 3, i % 2 ? th.stone : th.stoneDark);
        rect(cx - w / 2, GY - (i + 1) * 3, w, 1, '#7c7a82');
      }
      // 跡地を囲む木立
      circ(cx - 46, GY - 50, 14, th.midTree);
      circ(cx + 48, GY - 54, 16, th.midTree);
      rect(cx - 47, GY - 40, 3, 40, '#1a1416');
      rect(cx + 47, GY - 40, 3, 40, '#1a1416');
      rect(cx - 30, GY - 21, 60, 3, th.stoneDark);
      ruins(cx, GY - 21, th);
      jizoMound(cx + 31, th, k * 17);
      // 石碑（文字は読めない）：土台の外、石段の左の地面に
      rect(cx - 33, GY - 3, 8, 3, th.stoneDark);
      rect(cx - 32, GY - 19, 6, 16, th.stone);
      rect(cx - 32, GY - 20, 6, 1, '#7c7a82');
      rect(cx - 30, GY - 16, 2, 10, th.stoneDark);
      leaves(cx - 42, 84, GY - 1, 2, k * 7 + 5, 24);
      lantern(sx, th, t, k);
      lantern(sx + 88, th, t, k + 1);
    } else {
      const x = sx + 20;
      rect(x - 3, GY - 40, 6, 40, '#1a1416');
      rect(x - 6, GY - 3, 12, 3, '#1a1416');
      circ(x, GY - 46, 16, th.midTree);
      circ(x - 10, GY - 38, 10, th.midTree);
      circ(x + 11, GY - 40, 11, th.midTree);
      jizoMound(sx + 50, th, k * 23);
      leaves(sx, 110, GY - 1, 2, k * 11 + 3, 26);
      cedar(sx + 84, 46, th.midTree);
      cedar(sx + 100, 38, th.midTree);
    }
  }

  /* ---------- 八王子城跡：石垣と山並み ---------- */
  function ishigaki(sx, w, h, baseY, th) {
    for (let r = 0; r < h; r++) {
      const inset = Math.floor(Math.pow(r / h, 1.6) * 8);
      rect(sx + inset, baseY - r - 1, w - inset * 2, 1, th.wall);
    }
    ctx.fillStyle = th.wallDark;
    for (let r = 0; r < h; r += 4) {
      const inset = Math.floor(Math.pow(r / h, 1.6) * 8);
      ctx.fillRect(Math.round(sx + inset), baseY - r - 1, w - inset * 2, 1);
      const shift = (r / 4) % 2 ? 4 : 0;
      for (let x = inset + shift; x < w - inset; x += 8) ctx.fillRect(Math.round(sx + x), baseY - r - 4, 1, 3);
    }
    // 苔
    ctx.fillStyle = '#2a3a26';
    for (let i = 0; i < 18; i++) {
      ctx.fillRect(Math.round(sx + 4 + hash(sx * 3 + i) * (w - 8)), baseY - 1 - Math.floor(hash(i * 7 + w) * h), 2, 1);
    }
    rect(sx + 7, baseY - h - 1, w - 14, 2, '#1d2c1c');
  }
  function pine(x, baseY, th) {
    x = Math.round(x);
    rect(x, baseY - 14, 2, 13, '#21170f');
    rect(x - 8, baseY - 16, 12, 3, th.midTree);
    rect(x - 2, baseY - 19, 12, 3, th.midTree);
    rect(x - 5, baseY - 11, 9, 2, th.midTree);
  }
  /* 御主殿の滝：4つ目ごとのランドマーク。滝・滝つぼ・川の流れ。
   * 落城の際に多くの人が命を落とした場所なので、ここでは怪異を起こさない（game.js 側で制御） */
  const LM_PERIOD = 150; // ランドマークの間隔
  const LM_PAR = 0.6; // ランドマークの視差
  const FALLS_OFF = 46; // 滝の中心（ランドマーク左端からの距離）
  let rivers = [];
  function gosyuden(k, sx, th, t) {
    const fx = Math.round(sx + FALLS_OFF);
    // 岩壁
    ctx.fillStyle = '#2c3340';
    for (let dx = -8; dx < 100; dx++) {
      const e = Math.min(dx + 8, 100 - dx);
      const h = Math.min(58, 10 + e * 1.6) + Math.floor(hash(k * 211 + dx) * 4);
      ctx.fillRect(Math.round(sx + dx), GY - h, 1, h);
    }
    for (let i = 0; i < 44; i++) {
      const x = sx + Math.floor(hash(k * 7 + i) * 96);
      const y = GY - 6 - Math.floor(hash(k * 13 + i) * 46);
      rect(x, y, 3 + (i % 3), 2, i % 4 === 0 ? '#2f4a2c' : i % 4 === 1 ? '#3a4352' : '#222833');
    }
    // 岩の層
    ctx.fillStyle = '#232a35';
    for (let y = GY - 48; y < GY - 4; y += 7) ctx.fillRect(Math.round(sx + 4), y, 92, 1);
    cedar(sx - 6, 50, th.midTree);
    cedar(sx + 104, 44, th.midTree);
    // 滝
    // 2段の滝（段瀑）：上段（約3m）→ 岩棚 → 下段（約2m）。落差の比 3:2 で描く
    const top = GY - 54;
    const ledge = GY - 25; // 岩棚の高さ
    const fallCol = (x0, w, y0, y1) => {
      for (let y = y0; y < y1; y++) {
        for (let i = 0; i < w; i++) {
          const v = (((y - Math.floor(t * 42) + i * 3) % 5) + 5) % 5; // 模様が下へ流れる
          ctx.fillStyle = v === 0 ? '#eef6ff' : v < 3 ? '#9cc4ea' : '#6290c0';
          ctx.fillRect(x0 + i, y, 1, 1);
        }
      }
    };
    rect(fx - 9, top - 2, 18, 3, '#3a4352');
    fallCol(fx - 7, 5, top, ledge); // 上段（左の筋）
    fallCol(fx + 1, 4, top + 3, ledge); // 上段（右の筋）
    rect(fx - 7, top, 5, 1, '#eef6ff');
    rect(fx + 1, top + 3, 4, 1, '#eef6ff');
    // 岩棚（上段の水を受ける小さな淵）
    rect(fx - 12, ledge, 26, 4, '#3a4352');
    rect(fx - 10, ledge - 1, 21, 2, '#2f5a86');
    for (let i = 0; i < 6; i++) {
      const x = fx - 6 + Math.floor(hash(Math.floor(t * 8) * 13 + i) * 11);
      rect(x, ledge - 2 - Math.floor(hash(Math.floor(t * 8) * 7 + i) * 3), 1, 1, 'rgba(230,240,255,0.6)');
    }
    fallCol(fx - 2, 9, ledge + 2, GY - 5); // 下段（少し右へずれて落ちる）
    rect(fx - 2, ledge + 2, 9, 1, '#eef6ff');
    // 滝つぼと水しぶき
    rect(fx - 17, GY - 5, 35, 5, '#24456a');
    rect(fx - 14, GY - 6, 29, 1, '#2f5a86');
    const ft = Math.floor(t * 8);
    for (let i = 0; i < 12; i++) {
      const x = fx - 9 + Math.floor(hash(ft * 31 + i) * 19);
      const y = GY - 6 - Math.floor(hash(ft * 17 + i * 3) * 7);
      rect(x, y, 1, 1, 'rgba(230,240,255,0.55)');
    }
    // 苔とシダ
    for (let i = 0; i < 30; i++) {
      const x = sx + Math.floor(hash(k * 19 + i) * 96);
      const y = GY - 2 - Math.floor(hash(k * 23 + i) * 40);
      rect(x, y, 2 + (i % 2), 1, i % 3 ? '#36582e' : '#4a7a3a');
    }
    for (let i = 0; i < 8; i++) {
      const x = sx + 4 + i * 12 + Math.floor(hash(k + i) * 6);
      rect(x, GY - 3, 1, 3, '#3a6a32');
      rect(x - 2, GY - 2, 2, 1, '#3a6a32');
      rect(x + 1, GY - 2, 2, 1, '#3a6a32');
    }
    lights.push({ x: fx, y: GY - 28, r: 34 }); // 月明かりを映す水
    rivers.push({ x0: fx - 70, x1: fx + 120 });
  }
  // 地面の上を流れる川（滝つぼから続く）
  function drawRivers(t) {
    for (const r of rivers) {
      const x0 = Math.round(r.x0);
      const x1 = Math.round(r.x1);
      const len = x1 - x0;
      ctx.fillStyle = '#1f3a58';
      for (let x = x0; x < x1; x++) {
        const e = Math.min(x - x0, x1 - x);
        ctx.fillRect(x, GY, 1, Math.min(4, 1 + Math.floor(e / 8)));
      }
      rect(x0 + 8, GY, len - 16, 1, '#2f5a86');
      ctx.fillStyle = 'rgba(170,205,240,0.55)';
      for (let i = 0; i < 12; i++) {
        const x = x0 + ((((i * 29 - t * 14) % len) + len) % len);
        ctx.fillRect(Math.round(x), GY + 1 + (i % 3), 3, 1);
      }
    }
  }
  // ゆらに一番近い滝との距離（低解像度px。0でちょうど滝の前）
  function fallsNear(stageIdx, scroll) {
    if (STAGES[stageIdx].landmark !== 'hachioji') return null;
    const off = scroll * LM_PAR;
    const kc = Math.round((off + YURA_CX - 40 - FALLS_OFF) / LM_PERIOD);
    let best = null;
    for (let k = kc - 4; k <= kc + 4; k++) {
      if (((k % 4) + 4) % 4 !== 3) continue;
      const dx = k * LM_PERIOD - off + 40 + FALLS_OFF - YURA_CX;
      if (!best || Math.abs(dx) < Math.abs(best.dx)) best = { k, dx };
    }
    return best;
  }

  function hachioji(k, sx, th, t) {
    if (((k % 4) + 4) % 4 === 3) return gosyuden(k, sx, th, t);
    if (k % 2 === 0) {
      ishigaki(sx, 72, 34, GY, th);
      pine(sx + 50, GY - 34, th);
    } else {
      ishigaki(sx - 6, 84, 16, GY, th);
      ishigaki(sx + 10, 52, 14, GY - 16, th);
      pine(sx + 22, GY - 30, th);
    }
  }

  /* ---------- 吹上トンネル：レンガのトンネル ---------- */
  function streetLamp(sx, t, k) {
    const x = Math.round(sx);
    rect(x, GY - 40, 2, 40, '#3b3d44');
    rect(x, GY - 40, 9, 2, '#3b3d44');
    rect(x + 7, GY - 38, 4, 2, '#26272c');
    const on = Math.sin(t * 9 + k) > -0.2 || Math.sin(t * 0.7 + k) > 0.6;
    if (on) {
      rect(x + 7, GY - 36, 4, 1, '#ffd98a');
      lights.push({ x: x + 9, y: GY - 34, r: 26 });
    }
  }
  function fukiage(k, sx, th, t) {
    if (k % 2 === 0) tunnelPortal(k, sx, th, true, t);
    else {
      cedar(sx, 40, th.midTree);
      streetLamp(sx + 22, t, k);
      cedar(sx + 50, 46, th.midTree);
    }
  }

  const LANDMARKS = { phone, ryohoku, manji, komine, doryodo, hachioji, fukiage };


  function landmarks(stage, scroll, t) {
    const par = LM_PAR;
    const P = LM_PERIOD;
    const off = scroll * par;
    const fn = LANDMARKS[stage.landmark];
    const k0 = Math.floor((off - 140) / P);
    const k1 = Math.floor((off + SW + 40) / P);
    for (let k = k0; k <= k1; k++) fn(k, Math.round(k * P - off + 40), stage.theme, t);
  }

  function terrain(stageIdx, scroll, t) {
    terrainFar(stageIdx, scroll);
    terrainNear(stageIdx, scroll, t);
  }
  function terrainNear(stageIdx, scroll, t) {
    const stage = STAGES[stageIdx];
    rivers = [];
    landmarks(stage, scroll, t);
    ground(stage.theme, scroll, stageIdx);
    if (stage.theme.girder) bridgeRail(stage.theme, scroll, t);
    drawRivers(t);
    if (stage.landmark === 'hachioji' && !SIL) hikihashi(stage.theme, scroll, t);
  }

  /* 八王子城跡の曳橋（木造の復元橋。写真では、白木の床と、細い縦格子の欄干、黒い笠をのせた親柱、
   * 床の下には焦げ茶の橋桁と、筋かいの入った木の橋脚が並ぶ。両端は石垣の橋台）。
   * ゆらが渡れるよう、地面と同じ速さで流れる手前の地面に描く */
  const HB_PERIOD = 560;
  const HB_W = 112;
  function hikihashi(th, scroll, t) {
    const off = Math.floor(scroll);
    for (let k = Math.floor((off - HB_W - 300) / HB_PERIOD); k <= Math.floor((off + SW) / HB_PERIOD); k++) {
      const x0 = k * HB_PERIOD + 300 - off;
      const x1 = x0 + HB_W;
      if (x1 < -16 || x0 > SW + 16) continue;
      // 橋の下の谷（城山川）
      for (let x = Math.max(0, x0); x < Math.min(SW, x1); x++) {
        const e = Math.min(x - x0, x1 - x);
        const bank = Math.max(0, 14 - e) * 1.2; // 両岸の斜面
        rect(x, GY + 1, 1, SH - GY - 1, '#0a100c');
        if (bank > 0) rect(x, Math.round(SH - bank - 3), 1, Math.round(bank + 3), th.ground);
      }
      rect(x0 + 16, SH - 3, HB_W - 32, 3, '#16304a');
      ctx.fillStyle = 'rgba(160,200,235,0.45)';
      for (let i = 0; i < 6; i++) {
        const x = x0 + 16 + ((((i * 19 - t * 10) % (HB_W - 32)) + (HB_W - 32)) % (HB_W - 32));
        ctx.fillRect(Math.round(x), SH - 2 - (i % 2), 3, 1);
      }
      // 石垣の橋台
      for (const ax of [x0 - 8, x1]) {
        rect(ax, GY + 1, 8, SH - GY - 1, th.wall);
        ctx.fillStyle = th.wallDark;
        for (let y = GY + 4, r = 0; y < SH; y += 4, r++) {
          ctx.fillRect(ax, y, 8, 1);
          ctx.fillRect(ax + (r % 2 ? 2 : 5), y - 3, 1, 3);
        }
      }
      // 橋脚（木の柱）と筋かい
      const piers = [];
      for (let x = x0 + 18; x <= x1 - 18; x += 25) piers.push(x);
      piers.forEach((px, i) => {
        rect(px, GY + 4, 2, SH - GY - 6, '#2a1c12');
        if (i + 1 < piers.length) {
          const q = piers[i + 1];
          ctx.fillStyle = '#24180f';
          for (let x = px + 2; x < q; x++) {
            const f = (x - px) / (q - px);
            ctx.fillRect(x, Math.round(GY + 6 + f * 10), 1, 1);
            ctx.fillRect(x, Math.round(GY + 16 - f * 10), 1, 1);
          }
        }
      });
      // 橋桁と床（ゆらが歩く面）
      rect(x0 - 2, GY + 1, HB_W + 4, 3, '#3a2818');
      rect(x0 - 2, GY + 1, HB_W + 4, 1, '#4e3822');
      rect(x0 - 2, GY, HB_W + 4, 1, '#7a6448');
      // 欄干（ゆらの後ろ側）：上の手すり、下の横木、細かい縦格子、ところどころの柱
      ctx.fillStyle = '#5e4c36';
      for (let x = x0; x < x1; x += 2) ctx.fillRect(x, GY - 10, 1, 7);
      rect(x0, GY - 12, HB_W, 2, '#7a6448');
      rect(x0, GY - 3, HB_W, 2, '#6a5640');
      for (let x = x0 + 14; x < x1 - 4; x += 14) rect(x, GY - 12, 2, 12, '#6e5a42');
      // 親柱（黒い笠つき）
      for (const px of [x0 - 3, x1]) {
        rect(px, GY - 17, 3, 17, '#7a6448');
        rect(px, GY - 17, 1, 17, '#8c7656');
        rect(px - 1, GY - 19, 5, 2, '#1c1816');
      }
    }
  }
  function terrainFar(stageIdx, scroll) {
    const stage = STAGES[stageIdx];
    const th = stage.theme;
    if (th.ridges) {
      th.ridges.forEach(([col, par, base, amp, freq], i) => {
        mountains(col, par, base, amp, freq, 31 + i * 17, scroll);
        // 尾根の間にたなびく霧
        ctx.fillStyle = `rgba(${th.fog},0.06)`;
        ctx.fillRect(0, Math.floor(GY - base + 4), SW, 3);
      });
    } else {
      mountains(th.mountain, 0.08, 26, 18, 0.025, 11 + stageIdx, scroll);
    }
    treeline(th.trees, 0.25, th.ridges ? 10 : 16, 3 + stageIdx * 5, scroll);
  }

  /* 景色は夜の色で描いてあるので、昼・夕方はドットの色を持ち上げて明るくする（低解像度なので毎フレームでも軽い） */
  const LUT = [new Uint8ClampedArray(256), new Uint8ClampedArray(256), new Uint8ClampedArray(256)];
  function grade(c, E) {
    const k = E.day;
    const w = E.warm;
    if (k < 0.01 && w < 0.01) return;
    const cl = E.cloud;
    // 晴れの昼／くもり・雨の昼／夕焼け の「倍率」と「底上げ」。
    // 明るい色が真っ白に飛ばないよう、なだらかに頭打ちになる曲線（1 - e^-x）を通す
    const rainDim = E.rain > 0 ? 0.85 : 1;
    const dayG = [(2.7 - 0.4 * cl) * rainDim, (2.7 - 0.4 * cl) * rainDim, (2.2 - 0.1 * cl) * rainDim];
    const dayL = [22 + 8 * cl, 24 + 6 * cl, 22 + 12 * cl];
    const duskG = [2.6, 1.9, 1.5];
    const duskL = [26, 12, 10];
    const curve = (v) => 255 * (1 - Math.exp(-v / 200));
    for (let ch = 0; ch < 3; ch++) {
      const lut = LUT[ch];
      for (let i = 0; i < 256; i++) {
        let v = i + (curve(i * dayG[ch] + dayL[ch]) - i) * k;
        v += (curve(i * duskG[ch] + duskL[ch]) - v) * w * 0.8;
        lut[i] = v;
      }
    }
    const img = c.getImageData(0, 0, SW, SH);
    const d = img.data;
    const R = LUT[0];
    const G = LUT[1];
    const B = LUT[2];
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] === 0) continue;
      d[i] = R[d[i]];
      d[i + 1] = G[d[i + 1]];
      d[i + 2] = B[d[i + 2]];
    }
    c.putImageData(img, 0, 0);
  }
  // 雨の日：濡れた地面に映る光の筋
  function wetGround(E, scroll) {
    const off = Math.floor(scroll);
    ctx.fillStyle = `rgba(190,210,235,${(0.05 + 0.05 * E.day).toFixed(3)})`;
    for (let i = 0; i < 26; i++) {
      const x = Math.floor(((hash(i * 7 + 1) * (SW + 40) - off * 1) % (SW + 40) + SW + 40) % (SW + 40)) - 20;
      const y = GY + 3 + Math.floor(hash(i * 13 + 2) * (SH - GY - 5));
      ctx.fillRect(x, y, 4 + Math.floor(hash(i) * 8), 1);
    }
  }
  // 雨・雪（画面の手前に降らせる）
  function precip(E, t) {
    if (E.kind === 'snow') {
      const n = Math.round(30 + 40 * E.rain);
      ctx.fillStyle = 'rgba(240,244,255,0.75)';
      for (let i = 0; i < n; i++) {
        const sp = 10 + hash(i * 3) * 10;
        const y = ((hash(i * 7) * (SH + 10) + t * sp) % (SH + 10)) - 5;
        const x = ((hash(i) * SW + Math.sin(t * 0.8 + i) * 4 + SW) % SW);
        ctx.fillRect(Math.round(x), Math.round(y), hash(i * 5) > 0.7 ? 2 : 1, hash(i * 5) > 0.7 ? 2 : 1);
      }
      return;
    }
    const n = Math.round(40 + 110 * E.rain);
    const a = (0.28 + 0.2 * E.rain).toFixed(2);
    ctx.fillStyle = `rgba(175,195,225,${a})`;
    for (let i = 0; i < n; i++) {
      const sp = 150 + hash(i * 3) * 80;
      const y = ((hash(i * 7) * (SH + 12) + t * sp) % (SH + 12)) - 6;
      const x = ((hash(i) * (SW + 30) - y * 0.25 + SW + 30) % (SW + 30)) - 10;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 3);
      ctx.fillRect(Math.round(x - 1), Math.round(y + 3), 1, 1);
    }
    // 地面ではねるしずく
    const f = Math.floor(t * 10);
    ctx.fillStyle = `rgba(200,215,240,${a})`;
    for (let i = 0; i < 18 * E.rain + 6; i++) {
      if (hash(i * 17 + f * 31) < 0.5) continue;
      const x = Math.floor(hash(i * 5 + f * 7) * SW);
      const y = GY + 1 + Math.floor(hash(i * 9 + f * 3) * (SH - GY - 2));
      ctx.fillRect(x - 1, y, 1, 1);
      ctx.fillRect(x + 1, y, 1, 1);
      ctx.fillRect(x, y - 1, 1, 1);
    }
  }

  function fog(th, t, E = NIGHT_ENV) {
    // 霧の日は濃く、雨の日も少しもやがかかる
    const thick = E.kind === 'fog' ? 3 : E.rain > 0 ? 1.6 : 1;
    const n = E.kind === 'fog' ? 12 : 7;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(((i * 67 + t * (3 + (i % 7))) % (SW + 70)) - 50);
      const y = Math.floor(GY - 10 + Math.sin(t * 0.4 + i) * 3 + (i % 3) * 4 - (i >= 7 ? 14 + (i % 4) * 6 : 0));
      ctx.fillStyle = `rgba(${th.fog},${(0.07 * thick).toFixed(3)})`;
      ctx.fillRect(x, y, 46, 3);
      ctx.fillRect(x + 6, y - 2, 32, 2);
      ctx.fillRect(x + 10, y + 3, 26, 2);
    }
  }

  // 人魂：青白い炎。先が上を向いて揺らめきながら、ゆっくり漂う（尾は付けない）
  const FLAME = [
    ['..g..', '..G..', '.gGg.', '.GWG.', 'gGWGg', 'gGWGg', '.gGg.'],
    ['...g.', '..Gg.', '.gGg.', '.GWG.', 'gGWGg', 'gGWGg', '.gGg.'],
    ['.g...', '.gG..', '.gGg.', '.GWG.', 'gGWGg', 'gGWGg', '.gGg.'],
  ];
  const FLAME_COL = { g: '#4fa6e0', G: '#8fd0ff', W: '#ffffff' };
  function hitodama(t, stageIdx, dayK = 0) {
    const n = 1 + Math.min(stageIdx, 2);
    for (let i = 0; i < n; i++) {
      // 長い周期でふっと現れて、また消える
      const cyc = (t * 0.035 + i * 0.37) % 1;
      const a = Math.max(0, Math.sin(cyc * Math.PI)) * (0.65 + 0.25 * Math.sin(t * 5 + i)) * (1 - 0.7 * dayK);
      if (a < 0.05) continue;
      const x = Math.round(SW - cyc * (SW + 20) + Math.sin(t * 0.9 + i) * 5);
      const y = Math.round(28 + i * 10 + Math.sin(t * 1.3 + i * 3) * 4);
      const shape = FLAME[Math.floor(t * 6 + i) % FLAME.length];
      ctx.globalAlpha = a * 0.18;
      circ(x + 2, y + 4, 6, '#8fd0ff');
      ctx.globalAlpha = a;
      shape.forEach((row, yy) => {
        for (let xx = 0; xx < row.length; xx++) {
          const c = FLAME_COL[row[xx]];
          if (c) rect(x + xx, y + yy, 1, 1, c);
        }
      });
      ctx.globalAlpha = 1;
    }
  }

  /* ---------- 吹き付けコンクリートの壁（旧小峰トンネル） ----------
   * 横768pxの壁テクスチャを一度だけ作り、スクロールに合わせて繰り返し貼る。
   * 煉瓦はコンクリートに覆われて見えない設定。穴（待避所など）は作らない。 */
  const CONCRETE_TW = 768;
  const concreteCache = {};
  // 周期つきの1次元バリューノイズ（テクスチャの継ぎ目が目立たないように）
  function pnoise(x, period, seed) {
    const i = Math.floor(x);
    const f = x - i;
    const a = hash((((i % period) + period) % period) + seed);
    const b = hash(((((i + 1) % period) + period) % period) + seed);
    const u = f * f * (3 - 2 * f);
    return a + (b - a) * u;
  }
  function hexRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function buildConcrete(stageIdx) {
    const P = STAGES[stageIdx].theme.interior;
    const seed = stageIdx * 1013 + 7;
    const TW = CONCRETE_TW;
    const H = GY;
    const cv = mk(TW, H);
    const c = cv.getContext('2d');
    const img = c.createImageData(TW, H);
    const [br, bg2, bb] = hexRgb(P.wall);
    const ceil = P.ceil || 18;
    for (let y = 0; y < H; y++) {
      const band = Math.floor(y / 9);
      for (let x = 0; x < TW; x++) {
        // 大きなムラ＋細かいムラ＋ザラザラ（吹き付けの凹凸）
        const n1 = pnoise(x / 24, TW / 24, seed + band * 131) * 0.6 + pnoise(x / 24, TW / 24, seed + (band + 1) * 131) * 0.4;
        const n2 = pnoise(x / 6, TW / 6, seed + 17 + Math.floor(y / 3) * 53);
        const grain = hash(x * 7919 + y * 104729 + seed);
        let k = 0.86 + (n1 - 0.5) * 0.22 + (n2 - 0.5) * 0.1;
        if (grain > 0.9) k += 0.1; // 出っ張り（明るい粒）
        else if (grain < 0.1) k -= 0.12; // くぼみ（暗い粒）
        if (y < ceil) k *= 0.42 + 0.58 * Math.pow(y / ceil, 0.7); // 天井のアーチほど暗い（低い天井ほど広く）
        const i = (y * TW + x) * 4;
        img.data[i] = Math.max(0, Math.min(255, br * k));
        img.data[i + 1] = Math.max(0, Math.min(255, bg2 * k));
        img.data[i + 2] = Math.max(0, Math.min(255, bb * k));
        img.data[i + 3] = 255;
      }
    }
    c.putImageData(img, 0, 0);
    // 天井の低い隧道：アーチの付け根の線を見せて、天井が迫ってくる感じに
    if (P.archLine) {
      c.fillStyle = 'rgba(0,0,0,0.28)';
      c.fillRect(0, 0, TW, ceil - 1);
      c.fillStyle = 'rgba(160,160,148,0.32)';
      for (let x = 0; x < TW; x++) c.fillRect(x, ceil - 1 + Math.round(pnoise(x / 40, TW / 40, seed + 9)), 1, 1);
    }

    const px = (x, y, col) => {
      c.fillStyle = col;
      c.fillRect(Math.round(x), Math.round(y), 1, 1);
    };
    // 吹き付けの層の境目（うっすら横すじ）と型枠の継ぎ目
    c.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 26; y < H; y += 22) {
      for (let x = 0; x < TW; x++) if (pnoise(x / 10, TW / 10, seed + y) > 0.35) c.fillRect(x, y + Math.round(pnoise(x / 30, TW / 30, seed + y * 3) * 2), 1, 1);
    }
    for (let x = 96; x < TW; x += 192) c.fillRect(x, 14, 1, H - 14);
    // 巻き立て（覆工）の継ぎ目
    if (P.rings) {
      c.fillStyle = 'rgba(0,0,0,0.3)';
      for (let x = 16; x < TW; x += 32) c.fillRect(x, ceil, 1, H - ceil);
      c.fillStyle = 'rgba(200,200,190,0.08)';
      for (let x = 17; x < TW; x += 32) c.fillRect(x, ceil, 1, H - ceil);
    }
    // 水のしみ・黒ずみ
    for (let i = 0; i < (P.seep || 26); i++) {
      const x = Math.floor(hash(i * 53 + seed) * (TW - 4)) + 2;
      const l = 12 + Math.floor(hash(i * 97 + seed) * 46);
      c.fillStyle = 'rgba(20,24,16,0.28)';
      c.fillRect(x, 0, 1 + (i % 3 === 0 ? 1 : 0), l);
      c.fillStyle = 'rgba(20,24,16,0.18)';
      c.fillRect(x - 1, l - 4, 3, 4);
    }
    // 白い析出物（エフロレッセンス）
    if (P.efflor) {
      for (let i = 0; i < 34; i++) {
        const x = Math.floor(hash(i * 61 + seed + 5) * (TW - 4)) + 2;
        const y0 = ceil - 6 + Math.floor(hash(i * 19 + seed) * 30);
        c.fillStyle = 'rgba(225,228,215,0.16)';
        c.fillRect(x, y0, 1, 6 + Math.floor(hash(i * 23 + seed) * 18));
        c.fillStyle = 'rgba(232,234,224,0.22)';
        c.fillRect(x - 1, y0, 3, 2);
      }
    }
    // 壁の下の苔・泥はね
    for (let i = 0; i < 140; i++) {
      const x = Math.floor(hash(i * 71 + seed) * TW);
      const y = H - 1 - Math.floor(Math.pow(hash(i * 13 + seed), 2) * 9);
      px(x, y, i % 3 ? P.moss : 'rgba(30,26,20,0.6)');
    }
    // 古い灯具（もう点かない）
    for (let x = 60; x < TW; x += 240) {
      c.fillStyle = '#55575e';
      c.fillRect(x, 22, 1, 5);
      c.fillStyle = '#3c3e44';
      c.fillRect(x - 3, 27, 7, 2);
      c.fillStyle = '#22242a';
      c.fillRect(x - 2, 29, 5, 2);
    }
    drawGraffiti(c, TW, H, seed, P.graffiti ?? 7, P.graffitiFade ?? 1);
    return cv;
  }

  /* スプレーの落書き風の模様（読める文字にはしない） */
  const SPRAY_COLORS = ['#d23a4a', '#3a7ad8', '#e8e8e0', '#46c06a', '#e8c23a', '#c050c0', '#ff8a3a'];
  function drawGraffiti(c, TW, H, seed, count = 7, fade = 1, yMin = 24, ySpan = 30) {
    let rs = seed * 9301 + 49297;
    const rnd = () => {
      rs = (rs * 9301 + 49297) % 233280;
      return rs / 233280;
    };
    const dot = (x, y, col, a = 1) => {
      c.globalAlpha = a;
      c.fillStyle = col;
      c.fillRect(Math.round(x), Math.round(y), 1, 1);
    };
    // スプレーの線（太さ＋周りの霧＋ところどころ垂れ）
    const sprayLine = (pts, col, w, alpha) => {
      for (let i = 0; i + 1 < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[i + 1];
        const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) * 1.5));
        for (let s = 0; s <= n; s++) {
          const x = x1 + ((x2 - x1) * s) / n;
          const y = y1 + ((y2 - y1) * s) / n;
          dot(x, y, col, alpha);
          if (w > 1) dot(x + 1, y, col, alpha * 0.9);
          if (rnd() < 0.18) dot(x + (rnd() * 4 - 2), y + (rnd() * 4 - 2), col, alpha * 0.35); // 霧
        }
        if (rnd() < 0.3) {
          // 垂れ
          const len = 2 + Math.floor(rnd() * 5);
          for (let d = 1; d <= len; d++) dot(x2, y2 + d, col, alpha * (1 - d / (len + 2)));
        }
      }
    };
    const blob = (cx, cy, rx, ry, col, alpha) => {
      const pts = [];
      const n = 14;
      for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        const wob = 0.8 + rnd() * 0.35;
        pts.push([cx + Math.cos(a) * rx * wob, cy + Math.sin(a) * ry * wob]);
      }
      pts[n] = pts[0];
      return pts;
    };

    for (let g = 0; g < count; g++) {
      const x0 = 30 + Math.floor(((g + rnd() * 0.6) / count) * (TW - 110));
      const y0 = yMin + Math.floor(rnd() * ySpan);
      const col = SPRAY_COLORS[Math.floor(rnd() * SPRAY_COLORS.length)];
      const col2 = SPRAY_COLORS[Math.floor(rnd() * SPRAY_COLORS.length)];
      const alpha = (0.55 + rnd() * 0.35) * fade; // 古いものほど色あせている
      const type = g % 5; // 種類がかたよらないよう順番に
      if (type === 0) {
        // 走り書きのタグ（ぐるぐるとジグザグ）
        const pts = [];
        let x = x0;
        for (let i = 0; i < 12; i++) {
          x += 2 + rnd() * 4;
          pts.push([x, y0 + (i % 2 ? -6 : 6) * (0.4 + rnd() * 0.8)]);
        }
        sprayLine(pts, col, 2, alpha);
        sprayLine([[x0 - 2, y0 + 9], [x + 4, y0 + 7 + rnd() * 3]], col, 1, alpha * 0.9); // 下線
      } else if (type === 1) {
        // ふくらんだ泡のかたまり（中は塗り残し）
        for (let b = 0; b < 3; b++) {
          const pts = blob(x0 + b * 11, y0 + (b % 2) * 3, 7, 9, col, alpha);
          c.globalAlpha = alpha * 0.35;
          c.fillStyle = col2;
          c.beginPath();
          pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
          c.fill();
          sprayLine(pts, col, 1, alpha);
        }
      } else if (type === 2) {
        // 矢印
        const x1 = x0 + 26 + rnd() * 10;
        const y1 = y0 - 6 + rnd() * 12;
        sprayLine([[x0, y0], [x1, y1]], col, 2, alpha);
        sprayLine([[x1 - 6, y1 - 5], [x1, y1], [x1 - 6, y1 + 5]], col, 2, alpha);
      } else if (type === 3) {
        // 目玉マーク（円＋点）
        const pts = blob(x0 + 8, y0, 9, 6, col, alpha);
        sprayLine(pts, col, 1, alpha);
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) dot(x0 + 8 + dx, y0 + dy, col2, alpha);
        sprayLine([[x0 - 3, y0 - 9], [x0 + 2, y0 - 6]], col, 1, alpha * 0.8);
        sprayLine([[x0 + 19, y0 - 9], [x0 + 14, y0 - 6]], col, 1, alpha * 0.8);
      } else {
        // 星・バツ印と波線
        const s = 6;
        sprayLine([[x0, y0 - s], [x0, y0 + s]], col, 1, alpha);
        sprayLine([[x0 - s, y0], [x0 + s, y0]], col, 1, alpha);
        sprayLine([[x0 - 4, y0 - 4], [x0 + 4, y0 + 4]], col, 1, alpha);
        sprayLine([[x0 + 4, y0 - 4], [x0 - 4, y0 + 4]], col, 1, alpha);
        const wave = [];
        for (let i = 0; i < 9; i++) wave.push([x0 + 10 + i * 3, y0 + 4 + Math.sin(i * 1.4) * 3]);
        sprayLine(wave, col2, 1, alpha * 0.85);
      }
    }
    c.globalAlpha = 1;
  }

  const manjiCache = {};
  function buildManji(stageIdx) {
    const P = STAGES[stageIdx].theme.interior;
    const seed = stageIdx * 1013 + 11;
    const TW = CONCRETE_TW;
    const H = GY;
    const cv = mk(TW, H);
    const c = cv.getContext('2d');
    const split = 52; // 上の壁と下の壁の境目
    // 上：卵形の天井（上ほど暗く）
    for (let y = 0; y < split; y++) {
      const k = 0.55 + 0.45 * Math.pow(y / split, 0.6);
      c.fillStyle = shade(P.upper, k);
      c.fillRect(0, y, TW, 1);
    }
    // 細かいムラ
    for (let i = 0; i < 2400; i++) {
      const x = Math.floor(hash(i * 7 + seed) * TW);
      const y = Math.floor(hash(i * 13 + seed) * split);
      c.fillStyle = i % 2 ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.05)';
      c.fillRect(x, y, 1, 1);
    }
    // 下：煉瓦調の壁
    c.fillStyle = P.lower;
    c.fillRect(0, split, TW, H - split);
    c.fillStyle = P.lowerDark;
    c.fillRect(0, split, TW, 2);
    let row = 0;
    for (let y = split + 2; y < H; y += 4, row++) {
      c.fillRect(0, y + 3, TW, 1);
      for (let x = (row % 2) * 5; x < TW; x += 10) c.fillRect(x, y, 1, 3);
    }
    // 足もとの黒ずみ
    c.fillStyle = 'rgba(0,0,0,0.25)';
    c.fillRect(0, H - 3, TW, 3);
    return cv;
  }
  function shade(hex, k) {
    const [r, g, b] = hexRgb(hex);
    return `rgb(${Math.round(r * k)},${Math.round(g * k)},${Math.round(b * k)})`;
  }
  function manjiWall(stageIdx, off, t) {
    if (!manjiCache[stageIdx]) manjiCache[stageIdx] = buildManji(stageIdx);
    const tile = manjiCache[stageIdx];
    const x0 = -(((off % CONCRETE_TW) + CONCRETE_TW) % CONCRETE_TW);
    ctx.drawImage(tile, x0, 0);
    if (x0 + CONCRETE_TW < SW) ctx.drawImage(tile, x0 + CONCRETE_TW, 0);
    // 天井の明かり（ひとつだけ、ときどき瞬く）
    const PL = 40;
    for (let k = Math.floor((off - 20) / PL); k <= Math.floor((off + SW) / PL); k++) {
      const x = k * PL - off;
      rect(x - 3, 6, 7, 2, '#6a6a66');
      const blink = hash(k * 31) > 0.85 && Math.sin(t * 13 + k) > 0.3;
      if (!blink) {
        rect(x - 2, 8, 5, 1, '#fffbe8');
        lights.push({ x, y: 12, r: 34 });
      }
    }
  }

  function komineLamps(off, t) {
    const PL = 80;
    for (let k = Math.floor((off - 20) / PL); k <= Math.floor((off + SW) / PL); k++) {
      const x = k * PL - off + 20;
      rect(x - 2, 14, 5, 2, '#4a4a48');
      // 3つに1つくらいが、オレンジ色にぼんやり点いている
      if (hash(k * 17 + 3) > 0.6) {
        const flick = Math.sin(t * 7 + k * 3) > -0.85;
        if (flick) {
          rect(x - 1, 16, 3, 1, '#ffb060');
          lights.push({ x, y: 18, r: 20 });
        }
      }
    }
  }
  function wallRail(off) {
    // 壁ぎわの手すり（細い柵）
    rect(0, GY - 11, SW, 1, '#6a6c6e');
    ctx.fillStyle = '#4a4c4e';
    for (let x = -(off % 12); x < SW; x += 12) ctx.fillRect(x, GY - 11, 1, 11);
  }

  function concreteWall(stageIdx, off) {
    if (!concreteCache[stageIdx]) concreteCache[stageIdx] = buildConcrete(stageIdx);
    const tile = concreteCache[stageIdx];
    const x0 = -(((off % CONCRETE_TW) + CONCRETE_TW) % CONCRETE_TW);
    ctx.drawImage(tile, x0, 0);
    if (x0 + CONCRETE_TW < SW) ctx.drawImage(tile, x0 + CONCRETE_TW, 0);
  }

  /* ---------- トンネル内部（旧小峰・旧吹上・旧旧吹上） ---------- */
  function interior(stageIdx, scroll, t) {
    const P = STAGES[stageIdx].theme.interior;
    const seed = stageIdx * 1013;
    const off = Math.floor(scroll * 0.9);
    if (P.wallType === 'manji') manjiWall(stageIdx, off, t);
    else if (P.wallType === 'concrete') {
      concreteWall(stageIdx, off);
      if (P.litLamps) komineLamps(off, t);
      if (P.rail) wallRail(off);
    }
    else {
    rect(0, 0, SW, GY, P.brick);
    // 煉瓦（高さ3＋目地1、幅8）
    for (let row = 0; row * 4 < GY; row++) {
      const y = row * 4;
      ctx.fillStyle = P.mortar;
      ctx.fillRect(0, y + 3, SW, 1);
      const shift = (row % 2) * 4;
      for (let bx = -((off + shift) % 8); bx < SW; bx += 8) {
        const wx = Math.floor((bx + off + shift) / 8);
        ctx.fillStyle = P.mortar;
        ctx.fillRect(bx, y, 1, 3);
        const h = hash(wx * 31 + row * 977 + seed);
        if (h > 0.62) {
          ctx.fillStyle = P.brick2;
          ctx.fillRect(bx + 1, y, 7, 3);
        } else if (h < 0.14) {
          ctx.fillStyle = 'rgba(0,0,0,0.28)';
          ctx.fillRect(bx + 1, y, 7, 3);
        }
      }
    }
    // 天井のアーチ（上ほど暗く）
    rect(0, 0, SW, 6, 'rgba(0,0,0,0.5)');
    rect(0, 6, SW, 6, 'rgba(0,0,0,0.32)');
    rect(0, 12, SW, 6, 'rgba(0,0,0,0.16)');
    // 一定間隔の補強リブ・待避所・古い灯具・しみ
    const PP = 120;
    const k0 = Math.floor((off - 60) / PP);
    const k1 = Math.floor((off + SW) / PP);
    for (let k = k0; k <= k1; k++) {
      const sx = k * PP - off;
      rect(sx, 0, 7, GY, P.rib);
      ctx.fillStyle = P.mortar;
      for (let y = 3; y < GY; y += 4) ctx.fillRect(sx, y, 7, 1);
      rect(sx, 0, 1, GY, 'rgba(0,0,0,0.35)');
      rect(sx + 6, 0, 1, GY, 'rgba(0,0,0,0.35)');
      if (P.niche && ((k % 3) + 3) % 3 === 1) {
        // 待避所（壁のくぼみ）。実物にない場合は描かない
        const nx = sx + 44;
        ctx.fillStyle = P.rib;
        for (let y = GY - 30; y < GY; y++) {
          const dy = y - (GY - 30 + 10);
          const hw = dy < 0 ? Math.floor(Math.sqrt(100 - dy * dy)) + 2 : 12;
          ctx.fillRect(nx - hw, y, hw * 2, 1);
        }
        ctx.fillStyle = '#050404';
        for (let y = GY - 28; y < GY; y++) {
          const dy = y - (GY - 28 + 8);
          const hw = dy < 0 ? Math.floor(Math.sqrt(64 - dy * dy)) : 8;
          ctx.fillRect(nx - hw, y, hw * 2, 1);
        }
      }
      if (((k % 2) + 2) % 2 === 0) {
        // 古い灯具（もう点かない）
        const lx = sx + 78;
        rect(lx, 22, 1, 5, '#55575e');
        rect(lx - 3, 27, 7, 2, '#3c3e44');
        rect(lx - 2, 29, 5, 2, '#22242a');
        rect(lx - 1, 29, 2, 1, '#6a6c62');
      }
      // しみ・水の筋
      ctx.fillStyle = P.stain;
      for (let i = 0; i < 6; i++) {
        const x = sx + 10 + Math.floor(hash(k * 53 + i + seed) * (PP - 14));
        const l = 10 + Math.floor(hash(k * 97 + i + seed) * 50);
        ctx.fillRect(x, 0, 1 + (i % 2), l);
      }
      // 壁の下の苔
      ctx.fillStyle = P.moss;
      for (let i = 0; i < 14; i++) {
        const x = sx + Math.floor(hash(k * 71 + i * 3 + seed) * PP);
        ctx.fillRect(x, GY - 1 - Math.floor(hash(k * 13 + i + seed) * 6), 2, 1);
      }
    }
    }
    // 床（濡れた路面）
    rect(0, GY, SW, SH - GY, P.floor);
    rect(0, GY, SW, 2, P.floorTop);
    rect(0, GY + 2, SW, 1, 'rgba(0,0,0,0.45)');
    const off2 = Math.floor(scroll);
    for (let k = Math.floor((off2 - 40) / 70); k <= Math.floor((off2 + SW) / 70); k++) {
      const x = k * 70 - off2 + Math.floor(hash(k * 7 + seed) * 30);
      const y = GY + 6 + Math.floor(hash(k * 11 + seed) * 10);
      const w = 12 + Math.floor(hash(k * 13 + seed) * 18);
      rect(x, y, w, 2, P.puddle);
      rect(x + 2, y + 1, w - 4, 1, P.puddle);
      const sh = Math.floor((t * 3 + k) % w);
      rect(x + sh, y, 2, 1, 'rgba(180,200,230,0.25)');
      ctx.fillStyle = P.floorTop;
      ctx.fillRect(x + w + 10, GY + 4 + Math.floor(hash(k * 17 + seed) * 14), 1, 1);
    }
    // 狭い隧道：手前の側溝と縁石で通路を狭く見せる
    if (P.narrow) {
      rect(0, SH - 7, SW, 7, 'rgba(0,0,0,0.45)');
      rect(0, SH - 8, SW, 1, 'rgba(130,130,120,0.18)');
    }
    // 天井からの水滴
    for (let i = 0; i < 4; i++) {
      const x = Math.floor((((i * 53 + 20 - off) % SW) + SW) % SW);
      const dy = (t * 45 + i * 37) % (GY + 30);
      if (dy < GY + 4) rect(x, dy, 1, 2, 'rgba(150,180,215,0.6)');
    }
  }

  /* ---------- 暗闇と懐中電灯（ゆらの周囲を丸く照らす） ---------- */
  function pxCirc(c, cx, cy, r) {
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt(r * r - dy * dy) + 0.5);
      c.fillRect(Math.round(cx - hw), Math.round(cy + dy), hw * 2 + 1, 1);
    }
  }
  function darkness(th, v) {
    let darkCol = th.interior ? th.interior.dark : th.dark;
    const E = v.env || NIGHT_ENV;
    const outdoor = !th.interior;
    if (outdoor && (E.day > 0 || E.warm > 0)) {
      // 昼は暗闇をほとんど消し、夕方は少しだけ残す。雨やくもりの昼は少し暗め
      const m = darkCol.match(/rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/);
      if (m) {
        const keep = Math.max(1 - 0.9 * E.day + 0.25 * E.warm * E.day + 0.12 * E.cloud * E.day, 0.08);
        darkCol = `rgba(${m[1]},${m[2]},${m[3]},${(+m[4] * Math.min(1, keep)).toFixed(3)})`;
      }
    }
    dctx.globalCompositeOperation = 'source-over';
    dctx.clearRect(0, 0, SW, SH);
    dctx.fillStyle = darkCol;
    dctx.fillRect(0, 0, SW, SH);
    dctx.globalCompositeOperation = 'destination-out';
    const R = v.lightR * (v.flicker ? 0.55 : 1);
    const L0 = lightCenter(v);
    // 段階的な光の輪（ドット絵らしく、なめらかにしない）
    [[1, 0.25], [0.8, 0.3], [0.62, 0.4], [0.45, 0.65], [0.3, 0.8]].forEach(([f, a]) => {
      dctx.fillStyle = `rgba(0,0,0,${a})`;
      pxCirc(dctx, L0.x, L0.y, Math.round(R * f));
    });
    for (const L of lights) {
      const g3 = dctx.createRadialGradient(L.x, L.y, 0, L.x, L.y, L.r);
      g3.addColorStop(0, 'rgba(0,0,0,0.9)');
      g3.addColorStop(1, 'rgba(0,0,0,0)');
      dctx.fillStyle = g3;
      dctx.fillRect(L.x - L.r, L.y - L.r, L.r * 2, L.r * 2);
    }
    dctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(dark, 0, 0);
    // 懐中電灯のあたたかい色（昼の外ではほとんど見えない）
    if (outdoor && E.day > 0.6) return;
    ctx.fillStyle = 'rgba(255,225,160,0.05)';
    pxCirc(ctx, L0.x, L0.y, Math.round(R * 0.8));
    ctx.fillStyle = 'rgba(255,225,160,0.04)';
    pxCirc(ctx, L0.x, L0.y, Math.round(R * 0.5));
  }

  function ghost(g, t) {
    if (!g) return;
    const def = GHOSTS.find((d) => d.id === g.type) || GHOSTS[0];
    const img = Sprites.ghost(def.id);
    let a = Math.min(1, g.age / 0.8, (g.life - g.age) / 0.8);
    if (g.caught) a = Math.max(0, 1 - g.caughtT / 0.6);
    a *= 0.7 + 0.25 * Math.sin(t * 5);
    if (a <= 0) return;
    const x = Math.round(g.x);
    const y = Math.round(g.y + Math.sin(t * 2) * 3);
    const R = Math.round(Math.max(img.width, img.height) * 0.75);
    ctx.globalAlpha = a * 0.12;
    circ(x + img.width / 2, y + img.height / 2, R, def.glow);
    ctx.globalAlpha = a * 0.16;
    circ(x + img.width / 2, y + img.height / 2, Math.round(R * 0.65), def.glow);
    ctx.globalAlpha = a;
    ctx.drawImage(img, x, y);
    ctx.globalAlpha = 1;
  }

  /* ---------- ゆら ---------- */
  function drawYura(v) {
    const img = Sprites.yuraImage();
    let src, w, h;
    if (img) {
      src = img;
      w = img.width;
      h = img.height;
    } else {
      const f = Sprites.yura();
      src = (v.blink ? f.walkBlink : f.walk)[v.frame % 4];
      w = 96;
      h = 96;
    }
    const lift = Math.max(0, -v.yuraDy);
    const sw = Math.max(18, 44 - lift * 2);
    mctx.fillStyle = 'rgba(0,0,0,0.35)';
    mctx.fillRect(Math.round(YURA_CX * SCALE - sw / 2), GY * SCALE + 1, sw, 4);
    // 足もとを軸に左右へ傾ける（よちよち歩き）
    const px = Math.round(YURA_CX * SCALE);
    const py = GY * SCALE + 3 + Math.round(v.yuraDy);
    mctx.save();
    mctx.translate(px, py);
    if (v.yuraTilt) mctx.rotate((v.yuraTilt * Math.PI) / 180);
    mctx.drawImage(src, -Math.round(w / 2), -h, w, h);
    mctx.restore();
  }

  // 懐中電灯の光の中心（体の傾きとバウンドに合わせて少し揺れる）
  function lightCenter(v) {
    const tilt = v.yuraTilt || 0;
    return {
      x: YURA_CX + (tilt / 2) * LIGHT_SWAY,
      y: YURA_LY + (v.yuraDy || 0) / SCALE,
    };
  }

  /* ---------- 仲間（ゆらのまわりに小さく表示） ---------- */
  // x は低解像度での中心位置（ゆらからの距離）、ph は歩調のずれ
  // flip: 元のイラストが左向きなので、左右反転して進む向き（右）に向かせる
  const COMP_POS = {
    kohai: { x: -31, ph: 1.2, tilt: 1.5 },
    vet: { x: 33, ph: 2.1, tilt: 1.2, flip: true },
    cat: { x: -15, ph: 0.6, tilt: 3, flip: true },
  };
  function drawComp(id, v) {
    const pos = COMP_POS[id];
    const walkW = v.walkW || 0;
    const gait = (v.gait || 0) + pos.ph;
    const pic = Sprites.compImage(id);
    const frame = !pic && id === 'cat' && walkW > 0.3 ? (Math.floor(gait / Math.PI) & 1) : 0;
    const img = pic || Sprites.comp(id, frame);
    const sc = pic ? 1 : SCALE; // 画像版はゆらと同じく等倍
    let dy = -Math.abs(Math.cos(gait)) * (id === 'cat' ? 3 : 2) * walkW;
    dy += Math.sin((v.t || 0) * 2 + pos.ph) * 1 * (1 - walkW);
    if (id === 'cat' && v.catHop > 0) dy -= Math.sin((1 - v.catHop / 0.5) * Math.PI) * 9;
    const w = img.width * sc;
    const h = img.height * sc;
    const cx = (YURA_CX + pos.x) * SCALE;
    mctx.fillStyle = 'rgba(0,0,0,0.3)';
    mctx.fillRect(Math.round(cx - w * 0.35), GY * SCALE + 1, Math.round(w * 0.7), 3);
    // 足もとを軸に、歩調に合わせて小さく傾ける
    const tilt = Math.sin(gait) * pos.tilt * walkW;
    mctx.save();
    mctx.translate(Math.round(cx), Math.round(GY * SCALE + 3 + dy));
    if (tilt) mctx.rotate((tilt * Math.PI) / 180);
    if (pic && pos.flip) mctx.scale(-1, 1);
    mctx.drawImage(img, -Math.round(w / 2), -h, w, h);
    mctx.restore();
    // 暗闇の中でも仲間が見えるように少し照らす（ゲンさんは帽子のヘッドライト）
    const lx = YURA_CX + pos.x;
    if (id === 'vet') lights.push({ x: lx - 4, y: GY - h / SCALE + 6, r: 18 });
    else lights.push({ x: lx, y: GY - h / SCALE / 2, r: id === 'cat' ? 9 : 13 });
  }
  function drawCompanions(v, front) {
    const c = v.comps || {};
    if (!front) {
      if (c.kohai) drawComp('kohai', v);
      if (c.vet) drawComp('vet', v);
    } else if (c.cat) drawComp('cat', v);
  }

  /* ---------- メイン描画 ---------- */
  function render(v) {
    const stage = STAGES[v.stage];
    const th = stage.theme;
    const t = v.t;
    lights = [];

    // 背景（低解像度）
    const E = v.env || NIGHT_ENV;
    const outdoor = !th.interior;
    ctx = bg.getContext('2d');
    if (!outdoor) interior(v.stage, v.scroll, t);
    else if (E.day < 0.01 && E.warm < 0.01 && E.cloud < 0.15) {
      sky(th, t, E);
      terrain(v.stage, v.scroll, t);
    } else {
      // 景色だけを描いて色を調整してから、空をうしろに敷く
      const bctx = ctx;
      bctx.clearRect(0, 0, SW, SH);
      terrain(v.stage, v.scroll, t);
      grade(bctx, E);
      ctx = skyC.getContext('2d');
      sky(th, t, E);
      ctx = bctx;
      bctx.globalCompositeOperation = 'destination-over';
      bctx.drawImage(skyC, 0, 0);
      bctx.globalCompositeOperation = 'source-over';
    }
    if (outdoor && E.rain > 0 && E.kind !== 'snow') wetGround(E, v.scroll);
    fog(th, t, outdoor ? E : NIGHT_ENV); // トンネルの中は天気で霧を濃くしない
    mctx.drawImage(bg, 0, 0, MW, MH);

    // 仲間とゆら（高解像度）
    drawCompanions(v, false);
    drawYura(v);
    drawCompanions(v, true);

    // 暗闇・演出（低解像度）
    ctx = fx.getContext('2d');
    ctx.clearRect(0, 0, SW, SH);
    darkness(th, v);
    if (!v.calm) hitodama(t, v.stage, outdoor ? E.day : 0);
    ghost(v.ghost, t);
    if (outdoor) foreground(v.scroll, E);
    if (outdoor && E.rain > 0) precip(E, t);
    // 雷：外だけ空がまっ白に光る（トンネルの中は変わらない）
    if (outdoor && v.bolt > 0) {
      ctx.fillStyle = `rgba(225,232,255,${(v.bolt * 0.55).toFixed(3)})`;
      ctx.fillRect(0, 0, SW, SH);
    }
    ctx.globalAlpha = outdoor ? 1 - 0.55 * E.day : 1;
    ctx.drawImage(vignette, 0, 0);
    ctx.globalAlpha = 1;
    if (v.miniFlash > 0) {
      ctx.globalAlpha = v.miniFlash;
      const dark = v.flashColor === 'black'; // まぶしさを抑える「黒」フラッシュ
      circ(YURA_CAM.x, YURA_CAM.y, 14, dark ? 'rgba(0,0,0,0.5)' : 'rgba(255,255,240,0.5)');
      circ(YURA_CAM.x, YURA_CAM.y, 5, dark ? '#000000' : '#ffffff');
      ctx.globalAlpha = 1;
    }
    if (v.flash > 0) {
      ctx.fillStyle = v.flashColor === 'black' ? `rgba(0,0,0,${v.flash.toFixed(3)})` : `rgba(255,255,255,${v.flash.toFixed(3)})`;
      ctx.fillRect(0, 0, SW, SH);
    }
    if (v.fade > 0) {
      ctx.fillStyle = `rgba(0,0,0,${v.fade.toFixed(3)})`;
      ctx.fillRect(0, 0, SW, SH);
    }
    mctx.drawImage(fx, 0, 0, MW, MH);
  }

  /* ---------- スポット一覧のサムネイル ---------- */
  const thumbCache = {};
  function thumb(i, silhouette) {
    const key = i + (silhouette ? 's' : 'c');
    if (thumbCache[key]) return thumbCache[key];
    const prev = ctx;
    const prevLights = lights;
    lights = [];
    const out = mk(SW, SH);
    const th = STAGES[i].theme;
    if (!silhouette && th.interior) {
      // 内部：中央だけ懐中電灯で照らされたように
      ctx = out.getContext('2d');
      interior(i, 0, 0);
      const g = ctx.createRadialGradient(SW / 2, GY - 16, 10, SW / 2, GY - 16, SW * 0.55);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.85)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SW, SH);
    } else if (!silhouette) {
      ctx = out.getContext('2d');
      sky(th, 0);
      terrain(i, 0, 0);
      fog(th, 0);
      ctx.fillStyle = 'rgba(0,0,12,0.2)';
      ctx.fillRect(0, 0, SW, SH);
    } else {
      // 奥（山並み）と手前（建物・地面）を別の濃さのシルエットにする
      const silLayer = (draw, col) => {
        const lay = mk(SW, SH);
        ctx = lay.getContext('2d');
        draw();
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = col;
        ctx.fillRect(0, 0, SW, SH);
        ctx.globalCompositeOperation = 'source-over';
        return lay;
      };
      const far = silLayer(() => terrainFar(i, 0), '#2a2150');
      SIL = true;
      const near = silLayer(() => terrainNear(i, 0, 0), '#07060c');
      SIL = false;
      ctx = out.getContext('2d');
      const g = ctx.createLinearGradient(0, 0, 0, SH);
      g.addColorStop(0, '#1c1636');
      g.addColorStop(0.6, '#4a3a78');
      g.addColorStop(1, '#6a58a0');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SW, SH);
      ctx.drawImage(far, 0, 0);
      ctx.drawImage(near, 0, 0);
    }
    ctx.drawImage(vignette, 0, 0);
    thumbCache[key] = out.toDataURL();
    ctx = prev;
    lights = prevLights;
    return thumbCache[key];
  }

  return { init, render, thumb, fallsNear };
})();
