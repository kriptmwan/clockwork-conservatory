// world.js — tilemap queries: solidity, line of sight, circle collision.
// Pure logic, no DOM: node can import this.
import { TILE, COLS, ROWS } from './config.js';

export const SOLID = new Set(['#', 'H']);
export const COVER = new Set(['B']);
export const DARK = new Set(['D']);
export const WATER = new Set(['~']);

export class World {
  constructor(grid) {
    this.grid = grid;
    this.rows = grid.length;
    this.cols = grid[0].length;
  }
  tileAt(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) return '#';
    return this.grid[ty][tx];
  }
  isSolidTile(tx, ty) { return SOLID.has(this.tileAt(tx, ty)); }
  isCoverTile(tx, ty) { return COVER.has(this.tileAt(tx, ty)); }
  isDarkTile(tx, ty) { return DARK.has(this.tileAt(tx, ty)); }
  isWaterTile(tx, ty) { return WATER.has(this.tileAt(tx, ty)); }
  // Solid for movement: walls and hedges block; bushes/water/dark are walkable.
  blockedAt(px, py, radius) {
    const x0 = Math.floor((px - radius) / TILE);
    const x1 = Math.floor((px + radius) / TILE);
    const y0 = Math.floor((py - radius) / TILE);
    const y1 = Math.floor((py + radius) / TILE);
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        if (!this.isSolidTile(tx, ty)) continue;
        const cx = clamp(px, tx * TILE, tx * TILE + TILE);
        const cy = clamp(py, ty * TILE, ty * TILE + TILE);
        const dx = px - cx, dy = py - cy;
        if (dx * dx + dy * dy < radius * radius) return true;
      }
    }
    return false;
  }
  // Move a circle, sliding along walls: try full step, then each axis alone.
  moveCircle(pos, dx, dy, radius) {
    const nx = pos.x + dx, ny = pos.y + dy;
    if (!this.blockedAt(nx, ny, radius)) { pos.x = nx; pos.y = ny; return; }
    if (!this.blockedAt(nx, pos.y, radius)) { pos.x = nx; return; }
    if (!this.blockedAt(pos.x, ny, radius)) { pos.y = ny; }
  }
  // Line of sight between two points, sampled finely; walls and hedges block.
  hasLOS(ax, ay, bx, by) {
    const d = Math.hypot(bx - ax, by - ay);
    const steps = Math.max(1, Math.ceil(d / 6));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const x = ax + (bx - ax) * t, y = ay + (by - ay) * t;
      if (this.isSolidTile(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
    }
    return true;
  }
  // Distance along a ray to the first solid tile (for FOV cones).
  rayHit(ax, ay, angle, maxDist) {
    const step = 6;
    const dx = Math.cos(angle), dy = Math.sin(angle);
    for (let d = step; d <= maxDist; d += step) {
      const x = ax + dx * d, y = ay + dy * d;
      if (this.isSolidTile(Math.floor(x / TILE), Math.floor(y / TILE))) return d;
    }
    return maxDist;
  }
  tileCenter(tx, ty) { return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }; }
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
