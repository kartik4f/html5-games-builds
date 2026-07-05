class PlayerManager {
  createPlayerData(socketId, index, x, y, angle) {
    return {
      id: socketId,
      index,
      x,
      y,
      angle,
      alive: true,
    };
  }
}

module.exports = PlayerManager;
