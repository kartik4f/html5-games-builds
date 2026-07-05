class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  create() {
    window.socketManager = new SocketManager();
    window.roomManager = new RoomManager();
    window.playerManager = new PlayerManager();
    this.scene.start('MenuScene');
  }
}
