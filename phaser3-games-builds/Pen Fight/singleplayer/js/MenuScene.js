//==================================================
// MenuScene.js
//==================================================

import { GAME } from './Constants.js';
import { THEME } from './Theme.js';
import { MATCH, GAME_MODE } from './GameConfig.js';

const CHAOS_MATCH_SECONDS = Math.round(MATCH.CHAOS_MATCH_TIME / 1000);

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  //--------------------------------------------------
  // Create
  //--------------------------------------------------

  create() {
    this.cameras.main.setBackgroundColor(THEME.PAPER);

    this.buildPaperBackground();

    // Local draft of the settings — only written back to MATCH on Start
    this.draft = {
      mode: MATCH.MODE,
      useTurnTimer: MATCH.USE_TURN_TIMER,
      waitForSettle: MATCH.WAIT_FOR_SETTLE,
      useMatchTimeLimit: MATCH.USE_MATCH_TIME_LIMIT,
    };

    this.buildTitle();
    this.buildModeButtons();
    this.buildToggles();
    this.buildChaosInfo();
    this.buildStartButton();

    this.refreshUI();
  }

  //--------------------------------------------------
  // Notebook Paper Background
  //--------------------------------------------------

  buildPaperBackground() {
    const g = this.add.graphics();

    g.setDepth(-100);

    // Faint ruled lines
    g.lineStyle(2, THEME.PAPER_LINE, 0.6);

    for (let y = 40; y < GAME.HEIGHT; y += 44) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(GAME.WIDTH, y);
      g.strokePath();
    }

    // Red margin line
    g.lineStyle(3, THEME.PAPER_MARGIN, 0.7);
    g.beginPath();
    g.moveTo(90, 0);
    g.lineTo(90, GAME.HEIGHT);
    g.strokePath();
  }

  //--------------------------------------------------
  // Title
  //--------------------------------------------------

  buildTitle() {
    this.add
      .text(GAME.WIDTH / 2, 90, 'PEN FIGHT', {
        fontFamily: THEME.FONT_HEADING,
        fontSize: '72px',
        color: '#2f6fb3',
        stroke: '#3b2a20',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setRotation(-0.02);

    this.add
      .text(GAME.WIDTH / 2, 155, 'Select Game Mode', {
        fontFamily: THEME.FONT_BODY,
        fontSize: '26px',
        color: THEME.TEXT_MUTED,
      })
      .setOrigin(0.5);
  }

  //--------------------------------------------------
  // Mode Buttons
  //--------------------------------------------------

  buildModeButtons() {
    const centerX = GAME.WIDTH / 2;

    this.turnBasedButton = this.createButton(
      centerX - 170,
      240,
      300,
      80,
      'TURN-BASED',
      () => this.setMode(GAME_MODE.TURN_BASED),
    );

    this.chaosButton = this.createButton(
      centerX + 170,
      240,
      300,
      80,
      'CHAOS',
      () => this.setMode(GAME_MODE.CHAOS),
    );
  }

  setMode(mode) {
    this.draft.mode = mode;

    this.refreshUI();
  }

  //--------------------------------------------------
  // Option Toggles
  //--------------------------------------------------

  buildToggles() {
    const centerX = GAME.WIDTH / 2;

    this.timerToggle = this.createToggle(centerX, 370, 'TURN TIMER', () => {
      this.draft.useTurnTimer = !this.draft.useTurnTimer;

      this.refreshUI();
    });

    this.settleToggle = this.createToggle(
      centerX,
      450,
      'WAIT FOR SETTLE',
      () => {
        this.draft.waitForSettle = !this.draft.waitForSettle;

        this.refreshUI();
      },
    );

    this.matchTimeToggle = this.createToggle(
      centerX,
      530,
      'MATCH TIME LIMIT',
      () => {
        this.draft.useMatchTimeLimit = !this.draft.useMatchTimeLimit;

        this.refreshUI();
      },
    );
  }

  //--------------------------------------------------
  // Chaos Mode Info
  // (chaos has no turn timer toggle — it always runs on a fixed
  // whole-match countdown instead, since there's no turn order to
  // otherwise bring the match to an end)
  //--------------------------------------------------

  buildChaosInfo() {
    this.chaosInfoText = this.add
      .text(GAME.WIDTH / 2, 370, `MATCH ENDS AFTER ${CHAOS_MATCH_SECONDS}s`, {
        fontFamily: THEME.FONT_BODY,
        fontSize: '24px',
        color: THEME.TEXT_MUTED,
      })
      .setOrigin(0.5);
  }

  //--------------------------------------------------
  // Start Button
  //--------------------------------------------------

  buildStartButton() {
    this.createButton(
      GAME.WIDTH / 2,
      650,
      280,
      90,
      'START',
      () => this.startGame(),
      THEME.INK_RED,
      THEME.INK_RED_DARK,
    );
  }

  startGame() {
    const isTurnBased = this.draft.mode === GAME_MODE.TURN_BASED;

    MATCH.MODE = this.draft.mode;
    MATCH.USE_TURN_TIMER = this.draft.useTurnTimer;

    // Chaos mode never waits for settling — there's no turn to hand off
    MATCH.WAIT_FOR_SETTLE = isTurnBased ? this.draft.waitForSettle : false;

    // Chaos mode always runs its own fixed match countdown regardless
    MATCH.USE_MATCH_TIME_LIMIT = isTurnBased
      ? this.draft.useMatchTimeLimit
      : false;

    this.scene.start('GameScene');
  }

  //--------------------------------------------------
  // UI State
  //--------------------------------------------------

  refreshUI() {
    const isTurnBased = this.draft.mode === GAME_MODE.TURN_BASED;

    this.setButtonActive(this.turnBasedButton, isTurnBased);
    this.setButtonActive(this.chaosButton, !isTurnBased);

    // Turn timer, wait-for-settle & match time limit are turn-based-only
    // concepts. Chaos always runs on its own fixed match countdown instead.
    this.timerToggle.setVisible(isTurnBased);
    this.settleToggle.setVisible(isTurnBased);
    this.matchTimeToggle.setVisible(isTurnBased);
    this.chaosInfoText.setVisible(!isTurnBased);

    if (isTurnBased) {
      this.setToggleState(this.timerToggle, this.draft.useTurnTimer);
      this.setToggleState(this.settleToggle, this.draft.waitForSettle);
      this.setToggleState(this.matchTimeToggle, this.draft.useMatchTimeLimit);
    }
  }

  setButtonActive(container, active) {
    container.bg.setFillStyle(active ? THEME.INK_BLUE : THEME.WOOD_BROWN);
  }

  setToggleState(container, on) {
    container.bg.setFillStyle(on ? THEME.CHALK_GREEN : THEME.WOOD_BROWN);

    container.label.setText(`${container.baseLabel}: ${on ? 'ON' : 'OFF'}`);
  }

  //--------------------------------------------------
  // Button Factory
  //--------------------------------------------------

  createButton(x, y, w, h, label, onClick, color = THEME.WOOD_BROWN, hoverColor) {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, w, h, color);

    bg.setStrokeStyle(4, 0x3b2a20);

    const text = this.add
      .text(0, 0, label, {
        fontFamily: THEME.FONT_BODY,
        fontSize: '26px',
        color: THEME.TEXT_PAPER,
      })
      .setOrigin(0.5);

    container.add([bg, text]);

    container.setSize(w, h);

    container.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, w, h),
      Phaser.Geom.Rectangle.Contains,
    );

    // Only static buttons (no other dynamic color state) get a hover
    // swap — mode/toggle buttons already show state via refreshUI(),
    // and a naive hover-out would stomp that color.
    if (hoverColor) {
      container.on('pointerover', () => bg.setFillStyle(hoverColor));
      container.on('pointerout', () => bg.setFillStyle(color));
    }

    container.on('pointerup', onClick);

    container.bg = bg;
    container.label = text;

    return container;
  }

  //--------------------------------------------------
  // Toggle Factory
  //--------------------------------------------------

  createToggle(x, y, label, onClick) {
    const container = this.createButton(
      x,
      y,
      360,
      64,
      `${label}: OFF`,
      onClick,
    );

    container.baseLabel = label;

    return container;
  }
}
