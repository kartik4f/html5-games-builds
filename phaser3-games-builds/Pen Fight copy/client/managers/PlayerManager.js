class PlayerManager {
  constructor() {
    this.colorMap = [0x42b983, 0x3b82f6, 0xf59e0b, 0xef4444];
    this.players = {};
  }

  createPen(scene, player, isLocal) {
    const color = this.colorMap[(player.index - 1) % this.colorMap.length];
    const pen = new Pen(scene, player.x, player.y, color, player.id, isLocal);
    pen.setRotation(player.angle);
    if (isLocal) {
      this.localPen = pen;
    }
    this.players[player.id] = pen;
    return pen;
  }
}
