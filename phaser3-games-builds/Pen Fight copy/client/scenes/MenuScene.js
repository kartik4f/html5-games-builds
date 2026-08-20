class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  create() {
    this.add
      .text(640, 120, 'PenPen Fight', { fontSize: '56px', color: '#ffffff' })
      .setOrigin(0.5);

    this.createButton(640, 260, 'Create Room', () => {
      socketManager.createRoom();
    });

    this.createButton(640, 340, 'Join Random Room', () => {
      socketManager.joinRandom();
    });

    this.statusText = this.add
      .text(640, 470, 'Waiting for server response...', {
        fontSize: '20px',
        color: '#ddd',
      })
      .setOrigin(0.5);

    socketManager.on('roomCreated', (data) => {
      roomManager.setRoom(data.roomCode, data.playerId);
      this.scene.start('RoomScene');
    });

    socketManager.on('joinedRoom', (data) => {
      roomManager.setRoom(data.roomCode, data.playerId);
      this.scene.start('RoomScene');
    });

    socketManager.on('errorMessage', (message) => {
      this.statusText.setText(message);
    });
  }

  createButton(x, y, label, callback) {
    const button = this.add
      .text(x, y, label, {
        fontSize: '24px',
        backgroundColor: '#2e7dff',
        color: '#ffffff',
        padding: { x: 16, y: 10 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });

    button.on('pointerover', () =>
      button.setStyle({ backgroundColor: '#1f5fcc' }),
    );
    button.on('pointerout', () =>
      button.setStyle({ backgroundColor: '#2e7dff' }),
    );
    button.on('pointerup', callback);
    return button;
  }
}
