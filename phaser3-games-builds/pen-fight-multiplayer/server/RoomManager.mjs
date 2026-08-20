//==================================================
// RoomManager.mjs
//==================================================
// Owns every GameRoom and routes each connection to the right one.
// A fresh connection isn't in any room yet — it has to send one of
// 'quick-join' / 'create-room' / 'join-room' first. After that, every
// message from that connection is handed straight to its room.
//==================================================

import GameRoom from './GameRoom.mjs';
import { generateRoomCode } from './RoomCode.mjs';

const DEFAULT_QUICK_PLAY_PLAYERS = 2;

function clampPlayerCount(n) {
  const num = Math.round(Number(n));

  if (!Number.isFinite(num)) return DEFAULT_QUICK_PLAY_PLAYERS;

  return Math.max(2, Math.min(4, num));
}

export default class RoomManager {
  constructor() {
    this.rooms = new Map(); // code -> GameRoom
  }

  //--------------------------------------------------
  // New connection
  //--------------------------------------------------

  handleConnection(conn) {
    conn.room = null;
    conn.playerId = null;

    // Same reasoning as everywhere else a raw socket is involved — a
    // dropped connection surfaces as an 'error' event, and an
    // unhandled one crashes the whole process.
    conn.on('error', () => {});

    conn.on('message', (raw) => {
      let msg;

      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (conn.room) {
        conn.room.handleMessage(conn, msg);
        return;
      }

      this._handleJoinIntent(conn, msg);
    });

    conn.on('close', () => {
      if (conn.room) conn.room.handleDisconnect(conn);
    });
  }

  //--------------------------------------------------
  // Join intents (only valid before a connection has a room)
  //--------------------------------------------------

  _handleJoinIntent(conn, msg) {
    if (msg.type === 'quick-join') {
      this._attach(conn, this._findOrCreatePublicRoom());
      return;
    }

    if (msg.type === 'create-room') {
      const code = generateRoomCode(this.rooms);

      const room = new GameRoom(
        code,
        {
          maxPlayers: clampPlayerCount(msg.maxPlayers),
          useTurnTimer: !!msg.useTurnTimer,
          waitForSettle: !!msg.waitForSettle,
          useMatchTimeLimit: !!msg.useMatchTimeLimit,
          usePowerUps: !!msg.usePowerUps,
          chaosMode: !!msg.chaosMode,
          bestOf3: !!msg.bestOf3,
          isPublic: false,
        },
        (emptyCode) => this._cleanup(emptyCode),
      );

      this.rooms.set(code, room);
      this._attach(conn, room);
      return;
    }

    if (msg.type === 'join-room') {
      const code = String(msg.code || '').toUpperCase().trim();
      const room = this.rooms.get(code);

      if (!room) {
        conn.send({ type: 'room-error', reason: 'not-found' });
        return;
      }

      this._attach(conn, room);
    }
  }

  _attach(conn, room) {
    conn.room = room;
    room.join(conn);
  }

  _findOrCreatePublicRoom() {
    for (const room of this.rooms.values()) {
      if (room.isPublic && room.hasOpenSlot()) return room;
    }

    const code = generateRoomCode(this.rooms);

    const room = new GameRoom(
      code,
      {
        maxPlayers: DEFAULT_QUICK_PLAY_PLAYERS,
        useTurnTimer: true,
        waitForSettle: true,
        useMatchTimeLimit: false,
        isPublic: true,
      },
      (emptyCode) => this._cleanup(emptyCode),
    );

    this.rooms.set(code, room);

    return room;
  }

  _cleanup(code) {
    const room = this.rooms.get(code);

    if (room && room.isEmpty()) {
      room.destroy();
      this.rooms.delete(code);
    }
  }
}
