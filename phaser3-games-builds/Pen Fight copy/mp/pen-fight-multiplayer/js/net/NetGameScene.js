//==================================================
// NetGameScene.js
//==================================================
// The multiplayer scene: connects to the server over WebSocket, and
// does nothing but render server snapshots + forward input. All game
// logic (physics, whose turn, settling) lives on the server — see
// server/Room.js. This file owns no authority over anything.
//==================================================

import { GAME, TABLE, PEN, INPUT } from '../Constants.js';
import { THEME } from '../Theme.js';
import NetPen from './NetPen.js';

export default class NetGameScene extends Phaser.Scene {
  constructor() {
    super('NetGameScene');
  }

  create() {
    this.cameras.main.setBackgroundColor(GAME.BACKGROUND);

    this.createTable();
    this.createHud();

    this.pens = []; // NetPen[], index-matched to server pen ids
    this.myPlayerId = null;
    this.turnState = { currentIndex: 0, turnActive: false, waitingForSettle: false, turnTimeLeft: -1, started: false };
    this.connected = [false, false];

    this.aimGraphics = this.add.graphics();
    this.drag = null; // { dragStart, dragCurrent }

    this.input.on('pointerdown', (p) => this.onPointerDown(p));
    this.input.on('pointermove', (p) => this.onPointerMove(p));
    this.input.on('pointerup', (p) => this.onPointerUp(p));

    this.connectSocket();
  }

  //--------------------------------------------------
  // Table (visual only — the server doesn't render anything)
  //--------------------------------------------------

  createTable() {
    const g = this.add.graphics();

    g.fillStyle(TABLE.COLOR);

    g.fillRoundedRect(TABLE.X, TABLE.Y, TABLE.WIDTH, TABLE.HEIGHT, TABLE.CORNER_RADIUS);

    g.lineStyle(TABLE.BORDER, TABLE.BORDER_COLOR);

    g.strokeRoundedRect(TABLE.X, TABLE.Y, TABLE.WIDTH, TABLE.HEIGHT, TABLE.CORNER_RADIUS);

    g.setDepth(-100);
  }

  createHud() {
    this.statusText = this.add
      .text(GAME.WIDTH / 2, 30, 'Connecting…', {
        fontFamily: THEME.FONT_HEADING,
        fontSize: '30px',
        color: THEME.TEXT_INK,
      })
      .setOrigin(0.5);

    this.subText = this.add
      .text(GAME.WIDTH / 2, 62, '', {
        fontFamily: THEME.FONT_BODY,
        fontSize: '20px',
        color: THEME.TEXT_MUTED,
      })
      .setOrigin(0.5);
  }

  //--------------------------------------------------
  // Networking
  //--------------------------------------------------

  connectSocket() {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws`;

    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
      this.statusText.setText('Connected — waiting for opponent…');
    });

    this.ws.addEventListener('message', (ev) => {
      let msg;

      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }

      this.onServerMessage(msg);
    });

    this.ws.addEventListener('close', () => {
      this.statusText.setText('Disconnected from server');
      this.subText.setText('Refresh the page to reconnect');
      this.aimGraphics.clear();
    });

    this.ws.addEventListener('error', () => {
      this.statusText.setText('Could not connect to server');
    });
  }

  onServerMessage(msg) {
    switch (msg.type) {
      case 'welcome':
        this.myPlayerId = msg.playerId;
        this.connected = msg.connected;
        this.turnState = msg.turn;

        this.ensurePens(msg.pens, msg.colors);
        this.refreshHud();
        break;

      case 'players':
        this.connected = msg.connected;
        this.refreshHud();
        break;

      case 'turn-changed':
        this.turnState.currentIndex = msg.currentIndex;
        this.turnState.turnActive = true;
        this.turnState.waitingForSettle = false;
        this.highlightCurrentPen();
        this.refreshHud();
        break;

      case 'state':
        this.connected = msg.connected;
        this.turnState = msg.turn;

        for (const p of msg.pens) {
          const pen = this.pens[p.id];

          if (pen) pen.setTransform(p.x, p.y, p.angle);
        }

        this.refreshHud();
        break;

      default:
        break;
    }
  }

  ensurePens(snapshots, colors) {
    if (this.pens.length) return;

    for (const p of snapshots) {
      const pen = new NetPen(this, p.x, p.y, colors[p.id] ?? PEN.COLORS[p.id], p.id);

      this.pens[p.id] = pen;
    }

    this.highlightCurrentPen();
  }

  highlightCurrentPen() {
    this.pens.forEach((pen, i) => pen.setSelected(i === this.turnState.currentIndex));
  }

  //--------------------------------------------------
  // HUD text
  //--------------------------------------------------

  refreshHud() {
    if (this.pens.length) this.highlightCurrentPen();

    if (!this.connected.every(Boolean)) {
      this.statusText.setText('Waiting for opponent to join…');
      this.subText.setText(
        `Share this page's URL — Player ${this.connected[0] ? 2 : 1} is missing`,
      );
      return;
    }

    if (!this.turnState.started) {
      this.statusText.setText('Starting…');
      this.subText.setText('');
      return;
    }

    const isMe = this.myPlayerId === this.turnState.currentIndex;
    const label = `PLAYER ${this.turnState.currentIndex + 1}`;

    if (this.turnState.waitingForSettle) {
      this.statusText.setText(`${label} SHOT — waiting for pens to settle…`);
      this.subText.setText('');
      return;
    }

    if (this.myPlayerId === null) {
      this.statusText.setText(`${label}'s turn`);
      this.subText.setText('You are spectating');
      return;
    }

    this.statusText.setText(isMe ? 'YOUR TURN' : `${label}'s turn`);

    if (isMe && this.turnState.turnTimeLeft >= 0) {
      this.subText.setText(`${Math.ceil(this.turnState.turnTimeLeft / 1000)}s to shoot`);
    } else {
      this.subText.setText(isMe ? 'Drag your pen back, then release' : '');
    }
  }

  //--------------------------------------------------
  // Input — only the local player's own pen, only on their turn
  //--------------------------------------------------

  canIAct() {
    return (
      this.myPlayerId !== null &&
      this.turnState.started &&
      this.turnState.turnActive &&
      !this.turnState.waitingForSettle &&
      this.turnState.currentIndex === this.myPlayerId
    );
  }

  onPointerDown(pointer) {
    if (this.drag) return;

    if (!this.canIAct()) return;

    const pen = this.pens[this.myPlayerId];

    if (!pen) return;

    const tolerance = pointer.wasTouch ? INPUT.TOUCH_RADIUS : 0;

    if (!pen.containsPoint(pointer.worldX, pointer.worldY, tolerance)) return;

    this.drag = {
      start: { x: pointer.worldX, y: pointer.worldY },
      current: { x: pointer.worldX, y: pointer.worldY },
    };
  }

  onPointerMove(pointer) {
    if (!this.drag) return;

    this.drag.current.x = pointer.worldX;
    this.drag.current.y = pointer.worldY;
  }

  onPointerUp() {
    if (!this.drag) return;

    const { start, current } = this.drag;

    this.drag = null;
    this.aimGraphics.clear();

    const dx = start.x - current.x;
    const dy = start.y - current.y;

    if (Math.hypot(dx, dy) < INPUT.MIN_DRAG_DISTANCE) return;

    if (!this.canIAct() || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    this.ws.send(
      JSON.stringify({
        type: 'shoot',
        touchX: start.x,
        touchY: start.y,
        releaseX: current.x,
        releaseY: current.y,
      }),
    );
  }

  //--------------------------------------------------
  // Update — just the aim line, everything else is event-driven
  //--------------------------------------------------

  update() {
    this.aimGraphics.clear();

    if (!this.drag) return;

    const { start, current } = this.drag;

    const length = Math.hypot(current.x - start.x, current.y - start.y);

    let color = 0x00ff00;

    if (length > 60) color = 0xffff00;
    if (length > 120) color = 0xff0000;

    this.aimGraphics.lineStyle(4, color);
    this.aimGraphics.beginPath();
    this.aimGraphics.moveTo(start.x, start.y);
    this.aimGraphics.lineTo(current.x, current.y);
    this.aimGraphics.strokePath();

    this.aimGraphics.fillStyle(color);
    this.aimGraphics.fillCircle(current.x, current.y, 6);
  }
}
