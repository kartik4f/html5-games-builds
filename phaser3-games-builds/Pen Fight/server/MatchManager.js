class MatchManager {
  constructor(io, roomManager) {
    this.io = io;
    this.roomManager = roomManager;
    this.timers = new Map();
    this.turnTimers = new Map();
  }

  tryStartPlacement(roomCode) {
    const room = this.roomManager.getRoom(roomCode);
    if (!room || room.state !== 'WAITING') return;

    const playerCount = Object.keys(room.players).length;
    if (playerCount < 2) return;

    room.state = 'PLACEMENT_PENDING';
    this.io
      .to(roomCode)
      .emit('roomUpdated', this.roomManager.getRoomData(roomCode));
    this.io
      .to(roomCode)
      .emit('countdown', { seconds: 3, message: 'Ready players...' });

    if (this.timers.has(roomCode)) {
      clearTimeout(this.timers.get(roomCode));
    }

    const timer = setTimeout(() => {
      this.beginPlacement(roomCode);
    }, 2000);

    this.timers.set(roomCode, timer);
  }

  beginPlacement(roomCode) {
    const room = this.roomManager.getRoom(roomCode);
    if (!room || room.state !== 'PLACEMENT_PENDING') return;

    room.state = 'PLACE_PENS';
    room.placementStartTime = Date.now();
    room.currentTurn = null;
    this.io.to(roomCode).emit('startPlacement', { duration: 10 });
    this.io
      .to(roomCode)
      .emit('roomUpdated', this.roomManager.getRoomData(roomCode));

    if (this.timers.has(roomCode)) {
      clearTimeout(this.timers.get(roomCode));
    }

    const timer = setTimeout(() => {
      this.startFight(roomCode);
    }, 10000);

    this.timers.set(roomCode, timer);
  }

  startFight(roomCode) {
    const room = this.roomManager.getRoom(roomCode);
    if (!room || room.state !== 'PLACE_PENS') return;

    room.state = 'FIGHT';

    const alivePlayers = Object.values(room.players).filter((p) => p.alive);

    alivePlayers.forEach((player) => {
      if (!player.positionSet) {
        const spawn = this.createRandomSpawnPosition();
        player.x = spawn.x;
        player.y = spawn.y;
        player.angle = spawn.angle;
      }
    });

    if (alivePlayers.length > 0) {
      room.currentTurn = alivePlayers[0].id;
    }

    this.io.to(roomCode).emit('fightStart', { currentTurn: room.currentTurn });
    this.io
      .to(roomCode)
      .emit('roomUpdated', this.roomManager.getRoomData(roomCode));

    this.resetTurnTimer(roomCode);
  }

  nextTurn(roomCode) {
    const room = this.roomManager.getRoom(roomCode);
    if (!room || room.state !== 'FIGHT') return;

    const alivePlayers = Object.values(room.players).filter((p) => p.alive);
    if (alivePlayers.length <= 1) return;

    const currentIndex = alivePlayers.findIndex(
      (p) => p.id === room.currentTurn,
    );
    const nextIndex = (currentIndex + 1) % alivePlayers.length;
    room.currentTurn = alivePlayers[nextIndex].id;

    this.io.to(roomCode).emit('turnChanged', { currentTurn: room.currentTurn });
    this.resetTurnTimer(roomCode);
  }

  resetTurnTimer(roomCode) {
    if (this.turnTimers && this.turnTimers.has(roomCode)) {
      clearTimeout(this.turnTimers.get(roomCode));
    }
    if (!this.turnTimers) {
      this.turnTimers = new Map();
    }

    const timer = setTimeout(() => {
      this.nextTurn(roomCode);
    }, 10000);
    this.turnTimers.set(roomCode, timer);
  }

  createRandomSpawnPosition() {
    const centerX = 640;
    const centerY = 360;
    const radius = 200 + Math.random() * 40;
    const angle = Math.random() * Math.PI * 2;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      angle: angle + Math.PI / 2,
    };
  }

  eliminatePlayer(roomCode, playerId) {
    const room = this.roomManager.getRoom(roomCode);
    if (!room || room.state !== 'FIGHT') return;

    const eliminated = this.roomManager.eliminatePlayer(playerId);
    if (!eliminated) return;

    this.io.to(roomCode).emit('playerOut', { playerId });
    this.io
      .to(roomCode)
      .emit('roomUpdated', this.roomManager.getRoomData(roomCode));

    const alivePlayers = Object.values(eliminated.players).filter(
      (p) => p.alive,
    );
    if (alivePlayers.length === 1) {
      eliminated.state = 'GAME_OVER';
      const winner = alivePlayers[0];
      if (this.turnTimers && this.turnTimers.has(roomCode)) {
        clearTimeout(this.turnTimers.get(roomCode));
        this.turnTimers.delete(roomCode);
      }
      this.io
        .to(roomCode)
        .emit('gameOver', { winnerId: winner.id, winnerIndex: winner.index });
      this.io
        .to(roomCode)
        .emit('roomUpdated', this.roomManager.getRoomData(roomCode));
    } else if (playerId === eliminated.currentTurn && alivePlayers.length > 1) {
      this.nextTurn(roomCode);
    }
  }
}

module.exports = MatchManager;
