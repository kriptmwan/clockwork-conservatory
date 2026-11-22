// particles.js — lightweight particle system for dust, leaves, sparks.
// Pure logic; rendering reads the particle list.
import { mulberry32 } from './utils.js';

export class Particles {
  constructor(seed = 7) {
    this.list = [];
    this.rng = mulberry32(seed);
  }
  spawn(x, y, opts = {}) {
    const n = opts.n ?? 10;
    for (let i = 0; i < n; i++) {
      const a = this.rng() * Math.PI * 2;
      const sp = (opts.speed ?? 60) * (0.4 + this.rng() * 0.8);
      this.list.push({
        x, y,
        vx: Math.cos(a) * sp + (opts.vx ?? 0),
        vy: Math.sin(a) * sp + (opts.vy ?? 0),
        life: 0,
        max: (opts.life ?? 0.7) * (0.6 + this.rng() * 0.8),
        size: (opts.size ?? 3) * (0.6 + this.rng() * 0.8),
        color: opts.color ?? '#ffd700',
        grav: opts.grav ?? 0,
        drag: opts.drag ?? 0.98,
      });
    }
  }
  // ambient drifting motes inside the glasshouse
  ambient(x, y, w, h, dt) {
    if (this.rng() < dt * 6 && this.list.length < 240) {
      this.list.push({
        x: x + this.rng() * w, y: y + this.rng() * h,
        vx: -6 - this.rng() * 10, vy: 4 + this.rng() * 8,
        life: 0, max: 5 + this.rng() * 4,
        size: 1 + this.rng() * 1.6, color: '#ffe9a8',
        grav: 0, drag: 1,
      });
    }
  }
  update(dt) {
    for (const p of this.list) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += p.grav * dt;
      p.vx *= p.drag; p.vy *= p.drag;
    }
    this.list = this.list.filter((p) => p.life < p.max);
  }
  get alive() { return this.list; }
}
