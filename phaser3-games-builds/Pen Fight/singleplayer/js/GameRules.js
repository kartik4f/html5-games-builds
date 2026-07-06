//==================================================
// GameRules.js
//==================================================

import { TABLE } from './Constants.js';
import { MATCH, GAME_MODE } from './GameConfig.js';

export default class GameRules {
  constructor(scene, penManager) {
    this.scene = scene;
    this.penManager = penManager;

    this.mode = MATCH.MODE;

    //------------------------------------------
    // Match State
    //------------------------------------------

    this.gameStarted = false;
    this.gameOver = false;

    //------------------------------------------
    // Turn State (turn-based mode only)
    //------------------------------------------

    this.currentTurnIndex = 0;

    this.turnActive = false;
    this.turnChanging = false;

    this.waitForSettle = MATCH.WAIT_FOR_SETTLE;
    this.settleLinearThreshold = MATCH.SETTLE_LINEAR_THRESHOLD;
    this.settleAngularThreshold = MATCH.SETTLE_ANGULAR_THRESHOLD;
    this.settleMaxWait = MATCH.SETTLE_MAX_WAIT;

    this.waitingForSettle = false;
    this.waitingForSettleStartedAt = 0;

    //------------------------------------------
    // Players
    //------------------------------------------

    this.alivePens = new Set(penManager.getPens());

    //------------------------------------------
    // Turn Timer (turn-based mode only, resets every turn)
    //------------------------------------------

    this.useTurnTimer = MATCH.USE_TURN_TIMER;

    this.turnTimeLimit = MATCH.TURN_TIME;

    this.turnTimeLeft = 0;

    // null = "not yet baselined" — captured lazily on the first real
    // update() tick instead of here, since a freshly-started Scene's
    // clock hasn't synced to the actual elapsed game time yet at
    // create()-time (it still reads 0), which would otherwise make
    // the timer think a turn/match had already been running for
    // however long the player spent on the previous scene (e.g. the
    // menu) the instant this scene appears.
    this.turnStartedAt = null;

    //------------------------------------------
    // Match Timer (whole match, runs once from start to finish)
    // Chaos: always on. Turn-based: optional via useMatchTimeLimit.
    //------------------------------------------

    this.chaosMatchTime = MATCH.CHAOS_MATCH_TIME;

    this.useMatchTimeLimit = MATCH.USE_MATCH_TIME_LIMIT;
    this.matchTimeLimit = MATCH.MATCH_TIME_LIMIT;

    this.matchTimeLeft = 0;

    // See turnStartedAt above — same lazy-baseline reasoning.
    this.matchStartedAt = null;

    //------------------------------------------

    this.turnChangeDelay = MATCH.TURN_CHANGE_DELAY;
  }

  //--------------------------------------------------
  // Mode
  //--------------------------------------------------

  get isChaos() {
    return this.mode === GAME_MODE.CHAOS;
  }

  // Whether the whole-match countdown is active in the current mode
  get useMatchTimer() {
    return this.isChaos || this.useMatchTimeLimit;
  }

  // Whole-match countdown duration for the current mode
  get matchDuration() {
    return this.isChaos ? this.chaosMatchTime : this.matchTimeLimit;
  }

  //--------------------------------------------------
  // Start Match
  //--------------------------------------------------

  start() {
    this.gameStarted = true;
    this.gameOver = false;

    this.alivePens = new Set(this.penManager.getPens());

    //----------------------------------
    // Match Timer
    //----------------------------------

    this.matchStartedAt = null;

    this.matchTimeLeft = this.useMatchTimer ? this.matchDuration : -1;

    this.scene.events.emit('match-timer', this.matchTimeLeft);

    if (this.isChaos) {
      this.startChaos();
      return;
    }

    this.currentTurnIndex = 0;

    this.turnChanging = false;
    this.turnActive = false;
    this.waitingForSettle = false;

    this.startTurn();
  }

  //--------------------------------------------------
  // Start Chaos Match
  //--------------------------------------------------

  startChaos() {
    this.turnActive = true;

    this.scene.events.emit('chaos-started');
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
    this.waitingForSettle = false;

    //----------------------------------
    // Restart Timer
    //----------------------------------

    this.turnStartedAt = null;

    this.turnTimeLeft = this.useTurnTimer ? this.turnTimeLimit : -1;

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

    this.updateMatchTimer();

    if (!this.isChaos) {
      this.updateSettleWait();
    }

    this.checkOutOfBounds();

    this.checkGameOver();
  }

  //--------------------------------------------------
  // Turn Timer (turn-based mode only)
  //--------------------------------------------------

  updateTurnTimer() {
    if (this.isChaos) return;

    if (!this.useTurnTimer || this.gameOver || !this.turnActive) return;

    if (this.turnChanging) return;

    if (this.turnStartedAt === null) {
      this.turnStartedAt = this.scene.time.now;
    }

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
  // Match Timer (whole match — chaos always, turn-based optional)
  //--------------------------------------------------

  updateMatchTimer() {
    if (!this.useMatchTimer || this.gameOver) return;

    if (this.matchStartedAt === null) {
      this.matchStartedAt = this.scene.time.now;
    }

    this.matchTimeLeft =
      this.matchDuration - (this.scene.time.now - this.matchStartedAt);

    if (this.matchTimeLeft < 0) this.matchTimeLeft = 0;

    this.scene.events.emit('match-timer', this.matchTimeLeft);

    if (this.matchTimeLeft <= 0) {
      this.endMatchOnTimeout();
    }
  }

  //--------------------------------------------------
  // End Match (whole-match timer ran out)
  //--------------------------------------------------

  endMatchOnTimeout() {
    if (this.gameOver) return;

    this.gameOver = true;
    this.turnActive = false;
    this.turnChanging = false;
    this.waitingForSettle = false;

    if (this.scene.inputController) {
      this.scene.inputController.cancel();
    }

    // Freeze every pen in place — the match is over, nothing should
    // keep sliding/spinning under the game-over popup.
    this.penManager.stopAll();

    this.scene.events.emit('turn-timer', 0);
    this.scene.events.emit('match-timer', 0);

    const alive = [...this.alivePens];

    if (alive.length === 1) {
      this.scene.events.emit('game-over', {
        result: 'win',
        winner: alive[0],
      });
    } else {
      this.scene.events.emit('game-over', { result: 'draw' });
    }
  }

  //--------------------------------------------------
  // Player Shot
  //--------------------------------------------------

  onPlayerAction(pen) {
    if (this.gameOver) return;

    if (this.isChaos) {
      // No turn to hand off — physics just keeps running.
      return;
    }

    if (!this.turnActive) return;

    if (!this.waitForSettle) {
      this.forceNextTurn();

      return;
    }

    //----------------------------------
    // Stop timer, wait until physics settles
    //----------------------------------

    this.turnActive = false;

    this.waitingForSettle = true;

    this.waitingForSettleStartedAt = this.scene.time.now;

    this.scene.inputController.cancel();
  }

  //--------------------------------------------------
  // Wait For Settle (turn-based, optional)
  //--------------------------------------------------

  updateSettleWait() {
    if (!this.waitingForSettle) return;

    const settled = this.penManager.areAllSettled(
      this.settleLinearThreshold,
      this.settleAngularThreshold,
    );

    const elapsed = this.scene.time.now - this.waitingForSettleStartedAt;

    const timedOut = elapsed >= this.settleMaxWait;

    if (!settled && !timedOut) return;

    if (timedOut) {
      // Snap any still-drifting pens to rest so the next player isn't
      // blocked by leftover jitter once their turn starts.
      this.penManager.stopAll();
    }

    this.waitingForSettle = false;

    this.forceNextTurn();
  }

  //--------------------------------------------------
  // Force Next Turn
  //--------------------------------------------------

  forceNextTurn() {
    if (this.gameOver) return;

    if (this.turnChanging) return;

    this.turnActive = false;
    this.waitingForSettle = false;
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
    // Cancel any drag in progress on this pen
    //------------------------------------------

    if (this.scene.inputController) {
      this.scene.inputController.cancelPen(pen);
    }

    //------------------------------------------
    // Win / Draw
    //------------------------------------------

    this.checkGameOver();

    //------------------------------------------
    // Turn-based: continue only if the current player was eliminated
    //------------------------------------------

    if (!this.isChaos && !this.gameOver && pen === this.getCurrentPen()) {
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
    this.waitingForSettle = false;

    this.turnTimeLeft = 0;
    this.matchTimeLeft = 0;

    //------------------------------------------
    // Reset drag graphics
    //------------------------------------------

    if (this.scene.inputController) {
      this.scene.inputController.cancel();
    }

    // Freeze every pen in place — the match is over, nothing should
    // keep sliding/spinning under the game-over popup.
    this.penManager.stopAll();

    //------------------------------------------
    // Hide timers
    //------------------------------------------

    this.scene.events.emit('turn-timer', 0);
    this.scene.events.emit('match-timer', 0);

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
  // Turn-based: pass no pen to check "is it anyone's turn right now",
  // or pass a specific pen to check "is it this pen's turn".
  // Chaos: always checks a specific pen — anyone can act, anytime.
  //--------------------------------------------------

  canPlayerInteract(pen) {
    if (this.gameOver) return false;

    if (this.isChaos) {
      if (!pen) return false;

      return this.alivePens.has(pen);
    }

    if (!this.turnActive) return false;

    if (this.turnChanging) return false;

    if (this.waitingForSettle) return false;

    const currentPen = this.getCurrentPen();

    if (!currentPen) return false;

    if (pen && pen !== currentPen) return false;

    if (!this.alivePens.has(currentPen)) return false;

    return true;
  }
}
