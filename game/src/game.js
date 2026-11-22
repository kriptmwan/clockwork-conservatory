// game.js — The Clockwork Conservatory: state machine, levels, alarm, scoring.
// Pure logic: no DOM, no canvas here. Rendering reads this state; audio and
// particles arrive through hooks so node can drive it headlessly.
import { LEVELS, parseLevel, tileCenter } from './levels.js';
import { World } from './world.js';
import { Guard } from './guard.js';
import { SecurityCamera } from './camera.js';
import { Laser, Tripwire } from './laser.js';
import { Coin, Smoke } from './gadgets.js';
import { Player } from './player.js';
import { Particles } from './particles.js';
import { GADGETS, ALARM, TILE } from './config.js';
import { clamp, fmtTime } from './utils.js';

export const SCREENS = ['title', 'intro', 'play', 'paused', 'leveldone', 'caught', 'gamedone'];

export class Game {
  constructor(hooks = {}) {
    this.hooks = { sfx: () => {}, ...hooks };
    this.particles = new Particles(7);
    this.screen = 'title';
    this.levelIndex = 0;
    this.totalScore = 0;
    this.totalTime = 0;
    this.bestStreak = 0;
    this.levelsDone = [];
    this.loadLevel(0);
  }

  loadLevel(i) {
    this.levelIndex = i;
    const def = parseLevel(LEVELS[i], i);
    this.level = def;
    this.world = new World(def.grid);
    const s = tileCenter(def.spawn.x, def.spawn.y);
    this.player = new Player(this.world, s.x, s.y);
    this.guards = def.guards.map((g, j) => new Guard(this.world, g, j));
    this.cameras = def.cameras.map((c) => new SecurityCamera(this.world, c));
    this.lasers = def.lasers.map((l) => new Laser(l));
    this.tripwires = def.tripwires.map((t) => new Tripwire(t));
    this.coins = [];
    this.smokes = [];
    this.lootTaken = 0;
    this.lootQuota = Math.max(1, Math.ceil(def.loot.length * 0.66));
    this.levelTime = 0;
    this.alarm = 0; // 0 calm, 1 suspicious, 2 hunted
    this.alarmT = 0; // seconds since last alarm stimulus
    this.spotted = 0; // times a guard/camera/laser/tripwire raised the alarm
    this.alarmsRaised = 0;
    this.noiseEvents = 0;
    this.coinsThrown = 0;
    this.smokesUsed = 0;
    this.toast = null;
    this.toastT = 0;
    this.shake = 0;
    this.flash = 0;
    this.caughtBy = null;
    this.stars = 0;
    this.levelScore = 0;
    this.exitOpen = false;
    this.exitToastT = 0;
  }

  say(text, dur = 2.6) { this.toast = text; this.toastT = dur; }

  raiseAlarm(level, reason) {
    if (level > this.alarm) {
      this.alarm = level;
      if (level === 2) {
        this.alarmsRaised++;
        this.spotted++;
        this.shake = 9;
        this.flash = 0.5;
        this.hooks.sfx('alarm');
        this.say(reason, 2.2);
      } else if (level === 1) {
        this.hooks.sfx('suspicious');
      }
    }
    this.alarmT = 0;
  }

  update(dt, input) {
    this.particles.update(dt);
    if (this.toastT > 0) this.toastT -= dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 22);
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt * 1.4);
    if (this.screen !== 'play') return;
    this.levelTime += dt;
    this.totalTime += dt;
    this.alarmT += dt;
    // alarm decays back to calm after a quiet stretch
    if (this.alarm > 0 && this.alarmT > ALARM.calmDecay) {
      this.alarm = 0;
      this.say('The glasshouse settles… you are unseen again.', 2.2);
    }
    const now = this.levelTime;
    const p = this.player;

    // --- gadgets from input ---
    if (input.throwCoin && p.coins > 0) {
      const target = p.throwCoin(input.throwCoin.x, input.throwCoin.y);
      if (target) {
        this.coins.push(new Coin(p.x, p.y, target.x, target.y));
        this.coinsThrown++;
        this.hooks.sfx('throw');
      }
    }
    if (input.smoke && p.smokes > 0) {
      if (p.dropSmoke()) {
        this.smokes.push(new Smoke(p.x, p.y));
        this.smokesUsed++;
        this.hooks.sfx('smoke');
        this.particles.spawn(p.x, p.y, { n: 26, color: '#cbd5e1', speed: 40, life: 1.1, size: 5 });
      }
    }

    // --- player ---
    p.update(dt, input, now);
    p.inSmoke = this.smokes.some((s) => s.covers(p.x, p.y));

    // --- coins: on landing, guards in earshot come to look ---
    for (const c of this.coins) {
      const wasRinging = c.ringing;
      c.update(dt);
      if (c.landed && !wasRinging && !c.announced) {
        c.announced = true;
        this.hooks.sfx('clink');
        this.particles.spawn(c.x, c.y, { n: 8, color: '#fde68a', speed: 50, life: 0.5, size: 2 });
        for (const g of this.guards) {
          if (Math.hypot(g.x - c.x, g.y - c.y) < GADGETS.coinNoise) {
            g.hearNoise(c.x, c.y, []);
            this.noiseEvents++;
          }
        }
      }
    }
    this.coins = this.coins.filter((c) => !c.done);
    for (const s of this.smokes) s.update(dt);
    this.smokes = this.smokes.filter((s) => s.alive);

    // --- entities ---
    const events = [];
    const hunted = this.alarm === 2;
    for (const g of this.guards) g.update(dt, p, events, now, hunted);
    for (const c of this.cameras) c.update(dt, p, events, hunted);
    for (const l of this.lasers) l.update(dt);
    for (const t of this.tripwires) t.update(dt);

    for (const ev of events) {
      if (ev.type === 'spotted') this.raiseAlarm(2, 'SPOTTED! Run — break line of sight!');
      else if (ev.type === 'camera') this.raiseAlarm(2, 'Camera locked on! Break line of sight!');
      else if (ev.type === 'heard') this.raiseAlarm(1, 'A sentinel heard something…');
      else if (ev.type === 'caught') this.getCaught(ev.guard);
    }
    // suspicious while any guard is inspecting or half-suspicious
    if (this.alarm === 0 && this.guards.some((g) => g.state === 'inspect' || g.detect > 0.45)) {
      this.alarm = 1;
      this.alarmT = 0;
    }
    if (this.alarm === 1 && this.guards.every((g) => g.state !== 'inspect' && g.detect <= 0.1)) {
      // stays suspicious until the quiet timer clears it (handled above)
    }

    // --- lasers & tripwires ---
    for (const l of this.lasers) {
      if (l.crosses(p.x, p.y)) {
        if (!l.tripped) {
          l.tripped = true;
          this.raiseAlarm(2, 'Laser beam crossed! The alarm screams!');
          this.particles.spawn(p.x, p.y, { n: 14, color: '#ff3b30', speed: 90, life: 0.6, size: 3 });
        }
      } else l.tripped = false;
    }
    for (const t of this.tripwires) {
      if (t.crosses(p.x, p.y, p.sneaking)) {
        if (!t.tripped) {
          t.tripped = true;
          this.raiseAlarm(2, 'Tripwire! The wire sings and the alarm answers!');
          this.particles.spawn(p.x, p.y, { n: 14, color: '#f472b6', speed: 90, life: 0.6, size: 3 });
        }
      } else t.tripped = false;
    }

    // --- loot ---
    for (const l of this.level.loot) {
      if (l.taken) continue;
      const c = tileCenter(l.tx, l.ty);
      if (Math.hypot(p.x - c.x, p.y - c.y) < 26) {
        l.taken = true;
        this.lootTaken++;
        this.levelScore += l.value;
        this.hooks.sfx('pickup');
        this.particles.spawn(c.x, c.y, { n: 16, color: '#ffd700', speed: 70, life: 0.8, size: 3 });
        if (this.lootTaken === this.lootQuota) {
          this.exitOpen = true;
          this.say('The exit lock clicks open — go, quietly.', 3);
          this.hooks.sfx('unlock');
        } else {
          this.say(l.value >= 500 ? 'The Clockwork Orchid is yours!' : `Curio pocketed — ${this.lootTaken}/${this.level.loot.length} loot`, 1.8);
        }
      }
    }

    // --- exit ---
    const e = tileCenter(this.level.exit.x, this.level.exit.y);
    if (Math.hypot(p.x - e.x, p.y - e.y) < 30) {
      if (this.exitOpen) {
        this.completeLevel();
        return;
      }
      this.exitToastT -= dt;
      if (this.exitToastT <= 0) {
        this.exitToastT = 2.5;
        this.say(`Locked — the exit needs ${this.lootQuota} loot (${this.lootTaken}/${this.lootQuota})`, 2.2);
      }
    }

    // --- ambient motes ---
    this.particles.ambient(0, 0, 1280, 720, dt);
  }

  getCaught(guardIndex) {
    if (this.screen !== 'play') return;
    this.screen = 'caught';
    this.caughtBy = guardIndex;
    this.shake = 14;
    this.hooks.sfx('caught');
    this.particles.spawn(this.player.x, this.player.y, { n: 30, color: '#ff5a4e', speed: 120, life: 0.9, size: 4 });
  }

  completeLevel() {
    const par = this.level.par;
    const timeBonus = Math.max(0, Math.round((par - this.levelTime) * 10));
    const ghostBonus = this.spotted === 0 ? 500 : 0;
    const quietBonus = this.alarmsRaised === 0 ? 300 : 0;
    const allLoot = this.lootTaken === this.level.loot.length;
    this.stars = (this.levelTime <= par && this.alarmsRaised === 0 && allLoot) ? 3
      : (this.levelTime <= par * 1.5 && this.alarmsRaised <= 1) ? 2 : 1;
    const bonus = timeBonus + ghostBonus + quietBonus;
    this.levelScore += bonus;
    this.totalScore += this.levelScore;
    this.levelsDone.push({
      name: this.level.name, stars: this.stars, score: this.levelScore,
      time: this.levelTime, par, loot: this.lootTaken, total: this.level.loot.length,
      spotted: this.spotted, timeBonus, ghostBonus, quietBonus,
    });
    this.hooks.sfx('win');
    this.screen = 'leveldone';
  }

  nextLevel() {
    if (this.levelIndex + 1 >= LEVELS.length) {
      this.screen = 'gamedone';
      return;
    }
    this.loadLevel(this.levelIndex + 1);
    this.screen = 'intro';
  }

  retryLevel() {
    this.totalScore -= 0; // score from this level was never banked
    this.loadLevel(this.levelIndex);
    this.screen = 'intro';
  }

  startGame() {
    this.totalScore = 0;
    this.totalTime = 0;
    this.levelsDone = [];
    this.loadLevel(0);
    this.screen = 'intro';
  }

  // Screen-flow keys: Enter/Space confirm, Esc/P pause, R retry when caught.
  handleKey(key) {
    if (key === 'enter' || key === 'space') {
      if (this.screen === 'title') this.startGame();
      else if (this.screen === 'intro') this.screen = 'play';
      else if (this.screen === 'leveldone') this.nextLevel();
      else if (this.screen === 'caught') this.retryLevel();
      else if (this.screen === 'gamedone') this.screen = 'title';
      return true;
    }
    if (key === 'escape' || key === 'p') {
      if (this.screen === 'play') { this.screen = 'paused'; return true; }
      if (this.screen === 'paused') { this.screen = 'play'; return true; }
    }
    if (key === 'r' && (this.screen === 'caught' || this.screen === 'paused')) {
      this.retryLevel();
      return true;
    }
    return false;
  }

  get maxDetect() {
    return Math.max(0, ...this.guards.map((g) => g.detect), ...this.cameras.map((c) => c.detect));
  }
  get alarmLabel() {
    return this.alarm === 2 ? 'HUNTED' : this.alarm === 1 ? 'SUSPICIOUS' : 'CALM';
  }
  get timeText() { return fmtTime(this.levelTime); }
}
