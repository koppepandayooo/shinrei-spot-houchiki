'use strict';
/* =========================================================
 * 画面全体の背景（夜空と山並みのシルエット）
 * PCでウィンドウを広げたとき、ゲームの左右が空白にならないように
 * 低解像度で描いて拡大表示する（ドット絵風）。ウィンドウサイズが変わったら描き直す。
 * ========================================================= */
const Backdrop = (() => {
  const PX = 4; // 1ドットの大きさ（CSSピクセル）
  let canvas;
  let timer = null;

  function draw() {
    const w = Math.ceil(window.innerWidth / PX);
    const h = Math.ceil(window.innerHeight / PX);
    canvas.width = w;
    canvas.height = h;
    const c = canvas.getContext('2d');

    // 夜空（上ほど暗い帯＋境目のディザ）
    const bands = ['#05040b', '#08071a', '#0c0a22', '#110e2c', '#161236'];
    const bh = Math.ceil(h / bands.length);
    bands.forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(0, i * bh, w, bh + 1);
    });
    for (let i = 1; i < bands.length; i++) {
      c.fillStyle = bands[i];
      for (let x = 0; x < w; x += 2) c.fillRect(x, i * bh - 1, 1, 1);
    }
    // 星
    const stars = Math.floor((w * h) / 180);
    for (let i = 0; i < stars; i++) {
      const x = Math.floor(hash(i * 3 + 11) * w);
      const y = Math.floor(hash(i * 7 + 5) * h * 0.7);
      const a = 0.25 + hash(i * 13 + 1) * 0.55;
      c.fillStyle = `rgba(225,230,255,${a.toFixed(2)})`;
      c.fillRect(x, y, 1, 1);
    }
    // 山並み（奥 → 手前）
    const layers = [
      { col: '#120f26', base: 0.36, amp: 0.12, freq: 0.012, seed: 3 },
      { col: '#0d0b1d', base: 0.26, amp: 0.1, freq: 0.022, seed: 9 },
      { col: '#090815', base: 0.15, amp: 0.07, freq: 0.04, seed: 17 },
    ];
    layers.forEach((L) => {
      c.fillStyle = L.col;
      for (let x = 0; x < w; x++) {
        const n = noise1(x * L.freq, L.seed) + 0.35 * noise1(x * L.freq * 3.1, L.seed + 7);
        const mh = Math.floor(h * (L.base + L.amp * n));
        c.fillRect(x, h - mh, 1, mh);
      }
      // 尾根の霧
      c.fillStyle = 'rgba(150,140,210,0.035)';
      c.fillRect(0, Math.floor(h * (1 - L.base)), w, 2);
    });
    // 手前の杉林
    c.fillStyle = '#05050c';
    for (let x = 0; x < w; x++) {
      const cell = Math.floor(x / 5);
      const cx = x - cell * 5;
      const th = Math.floor(h * 0.06) + Math.floor(hash(cell * 17 + 3) * 8);
      const th2 = Math.max(2, th - Math.abs(cx - 2) * 3);
      c.fillRect(x, h - th2, 1, th2);
    }
  }

  function init() {
    canvas = document.getElementById('backdrop');
    if (!canvas) return;
    draw();
    window.addEventListener('resize', () => {
      clearTimeout(timer);
      timer = setTimeout(draw, 150);
    });
  }

  return { init };
})();
