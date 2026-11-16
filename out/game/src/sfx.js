// sfx.js: procedural WebAudio - gunshots, footsteps, reload, explosions.
// No external assets; everything is synthesized from noise bursts + oscillators.
let ctx = null;
const noiseBuf = {};

function ensureCtx() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    const len = Math.floor(ctx.sampleRate * 0.5);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf.white = buf;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export function unlockAudio() { ensureCtx(); }

function noiseSource(c) {
  const src = c.createBufferSource();
  src.buffer = noiseBuf.white;
  return src;
}

// gunshot: sharp noise crack + low body thump
export function playShot(kind = 'rifle') {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime;
  const cfg = kind === 'sniper' ? { cut: 700, dur: 0.28, body: 90, vol: 0.5 }
    : kind === 'smg' ? { cut: 1600, dur: 0.13, body: 140, vol: 0.32 }
    : { cut: 1100, dur: 0.18, body: 110, vol: 0.4 };
  const out = c.createGain();
  out.gain.value = cfg.vol;
  out.connect(c.destination);
  const n = noiseSource(c);
  const hp = c.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = cfg.cut;
  const g = c.createGain();
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + cfg.dur);
  n.connect(hp).connect(g).connect(out);
  n.start(t); n.stop(t + cfg.dur);
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(cfg.body, t);
  o.frequency.exponentialRampToValueAtTime(35, t + 0.12);
  const og = c.createGain();
  og.gain.setValueAtTime(0.8, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  o.connect(og).connect(out);
  o.start(t); o.stop(t + 0.15);
}

// footstep: short filtered noise tap
export function playFootstep(running) {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime;
  const n = noiseSource(c);
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 300 + Math.random() * 250;
  bp.Q.value = 1.2;
  const g = c.createGain();
  const vol = running ? 0.14 : 0.08;
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
  n.connect(bp).connect(g).connect(c.destination);
  n.start(t); n.stop(t + 0.1);
}

// reload click: two short ticks
export function playReload() {
  const c = ensureCtx();
  if (!c) return;
  for (let i = 0; i < 2; i++) {
    const t = c.currentTime + i * 0.12;
    const o = c.createOscillator();
    o.type = 'square';
    o.frequency.value = 220 + i * 160;
    const g = c.createGain();
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g).connect(c.destination);
    o.start(t); o.stop(t + 0.06);
  }
}

// explosion: long noise rumble + sub thump
export function playExplosion() {
  const c = ensureCtx();
  if (!c) return;
  const t = c.currentTime;
  const out = c.createGain();
  out.gain.value = 0.65;
  out.connect(c.destination);
  const n = noiseSource(c);
  const lp = c.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(900, t);
  lp.frequency.exponentialRampToValueAtTime(60, t + 0.8);
  const g = c.createGain();
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.9);
  n.connect(lp).connect(g).connect(out);
  n.start(t); n.stop(t + 1.0);
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(70, t);
  o.frequency.exponentialRampToValueAtTime(25, t + 0.5);
  const og = c.createGain();
  og.gain.setValueAtTime(1, t);
  og.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  o.connect(og).connect(out);
  o.start(t); o.stop(t + 0.65);
}
