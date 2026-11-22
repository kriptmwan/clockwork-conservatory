// raycast.js — vision-cone polygons by casting rays against the world.
// Pure logic, no DOM.
export function conePolygon(world, x, y, angle, fov, range, rays = 26) {
  const pts = [{ x, y }];
  for (let i = 0; i <= rays; i++) {
    const a = angle - fov / 2 + (fov * i) / rays;
    const d = world.rayHit(x, y, a, range);
    pts.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
  }
  return pts;
}

// Can `seer` at (x,y) facing `angle` with half-FOV `fov` and `range` see the
// target at (tx,ty)? Walls block; `inCover` (bush) and `inDark` shrink range.
export function canSee(world, x, y, angle, fov, range, tx, ty, opts = {}) {
  const dx = tx - x, dy = ty - y;
  const d = Math.hypot(dx, dy);
  let r = range;
  if (opts.inDark) r *= 0.5;
  if (opts.inCover) r *= 0.22;
  if (opts.sneaking) r *= 0.64;
  if (d > r) return { seen: false, dist: d, range: r };
  if (d < 26) return { seen: true, dist: d, range: r }; // too close to miss
  const targetAngle = Math.atan2(dy, dx);
  let diff = targetAngle - angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  if (Math.abs(diff) > fov / 2) return { seen: false, dist: d, range: r };
  if (!world.hasLOS(x, y, tx, ty)) return { seen: false, dist: d, range: r };
  return { seen: true, dist: d, range: r };
}
