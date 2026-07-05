//==================================================
// GameScene.js
//==================================================

import Physics from './Physics.js';
import PenManager from './PenManager.js';
import InputController from './InputController.js';
import DebugRenderer from './DebugRenderer.js';
import GameRules from './GameRules.js';

import TurnTimer from './ui/TurnTimer.js';
import TurnIndicator from './ui/TurnIndicator.js';
import WinPopup from './ui/WinPopup.js';

import { GAME, TABLE, INPUT } from './Constants.js';

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

    this.penManager.createDefaultPens();

    // ------------------------------------------
    // Game Rules
    // -----------------------------------------
    this.gameRules = new GameRules(this, this.penManager);

    this.gameRules.start();

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
  }

  addUIItems() {
    this.turnText = this.add.text(GAME.WIDTH / 2, 40, 'PLAYER 1 TURN', {
      fontSize: '28px',
      color: '#ffffff',
    });

    this.turnText.setOrigin(0.5);
    this.turnText.setScrollFactor(0);

    this.turnTimer = new TurnTimer(this);

    this.events.on('turn-changed', () => {
      this.turnTimer.show();
    });

    this.events.on('turn-timer', (timeLeft) => {
      this.turnTimer.setTime(timeLeft);
    });
    this.events.on('game-over', (result) => {
      this.turnTimer.hide();
      this.turnIndicator.hide();
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
      this.scene.restart(); // Replace with MainMenu later
    };
  }

  //--------------------------------------------------
  // Draw Table
  //--------------------------------------------------

  createTable() {
    const g = this.add.graphics();

    g.fillStyle(TABLE.COLOR);

    g.fillRoundedRect(
      TABLE.X,
      TABLE.Y,

      TABLE.WIDTH,
      TABLE.HEIGHT,

      TABLE.CORNER_RADIUS,
    );

    g.lineStyle(
      TABLE.BORDER,

      TABLE.BORDER_COLOR,
    );

    g.strokeRoundedRect(
      TABLE.X,
      TABLE.Y,

      TABLE.WIDTH,
      TABLE.HEIGHT,

      TABLE.CORNER_RADIUS,
    );

    g.setDepth(-100);

    this.table = g;
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
