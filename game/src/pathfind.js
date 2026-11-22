// pathfind.js — A* on the tile grid for patrols and chases. Pure logic.
import { TILE } from './config.js';

// `solid(tx,ty)` answers whether a tile blocks movement.
export function findPath(solid, sx, sy, tx, ty, maxNodes = 4000) {
  if (sx === tx && sy === ty) return [{ x: sx, y: sy }];
  const key = (x, y) => x + ',' + y;
  const open = [{ x: sx, y: sy, g: 0, f: 0, parent: null }];
  const best = new Map([[key(sx, sy), 0]]);
  const closed = new Set();
  const h = (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
  let nodes = 0;
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === tx && cur.y === ty) {
      const path = [];
      let n = cur;
      while (n) { path.push({ x: n.x, y: n.y }); n = n.parent; }
      return path.reverse();
    }
    closed.add(key(cur.x, cur.y));
    if (++nodes > maxNodes) return null;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (solid(nx, ny) || closed.has(key(nx, ny))) continue;
      const g = cur.g + 1;
      if (best.has(key(nx, ny)) && best.get(key(nx, ny)) <= g) continue;
      best.set(key(nx, ny), g);
      open.push({ x: nx, y: ny, g, f: g + h(nx, ny), parent: cur });
    }
  }
  return null;
}

export function tileOf(px, py) {
  return { tx: Math.floor(px / TILE), ty: Math.floor(py / TILE) };
}
export function tileCenterPx(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}
