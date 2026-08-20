class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.playerBodies = {};
    this.turnStartTime = null;
    this.placementStartTime = null;
  }

  create() {
    this.add.text(20, 20, 'PenPen Fight', {
      fontSize: '22px',
      color: '#ffffff',
    });
    this.statusText = this.add.text(20, 56, '', {
      fontSize: '18px',
      color: '#ffffff',
    });
    this.infoText = this.add.text(20, 84, '', {
      fontSize: '18px',
      color: '#cccccc',
    });
    this.timerText = this.add
      .text(1260, 20, '', {
        fontSize: '24px',
        color: '#ffdd57',
        align: 'right',
      })
      .setOrigin(1, 0);
    this.turnText = this.add
      .text(640, 680, '', {
        fontSize: '20px',
        color: '#4fc3f7',
        align: 'center',
      })
      .setOrigin(0.5);

    this.table = new Table(this, 640, 360, 760, 420);
    this.matter.world.setBounds(0, 0, 1280, 720, 32, true, true, true, true);

    this.room = roomManager.room;
    this.localPlayerId = this.room.playerId;
    this.placementStartTime = this.room.placementStartTime || Date.now();

    // Create visual feedback graphics for force indication
    this.forceGraphics = this.make.graphics({ x: 0, y: 0, add: false });
    this.forceGraphics.setDepth(10);

    this.createPlayers();
    this.setupSocketEvents();

    // Must call updateGameState before setupControls to ensure localPen is set
    this.updateGameState(this.room.state);
    this.setupControls();
  }

  createPlayers() {
    const players = roomManager.room.players || [];
    players.forEach((player) => {
      const isLocal = player.id === this.localPlayerId;
      const pen = playerManager.createPen(this, player, isLocal);
      this.playerBodies[player.id] = pen;
    });
  }

  setupSocketEvents() {
    socketManager.on('roomUpdated', (room) => {
      roomManager.setRoomData(room);
      this.room = roomManager.room;
      if (this.room.placementStartTime && !this.placementStartTime) {
        this.placementStartTime = this.room.placementStartTime;
      }
      this.updateGameState(this.room.state);
    });

    socketManager.on('playerUpdate', (payload) => {
      const pen = this.playerBodies[payload.playerId];
      if (!pen || payload.playerId === this.localPlayerId) return;
      pen.setState(payload);
    });

    socketManager.on('physicsUpdate', (payload) => {
      const pen = this.playerBodies[payload.playerId];
      if (!pen || payload.playerId === this.localPlayerId) return;
      pen.setState(payload);
    });

    socketManager.on('playerOut', ({ playerId }) => {
      const pen = this.playerBodies[playerId];
      if (pen) {
        pen.setTint(0x666666);
      }
    });

    socketManager.on('gameOver', (payload) => {
      if (payload.winnerId) {
        const isWinner = payload.winnerId === this.localPlayerId;
        const message = isWinner
          ? '🎉 YOU WIN! 🎉'
          : `Player ${payload.winnerIndex} Wins!`;
        this.statusText.setText(message);
        this.statusText
          .setFill(isWinner ? '#4ade80' : '#ff6b6b')
          .setFontSize('32px');
        this.timerText.setText('');
        this.turnText.setText('');
      }
    });

    socketManager.on('startPlacement', () => {
      this.placementStartTime = Date.now();
    });

    socketManager.on('turnChanged', ({ currentTurn }) => {
      this.room.currentTurn = currentTurn;
      this.turnStartTime = Date.now();
      this.updateTurnDisplay();
    });

    socketManager.on('fightStart', (payload) => {
      if (payload && payload.currentTurn) {
        this.room.currentTurn = payload.currentTurn;
        this.turnStartTime = Date.now();
      }
      this.updateGameState('FIGHT');
      this.updateTurnDisplay();
    });
  }

  updateTurnDisplay() {
    if (this.room.state !== 'FIGHT') return;
    const isYourTurn = this.room.currentTurn === this.localPlayerId;
    if (isYourTurn) {
      this.turnText.setText('YOUR TURN - Flick your pen!').setFill('#4fc3f7');
    } else {
      const currentPlayer = this.room.players.find(
        (p) => p.id === this.room.currentTurn,
      );
      const playerIndex = currentPlayer ? currentPlayer.index : '?';
      this.turnText.setText(`Player ${playerIndex}'s turn`).setFill('#999999');
    }
  }

  setupControls() {
    this.input.on('pointerdown', (pointer) => {
      if (!this.localPen) return;
      const state = this.localPen.getState();
      const distance = Phaser.Math.Distance.Between(
        pointer.x,
        pointer.y,
        state.x,
        state.y,
      );
      if (distance <= 120) {
        this.dragging = this.room.state === 'PLACE_PENS';
        this.fireStart = { x: pointer.x, y: pointer.y };
      }
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.localPen) return;

      if (this.dragging && this.room.state === 'PLACE_PENS') {
        const state = this.localPen.getState();
        const angle =
          Phaser.Math.Angle.Between(state.x, state.y, pointer.x, pointer.y) +
          Math.PI / 2;
        this.localPen.setRotation(angle);
        this.socketUpdate();
      }

      // Show force feedback during FIGHT dragging
      if (
        this.room.state === 'FIGHT' &&
        this.fireStart &&
        this.room.currentTurn === this.localPlayerId
      ) {
        this.drawForceIndicator(pointer);
      }
    });

    this.input.on('pointerup', (pointer) => {
      if (this.dragging && this.room.state === 'PLACE_PENS') {
        this.dragging = false;
        this.socketUpdate();
      }

      if (
        this.room.state === 'FIGHT' &&
        this.fireStart &&
        this.room.currentTurn === this.localPlayerId
      ) {
        const dx = this.fireStart.x - pointer.x;
        const dy = this.fireStart.y - pointer.y;
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        if (magnitude > 8) {
          const forceScale = 0.0009;
          const forceVector = {
            x: dx * forceScale,
            y: dy * forceScale,
          };
          this.localPen.applyForce(forceVector);
          this.sendPlayerInput();
        }
      }
      this.fireStart = null;
      this.forceGraphics.clear();
    });
  }

  drawForceIndicator(pointer) {
    this.forceGraphics.clear();
    const penState = this.localPen.getState();

    const dx = this.fireStart.x - pointer.x;
    const dy = this.fireStart.y - pointer.y;
    const magnitude = Math.sqrt(dx * dx + dy * dy);

    // Draw force vector line
    this.forceGraphics.lineStyle(3, 0xff6b6b, 0.8);
    this.forceGraphics.lineBetween(
      this.fireStart.x,
      this.fireStart.y,
      pointer.x,
      pointer.y,
    );

    // Draw circle at drag start showing current strength
    const power = Math.min(magnitude / 100, 2); // Clamp power display
    this.forceGraphics.lineStyle(2, 0xffdd57, 0.6);
    this.forceGraphics.strokeCircleShape(
      new Phaser.Geom.Circle(this.fireStart.x, this.fireStart.y, power * 30),
    );

    // Draw arrow at release point showing direction
    const arrowLen = 20;
    const angle = Math.atan2(dy, dx);
    this.forceGraphics.fillStyle(0x4fc3f7, 0.7);
    this.forceGraphics.beginPath();
    this.forceGraphics.moveTo(pointer.x, pointer.y);
    this.forceGraphics.lineTo(
      pointer.x - arrowLen * Math.cos(angle - 0.3),
      pointer.y - arrowLen * Math.sin(angle - 0.3),
    );
    this.forceGraphics.lineTo(
      pointer.x - arrowLen * Math.cos(angle + 0.3),
      pointer.y - arrowLen * Math.sin(angle + 0.3),
    );
    this.forceGraphics.closePath();
    this.forceGraphics.fillPath();
  }

  update(time) {
    Object.values(this.playerBodies).forEach((pen) => {
      if (pen && typeof pen.update === 'function') {
        pen.update();
      }
    });

    if (this.localPen) {
      const state = this.localPen.getState();

      if (this.room.state === 'PLACE_PENS') {
        const elapsed = (Date.now() - this.placementStartTime) / 1000;
        const remaining = Math.max(0, 10 - elapsed);
        this.statusText.setText('Placement phase: Position your pen!');
        this.timerText.setText(`${remaining.toFixed(1)}s`);
        this.infoText.setText(
          'Drag near your pen to rotate it. Position carefully!',
        );
        this.turnText.setText('');
      } else if (this.room.state === 'FIGHT') {
        this.statusText.setText('Fight phase: Flick your pen to hit others!');
        if (this.turnStartTime) {
          const turnElapsed = (Date.now() - this.turnStartTime) / 1000;
          const turnRemaining = Math.max(0, 10 - turnElapsed);
          this.timerText.setText(`${turnRemaining.toFixed(1)}s`);
        }
        this.infoText.setText(
          'Click and drag away from your pen, then release to flick!',
        );
        // Check if pen fell off table
        if (state.x < 110 || state.x > 1170 || state.y < 90 || state.y > 630) {
          socketManager.sendPlayerOut();
        }
      } else if (this.room.state === 'GAME_OVER') {
        this.timerText.setText('');
        this.infoText.setText('');
        this.forceGraphics.clear();
      }
    }
  }

  updateGameState(state) {
    if (state === 'PLACE_PENS') {
      this.statusText.setText('Placement phase: Position your pen!');
    } else if (state === 'FIGHT') {
      this.statusText.setText('Fight phase: Flick your pen to hit others!');
      this.updateTurnDisplay();
    } else if (state === 'GAME_OVER') {
      this.statusText.setText('Game Over!');
    }

    const local = this.playerBodies[this.localPlayerId];
    if (local) {
      this.localPen = local;
    }
  }

  socketUpdate() {
    if (!this.localPen) return;
    const state = this.localPen.getState();
    socketManager.updatePen({ x: state.x, y: state.y, angle: state.angle });
  }

  sendPlayerInput() {
    if (!this.localPen) return;
    const state = this.localPen.getState();
    socketManager.sendPlayerInput(state);
  }
}
