// config.js — tuning constants and the palette for The Clockwork Conservatory.
export const TILE = 40;
export const VIEW_W = 1280;
export const VIEW_H = 720;
export const COLS = 32;
export const ROWS = 18;

export const PLAYER = {
  walkSpeed: 168,
  sneakSpeed: 92,
  radius: 13,
  // detection: how far a guard can spot the player, in px, before modifiers.
  spotBase: 235,
  spotSneak: 150,
  spotDark: 120,
  spotBush: 55,
  hearWalk: 55,
  hearSneak: 18,
};

export const GUARD = {
  patrolSpeed: 62,
  inspectSpeed: 96,
  chaseSpeed: 172,
  searchSpeed: 84,
  returnSpeed: 88,
  radius: 14,
  fov: 1.22, // ~70 degrees, half-angle 35deg
  viewRange: 250,
  detectFill: 1.15, // seconds of full view to trigger alarm
  detectDecay: 0.55, // per second when unseen
  hearRadius: 300,
  catchRadius: 26,
  memory: 6, // seconds a guard remembers the last seen spot
};

export const CAMERA = {
  viewRange: 215,
  fov: 0.7,
  detectFill: 0.55,
  sweepSpeed: 0.45, // rad/s base
};

export const LASER = {
  onTime: 2.4,
  offTime: 1.6,
};

export const GADGETS = {
  coinsPerLevel: 4,
  coinThrowRange: 260,
  coinNoise: 300,
  smokePerLevel: 2,
  smokeRadius: 96,
  smokeTime: 4.5,
};

export const ALARM = {
  calmDecay: 10, // seconds of quiet before Hunted drops back to Calm
  huntedGuardBoost: 1.15,
};

// Palette: night glasshouse — deep teal glass, warm brass lantern light.
export const PALETTE = {
  bg: '#0a1f1c',
  floorA: '#1d3a33',
  floorB: '#18332d',
  floorDark: '#122722',
  path: '#2c4a3e',
  wall: '#0d2b26',
  wallTop: '#3f6b52',
  brass: '#c9a227',
  brassDim: '#8a6d1f',
  glass: '#123f3a',
  glassHi: '#2f7d6b',
  bush: '#14532d',
  bushHi: '#22c55e',
  water: '#0e4a5e',
  player: '#f5e6c8',
  playerCloak: '#7c3aed',
  guard: '#d4a017',
  guardBody: '#8a6d1f',
  cone: 'rgba(255, 190, 80, 0.26)',
  coneAlert: 'rgba(255, 70, 60, 0.30)',
  camCone: 'rgba(255, 90, 90, 0.20)',
  laser: '#ff3b30',
  tripwire: '#f472b6',
  loot: '#ffd700',
  exit: '#34d399',
  smoke: 'rgba(180, 190, 200, 0.55)',
  hud: '#e8dcc0',
  danger: '#ff5a4e',
};
