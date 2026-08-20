//==================================================
// GameScene.js
//==================================================

import Physics from './Physics.js';
import PenManager from './PenManager.js';
import InputController from './InputController.js';
import DebugRenderer from './DebugRenderer.js';
import GameRules from './GameRules.js';
import PowerUpManager from './PowerUps.js';
import AIController from './AIController.js';

import TurnTimer from './ui/TurnTimer.js';
import MatchTimer from './ui/MatchTimer.js';
import TurnIndicator from './ui/TurnIndicator.js';
import WinPopup from './ui/WinPopup.js';
import PlayerStatusRow from './ui/PlayerStatusRow.js';
import { bottomDockLayout } from './ui/BottomDock.js';

import { drawTable } from './TableView.js';

import { GAME, INPUT, JUICE, PEN } from './Constants.js';
import { POWERUPS, LOCAL_MATCH, AI } from './GameConfig.js';
import audioFX from './AudioFX.js';
import { burst, eliminationPuff } from './JuiceFX.js';
import { returnHome } from './AppShell.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }
  init() {
    window.currentScene = this;
  }

  //--------------------------------------------------
  // Create
  //--------------------------------------------------

  create() {
    //------------------------------------------
    // Background
    //------------------------------------------

    this.cameras.main.setBackgroundColor(GAME.BACKGROUND);

    this.addUIItems();

    //------------------------------------------
    // Multi-touch
    //------------------------------------------

    this.input.addPointer(INPUT.MAX_POINTERS - 1);

    //------------------------------------------
    // Physics World
    //------------------------------------------

    this.physicsWorld = new Physics();

    this.physicsWorld.onPenCollision = (penA, penB, relSpeedPx) => {
      const strength = Phaser.Math.Clamp(
        relSpeedPx / JUICE.COLLISION_SPEED_CALIBRATION_PX,
        0,
        1,
      );

      // Only bother with juice for hits with some real force behind
      // them — otherwise every gentle nudge would clack and flash.
      if (strength < JUICE.MIN_STRENGTH) return;

      const x = (penA.container.x + penB.container.x) / 2;
      const y = (penA.container.y + penB.container.y) / 2;

      audioFX.playCollision(strength);
      burst(this, x, y, 0xffffff, {
        count: Math.round(6 + strength * 10),
        speed: 120 + strength * 220,
      });
    };

    //------------------------------------------
    // Draw Table
    //------------------------------------------

    this.createTable();

    //------------------------------------------
    // Pen Manager
    //------------------------------------------

    this.penManager = new PenManager(
      this,

      this.physicsWorld,
    );

    this.penManager.createPens(LOCAL_MATCH.PLAYER_COUNT);

    // ------------------------------------------
    // Game Rules
    // -----------------------------------------
    this.gameRules = new GameRules(this, this.penManager);

    //------------------------------------------
    // Power-ups (optional, off by default — see the setup screens in js/main.js)
    //------------------------------------------

    this.powerUps = new PowerUpManager(this, this.penManager);
    this.powerUps.setEnabled(POWERUPS.ENABLED);

    //------------------------------------------
    // Camera
    //------------------------------------------

    // this.cameras.main.startFollow(
    //   this.penManager.getPens()[0].container,
    //   true,
    //   0.12,
    //   0.12,
    // );

    //------------------------------------------
    // Input
    //------------------------------------------

    this.inputController = new InputController(
      this,
      this.penManager,
      this.gameRules,
    );

    //------------------------------------------
    // Debug
    //------------------------------------------

    this.debugRenderer = new DebugRenderer(
      this,

      this.physicsWorld,
    );

    //------------------------------------------
    // Computer opponent(s) — a no-op if AI.PLAYER_IDS is empty
    // (Classroom mode never sets it; only Vs Computer does).
    //------------------------------------------

    this.aiController = new AIController(this, this.penManager, this.gameRules, {
      difficulty: AI.DIFFICULTY,
      aiPlayerIds: AI.PLAYER_IDS,
    });

    this.cameras.main.setZoom(1);

    this.events.on('turn-changed', (pen) => {
      /*    this.cameras.main.flash(200, 255, 255, 255);

      this.cameras.main.zoomTo(1.08, 200);

      this.time.delayedCall(200, () => {
        this.cameras.main.zoomTo(1.0, 300);
      });

      this.cameras.main.startFollow(pen.container, true, 0.12, 0.12); */
      const index = this.penManager.getPens().indexOf(pen);

      this.turnText.setText(`PLAYER ${index + 1} TURN`);
    });

    this.events.on('chaos-started', () => {
      this.turnText.setText('FREE FOR ALL');

      this.turnIndicator.hide();
    });

    this.events.on('pen-eliminated', (pen) => {
      audioFX.playEliminate();
      eliminationPuff(this, pen.container.x, pen.container.y, pen.color);
    });

    this.events.on('game-over', (result) => {
      if (result.result === 'draw') {
        audioFX.playDraw();
      } else {
        audioFX.playWin();
      }
    });

    //------------------------------------------
    // Start Match
    // (must come after all 'turn-changed' / 'chaos-started' listeners
    // above, since start() emits them synchronously)
    //------------------------------------------

    this.gameRules.start();
  }

  addUIItems() {
    // Home button — top-left corner, same "← Home" pill NetGameScene
    // uses (see .hud-home-btn in index.html), so leaving a Classroom/
    // Vs Computer match works the same way as leaving an online one.
    this.homeButtonDom = this.add
      .dom(16, 10)
      .createFromHTML('<div class="hud-home-btn">← Home</div>')
      .setOrigin(0, 0);
    this.homeButtonDom.setDepth(1000);

    this.homeButtonDom.node.children[0].addEventListener('click', () => {
      this.scene.stop();
      returnHome();
    });

    // Bottom dock: turn text sits right above the turn-timer-bar +
    // match-badge row — see BottomDock.js for the full layout and why
    // it moved down here from the top of the screen. Routed through
    // createFromHTML()+node.children[0] (not a direct-element
    // add.dom(x,y,el)) so Phaser's per-frame inline style writes land
    // on the wrapper only, never on this element — see WinPopup.js's
    // file header for the full reasoning.
    const { turnText: turnTextLayout, turnBar } = bottomDockLayout(this);

    this.turnTextDom = this.add
      .dom(turnTextLayout.x, turnTextLayout.y)
      .createFromHTML('<div class="hud-text">PLAYER 1 TURN</div>')
      .setOrigin(0, 0);
    this.turnTextDom.setDepth(1000);

    const turnTextEl = this.turnTextDom.node.children[0];

    // Keep a .setText() shim so the rest of this file (and anything
    // else that touches it) doesn't need to know it's a DOM Element.
    this.turnText = { setText: (t) => { turnTextEl.textContent = t; } };

    this.turnTimer = new TurnTimer(this, turnBar.x, turnBar.y);
    this.matchTimer = new MatchTimer(this);

    // Player status row — top of screen, filling the space the turn
    // text/match badge used to occupy before they moved down to the
    // bottom dock. One dot per pen (colors match PenManager.createPens'
    // own PEN.COLORS[i % length] assignment, so no need to wait for
    // the actual Pen instances to exist yet).
    const statusRowWidth = 320;

    this.playerStatusRow = new PlayerStatusRow(
      this,
      GAME.WIDTH / 2 - statusRowWidth / 2,
      12,
      Array.from(
        { length: LOCAL_MATCH.PLAYER_COUNT },
        (_, i) => PEN.COLORS[i % PEN.COLORS.length],
      ),
    );

    this.events.on('turn-changed', (pen) => {
      this.playerStatusRow.setActive(this.penManager.getPens().indexOf(pen));
    });

    this.events.on('chaos-started', () => {
      // No single "current" pen in chaos — nothing to ring-highlight.
      this.playerStatusRow.clearActive();
    });

    this.events.on('pen-eliminated', (pen) => {
      this.playerStatusRow.setEliminated(this.penManager.getPens().indexOf(pen), true);
    });

    this.events.on('turn-changed', () => {
      if (this.gameRules.useTurnTimer) this.turnTimer.show();

      if (this.gameRules.useMatchTimer) this.matchTimer.show();
    });

    this.events.on('chaos-started', () => {
      // Chaos has no per-turn timer, only the whole-match countdown
      if (this.gameRules.useMatchTimer) this.matchTimer.show();
    });

    this.events.on('turn-timer', (timeLeft) => {
      this.turnTimer.setTime(timeLeft, this.gameRules.turnTimeLimit);
    });

    this.events.on('match-timer', (timeLeft) => {
      this.matchTimer.setTime(timeLeft);
    });

    this.events.on('game-over', (result) => {
      this.turnTimer.hide();
      this.matchTimer.hide();
      this.turnIndicator.hide();
      this.playerStatusRow.clearActive();
      this.inputController.cancel();

      this.winPopup.show(result);
    });

    this.turnIndicator = new TurnIndicator(this);
    this.events.on('turn-changed', (pen) => {
      this.turnIndicator.show(pen.playerId);
    });

    this.winPopup = new WinPopup(this);

    this.winPopup.onPlayAgain = () => {
      this.scene.restart();
    };

    this.winPopup.onMainMenu = () => {
      this.scene.stop();
      returnHome();
    };
  }

  //--------------------------------------------------
  // Draw Table
  //--------------------------------------------------

  createTable() {
    this.table = drawTable(this);
  }

  //--------------------------------------------------
  // Update
  //--------------------------------------------------

  update(time, delta) {
    this.delta = delta;

    //------------------------------------------
    // Physics
    //------------------------------------------

    this.physicsWorld.step();

    // ------------------------------------------
    // Game Rules
    //  ----------------------------------------
    this.gameRules.update();

    //------------------------------------------
    // Power-ups (no-op if disabled or the match is over)
    //------------------------------------------

    if (!this.gameRules.gameOver) this.powerUps.update(delta);

    //------------------------------------------
    // Computer opponent(s) (no-op unless AI.PLAYER_IDS is set)
    //------------------------------------------

    this.aiController.update(delta);

    //------------------------------------------
    // Pens
    //------------------------------------------

    this.penManager.update();

    //------------------------------------------
    // Input visuals
    //------------------------------------------

    this.inputController.update();

    //------------------------------------------
    // Debug overlay
    //------------------------------------------

    this.debugRenderer.update();
  }
}
