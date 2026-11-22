// render.js — canvas drawing for the glasshouse: tiles, cones, entities,
// lighting, particles, minimap. Reads game state; draws nothing else.
import { TILE, VIEW_W, VIEW_H, PALETTE, GUARD, CAMERA } from './config.js';
import { conePolygon } from './raycast.js';
import { tileCenter } from './levels.js';
import { mulberry32 } from './utils.js';

const leafRng = mulberry32(99);
// deterministic leaf speckles per tile so bushes never jitter
function leafDots(tx, ty) {
  const r = mulberry32(tx * 131 + ty * 57 + 7);
  const dots = [];
  for (let i = 0; i < 7; i++) dots.push([r() * TILE, r() * TILE, 2 + r() * 3]);
  return dots;
}

export class Renderer {
  constructor() {
    this.dark = document.createElement('canvas');
    this.dark.width = VIEW_W; this.dark.height = VIEW_H;
  }

  draw(ctx, game) {
    const { world, player } = game;
    ctx.save();
    if (game.shake > 0) {
      ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
    }
    this.drawFloor(ctx, world);
    this.drawLootExit(ctx, game);
    this.drawLasersTripwires(ctx, game);
    this.drawCones(ctx, game);
    this.drawCameras(ctx, game);
    this.drawGuards(ctx, game);
    this.drawCoinsSmoke(ctx, game);
    this.drawPlayer(ctx, game);
    this.drawParticles(ctx, game);
    this.drawBushTops(ctx, world, player);
    this.drawLighting(ctx, game);
    ctx.restore();
    this.drawMinimap(ctx, game);
    if (game.flash > 0) {
      ctx.fillStyle = `rgba(255, 40, 30, ${game.flash * 0.22})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  drawFloor(ctx, world) {
    ctx.fillStyle = PALETTE.bg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    for (let ty = 0; ty < world.rows; ty++) {
      for (let tx = 0; tx < world.cols; tx++) {
        const c = world.tileAt(tx, ty);
        const x = tx * TILE, y = ty * TILE;
        if (c === '#') {
          // brass-framed glass wall
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = PALETTE.glass;
          ctx.fillRect(x + 5, y + 5, TILE - 10, TILE - 10);
          ctx.strokeStyle = PALETTE.brassDim;
          ctx.lineWidth = 2;
          ctx.strokeRect(x + 5.5, y + 5.5, TILE - 11, TILE - 11);
          ctx.strokeStyle = 'rgba(120, 220, 190, 0.25)';
          ctx.beginPath();
          ctx.moveTo(x + 8, y + TILE - 8); ctx.lineTo(x + TILE - 8, y + 8);
          ctx.stroke();
        } else if (c === 'H') {
          ctx.fillStyle = '#0e2f1a';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#1d5c33';
          for (const [dx, dy, r] of leafDots(tx, ty)) {
            ctx.beginPath(); ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2); ctx.fill();
          }
        } else {
          const checker = (tx + ty) % 2 === 0;
          ctx.fillStyle = c === 'D' ? PALETTE.floorDark : c === '~' ? PALETTE.water : checker ? PALETTE.floorA : PALETTE.floorB;
          ctx.fillRect(x, y, TILE, TILE);
          if (c === 'B') {
            ctx.fillStyle = PALETTE.bush;
            ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.42, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = PALETTE.bushHi;
            for (const [dx, dy, r] of leafDots(tx, ty)) {
              ctx.beginPath(); ctx.arc(x + dx, y + dy, r * 0.8, 0, Math.PI * 2); ctx.fill();
            }
          } else if (c === '.') {
            ctx.fillStyle = 'rgba(255, 235, 180, 0.05)';
            ctx.fillRect(x + 3, y + 3, TILE - 6, 2);
          }
        }
      }
    }
  }

  drawLootExit(ctx, game) {
    const t = performance.now() / 1000;
    for (const l of game.level.loot) {
      if (l.taken) continue;
      const c = tileCenter(l.tx, l.ty);
      const pulse = 0.75 + Math.sin(t * 3 + l.tx) * 0.25;
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.fillStyle = PALETTE.loot;
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 14;
      ctx.translate(c.x, c.y);
      ctx.rotate(Math.PI / 4);
      const s = l.value >= 500 ? 11 : 8;
      ctx.fillRect(-s / 2, -s / 2, s, s);
      ctx.restore();
      if (l.value >= 500) {
        ctx.fillStyle = '#fff7cc';
        ctx.font = 'bold 11px Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('ORCHID', c.x, c.y - 18);
      }
    }
    const e = tileCenter(game.level.exit.x, game.level.exit.y);
    ctx.save();
    ctx.translate(e.x, e.y);
    const open = game.exitOpen;
    ctx.fillStyle = open ? PALETTE.exit : '#3f6b52';
    ctx.shadowColor = open ? '#34d399' : '#000';
    ctx.shadowBlur = open ? 22 : 4;
    ctx.fillRect(-14, -18, 28, 36);
    ctx.fillStyle = open ? '#064e3b' : '#123f31';
    ctx.fillRect(-8, -10, 16, 28);
    if (!open) {
      ctx.fillStyle = '#c9a227';
      ctx.beginPath(); ctx.arc(0, 2, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-2, 2, 4, 8);
    } else {
      ctx.fillStyle = '#a7f3d0';
      ctx.font = 'bold 10px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('EXIT', 0, -24);
    }
    ctx.restore();
  }

  drawLasersTripwires(ctx, game) {
    for (const l of game.lasers) {
      const active = l.active;
      ctx.save();
      ctx.strokeStyle = active ? PALETTE.laser : 'rgba(255, 59, 48, 0.18)';
      ctx.lineWidth = active ? 3 : 1.5;
      ctx.shadowColor = PALETTE.laser;
      ctx.shadowBlur = active ? 12 : 0;
      if (!active) ctx.setLineDash([4, 8]);
      ctx.beginPath(); ctx.moveTo(l.a.x, l.a.y); ctx.lineTo(l.b.x, l.b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#7f1d1d';
      for (const p of [l.a, l.b]) { ctx.fillRect(p.x - 5, p.y - 5, 10, 10); }
      ctx.fillStyle = active ? '#ff6b61' : '#555';
      for (const p of [l.a, l.b]) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.5, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    for (const w of game.tripwires) {
      if (!w.visible) continue;
      ctx.save();
      ctx.strokeStyle = PALETTE.tripwire;
      ctx.globalAlpha = 0.55 + Math.sin(w.t * 4) * 0.3;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.moveTo(w.a.x, w.a.y); ctx.lineTo(w.b.x, w.b.y); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#f472b6';
      for (const p of [w.a, w.b]) { ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
  }

  drawCones(ctx, game) {
    for (const g of game.guards) {
      const alert = g.state === 'alert';
      const range = GUARD.viewRange;
      const poly = conePolygon(game.world, g.x, g.y, g.angle, GUARD.fov, range, 22);
      ctx.save();
      ctx.fillStyle = alert ? PALETTE.coneAlert : PALETTE.cone;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    for (const c of game.cameras) {
      const poly = conePolygon(game.world, c.x, c.y, c.angle, CAMERA.fov, CAMERA.viewRange, 18);
      ctx.save();
      ctx.fillStyle = PALETTE.camCone;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i].x, poly[i].y);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }

  drawCameras(ctx, game) {
    for (const c of game.cameras) {
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.fillStyle = '#3f3f46';
      ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#a1a1aa';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(c.angle);
      ctx.fillStyle = c.detect > 0.05 ? '#ff3b30' : '#fbbf24';
      ctx.fillRect(4, -3, 12, 6);
      ctx.beginPath(); ctx.arc(16, 0, 3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      if (c.detect > 0.05) {
        ctx.save();
        ctx.strokeStyle = '#ff3b30';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(c.x, c.y, 13 + c.detect * 8, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
      }
    }
  }

  drawGuards(ctx, game) {
    for (const g of game.guards) {
      ctx.save();
      ctx.translate(g.x, g.y);
      // brass clockwork body
      ctx.fillStyle = GUARD.guardBody;
      ctx.beginPath(); ctx.arc(0, 0, GUARD.radius + 2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = PALETTE.brass;
      ctx.beginPath(); ctx.arc(0, 0, GUARD.radius, 0, Math.PI * 2); ctx.fill();
      // winding key on the back
      ctx.rotate(g.angle + Math.PI);
      ctx.strokeStyle = '#6b4e12';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-GUARD.radius - 2, 0); ctx.lineTo(-GUARD.radius - 8, 0); ctx.stroke();
      ctx.beginPath(); ctx.arc(-GUARD.radius - 9, 0, 3, 0, Math.PI * 2); ctx.stroke();
      ctx.rotate(-(g.angle + Math.PI));
      // glowing eye in facing direction
      ctx.rotate(g.angle);
      ctx.fillStyle = g.state === 'alert' ? '#ff2d20' : '#fef3c7';
      ctx.beginPath(); ctx.arc(7, 0, 4, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(-g.angle);
      ctx.restore();
      // state marker + detection arc
      ctx.save();
      ctx.textAlign = 'center';
      if (g.state === 'alert') {
        ctx.fillStyle = '#ff5a4e';
        ctx.font = 'bold 20px Georgia, serif';
        ctx.fillText('!', g.x, g.y - 22);
      } else if (g.state === 'inspect' || g.state === 'search') {
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 18px Georgia, serif';
        ctx.fillText('?', g.x, g.y - 22);
      }
      if (g.detect > 0.05) {
        ctx.strokeStyle = 'rgba(255, 90, 78, 0.9)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(g.x, g.y, 20, -Math.PI / 2, -Math.PI / 2 + g.detect * Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  drawCoinsSmoke(ctx, game) {
    for (const c of game.coins) {
      ctx.save();
      ctx.fillStyle = '#fde68a';
      ctx.shadowColor = '#ffd700'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.arc(c.x, c.y - c.arcH, 4, 0, Math.PI * 2); ctx.fill();
      if (c.ringing) {
        ctx.strokeStyle = 'rgba(253, 230, 138, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(c.x, c.y, 8 + c.ringT * 22, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
    }
    for (const s of game.smokes) {
      ctx.save();
      ctx.globalAlpha = s.alpha * 0.6;
      ctx.fillStyle = PALETTE.smoke;
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2 + s.t;
        const r = s.r * 0.45;
        ctx.beginPath();
        ctx.arc(s.x + Math.cos(a) * r, s.y + Math.sin(a) * r, s.r * 0.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawPlayer(ctx, game) {
    const p = game.player;
    const t = performance.now() / 1000;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.inCover) ctx.globalAlpha = 0.85;
    // cloak
    ctx.fillStyle = p.sneaking ? '#4c1d95' : PALETTE.playerCloak;
    ctx.beginPath(); ctx.arc(0, 0, p.sneaking ? 11 : 13, 0, Math.PI * 2); ctx.fill();
    // hood + face
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 3, Math.sin(p.angle) * 3, 6, 0, Math.PI * 2); ctx.fill();
    // lantern glint
    ctx.fillStyle = '#fde68a';
    ctx.shadowColor = '#fde68a'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(Math.cos(p.angle) * 10, Math.sin(p.angle) * 10, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // sneaking indicator
    if (p.sneaking) {
      ctx.save();
      ctx.fillStyle = 'rgba(232, 220, 192, 0.8)';
      ctx.font = '11px Georgia, serif';
      ctx.textAlign = 'center';
      ctx.fillText('sneaking', p.x, p.y - 20);
      ctx.restore();
    }
  }

  drawParticles(ctx, game) {
    for (const pt of game.particles.alive) {
      const k = 1 - pt.life / pt.max;
      ctx.save();
      ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * k + 0.5, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }

  // Bush canopy drawn over the player when they hide inside a planter.
  drawBushTops(ctx, world, player) {
    const tx = Math.floor(player.x / TILE), ty = Math.floor(player.y / TILE);
    if (!world.isCoverTile(tx, ty)) return;
    const x = tx * TILE, y = ty * TILE;
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = PALETTE.bush;
    ctx.beginPath(); ctx.arc(x + TILE / 2, y + TILE / 2, TILE * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PALETTE.bushHi;
    for (const [dx, dy, r] of leafDots(tx, ty)) {
      ctx.beginPath(); ctx.arc(x + dx, y + dy, r * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  drawLighting(ctx, game) {
    const d = this.dark.getContext('2d');
    d.clearRect(0, 0, VIEW_W, VIEW_H);
    d.fillStyle = 'rgba(5, 14, 11, 0.42)';
    d.fillRect(0, 0, VIEW_W, VIEW_H);
    d.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => {
      const g = d.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(0,0,0,${a})`);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      d.fillStyle = g;
      d.beginPath(); d.arc(x, y, r, 0, Math.PI * 2); d.fill();
    };
    hole(game.player.x, game.player.y, 280, 0.95);
    for (const l of game.level.loot) {
      if (!l.taken) { const c = tileCenter(l.tx, l.ty); hole(c.x, c.y, 55, 0.5); }
    }
    const e = tileCenter(game.level.exit.x, game.level.exit.y);
    hole(e.x, e.y, game.exitOpen ? 110 : 55, 0.6);
    d.globalCompositeOperation = 'source-over';
    ctx.drawImage(this.dark, 0, 0);
  }

  drawMinimap(ctx, game) {
    const mw = 208, mh = 117, ox = VIEW_W - mw - 14, oy = 84;
    const sx = mw / VIEW_W, sy = mh / VIEW_H;
    ctx.save();
    ctx.fillStyle = 'rgba(6, 18, 14, 0.82)';
    ctx.fillRect(ox - 4, oy - 4, mw + 8, mh + 8);
    ctx.strokeStyle = PALETTE.brassDim;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(ox - 4.5, oy - 4.5, mw + 9, mh + 9);
    for (let ty = 0; ty < game.world.rows; ty++) {
      for (let tx = 0; tx < game.world.cols; tx++) {
        const c = game.world.tileAt(tx, ty);
        if (c === '#') ctx.fillStyle = '#0a1a15';
        else if (c === 'H') ctx.fillStyle = '#14532d';
        else if (c === 'B') ctx.fillStyle = '#166534';
        else if (c === 'D') ctx.fillStyle = '#0f241f';
        else continue;
        ctx.fillRect(ox + tx * TILE * sx, oy + ty * TILE * sy, TILE * sx + 0.5, TILE * sy + 0.5);
      }
    }
    for (const l of game.level.loot) {
      if (l.taken) continue;
      ctx.fillStyle = PALETTE.loot;
      ctx.fillRect(ox + l.tx * TILE * sx - 1.5, oy + l.ty * TILE * sy - 1.5, 3, 3);
    }
    const e = tileCenter(game.level.exit.x, game.level.exit.y);
    ctx.fillStyle = game.exitOpen ? PALETTE.exit : '#3f6b52';
    ctx.fillRect(ox + e.x * sx - 2.5, oy + e.y * sy - 2.5, 5, 5);
    for (const g of game.guards) {
      ctx.fillStyle = g.state === 'alert' ? '#ff3b30' : '#fbbf24';
      ctx.beginPath(); ctx.arc(ox + g.x * sx, oy + g.y * sy, 2.6, 0, Math.PI * 2); ctx.fill();
    }
    for (const c of game.cameras) {
      ctx.fillStyle = '#ff6b61';
      ctx.fillRect(ox + c.x * sx - 2, oy + c.y * sy - 2, 4, 4);
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(ox + game.player.x * sx, oy + game.player.y * sy, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.beginPath(); ctx.arc(ox + game.player.x * sx, oy + game.player.y * sy, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = PALETTE.hud;
    ctx.font = 'bold 10px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('T A C T I C A L   M A P', ox, oy - 8);
    ctx.restore();
  }
}
