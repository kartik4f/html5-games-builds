//==================================================
// TurnManager.js  (server-side)
//==================================================
// The minimal turn manager inifo.txt asked for before multiplayer:
// "Whose turn is it? Can the local player shoot? Are all pens
// stationary?" No scoring, no elimination, no win/draw yet — that's
// deliberately out of scope for this pass (see inifo.txt Phase 2).
//
// Reuses MATCH from the client's GameConfig.js so turn timer / settle
// behavior matches the single-player game's tuning.
//==================================================

import { MATCH } from '../js/GameConfig.js';

const REST_LINEAR_PX2_SETTLE = MATCH.SETTLE_LINEAR_THRESHOLD * 2500; // *SCALE^2, SCALE=50
const REST_ANGULAR_SETTLE = MATCH.SETTLE_ANGULAR_THRESHOLD;

export default class TurnManager {
  constructor(playerCount, onTurnChanged) {
    this.playerCount = playerCount;

    this.currentIndex = 0;
    this.turnActive = false;
    this.waitingForSettle = false;
    this.waitingSince = 0;

    this.turnStartedAt = 0;
    this.turnTimeLeft = -1;

    this.started = false;

    this.onTurnChanged = onTurnChanged || (() => {});
  }

  start() {
    this.started = true;
    this.currentIndex = 0;
    this._beginTurn();
  }

  _beginTurn() {
    this.turnActive = true;
    this.waitingForSettle = false;
    this.turnStartedAt = Date.now();
    this.turnTimeLeft = MATCH.USE_TURN_TIMER ? MATCH.TURN_TIME : -1;

    this.onTurnChanged(this.currentIndex);
  }

  canPlayerAct(playerId) {
    return (
      this.started &&
      this.turnActive &&
      !this.waitingForSettle &&
      playerId === this.currentIndex
    );
  }

  // Called right after a valid shot has been applied to the physics sim.
  onShot() {
    this.turnActive = false;

    if (MATCH.WAIT_FOR_SETTLE) {
      this.waitingForSettle = true;
      this.waitingSince = Date.now();
    } else {
      this._advance();
    }
  }

  _advance() {
    this.waitingForSettle = false;
    this.currentIndex = (this.currentIndex + 1) % this.playerCount;

    this._beginTurn();
  }

  // Call every physics tick with the current PenBody array.
  update(pens) {
    if (!this.started) return;

    if (this.waitingForSettle) {
      const settled = pens.every((p) =>
        p.isSettled(REST_LINEAR_PX2_SETTLE, REST_ANGULAR_SETTLE),
      );

      const timedOut = Date.now() - this.waitingSince >= MATCH.SETTLE_MAX_WAIT;

      if (settled || timedOut) {
        if (timedOut) pens.forEach((p) => p.stop());

        this._advance();
      }

      return;
    }

    if (this.turnActive && MATCH.USE_TURN_TIMER) {
      this.turnTimeLeft = MATCH.TURN_TIME - (Date.now() - this.turnStartedAt);

      if (this.turnTimeLeft <= 0) {
        this.turnTimeLeft = 0;
        this._advance(); // timeout forces the turn to pass
      }
    }
  }

  snapshot() {
    return {
      currentIndex: this.currentIndex,
      turnActive: this.turnActive,
      waitingForSettle: this.waitingForSettle,
      turnTimeLeft: this.turnTimeLeft,
      started: this.started,
    };
  }
}
