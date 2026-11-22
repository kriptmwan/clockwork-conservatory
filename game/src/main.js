// main.js — bootstrap: canvas fit, game loop, input wiring, ?shot= staging.
import { Game } from './game.js';
import { Renderer } from './render.js';
import { drawHUD, drawScreens } from './hud.js';
import { AudioEngine } from './audio.js';
import { Input } from './input.js';
import { stageShot } from './shots.js';
import { VIEW_W, VIEW_H } from './config.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');

function fitCanvas() {
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  canvas.style.width = Math.floor(VIEW_W * scale) + 'px';
  canvas.style.height = Math.floor(VIEW_H * scale) + 'px';
}
window.addEventListener('resize', fitCanvas);
fitCanvas();

const audio = new AudioEngine();
const game = new Game({ sfx: (name) => audio.play(name) });
const renderer = new Renderer();
window.__game = game;

const toGameCoords = (cx, cy) => {
  const r = canvas.getBoundingClientRect();
  return { x: (cx / r.width) * VIEW_W, y: (cy / r.height) * VIEW_H };
};
const input = new Input(canvas, toGameCoords);
let pendingThrow = null;
let pendingSmoke = false;
input.onThrow = (g) => { pendingThrow = g; };
input.onMute = () => { audio.toggleMute(); };
input.onKey = (k) => {
  audio.ensure();
  if (k === 'enter' || k === ' ') { game.handleKey('enter'); return; }
  if (k === 'escape' || k === 'p') { game.handleKey(k === 'escape' ? 'escape' : 'p'); return; }
  if (k === 'r') { game.handleKey('r'); return; }
  if (k === 'e') { pendingSmoke = true; return; }
  if (k === 'f') {
    const m = input.mouse;
    pendingThrow = { x: m.x || game.player.x + Math.cos(game.player.angle) * 160, y: m.y || game.player.y + Math.sin(game.player.angle) * 160 };
  }
};

// Deterministic screenshot staging: ?shot=start|play|alarm|end&seed=N
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
if (shot) stageShot(game, shot);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const st = input.state;
  if (game.screen === 'play') {
    st.throwCoin = pendingThrow;
    st.smoke = pendingSmoke;
  }
  pendingThrow = null;
  pendingSmoke = false;
  game.update(dt, st);
  renderer.draw(ctx, game);
  if (game.screen === 'play' || game.screen === 'paused') drawHUD(ctx, game);
  drawScreens(ctx, game);
  if (statusEl) {
    statusEl.textContent = `The Clockwork Conservatory — Heist ${game.levelIndex + 1} of 5: ${game.level.name}. ${game.alarmLabel}. Loot ${game.lootTaken} of ${game.level.loot.length}. Score ${game.totalScore + game.levelScore}.`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
