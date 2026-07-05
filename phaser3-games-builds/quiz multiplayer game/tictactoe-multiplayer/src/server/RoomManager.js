import { randomBytes } from 'crypto';
import GameRoom from './GameRoom.js';

/**
 * RoomManager — creates, stores, and looks up GameRooms.
 * Also maintains a socketId → roomId index for fast disconnect handling.
 */
export default class RoomManager {
  constructor() {
    /** @type {Map<string, GameRoom>} */
    this.rooms = new Map();

    /** @type {Map<string, string>} socketId → roomId */
    this.socketRoomIndex = new Map();
  }

  // ─── Room CRUD ─────────────────────────────────────────────────────────────

  createRoom() {
    const id = randomBytes(3).toString('hex').toUpperCase(); // e.g. "A3F7B2"
    const room = new GameRoom(id);
    this.rooms.set(id, room);
    return room;
  }

  /** @returns {GameRoom|null} */
  getRoom(roomId) {
    return this.rooms.get(roomId) ?? null;
  }

  deleteRoom(roomId) {
    this.rooms.delete(roomId);
  }

  // ─── Socket index ──────────────────────────────────────────────────────────

  trackSocket(socketId, roomId) {
    this.socketRoomIndex.set(socketId, roomId);
  }

  /** @returns {string|null} roomId the socket belongs to */
  getRoomIdForSocket(socketId) {
    return this.socketRoomIndex.get(socketId) ?? null;
  }

  untrackSocket(socketId) {
    this.socketRoomIndex.delete(socketId);
  }
}
