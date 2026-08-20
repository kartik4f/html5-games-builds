//==================================================
// scenes/GameScene.js
//==================================================
// Hosts the UI chrome (tabs, info bar, objective, sidebar controls, hint,
// win popup) in a landscape layout — board on the left, sidebar on the
// right — and delegates puzzle-specific drawing/logic to the active
// module in js/puzzles/.

import {
  GAME, BOARD_X, BOARD_Y, BOARD_LOCAL_SIZE, BOARD_DISPLAY_SIZE, BOARD_SCALE,
  SIDEBAR_X, SIDEBAR_WIDTH, MAX_LEVELS, GRAVITY_GAME_INDEX,
  GAME_TITLES, GAME_ICONS, OBJECTIVES, INSTRUCTIONS, HELP_TEXT,
} from '../Constants.js';
import { THEME, ACCENTS } from '../Theme.js';
import { Rng, seedForLevel, clone } from '../Utils.js';
import { createButton } from '../ui/Button.js';

import PathShift from '../puzzles/PathShift.js';
import GravityBlocks from '../puzzles/GravityBlocks.js';
import ColorFlow from '../puzzles/ColorFlow.js';
import ShapePacking from '../puzzles/ShapePacking.js';

const GRAVITY_KEY_DIR = {
  ArrowUp: 3, w: 3, W: 3,
  ArrowDown: 1, s: 1, S: 1,
  ArrowLeft: 2, a: 2, A: 2,
  ArrowRight: 0, d: 0, D: 0,
};

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  create() {
    this.sessionSeed = (Math.random() * 0xffffffff) >>> 0;
    this.gameIndex = 1;
    this.level = 1;
    this.history = [];
    this.redoStack = [];
    this.levelCache = {};

    this.puzzles = {
      1: new PathShift(this),
      2: new GravityBlocks(this),
      3: new ColorFlow(this),
      4: new ShapePacking(this),
    };

    this.cameras.main.setBackgroundColor(THEME.BG);

    this.buildHeader();
    this.buildTabs();
    this.buildInfoBar();
    this.buildObjective();
    this.buildBoard();
    this.buildSidebarText();
    this.buildControls();
    this.buildWinPopup();
    this.wireInput();

    this.showGame(1);
  }

  //--------------------------------------------------
  // Chrome
  //--------------------------------------------------

  buildHeader() {
    // Soft vertical gradient instead of a flat fill, for a bit of depth.
    const sky = this.add.graphics();
    sky.fillGradientStyle(THEME.BG_TOP, THEME.BG_TOP, THEME.BG_BOTTOM, THEME.BG_BOTTOM, 1);
    sky.fillRect(0, 0, GAME.WIDTH, GAME.HEIGHT);

    this.add.text(GAME.WIDTH / 2, 34, 'Everyday Puzzle Arcade', {
      fontFamily: THEME.FONT, fontSize: '42px', fontStyle: '800', color: THEME.TEXT,
    }).setOrigin(0.5);

    this.add.text(GAME.WIDTH / 2, 80,
      'Four everyday errands, 10 deterministic levels each — Previous/Next always returns to the same puzzle.',
      { fontFamily: THEME.FONT, fontSize: '16px', fontStyle: '500', color: THEME.TEXT_MUTED, align: 'center' },
    ).setOrigin(0.5);

    // Panel background behind the board + sidebar, with a border and a
    // faint top highlight line for a touch of depth.
    const panelRight = SIDEBAR_X + SIDEBAR_WIDTH + 30;
    const panelX = BOARD_X - 30, panelW = panelRight - panelX, panelY = 160, panelH = 870;
    const panel = this.add.graphics();
    panel.fillStyle(THEME.PANEL, 1);
    panel.fillRoundedRect(panelX, panelY, panelW, panelH, 20);
    panel.lineStyle(2, THEME.PANEL_BORDER, 1);
    panel.strokeRoundedRect(panelX + 1, panelY + 1, panelW - 2, panelH - 2, 19);
    panel.lineStyle(1, 0xffffff, 0.05);
    panel.beginPath();
    panel.moveTo(panelX + 30, panelY + 2);
    panel.lineTo(panelX + panelW - 30, panelY + 2);
    panel.strokePath();
  }

  buildTabs() {
    const keys = Object.keys(GAME_TITLES);
    const labels = keys.map((g) => `${GAME_ICONS[g]} ${GAME_TITLES[g]}`);
    const w = 280, h = 52, gap = 18;
    const totalW = w * labels.length + gap * (labels.length - 1);
    const startX = GAME.WIDTH / 2 - totalW / 2 + w / 2;
    this.tabButtons = labels.map((label, i) =>
      createButton(this, startX + i * (w + gap), 128, w, h, label, () => this.showGame(i + 1), '18px', ACCENTS[keys[i]].color));
  }

  buildInfoBar() {
    this.titleText = this.add.text(SIDEBAR_X, 200, '', {
      fontFamily: THEME.FONT, fontSize: '30px', fontStyle: '700', color: THEME.TEXT, wordWrap: { width: SIDEBAR_WIDTH },
    }).setOrigin(0, 0);
    this.statsText = this.add.text(SIDEBAR_X, 252, '', { fontFamily: THEME.FONT, fontSize: '19px', fontStyle: '500', color: THEME.TEXT_DIM }).setOrigin(0, 0);
    this.difficultyText = this.add.text(SIDEBAR_X, 284, '', { fontFamily: THEME.FONT, fontSize: '19px', fontStyle: '500', color: THEME.TEXT_DIM }).setOrigin(0, 0);
  }

  buildObjective() {
    this.objectiveG = this.add.graphics();
    this.objectiveText = this.add.text(SIDEBAR_X + 26, 344, '', {
      fontFamily: THEME.FONT, fontSize: '18px', fontStyle: '500', color: THEME.TEXT_DIM, wordWrap: { width: SIDEBAR_WIDTH - 42 }, lineSpacing: 4,
    }).setOrigin(0, 0);
  }

  buildBoard() {
    this.boardBg = this.add.graphics();
    // Puzzle modules always draw into a fixed 600x600 local space; scaling
    // the container up to BOARD_DISPLAY_SIZE is what makes it fill the
    // bigger landscape canvas without any puzzle file needing to change.
    this.boardContainer = this.add.container(BOARD_X, BOARD_Y, [this.boardBg]).setScale(BOARD_SCALE);
  }

  // Re-tints the sidebar title, objective accent bar, and board frame to
  // match the active game's color, called whenever the game/level changes.
  applyAccent() {
    const accent = ACCENTS[this.gameIndex];
    this.titleText.setColor(accent.hex);

    this.objectiveG.clear();
    this.objectiveG.fillStyle(THEME.PANEL_LIGHT, 1);
    this.objectiveG.fillRoundedRect(SIDEBAR_X, 328, SIDEBAR_WIDTH, 130, 10);
    this.objectiveG.fillStyle(accent.color, 1);
    this.objectiveG.fillRoundedRect(SIDEBAR_X, 328, 8, 130, 4);

    this.boardBg.clear();
    this.boardBg.fillStyle(0x1a1f2b, 1);
    this.boardBg.fillRoundedRect(0, 0, BOARD_LOCAL_SIZE, BOARD_LOCAL_SIZE, 10);
    this.boardBg.lineStyle(4, accent.color, 0.9);
    this.boardBg.strokeRoundedRect(2, 2, BOARD_LOCAL_SIZE - 4, BOARD_LOCAL_SIZE - 4, 9);
  }

  buildSidebarText() {
    this.helpText = this.add.text(SIDEBAR_X, 476, '', {
      fontFamily: THEME.FONT, fontSize: '16px', color: THEME.TEXT_MUTED, wordWrap: { width: SIDEBAR_WIDTH }, lineSpacing: 4,
    }).setOrigin(0, 0);
    this.instructionsText = this.add.text(SIDEBAR_X, 512, '', {
      fontFamily: THEME.FONT, fontSize: '16px', color: THEME.TEXT_MUTED, wordWrap: { width: SIDEBAR_WIDTH }, lineSpacing: 4,
    }).setOrigin(0, 0);
    this.hintText = this.add.text(SIDEBAR_X, 600, '', {
      fontFamily: THEME.FONT, fontSize: '18px', color: THEME.HINT, wordWrap: { width: SIDEBAR_WIDTH }, lineSpacing: 4,
    }).setOrigin(0, 0);
  }

  buildControls() {
    const specs = [
      ['← Prev', () => this.prevLevel()],
      ['↻ Restart', () => this.restartLevel()],
      ['Next →', () => this.nextLevel()],
      ['↶ Undo', () => this.undo()],
      ['↷ Redo', () => this.redo()],
      ['💡 Hint', () => this.hint()],
    ];
    const cols = 3, w = (SIDEBAR_WIDTH - (cols - 1) * 24) / cols, h = 70, gapX = 24, gapY = 20;
    const baseY = 750;

    const buttons = specs.map((s, i) => {
      const col = i % cols, row = Math.floor(i / cols);
      const x = SIDEBAR_X + col * (w + gapX) + w / 2;
      const y = baseY + row * (h + gapY);
      return createButton(this, x, y, w, h, s[0], s[1], '19px');
    });
    [this.prevBtn, this.restartBtn, this.nextBtn, this.undoBtn, this.redoBtn, this.hintBtn] = buttons;
  }

  buildWinPopup() {
    const c = this.add.container(GAME.WIDTH / 2, GAME.HEIGHT / 2).setDepth(1000).setVisible(false);
    const dim = this.add.rectangle(0, 0, GAME.WIDTH, GAME.HEIGHT, 0x000000, 0.65).setInteractive();
    this.winCard = this.add.graphics();
    const msg = this.add.text(0, -40, '', {
      fontFamily: THEME.FONT, fontSize: '28px', fontStyle: '700', color: THEME.TEXT, align: 'center', wordWrap: { width: 500 },
    }).setOrigin(0.5);
    const continueBtn = createButton(this, 0, 60, 220, 56, 'Continue ▶', () => this.dismissWinPopup(), '19px');
    c.add([dim, this.winCard, msg, continueBtn]);
    this.winPopup = c;
    this.winMsg = msg;
  }

  //--------------------------------------------------
  // Input
  //--------------------------------------------------

  wireInput() {
    this.input.on('pointerdown', (pointer) => {
      const [x, y] = this.toBoardLocal(pointer);
      if (x < 0 || x > BOARD_LOCAL_SIZE || y < 0 || y > BOARD_LOCAL_SIZE) return;
      this.activePuzzle()?.onPointerDown?.(x, y);
    });
    this.input.on('pointermove', (pointer) => {
      const [x, y] = this.toBoardLocal(pointer);
      this.activePuzzle()?.onPointerMove?.(x, y);
    });
    const up = (pointer) => {
      const [x, y] = this.toBoardLocal(pointer);
      this.activePuzzle()?.onPointerUp?.(x, y);
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);

    this.input.on('wheel', (pointer, gameObjects, deltaX, deltaY) => {
      const [x, y] = this.toBoardLocal(pointer);
      if (x < 0 || x > BOARD_LOCAL_SIZE || y < 0 || y > BOARD_LOCAL_SIZE) return;
      this.activePuzzle()?.onWheel?.(deltaY, x, y);
    });

    this.input.keyboard.on('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); this.undo(); return; }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y') { event.preventDefault(); this.redo(); return; }
      if (this.gameIndex !== GRAVITY_GAME_INDEX) return;
      const d = GRAVITY_KEY_DIR[event.key];
      if (d !== undefined) { event.preventDefault(); this.activePuzzle().onKey(d); }
    });
  }

  // Converts a scene-space pointer into the puzzle's fixed 0..600 local
  // board space, undoing both the container's offset and its display scale.
  toBoardLocal(pointer) {
    return [
      (pointer.x - this.boardContainer.x) / BOARD_SCALE,
      (pointer.y - this.boardContainer.y) / BOARD_SCALE,
    ];
  }

  //--------------------------------------------------
  // Puzzle / level lifecycle
  //--------------------------------------------------

  activePuzzle() { return this.puzzles[this.gameIndex]; }
  levelKey() { return `${this.gameIndex}:${this.level}`; }

  showGame(g) {
    this.activePuzzle()?.destroy?.();
    this.gameIndex = g;
    this.level = 1;
    this.tabButtons.forEach((b, i) => b.setActive2(i === g - 1));
    this.newLevel();
  }

  newLevel() {
    this.level = Math.max(1, Math.min(MAX_LEVELS, this.level));
    this.clearHint();

    const puzzle = this.activePuzzle();
    // Reset any puzzle-specific persistent objects (e.g. Backyard Golf's
    // ball sprite) whenever the level changes, whether freshly generated
    // or restored from cache — otherwise a sprite sized/tweening for the
    // previous level's grid could carry over.
    puzzle.destroy?.();

    const key = this.levelKey();
    if (this.levelCache[key]) {
      puzzle.state = clone(this.levelCache[key]);
    } else {
      const rng = new Rng(seedForLevel(this.sessionSeed, this.gameIndex, this.level));
      puzzle.generate(this.level, rng);
      this.levelCache[key] = clone(puzzle.state);
    }
    // history holds only *past* states — the live state is always
    // `puzzle.state` itself, never duplicated into the array. A fresh
    // level has no past to undo to yet.
    this.history = [];
    this.redoStack = [];
    this.draw();
  }

  restartLevel() { this.newLevel(); }
  nextLevel() { if (this.level < MAX_LEVELS) { this.level++; this.newLevel(); } }
  prevLevel() { if (this.level > 1) { this.level--; this.newLevel(); } }

  //--------------------------------------------------
  // History (undo/redo) — generic across all puzzle types.
  //--------------------------------------------------

  // Puzzles call this immediately before mutating their state, so it
  // snapshots the about-to-be-left-behind state onto the undo stack.
  record() {
    this.history.push(clone(this.activePuzzle().state));
    this.redoStack = [];
  }

  undo() {
    if (!this.history.length) return;
    const puzzle = this.activePuzzle();
    this.redoStack.push(clone(puzzle.state));
    puzzle.state = clone(this.history.pop());
    this.clearHint();
    this.draw();
  }

  redo() {
    if (!this.redoStack.length) return;
    const puzzle = this.activePuzzle();
    const next = this.redoStack.pop();
    this.history.push(clone(puzzle.state));
    puzzle.state = clone(next);
    this.clearHint();
    this.draw();
  }

  hint() { this.activePuzzle().hint(); }

  //--------------------------------------------------
  // Called by puzzle modules after any state mutation.
  //--------------------------------------------------

  afterMutate(solved) {
    this.draw();
    if (!solved) return;
    const puzzle = this.activePuzzle();
    this.time.delayedCall(150, () => {
      if (puzzle.playWinAnimation) puzzle.playWinAnimation(() => this.showWinPopup());
      else this.showWinPopup();
    });
  }

  setHint(text) { this.hintText.setText(text); }
  clearHint() { this.hintText.setText(''); }

  //--------------------------------------------------
  // Win popup
  //--------------------------------------------------

  showWinPopup() {
    const accent = ACCENTS[this.gameIndex];
    this.winCard.clear();
    this.winCard.fillStyle(THEME.PANEL, 1);
    this.winCard.fillRoundedRect(-280, -120, 560, 240, 18);
    this.winCard.lineStyle(3, accent.color, 1);
    this.winCard.strokeRoundedRect(-278, -118, 556, 236, 17);

    this.winMsg.setText(this.level === MAX_LEVELS
      ? 'Solved! 🎉\nYou completed all 10 levels of this game.'
      : 'Solved! ✅');

    this.winPopup.setVisible(true).setScale(0.85).setAlpha(0);
    this.tweens.add({ targets: this.winPopup, scale: 1, alpha: 1, duration: 220, ease: 'Back.easeOut' });

    if (this._winTimer) this._winTimer.remove();
    this._winTimer = this.time.delayedCall(2200, () => this.dismissWinPopup());
  }

  dismissWinPopup() {
    if (this._winTimer) { this._winTimer.remove(); this._winTimer = null; }
    this.winPopup.setVisible(false);
    if (this.level < MAX_LEVELS) { this.level++; this.newLevel(); }
  }

  //--------------------------------------------------
  // Draw / refresh
  //--------------------------------------------------

  difficultyScore() { return Math.min(5, 1 + Math.floor((this.level - 1) * 4 / 9)); }

  draw() {
    const puzzle = this.activePuzzle();
    this.applyAccent();

    this.titleText.setText(`${GAME_ICONS[this.gameIndex]} ${GAME_TITLES[this.gameIndex]} — Level ${this.level}`);
    this.statsText.setText(`Moves: ${puzzle.state.moves} • Level ${this.level}/${MAX_LEVELS}`);
    const ds = this.difficultyScore();
    this.difficultyText.setText(`Difficulty: ${'★'.repeat(ds)}${'☆'.repeat(5 - ds)}`);

    this.prevBtn.setDisabled(this.level <= 1);
    this.nextBtn.setDisabled(this.level >= MAX_LEVELS);
    this.undoBtn.setDisabled(!this.history.length);
    this.redoBtn.setDisabled(!this.redoStack.length);

    this.objectiveText.setText(`Objective: ${OBJECTIVES[this.gameIndex]}`);
    this.helpText.setText(HELP_TEXT[this.gameIndex]);
    this.instructionsText.setText(INSTRUCTIONS[this.gameIndex]);

    puzzle.draw();
  }
}
