const { generateRoomCode } = require('./utils/generateRoomCode');

class RoomManager {
  constructor(io) {
    this.io = io;
    this.rooms = {};
    this.socketRooms = new Map();
    this.maxPlayers = 4;
  }

  createRoom(hostSocketId) {
    const roomCode = generateRoomCode();
    if (this.rooms[roomCode]) {
      return this.createRoom(hostSocketId);
    }

    const room = {
      code: roomCode,
      state: 'WAITING',
      maxPlayers: this.maxPlayers,
      players: {},
      createdAt: Date.now(),
      currentTurn: null,
      placementStartTime: null,
      placementDuration: 10000,
    };

    this.rooms[roomCode] = room;
    return room;
  }

  findOpenRoom() {
    for (const code in this.rooms) {
      const room = this.rooms[code];
      if (
        room.state === 'WAITING' &&
        Object.keys(room.players).length < room.maxPlayers
      ) {
        return code;
      }
    }
    return null;
  }

  addPlayer(socketId, roomCode) {
    const room = this.getRoom(roomCode);
    if (!room || Object.keys(room.players).length >= room.maxPlayers) {
      return false;
    }

    const slot = Object.keys(room.players).length;
    const spawn = this.createSpawnPosition(slot, room.maxPlayers);
    room.players[socketId] = {
      id: socketId,
      x: spawn.x,
      y: spawn.y,
      angle: spawn.angle,
      alive: true,
      index: slot + 1,
      positionSet: false,
    };

    this.socketRooms.set(socketId, roomCode);
    return true;
  }

  removePlayer(socketId) {
    const roomCode = this.socketRooms.get(socketId);
    if (!roomCode) return;

    const room = this.getRoom(roomCode);
    if (!room) return;

    delete room.players[socketId];
    this.socketRooms.delete(socketId);

    if (Object.keys(room.players).length === 0) {
      delete this.rooms[roomCode];
      return;
    }

    if (room.state !== 'GAME_OVER') {
      room.state = 'WAITING';
    }
  }

  updatePlayerPosition(socketId, payload) {
    const roomCode = this.getSocketRoom(socketId);
    if (!roomCode) return;

    const room = this.getRoom(roomCode);
    if (!room || !room.players[socketId]) return;

    const player = room.players[socketId];
    if (typeof payload.x === 'number') player.x = payload.x;
    if (typeof payload.y === 'number') player.y = payload.y;
    if (typeof payload.angle === 'number') player.angle = payload.angle;
    if (typeof payload.velocityX === 'number')
      player.velocityX = payload.velocityX;
    if (typeof payload.velocityY === 'number')
      player.velocityY = payload.velocityY;
    if (typeof payload.angularVelocity === 'number')
      player.angularVelocity = payload.angularVelocity;
    player.positionSet = true;
  }

  eliminatePlayer(socketId) {
    const roomCode = this.getSocketRoom(socketId);
    if (!roomCode) return null;
    const room = this.getRoom(roomCode);
    if (!room || !room.players[socketId]) return null;

    room.players[socketId].alive = false;
    return room;
  }

  getRoom(roomCode) {
    return this.rooms[roomCode] || null;
  }

  getSocketRoom(socketId) {
    return this.socketRooms.get(socketId) || null;
  }

  getRoomData(roomCode) {
    const room = this.getRoom(roomCode);
    if (!room) return null;
    return {
      code: room.code,
      state: room.state,
      maxPlayers: room.maxPlayers,
      players: Object.values(room.players),
      currentTurn: room.currentTurn,
      placementStartTime: room.placementStartTime,
      placementDuration: room.placementDuration,
    };
  }

  createSpawnPosition(slot, totalPlayers) {
    const centerX = 640;
    const centerY = 360;
    const radius = 240;
    const angle = (Math.PI * 2 * slot) / totalPlayers;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      angle: angle + Math.PI / 2,
    };
  }
}

module.exports = RoomManager;
