//==================================================
// puzzles/PathShift.js
//==================================================
// Homeward Bound: rotate road tiles clockwise to connect every cell into
// one network, building a route from the dog (top-left) to home
// (bottom-right).

import PuzzleBase from './PuzzleBase.js';
import { DIRS4 } from '../Constants.js';
import { THEME } from '../Theme.js';
import { rot4, turnsToRotate } from '../Utils.js';

export default class PathShift extends PuzzleBase {
  generate(level, rng) {
    const n = Math.min(10, 4 + Math.floor((level - 1) / 2));
    const sol = Array.from({ length: n }, () => Array(n).fill(0));
    const seen = Array.from({ length: n }, () => Array(n).fill(false));
    const stack = [[0, 0]];
    seen[0][0] = true;

    // Random spanning tree via backtracking DFS, so the grid is always
    // solvable in exactly one connected network.
    while (stack.length) {
      const [r, c] = stack[stack.length - 1];
      const options = [];
      for (let d = 0; d < 4; d++) {
        const rr = r + DIRS4[d][0], cc = c + DIRS4[d][1];
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && !seen[rr][cc]) options.push([rr, cc, d]);
      }
      if (!options.length) { stack.pop(); continue; }
      const [rr, cc, d] = options[rng.int(options.length)];
      const a = [1, 2, 4, 8][d], b = [4, 8, 1, 2][d];
      sol[r][c] |= a;
      sol[rr][cc] |= b;
      seen[rr][cc] = true;
      stack.push([rr, cc]);
    }

    const grid = sol.map((row) => row.slice());
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        let k = 1 + rng.int(3);
        while (k--) grid[r][c] = rot4(grid[r][c]);
      }
    }

    this.state = { n, grid, sol, moves: 0 };
  }

  isSolved() {
    const { n, grid } = this.state;
    const q = [[0, 0]], visited = new Set(['0,0']);
    while (q.length) {
      const [r, c] = q.shift();
      const m = grid[r][c];
      for (let d = 0; d < 4; d++) {
        if (!(m & (1 << d))) continue;
        const rr = r + DIRS4[d][0], cc = c + DIRS4[d][1], opp = 1 << ((d + 2) % 4);
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && (grid[rr][cc] & opp)) {
          const key = `${rr},${cc}`;
          if (!visited.has(key)) { visited.add(key); q.push([rr, cc]); }
        }
      }
    }
    return visited.size === n * n;
  }

  click(r, c) {
    this.scene.record();
    this.state.grid[r][c] = rot4(this.state.grid[r][c]);
    this.state.moves++;
    this.scene.afterMutate(this.isSolved());
    this.pulseTile(r, c);
  }

  // Quick expanding-ring tap feedback on the tile that was just rotated.
  pulseTile(r, c) {
    const { n } = this.state, s = 560 / n;
    const cx = 20 + c * s + s / 2, cy = 20 + r * s + s / 2;
    const ring = this.addToBoard(this.scene.add.circle(cx, cy, s * 0.1, 0xffffff, 0));
    ring.setStrokeStyle(3, 0xffffff, 0.8);
    this.scene.tweens.add({ targets: ring, radius: s * 0.42, alpha: 0, duration: 260, ease: 'Cubic.easeOut' });
  }

  // Traces the connected route from the dog (0,0) to home (n-1,n-1) along
  // the current (solved) tile network, for the walk-home win animation.
  solvedPathCells() {
    const { n, grid } = this.state;
    const startKey = '0,0', endKey = `${n - 1},${n - 1}`;
    const parent = {};
    const visited = new Set([startKey]);
    const q = [[0, 0]];
    while (q.length) {
      const [r, c] = q.shift();
      if (`${r},${c}` === endKey) break;
      const m = grid[r][c];
      for (let d = 0; d < 4; d++) {
        if (!(m & (1 << d))) continue;
        const rr = r + DIRS4[d][0], cc = c + DIRS4[d][1], opp = 1 << ((d + 2) % 4);
        if (rr >= 0 && rr < n && cc >= 0 && cc < n && (grid[rr][cc] & opp)) {
          const key = `${rr},${cc}`;
          if (!visited.has(key)) { visited.add(key); parent[key] = `${r},${c}`; q.push([rr, cc]); }
        }
      }
    }
    if (!visited.has(endKey)) return [[0, 0], [n - 1, n - 1]];
    const cells = [];
    let k = endKey;
    while (k) { const [r, c] = k.split(',').map(Number); cells.push([r, c]); k = parent[k]; }
    cells.reverse();
    return cells;
  }

  // Walks the same dog icon that's been sitting at START along the solved
  // route home before the win popup — reusing it (rather than animating a
  // second, separate sprite while the real one stays put) so it's clearly
  // the same dog making the trip, not a duplicate walking off on its own.
  playWinAnimation(onDone) {
    const path = this.solvedPathCells();
    const { n } = this.state, s = 560 / n;
    const pts = path.map(([r, c]) => [20 + c * s + s / 2, 20 + r * s + s / 2]);

    const dog = this.dogIcon;
    if (!dog) { onDone(); return; }
    dog.setDepth(50);

    // Keep the total walk to roughly 1.6s regardless of how long the
    // solved route is, so a big 10x10 grid's homecoming doesn't drag.
    const stepDuration = Math.max(18, Math.min(140, 1600 / pts.length));
    let i = 1;
    const step = () => {
      if (i >= pts.length) {
        this.scene.tweens.add({
          targets: dog, scale: { from: 1, to: 1.4 }, duration: 180, yoyo: true,
          onComplete: () => onDone(),
        });
        return;
      }
      this.scene.tweens.add({
        targets: dog, x: pts[i][0], y: pts[i][1], duration: stepDuration, ease: 'Sine.easeInOut',
        onComplete: () => { i++; step(); },
      });
    };
    step();
  }

  onPointerDown(x, y) {
    const { n } = this.state, s = 560 / n;
    const c = Math.floor((x - 20) / s), r = Math.floor((y - 20) / s);
    if (r >= 0 && r < n && c >= 0 && c < n) this.click(r, c);
  }

  hint() {
    const { n, grid, sol } = this.state;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (grid[r][c] === sol[r][c]) continue;
        const k = turnsToRotate(grid[r][c], sol[r][c]);
        this.scene.record();
        grid[r][c] = sol[r][c];
        this.state.moves++;
        this.scene.setHint(`Hint solved one step: tile (${r + 1}, ${c + 1}) rotated ${k || 4} time(s) clockwise.`);
        this.scene.afterMutate(this.isSolved());
        return;
      }
    }
  }

  redraw() {
    const { n, grid } = this.state, s = 560 / n;
    const g = this.addToBoard(this.scene.add.graphics());

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const x = 20 + c * s, y = 20 + r * s, m = grid[r][c];
        g.lineStyle(Math.max(4, s * 0.09), 0xeeeeee, 1);
        const cx = x + s / 2, cy = y + s / 2;
        if (m & 1) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(x + s, cy); g.strokePath(); }
        if (m & 2) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, y + s); g.strokePath(); }
        if (m & 4) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, cy); g.strokePath(); }
        if (m & 8) { g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx, y); g.strokePath(); }
        g.fillStyle(0xffffff, 1);
        g.fillCircle(cx, cy, 4);
      }
    }

    g.lineStyle(4, THEME.START, 1);
    g.strokeRect(22, 22, s - 4, s - 4);
    g.lineStyle(4, THEME.END, 1);
    g.strokeRect(22 + (n - 1) * s, 22 + (n - 1) * s, s - 4, s - 4);

    const iconSize = `${Math.min(30, s * 0.4)}px`;
    this.dogIcon = this.addToBoard(this.scene.add.text(22 + s / 2, 22 + s / 2, '🐕', { fontSize: iconSize }).setOrigin(0.5));
    this.addToBoard(this.scene.add.text(22 + (n - 1) * s + s / 2, 22 + (n - 1) * s + s / 2, '🏠', { fontSize: iconSize }).setOrigin(0.5));
  }
}
