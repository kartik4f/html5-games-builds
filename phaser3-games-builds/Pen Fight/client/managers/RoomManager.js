class RoomManager {
  constructor() {
    this.room = null;
  }

  setRoom(roomCode, playerId) {
    this.room = {
      code: roomCode,
      playerId,
      players: [],
      maxPlayers: 4,
      state: 'WAITING',
    };
  }

  setRoomData(room) {
    if (!this.room) {
      this.room = {
        code: room.code,
        playerId: null,
        players: [],
        maxPlayers: room.maxPlayers,
        state: room.state,
      };
    }
    this.room.code = room.code;
    this.room.maxPlayers = room.maxPlayers;
    this.room.state = room.state;
    this.room.players = room.players || [];
  }
}
