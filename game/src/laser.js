// laser.js — timed laser beams and pulsing tripwires. Pure logic.
import { TILE } from './config.js';

function tileC(tx, ty) { return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }; }

// A beam between two points that switches on/off on a cycle. Crossing the
// beam while it is live trips the alarm. `phase` offsets the cycle.
export class Laser {
  constructor(def) {
    this.a = tileC(def.a[0], def.a[1]);
    this.b = tileC(def.b[0], def.b[1]);
    this.on = def.on ?? 2.4;
    this.off = def.off ?? 1.6;
    this.phase = def.phase ?? 0;
    this.t = this.phase;
    this.tripped = false;
  }
  get active() {
    const cycle = this.on + this.off;
    return (this.t % cycle) < this.on;
  }
  // fraction through the current on/off segment, for the render pulse
  get pulse() {
    const cycle = this.on + this.off;
    const m = this.t % cycle;
    return m < this.on ? m / this.on : 1 - (m - this.on) / this.off;
  }
  update(dt) { this.t += dt; }
  // distance from point to the beam segment; < 12px while active = crossed.
  crosses(x, y) {
    if (!this.active) return false;
    const dx = this.b.x - this.a.x, dy = this.b.y - this.a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((x - this.a.x) * dx + (y - this.a.y) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = this.a.x + dx * t, py = this.a.y + dy * t;
    return Math.hypot(x - px, y - py) < 13;
  }
}

// A low wire that pulses in and out of view. Walking across it trips the
// alarm; sneaking (low profile) slips under it safely.
export class Tripwire {
  constructor(def) {
    this.a = tileC(def.a[0], def.a[1]);
    this.b = tileC(def.b[0], def.b[1]);
    this.phase = def.phase ?? 0;
    this.t = this.phase;
    this.tripped = false;
  }
  get visible() { return (Math.sin(this.t * 2.4) > -0.2); }
  update(dt) { this.t += dt; }
  crosses(x, y, sneaking) {
    if (sneaking) return false;
    const dx = this.b.x - this.a.x, dy = this.b.y - this.a.y;
    const len2 = dx * dx + dy * dy;
    let t = len2 ? ((x - this.a.x) * dx + (y - this.a.y) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    const px = this.a.x + dx * t, py = this.a.y + dy * t;
    return Math.hypot(x - px, y - py) < 11;
  }
}
