// camera.js — sweeping security camera: a fixed pivot with a moving cone.
// Pure logic; rendering lives in render.js.
import { CAMERA } from './config.js';
import { canSee } from './raycast.js';
import { turnToward } from './utils.js';

export class SecurityCamera {
  constructor(world, def) {
    this.world = world;
    this.x = def.tx * 40 + 20;
    this.y = def.ty * 40 + 20;
    this.baseAngle = def.angle;
    this.sweep = def.sweep ?? 0.9;
    this.angle = def.angle;
    this.dir = 1;
    this.detect = 0;
    this.alarmRaised = false;
    this.sweepSpeed = CAMERA.sweepSpeed;
  }
  update(dt, player, events, hunted) {
    // sweep back and forth around the base angle
    const speed = this.sweepSpeed * (hunted ? 1.4 : 1);
    this.angle += this.dir * speed * dt;
    if (this.angle > this.baseAngle + this.sweep) { this.angle = this.baseAngle + this.sweep; this.dir = -1; }
    if (this.angle < this.baseAngle - this.sweep) { this.angle = this.baseAngle - this.sweep; this.dir = 1; }
    const seen = canSee(this.world, this.x, this.y, this.angle, CAMERA.fov,
      CAMERA.viewRange, player.x, player.y,
      { inCover: player.inCover, inDark: player.inDark, sneaking: player.sneaking });
    if (seen.seen && !player.inSmoke) {
      this.detect = Math.min(1, this.detect + dt / CAMERA.detectFill);
      if (this.detect >= 1 && !this.alarmRaised) {
        this.alarmRaised = true;
        events.push({ type: 'camera', x: player.x, y: player.y });
      }
    } else {
      this.detect = Math.max(0, this.detect - dt * 0.8);
      if (this.detect <= 0) this.alarmRaised = false;
    }
  }
}
