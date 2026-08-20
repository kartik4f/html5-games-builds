//==================================================
// puzzles/ShapePacking.js
//==================================================
// Moving Day: select a box from the scrollable inventory, rotate it, then
// load it into the truck bed. Fit every box in without overlap.

import PuzzleBase from './PuzzleBase.js';
import { THEME } from '../Theme.js';

const INV_Y = 390, INV_H = 175, CARD_W = 105, CARD_H = 72, COLS = 5, GAP_Y = 8;

export default class ShapePacking extends PuzzleBase {
  generate(level, rng) {
    const n = level <= 2 ? 4 : level <= 4 ? 5 : level <= 7 ? 6 : 7;
    const pieces = [];
    const anchors = [];
    let cells = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push([r, c]);

    while (cells.length) {
      const i = rng.int(cells.length), a = cells.splice(i, 1)[0], p = [a];
      const maxSize = level <= 3 ? 3 : level <= 6 ? 2 : 2;
      while (p.length < maxSize && cells.length && rng.int(100) < (level <= 4 ? 70 : 55)) {
        const cand = cells.filter((q) => p.some((z) => Math.abs(z[0] - q[0]) + Math.abs(z[1] - q[1]) === 1));
        if (!cand.length) break;
        const b = cand[rng.int(cand.length)];
        cells.splice(cells.findIndex((q) => q[0] === b[0] && q[1] === b[1]), 1);
        p.push(b);
      }
      const ar = p[0];
      pieces.push(p.map((q) => [q[0] - ar[0], q[1] - ar[1]]));
      anchors.push(ar);
    }

    this.state = {
      n, pieces, placed: Array(pieces.length).fill(null), selected: -1,
      rotations: Array(pieces.length).fill(0), moves: 0, packScroll: 0,
      // Each piece's original (unrotated) position in the source partition.
      // Placing every piece back at its anchor always reconstructs a valid
      // tiling, so Hint can use this to place a piece without ever getting
      // boxed in by earlier (possibly suboptimal) hint placements.
      anchors,
    };
  }

  shapeOf(i) {
    let p = this.state.pieces[i].map((q) => q.slice());
    for (let k = 0; k < this.state.rotations[i]; k++) p = p.map((q) => [-q[1], q[0]]);
    const mr = Math.min(...p.map((q) => q[0])), mc = Math.min(...p.map((q) => q[1]));
    return p.map((q) => [q[0] - mr, q[1] - mc]);
  }

  isSolved() { return this.state.placed.every(Boolean); }

  occupied(cells) {
    return cells.some((q) => this.state.placed.some((p) => p && p.some((z) => z[0] === q[0] && z[1] === q[1])));
  }

  maxScroll() {
    const rows = Math.ceil(this.state.pieces.length / COLS), contentH = rows * (CARD_H + GAP_Y);
    return Math.max(0, contentH - INV_H);
  }

  onWheel(dy) {
    this.state.packScroll = Math.max(0, Math.min(this.maxScroll(), (this.state.packScroll || 0) + dy));
    this.scene.afterMutate(false);
  }

  scrollBy(delta) {
    this.state.packScroll = Math.max(0, Math.min(this.maxScroll(), (this.state.packScroll || 0) + delta));
    this.scene.afterMutate(false);
  }

  onPointerDown(x, y) {
    const { n } = this.state, s = Math.min(330 / n, 54), gx = 135, gy = 35;
    const scroll = this.state.packScroll || 0;

    if (y >= INV_Y && y <= INV_Y + INV_H) {
      const localY = y - INV_Y + scroll, col = Math.floor(x / CARD_W), row = Math.floor(localY / (CARD_H + GAP_Y));
      const i = row * COLS + col;
      if (col >= 0 && col < COLS && i >= 0 && i < this.state.pieces.length && !this.state.placed[i]) {
        this.scene.record();
        if (this.state.selected === i) this.state.rotations[i] = (this.state.rotations[i] + 1) % 4;
        else this.state.selected = i;
        this.state.moves++;
        this.scene.afterMutate(false);
      }
      return;
    }

    if (this.state.selected < 0) return;
    const c = Math.floor((x - gx) / s), r = Math.floor((y - gy) / s);
    if (r < 0 || r >= n || c < 0 || c >= n) return;
    const p = this.shapeOf(this.state.selected), cells = p.map((q) => [r + q[0], c + q[1]]);
    if (cells.some((q) => q[0] < 0 || q[0] >= n || q[1] < 0 || q[1] >= n) || this.occupied(cells)) return;
    this.scene.record();
    this.state.placed[this.state.selected] = cells;
    this.state.selected = -1;
    this.state.moves++;
    this.scene.afterMutate(this.isSolved());
  }

  hint() {
    const i = this.state.placed.findIndex((x) => !x);
    if (i < 0) return;
    const { n, pieces, anchors } = this.state;

    // Placing at the piece's original (unrotated) anchor always reconstructs
    // a valid tiling, so try that first — it never boxes a later piece in.
    const anchorCells = pieces[i].map((q) => [anchors[i][0] + q[0], anchors[i][1] + q[1]]);
    let cells = null, rotation = 0;
    if (!this.occupied(anchorCells)) {
      cells = anchorCells;
    } else {
      // The anchor cell got taken by an earlier manual (non-hint) placement.
      // Fall back to a full scan across every rotation and position.
      outer: for (let k = 0; k < 4; k++) {
        let shape = pieces[i].map((q) => q.slice());
        for (let t = 0; t < k; t++) shape = shape.map(([r, c]) => [-c, r]);
        const mr = Math.min(...shape.map((q) => q[0])), mc = Math.min(...shape.map((q) => q[1]));
        shape = shape.map(([r, c]) => [r - mr, c - mc]);
        for (let r = 0; r < n; r++) {
          for (let c = 0; c < n; c++) {
            const candidate = shape.map((q) => [r + q[0], c + q[1]]);
            if (candidate.every((q) => q[0] >= 0 && q[0] < n && q[1] >= 0 && q[1] < n) && !this.occupied(candidate)) {
              cells = candidate; rotation = k;
              break outer;
            }
          }
        }
      }
    }

    if (cells) {
      this.scene.record();
      this.state.placed[i] = cells;
      this.state.rotations[i] = rotation;
    }
    this.state.moves++;
    this.scene.setHint(cells ? `Hint solved one step: Box ${i + 1} was loaded automatically.` : 'No valid spot found for this box — try Undo to free up space.');
    this.scene.afterMutate(this.isSolved());
  }

  drawPiece(g, p, x, y, s, fill) {
    g.fillStyle(fill, 1);
    g.lineStyle(1, 0xffffff, 1);
    p.forEach((q) => {
      g.fillRect(x + q[1] * s + 2, y + q[0] * s + 2, s - 4, s - 4);
      g.strokeRect(x + q[1] * s + 2, y + q[0] * s + 2, s - 4, s - 4);
    });
  }

  redraw() {
    const { n, pieces, placed, selected, packScroll } = this.state;
    const s = Math.min(330 / n, 54), gx = 135, gy = 35;
    const g = this.addToBoard(this.scene.add.graphics());

    this.addToBoard(this.scene.add.text(gx, 12, '🚚 TRUCK BED', { fontFamily: THEME.FONT, fontSize: '16px', fontStyle: 'bold', color: THEME.TEXT }));

    g.lineStyle(1, 0x555555, 1);
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) g.strokeRect(gx + c * s, gy + r * s, s, s);
    placed.forEach((p, i) => { if (p) this.drawPiece(g, p, gx, gy, s, THEME.PACKING_COLORS[i % 5]); });

    this.addToBoard(this.scene.add.text(20, 370, '📦 BOXES — tap to select • tap selected box to rotate', { fontFamily: THEME.FONT, fontSize: '14px', fontStyle: 'bold', color: THEME.TEXT }));

    // Inventory, clipped to its scroll viewport. Geometry masks are
    // evaluated in world space, so the board container's on-screen scale
    // (it draws this fixed 600x600 local layout larger to fill the
    // landscape canvas) has to be applied here too — otherwise the mask
    // rectangle covers the wrong region once the board isn't shown 1:1,
    // clipping the inventory against the target grid above it instead of
    // its own viewport.
    const boardScale = this.scene.boardContainer.scaleX;
    const maskShape = this.scene.make.graphics();
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(
      this.scene.boardContainer.x + 10 * boardScale,
      this.scene.boardContainer.y + INV_Y * boardScale,
      575 * boardScale,
      INV_H * boardScale,
    );
    const mask = maskShape.createGeometryMask();

    const invLayer = this.addToBoard(this.scene.add.container(0, 0));
    invLayer.setMask(mask);
    invLayer._maskShape = maskShape;
    const origDestroy = invLayer.destroy.bind(invLayer);
    invLayer.destroy = () => { maskShape.destroy(); origDestroy(); };

    const scroll = packScroll || 0;
    pieces.forEach((_, i) => {
      if (placed[i]) return;
      const row = Math.floor(i / COLS), col = i % COLS;
      const x = 15 + col * CARD_W, y = INV_Y + row * (CARD_H + GAP_Y) - scroll;
      if (y > INV_Y + INV_H || y + CARD_H < INV_Y) return;
      const p = this.shapeOf(i), mr = Math.max(...p.map((q) => q[0])), mc = Math.max(...p.map((q) => q[1]));
      const cs = Math.min(24, 50 / Math.max(mr + 1, mc + 1));
      const cardG = this.scene.add.graphics();
      cardG.lineStyle(2, i === selected ? 0xffffff : 0x444444, 1);
      cardG.strokeRect(x, y, CARD_W - 8, CARD_H);
      this.drawPiece(cardG, p, x + 8, y + 17, cs, THEME.PACKING_COLORS[i % 5]);
      invLayer.add(cardG);
      const label = this.scene.add.text(x + 5, y + 4, `Box ${i + 1}`, { fontFamily: THEME.FONT, fontSize: '11px', color: THEME.TEXT });
      invLayer.add(label);
    });

    // Scrollbar + touch scroll buttons.
    const maxScroll = this.maxScroll();
    g.fillStyle(0x333333, 1);
    g.fillRect(588, INV_Y, 5, INV_H);
    if (maxScroll > 0) {
      const thumbH = Math.max(28, INV_H * (INV_H / (Math.ceil(pieces.length / COLS) * (CARD_H + GAP_Y))));
      const thumbY = INV_Y + (scroll / maxScroll) * (INV_H - thumbH);
      g.fillStyle(0x888888, 1);
      g.fillRect(588, thumbY, 5, thumbH);

      const upBtn = this.scene.add.text(602, INV_Y, '▲', { fontFamily: THEME.FONT, fontSize: '16px', color: THEME.TEXT }).setInteractive();
      upBtn.on('pointerdown', () => this.scrollBy(-(CARD_H + GAP_Y)));
      this.addToBoard(upBtn);
      const downBtn = this.scene.add.text(602, INV_Y + INV_H - 18, '▼', { fontFamily: THEME.FONT, fontSize: '16px', color: THEME.TEXT }).setInteractive();
      downBtn.on('pointerdown', () => this.scrollBy(CARD_H + GAP_Y));
      this.addToBoard(downBtn);
    }

    const statusText = selected >= 0
      ? `Selected Box ${selected + 1} — tap it again to rotate, then tap the TRUCK BED to load it.`
      : 'Select a box. Scroll the inventory if needed. Tap the selected box again to rotate.';
    this.addToBoard(this.scene.add.text(20, 585, statusText, { fontFamily: THEME.FONT, fontSize: '12px', color: THEME.HINT }));
  }

  // Every box loaded: a green "all packed" flash across the truck bed.
  playWinAnimation(onDone) {
    const { n } = this.state, s = Math.min(330 / n, 54), gx = 135, gy = 35;
    const glow = this.scene.add.graphics();
    this.scene.boardContainer.add(glow);
    glow.fillStyle(0x4ade80, 1);
    glow.fillRect(gx, gy, s * n, s * n);
    glow.setAlpha(0);
    this.scene.tweens.add({
      targets: glow, alpha: { from: 0, to: 0.55 }, yoyo: true, repeat: 1, duration: 220,
      onComplete: () => { glow.destroy(); onDone(); },
    });
  }
}
