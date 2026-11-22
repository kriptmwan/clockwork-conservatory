// gadgets.js — coin lure and smoke vial. Pure logic.
import { GADGETS } from './config.js';
import { clamp } from './utils.js';

// A thrown coin arcs to its target, clinks, and rings for a moment.
export class Coin {
  constructor(x, y, tx, ty) {
    this.x = x; this.y = y;
    this.tx = tx; this.ty = ty;
    this.t = 0;
    this.flight = 0.45;
    this.landed = false;
    this.ringT = 0; // seconds since landing (noise window)
    this.sx = x; this.sy = y;
  }
  update(dt) {
    if (!this.landed) {
      this.t += dt;
      const k = clamp(this.t / this.flight, 0, 1);
      this.x = this.sx + (this.tx - this.sx) * k;
      this.y = this.sy + (this.ty - this.sy) * k;
      if (k >= 1) { this.landed = true; this.ringT = 0; }
    } else {
      this.ringT += dt;
    }
  }
  get ringing() { return this.landed && this.ringT < 1.6; }
  get done() { return this.landed && this.ringT > 2.2; }
  // arc height for the render bounce
  get arcH() {
    if (this.landed) return 0;
    const k = clamp(this.t / this.flight, 0, 1);
    return Math.sin(k * Math.PI) * 26;
  }
}

// A smoke cloud that blocks guard and camera vision while it lasts.
export class Smoke {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.r = GADGETS.smokeRadius;
    this.t = 0;
    this.life = GADGETS.smokeTime;
  }
  update(dt) { this.t += dt; }
  get alive() { return this.t < this.life; }
  get alpha() {
    const k = this.t / this.life;
    return k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
  }
  covers(x, y) {
    return this.alive && Math.hypot(x - this.x, y - this.y) < this.r * 0.85;
  }
}
