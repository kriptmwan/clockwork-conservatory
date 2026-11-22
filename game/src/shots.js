// shots.js — deterministic staging for screenshots (?shot=start|play|alarm|end).
// Runs the real game logic forward so every screenshot is a true render.
import { Smoke } from './gadgets.js';
import { tileCenter } from './levels.js';

const EMPTY = { up: false, down: false, left: false, right: false, sneak: false, throwCoin: null, smoke: false };

function simulate(game, seconds) {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) game.update(1 / 60, EMPTY);
}

export function stageShot(game, shot) {
  if (shot === 'start') return; // title screen as-is
  if (shot === 'play') {
    game.startGame();
    game.loadLevel(1); // The Orchid Gallery
    game.screen = 'play';
    const spot = tileCenter(14, 9);
    game.player.x = spot.x; game.player.y = spot.y;
    simulate(game, 6);
    return;
  }
  if (shot === 'alarm') {
    game.startGame();
    game.loadLevel(3); // The Brass Menagerie
    game.screen = 'play';
    const spot = tileCenter(13, 9);
    game.player.x = spot.x; game.player.y = spot.y;
    simulate(game, 6);
    // force the money moment: hunted, smoke out, a sentinel closing in
    game.smokes.push(new Smoke(game.player.x, game.player.y));
    const g = game.guards[0];
    g.state = 'alert';
    g.lastSeen = { x: game.player.x, y: game.player.y };
    g.lastSeenT = game.levelTime;
    g.x = game.player.x - 150; g.y = game.player.y - 90;
    game.raiseAlarm(2, 'SPOTTED! Run — break line of sight!');
    simulate(game, 0.4);
    return;
  }
  if (shot === 'end') {
    game.startGame();
    game.loadLevel(0);
    game.screen = 'play';
    for (const l of game.level.loot) l.taken = true;
    game.lootTaken = game.level.loot.length;
    game.exitOpen = true;
    game.levelScore = 400;
    game.levelTime = 58;
    game.completeLevel();
  }
}
