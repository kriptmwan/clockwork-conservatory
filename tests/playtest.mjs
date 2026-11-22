// playtest.mjs — headless logic tests + a scripted bot that plays level 1.
// Run: node tests/playtest.mjs
import { Game } from '../game/src/game.js';
import { World } from '../game/src/world.js';
import { LEVELS, parseLevel, tileCenter } from '../game/src/levels.js';
import { findPath } from '../game/src/pathfind.js';
import { TILE } from '../game/src/config.js';

let pass = 0, fail = 0;
function check(name, ok, extra = '') {
  if (ok) { pass++; console.log('PASS', name, extra); }
  else { fail++; console.log('FAIL', name, extra); }
}
const EMPTY = { up: false, down: false, left: false, right: false, sneak: false, throwCoin: null, smoke: false };

// --- 1. A* solvability: spawn -> every loot -> exit, all levels ---
for (let i = 0; i < LEVELS.length; i++) {
  const def = parseLevel(LEVELS[i], i);
  const world = new World(def.grid);
  const solid = (x, y) => world.isSolidTile(x, y);
  let ok = true;
  const targets = [...def.loot.map((l) => [l.tx, l.ty]), [def.exit.x, def.exit.y]];
  for (const [tx, ty] of targets) {
    if (!findPath(solid, def.spawn.x, def.spawn.y, tx, ty)) { ok = false; console.log('  no path to', tx, ty); }
  }
  check(`L${i + 1} A* spawn->loot+exit`, ok);
}

// --- 2. Guard vision: seen in the open, hidden in a bush ---
function frozenGuard(g, gx = 400, gy = 360, angle = 0) {
  // pin the guard in place (waypoints = its own tile) so the test measures
  // vision, not patrol drift
  const guard = g.guards[0];
  guard.x = gx; guard.y = gy; guard.angle = angle;
  guard.waypoints = [{ x: gx, y: gy }];
  guard.wpIndex = 0;
  return guard;
}
{
  const g = new Game();
  g.loadLevel(0); g.screen = 'play';
  const guard = frozenGuard(g);
  g.player.x = 520; g.player.y = 360;
  g.player.inCover = false; g.player.inDark = false; g.player.sneaking = false;
  for (let i = 0; i < 90; i++) g.update(1 / 60, EMPTY);
  check('guard spots player in open cone', guard.state === 'alert' || guard.detect > 0.9, `detect=${guard.detect.toFixed(2)} state=${guard.state}`);
}

// --- 3. Bush cover blocks vision at the same distance ---
// Guard at (220,100) facing west; player stands on the planter at (3,2),
// 80px away — inside open sight range, outside bush sight range (235*0.22).
{
  const g = new Game();
  g.loadLevel(0); g.screen = 'play';
  const guard = frozenGuard(g, 220, 100, Math.PI);
  g.player.x = 140; g.player.y = 100; // tile (3,2) is a planter
  for (let i = 0; i < 90; i++) g.update(1 / 60, EMPTY);
  check('bush hides player at 80px', guard.detect < 0.3, `detect=${guard.detect.toFixed(2)}`);
}

// --- 4. Coin lure: guards investigate the clink ---
{
  const g = new Game();
  g.loadLevel(0); g.screen = 'play';
  const guard = g.guards[0];
  const before = guard.state;
  g.player.x = 200; g.player.y = 200;
  g.coins.push(new (await import('../game/src/gadgets.js')).Coin(200, 200, guard.x + 30, guard.y));
  // wait for the coin to land and ring
  for (let i = 0; i < 60; i++) g.update(1 / 60, EMPTY);
  check('coin lure pulls a guard to inspect', guard.state === 'inspect', `was=${before} now=${guard.state}`);
}

// --- 5. Smoke blocks vision ---
{
  const g = new Game();
  g.loadLevel(0); g.screen = 'play';
  const guard = frozenGuard(g);
  g.player.x = 520; g.player.y = 360;
  const { Smoke } = await import('../game/src/gadgets.js');
  g.smokes.push(new Smoke(g.player.x, g.player.y));
  for (let i = 0; i < 60; i++) g.update(1 / 60, EMPTY);
  check('smoke blocks guard vision', guard.detect < 0.2, `detect=${guard.detect.toFixed(2)}`);
}

// --- 6. Lasers cycle and trip when crossed live ---
{
  const g = new Game();
  g.loadLevel(1); g.screen = 'play'; // L2 has lasers
  const laser = g.lasers[0];
  let sawOn = false, sawOff = false;
  for (let i = 0; i < 600; i++) { laser.update(1 / 60); if (laser.active) sawOn = true; else sawOff = true; }
  check('laser cycles on and off', sawOn && sawOff);
  // cross while active
  const mid = { x: (laser.a.x + laser.b.x) / 2, y: (laser.a.y + laser.b.y) / 2 };
  while (!laser.active) laser.update(1 / 60);
  const alarmsBefore = g.alarmsRaised;
  g.player.x = mid.x; g.player.y = mid.y;
  g.update(1 / 60, EMPTY);
  check('crossing a live laser raises the alarm', g.alarmsRaised > alarmsBefore);
}

// --- 7. Tripwire: walking trips, sneaking slips under ---
{
  const g = new Game();
  g.loadLevel(2); g.screen = 'play'; // L3 has tripwires
  const w = g.tripwires[0];
  const mid = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
  const a0 = g.alarmsRaised;
  g.player.x = mid.x; g.player.y = mid.y; g.player.sneaking = false;
  g.update(1 / 60, EMPTY);
  const trippedWalking = g.alarmsRaised > a0;
  const g2 = new Game();
  g2.loadLevel(2); g2.screen = 'play';
  const w2 = g2.tripwires[0];
  const mid2 = { x: (w2.a.x + w2.b.x) / 2, y: (w2.a.y + w2.b.y) / 2 };
  g2.player.x = mid2.x; g2.player.y = mid2.y;
  g2.update(1 / 60, { ...EMPTY, sneak: true });
  check('tripwire trips when walking', trippedWalking);
  check('tripwire safe while sneaking', g2.alarmsRaised === 0);
}

// --- 8. Camera spots the player (L3 west camera faces down an open hall) ---
{
  const g = new Game();
  g.loadLevel(2); g.screen = 'play';
  const cam = g.cameras[1]; // (1,9), facing right down row 9
  g.player.x = cam.x + 150;
  g.player.y = cam.y;
  for (let i = 0; i < 120; i++) g.update(1 / 60, EMPTY);
  check('camera raises alarm when player crosses its cone', g.alarmsRaised > 0, `alarms=${g.alarmsRaised} camDetect=${cam.detect.toFixed(2)}`);
}

// --- 9. Cautious bot plays level 1 to completion ---
// Strategy: sneak along A* paths, wait out patrol windows before stepping
// into a cone, and hide in a planter when a sentinel gets suspicious.
{
  const { canSee } = await import('../game/src/raycast.js');
  const g = new Game();
  g.startGame();
  g.screen = 'play';
  const world = g.world;
  const solid = (x, y) => world.isSolidTile(x, y);
  const bushes = [];
  for (let ty = 0; ty < world.rows; ty++)
    for (let tx = 0; tx < world.cols; tx++)
      if (world.isCoverTile(tx, ty)) bushes.push(tileCenter(tx, ty));
  const nearestBush = (x, y) => {
    let best = null, bestD = Infinity;
    for (const b of bushes) {
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  };
  const waypointVisible = (wx, wy) => {
    for (const gd of g.guards) {
      const r = canSee(world, gd.x, gd.y, gd.angle, 1.22, 250, wx, wy, { sneaking: true });
      if (r.seen) return true;
    }
    return false;
  };
  let steps = 0;
  let path = null;
  let mode = 'go';
  let hideUntilSafe = 0;
  const pickTarget = () => {
    const remaining = g.level.loot.filter((l) => !l.taken);
    if (remaining.length && g.lootTaken < g.lootQuota) {
      let best = null, bestD = Infinity;
      for (const l of remaining) {
        const c = tileCenter(l.tx, l.ty);
        const d = Math.hypot(c.x - g.player.x, c.y - g.player.y);
        if (d < bestD) { bestD = d; best = c; }
      }
      return best;
    }
    return tileCenter(g.level.exit.x, g.level.exit.y);
  };
  const pathTo = (tx, ty) => {
    const from = { tx: Math.floor(g.player.x / TILE), ty: Math.floor(g.player.y / TILE) };
    const p = findPath(solid, from.tx, from.ty, Math.floor(tx / TILE), Math.floor(ty / TILE));
    return p ? p.slice(1).map((t) => tileCenter(t.x, t.y)) : [{ x: tx, y: ty }];
  };
  const stepToward = (wp, sneak) => {
    const dx = wp.x - g.player.x, dy = wp.y - g.player.y;
    const d = Math.hypot(dx, dy);
    if (d < 8) return true;
    const input = { ...EMPTY, sneak };
    if (dx > 4) input.right = true; else if (dx < -4) input.left = true;
    if (dy > 4) input.down = true; else if (dy < -4) input.up = true;
    g.update(1 / 60, input);
    return false;
  };
  let caught = false;
  let waits = 0;
  while (g.screen === 'play' && steps < 60 * 420) {
    steps++;
    const alertGuard = g.guards.find((gd) => gd.state === 'alert');
    const inBush = g.player.inCover;
    if (alertGuard && !inBush) {
      mode = 'hide'; path = null;
    }
    if (mode === 'hide') {
      const bush = nearestBush(g.player.x, g.player.y);
      if (!path) path = pathTo(bush.x, bush.y);
      if (path.length === 0 || stepToward(path[0], false)) {
        if (path.length) path.shift();
        if (g.player.inCover) {
          const safe = !g.guards.some((gd) => gd.state === 'alert' || gd.detect > 0.1 || Math.hypot(gd.x - g.player.x, gd.y - g.player.y) < 200);
          if (safe) { mode = 'go'; path = null; }
          else g.update(1 / 60, { ...EMPTY, sneak: true });
        }
      }
      if (g.screen === 'caught') { caught = true; break; }
      continue;
    }
    // go mode: wait for a clear window before stepping into a cone
    if (!path) {
      const target = pickTarget();
      path = pathTo(target.x, target.y);
    }
    const wp = path[0];
    if (!wp) { path = null; continue; }
    if (waypointVisible(wp.x, wp.y)) {
      // never wait in the open: fall back to a planter and try again later
      mode = 'hide'; path = null; waits++;
      continue;
    }
    if (stepToward(wp, true)) path.shift();
    if (g.screen === 'caught') { caught = true; break; }
  }
  check('cautious bot completes level 1', g.screen === 'leveldone', `screen=${g.screen} steps=${steps} time=${g.levelTime.toFixed(1)}s loot=${g.lootTaken}/${g.level.loot.length} stars=${g.stars} score=${g.levelScore} spotted=${g.spotted} waits=${waits}`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
