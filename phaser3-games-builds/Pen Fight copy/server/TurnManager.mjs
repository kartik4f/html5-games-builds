//==================================================
// TurnManager.mjs  (server-side)
//==================================================
// The minimal turn manager inifo.txt asked for before multiplayer:
// "Whose turn is it? Can the local player shoot? Are all pens
// stationary?" Elimination and win/draw live in GameRoom.mjs, which
// is the thing that actually knows which pens are still alive — this
// class only ever deals in turn order, consulting an isAlive(index)
// callback so 3-4 player rooms skip eliminated players correctly
// instead of handing them a turn.
//
// Turn timer / settle-wait *durations* (and the settle thresholds)
// come from the client's GameConfig.js MATCH, same as single-player.
// Whether those features are even on, though, is per-room — a custom
// room's "Turn Timer" / "Wait For Settle" toggles — so those two
// booleans are passed in rather than read off the shared MATCH.
//==================================================

import { MATCH } from '../js/GameConfig.js';

const REST_LINEAR_PX2_SETTLE = MATCH.SETTLE_LINEAR_THRESHOLD * 2500; // *SCALE^2, SCALE=50
const REST_ANGULAR_SETTLE = MATCH.SETTLE_ANGULAR_THRESHOLD;

export default class TurnManager {
  constructor(playerCount, options, onTurnChanged, isAlive) {
    this.playerCount = playerCount;

    this.useTurnTimer = options?.useTurnTimer ?? MATCH.USE_TURN_TIMER;
    this.waitForSettle = options?.waitForSettle ?? MATCH.WAIT_FOR_SETTLE;

    this.currentIndex = 0;
    this.turnActive = false;
    this.waitingForSettle = false;
    this.waitingSince = 0;

    this.turnStartedAt = 0;
    this.turnTimeLeft = -1;

    this.started = false;

    this.onTurnChanged = onTurnChanged || (() => {});
    this.isAlive = isAlive || (() => true);
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
    this.turnTimeLeft = this.useTurnTimer ? MATCH.TURN_TIME : -1;

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

    if (this.waitForSettle) {
      this.waitingForSettle = true;
      this.waitingSince = Date.now();
    } else {
      this._advance();
    }
  }

  _advance() {
    this.waitingForSettle = false;

    // Step forward until we land on a player still in the match. The
    // guard just prevents an infinite loop if this were ever called
    // with nobody alive — GameRoom always ends the match before that
    // can happen.
    for (let i = 0; i < this.playerCount; i++) {
      this.currentIndex = (this.currentIndex + 1) % this.playerCount;

      if (this.isAlive(this.currentIndex)) break;
    }

    this._beginTurn();
  }

  // Back to a fresh match (same connections, new game).
  reset() {
    this.started = false;
    this.currentIndex = 0;
    this.turnActive = false;
    this.waitingForSettle = false;
    this.turnTimeLeft = -1;
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

    if (this.turnActive && this.useTurnTimer) {
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
