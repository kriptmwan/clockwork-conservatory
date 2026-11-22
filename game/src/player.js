// player.js — Wren, the thief: movement, sneak, gadgets, noise.
// Pure logic except for the input shape it reads (keys + mouse).
import { PLAYER, GADGETS } from './config.js';
import { clamp } from './utils.js';

export class Player {
  constructor(world, x, y) {
    this.world = world;
    this.x = x; this.y = y;
    this.angle = -Math.PI / 2;
    this.sneaking = false;
    this.moving = false;
    this.stepT = 0;
    this.coins = GADGETS.coinsPerLevel;
    this.smokes = GADGETS.smokePerLevel;
    this.noise = null; // {x, y, radius, until} — guards hear this
    this.inCover = false;
    this.inDark = false;
    this.inSmoke = false;
    this.waterSlow = false;
  }
  reset(x, y) {
    this.x = x; this.y = y;
    this.angle = -Math.PI / 2;
    this.coins = GADGETS.coinsPerLevel;
    this.smokes = GADGETS.smokePerLevel;
    this.noise = null;
  }
  // input: {up,down,left,right,sneak} booleans. Returns distance moved.
  update(dt, input, now) {
    let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const len = Math.hypot(dx, dy);
    this.moving = len > 0;
    this.sneaking = !!input.sneak;
    if (len > 0) {
      dx /= len; dy /= len;
      this.angle = Math.atan2(dy, dx);
      let speed = this.sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
      if (this.waterSlow) speed *= 0.7;
      const step = speed * dt;
      this.world.moveCircle(this, dx * step, dy * step, PLAYER.radius);
      // footsteps: walking is audible close up, sneaking barely
      this.stepT -= dt;
      if (this.stepT <= 0) {
        this.stepT = this.sneaking ? 0.55 : 0.38;
        this.noise = {
          x: this.x, y: this.y,
          radius: this.sneaking ? PLAYER.hearSneak : PLAYER.hearWalk,
          until: now + 0.25,
        };
      }
    }
    // cover / dark state from the tile underfoot
    const tx = Math.floor(this.x / 40), ty = Math.floor(this.y / 40);
    this.inCover = this.world.isCoverTile(tx, ty);
    this.inDark = this.world.isDarkTile(tx, ty);
    this.waterSlow = this.world.isWaterTile(tx, ty);
    return len > 0;
  }
  // Throw a coin toward (tx,ty); returns a Coin or null when out of coins.
  throwCoin(tx, ty) {
    if (this.coins <= 0) return null;
    this.coins--;
    const dx = tx - this.x, dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    const range = Math.min(d, GADGETS.coinThrowRange);
    const k = d > 0 ? range / d : 0;
    return { x: this.x + dx * k, y: this.y + dy * k };
  }
  // Drop a smoke vial at the player's feet; returns false when out of smoke.
  dropSmoke() {
    if (this.smokes <= 0) return false;
    this.smokes--;
    return true;
  }
}
