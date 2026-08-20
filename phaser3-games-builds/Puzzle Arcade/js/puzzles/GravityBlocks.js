//==================================================
// puzzles/GravityBlocks.js
//==================================================
// Backyard Golf: tilt the green and the ball rolls until it hits a rock or
// the edge. Get it into the hole. Arrow keys/WASD work, and tapping a cell
// tilts the green toward whichever side of the ball you tapped.

import PuzzleBase from './PuzzleBase.js';
import { DIRS4 } from '../Constants.js';
import { THEME } from '../Theme.js';

export default class GravityBlocks extends PuzzleBase {
  generate(level, rng) {
    const n = Math.min(8, 4 + Math.floor((level - 1) / 3));
    const density = Math.min(0.38, 0.18 + level * 0.018);

    // Scattering walls purely at random can trap the ball — e.g. two walls
    // one column in, on rows 0 and n-1, confine it to a two-cell cycle with
    // the target forever unreachable. Regenerate (same rng, so the level
    // stays deterministic) until the target is actually reachable; an empty
    // board is the guaranteed-solvable fallback if we somehow keep failing.
    let walls = new Set();
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = new Set();
      for (let i = 0; i < n * n * density; i++) {
        const r = rng.int(n), c = rng.int(n);
        if ((r || c) && !(r === n - 1 && c === n - 1)) candidate.add(`${r},${c}`);
      }
      if (this.isReachable(n, candidate, [0, 0], [n - 1, n - 1])) { walls = candidate; break; }
    }

    this.state = { n, w: walls, p: [0, 0], moves: 0 };

    // The ball is a persistent sprite (see redraw) so moves can tween
    // smoothly instead of snapping; a fresh level needs a fresh one sized
    // for this level's cell size, drawn at the start position with no tween.
    if (this.ballSprite) { this.ballSprite.destroy(); this.ballSprite = null; }
  }

  // Standalone reachability check (used during generation, before
  // this.state exists) — BFS over every position reachable by sliding.
  isReachable(n, walls, start, target) {
    const seen = new Set([start.join(',')]);
    const queue = [start];
    while (queue.length) {
      const [r, c] = queue.shift();
      if (r === target[0] && c === target[1]) return true;
      for (let d = 0; d < 4; d++) {
        const [dr, dc] = DIRS4[d];
        let rr = r, cc = c;
        while (true) {
          const nr = rr + dr, nc = cc + dc;
          if (nr < 0 || nr >= n || nc < 0 || nc >= n || walls.has(`${nr},${nc}`)) break;
          rr = nr; cc = nc;
        }
        const key = `${rr},${cc}`;
        if (!seen.has(key)) { seen.add(key); queue.push([rr, cc]); }
      }
    }
    return false;
  }

  isSolved() {
    const { n, p } = this.state;
    return p[0] === n - 1 && p[1] === n - 1;
  }

  move(d) {
    const { n, w } = this.state;
    let [r, c] = this.state.p;
    const [dr, dc] = DIRS4[d];
    while (true) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || rr >= n || cc < 0 || cc >= n || w.has(`${rr},${cc}`)) break;
      r = rr; c = cc;
    }
    if (r === this.state.p[0] && c === this.state.p[1]) return;
    this.scene.record();
    this.state.p = [r, c];
    this.state.moves++;
    this.scene.afterMutate(this.isSolved());
  }

  onKey(d) { this.move(d); }

  onPointerDown(x, y) {
    const { n, p } = this.state, s = 560 / n;
    const c = Math.floor((x - 20) / s), r = Math.floor((y - 20) / s);
    if (r < 0 || r >= n || c < 0 || c >= n) return;
    const dr = r - p[0], dc = c - p[1];
    if (dr === 0 && dc === 0) return;
    // Move along whichever axis has the larger tap offset from the ball.
    let d;
    if (Math.abs(dr) >= Math.abs(dc)) d = dr > 0 ? 1 : 3;
    else d = dc > 0 ? 0 : 2;
    this.move(d);
  }

  // Where the ball ends up sliding from (r,c) in direction d, without
  // mutating state.
  slideResult(r, c, d) {
    const { n, w } = this.state;
    const [dr, dc] = DIRS4[d];
    while (true) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= n || nc < 0 || nc >= n || w.has(`${nr},${nc}`)) return [r, c];
      r = nr; c = nc;
    }
  }

  hint() {
    const { n } = this.state;
    const target = [n - 1, n - 1];
    const names = ['Right', 'Down', 'Left', 'Up'];

    // A single greedy "slide toward target" step can dead-end against a
    // wall that needs an indirect route to get around. BFS over the small
    // reachable-position graph always finds a solution when one exists, so
    // Hint can never get stuck on a solvable level.
    const startKey = this.state.p.join(',');
    const cameFrom = new Map([[startKey, null]]);
    const queue = [this.state.p];
    while (queue.length) {
      const [r, c] = queue.shift();
      if (r === target[0] && c === target[1]) break;
      for (let d = 0; d < 4; d++) {
        const [nr, nc] = this.slideResult(r, c, d);
        const key = `${nr},${nc}`;
        if (cameFrom.has(key)) continue;
        cameFrom.set(key, { from: `${r},${c}`, d });
        queue.push([nr, nc]);
      }
    }

    const targetKey = target.join(',');
    if (!cameFrom.has(targetKey)) {
      this.scene.setHint('This level has no solution from the current position — try Restart.');
      return;
    }

    // Walk the BFS parent chain back to find the first move from the start.
    let key = targetKey, step = cameFrom.get(key);
    while (step && step.from !== startKey) { key = step.from; step = cameFrom.get(key); }
    if (!step) { this.scene.setHint('The ball is already in the hole.'); return; }

    this.move(step.d);
    this.scene.setHint(`Hint solved one step: tilted the green ${names[step.d]}.`);
  }

  redraw() {
    const { n, w, p } = this.state, s = 560 / n;
    const g = this.addToBoard(this.scene.add.graphics());

    // Putting green.
    g.fillStyle(0x1e5c34, 1);
    g.fillRect(20, 20, 560, 560);

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const x = 20 + c * s, y = 20 + r * s;
        g.lineStyle(1, 0x2c7a45, 1);
        g.strokeRect(x, y, s, s);
        if (w.has(`${r},${c}`)) {
          g.fillStyle(THEME.WALL, 1);
          g.fillRoundedRect(x + 5, y + 5, s - 10, s - 10, 6);
          this.addToBoard(this.scene.add.text(x + s / 2, y + s / 2, '🪨', { fontSize: `${Math.min(24, s * 0.36)}px` }).setOrigin(0.5));
        }
      }
    }

    const holeX = 20 + (n - 0.5) * s, holeY = 20 + (n - 0.5) * s;
    this.addToBoard(this.scene.add.text(holeX, holeY, '⛳', { fontSize: `${Math.min(30, s * 0.5)}px` }).setOrigin(0.5));

    // Golf ball: a persistent sprite (untouched by clearObjects) so it can
    // glide smoothly to its new cell instead of popping there instantly.
    const ballX = 20 + p[1] * s + s / 2, ballY = 20 + p[0] * s + s / 2;
    if (!this.ballSprite) {
      const ball = this.scene.add.graphics();
      ball.fillStyle(0xffffff, 1);
      ball.fillCircle(0, 0, s * 0.2);
      ball.lineStyle(2, 0x222222, 1);
      ball.strokeCircle(0, 0, s * 0.2);
      ball.setPosition(ballX, ballY);
      this.scene.boardContainer.add(ball);
      this.ballSprite = ball;
    } else if (this.ballSprite.x !== ballX || this.ballSprite.y !== ballY) {
      this.scene.tweens.add({ targets: this.ballSprite, x: ballX, y: ballY, duration: 220, ease: 'Cubic.easeOut' });
    }
    // The grass/rocks/hole graphics above are destroyed and recreated every
    // redraw and get appended to the *end* of the container's children —
    // which would otherwise bury this persistent ball behind them (Phaser
    // containers render in list order, not by depth). Keep it on top.
    this.scene.boardContainer.bringToTop(this.ballSprite);
  }

  destroy() {
    super.destroy();
    if (this.ballSprite) { this.ballSprite.destroy(); this.ballSprite = null; }
  }

  // Ball shrinks and fades as it drops into the hole.
  playWinAnimation(onDone) {
    if (!this.ballSprite) { onDone(); return; }
    this.scene.tweens.add({
      targets: this.ballSprite, scale: 0, alpha: 0, duration: 380, ease: 'Cubic.easeIn',
      onComplete: () => onDone(),
    });
  }
}
