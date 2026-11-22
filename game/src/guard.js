// guard.js — clockwork sentinel: Patrol → Inspect → Alert → Search → Return.
// Pure logic (world + pathfind only); rendering lives in render.js.
import { GUARD, TILE } from './config.js';
import { canSee } from './raycast.js';
import { findPath, tileOf, tileCenterPx } from './pathfind.js';
import { turnToward, angleTo, clamp } from './utils.js';

export class Guard {
  constructor(world, def, index) {
    this.world = world;
    this.index = index;
    this.waypoints = def.path.map(([tx, ty]) => ({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }));
    this.pause = def.pause ?? 1.0;
    this.x = this.waypoints[0].x;
    this.y = this.waypoints[0].y;
    this.angle = 0;
    this.state = 'patrol';
    this.wpIndex = 1;
    this.waitT = 0;
    this.lookT = 0;
    this.lookFrom = 0;
    this.detect = 0; // 0..1 detection meter
    this.path = null;
    this.pathI = 0;
    this.target = null; // {x, y} being walked to
    this.lastSeen = null;
    this.lastSeenT = -999;
    this.searchPoints = [];
    this.searchI = 0;
    this.suspicion = 0;
    this.speedMul = 1;
    this.stuckT = 0;
    this.prevX = this.x; this.prevY = this.y;
  }

  speedFor(state) {
    const base = state === 'patrol' ? GUARD.patrolSpeed
      : state === 'inspect' ? GUARD.inspectSpeed
      : state === 'alert' ? GUARD.chaseSpeed
      : state === 'search' ? GUARD.searchSpeed : GUARD.returnSpeed;
    return base * this.speedMul * (this.state === 'alert' ? 1 : 1);
  }

  setPathTo(tx, ty) {
    const from = tileOf(this.x, this.y);
    const solid = (x, y) => this.world.isSolidTile(x, y);
    const p = findPath(solid, from.tx, from.ty, tx, ty);
    if (!p || p.length < 2) { this.path = null; return false; }
    this.path = p.slice(1).map((t) => tileCenterPx(t.x, t.y));
    this.pathI = 0;
    return true;
  }

  followPath(dt, speed) {
    if (!this.path || this.pathI >= this.path.length) return true;
    const pt = this.path[this.pathI];
    const dx = pt.x - this.x, dy = pt.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 6) { this.pathI++; return this.pathI >= this.path.length; }
    const step = speed * dt;
    this.x += (dx / d) * Math.min(step, d);
    this.y += (dy / d) * Math.min(step, d);
    this.angle = turnToward(this.angle, Math.atan2(dy, dx), 6 * dt);
    return false;
  }

  // One simulation step. `player` carries x,y,sneaking,inCover,inDark,inSmoke.
  // `events` collects {type:'seen'|'heard'|'lost', ...} for the game to score.
  // `now` is the level clock; `hunted` boosts guard speed.
  update(dt, player, events, now, hunted) {
    this.speedMul = hunted ? 1.15 : 1;
    // --- vision ---
    const seen = canSee(this.world, this.x, this.y, this.angle, GUARD.fov,
      GUARD.viewRange, player.x, player.y,
      { inCover: player.inCover, inDark: player.inDark, sneaking: player.sneaking });
    const blinded = player.inSmoke;
    if (seen.seen && !blinded) {
      this.detect = clamp(this.detect + dt / GUARD.detectFill, 0, 1);
      this.lastSeen = { x: player.x, y: player.y };
      this.lastSeenT = now;
      if (this.detect >= 1 && this.state !== 'alert') {
        this.state = 'alert';
        this.path = null;
        events.push({ type: 'spotted', guard: this.index });
      }
    } else {
      this.detect = clamp(this.detect - dt * GUARD.detectDecay, 0, 1);
    }
    // --- hearing: noises arrive via player.noise {x,y,radius,until} ---
    if (player.noise && now < player.noise.until && this.state !== 'alert') {
      const d = Math.hypot(player.noise.x - this.x, player.noise.y - this.y);
      if (d < player.noise.radius) {
        this.hearNoise(player.noise.x, player.noise.y, events);
      }
    }
    // --- FSM ---
    if (this.state === 'patrol') this.updatePatrol(dt);
    else if (this.state === 'inspect') this.updateInspect(dt, events);
    else if (this.state === 'alert') this.updateAlert(dt, player, events, now);
    else if (this.state === 'search') this.updateSearch(dt, events);
    else if (this.state === 'return') this.updateReturn(dt);
    // stuck detection: if barely moved while following a path, drop it.
    const moved = Math.hypot(this.x - this.prevX, this.y - this.prevY);
    if (this.path && moved < 1 && this.state !== 'patrol') { this.stuckT += dt; if (this.stuckT > 1.2) { this.path = null; this.stuckT = 0; } }
    else this.stuckT = 0;
    this.prevX = this.x; this.prevY = this.y;
  }

  hearNoise(x, y, events) {
    if (this.state === 'alert') return;
    this.state = 'inspect';
    this.target = { x, y };
    this.path = null;
    this.setPathTo(Math.floor(x / TILE), Math.floor(y / TILE));
    events.push({ type: 'heard', guard: this.index });
  }

  updatePatrol(dt) {
    const wp = this.waypoints[this.wpIndex];
    const dx = wp.x - this.x, dy = wp.y - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) {
      if (this.waitT <= 0) this.waitT = this.pause;
      this.waitT -= dt;
      // look around while waiting at a waypoint
      this.angle += Math.sin((this.pause - this.waitT) * 2.2) * 0.35 * dt;
      if (this.waitT <= 0) { this.wpIndex = (this.wpIndex + 1) % this.waypoints.length; }
      return;
    }
    const step = GUARD.patrolSpeed * this.speedMul * dt;
    this.x += (dx / d) * Math.min(step, d);
    this.y += (dy / d) * Math.min(step, d);
    this.angle = turnToward(this.angle, Math.atan2(dy, dx), 5 * dt);
  }

  updateInspect(dt, events) {
    if (this.target) {
      const done = this.followPath(dt, GUARD.inspectSpeed);
      if (done) {
        // arrived: look around for a moment, then give up
        this.lookT += dt;
        this.angle += Math.sin(this.lookT * 3) * 1.4 * dt;
        if (this.lookT > 2.2) {
          this.state = 'return';
          this.lookT = 0;
          this.target = null;
          events.push({ type: 'gaveup', guard: this.index });
        }
      }
    } else {
      this.state = 'return';
    }
  }

  updateAlert(dt, player, events, now) {
    // Chase the player while visible; otherwise head for the last seen spot.
    const seen = canSee(this.world, this.x, this.y, this.angle, GUARD.fov,
      GUARD.viewRange, player.x, player.y,
      { inCover: player.inCover, inDark: player.inDark, sneaking: player.sneaking });
    const blinded = player.inSmoke;
    if (seen.seen && !blinded) {
      this.lastSeen = { x: player.x, y: player.y };
      this.lastSeenT = now;
      // steer directly at the player (short range), re-path for longer chases
      const d = Math.hypot(player.x - this.x, player.y - this.y);
      if (d < 130) {
        const step = GUARD.chaseSpeed * this.speedMul * dt;
        const dx = player.x - this.x, dy = player.y - this.y;
        const nx = this.x + (dx / d) * step, ny = this.y + (dy / d) * step;
        if (!this.world.blockedAt(nx, ny, GUARD.radius)) { this.x = nx; this.y = ny; }
        this.angle = turnToward(this.angle, Math.atan2(dy, dx), 8 * dt);
        this.path = null;
      } else if (!this.path || this.pathI >= (this.path?.length ?? 0)) {
        this.setPathTo(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
      }
      if (this.path) this.followPath(dt, GUARD.chaseSpeed * this.speedMul);
    } else {
      // lost sight: run to the last seen spot, then search around it
      if (this.lastSeen) {
        if (!this.path) this.setPathTo(Math.floor(this.lastSeen.x / TILE), Math.floor(this.lastSeen.y / TILE));
        const done = this.path ? this.followPath(dt, GUARD.chaseSpeed * this.speedMul) : true;
        if (done || now - this.lastSeenT > GUARD.memory) {
          this.state = 'search';
          this.searchPoints = [
            { x: this.lastSeen.x + 70, y: this.lastSeen.y },
            { x: this.lastSeen.x - 70, y: this.lastSeen.y },
            { x: this.lastSeen.x, y: this.lastSeen.y + 70 },
            { x: this.lastSeen.x, y: this.lastSeen.y - 70 },
          ].filter((p) => !this.world.blockedAt(p.x, p.y, GUARD.radius));
          this.searchI = 0;
          this.path = null;
          events.push({ type: 'lost', guard: this.index });
        }
      } else {
        this.state = 'search';
      }
    }
    // caught?
    if (Math.hypot(player.x - this.x, player.y - this.y) < GUARD.catchRadius) {
      events.push({ type: 'caught', guard: this.index });
    }
  }

  updateSearch(dt, events) {
    if (this.searchI >= this.searchPoints.length) { this.state = 'return'; this.path = null; return; }
    const pt = this.searchPoints[this.searchI];
    if (!this.path) this.setPathTo(Math.floor(pt.x / TILE), Math.floor(pt.y / TILE));
    const done = this.path ? this.followPath(dt, GUARD.searchSpeed * this.speedMul) : true;
    if (done) {
      this.lookT += dt;
      this.angle += 1.6 * dt;
      if (this.lookT > 1.4) { this.lookT = 0; this.searchI++; this.path = null; }
    }
  }

  updateReturn(dt) {
    if (!this.path) {
      // walk back to the nearest waypoint, then resume the patrol loop
      let best = 0, bestD = Infinity;
      this.waypoints.forEach((w, i) => {
        const d = Math.hypot(w.x - this.x, w.y - this.y);
        if (d < bestD) { bestD = d; best = i; }
      });
      this.wpIndex = best;
      const t = tileOf(this.waypoints[best].x, this.waypoints[best].y);
      if (!this.setPathTo(t.tx, t.ty)) { this.state = 'patrol'; return; }
    }
    const done = this.followPath(dt, GUARD.returnSpeed * this.speedMul);
    if (done) { this.state = 'patrol'; this.path = null; }
  }
}
