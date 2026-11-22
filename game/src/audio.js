// audio.js — synthesized Web Audio effects: no files, no network.
// Everything is guarded: if AudioContext is unavailable the game stays silent.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.ambientOn = false;
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.startAmbient();
      return true;
    } catch {
      return false;
    }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
  tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }
  noise(dur, vol = 0.15, freq = 800, when = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }
  startAmbient() {
    if (this.ambientOn || !this.ctx) return;
    this.ambientOn = true;
    try {
      const o1 = this.ctx.createOscillator();
      const o2 = this.ctx.createOscillator();
      o1.type = 'sine'; o1.frequency.value = 55;
      o2.type = 'sine'; o2.frequency.value = 55 * 1.5;
      const g = this.ctx.createGain();
      g.gain.value = 0.035;
      const lfo = this.ctx.createOscillator();
      lfo.frequency.value = 0.08;
      const lg = this.ctx.createGain();
      lg.gain.value = 0.015;
      lfo.connect(lg); lg.connect(g.gain);
      o1.connect(g); o2.connect(g); g.connect(this.master);
      o1.start(); o2.start(); lfo.start();
    } catch { /* ambient is optional */ }
  }
  play(name) {
    if (!this.ensure()) return;
    switch (name) {
      case 'pickup': this.tone(880, 0.12, 'sine', 0.22); this.tone(1318, 0.18, 'sine', 0.18, 0.08); break;
      case 'clink': this.tone(2400, 0.07, 'square', 0.08); this.tone(3100, 0.1, 'square', 0.06, 0.03); break;
      case 'throw': this.noise(0.18, 0.1, 2400); break;
      case 'smoke': this.noise(0.5, 0.2, 500); break;
      case 'alarm': this.tone(620, 0.22, 'sawtooth', 0.16); this.tone(460, 0.22, 'sawtooth', 0.16, 0.22); this.tone(620, 0.22, 'sawtooth', 0.14, 0.44); break;
      case 'suspicious': this.tone(330, 0.14, 'triangle', 0.14); break;
      case 'unlock': this.tone(523, 0.1, 'sine', 0.2); this.tone(784, 0.14, 'sine', 0.2, 0.09); this.tone(1046, 0.2, 'sine', 0.18, 0.18); break;
      case 'win': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'sine', 0.2, i * 0.11)); break;
      case 'caught': this.tone(220, 0.4, 'sawtooth', 0.2, 0, 110); this.tone(233, 0.4, 'sawtooth', 0.16, 0.05, 116); break;
      default: break;
    }
  }
}
