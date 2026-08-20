//==================================================
// puzzles/ColorFlow.js
//==================================================
// Pipeline: drag each colored pipe from its SOURCE to its matching OUTLET,
// like a plumber running lines. Standard Flow-Free rule: a cell can belong
// to at most one pipe at a time — no sharing, no crossing — so routes have
// to be actually planned around each other, not just drawn independently.

import PuzzleBase from './PuzzleBase.js';
import { DIRS4 } from '../Constants.js';
import { THEME } from '../Theme.js';

export default class ColorFlow extends PuzzleBase {
  constructor(scene) {
    super(scene);
    this.pointerDown = false;
    this.strokeChanged = false;
    this.lastCell = null;
  }

  generate(level, rng) {
    const n = Math.min(8, 5 + Math.floor((level - 1) / 2));
    // More pipes is the main difficulty lever (classic Flow Free): 3 at
    // level 1 ramping up to 6 by level 10. Kept modest (rather than
    // maxing out the color palette) so a simple per-pipe Hint rarely
    // paints itself into a corner on a bigger board.
    const targetColorCount = Math.min(6, 3 + Math.floor((level - 1) / 2));

    // Build the pipes by actually drawing `colorCount` mutually-exclusive
    // runs on the grid (self-avoiding, and never stepping onto a cell any
    // other pipe has already claimed). The endpoints of those runs become
    // each pipe's SOURCE/OUTLET, so a solution is guaranteed to exist by
    // construction, and — because real cell-exclusivity was used to build
    // it — actually requires routing around the other pipes to reproduce.
    //
    // Fitting `targetColorCount` long pipes into one grid without overlap
    // doesn't always succeed on the first try. Rather than ever falling
    // all the way back to one trivial pipe, step the color count down one
    // at a time (still a real, non-trivial puzzle) before giving up.
    let pairs = null;
    for (let colorCount = targetColorCount; colorCount >= 2 && !pairs; colorCount--) {
      // Push paths to be long enough, relative to how many have to share
      // the grid, that they wind through most of the board rather than
      // each pipe just being a short direct hop.
      const minLen = Math.max(5, Math.floor((n * n) / (colorCount * 1.3)));
      const maxLen = Math.min(n * n, minLen + n * 2);

      for (let attempt = 0; attempt < 80 && !pairs; attempt++) {
        const claimed = new Set();
        const paths = [];
        let ok = true;
        for (let k = 0; k < colorCount; k++) {
          const path = this.growPath(n, rng, claimed, minLen, maxLen);
          if (!path) { ok = false; break; }
          path.forEach(([r, c]) => claimed.add(`${r},${c}`));
          paths.push(path);
        }
        if (ok) {
          pairs = paths.map((path, k) => {
            let a = path[0], b = path[path.length - 1];
            if (rng.int(2)) { const t = a; a = b; b = t; }
            return { a, b, color: THEME.FLOW_COLORS[k] };
          });
        }
      }
    }

    // Should be unreachable in practice, but fall back to one trivially
    // solvable short pipe rather than ever shipping an unsolvable level.
    if (!pairs) pairs = [{ a: [0, 0], b: [0, Math.min(3, n - 1)], color: THEME.FLOW_COLORS[0] }];

    this.state = { n, pairs, paths: pairs.map(() => []), active: -1, moves: 0 };
    this.pointerDown = false; this.strokeChanged = false; this.lastCell = null;
  }

  // Randomly grows one self-avoiding path that never steps onto a cell
  // already `claimed` by an earlier pipe. Returns null if no long-enough
  // path could be grown after several tries (e.g. the grid's nearly full).
  growPath(n, rng, claimed, minLen, maxLen) {
    for (let tries = 0; tries < 50; tries++) {
      let start = null;
      for (let t = 0; t < 30 && !start; t++) {
        const cand = [rng.int(n), rng.int(n)];
        if (!claimed.has(cand.join(','))) start = cand;
      }
      if (!start) return null;

      const path = [start];
      const visited = new Set([start.join(',')]);
      const targetLen = minLen + rng.int(Math.max(1, maxLen - minLen + 1));
      while (path.length < targetLen) {
        const cur = path[path.length - 1];
        const options = [];
        for (const [dr, dc] of DIRS4) {
          const nr = cur[0] + dr, nc = cur[1] + dc;
          if (nr < 0 || nr >= n || nc < 0 || nc >= n) continue;
          const key = `${nr},${nc}`;
          if (visited.has(key) || claimed.has(key)) continue;
          options.push([nr, nc]);
        }
        if (!options.length) break;
        const next = options[rng.int(options.length)];
        path.push(next);
        visited.add(next.join(','));
      }
      if (path.length >= minLen) return path;
    }
    return null;
  }

  isSolved() {
    return this.state.paths.every((path, i) => {
      const b = this.state.pairs[i].b;
      return path.length && path[path.length - 1][0] === b[0] && path[path.length - 1][1] === b[1];
    });
  }

  // Every cell off-limits to pipe `excludeIndex`: every other pipe's own
  // SOURCE/OUTLET dot (reserved for that color even before it's drawn —
  // otherwise one pipe could route straight through another's not-yet-used
  // endpoint) plus whatever those other pipes have actually drawn so far.
  claimedCells(excludeIndex) {
    const set = new Set();
    this.state.pairs.forEach((pair, j) => {
      if (j === excludeIndex) return;
      set.add(`${pair.a[0]},${pair.a[1]}`);
      set.add(`${pair.b[0]},${pair.b[1]}`);
    });
    this.state.paths.forEach((path, j) => {
      if (j === excludeIndex) return;
      path.forEach(([r, c]) => set.add(`${r},${c}`));
    });
    return set;
  }

  wouldBeLegal(i, from, to, testPath) {
    if (Math.abs(from[0] - to[0]) + Math.abs(from[1] - to[1]) !== 1) return false;
    const path = testPath || this.state.paths[i];
    // The revisit check must look at the path *before* this step — every
    // caller passes a candidate that already ends in `to`, so checking the
    // full path would always find it there and reject every single move.
    const priorPath = testPath ? path.slice(0, -1) : path;
    if (priorPath.some((q) => q[0] === to[0] && q[1] === to[1])) return false;
    // Cells are exclusive: can't step onto one another pipe already holds.
    if (this.claimedCells(i).has(`${to[0]},${to[1]}`)) return false;
    return true;
  }

  endpointAt(r, c) { return this.state.pairs.findIndex((p) => p.a[0] === r && p.a[1] === c); }

  start(r, c) {
    const i = this.endpointAt(r, c);
    if (i < 0) return false;
    const b = this.state.pairs[i].b;
    const path = this.state.paths[i];
    if (path.length && path[path.length - 1][0] === b[0] && path[path.length - 1][1] === b[1]) return false;
    this.scene.record();
    this.state.active = i;
    this.state.paths[i] = [[r, c]];
    this.state.moves++;
    this.strokeChanged = true;
    this.scene.afterMutate(false);
    return true;
  }

  extend(r, c) {
    if (this.state.active < 0) return;
    const i = this.state.active, path = this.state.paths[i], last = path[path.length - 1], b = this.state.pairs[i].b;
    if (last[0] === r && last[1] === c) return true;
    if (Math.abs(last[0] - r) + Math.abs(last[1] - c) !== 1) return false;

    if (path.length > 1 && path[path.length - 2][0] === r && path[path.length - 2][1] === c) {
      path.pop();
      this.state.moves++;
      this.scene.afterMutate(false);
      return true;
    }

    const candidate = path.concat([[r, c]]);
    if (!this.wouldBeLegal(i, last, [r, c], candidate)) return false;

    path.push([r, c]);
    this.state.moves++;
    this.strokeChanged = true;
    let solved = false;
    if (r === b[0] && c === b[1]) {
      this.state.active = -1;
      solved = this.isSolved();
    }
    this.scene.afterMutate(solved);
    return true;
  }

  cellFromLocal(x, y) {
    const s = 560 / this.state.n;
    const c = Math.floor((x - 20) / s), r = Math.floor((y - 20) / s);
    return r >= 0 && r < this.state.n && c >= 0 && c < this.state.n ? [r, c] : null;
  }

  processSegment(from, to) {
    if (!from || !to || this.state.active < 0) return;
    let r = from[0], c = from[1];
    const [tr, tc] = to;
    while (r !== tr || c !== tc) {
      if (r !== tr) r += tr > r ? 1 : -1;
      else c += tc > c ? 1 : -1;
      const ok = this.extend(r, c);
      if (!ok || this.state.active < 0) break;
    }
  }

  onPointerDown(x, y) {
    const cell = this.cellFromLocal(x, y);
    if (!cell) return;
    this.pointerDown = true;
    this.strokeChanged = false;
    this.lastCell = cell;
    this.start(cell[0], cell[1]);
  }

  onPointerMove(x, y) {
    if (!this.pointerDown) return;
    const cell = this.cellFromLocal(x, y);
    if (!cell) return;
    if (!this.lastCell) this.lastCell = cell;
    this.processSegment(this.lastCell, cell);
    this.lastCell = cell;
  }

  onPointerUp() {
    this.pointerDown = false;
    this.lastCell = null;
    if (this.state.active >= 0 && this.strokeChanged) this.state.active = -1;
    this.strokeChanged = false;
    this.scene.afterMutate(this.isSolved());
  }

  // BFS for a legal continuation of pipe i's current run to its OUTLET.
  // Returns the full candidate path (existing run + new cells), or null if
  // this pipe has no legal way forward from its current run. This is a
  // simple, single-pipe search — it doesn't look ahead at whether it might
  // box in some other pipe, so Hint can occasionally need an Undo on a
  // heavily-packed board, same as a human solver might.
  findContinuation(i) {
    const pair = this.state.pairs[i];
    const base = this.state.paths[i].length ? this.state.paths[i].map((q) => q.slice()) : [pair.a.slice()];
    const startCell = base[base.length - 1], target = pair.b;
    const key = (r, c) => `${r},${c}`;
    const queue = [base];
    const seen = new Set([`${key(startCell[0], startCell[1])}|${base.slice(-2).map((q) => key(q[0], q[1])).join('>')}`]);

    while (queue.length) {
      const path = queue.shift(), cur = path[path.length - 1];
      if (cur[0] === target[0] && cur[1] === target[1]) return path;
      for (const [dr, dc] of DIRS4) {
        const nr = cur[0] + dr, nc = cur[1] + dc;
        if (nr < 0 || nr >= this.state.n || nc < 0 || nc >= this.state.n) continue;
        if (path.some((q) => q[0] === nr && q[1] === nc)) continue;
        const candidate = path.concat([[nr, nc]]);
        if (!this.wouldBeLegal(i, cur, [nr, nc], candidate)) continue;
        const sig = `${key(nr, nc)}|${candidate.slice(-2).map((q) => key(q[0], q[1])).join('>')}`;
        if (seen.has(sig)) continue;
        seen.add(sig); queue.push(candidate);
      }
    }
    return null;
  }

  hint() {
    const unsolved = this.state.paths
      .map((p, j) => j)
      .filter((j) => {
        const path = this.state.paths[j], b = this.state.pairs[j].b;
        return !path.length || path[path.length - 1][0] !== b[0] || path[path.length - 1][1] !== b[1];
      });
    if (!unsolved.length) return;

    // Try every unsolved pipe (not just the first) and take the shortest
    // legal completion found — a dead end for one doesn't block hinting
    // altogether, and finishing the closest-to-done pipe first tends to
    // leave the most room for the rest.
    let i = -1, solution = null;
    for (const j of unsolved) {
      const found = this.findContinuation(j);
      if (found && (!solution || found.length < solution.length)) { i = j; solution = found; }
    }

    if (solution === null) {
      this.scene.setHint('No pipe has a legal continuation right now — try Undo.');
      return;
    }

    const pair = this.state.pairs[i];
    const next = solution[Math.min(this.state.paths[i].length, solution.length - 1)];
    const from = this.state.paths[i].length ? this.state.paths[i][this.state.paths[i].length - 1] : pair.a;
    if (!this.state.paths[i].length) this.state.paths[i] = [pair.a.slice()];
    const candidate = this.state.paths[i].concat([next]);
    if (this.wouldBeLegal(i, from, next, candidate)) {
      this.scene.record();
      this.state.paths[i].push(next.slice());
      this.state.moves++;
      this.scene.setHint(`Hint extended pipe ${i + 1} using a legal step.`);
      if (next[0] === pair.b[0] && next[1] === pair.b[1]) this.state.active = -1;
      this.scene.afterMutate(this.isSolved());
    }
  }

  redraw() {
    const { n, pairs, paths, active } = this.state, s = 560 / n;
    const g = this.addToBoard(this.scene.add.graphics());

    g.fillStyle(0x151515, 1);
    g.fillRect(20, 20, 560, 560);
    g.lineStyle(1, 0x3a3a3a, 1);
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo(20 + i * s, 20); g.lineTo(20 + i * s, 580); g.strokePath();
      g.beginPath(); g.moveTo(20, 20 + i * s); g.lineTo(580, 20 + i * s); g.strokePath();
    }

    paths.forEach((path, i) => {
      if (!path.length) return;
      g.lineStyle(Math.max(10, s * 0.26), pairs[i].color, 1);
      g.beginPath();
      path.forEach((p, j) => {
        const x = 20 + p[1] * s + s / 2, y = 20 + p[0] * s + s / 2;
        if (j === 0) g.moveTo(x, y); else g.lineTo(x, y);
      });
      g.strokePath();
    });

    pairs.forEach((p) => {
      [[p.a, 'SRC'], [p.b, 'OUT']].forEach(([pt, label]) => {
        const x = 20 + pt[1] * s + s / 2, y = 20 + pt[0] * s + s / 2;
        g.fillStyle(p.color, 1);
        g.fillCircle(x, y, Math.min(15, s * 0.2));
        g.lineStyle(3, 0xffffff, 1);
        g.strokeCircle(x, y, Math.min(15, s * 0.2));
        this.addToBoard(
          this.scene.add.text(x, y, label, { fontFamily: THEME.FONT, fontSize: '9px', fontStyle: 'bold', color: '#111111' }).setOrigin(0.5),
        );
      });
    });

    const status = active >= 0
      ? 'Route around the other pipes — cells cannot be shared.'
      : 'Every pipe needs its own path: no sharing, no crossing.';
    this.addToBoard(
      this.scene.add.text(28, 588, status, { fontFamily: THEME.FONT, fontSize: '12px', fontStyle: 'bold', color: THEME.HINT }),
    );
  }

  // Every pipe connected: pulse a bright overlay along each run, like
  // water/current surging through on completion.
  playWinAnimation(onDone) {
    const { n, paths } = this.state, s = 560 / n;
    const glow = this.scene.add.graphics();
    this.scene.boardContainer.add(glow);
    glow.lineStyle(Math.max(16, s * 0.34), 0xffffff, 1);
    paths.forEach((path) => {
      if (!path.length) return;
      glow.beginPath();
      path.forEach((p, j) => {
        const x = 20 + p[1] * s + s / 2, y = 20 + p[0] * s + s / 2;
        if (j === 0) glow.moveTo(x, y); else glow.lineTo(x, y);
      });
      glow.strokePath();
    });
    glow.setAlpha(0);
    this.scene.tweens.add({
      targets: glow, alpha: { from: 0, to: 0.65 }, yoyo: true, repeat: 1, duration: 220,
      onComplete: () => { glow.destroy(); onDone(); },
    });
  }
}
