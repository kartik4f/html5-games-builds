//==================================================
// Room.mjs  (server-side)
//==================================================
// One authoritative match between exactly 2 players. Owns the
// physics simulation and the turn state; connected clients only ever
// send drag vectors and receive state snapshots — they don't decide
// anything themselves. This is the "Client -> Server (physics/turns/
// game state) -> Clients" shape inifo.txt asked for.
//
// Scope note: this is deliberately Phase-2-only (see inifo.txt) — two
// players, same pens, turns, synced physics, wait-until-settled. No
// elimination, scoring, or win/draw yet.
//==================================================

import { PEN } from '../js/Constants.js';
import { PenBody, computeShotVelocity, step } from './PhysicsEngine.mjs';
import TurnManager from './TurnManager.mjs';

const TICK_HZ = 60;
const TICK_MS = 1000 / TICK_HZ;

// Same starting layout as PenManager.createDefaultPens' first two pens.
const START_POSITIONS = [
  { x: 350, y: 250 },
  { x: 650, y: 360 },
];

export default class Room {
  constructor() {
    this.slots = [null, null]; // WSConnection per player slot, or null
    this.spectators = new Set();

    this.pens = START_POSITIONS.map((p, i) => new PenBody(i, p.x, p.y));

    this.turns = new TurnManager(this.pens.length, (currentIndex) => {
      this._broadcast({ type: 'turn-changed', currentIndex });
    });

    this._loop = setInterval(() => this._tick(), TICK_MS);
  }

  //--------------------------------------------------
  // Connections
  //--------------------------------------------------

  join(conn) {
    let slot = this.slots.indexOf(null);

    // A dropped wifi connection, a closed tab, etc. all surface as a
    // socket 'error' event. EventEmitter throws if an 'error' event
    // has no listener, which would otherwise take the whole process
    // (and the other player's game) down with it.
    conn.on('error', () => {});

    if (slot === -1) {
      // Room full — spectate only, but still gets live state updates.
      this.spectators.add(conn);

      conn.send({
        type: 'welcome',
        playerId: null,
        colors: PEN.COLORS,
        pens: this.pens.map((p) => p.snapshot()),
        turn: this.turns.snapshot(),
        connected: this.slots.map((s) => s !== null),
      });

      conn.on('close', () => this.spectators.delete(conn));

      return;
    }

    this.slots[slot] = conn;

    conn.send({
      type: 'welcome',
      playerId: slot,
      colors: PEN.COLORS,
      pens: this.pens.map((p) => p.snapshot()),
      turn: this.turns.snapshot(),
      connected: this.slots.map((s) => s !== null),
    });

    this._broadcast({
      type: 'players',
      connected: this.slots.map((s) => s !== null),
    });

    conn.on('message', (raw) => this._onMessage(slot, raw));

    conn.on('close', () => {
      if (this.slots[slot] === conn) {
        this.slots[slot] = null;

        this._broadcast({
          type: 'players',
          connected: this.slots.map((s) => s !== null),
        });
      }
    });

    // Both seats filled -> start (or resume) the match.
    if (this.slots.every((s) => s !== null) && !this.turns.started) {
      this.turns.start();
    }
  }

  //--------------------------------------------------
  // Messages
  //--------------------------------------------------

  _onMessage(playerId, raw) {
    let msg;

    try {
      msg = JSON.parse(raw);
    } catch {
      return;
    }

    if (msg.type === 'shoot') {
      this._onShoot(playerId, msg);
    }
  }

  _onShoot(playerId, msg) {
    if (!this.turns.canPlayerAct(playerId)) return;

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

    // Local grab point relative to the pen's center, un-rotated by
    // its current angle (soft trust boundary — good enough for
    // friends on the same network, not hardened anti-cheat).
    const cos = Math.cos(pen.angle);
    const sin = Math.sin(pen.angle);

    const wx = touchX - pen.x;
    const wy = touchY - pen.y;

    const localX = wx * cos + wy * sin;
    const localY = -wx * sin + wy * cos;

    pen.applyImpulseAtLocalPoint(shot.dvx, shot.dvy, localX, localY);

    this.turns.onShot();
  }

  //--------------------------------------------------
  // Loop
  //--------------------------------------------------

  _tick() {
    const bothConnected = this.slots.every((s) => s !== null);

    if (bothConnected && this.turns.started) {
      step(this.pens, 1 / TICK_HZ);

      this.turns.update(this.pens);
    }

    this._broadcast({
      type: 'state',
      pens: this.pens.map((p) => p.snapshot()),
      turn: this.turns.snapshot(),
      connected: this.slots.map((s) => s !== null),
    });
  }

  _broadcast(msg) {
    for (const conn of this.slots) {
      if (conn) conn.send(msg);
    }

    for (const conn of this.spectators) {
      conn.send(msg);
    }
  }
}
