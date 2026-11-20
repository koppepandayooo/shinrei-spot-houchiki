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
  let bg, fx, dark, dctx, vignette;
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

  /* ---------- 空 ---------- */
  function sky(th, t) {
    const bands = th.sky;
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
      const a = 0.35 + 0.35 * Math.sin(t * (1 + hash(i) * 2) + i);
      ctx.fillStyle = `rgba(230,235,255,${a.toFixed(2)})`;
      ctx.fillRect(x, y, 1, 1);
    }
    if (th.moon !== false) {
      circ(160, 16, 12, 'rgba(230,225,190,0.05)');
      circ(160, 16, 9, 'rgba(230,225,190,0.06)');
      circ(160, 16, 6, '#e8e4c9');
      circ(163, 14, 5, bands[0]);
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

  function foreground(scroll) {
    const off = Math.floor(scroll * 1.35);
    ctx.fillStyle = '#05050a';
    for (let x = 0; x < SW; x++) {
      const wx = x + off;
      const n = noise1(wx * 0.08, 77);
      if (n < 0.55) continue;
      const h = Math.floor((n - 0.55) * 18) + (hash(wx) > 0.7 ? 2 : 0);
      ctx.fillRect(x, SH - h, 1, h);
    }
  }

  /* ---------- トンネル（旧小峰：コンクリート／吹上：レンガ） ---------- */
  function tunnelPortal(k, sx, th, brick, t) {
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
    if (brick) {
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
    if (m === 0) tunnelPortal(k, sx, th, false, t);
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
  function ruins(cx, base, th) {
    // 礎石（お堂の柱が立っていた石）が並ぶ
    for (let row = 0; row < 2; row++) {
      for (let i = -3; i <= 3; i++) {
        const x = cx + i * 8 + (row ? 4 : 0);
        const y = base - 2 - row * 2;
        rect(x - 2, y, 5, 2, th.stoneDark);
        rect(x - 2, y, 5, 1, th.stone);
      }
    }
    // 石碑（文字は読めない）
    rect(cx - 4, base - 3, 8, 3, th.stoneDark);
    rect(cx - 3, base - 19, 6, 16, th.stone);
    rect(cx - 3, base - 20, 6, 1, '#7c7a82');
    rect(cx - 1, base - 16, 2, 10, th.stoneDark);
    // お地蔵さま
    jizo(cx + 16, th, base);
    jizo(cx + 24, th, base);
    // 草むら
    ctx.fillStyle = '#1d2a1c';
    for (let i = 0; i < 16; i++) ctx.fillRect(Math.round(cx - 28 + i * 3.7), base - 1 - (i % 3), 2, 1 + (i % 3));
  }
  // 公園のベンチ
  function bench(x, th) {
    x = Math.round(x);
    rect(x, GY - 7, 16, 2, '#4a3526');
    rect(x, GY - 11, 16, 2, '#4a3526');
    rect(x + 1, GY - 5, 1, 5, '#2a2a30');
    rect(x + 14, GY - 5, 1, 5, '#2a2a30');
    rect(x + 1, GY - 11, 1, 4, '#2a2a30');
    rect(x + 14, GY - 11, 1, 4, '#2a2a30');
  }
  function doryodo(k, sx, th, t) {
    if (k % 2 === 0) {
      const cx = sx + 44;
      for (let i = 0; i < 6; i++) {
        const w = 40 - i * 3;
        rect(cx - w / 2, GY - (i + 1) * 3, w, 3, i % 2 ? th.stone : th.stoneDark);
        rect(cx - w / 2, GY - (i + 1) * 3, w, 1, '#7c7a82');
      }
      rect(cx - 30, GY - 21, 60, 3, th.stoneDark);
      ruins(cx, GY - 21, th);
      lantern(sx, th, t, k);
      lantern(sx + 88, th, t, k + 1);
    } else {
      const x = sx + 20;
      rect(x - 3, GY - 40, 6, 40, '#1a1416');
      rect(x - 6, GY - 3, 12, 3, '#1a1416');
      circ(x, GY - 46, 16, th.midTree);
      circ(x - 10, GY - 38, 10, th.midTree);
      circ(x + 11, GY - 40, 11, th.midTree);
      rect(x - 3, GY - 26, 6, 1, '#c9b98a');
      rect(x - 1, GY - 25, 1, 3, '#e8e4d8');
      jizo(sx + 44, th);
      jizo(sx + 54, th);
      bench(sx + 72, th);
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
          const v = (y + Math.floor(t * 42) + i * 3) % 5;
          ctx.fillStyle = v === 0 ? '#eef6ff' : v < 3 ? '#9cc4ea' : '#6290c0';
          ctx.fillRect(x0 + i, y, 1, 1);
        }
      }
    };
    rect(fx - 8, top - 2, 15, 3, '#3a4352');
    fallCol(fx - 5, 8, top, ledge); // 上段
    rect(fx - 5, top, 8, 1, '#eef6ff');
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
    // 立て札と小さな石碑
    rect(sx + 84, GY - 14, 1, 14, '#4a3526');
    rect(sx + 79, GY - 19, 11, 6, '#5a4430');
    rect(sx + 81, GY - 17, 7, 1, '#2e2118');
    rect(sx + 81, GY - 15, 5, 1, '#2e2118');
    rect(sx + 93, GY - 10, 5, 10, '#55545a');
    rect(sx + 94, GY - 11, 3, 1, '#55545a');
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

  const LANDMARKS = { komine, doryodo, hachioji, fukiage };

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
    drawRivers(t);
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

  function fog(th, t) {
    for (let i = 0; i < 7; i++) {
      const x = Math.floor(((i * 67 + t * (3 + i)) % (SW + 70)) - 50);
      const y = Math.floor(GY - 10 + Math.sin(t * 0.4 + i) * 3 + (i % 3) * 4);
      ctx.fillStyle = `rgba(${th.fog},0.07)`;
      ctx.fillRect(x, y, 46, 3);
      ctx.fillRect(x + 6, y - 2, 32, 2);
      ctx.fillRect(x + 10, y + 3, 26, 2);
    }
  }

  function hitodama(t, stageIdx) {
    const n = 1 + Math.min(stageIdx, 2);
    for (let i = 0; i < n; i++) {
      const cyc = (t * 0.05 + i * 0.37) % 1;
      const a = Math.max(0, Math.sin(cyc * Math.PI)) * (0.6 + 0.4 * Math.sin(t * 7 + i));
      if (a < 0.05) continue;
      const x = Math.round(SW - cyc * (SW + 20) + Math.sin(t * 1.5 + i) * 6);
      const y = Math.round(30 + i * 9 + Math.sin(t * 2 + i * 3) * 5);
      ctx.globalAlpha = a;
      for (let j = 1; j <= 4; j++) rect(x + j * 2, y + Math.round(Math.sin(t * 6 - j) * 1), 2, 1, '#4fa6e0');
      circ(x, y, 2, '#8fd0ff');
      rect(x, y, 1, 1, '#ffffff');
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
  function drawGraffiti(c, TW, H, seed, count = 7, fade = 1) {
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
      const y0 = 24 + Math.floor(rnd() * 30);
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
    if (P.wallType === 'concrete') concreteWall(stageIdx, off);
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
    const darkCol = th.interior ? th.interior.dark : th.dark;
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
    // 懐中電灯のあたたかい色
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
    ctx = bg.getContext('2d');
    if (th.interior) interior(v.stage, v.scroll, t);
    else {
      sky(th, t);
      terrain(v.stage, v.scroll, t);
    }
    fog(th, t);
    mctx.drawImage(bg, 0, 0, MW, MH);

    // 仲間とゆら（高解像度）
    drawCompanions(v, false);
    drawYura(v);
    drawCompanions(v, true);

    // 暗闇・演出（低解像度）
    ctx = fx.getContext('2d');
    ctx.clearRect(0, 0, SW, SH);
    darkness(th, v);
    if (!v.calm) hitodama(t, v.stage);
    ghost(v.ghost, t);
    if (!th.interior) foreground(v.scroll);
    ctx.drawImage(vignette, 0, 0);
    if (v.miniFlash > 0) {
      ctx.globalAlpha = v.miniFlash;
      circ(YURA_CAM.x, YURA_CAM.y, 14, 'rgba(255,255,240,0.5)');
      circ(YURA_CAM.x, YURA_CAM.y, 5, '#ffffff');
      ctx.globalAlpha = 1;
    }
    if (v.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${v.flash.toFixed(3)})`;
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
