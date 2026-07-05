class RoomScene extends Phaser.Scene {
  constructor() {
    super('RoomScene');
  }

  create() {
    this.add
      .text(640, 64, 'Room Lobby', { fontSize: '42px', color: '#ffffff' })
      .setOrigin(0.5);
    this.codeText = this.add
      .text(640, 140, '', { fontSize: '32px', color: '#73d13d' })
      .setOrigin(0.5);
    this.playersText = this.add
      .text(640, 220, '', { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);
    this.statusText = this.add
      .text(640, 300, 'Waiting for players...', {
        fontSize: '22px',
        color: '#aaa',
      })
      .setOrigin(0.5);
    this.countdownText = this.add
      .text(640, 380, '', { fontSize: '56px', color: '#ffdd57' })
      .setOrigin(0.5);

    socketManager.on('roomUpdated', (room) => {
      roomManager.setRoomData(room);
      this.updateRoomInfo();
    });

    socketManager.on('startPlacement', () => {
      this.statusText.setText('Placement phase starting...');
      this.scene.start('GameScene');
    });

    socketManager.on('countdown', (payload) => {
      this.countdownText.setText(payload.message || 'Ready');
    });

    socketManager.on('fightStart', () => {
      this.scene.start('GameScene');
    });

    this.updateRoomInfo();
  }

  updateRoomInfo() {
    const room = roomManager.room;
    if (!room) return;
    this.codeText.setText(`Room ${room.code}`);
    const players = room.players || [];
    const playerLines = players.map(
      (player) =>
        `Player ${player.index} ${player.id === room.playerId ? '(You)' : ''} ${player.alive ? '' : '✕'}`,
    );
    this.playersText.setText(
      `Players: ${players.length}/${room.maxPlayers}\n${playerLines.join('\n')}`,
    );
    this.statusText.setText(
      room.state === 'WAITING'
        ? 'Waiting for players...'
        : `State: ${room.state}`,
    );
  }
}
