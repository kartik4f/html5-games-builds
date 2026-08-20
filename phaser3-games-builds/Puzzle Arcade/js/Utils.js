//==================================================
// Utils.js
//==================================================

// Seeded LCG RNG. A fresh instance is created per level from a session
// seed mixed with the game index and level number, so Prev/Next always
// returns to the same puzzle within a session (matches the original
// canvas prototype's determinism guarantee).
export class Rng {
  constructor(seed) {
    this.state = (seed >>> 0) || 1;
  }

  // Returns an integer in [0, n).
  int(n) {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return Math.floor((this.state / 4294967296) * n);
  }
}

export function seedForLevel(sessionSeed, gameIndex, level) {
  return ((sessionSeed ^ Math.imul(gameIndex, 1000003) ^ Math.imul(level, 9176) ^ 12345) >>> 0) || 1;
}

// Deep clone that preserves Set instances (used by Gravity Blocks' wall
// set), so undo/redo/level-cache snapshots round-trip correctly.
export function clone(obj) {
  return JSON.parse(
    JSON.stringify(obj, (k, v) => (v instanceof Set ? { __set: [...v] } : v)),
    (k, v) => (v && v.__set ? new Set(v.__set) : v),
  );
}

export function rot4(mask) {
  // Rotates a 4-bit N/E/S/W connection mask 90° clockwise.
  return ((mask << 1) & 15) | (mask >> 3);
}

export function turnsToRotate(mask, target) {
  let m = mask, k = 0;
  while (m !== target && k < 4) { m = rot4(m); k++; }
  return k;
}
