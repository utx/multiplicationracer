// All sound is synthesised live with the Web Audio API — no audio files needed.

let ctx = null, master = null, musicGain = null, sfxGain = null;
let engine = null;
let enabled = { sound: true, music: true };

function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = 0.8; master.connect(ctx.destination);
  const comp = ctx.createDynamicsCompressor();
  comp.connect(master);
  sfxGain = ctx.createGain(); sfxGain.connect(comp);
  musicGain = ctx.createGain(); musicGain.gain.value = 0.22; musicGain.connect(comp);
  return ctx;
}

export function unlockAudio() {
  init();
  if (ctx?.state === 'suspended') ctx.resume();
}

export function setAudio(opts) {
  enabled = { ...enabled, ...opts };
  if (!ctx) return;
  sfxGain.gain.value = enabled.sound ? 1 : 0;
  musicGain.gain.value = enabled.music ? 0.22 : 0;
}

function tone(freq, dur, { type = 'sine', vol = 0.2, at = 0, slide = 0, dest = sfxGain } = {}) {
  if (!ctx || !enabled.sound && dest === sfxGain) return;
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.05);
}

let noiseBuf = null;
function noise(dur, { vol = 0.3, at = 0, type = 'bandpass', f0 = 800, f1 = 3000, q = 1 } = {}) {
  if (!ctx || !enabled.sound) return;
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t); src.stop(t + dur + 0.05);
}

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const sfx = {
  click() { tone(880, 0.06, { type: 'triangle', vol: 0.12 }); },
  correct(combo = 1) {
    const base = 72 + Math.min(combo, 8);
    [0, 4, 7, 12].forEach((s, i) => tone(NOTE(base + s), 0.18, { type: 'triangle', vol: 0.18, at: i * 0.06 }));
  },
  wrong() {
    tone(220, 0.35, { type: 'sawtooth', vol: 0.12, slide: -120 });
    tone(160, 0.4, { type: 'square', vol: 0.06, at: 0.05, slide: -80 });
  },
  boost() { noise(0.9, { vol: 0.35, f0: 400, f1: 4000, q: 2 }); tone(120, 0.6, { type: 'sawtooth', vol: 0.06, slide: 260 }); },
  swish() { noise(0.15, { vol: 0.12, type: 'highpass', f0: 2000, f1: 6000 }); },
  beep(go) { tone(go ? 1320 : 660, go ? 0.5 : 0.22, { type: 'square', vol: 0.14 }); },
  pit() { for (let i = 0; i < 6; i++) noise(0.07, { vol: 0.3, at: i * 0.09, f0: 1500, f1: 900, q: 4 }); },
  finish(pos) {
    const seq = pos <= 3 ? [60, 64, 67, 72, 76, 79, 84] : [60, 63, 67, 72];
    seq.forEach((n, i) => tone(NOTE(n), 0.3, { type: 'triangle', vol: 0.16, at: i * 0.11 }));
  },
  coin() { tone(NOTE(88), 0.08, { type: 'square', vol: 0.08 }); tone(NOTE(95), 0.15, { type: 'square', vol: 0.08, at: 0.07 }); },
  key() { tone(600, 0.04, { type: 'triangle', vol: 0.08 }); },

  engine(level, boost, on) {
    if (!ctx) return;
    if (!engine) {
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth';
      const o2 = ctx.createOscillator(); o2.type = 'square';
      const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600; f.Q.value = 4;
      const g = ctx.createGain(); g.gain.value = 0;
      o1.connect(f); o2.connect(f); f.connect(g); g.connect(sfxGain);
      o1.start(); o2.start();
      engine = { o1, o2, f, g };
    }
    const t = ctx.currentTime;
    const freq = 45 + level * 70 + boost * 40;
    engine.o1.frequency.setTargetAtTime(freq, t, 0.08);
    engine.o2.frequency.setTargetAtTime(freq * 0.501, t, 0.08);
    engine.f.frequency.setTargetAtTime(400 + level * 900 + boost * 1200, t, 0.1);
    engine.g.gain.setTargetAtTime(on && enabled.sound ? 0.05 + boost * 0.03 : 0, t, 0.15);
  },
};

// ---------------------------------------------------------------- music

let musicTimer = null, step = 0, nextTime = 0, track = 'race';
const SONGS = {
  // A-minor driving loop
  race: { bpm: 132, bass: [45, 45, 57, 45, 43, 43, 55, 43, 41, 41, 53, 41, 43, 43, 55, 47], chords: [[69, 72, 76], [67, 71, 74], [65, 69, 72], [67, 71, 74]] },
  menu: { bpm: 100, bass: [48, 0, 55, 0, 45, 0, 52, 0, 41, 0, 48, 0, 43, 0, 50, 0], chords: [[72, 76, 79], [69, 72, 76], [65, 69, 72], [67, 71, 74]] },
};

export function playMusic(name) {
  init();
  track = name;
  if (musicTimer) return;
  nextTime = ctx.currentTime + 0.1;
  musicTimer = setInterval(schedule, 50);
}

export function stopMusic() {
  clearInterval(musicTimer);
  musicTimer = null;
}

function schedule() {
  if (!ctx) return;
  const song = SONGS[track];
  const sixteenth = 60 / song.bpm / 4;
  while (nextTime < ctx.currentTime + 0.2) {
    const s = step % 64;
    const bar = Math.floor(s / 16);
    const b = song.bass[s % 16];
    const at = nextTime - ctx.currentTime;
    if (b && s % 2 === 0) tone(NOTE(b), sixteenth * 1.8, { type: 'sawtooth', vol: 0.18, at, dest: musicGain });
    const chord = song.chords[bar];
    if (track === 'race') {
      tone(NOTE(chord[s % 3] + 12 * (s % 6 < 3 ? 0 : 1)), sixteenth * 0.9, { type: 'square', vol: 0.05, at, dest: musicGain });
      if (s % 4 === 0) kick(at);
      if (s % 8 === 4) snare(at);
    } else if (s % 4 === 0) {
      chord.forEach((n) => tone(NOTE(n), sixteenth * 3.5, { type: 'triangle', vol: 0.05, at, dest: musicGain }));
    }
    nextTime += sixteenth;
    step++;
  }
}

function kick(at) {
  const t = ctx.currentTime + at;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
  g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2);
  o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.25);
}

function snare(at) {
  if (!noiseBuf) return;
  const t = ctx.currentTime + at;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1500;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.25, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
  src.connect(f); f.connect(g); g.connect(musicGain); src.start(t, Math.random()); src.stop(t + 0.15);
}
