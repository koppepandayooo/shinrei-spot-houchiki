'use strict';
/* =========================================================
 * ドット絵スプライト
 *  - ゆら：64x64 をパーツ（髪・顔・服…）ごとに描いて、
 *          パーツごとに濃紺の輪郭線をつけて重ねる方式で生成
 *  - 幽霊・アイコン：1文字 = 1ピクセルの文字マップ（'.' は透明）
 * ========================================================= */

/* ---------- ゆらの色 ---------- */
const YC = {
  OUT: '#1a1d4a', // 輪郭（濃い紺）
  H0: '#ffffff', H1: '#e8edf7', H2: '#b4cdee', H3: '#7f9fd6', // 銀髪（影は水色系）
  S1: '#ffe4d2', S2: '#f3c2a8', // 肌
  CH: '#ff9db0', CL: '#ffc8d2', // チーク
  MO: '#c8485e', // 口
  E1: '#1c2766', E2: '#2f5bb5', E3: '#4f94e6', E4: '#9fdcff', EW: '#ffffff', // 瞳
  R1: '#e33a52', R2: '#a51f3a', R3: '#ff8595', // リボン
  J1: '#9b7646', J2: '#6f5232', J3: '#c19a63', // ジャケット
  W1: '#f4f1ea', W2: '#cfcbe0', // シャツ
  C1: '#2b2d3c', C2: '#50546a', CL1: '#7cc0f4', // カメラ
  ST: '#5a3828', // ストラップ
  P1: '#3d4577', P2: '#2a3058', // ショートパンツ
  K1: '#f4f1ea', // 靴下
  B1: '#6e4329', B2: '#4a2a19', B3: '#94603d', // ブーツ
  F1: '#cdd2de', F2: '#8c93a8', F3: '#fff4a8', // 懐中電灯
};

/**
 * ゆらの1コマを生成する
 * @param {number} frame 0..3（歩行）
 * @param {boolean} blink まばたき
 * @returns {string[]} 64*64 の色配列（null は透明）
 */
function buildYuraPixels(frame, blink) {
  const W = 64;
  const H = 64;
  const C = YC;
  const main = new Array(W * H).fill(null);
  let cur = main;

  const inb = (x, y) => x >= 0 && y >= 0 && x < W && y < H;
  const val = (col, x, y, t) => (typeof col === 'function' ? col(x, y, t) : col);
  const set = (x, y, c) => {
    x = Math.round(x);
    y = Math.round(y);
    if (c && inb(x, y)) cur[y * W + x] = c;
  };
  const rect = (x, y, w, h, col) => {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) set(i, j, val(col, i, j));
  };
  const ell = (cx, cy, rx, ry, col) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1) set(x, y, val(col, x, y));
      }
    }
  };
  const poly = (pts, col) => {
    let minY = Infinity;
    let maxY = -Infinity;
    pts.forEach((p) => {
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    });
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + 0.5;
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i];
        const [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= yc && y2 > yc) || (y2 <= yc && y1 > yc)) xs.push(x1 + ((yc - y1) * (x2 - x1)) / (y2 - y1));
      }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] - 0.5); x++) set(x, y, val(col, x, y));
      }
    }
  };
  // 太さが変わる線（髪の房・腕など）
  const stroke = (pts, r0, r1, col) => {
    const lens = [];
    let total = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]);
      lens.push(l);
      total += l;
    }
    let acc = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      const steps = Math.max(1, Math.ceil(lens[i] * 2));
      for (let s = 0; s <= steps; s++) {
        const f = s / steps;
        const t = (acc + lens[i] * f) / total;
        const r = r0 + (r1 - r0) * t;
        const px = x1 + (x2 - x1) * f;
        const py = y1 + (y2 - y1) * f;
        for (let y = Math.floor(py - r); y <= Math.ceil(py + r); y++) {
          for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
            if ((x - px) * (x - px) + (y - py) * (y - py) <= r * r) set(x, y, val(col, x, y, t));
          }
        }
      }
      acc += lens[i];
    }
  };
  // パーツを別レイヤーに描き、外周に輪郭線をつけて合成
  const layer = (fn, outline = true) => {
    cur = new Array(W * H).fill(null);
    fn();
    const L = cur;
    cur = main;
    if (outline) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (L[i]) continue;
          if ((x > 0 && L[i - 1]) || (x < W - 1 && L[i + 1]) || (y > 0 && L[i - W]) || (y < H - 1 && L[i + W])) main[i] = C.OUT;
        }
      }
    }
    for (let i = 0; i < L.length; i++) if (L[i]) main[i] = L[i];
  };
  const mirrorPts = (pts) => pts.map(([x, y]) => [64 - x, y]);

  const dy = frame % 2 === 1 ? 1 : 0; // 上半身の上下ゆれ
  const sway = [0, 1, 0, -1][frame]; // ツインテールのゆれ
  const swing = [-1, 0, 1, 0][frame]; // 左腕のふり
  const lift = [[2, 0], [0, 0], [0, 2], [0, 0]][frame]; // 足の持ち上げ [左, 右]

  /* --- ツインテール（後ろ） --- */
  layer(() => {
    const tail = (mir) => {
      const swayOff = [0, 0, 0, 0.5, 1, 1];
      let p = [[16, 12], [11, 19], [8, 28], [8, 37], [10, 45], [13, 51]];
      if (mir) p = mirrorPts(p);
      p = p.map(([x, y], i) => [x + sway * swayOff[i], y + dy]);
      stroke(p, 5, 1.3, (x, y, t) => (t > 0.78 ? C.H3 : C.H2));
      const inner = p.map(([x, y]) => [x + (mir ? -1 : 1), y - 0.5]);
      stroke(inner, 3.2, 0.5, (x, y, t) => (t < 0.72 ? C.H1 : C.H2));
      stroke(inner.slice(0, 3).map(([x, y]) => [x + (mir ? -0.8 : 0.8), y]), 0.9, 0.6, C.H0);
    };
    tail(false);
    tail(true);
  });

  /* --- 足 --- */
  const leg = (x0, lf) => {
    layer(() => {
      const by = 63 - lf;
      rect(x0, 49, 5, by - 8 - 49, (x) => (x === x0 + 4 ? C.S2 : C.S1));
      rect(x0, by - 8, 5, 2, (x, y) => (y === by - 7 ? C.W2 : C.K1));
      rect(x0 - 1, by - 6, 7, 6, (x, y) => (y === by - 6 ? C.B3 : x >= x0 + 4 ? C.B2 : C.B1));
      rect(x0 + 6, by - 3, 2, 3, C.B1);
      rect(x0 - 1, by, 9, 1, C.B2);
    });
  };
  leg(26, lift[0]);
  leg(34, lift[1]);

  /* --- ショートパンツ --- */
  layer(() => {
    poly([[23, 45 + dy], [41, 45 + dy], [42, 52], [33.5, 52], [32, 50], [30.5, 52], [22, 52]], (x, y) =>
      y >= 51 || x >= 38 ? C.P2 : C.P1
    );
  });

  /* --- 首 --- */
  layer(() => rect(29, 32 + dy, 7, 6, C.S2));

  /* --- 胴（ジャケット＋シャツ） --- */
  layer(() => {
    poly([[23, 36 + dy], [41, 36 + dy], [43, 48 + dy], [21, 48 + dy]], (x, y) =>
      y >= 47 + dy ? C.J2 : x >= 39 ? C.J2 : x <= 23 ? C.J3 : C.J1
    );
    poly([[28.5, 36 + dy], [35.5, 36 + dy], [34.5, 47 + dy], [29.5, 47 + dy]], (x) => (x >= 34 ? C.W2 : C.W1));
    poly([[27.5, 36 + dy], [30, 36 + dy], [31.5, 43 + dy]], C.J3);
    poly([[34, 36 + dy], [36.5, 36 + dy], [32.5, 43 + dy]], C.J1);
    rect(23, 44 + dy, 5, 1, C.J2);
    rect(37, 44 + dy, 4, 1, C.OUT);
  });

  /* --- 左腕（画面左） --- */
  layer(() => {
    const hx = 20 + swing;
    stroke([[23.5, 38 + dy], [21 + swing * 0.6, 45 + dy]], 2.8, 2.3, (x) => (x <= 20 + swing * 0.6 ? C.J3 : C.J1));
    rect(Math.round(19 + swing * 0.6), 45 + dy, 5, 1, C.J2);
    ell(hx + 0.5, 47.5 + dy, 2.2, 2.2, C.S1);
  });

  /* --- カメラとストラップ --- */
  layer(() => {
    for (let i = 0; i <= 4; i++) {
      set(29 - i * 0.3, 36 + dy + i, C.ST);
      set(35 + i * 0.3, 36 + dy + i, C.ST);
    }
  }, false);
  layer(() => {
    rect(27, 40 + dy, 11, 6, (x, y) => (y === 40 + dy ? C.C2 : C.C1));
    ell(32, 43 + dy, 2.4, 2.4, (x, y) => (x <= 31 && y <= 42 + dy ? C.EW : C.CL1));
    rect(35, 41 + dy, 2, 1, '#e8e8f0');
    rect(28, 39 + dy, 3, 1, C.C1);
  });

  /* --- 顔 --- */
  const faceIn = (x, y) => {
    const dx = (x - 32) / 12.5;
    const ddy = (y - (24 + dy)) / 10.5;
    return dx * dx + ddy * ddy <= 1;
  };
  const bangEnd = (x) => {
    const cs = [20, 25, 30, 34, 39, 44];
    const d = Math.min(...cs.map((c) => Math.abs(x - c)));
    return Math.max(12, Math.round(18 - d * 1.5)) + dy;
  };
  layer(() => {
    ell(32, 24 + dy, 12.5, 10.5, (x, y) => {
      if (y <= bangEnd(x) + 1) return C.S2; // 前髪の影
      if (x >= 42) return C.S2;
      return C.S1;
    });
  });

  /* --- 髪（後ろ髪＋前髪＋サイドの毛束） --- */
  layer(() => {
    const hairCol = (x, y) => {
      const yy = y - dy;
      const ring = Math.abs(((x - 31) / 12.5) ** 2 + ((yy - 10.5) / 5.5) ** 2 - 1) < 0.17 && yy < 11 && yy > 4;
      if (ring) return C.H0;
      if (faceIn(x, y) && y >= bangEnd(x) - 1) return C.H2;
      if (x <= 18 || x >= 46) return yy > 26 ? C.H3 : C.H2;
      if (yy >= 27) return C.H2;
      if ((x === 23 || x === 40) && yy >= 6 && yy <= 11) return C.H2;
      return C.H1;
    };
    // 後ろ髪＋前髪
    for (let y = 0; y < 40; y++) {
      for (let x = 10; x < 54; x++) {
        const dx = (x - 32) / 17;
        const ddy = (y - (19 + dy)) / 15;
        if (dx * dx + ddy * ddy > 1) continue;
        if (faceIn(x, y) && y > bangEnd(x)) continue;
        set(x, y, hairCol(x, y));
      }
    }
    // アホ毛
    stroke([[31, 5 + dy], [32, 2 + dy], [35, 0.6 + dy]], 1, 0.6, C.H1);
    // サイドの毛束
    const lock = [[17, 15], [22, 18], [22.5, 31], [20, 37], [17, 32]].map(([x, y]) => [x, y + dy]);
    poly(lock, (x, y) => (x >= 21 ? C.H2 : y - dy > 30 ? C.H2 : C.H1));
    poly(mirrorPts(lock), (x, y) => (x <= 43 ? C.H2 : y - dy > 30 ? C.H3 : C.H2));
  });

  /* --- 目・ほっぺ・口（輪郭なしで直接描く） --- */
  const eye = (x0, right) => {
    const y0 = 20 + dy;
    if (blink) {
      set(x0, y0 + 4, C.OUT);
      set(x0 + 6, y0 + 4, C.OUT);
      rect(x0 + 1, y0 + 5, 5, 1, C.OUT);
      set(right ? x0 + 7 : x0 - 1, y0 + 3, C.OUT);
      return;
    }
    rect(x0 - 1, y0, 9, 1, C.OUT); // 上まぶた
    set(right ? x0 + 8 : x0 - 2, y0 - 1, C.OUT); // まつげ
    set(right ? x0 + 7 : x0 - 1, y0 + 1, C.OUT);
    const rows = [C.E1, C.E1, C.E2, C.E2, C.E3, C.E3, C.E4];
    rows.forEach((c, i) => {
      const inset = i === 6 ? 1 : 0;
      rect(x0 + inset, y0 + 1 + i, 7 - inset * 2, 1, c);
    });
    rect(x0 + 2, y0 + 3, 3, 3, C.E1); // 瞳孔
    rect(x0 + 2, y0 + 8, 3, 1, C.OUT); // 下まつげ
    // ハイライト
    rect(x0 + 1, y0 + 2, 2, 2, C.EW);
    set(x0 + 1, y0 + 4, C.EW);
    set(x0 + 5, y0 + 6, C.EW);
    set(x0 + 4, y0 + 2, '#d8ecff');
  };
  eye(22, false);
  eye(36, true);
  // チーク
  const cheek = (x0) => {
    rect(x0, 29 + dy, 4, 2, C.CH);
    set(x0 + 1, 29 + dy, C.CL);
  };
  cheek(22);
  cheek(39);
  set(32, 29 + dy, C.S2); // 鼻
  rect(31, 31 + dy, 3, 1, C.MO); // 口
  set(32, 32 + dy, '#e07a8a');

  /* --- 赤いリボン --- */
  layer(() => {
    const bow = (mir) => {
      const m = (pts) => (mir ? mirrorPts(pts) : pts).map(([x, y]) => [x, y + dy]);
      const col = (x, y) => {
        const yy = y - dy;
        if (yy <= 9) return C.R3;
        return yy >= 15 ? C.R2 : C.R1;
      };
      poly(m([[15, 12], [10, 8], [9.5, 15], [12.5, 14.5]]), col);
      poly(m([[15, 12], [19.5, 8.5], [20, 14.5], [17.5, 14]]), col);
      poly(m([[14.5, 13], [12.5, 18], [14.5, 17.5], [15.5, 13.5]]), col);
      poly(m([[15.5, 13], [16.5, 18], [18.5, 17], [16.5, 13]]), col);
      rect(mir ? 48 : 14, 11 + dy, 3, 3, C.R2);
      set(mir ? 49 : 15, 11 + dy, C.R1);
    };
    bow(false);
    bow(true);
  });

  /* --- 右腕と懐中電灯 --- */
  layer(() => {
    stroke([[40.5, 38 + dy], [44, 43 + dy], [47, 43.5 + dy]], 2.7, 2.2, (x, y) => (y >= 44 + dy ? C.J2 : C.J1));
    rect(49, 41 + dy, 8, 4, (x, y) => (y === 44 + dy ? C.F2 : C.F1));
    rect(56, 39 + dy, 4, 8, (x, y) => (x === 59 || y === 46 + dy ? C.F2 : C.F1));
    rect(60, 40 + dy, 1, 6, C.F3);
    set(50, 42 + dy, '#ffffff');
    ell(49.5, 43 + dy, 2.3, 2.3, C.S1);
    set(51, 44 + dy, C.S2);
  });

  return main;
}

/* ---------- 幽霊（文字マップ） ---------- */
const GHOST_SPRITES = {
  shiro: {
    pal: { o: '#2a2f5c', w: '#e4ecff', k: '#1b1830', m: '#5a4f7a', W: '#ffffff' },
    rows: [
      '.....oo.....',
      '....oWWo....',
      '...ooooooo..',
      '..owwwwwwwo.',
      '.owwwwwwwwwo',
      '.owwkwwwkwwo',
      '.owwkwwwkwwo',
      '.owwwwwwwwwo',
      '.owwwwmwwwwo',
      '.owwwwwwwwwo',
      '.owwwwwwwwwo',
      '..owwwwwwwwo',
      '..owwowwowwo',
      '...oo.oo.oo.',
    ],
  },
  akame: {
    pal: { o: '#0a0610', d: '#1e1228', D: '#2e1c3a', R: '#ff2a3a', W: '#ffd0d0' },
    rows: [
      '...oooooo...',
      '..oddddddo..',
      '.oddddddddo.',
      '.oddddddddo.',
      'oddRRddRRddo',
      'oddRWddRWddo',
      'oddddddddddo',
      'oddddddddddo',
      'odddddddDddo',
      '.oddDdddddo.',
      '.odo.odo.do.',
      '..o...o...o.',
    ],
  },
  hitodama: {
    pal: { g: '#4fa6e0', G: '#8fd0ff', W: '#ffffff' },
    rows: [
      '....g.....',
      '...gg.....',
      '...ggg....',
      '..gGGg....',
      '..gGGgg...',
      '.gGWWGg...',
      '.gGWWWGg..',
      'gGWWWWGg..',
      'gGWWWWGg..',
      'gGGWWGGg..',
      '.gGGGGg...',
      '..gggg....',
    ],
  },
  onna: {
    pal: { k: '#0b0910', s: '#cfd8ec', w: '#e2e8f6', v: '#a3b0cc' },
    rows: [
      '....kkkk....',
      '...kkkkkk...',
      '..kkkkkkkk..',
      '..kkksskkk..',
      '..kkksskkk..',
      '..kkkkskkk..',
      '.kkkkkkkkkk.',
      '.kkwwwwwwkk.',
      '.kkwwwwwwkk.',
      '.kwwwwwwwwk.',
      '.kwwwvwwwwk.',
      '.kwwwvwwwwk.',
      '..wwwvwwww..',
      '..wwwwwwww..',
      '..wwwwwwww..',
      '...wwwwww...',
      '....wwww....',
      '.....ww.....',
    ],
  },
  onibi: {
    pal: { f: '#ff8a2a', F: '#ffd27a', W: '#fff8e0' },
    rows: [
      '...f..........',
      '..ff......f...',
      '..fFf....ff...',
      '.fFWf....fFf..',
      '.fFWFf..fFWf..',
      '..fFf...fFWf..',
      '...f.....fFf..',
      '......f...f...',
      '.....ff.......',
      '.....fFf......',
      '....fFWFf.....',
      '....fFWFf.....',
      '.....fFf......',
      '......f.......',
    ],
  },
  musha: {
    pal: { y: '#d4a640', o: '#0a0a12', a: '#2a2c3c', A: '#4a5068', d: '#121018', R: '#ff3040' },
    rows: [
      '.y..........y.',
      '.yy........yy.',
      '..yy......yy..',
      '...yyooooyy...',
      '...oaaaaaao...',
      '..oaaaaaaaao..',
      '.oaaaaaaaaaao.',
      '...oddddddo...',
      '...odRddRdo...',
      '...oddddddo...',
      '..oaaddddaao..',
      '.oaaaaaaaaaao.',
      '.oaaaaaaaaaao.',
      '.oaaAaaaaAaao.',
      '..oaaAAAAaao..',
      '..oaaaaaaaao..',
      '...oaaaaaao...',
      '....o.oo.o....',
    ],
  },
  kodomo: {
    pal: { o: '#08060c', b: '#1a1222', W: '#f0f4ff' },
    rows: [
      '...oooo...',
      '..obbbbo..',
      '.obbbbbbo.',
      '.obWbbWbo.',
      '.obbbbbbo.',
      '..obbbbo..',
      '...obbo...',
      '..obbbbo..',
      '.obbbbbbo.',
      '.obobbobo.',
      '.oo.bb.oo.',
      '...obbo...',
      '...obbo...',
      '...o..o...',
    ],
  },
  tabibito: {
    pal: { y: '#8a7a4a', Y: '#b09c62', o: '#0a0810', d: '#1c1822', c: '#5a4630' },
    rows: [
      '.....yy.....',
      '...yyYYyy...',
      '.yyyYYYYyyy.',
      'yyyyyyyyyyyy',
      '...oddddo...',
      '...oddddo...',
      '..oddddddo..',
      '.oddddddddo.',
      '.oddddddddoc',
      '.oddddddddoc',
      '.oddddddddoc',
      '..oddddddo.c',
      '..oddddddo.c',
      '..oddddddo.c',
      '...odddo...c',
      '...od.do...c',
      '...od.do...c',
      '...oo.oo...c',
    ],
  },
  tegata: {
    pal: { w: '#dfe6f2', v: '#9aa6c0' },
    rows: [
      '.w.w.w........',
      '.w.w.w.w......',
      '.wwwwwww..w.w.',
      '.wwwwwv..ww.w.',
      '..wwwww..wwwww',
      '..wwvw...wwvw.',
      '...ww.....ww..',
      '......w.w.w...',
      '.....ww.w.w.w.',
      '.....wwwwwww..',
      '......wwvww...',
      '.......www....',
    ],
  },
  nobi: {
    pal: { o: '#06040a', b: '#120c16', W: '#f4f0ff' },
    rows: [
      '..oooo..',
      '.obbbbo.',
      '.obbbbo.',
      '.oWbbWo.',
      '..obbo..',
      '.obbbbo.',
      'obbbbbbo',
      'obbbbbbo',
      'obobbobo',
      'obobbobo',
      'obobbobo',
      'obobbobo',
      'o.obbo.o',
      'o.obbo.o',
      '..obbo..',
      '..obbo..',
      '..obbo..',
      '..obbo..',
      '..o..o..',
      '..o..o..',
      '..o..o..',
      '..o..o..',
    ],
  },
};

/* ---------- UIアイコン ---------- */
const ICONS = {
  film: [
    '..oo......',
    '.oooooo...',
    '.occcco...',
    '.oyyyyoooo',
    '.oyyyyoWcW',
    '.oyyyyoooo',
    '.occcco...',
    '.oooooo...',
    '..oo......',
    '..........',
  ],
  flash: [
    '..........',
    '........y.',
    '.......y..',
    'oooooffF.y',
    'occccofFyy',
    'occccofFyy',
    'oooooffF.y',
    '.......y..',
    '........y.',
    '..........',
  ],
  camera: [
    '..........',
    '..ooo..rr.',
    'oooooooooo',
    'occcllccco',
    'occlWllcco',
    'occllllcco',
    'occcllccco',
    'oooooooooo',
    '..........',
    '..........',
  ],
  moped: [
    '..........',
    '.......oo.',
    '........o.',
    '.oooo...o.',
    '.rrrrr.rr.',
    '..rrrrrrr.',
    '.ooo..ooo.',
    '.oWo..oWo.',
    '.ooo..ooo.',
    '..........',
  ],
  amulet: [
    '....oo....',
    '...o..o...',
    '..oooooo..',
    '..orrrro..',
    '..orWWro..',
    '..orWWro..',
    '..orrrro..',
    '..orrrro..',
    '..oooooo..',
    '..........',
  ],
};
ICONS.ofuda = [
  '...oooo...',
  '...owwo...',
  '...orro...',
  '...owwo...',
  '...orwo...',
  '...owro...',
  '...orro...',
  '...owwo...',
  '...owwo...',
  '...oooo...',
];
ICONS.ir = [
  '..........',
  '.ooo...g..',
  'oooooooooo',
  'occcrrccco',
  'occrRrrcco',
  'occrrrrcco',
  'occcrrccco',
  'oooooooooo',
  '..........',
  '..........',
];
ICONS.sensor = [
  '....o.....',
  '...oo.....',
  '..oooooo..',
  '..ogyyro..',
  '..occcco..',
  '..ocWWco..',
  '..occcco..',
  '..occcco..',
  '..oooooo..',
  '..........',
];

/* ---------- 仲間（低解像度の文字マップ。シーンでは3倍で描く） ---------- */
const COMP_SPRITES = {
  cat: {
    pal: { o: '#141018', h: '#3a3450', y: '#ffd84a' },
    frames: [
      [
        '.........o.o',
        '........hooo',
        '........oyoy',
        'o.......oooo',
        'oo..hhhhooo.',
        '.ooooooooo..',
        '..oooooooo..',
        '..o.o..o.o..',
      ],
      [
        '.........o.o',
        '........hooo',
        '........oyoy',
        '.o......oooo',
        'oo..hhhhooo.',
        '.ooooooooo..',
        '..oooooooo..',
        '...o.o..o.o.',
      ],
    ],
  },
  kohai: {
    pal: {
      k: '#1c1824', s: '#f2d2bc', g: '#8ad0ff', m: '#c0485a', p: '#5a3a8a',
      b: '#d8c8a0', q: '#2a2a3c', w: '#e8e8e8', e: '#3a2a20',
    },
    frames: [
      [
        '...kkkkkk...',
        '..kkkkkkkk..',
        '.kkkkkkkkkk.',
        '.kkkssssskk.',
        '.kkgggsgggk.',
        '.kksssssssk.',
        '..kssmsssk..',
        '...kssssk...',
        '....pppp....',
        '..pppppppp..',
        '.ppppbbpppp.',
        '.ppsbbbbspp.',
        '.pppbbbbppp.',
        '..pppppppp..',
        '..qqqqqqqq..',
        '..qqqqqqqq..',
        '...ss..ss...',
        '...ss..ss...',
        '...ww..ww...',
        '...ww..ww...',
        '..eee..eee..',
        '............',
      ],
    ],
  },
  vet: {
    pal: {
      h: '#6a5030', H: '#3a2a18', s: '#e0b08c', o: '#1a1418', g: '#b8b8c0', v: '#8a7a4a',
      w: '#c8c0a8', B: '#4a5a3a', Y: '#ffd27a', n: '#3a3a44', t: '#3a2416',
    },
    frames: [
      [
        '....hhhhhh....',
        '....HHHHHH....',
        '.hhhhhhhhhhhh.',
        '...ssssssss...',
        '...soossoos...',
        '...ssssssss...',
        '...gggggggg...',
        '....gggggg....',
        '..vvvvvvvvvv..',
        '.Bvvvwwwwvvvs.',
        '.Bvvvwwwwvvsoo',
        '.BvvvwwwwvvvYY',
        '.Bvvvvvvvvvvoo',
        '..vvvvvvvvvv..',
        '..nnnnnnnnnn..',
        '..nnnnnnnnnn..',
        '..nnnn..nnnn..',
        '..nnnn..nnnn..',
        '..nnnn..nnnn..',
        '..nnn....nnn..',
        '.ttttt..ttttt.',
        '..............',
      ],
    ],
  },
};

const ICON_PAL = {
  o: '#9a93bd', c: '#3a3848', y: '#ffe066', W: '#ffffff', f: '#c9c9d1', F: '#fff3a8',
  r: '#d0384e', l: '#7fb2e0', w: '#efe8d6', R: '#ff8090', g: '#46c06a',
};

const Sprites = (() => {
  function rowsToCanvas(rows, pal, mono) {
    const h = rows.length;
    const w = Math.max(...rows.map((r) => r.length));
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const col = pal[row[x]];
        if (!col) continue;
        g.fillStyle = mono || col;
        g.fillRect(x, y, 1, 1);
      }
    });
    return cv;
  }
  function pixelsToCanvas(px, w, h) {
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const g = cv.getContext('2d');
    for (let i = 0; i < px.length; i++) {
      if (!px[i]) continue;
      g.fillStyle = px[i];
      g.fillRect(i % w, Math.floor(i / w), 1, 1);
    }
    return cv;
  }

  /* ゆらのドット絵画像（img/yura_pixel.png）。
   * 読み込めなかったときはコード描画版にフォールバックする */
  let yuraImg = null;
  let yuraImgReady = false;
  function loadYuraImage(src) {
    yuraImg = new Image();
    yuraImg.onload = () => (yuraImgReady = true);
    yuraImg.onerror = () => console.warn('ゆらの画像を読み込めませんでした。コード描画版を使います:', src);
    yuraImg.src = src;
  }
  function yuraImage() {
    return yuraImgReady ? yuraImg : null;
  }

  let yuraCache = null;
  function yura() {
    if (yuraCache) return yuraCache;
    yuraCache = { walk: [], walkBlink: [] };
    for (let f = 0; f < 4; f++) {
      yuraCache.walk.push(pixelsToCanvas(buildYuraPixels(f, false), 64, 64));
      yuraCache.walkBlink.push(pixelsToCanvas(buildYuraPixels(f, true), 64, 64));
    }
    return yuraCache;
  }

  const ghostCache = {};
  function ghost(id) {
    if (!ghostCache[id]) {
      const g = GHOST_SPRITES[id] || GHOST_SPRITES.shiro;
      ghostCache[id] = rowsToCanvas(g.rows, g.pal);
    }
    return ghostCache[id];
  }
  const ghostUrlCache = {};
  function ghostURL(id, silhouette) {
    const key = id + (silhouette ? ':s' : '');
    if (!ghostUrlCache[key]) {
      const g = GHOST_SPRITES[id] || GHOST_SPRITES.shiro;
      ghostUrlCache[key] = rowsToCanvas(g.rows, g.pal, silhouette ? '#3a3356' : null).toDataURL();
    }
    return ghostUrlCache[key];
  }

  const iconUrlCache = {};
  function iconURL(name) {
    if (!iconUrlCache[name]) iconUrlCache[name] = rowsToCanvas(ICONS[name], ICON_PAL).toDataURL();
    return iconUrlCache[name];
  }

  const compCache = {};
  function comp(id, frame = 0) {
    const key = id + ':' + frame;
    if (!compCache[key]) {
      const c = COMP_SPRITES[id];
      compCache[key] = rowsToCanvas(c.frames[frame % c.frames.length], c.pal);
    }
    return compCache[key];
  }
  const compUrlCache = {};
  function compURL(id, silhouette) {
    const key = id + (silhouette ? ':s' : '');
    if (!compUrlCache[key]) {
      const c = COMP_SPRITES[id];
      compUrlCache[key] = rowsToCanvas(c.frames[0], c.pal, silhouette ? '#3a3356' : null).toDataURL();
    }
    return compUrlCache[key];
  }

  return { yura, yuraImage, loadYuraImage, ghost, ghostURL, iconURL, comp, compURL };
})();
