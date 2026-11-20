'use strict';
/* =========================================================
 * 効果音と環境音（WebAudio で合成。音声ファイルは使わない）
 *  - 撮影：ミラーアップ → 幕走行 → 巻き上げ の本物っぽいシャッター音
 *  - 探索中：風の音・水滴の音（トンネル内は水滴多め、滝の近くでは水音）
 *  - 心霊写真：低いうなりとささやき、こだまのかかった不協和音
 * 音量は控えめ。ON/OFF は Sound.setMuted() で切り替える。
 * ========================================================= */

const Sound = (() => {
  let ctx = null;
  let master, sfxBus, ambBus, echoIn, noiseBuf;
  let muted = false;
  let amb = null;

  function ensure() {
    if (muted) return null;
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain();
        master.gain.value = 0.75;
        master.connect(ctx.destination);
        // 大きな音が出すぎないようにコンプレッサーを通す
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -20;
        comp.ratio.value = 4;
        comp.connect(master);
        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.9;
        sfxBus.connect(comp);
        ambBus = ctx.createGain();
        ambBus.gain.value = 0;
        ambBus.connect(master);
        // こだま（不気味な音・トンネルの水滴用）
        echoIn = ctx.createGain();
        const delay = ctx.createDelay(1.0);
        delay.delayTime.value = 0.27;
        const fb = ctx.createGain();
        fb.gain.value = 0.4;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1600;
        echoIn.connect(delay);
        delay.connect(lp);
        lp.connect(fb);
        fb.connect(delay);
        lp.connect(sfxBus);
        // ホワイトノイズ（2秒）
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch (e) {
      return null;
    }
  }
  const now = () => ctx.currentTime;

  // フィルターつきノイズの短い音
  function noise(dur, o = {}) {
    const t0 = now() + (o.when || 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 2000, t0);
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(o.freqTo, t0 + dur);
    f.Q.value = o.q || 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.2, t0 + (o.attack || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(o.dest || sfxBus);
    if (o.echo) g.connect(echoIn);
    src.start(t0, Math.random() * 1.5, dur + 0.05);
  }
  // 音程つきの短い音
  function tone(freq, dur, o = {}) {
    const t0 = now() + (o.when || 0);
    const osc = ctx.createOscillator();
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(o.vol || 0.08, t0 + (o.attack || 0.005));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(o.dest || sfxBus);
    if (o.echo) g.connect(echoIn);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
    return osc;
  }

  /* ---------- 効果音 ---------- */
  // カシャッ（ミラーアップ → 幕走行 → 巻き上げ）
  function shutter() {
    if (!ensure()) return;
    noise(0.012, { type: 'highpass', freq: 3500, vol: 0.32 });
    tone(170, 0.045, { vol: 0.14, to: 85 });
    noise(0.035, { type: 'bandpass', freq: 2300, q: 0.8, vol: 0.18, when: 0.05 });
    noise(0.01, { type: 'highpass', freq: 4200, vol: 0.26, when: 0.082 });
    tone(140, 0.03, { vol: 0.08, to: 80, when: 0.082 });
    // 巻き上げ（ジーッ）
    const t0 = now() + 0.13;
    const w = ctx.createOscillator();
    w.type = 'sawtooth';
    w.frequency.setValueAtTime(85, t0);
    w.frequency.linearRampToValueAtTime(110, t0 + 0.16);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.02);
    g.gain.setValueAtTime(0.03, t0 + 0.13);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.17);
    w.connect(bp).connect(g).connect(sfxBus);
    w.start(t0);
    w.stop(t0 + 0.2);
  }
  function buy() {
    if (!ensure()) return;
    tone(880, 0.07, { type: 'square', vol: 0.03 });
    tone(1320, 0.1, { type: 'square', vol: 0.03, when: 0.06 });
  }
  function unlock() {
    if (!ensure()) return;
    [523, 659, 784].forEach((f, i) => tone(f, 0.5, { type: 'triangle', vol: 0.05, when: i * 0.09 }));
  }
  function achievement() {
    if (!ensure()) return;
    tone(988, 0.12, { type: 'square', vol: 0.025 });
    tone(1319, 0.3, { type: 'square', vol: 0.025, when: 0.1 });
  }
  function sweep(f1, f2, dur, type = 'sine', vol = 0.08) {
    if (!ensure()) return;
    tone(f1, dur, { type, vol, to: f2 });
  }
  // 幽霊が現れたとき：低い不協和音のうなり＋ささやき
  function ghostAppear() {
    if (!ensure()) return;
    const t0 = now();
    [110, 116.5, 164.8].forEach((f, i) => {
      const osc = ctx.createOscillator();
      osc.type = i === 2 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(f, t0);
      osc.frequency.linearRampToValueAtTime(f * 0.97, t0 + 2.6);
      const trem = ctx.createOscillator();
      trem.frequency.value = 5 + i * 1.3;
      const tg = ctx.createGain();
      tg.gain.value = 0.02;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.045, t0 + 1.0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 2.6);
      trem.connect(tg).connect(g.gain);
      osc.connect(g);
      g.connect(sfxBus);
      g.connect(echoIn);
      osc.start(t0);
      trem.start(t0);
      osc.stop(t0 + 2.7);
      trem.stop(t0 + 2.7);
    });
    noise(1.6, { type: 'bandpass', freq: 1400, freqTo: 3200, q: 7, vol: 0.05, attack: 0.6, echo: true, when: 0.3 });
  }
  // 心霊写真が撮れたとき：こだまする不協和音
  function ghostCatch() {
    if (!ensure()) return;
    tone(880, 1.2, { vol: 0.06, to: 210, echo: true });
    tone(933, 1.2, { vol: 0.05, to: 222, echo: true });
    tone(1245, 0.9, { type: 'triangle', vol: 0.03, to: 300, echo: true, when: 0.05 });
    noise(0.9, { type: 'bandpass', freq: 600, freqTo: 2400, q: 3, vol: 0.06, attack: 0.5, echo: true });
  }
  // 足音（ザッ、ザッ…）
  function steps() {
    if (!ensure()) return;
    for (let i = 0; i < 4; i++) {
      tone(90, 0.16, { vol: 0.16, to: 45, when: i * 0.42 });
      noise(0.09, { type: 'lowpass', freq: 700, vol: 0.12, when: i * 0.42, echo: true });
    }
  }
  // おりん（滝の前で手を合わせるとき）
  function chime() {
    if (!ensure()) return;
    tone(1046, 3.6, { vol: 0.05, attack: 0.004 });
    tone(2615, 2.2, { vol: 0.018, attack: 0.004 });
    tone(4150, 1.0, { vol: 0.008, attack: 0.004 });
  }

  /* ---------- 環境音 ---------- */
  function loopNoise(filterType, freq, q) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(ambBus);
    src.start();
    return { f, g };
  }
  function ambientStart() {
    if (amb || !ensure()) return;
    const wind = loopNoise('lowpass', 400, 0.7);
    const falls = loopNoise('bandpass', 700, 0.6);
    amb = { wind, falls, nextDrip: 1.5 };
    ambBus.gain.setTargetAtTime(1, now(), 1.2);
  }
  function drip(interior) {
    const f = 1300 + Math.random() * 1100;
    tone(f, 0.08, { vol: interior ? 0.03 : 0.018, to: f * 0.55, dest: ambBus, echo: interior });
  }
  // 毎フレーム呼ぶ。interior:トンネル内か、falls:滝の近さ(0..1)
  function ambientUpdate(dt, t, interior, falls) {
    if (!amb || muted || !ctx) return;
    const swell = 0.55 + 0.45 * Math.sin(t * 0.37) * Math.sin(t * 0.13 + 1);
    const windVol = (interior ? 0.022 : 0.035) * swell;
    amb.wind.g.gain.setTargetAtTime(windVol, now(), 0.4);
    amb.wind.f.frequency.setTargetAtTime(interior ? 240 : 380 + 140 * Math.sin(t * 0.21), now(), 0.5);
    amb.falls.g.gain.setTargetAtTime(0.06 * falls, now(), 0.4);
    amb.nextDrip -= dt;
    if (amb.nextDrip <= 0) {
      drip(interior);
      amb.nextDrip = interior ? 1 + Math.random() * 2.5 : 5 + Math.random() * 7;
    }
  }

  function setMuted(m) {
    muted = !!m;
    if (!ctx) return;
    if (muted) ambBus.gain.setTargetAtTime(0, now(), 0.15);
    else {
      ensure();
      if (amb) ambBus.gain.setTargetAtTime(1, now(), 0.8);
      else ambientStart();
    }
  }
  function suspend() {
    if (ctx && ctx.state === 'running') ctx.suspend();
  }
  function resume() {
    if (ctx && !muted && ctx.state === 'suspended') ctx.resume();
  }

  return {
    shutter, buy, unlock, achievement, sweep, ghostAppear, ghostCatch, steps, chime,
    ambientStart, ambientUpdate, setMuted, suspend, resume,
  };
})();
