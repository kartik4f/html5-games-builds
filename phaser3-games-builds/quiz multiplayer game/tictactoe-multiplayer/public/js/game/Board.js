/**
 * Board — renders the 3×3 Tic-Tac-Toe grid and handles cell clicks.
 *
 * Coordinate system: `x` and `y` mark the top-left corner of the board.
 * All symbols are drawn relative to each cell's centre so that Phaser
 * tweens scale them in from the middle with no extra offset math.
 */

const COLORS = {
  grid: 0x4a90d9,
  X:    0xe94560,
  O:    0x4a90d9,
  win:  0xffd700,
};

export default class Board {
  /**
   * @param {Phaser.Scene} scene
   * @param {number} x       Top-left X of the board
   * @param {number} y       Top-left Y of the board
   * @param {number} size    Total width/height in pixels (square board)
   */
  constructor(scene, x, y, size) {
    this.scene    = scene;
    this.x        = x;
    this.y        = y;
    this.size     = size;
    this.cellSize = size / 3;

    /** Sparse array of placed symbols: index → 'X' | 'O' | null */
    this.cells = Array(9).fill(null);

    /** All graphics/objects for placed symbols (destroyed on reset) */
    this._symbolObjects = [];

    /** Interactive zones for each cell */
    this._zones = [];

    /** Called with the cell index when a player clicks a valid cell */
    this.onCellClick = null;

    this._drawGrid();
    this._setupZones();
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Render a symbol in a cell with a scale-in animation.
   * @param {number}     index  0–8
   * @param {'X'|'O'}   symbol
   */
  placeSymbol(index, symbol) {
    if (this.cells[index] !== null) return;
    this.cells[index] = symbol;

    const { cx, cy } = this._cellCenter(index);
    const half = this.cellSize / 2 * 0.6; // symbol radius

    const g = this.scene.add.graphics();
    g.x = cx;
    g.y = cy;

    if (symbol === 'X') {
      g.lineStyle(7, COLORS.X, 1);
      g.lineBetween(-half, -half,  half,  half);
      g.lineBetween( half, -half, -half,  half);
    } else {
      g.lineStyle(7, COLORS.O, 1);
      g.strokeCircle(0, 0, half);
    }

    // Animate from nothing
    g.setScale(0);
    this.scene.tweens.add({
      targets:  g,
      scaleX:   1,
      scaleY:   1,
      duration: 220,
      ease:     'Back.out',
    });

    this._symbolObjects.push(g);
  }

  /**
   * Draw the golden winning line across the three winning cells.
   * @param {number[]} line  Three cell indices, e.g. [0, 1, 2]
   */
  drawWinLine(line) {
    const start = this._cellCenter(line[0]);
    const end   = this._cellCenter(line[2]);

    const g = this.scene.add.graphics();
    g.lineStyle(6, COLORS.win, 1);

    // Animate the line by tweening an intermediate value
    const progress = { t: 0 };
    this.scene.tweens.add({
      targets:  progress,
      t:        1,
      duration: 350,
      ease:     'Sine.out',
      onUpdate: () => {
        g.clear();
        g.lineStyle(6, COLORS.win, 1);
        g.lineBetween(
          start.cx,
          start.cy,
          Phaser.Math.Linear(start.cx, end.cx, progress.t),
          Phaser.Math.Linear(start.cy, end.cy, progress.t),
        );
      },
    });

    this._symbolObjects.push(g);
  }

  /**
   * Enable or disable click interaction on all cells.
   * @param {boolean} enabled
   */
  setClickable(enabled) {
    this._zones.forEach((z) => {
      if (enabled) z.setInteractive({ useHandCursor: true });
      else         z.disableInteractive();
    });
  }

  /**
   * Clear symbols and re-enable clicks for a new round.
   */
  reset() {
    this.cells = Array(9).fill(null);
    this._symbolObjects.forEach((o) => o.destroy());
    this._symbolObjects = [];
    this.setClickable(true);
  }

  destroy() {
    this._gridGraphics?.destroy();
    this._symbolObjects.forEach((o) => o.destroy());
    this._zones.forEach((z) => z.destroy());
  }

  // ─── Private helpers ─────────────────────────────────────────────────────

  _drawGrid() {
    const g = this.scene.add.graphics();
    g.lineStyle(4, COLORS.grid, 0.9);

    // Two vertical dividers
    for (let c = 1; c <= 2; c++) {
      const px = this.x + c * this.cellSize;
      g.lineBetween(px, this.y, px, this.y + this.size);
    }
    // Two horizontal dividers
    for (let r = 1; r <= 2; r++) {
      const py = this.y + r * this.cellSize;
      g.lineBetween(this.x, py, this.x + this.size, py);
    }

    this._gridGraphics = g;
  }

  _setupZones() {
    for (let i = 0; i < 9; i++) {
      const { cx, cy } = this._cellCenter(i);
      const zone = this.scene.add
        .zone(cx, cy, this.cellSize, this.cellSize)
        .setInteractive({ useHandCursor: true });

      zone.on('pointerdown', () => {
        if (this.cells[i] !== null) return; // already occupied
        this.onCellClick?.(i);
      });

      this._zones.push(zone);
    }
  }

  /** Returns the pixel centre of cell `index`. */
  _cellCenter(index) {
    const col = index % 3;
    const row = Math.floor(index / 3);
    return {
      cx: this.x + col * this.cellSize + this.cellSize / 2,
      cy: this.y + row * this.cellSize + this.cellSize / 2,
    };
  }
}
