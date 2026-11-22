// hud.js — top bar, detection meter, toasts, and all full screens.
// Drawn on the same canvas after the world.
import { PALETTE, VIEW_W, VIEW_H } from './config.js';
import { fmtTime } from './utils.js';

function panel(ctx, x, y, w, h, alpha = 0.82) {
  ctx.fillStyle = `rgba(6, 18, 14, ${alpha})`;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(201, 162, 39, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
}

function centerText(ctx, text, y, size, color, font = 'Georgia, serif', bold = false) {
  ctx.fillStyle = color;
  ctx.font = `${bold ? 'bold ' : ''}${size}px ${font}`;
  ctx.textAlign = 'center';
  ctx.fillText(text, VIEW_W / 2, y);
}

export function drawHUD(ctx, game) {
  const p = game.player;
  // top bar
  panel(ctx, 0, 0, VIEW_W, 44, 0.88);
  ctx.fillStyle = PALETTE.hud;
  ctx.font = 'bold 15px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText(`${game.levelIndex + 1}/5  ${game.level.name}`, 14, 28);
  ctx.textAlign = 'center';
  ctx.font = '15px Georgia, serif';
  const lootText = `◆ Loot ${game.lootTaken}/${game.level.loot.length} (need ${game.lootQuota})`;
  ctx.fillText(lootText, VIEW_W / 2 - 90, 28);
  ctx.fillText(`◉ Coins ${p.coins}    ☁ Smoke ${p.smokes}`, VIEW_W / 2 + 190, 28);
  ctx.textAlign = 'right';
  ctx.fillText(`⏱ ${game.timeText}    Score ${game.totalScore + game.levelScore}`, VIEW_W - 14, 28);
  // alarm badge
  const alarmColor = game.alarm === 2 ? '#ff5a4e' : game.alarm === 1 ? '#fbbf24' : '#34d399';
  ctx.fillStyle = alarmColor;
  ctx.font = 'bold 14px Georgia, serif';
  ctx.textAlign = 'right';
  ctx.fillText(game.alarmLabel, VIEW_W - 14, 62);
  if (game.alarm === 2) {
    ctx.fillStyle = `rgba(255, 90, 78, ${0.25 + Math.sin(performance.now() / 90) * 0.12})`;
    ctx.fillRect(0, 44, VIEW_W, 4);
  }
  // detection meter
  const d = game.maxDetect;
  if (d > 0.05 && game.screen === 'play') {
    const w = 260, x = VIEW_W / 2 - w / 2, y = 56;
    panel(ctx, x - 8, y - 6, w + 16, 30, 0.8);
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'left';
    ctx.fillText('SEEN', x, y + 12);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(x + 52, y + 2, w - 52, 10);
    ctx.fillStyle = d > 0.7 ? '#ff2d20' : '#fbbf24';
    ctx.fillRect(x + 52, y + 2, (w - 52) * d, 10);
  }
  // toast
  if (game.toast && game.toastT > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, game.toastT);
    ctx.fillStyle = PALETTE.hud;
    ctx.font = 'italic 17px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(game.toast, VIEW_W / 2, VIEW_H - 26);
    ctx.restore();
  }
  // bottom hints
  ctx.fillStyle = 'rgba(232, 220, 192, 0.55)';
  ctx.font = '12px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move · Shift sneak · F toss coin · E smoke · Esc pause · M mute', 14, VIEW_H - 12);
}

function screenBase(ctx, title, titleColor) {
  ctx.fillStyle = 'rgba(5, 14, 11, 0.78)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.fillStyle = 'rgba(201, 162, 39, 0.7)';
  ctx.fillRect(VIEW_W / 2 - 220, 82, 440, 1);
  centerText(ctx, title, 132, 52, titleColor, 'Georgia, serif', true);
  ctx.fillRect(VIEW_W / 2 - 220, 218, 440, 1);
}

export function drawScreens(ctx, game) {
  if (game.screen === 'title') {
    screenBase(ctx, 'THE CLOCKWORK', '#e8dcc0');
    centerText(ctx, 'CONSERVATORY', 196, 52, '#c9a227', 'Georgia, serif', true);
    centerText(ctx, 'A stealth heist in five glasshouses — steal the curios,', 250, 20, '#e8dcc0');
    centerText(ctx, 'dodge the clockwork sentinels, and vanish before dawn.', 278, 20, '#e8dcc0');
    centerText(ctx, '5 heists · up to 7 sentinels a floor · sweeping cameras', 330, 18, '#a7f3d0');
    centerText(ctx, 'timed lasers · pulsing tripwires · coin lures · smoke vials', 356, 18, '#a7f3d0');
    centerText(ctx, 'WASD move · Shift sneak · F toss a coin · E smoke · Esc pause', 420, 16, '#e8dcc0');
    centerText(ctx, 'Press Enter to begin the first heist', 480, 22, '#ffd700', 'Georgia, serif', true);
    centerText(ctx, 'Hide in planters · slip under tripwires while sneaking · dark beds halve a guard’s sight', 530, 14, 'rgba(232,220,192,0.65)');
  } else if (game.screen === 'intro') {
    const L = game.level;
    screenBase(ctx, `HEIST ${game.levelIndex + 1} — ${L.name.toUpperCase()}`, '#e8dcc0');
    centerText(ctx, L.sub, 220, 20, '#a7f3d0', 'Georgia, serif', false);
    const rows = [
      `Sentinels on patrol: ${L.guards.length}`,
      `Security cameras: ${L.cameras.length} · Timed lasers: ${L.lasers.length} · Tripwires: ${L.tripwires.length}`,
      `Loot to lift: ${L.loot.length} curios — the exit opens at ${game.lootQuota}`,
      `Par time ${fmtTime(L.par)} · Ghost bonus if no one ever spots you`,
    ];
    rows.forEach((r, i) => centerText(ctx, r, 300 + i * 30, 18, '#e8dcc0'));
    centerText(ctx, 'Press Enter to slip inside', 480, 22, '#ffd700', 'Georgia, serif', true);
  } else if (game.screen === 'paused') {
    screenBase(ctx, 'PAUSED', '#e8dcc0');
    centerText(ctx, 'The glasshouse holds its breath.', 250, 20, '#a7f3d0');
    centerText(ctx, 'Esc resume · R restart this heist', 320, 18, '#e8dcc0');
  } else if (game.screen === 'leveldone') {
    const done = game.levelsDone[game.levelsDone.length - 1];
    screenBase(ctx, 'HEIST COMPLETE', '#34d399');
    const stars = '★'.repeat(done.stars) + '☆'.repeat(3 - done.stars);
    centerText(ctx, stars, 240, 44, '#ffd700');
    const rows = [
      `${done.name} — ${fmtTime(done.time)} (par ${fmtTime(done.par)})`,
      `Loot ${done.loot}/${done.total} · Spotted ${done.spotted} time${done.spotted === 1 ? '' : 's'}`,
      `Time bonus +${done.timeBonus} · Ghost +${done.ghostBonus} · Quiet +${done.quietBonus}`,
      `Heist score ${done.score} · Total ${game.totalScore}`,
    ];
    rows.forEach((r, i) => centerText(ctx, r, 300 + i * 30, 18, '#e8dcc0'));
    centerText(ctx, game.levelIndex + 1 >= 5 ? 'Press Enter — the final tally awaits' : 'Press Enter for the next heist', 480, 22, '#ffd700', 'Georgia, serif', true);
  } else if (game.screen === 'caught') {
    screenBase(ctx, 'CAUGHT!', '#ff5a4e');
    centerText(ctx, 'A clockwork sentinel closes its brass hand around your wrist.', 250, 20, '#e8dcc0');
    centerText(ctx, 'The glasshouse keeps its curios — this time.', 278, 20, '#e8dcc0');
    centerText(ctx, 'Press R to try the heist again', 360, 22, '#ffd700', 'Georgia, serif', true);
  } else if (game.screen === 'gamedone') {
    screenBase(ctx, 'THE ORCHID IS YOURS', '#ffd700');
    centerText(ctx, 'Five glasshouses, five clean getaways — or nearly.', 250, 20, '#e8dcc0');
    game.levelsDone.forEach((d, i) => {
      centerText(ctx, `${i + 1}. ${d.name} — ${'★'.repeat(d.stars)}${'☆'.repeat(3 - d.stars)} · ${d.score} pts · ${fmtTime(d.time)}`, 300 + i * 28, 17, '#e8dcc0');
    });
    centerText(ctx, `Total score ${game.totalScore} · Total time ${fmtTime(game.totalTime)}`, 470, 20, '#a7f3d0');
    centerText(ctx, 'Press Enter to return to the title', 520, 20, '#ffd700', 'Georgia, serif', true);
  }
}
