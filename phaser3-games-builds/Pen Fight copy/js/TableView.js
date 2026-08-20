//==================================================
// TableView.js
//==================================================
// Draws the play surface as a top-down wood desk — the classic "pen
// fight played on a school desk" look — instead of the old chalkboard
// rectangle with a thick colored frame. Deliberately no walls: the
// edge is just a thin seam marking where the desk ends, since a pen
// that crosses it is meant to be able to keep going right off the
// table (that's how a player gets eliminated — see GameRules.js on
// the single-player side and Room.mjs's _checkEliminations on the
// multiplayer side).
//
// Shared by both js/GameScene.js (single-player) and
// js/net/NetGameScene.js (multiplayer) so they look identical.
//==================================================

import { TABLE } from './Constants.js';

// Small deterministic PRNG (mulberry32) so the wood grain pattern is
// stable across reloads/restarts instead of re-randomizing every time.
function mulberry32(seed) {
  let s = seed | 0;

  return function () {
    s = (s + 0x6d2b79f5) | 0;

    let t = Math.imul(s ^ (s >>> 15), 1 | s);

    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;

    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function drawTable(scene) {
  const g = scene.add.graphics();

  g.setDepth(-100);

  const { X, Y, WIDTH, HEIGHT, CORNER_RADIUS } = TABLE;

  //------------------------------------------
  // Drop shadow — lifts the table off the notebook-paper background
  //------------------------------------------

  g.fillStyle(TABLE.SHADOW_COLOR, 0.22);
  g.fillRoundedRect(X - 2, Y + 6, WIDTH + 4, HEIGHT + 4, CORNER_RADIUS);

  //------------------------------------------
  // Base wood fill
  //------------------------------------------

  g.fillStyle(TABLE.WOOD_BASE, 1);
  g.fillRoundedRect(X, Y, WIDTH, HEIGHT, CORNER_RADIUS);

  //------------------------------------------
  // Wood grain — wavy streaks, alternating slightly lighter/darker
  //------------------------------------------

  const rand = mulberry32(1337);
  const streakCount = 26;
  const step = 20;

  for (let i = 0; i < streakCount; i++) {
    const color = rand() > 0.5 ? TABLE.WOOD_GRAIN_LIGHT : TABLE.WOOD_GRAIN_DARK;
    const alpha = 0.1 + rand() * 0.18;
    const thickness = 1 + rand() * 2;

    const baseY = Y + 10 + rand() * (HEIGHT - 20);
    const amplitude = 3 + rand() * 6;
    const freq = 0.004 + rand() * 0.004;
    const phase = rand() * Math.PI * 2;

    g.lineStyle(thickness, color, alpha);
    g.beginPath();

    for (let px = X; px <= X + WIDTH; px += step) {
      const py = baseY + Math.sin((px - X) * freq + phase) * amplitude;

      if (px === X) {
        g.moveTo(px, py);
      } else {
        g.lineTo(px, py);
      }
    }

    g.strokePath();
  }

  //------------------------------------------
  // Soft edge shading (poor man's vignette — a few nested, fading
  // strokes near the border instead of a true radial gradient)
  //------------------------------------------

  const vignetteLayers = 6;

  for (let i = 0; i < vignetteLayers; i++) {
    const inset = i * 4;
    const alpha = 0.05 - i * 0.007;

    if (alpha <= 0) continue;

    g.lineStyle(6, TABLE.SHADOW_COLOR, alpha);
    g.strokeRoundedRect(
      X + inset,
      Y + inset,
      WIDTH - inset * 2,
      HEIGHT - inset * 2,
      Math.max(CORNER_RADIUS - inset, 0),
    );
  }

  //------------------------------------------
  // Table edge — a thin seam, not a wall
  //------------------------------------------

  g.lineStyle(TABLE.EDGE_WIDTH, TABLE.EDGE_COLOR, 0.9);
  g.strokeRoundedRect(X, Y, WIDTH, HEIGHT, CORNER_RADIUS);

  return g;
}
