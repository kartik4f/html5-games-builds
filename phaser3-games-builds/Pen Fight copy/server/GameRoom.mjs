//==================================================
// GameRoom.mjs  (server-side)
//==================================================
// One authoritative match between 2-4 players, replacing the old
// fixed-2-player Room.mjs. A room moves through four states:
//
//   LOBBY     players join, drag their pen to a non-overlapping
//             starting spot on the table (acting as the lobby)
//   COUNTDOWN once every seat is filled, a short grace pause then a
//             3-2-1 countdown, automatically — no "ready" button
//   PLAYING   real pen-fight rules: no walls, last pen on the table
//             wins (see PhysicsEngine.mjs / _checkEliminations)
//   ENDED     game-over broadcast; "Play Again" sends everyone back
//             to LOBBY (not an instant restart) so positions can be
//             chosen again
//
// Connected clients only ever send a drag/position/restart intent and
// receive state snapshots — same server-authoritative shape as
// before, just generalized past a hardcoded 2 players.
//==================================================

import { PEN, TABLE } from '../js/Constants.js';
import { MATCH, POWERUPS } from '../js/GameConfig.js';
import {
  PenBody,
  computeShotVelocity,
  step,
  defaultLayout,
  capsulesOverlap,
} from './PhysicsEngine.mjs';
import TurnManager from './TurnManager.mjs';

const TICK_HZ = 60;
const TICK_MS = 1000 / TICK_HZ;

// Pause between "room is full" and the countdown actually starting —
// gives everyone a beat to see the table before it locks in. Applies
// equally the first time the room fills and after every restart.
const LOBBY_GRACE_MS = 1500;

const COUNTDOWN_FROM = 3;

// Keep pens comfortably inside the table edge while placing them —
// this is a lobby-only concept; there's no such margin once playing.
const PLACEMENT_MARGIN = 24;

export const ROOM_STATE = {
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
  ENDED: 'ended',
};

export default class GameRoom {
  constructor(code, config, onEmpty) {
    this.code = code;
    this.onEmpty = onEmpty || null;

    this.maxPlayers = config.maxPlayers;

    this.config = {
      useTurnTimer: config.useTurnTimer ?? MATCH.USE_TURN_TIMER,
      waitForSettle: config.waitForSettle ?? MATCH.WAIT_FOR_SETTLE,
      useMatchTimeLimit: config.useMatchTimeLimit ?? MATCH.USE_MATCH_TIME_LIMIT,
      // Multiplayer-only concept — off unless the host explicitly
      // turns it on when creating the room.
      usePowerUps: !!config.usePowerUps,
      // No turn order at all — every alive player can shoot their own
      // pen anytime. Mirrors single-player chaos mode: always runs on
      // its own fixed whole-match countdown (see _usesMatchTimer /
      // _matchDurationMs below), ignoring useTurnTimer/waitForSettle/
      // useMatchTimeLimit entirely, same as the local Classroom/Vs
      // Computer setup screens do (see js/main.js).
      chaosMode: !!config.chaosMode,
      // Best-of-3 series — first to 2 match wins takes the series.
      // Series score (this.seriesWins) persists across restarts
      // within the room until someone wins the series.
      bestOf3: !!config.bestOf3,
    };

    // Best-of-3 series score, index = playerId. Persists across
    // restarts (see _onRestart) until the series is won.
    this.seriesWins = new Array(this.maxPlayers).fill(0);

    this.isPublic = !!config.isPublic;

    this.slots = new Array(this.maxPlayers).fill(null); // WSConnection | null
    this.spectators = new Set();

    this.state = ROOM_STATE.LOBBY;

    // Lobby positions — always populated (defaults, or wherever a
    // player has dragged their pen to), index = playerId.
    this.positions = defaultLayout(this.maxPlayers, TABLE);

    this.pens = []; // PenBody[], only exists once PLAYING/ENDED
    this.turns = null;

    this.alive = new Array(this.maxPlayers).fill(true);
    this.gameOver = false;
    this.winner = null;
    this.result = null;

    this.matchStartedAt = null;
    this.matchTimeLeft = -1;

    // Power-ups (optional, see this.config.usePowerUps) — one active
    // pickup/hazard at a time, plus a per-player "next shot" boost
    // multiplier consumed by _onShoot.
    this.powerUp = null; // { id, kind: 'speed'|'ink'|'helicopter', x, y, radius, ageMs }
    this.powerUpSpawnMs = POWERUPS.SPAWN_INTERVAL;
    this.nextShotBoost = new Array(this.maxPlayers).fill(1);
    // Helicopter Shot — charged (true) until that player's next shot,
    // same one-shot-then-reset lifecycle as nextShotBoost above.
    this.nextShotHelicopter = new Array(this.maxPlayers).fill(false);
    this._powerUpIdSeq = 0;

    // Post-match stats — reset every match in _startMatch(), read out
    // in _endMatch() for the 'game-over' broadcast.
    this.shotsThisMatch = new Array(this.maxPlayers).fill(0);
    this.matchStartedAtStats = null; // wall-clock match start, independent of the optional match timer
    this.firstEliminationAt = null;

    this.fullTimer = null;
    this.countdownTimer = null;

    this._loop = setInterval(() => this._tick(), TICK_MS);
  }

  //--------------------------------------------------
  // Connections
  //--------------------------------------------------

  hasOpenSlot() {
    return this.state === ROOM_STATE.LOBBY && this.slots.includes(null);
  }

  join(conn) {
    if (!this.hasOpenSlot()) {
      this.spectators.add(conn);
      conn.playerId = null;

      this._sendJoined(conn, null);
      this._sendCurrentStateTo(conn);

      return;
    }

    const slot = this.slots.indexOf(null);

    this.slots[slot] = conn;
    conn.playerId = slot;

    this._sendJoined(conn, slot);
    this._broadcastLobby();
    this._checkRoomFull();
  }

  handleDisconnect(conn) {
    if (conn.playerId !== null && conn.playerId !== undefined && this.slots[conn.playerId] === conn) {
      this.slots[conn.playerId] = null;

      if (this.state === ROOM_STATE.LOBBY) {
        this._cancelFullTimer();
        this._broadcastLobby();
      } else if (this.state === ROOM_STATE.COUNTDOWN) {
        this._cancelCountdown();
        this.state = ROOM_STATE.LOBBY;
        this._broadcastLobby();
      }
      // PLAYING/ENDED: the per-tick 'state' broadcast already reflects
      // the updated `connected` array within one tick, no need to poke.
    } else {
      this.spectators.delete(conn);
    }

    if (this.isEmpty() && this.onEmpty) this.onEmpty(this.code);
  }

  isEmpty() {
    return this.slots.every((s) => s === null) && this.spectators.size === 0;
  }

  //--------------------------------------------------
  // Messages
  //--------------------------------------------------

  handleMessage(conn, msg) {
    if (msg.type === 'set-position') {
      this._onSetPosition(conn, msg);
    } else if (msg.type === 'shoot') {
      this._onShoot(conn.playerId, msg);
    } else if (msg.type === 'restart') {
      this._onRestart();
    }
  }

  _onSetPosition(conn, msg) {
    if (this.state !== ROOM_STATE.LOBBY) return;

    const playerId = conn.playerId;

    if (playerId === null || playerId === undefined) return; // spectators can't place a pen

    const { x, y } = msg;

    if (typeof x !== 'number' || typeof y !== 'number') return;

    if (this._isValidPlacement(playerId, x, y)) {
      this.positions[playerId] = { x, y };
    }

    // Broadcast either way — if the move was rejected, this re-sends
    // the unchanged authoritative position so the requester's pen
    // snaps back instead of staying wherever their optimistic local
    // drag preview left it.
    this._broadcastLobby();
  }

  _isValidPlacement(playerId, x, y) {
    const candidate = new PenBody(playerId, x, y);

    if (!candidate.isFullyInside(TABLE, PLACEMENT_MARGIN)) return false;

    for (let i = 0; i < this.maxPlayers; i++) {
      if (i === playerId || this.slots[i] === null) continue;

      const other = new PenBody(i, this.positions[i].x, this.positions[i].y);

      if (capsulesOverlap(candidate, other)) return false;
    }

    return true;
  }

  _onShoot(playerId, msg) {
    if (this.state !== ROOM_STATE.PLAYING) return;
    if (playerId === null || playerId === undefined) return; // spectators

    if (this.config.chaosMode) {
      // No turn order — only "are you still alive" gates a shot.
      if (!this.alive[playerId]) return;
    } else if (!this.turns.canPlayerAct(playerId)) {
      return;
    }

    const { touchX, touchY, releaseX, releaseY } = msg;

    if (
      typeof touchX !== 'number' ||
      typeof touchY !== 'number' ||
      typeof releaseX !== 'number' ||
      typeof releaseY !== 'number'
    ) {
      return;
    }

    const pen = this.pens[playerId];

    // Drag convention matches the client: dx/dy = start - current.
    const dx = touchX - releaseX;
    const dy = touchY - releaseY;

    const shot = computeShotVelocity(dx, dy);

    if (!shot) return; // drag too short, ignored (same as client)

    const cos = Math.cos(pen.angle);
    const sin = Math.sin(pen.angle);

    const wx = touchX - pen.x;
    const wy = touchY - pen.y;

    const localX = wx * cos + wy * sin;
    const localY = -wx * sin + wy * cos;

    // A Speed Boost pickup multiplies exactly one shot, then resets.
    const boost = this.nextShotBoost[playerId] || 1;

    this.nextShotBoost[playerId] = 1;

    pen.applyImpulseAtLocalPoint(shot.dvx * boost, shot.dvy * boost, localX, localY);

    // A Helicopter Shot pickup charges exactly one shot, then resets —
    // activated right after the impulse so the extra spin/bounce
    // window starts from this shot, same as the client (see
    // InputController.fire() / AIController._takeShot()).
    if (this.nextShotHelicopter[playerId]) {
      this.nextShotHelicopter[playerId] = false;
      pen.activateHelicopter();
    }

    this.shotsThisMatch[playerId] += 1;

    // Chaos: no turn to hand off, physics just keeps running.
    if (this.turns) this.turns.onShot();
  }

  // Only meaningful once a match has actually ended. Sends everyone
  // back to the lobby rather than instantly re-playing — positions
  // can be chosen again, same as the first time the room filled up.
  _onRestart() {
    if (this.state !== ROOM_STATE.ENDED) return;

    // A best-of-3 series that's already been won starts fresh; one
    // still in progress carries its score into the next match.
    if (this.config.bestOf3 && this._seriesWinner() !== -1) {
      this.seriesWins = new Array(this.maxPlayers).fill(0);
    }

    this.positions = defaultLayout(this.maxPlayers, TABLE);
    this.alive = new Array(this.maxPlayers).fill(true);
    this.gameOver = false;
    this.winner = null;
    this.result = null;
    this.pens = [];
    this.turns = null;
    this.matchStartedAt = null;
    this.matchTimeLeft = -1;

    this.powerUp = null;
    this.powerUpSpawnMs = POWERUPS.SPAWN_INTERVAL;
    this.nextShotBoost = new Array(this.maxPlayers).fill(1);
    this.nextShotHelicopter = new Array(this.maxPlayers).fill(false);

    this.shotsThisMatch = new Array(this.maxPlayers).fill(0);
    this.matchStartedAtStats = null;
    this.firstEliminationAt = null;

    this.state = ROOM_STATE.LOBBY;

    this._broadcastLobby();
    this._checkRoomFull();
  }

  _seriesWinner() {
    if (!this.config.bestOf3) return -1;

    return this.seriesWins.findIndex((w) => w >= 2);
  }

  //--------------------------------------------------
  // Lobby -> Countdown -> Playing
  //--------------------------------------------------

  _checkRoomFull() {
    if (this.state !== ROOM_STATE.LOBBY) return;

    const full = this.slots.every((s) => s !== null);

    if (full && !this.fullTimer) {
      this.fullTimer = setTimeout(() => {
        this.fullTimer = null;
        this._beginCountdown();
      }, LOBBY_GRACE_MS);
    } else if (!full && this.fullTimer) {
      this._cancelFullTimer();
    }
  }

  _beginCountdown() {
    // Someone could have left during the grace pause.
    if (!this.slots.every((s) => s !== null)) return;

    this.state = ROOM_STATE.COUNTDOWN;

    let value = COUNTDOWN_FROM;

    const tick = () => {
      if (value <= 0) {
        this.countdownTimer = null;
        this._startMatch();
        return;
      }

      this._broadcast({ type: 'countdown', value });
      value -= 1;
      this.countdownTimer = setTimeout(tick, 1000);
    };

    tick();
  }

  _startMatch() {
    this.pens = this.positions.map((p, i) => new PenBody(i, p.x, p.y));
    this.alive = new Array(this.maxPlayers).fill(true);
    this.gameOver = false;
    this.winner = null;
    this.result = null;

    this.powerUp = null;
    this.powerUpSpawnMs = POWERUPS.SPAWN_INTERVAL;
    this.nextShotBoost = new Array(this.maxPlayers).fill(1);
    this.nextShotHelicopter = new Array(this.maxPlayers).fill(false);

    this.shotsThisMatch = new Array(this.maxPlayers).fill(0);
    this.matchStartedAtStats = Date.now();
    this.firstEliminationAt = null;

    // Chaos: no turn order at all, so no TurnManager — everyone can
    // shoot their own pen anytime (see _onShoot).
    this.turns = this.config.chaosMode
      ? null
      : new TurnManager(
          this.maxPlayers,
          { useTurnTimer: this.config.useTurnTimer, waitForSettle: this.config.waitForSettle },
          (currentIndex) => this._broadcast({ type: 'turn-changed', currentIndex }),
          (i) => this.alive[i],
        );

    this.state = ROOM_STATE.PLAYING;

    const usesMatchTimer = this._usesMatchTimer();

    this.matchStartedAt = usesMatchTimer ? Date.now() : null;
    this.matchTimeLeft = usesMatchTimer ? this._matchDurationMs() : -1;

    // Sent before turns.start() so clients have switched into
    // "playing" mode by the time the first 'turn-changed' arrives.
    this._broadcast({
      type: 'match-start',
      pens: this.pens.map((p) => p.snapshot()),
    });

    if (this.turns) this.turns.start();
  }

  // Turn-based rooms use their own useMatchTimeLimit toggle. Chaos
  // rooms always run on a fixed whole-match countdown instead — same
  // as single-player, and regardless of that toggle.
  _usesMatchTimer() {
    return this.config.chaosMode || this.config.useMatchTimeLimit;
  }

  _matchDurationMs() {
    return this.config.chaosMode ? MATCH.CHAOS_MATCH_TIME : MATCH.MATCH_TIME_LIMIT;
  }

  //--------------------------------------------------
  // Playing
  //--------------------------------------------------

  _tick() {
    if (this.state !== ROOM_STATE.PLAYING) return;

    const allConnected = this.slots.every((s) => s !== null);
    let collisions = [];

    if (allConnected && !this.gameOver) {
      collisions = step(this.pens, 1 / TICK_HZ);

      if (this.turns) this.turns.update(this.pens);

      this._checkEliminations();

      if (!this.gameOver) this._checkMatchTimeout();

      if (!this.gameOver) this._updatePowerUps();
    }

    this._broadcast({
      type: 'state',
      pens: this.pens.map((p) => p.snapshot()),
      // Chaos rooms have no TurnManager — null tells the client
      // there's no turn order to render.
      turn: this.turns ? this.turns.snapshot() : null,
      connected: this.slots.map((s) => s !== null),
      alive: this.alive,
      gameOver: this.gameOver,
      matchTimeLeft: this.matchTimeLeft,
      // Pen-on-pen impacts this tick (usually empty) — client uses
      // these purely for juice (sound/particles), same shape as
      // PhysicsEngine.mjs's resolvePenCollision return value.
      collisions,
      powerUp: this._powerUpSnapshot(),
      // Per-player Speed Boost state (1 = none) — lets the client show
      // a persistent "charged" glow on a boosted pen until that shot
      // is actually taken, not just a one-off pickup effect.
      nextShotBoost: this.nextShotBoost,
      // Same idea for a charged (not-yet-taken) Helicopter Shot — each
      // pen's snapshot() separately reports whether it's *currently
      // spinning* (helicopterActive), covering both the before and
      // after of that shot.
      nextShotHelicopter: this.nextShotHelicopter,
    });
  }

  //--------------------------------------------------
  // Power-ups (optional — see this.config.usePowerUps)
  //--------------------------------------------------

  _updatePowerUps() {
    if (!this.config.usePowerUps) return;

    if (this.powerUp) {
      this._tickActivePowerUp();
      return;
    }

    this.powerUpSpawnMs -= TICK_MS;

    if (this.powerUpSpawnMs <= 0) {
      this._trySpawnPowerUp();
      this.powerUpSpawnMs = POWERUPS.SPAWN_INTERVAL;
    }
  }

  _trySpawnPowerUp(attempts = 20) {
    const margin = 70;

    for (let i = 0; i < attempts; i++) {
      const x = TABLE.X + margin + Math.random() * (TABLE.WIDTH - margin * 2);
      const y = TABLE.Y + margin + Math.random() * (TABLE.HEIGHT - margin * 2);

      const clear = this.pens.every((p) => {
        const dx = p.x - x;
        const dy = p.y - y;

        return dx * dx + dy * dy > 90 * 90;
      });

      if (!clear) continue;

      const roll = Math.random();
      const kind = roll < 1 / 3 ? 'speed' : roll < 2 / 3 ? 'helicopter' : 'ink';
      const radius = kind === 'ink' ? POWERUPS.INK_RADIUS : POWERUPS.PICKUP_RADIUS;

      this.powerUp = { id: ++this._powerUpIdSeq, kind, x, y, radius, ageMs: 0 };

      return;
    }
    // No clear spot this round (table's crowded) — just try again
    // next timer instead of forcing an overlap.
  }

  _tickActivePowerUp() {
    const { kind, x, y, radius } = this.powerUp;

    if (kind === 'speed' || kind === 'helicopter') {
      for (let i = 0; i < this.pens.length; i++) {
        if (!this.alive[i]) continue;

        const p = this.pens[i];

        // Capsule-vs-circle overlap, not just a center-to-center
        // distance check — see PenBody.overlapsCircle()'s comment for
        // why that matters for a 145px-long pen against a ~26px pickup.
        if (p.overlapsCircle(x, y, radius)) {
          if (kind === 'speed') {
            this.nextShotBoost[i] = POWERUPS.SPEED_BOOST_MULTIPLIER;
          } else {
            this.nextShotHelicopter[i] = true;
          }

          this._broadcast({
            type: 'powerup-collected',
            kind,
            playerId: i,
            x: p.x,
            y: p.y,
          });

          this.powerUp = null;

          return;
        }
      }

      return;
    }

    // Ink puddle — slows any pen currently inside, then just times out.
    for (let i = 0; i < this.pens.length; i++) {
      if (!this.alive[i]) continue;

      const p = this.pens[i];

      if (p.overlapsCircle(x, y, radius)) {
        p.vx *= POWERUPS.INK_DAMPING_FACTOR;
        p.vy *= POWERUPS.INK_DAMPING_FACTOR;
      }
    }

    this.powerUp.ageMs += TICK_MS;

    if (this.powerUp.ageMs >= POWERUPS.INK_LIFETIME) {
      this.powerUp = null;
    }
  }

  _powerUpSnapshot() {
    if (!this.powerUp) return null;

    const { id, kind, x, y, radius } = this.powerUp;

    return { id, kind, x, y, radius };
  }

  // Real pen-fight rule: a pen that's completely off the table takes
  // its player out. The match ends the moment only one (or zero, on a
  // simultaneous double-out) pen is left.
  _checkEliminations() {
    let changed = false;

    for (let i = 0; i < this.pens.length; i++) {
      if (!this.alive[i]) continue;

      if (this.pens[i].isCompletelyOutside(TABLE)) {
        this.alive[i] = false;
        this.pens[i].stop();
        changed = true;

        if (this.firstEliminationAt === null) this.firstEliminationAt = Date.now();

        this._broadcast({ type: 'eliminated', playerId: i });
      }
    }

    if (!changed) return;

    const aliveIds = this._aliveIds();

    if (aliveIds.length > 1) return;

    this._endMatch(aliveIds.length === 1 ? 'win' : 'draw', aliveIds.length === 1 ? aliveIds[0] : null);
  }

  _checkMatchTimeout() {
    if (!this._usesMatchTimer() || this.matchStartedAt === null) return;

    this.matchTimeLeft = this._matchDurationMs() - (Date.now() - this.matchStartedAt);

    if (this.matchTimeLeft > 0) return;

    this.matchTimeLeft = 0;

    const aliveIds = this._aliveIds();

    this._endMatch(aliveIds.length === 1 ? 'win' : 'draw', aliveIds.length === 1 ? aliveIds[0] : null);
  }

  _aliveIds() {
    return this.alive.map((isAlive, i) => (isAlive ? i : -1)).filter((i) => i !== -1);
  }

  _endMatch(result, winner) {
    this.gameOver = true;
    this.winner = winner;
    this.result = result;
    this.state = ROOM_STATE.ENDED;

    if (this.turns) this.turns.turnActive = false;

    this.pens.forEach((p) => p.stop());

    if (this.config.bestOf3 && result === 'win') {
      this.seriesWins[winner] += 1;
    }

    const stats = {
      shots: this.shotsThisMatch,
      durationMs: this.matchStartedAtStats === null ? null : Date.now() - this.matchStartedAtStats,
      firstEliminationMs:
        this.firstEliminationAt === null || this.matchStartedAtStats === null
          ? null
          : this.firstEliminationAt - this.matchStartedAtStats,
    };

    const seriesWinnerIdx = this._seriesWinner();

    const series = this.config.bestOf3
      ? {
          wins: this.seriesWins,
          target: 2,
          over: seriesWinnerIdx !== -1,
          winner: seriesWinnerIdx !== -1 ? seriesWinnerIdx : null,
        }
      : null;

    this._broadcast({ type: 'game-over', result, winner, stats, series });
  }

  //--------------------------------------------------
  // Outgoing
  //--------------------------------------------------

  _sendJoined(conn, playerId) {
    conn.send({
      type: 'room-joined',
      code: this.code,
      playerId,
      maxPlayers: this.maxPlayers,
      colors: PEN.COLORS,
      config: this.config,
    });
  }

  // A late joiner (spectator) needs to be caught up on whatever's
  // currently happening, since they missed all the events so far.
  _sendCurrentStateTo(conn) {
    if (this.state === ROOM_STATE.LOBBY) {
      conn.send(this._lobbyStatePayload());

      return;
    }

    if (this.state === ROOM_STATE.PLAYING || this.state === ROOM_STATE.ENDED) {
      conn.send({ type: 'match-start', pens: this.pens.map((p) => p.snapshot()) });

      conn.send({
        type: 'state',
        pens: this.pens.map((p) => p.snapshot()),
        turn: this.turns ? this.turns.snapshot() : null,
        connected: this.slots.map((s) => s !== null),
        alive: this.alive,
        gameOver: this.gameOver,
        matchTimeLeft: this.matchTimeLeft,
        collisions: [],
        powerUp: this._powerUpSnapshot(),
        nextShotBoost: this.nextShotBoost,
        nextShotHelicopter: this.nextShotHelicopter,
      });

      if (this.gameOver) {
        conn.send({ type: 'game-over', result: this.result, winner: this.winner });
      }
    }

    // COUNTDOWN: rare to land on mid-tick; they'll pick up the next
    // countdown/match-start broadcast a moment later regardless.
  }

  _lobbyStatePayload() {
    return {
      type: 'lobby-state',
      code: this.code,
      maxPlayers: this.maxPlayers,
      config: this.config,
      colors: PEN.COLORS,
      players: this.slots.map((conn, i) => ({
        playerId: i,
        connected: conn !== null,
        x: this.positions[i].x,
        y: this.positions[i].y,
      })),
    };
  }

  _broadcastLobby() {
    this._broadcast(this._lobbyStatePayload());
  }

  _broadcast(msg) {
    for (const conn of this.slots) {
      if (conn) conn.send(msg);
    }

    for (const conn of this.spectators) {
      conn.send(msg);
    }
  }

  //--------------------------------------------------
  // Timers / lifecycle
  //--------------------------------------------------

  _cancelFullTimer() {
    if (this.fullTimer) {
      clearTimeout(this.fullTimer);
      this.fullTimer = null;
    }
  }

  _cancelCountdown() {
    if (this.countdownTimer) {
      clearTimeout(this.countdownTimer);
      this.countdownTimer = null;
    }
  }

  destroy() {
    clearInterval(this._loop);
    this._cancelFullTimer();
    this._cancelCountdown();
  }
}
