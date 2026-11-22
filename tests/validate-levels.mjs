// validate-levels.mjs — checks every level grid: shape, borders, reachability.
import { LEVELS, parseLevel } from '../game/src/levels.js';
import { COLS, ROWS } from '../game/src/config.js';

const SOLID = new Set(['#', 'H']);
function walkable(c) { return !SOLID.has(c); }

let errors = 0;
LEVELS.forEach((def, i) => {
  const tag = `L${i + 1} ${def.name}`;
  if (def.grid.length !== ROWS) { console.log(tag, 'BAD ROW COUNT', def.grid.length); errors++; }
  def.grid.forEach((row, y) => {
    if (row.length !== COLS) { console.log(tag, 'row', y, 'len', row.length, JSON.stringify(row)); errors++; }
  });
  const p = parseLevel(def, i);
  if (p.spawnCount !== 1) { console.log(tag, 'spawn count', p.spawnCount); errors++; }
  if (p.exitCount !== 1) { console.log(tag, 'exit count', p.exitCount); errors++; }
  console.log(tag, 'loot:', p.loot.length, 'guards:', def.guards.length, 'cameras:', def.cameras.length, 'lasers:', def.lasers.length, 'tripwires:', def.tripwires.length);
  // Flood fill from spawn over walkable tiles (bush/dark/water walkable).
  const seen = new Set([p.spawn.x + ',' + p.spawn.y]);
  const q = [[p.spawn.x, p.spawn.y]];
  while (q.length) {
    const [x, y] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || ny >= ROWS || nx >= COLS) continue;
      const k = nx + ',' + ny;
      if (seen.has(k)) continue;
      if (!walkable(p.grid[ny][nx])) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  const need = (label, x, y) => {
    if (!seen.has(x + ',' + y)) { console.log(tag, 'UNREACHABLE', label, x, y, 'tile=', p.grid[y][x]); errors++; }
  };
  need('exit', p.exit.x, p.exit.y);
  p.loot.forEach((l, j) => need('loot' + j, l.tx, l.ty));
  def.guards.forEach((g, j) => g.path.forEach(([x, y], k) => {
    if (!walkable(p.grid[y][x])) { console.log(tag, 'guard', j, 'wp', k, 'on solid', x, y, p.grid[y][x]); errors++; }
    need('guard' + j + 'wp' + k, x, y);
  }));
  def.cameras.forEach((c, j) => { if (!walkable(p.grid[c.ty][c.tx])) { console.log(tag, 'camera', j, 'on solid'); errors++; } });
  def.lasers.forEach((l, j) => {
    [l.a, l.b].forEach(([x, y]) => { if (!walkable(p.grid[y][x])) { console.log(tag, 'laser', j, 'endpoint on solid', x, y); errors++; } });
  });
  def.tripwires.forEach((t, j) => {
    [t.a, t.b].forEach(([x, y]) => { if (!walkable(p.grid[y][x])) { console.log(tag, 'tripwire', j, 'endpoint on solid', x, y); errors++; } });
  });
});
console.log(errors === 0 ? 'ALL LEVELS OK' : errors + ' ERRORS');
process.exit(errors === 0 ? 0 : 1);
