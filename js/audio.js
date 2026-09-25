/* STAR WARS: Hyperspace Assault — © 2026 Fahath Richvi. All rights reserved. See LICENSE. */
/* Fully synthesized sound effects and music using the Web Audio API (no audio files needed) */
(function () {
  const { clamp, rand } = SW.util;
  let ctx = null, master, sfx, music, comp, noiseBuf;
  let muted = false, musicOn = true;
  let engine = null;
  let musicTimer = null, nextNoteTime = 0, step = 0;
  let intensity = 0.3;
  const lastPlayed = {};

  function init() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 6;
    master = ctx.createGain();
    master.gain.value = SW.settings.volume;
    master.connect(comp); comp.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = 0.9; sfx.connect(master);
    music = ctx.createGain(); music.gain.value = 0.28; music.connect(master);

    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function resume() { init(); if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function throttle(name, minGap) {
    const now = ctx.currentTime;
    if (lastPlayed[name] && now - lastPlayed[name] < minGap) return false;
    lastPlayed[name] = now;
    return true;
  }

  function out(vol, pan) {
    const g = ctx.createGain();
    g.gain.value = vol;
    if (ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = clamp(pan || 0, -1, 1);
      g.connect(p); p.connect(sfx);
    } else g.connect(sfx);
    return g;
  }

  function noise(dur) {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    s.start(ctx.currentTime, Math.random() * 1.5);
    s.stop(ctx.currentTime + dur);
    return s;
  }

  function env(g, t, a, peak, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  const Audio = {
    init, resume,
    get ready() { return !!ctx; },

    setVolume(v) { SW.settings.volume = v; if (master) master.gain.value = muted ? 0 : v; },
    toggleMute() { muted = !muted; if (master) master.gain.value = muted ? 0 : SW.settings.volume; return muted; },
    toggleMusic() { musicOn = !musicOn; if (music) music.gain.setTargetAtTime(musicOn ? 0.28 : 0, ctx.currentTime, 0.3); return musicOn; },
    setIntensity(v) { intensity = v; },

    laser(kind, vol = 1, pan = 0) {
      if (!ctx || vol < 0.02) return;
      const t = ctx.currentTime;
      const o = out(vol * 0.55, pan);
      const o1 = ctx.createOscillator(), o2 = ctx.createOscillator();
      let f0, f1, dur;
      if (kind === 'rebel') { o1.type = 'sawtooth'; o2.type = 'square'; f0 = 1500; f1 = 170; dur = 0.2; }
      else if (kind === 'empire') { o1.type = 'square'; o2.type = 'sawtooth'; f0 = 1050; f1 = 110; dur = 0.24; }
      else { o1.type = 'sawtooth'; o2.type = 'sawtooth'; f0 = 700; f1 = 80; dur = 0.35; }
      o1.frequency.setValueAtTime(f0, t); o1.frequency.exponentialRampToValueAtTime(f1, t + dur);
      o2.frequency.setValueAtTime(f0 * 1.51, t); o2.frequency.exponentialRampToValueAtTime(f1 * 1.49, t + dur);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3800;
      const g = ctx.createGain(); env(g, t, 0.004, 0.5, dur);
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      o1.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(o);
      o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    },

    explosion(size = 1, vol = 1, pan = 0) {
      if (!ctx || vol < 0.02) return;
      if (!throttle('expl', 0.05)) return;
      const t = ctx.currentTime;
      const dur = 0.9 + size * 1.3;
      const o = out(Math.min(1.4, vol * (0.7 + size * 0.4)), pan);
      const n = noise(dur + 0.1);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2200 + size * 400, t);
      lp.frequency.exponentialRampToValueAtTime(90, t + dur);
      const g = ctx.createGain(); env(g, t, 0.01, 0.9, dur);
      n.connect(lp); lp.connect(g); g.connect(o);
      // low thump
      const s = ctx.createOscillator(); s.type = 'sine';
      s.frequency.setValueAtTime(90, t); s.frequency.exponentialRampToValueAtTime(28, t + 0.6 + size * 0.4);
      const g2 = ctx.createGain(); env(g2, t, 0.01, 0.9, 0.6 + size * 0.5);
      s.connect(g2); g2.connect(o); s.start(t); s.stop(t + 1.5 + size);
    },

    // The unmistakable roar of an Imperial twin-ion-engine fighter flying by
    scream(vol = 1, pan = 0) {
      if (!ctx || vol < 0.05) return;
      if (!throttle('scream', 0.9)) return;
      const t = ctx.currentTime, dur = 1.3;
      const o = out(vol * 0.5, pan);
      const n = noise(dur + 0.1);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 5;
      bp.frequency.setValueAtTime(1500, t); bp.frequency.exponentialRampToValueAtTime(650, t + dur);
      const saw = ctx.createOscillator(); saw.type = 'sawtooth';
      saw.frequency.setValueAtTime(260, t); saw.frequency.exponentialRampToValueAtTime(95, t + dur);
      const lfo = ctx.createOscillator(); lfo.frequency.value = 38;
      const lfoG = ctx.createGain(); lfoG.gain.value = 25; lfo.connect(lfoG); lfoG.connect(saw.frequency);
      const sawBp = ctx.createBiquadFilter(); sawBp.type = 'bandpass'; sawBp.frequency.value = 900; sawBp.Q.value = 1.5;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 0.45);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      n.connect(bp); bp.connect(g);
      saw.connect(sawBp); sawBp.connect(g);
      g.connect(o);
      saw.start(t); lfo.start(t); saw.stop(t + dur); lfo.stop(t + dur);
    },

    torpedo() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const o = out(0.7, 0);
      const n = noise(1.2);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 2;
      bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(2500, t + 0.9);
      const g = ctx.createGain(); env(g, t, 0.05, 0.8, 1.0);
      n.connect(bp); bp.connect(g); g.connect(o);
      const s = ctx.createOscillator(); s.type = 'triangle';
      s.frequency.setValueAtTime(180, t); s.frequency.exponentialRampToValueAtTime(900, t + 0.6);
      const g2 = ctx.createGain(); env(g2, t, 0.02, 0.4, 0.6);
      s.connect(g2); g2.connect(o); s.start(t); s.stop(t + 0.7);
    },

    hit(shield) {
      if (!ctx || !throttle('hit', 0.06)) return;
      const t = ctx.currentTime;
      const o = out(0.6, rand(-0.3, 0.3));
      if (shield) {
        const s = ctx.createOscillator(); s.type = 'sine';
        s.frequency.setValueAtTime(1800, t); s.frequency.exponentialRampToValueAtTime(300, t + 0.25);
        const g = ctx.createGain(); env(g, t, 0.005, 0.5, 0.25);
        s.connect(g); g.connect(o); s.start(t); s.stop(t + 0.3);
      }
      const n = noise(0.3);
      const hp = ctx.createBiquadFilter(); hp.type = shield ? 'highpass' : 'lowpass'; hp.frequency.value = shield ? 2500 : 1200;
      const g2 = ctx.createGain(); env(g2, t, 0.002, shield ? 0.35 : 0.9, 0.22);
      n.connect(hp); hp.connect(g2); g2.connect(o);
    },

    spark(vol = 0.3, pan = 0) {
      if (!ctx || vol < 0.03 || !throttle('spark', 0.05)) return;
      const t = ctx.currentTime;
      const o = out(vol, pan);
      const n = noise(0.15);
      const hp = ctx.createBiquadFilter(); hp.type = 'bandpass'; hp.frequency.value = 3000; hp.Q.value = 1;
      const g = ctx.createGain(); env(g, t, 0.002, 0.6, 0.1);
      n.connect(hp); hp.connect(g); g.connect(o);
    },

    beep(freq = 880, dur = 0.08, vol = 0.25, type = 'square') {
      if (!ctx) return;
      const t = ctx.currentTime;
      const o = out(vol, 0);
      const s = ctx.createOscillator(); s.type = type; s.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.005);
      g.gain.setValueAtTime(0.5, t + dur);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.02);
      s.connect(g); g.connect(o); s.start(t); s.stop(t + dur + 0.05);
    },

    alarm() {
      if (!ctx || !throttle('alarm', 1.2)) return;
      const t = ctx.currentTime;
      const o = out(0.25, 0);
      for (let i = 0; i < 2; i++) {
        const s = ctx.createOscillator(); s.type = 'square';
        s.frequency.setValueAtTime(i ? 520 : 780, t + i * 0.25);
        const g = ctx.createGain(); g.gain.value = 0;
        g.gain.setValueAtTime(0.4, t + i * 0.25); g.gain.setValueAtTime(0, t + i * 0.25 + 0.2);
        s.connect(g); g.connect(o); s.start(t + i * 0.25); s.stop(t + i * 0.25 + 0.22);
      }
    },

    // astromech droid chatter
    droid() {
      if (!ctx || !throttle('droid', 0.8)) return;
      let t = ctx.currentTime;
      const o = out(0.22, 0);
      const n = 5 + Math.floor(Math.random() * 6);
      for (let i = 0; i < n; i++) {
        const s = ctx.createOscillator(); s.type = Math.random() < 0.7 ? 'sine' : 'triangle';
        const d = rand(0.04, 0.12);
        const f0 = rand(900, 3200), f1 = rand(900, 3600);
        s.frequency.setValueAtTime(f0, t); s.frequency.exponentialRampToValueAtTime(f1, t + d);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.6, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        s.connect(g); g.connect(o); s.start(t); s.stop(t + d + 0.02);
        t += d + rand(0.0, 0.05);
      }
    },

    hyperspace() {
      if (!ctx) return;
      const t = ctx.currentTime;
      const o = out(0.8, 0);
      const n = noise(3);
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 1.2;
      bp.frequency.setValueAtTime(200, t); bp.frequency.exponentialRampToValueAtTime(3000, t + 1.8);
      bp.frequency.exponentialRampToValueAtTime(120, t + 2.6);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 1.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      n.connect(bp); bp.connect(g); g.connect(o);
      const s = ctx.createOscillator(); s.type = 'sawtooth';
      s.frequency.setValueAtTime(60, t); s.frequency.exponentialRampToValueAtTime(420, t + 1.9);
      s.frequency.exponentialRampToValueAtTime(40, t + 2.5);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const g2 = ctx.createGain(); env(g2, t, 1.5, 0.35, 1.1);
      s.connect(lp); lp.connect(g2); g2.connect(o); s.start(t); s.stop(t + 2.8);
    },

    /* ---- continuous engine hum ---- */
    startEngine() {
      if (!ctx || engine) return;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 48;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 72.5;
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; n.loop = true;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 300;
      const nlp = ctx.createBiquadFilter(); nlp.type = 'bandpass'; nlp.frequency.value = 500; nlp.Q.value = 0.7;
      const ng = ctx.createGain(); ng.gain.value = 0.25;
      const g = ctx.createGain(); g.gain.value = 0;
      o1.connect(lp); o2.connect(lp); n.connect(nlp); nlp.connect(ng); ng.connect(lp);
      lp.connect(g); g.connect(sfx);
      o1.start(); o2.start(); n.start();
      engine = { o1, o2, n, lp, g, nlp };
    },
    setEngine(throttleV, boost) {
      if (!engine) return;
      const t = ctx.currentTime;
      const f = 40 + throttleV * 30 + (boost ? 25 : 0);
      engine.o1.frequency.setTargetAtTime(f, t, 0.2);
      engine.o2.frequency.setTargetAtTime(f * 1.51, t, 0.2);
      engine.lp.frequency.setTargetAtTime(220 + throttleV * 380 + (boost ? 700 : 0), t, 0.2);
      engine.nlp.frequency.setTargetAtTime(400 + throttleV * 500 + (boost ? 900 : 0), t, 0.2);
      engine.g.gain.setTargetAtTime(0.1 + throttleV * 0.1 + (boost ? 0.12 : 0), t, 0.2);
    },
    stopEngine() {
      if (!engine) return;
      const e = engine; engine = null;
      e.g.gain.setTargetAtTime(0, ctx.currentTime, 0.2);
      setTimeout(() => { try { e.o1.stop(); e.o2.stop(); e.n.stop(); } catch (x) { /* ignore */ } }, 800);
    },

    /* ---- procedural orchestral-ish score (original composition) ---- */
    startMusic() {
      if (!ctx || musicTimer) return;
      nextNoteTime = ctx.currentTime + 0.1; step = 0;
      musicTimer = setInterval(scheduleMusic, 100);
    },
    stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } },
  };

  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  // C minor heroic progression: Cm - Ab - Eb - Bb - Fm - Ab - G - G
  const CHORDS = [
    [48, 55, 60, 63], [44, 51, 56, 60], [51, 55, 58, 63], [46, 53, 58, 62],
    [41, 53, 56, 60], [44, 51, 56, 63], [43, 55, 59, 62], [43, 50, 55, 59],
  ];
  const MELODY = [
    [72, 2], [75, 1], [74, 1], [72, 4], [68, 2], [70, 2], [72, 4],
    [75, 2], [77, 1], [75, 1], [74, 4], [70, 4], [67, 4],
    [68, 2], [72, 2], [77, 4], [75, 2], [74, 2], [72, 4], [71, 4], [67, 4],
  ];
  let melIdx = 0, melWait = 0;

  function scheduleMusic() {
    if (!ctx) return;
    const beat = 60 / 88;
    while (nextNoteTime < ctx.currentTime + 0.4) {
      const t = nextNoteTime;
      const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
      if (step % 8 === 0) pad(chord, t, beat * 8);
      // timpani-like pulse, more urgent when combat intensity is high
      if (step % 2 === 0 || intensity > 0.6) drum(t, step % 8 === 0 ? 1 : 0.45 + intensity * 0.3, mtof(chord[0] - 12));
      if (intensity > 0.4 && step % 1 === 0) string(chord[(step % 4)] + 12, t, beat * 0.9, 0.08 + intensity * 0.05);
      // brass melody, played when intensity is moderate
      if (melWait <= 0) {
        const [note, len] = MELODY[melIdx % MELODY.length];
        if (intensity > 0.25) brass(note, t, beat * len * 0.95);
        melWait = len; melIdx++;
      }
      melWait--;
      nextNoteTime += beat;
      step++;
    }
  }

  function pad(notes, t, dur) {
    notes.forEach((m) => {
      [-6, 6].forEach((det) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = mtof(m); o.detune.value = det;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.045, t + 1.4);
        g.gain.setValueAtTime(0.045, t + dur - 0.8);
        g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.6);
        o.connect(lp); lp.connect(g); g.connect(music);
        o.start(t); o.stop(t + dur + 0.7);
      });
    });
  }
  function brass(m, t, dur) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m);
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = mtof(m - 12);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(400, t); lp.frequency.linearRampToValueAtTime(2200, t + 0.12);
    lp.frequency.linearRampToValueAtTime(1300, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.09, t + 0.08);
    g.gain.setValueAtTime(0.08, t + dur - 0.1); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.15);
    const g2 = ctx.createGain(); g2.gain.value = 0.35;
    o.connect(lp); o2.connect(g2); g2.connect(lp); lp.connect(g); g.connect(music);
    o.start(t); o2.start(t); o.stop(t + dur + 0.2); o2.stop(t + dur + 0.2);
  }
  function string(m, t, dur, vol) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(music); o.start(t); o.stop(t + dur + 0.05);
  }
  function drum(t, v, f) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(f * 2, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.15);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    o.connect(g); g.connect(music); o.start(t); o.stop(t + 0.75);
  }

  SW.Audio = Audio;
})();
