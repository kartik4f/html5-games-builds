//==================================================
// GameRules.js
//==================================================

import { TABLE } from './Constants.js';

export default class GameRules {
  constructor(scene, penManager) {
    this.scene = scene;
    this.penManager = penManager;

    //------------------------------------------
    // Match State
    //------------------------------------------

    this.gameStarted = false;
    this.gameOver = false;

    //------------------------------------------
    // Turn State
    //------------------------------------------

    this.currentTurnIndex = 0;

    this.turnActive = false;
    this.turnChanging = false;

    // Waiting for all physics to stop after shot
    this.waitingForPhysics = false;

    //------------------------------------------
    // Players
    //------------------------------------------

    this.alivePens = new Set(penManager.getPens());

    //------------------------------------------
    // Turn Timer
    //------------------------------------------

    this.turnTimeLimit = 5000;

    this.turnTimeLeft = 0;

    this.turnStartedAt = 0;

    //------------------------------------------

    this.turnChangeDelay = 500;
  }

  //--------------------------------------------------
  // Start Match
  //--------------------------------------------------

  start() {
    this.gameStarted = true;
    this.gameOver = false;

    this.alivePens = new Set(this.penManager.getPens());

    this.currentTurnIndex = 0;

    this.turnChanging = false;
    this.turnActive = false;
    this.waitingForPhysics = false;

    this.startTurn();
  }

  //--------------------------------------------------
  // Start Turn
  //--------------------------------------------------

  startTurn() {
    if (this.gameOver) return;

    const pen = this.getCurrentPen();

    if (!pen) return;

    this.turnActive = true;
    this.turnChanging = false;
    this.waitingForPhysics = false;

    //----------------------------------
    // Restart Timer
    //----------------------------------

    this.turnStartedAt = this.scene.time.now;

    this.turnTimeLeft = this.turnTimeLimit;

    //----------------------------------
    // Select Current Pen
    //----------------------------------

    this.setActivePen();

    //----------------------------------
    // UI Events
    //----------------------------------

    this.scene.events.emit('turn-changed', pen);

    this.scene.events.emit('turn-timer', this.turnTimeLeft);
  }

  //--------------------------------------------------
  // Current Pen
  //--------------------------------------------------

  getCurrentPen() {
    const pens = this.penManager.getPens();

    return pens[this.currentTurnIndex];
  }

  //--------------------------------------------------
  // Update
  //--------------------------------------------------

  update() {
    if (this.gameOver) return;

    this.updateTurnTimer();

    this.updatePhysicsWait();

    this.checkOutOfBounds();

    this.checkGameOver();
  }

  //--------------------------------------------------
  // Turn Timer
  //--------------------------------------------------

  updateTurnTimer() {
    if (!this.turnActive) return;

    if (this.turnChanging) return;

    this.turnTimeLeft =
      this.turnTimeLimit - (this.scene.time.now - this.turnStartedAt);

    if (this.turnTimeLeft < 0) this.turnTimeLeft = 0;

    this.scene.events.emit('turn-timer', this.turnTimeLeft);

    //----------------------------------
    // Timeout
    //----------------------------------

    if (this.turnTimeLeft <= 0) {
      this.scene.inputController.cancel();

      this.forceNextTurn();
    }
  }

  //--------------------------------------------------
  // Player Shot
  //--------------------------------------------------

  onPlayerAction() {
    if (this.gameOver) return;

    if (!this.turnActive) return;

    //----------------------------------
    // Stop timer
    //----------------------------------

    this.turnActive = false;

    //----------------------------------
    // Wait until physics settles
    //----------------------------------

    this.waitingForPhysics = true;

    //----------------------------------
    // Remove aim graphics
    //----------------------------------

    this.scene.inputController.cancel();
  }

  //--------------------------------------------------
  // Wait Until Physics Stops
  //--------------------------------------------------

  updatePhysicsWait() {
    if (!this.waitingForPhysics) return;

    if (this.penManager.areAnyMoving()) return;

    this.waitingForPhysics = false;

    this.forceNextTurn();
  }

  //--------------------------------------------------
  // Force Next Turn
  //--------------------------------------------------

  forceNextTurn() {
    if (this.gameOver) return;

    if (this.turnChanging) return;

    this.turnActive = false;
    this.waitingForPhysics = false;
    this.turnChanging = true;

    // Reset any active drag
    if (this.scene.inputController) {
      this.scene.inputController.cancel();
    }

    this.scene.time.delayedCall(this.turnChangeDelay, () => {
      if (this.gameOver) return;

      const pens = this.penManager.getPens();

      // Find next alive player
      do {
        this.currentTurnIndex = (this.currentTurnIndex + 1) % pens.length;
      } while (!this.alivePens.has(pens[this.currentTurnIndex]));

      this.startTurn();
    });
  }

  //--------------------------------------------------
  // Out Of Bounds
  //--------------------------------------------------

  checkOutOfBounds() {
    if (this.gameOver) return;

    for (const pen of this.penManager.getPens()) {
      if (!this.alivePens.has(pen)) continue;

      if (pen.isCompletelyOutside(TABLE)) {
        this.eliminate(pen);
      }
    }
  }

  //--------------------------------------------------
  // Eliminate Player
  //--------------------------------------------------

  eliminate(pen) {
    if (this.gameOver) return;

    if (!this.alivePens.has(pen)) return;

    //------------------------------------------
    // Remove player
    //------------------------------------------

    this.alivePens.delete(pen);

    pen.setSelected(false);

    //------------------------------------------
    // Disable physics immediately
    //------------------------------------------

    pen.body.setActive(false);

    //------------------------------------------
    // Visual removal
    //------------------------------------------

    if (pen.fadeOutAndDestroy) {
      pen.fadeOutAndDestroy();
    } else {
      pen.destroy();
    }

    //------------------------------------------
    // Current player eliminated
    //------------------------------------------

    if (pen === this.getCurrentPen()) {
      if (this.scene.inputController) {
        this.scene.inputController.cancel();
      }
    }

    //------------------------------------------
    // Win / Draw
    //------------------------------------------

    this.checkGameOver();

    //------------------------------------------
    // Continue only if game still running
    //------------------------------------------

    if (!this.gameOver && pen === this.getCurrentPen()) {
      this.forceNextTurn();
    }
  }

  //--------------------------------------------------
  // Win / Draw
  //--------------------------------------------------

  checkGameOver() {
    if (this.gameOver) return;

    const alive = this.alivePens.size;

    //------------------------------------------
    // Continue game
    //------------------------------------------

    if (alive > 1) return;

    //------------------------------------------
    // Game finished
    //------------------------------------------

    this.gameOver = true;

    this.turnActive = false;
    this.turnChanging = false;
    this.waitingForPhysics = false;

    this.turnTimeLeft = 0;

    //------------------------------------------
    // Reset drag graphics
    //------------------------------------------

    if (this.scene.inputController) {
      this.scene.inputController.cancel();
    }

    //------------------------------------------
    // Hide timer
    //------------------------------------------

    this.scene.events.emit('turn-timer', 0);

    //------------------------------------------
    // DRAW
    //------------------------------------------

    if (alive === 0) {
      this.scene.events.emit('game-over', {
        result: 'draw',
      });

      return;
    }

    //------------------------------------------
    // WINNER
    //------------------------------------------

    const winner = [...this.alivePens][0];

    this.scene.events.emit('game-over', {
      result: 'win',
      winner,
    });
  }

  //--------------------------------------------------
  // Highlight Active Pen
  //--------------------------------------------------

  setActivePen() {
    const pen = this.getCurrentPen();

    if (!pen) return;

    this.penManager.selectPen(pen);
  }

  //--------------------------------------------------
  // Can Player Interact?
  //--------------------------------------------------

  canPlayerInteract() {
    if (this.gameOver) return false;

    if (!this.turnActive) return false;

    if (this.turnChanging) return false;

    if (this.waitingForPhysics) return false;

    const pen = this.getCurrentPen();

    if (!pen) return false;

    if (!this.alivePens.has(pen)) return false;

    if (pen.isMoving()) return false;

    return true;
  }
}
