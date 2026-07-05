import NetworkManager from '../network/NetworkManager.js';

/**
 * LobbyScene — name entry, create room, or join with a code.
 *
 * Passes a single `net` (NetworkManager) instance to GameScene so all
 * scenes share one socket connection for the lifetime of the page.
 */
export default class LobbyScene extends Phaser.Scene {
  constructor() {
    super('LobbyScene');
  }

  create() {
    // Create (or reuse) the network manager
    if (!this.net) {
      this.net = new NetworkManager();
    }

    // Remove any stale lobby listeners from a previous visit
    this.net.off('room_created',  this._onRoomCreated);
    this.net.off('room_joined',   this._onRoomJoined);
    this.net.off('room_error',    this._onRoomError);
    this.net.off('game_started',  this._onGameStarted);

    this._buildUI();
    this._registerNetworkHandlers();
  }

  // ─── UI ──────────────────────────────────────────────────────────────────

  _buildUI() {
    const cx = 400;

    // Title
    this.add.text(cx, 70, 'TIC-TAC-TOE', {
      fontSize: '46px', color: '#ffffff', fontFamily: 'Arial Black',
    }).setOrigin(0.5);

    this.add.text(cx, 118, 'MULTIPLAYER', {
      fontSize: '18px', color: '#4a90d9', fontFamily: 'Arial',
      letterSpacing: 6,
    }).setOrigin(0.5);

    // ── Name field ─────────────────────────────────────────────────────────
    this.add.text(cx, 175, 'YOUR NAME', {
      fontSize: '13px', color: '#888888', fontFamily: 'Arial',
    }).setOrigin(0.5);

    this._nameEl = this.add.dom(cx, 212).createFromHTML(`
      <input id="nameInput" type="text" maxlength="14" placeholder="Enter your name"
        style="width:220px;padding:9px 12px;font-size:16px;font-family:Arial;
               border:2px solid #4a90d9;border-radius:6px;
               background:#0d1b3e;color:#fff;text-align:center;outline:none;" />
    `);

    // ── Create room button ─────────────────────────────────────────────────
    this._makeButton(cx, 275, 'CREATE ROOM', '#e94560', () => {
      const name = this._getInput('nameInput');
      if (!name) { this._showStatus('Please enter your name', '#ff6b6b'); return; }
      this.net.emit('create_room', { name });
    });

    // ── Divider ────────────────────────────────────────────────────────────
    this.add.text(cx, 325, '─── or join with a code ───', {
      fontSize: '13px', color: '#444455',
    }).setOrigin(0.5);

    // ── Room-code field ────────────────────────────────────────────────────
    this._codeEl = this.add.dom(cx, 370).createFromHTML(`
      <input id="codeInput" type="text" maxlength="6" placeholder="ROOM CODE"
        style="width:180px;padding:9px 12px;font-size:18px;font-family:'Arial Black';
               border:2px solid #e94560;border-radius:6px;
               background:#0d1b3e;color:#fff;text-align:center;letter-spacing:6px;
               outline:none;text-transform:uppercase;" />
    `);

    // ── Join room button ───────────────────────────────────────────────────
    this._makeButton(cx, 425, 'JOIN ROOM', '#4a90d9', () => {
      const name = this._getInput('nameInput');
      const code = this._getInput('codeInput')?.toUpperCase();
      if (!name) { this._showStatus('Please enter your name', '#ff6b6b'); return; }
      if (!code) { this._showStatus('Please enter a room code', '#ff6b6b'); return; }
      this.net.emit('join_room', { name, roomId: code });
    });

    // ── Status / info text ─────────────────────────────────────────────────
    this._statusText = this.add.text(cx, 490, '', {
      fontSize: '15px', color: '#ffffff', fontFamily: 'Arial',
      align: 'center',
    }).setOrigin(0.5);
  }

  _makeButton(x, y, label, color, onClick) {
    const hexColor = Phaser.Display.Color.HexStringToColor(color).color;

    const btn = this.add.text(x, y, label, {
      fontSize: '17px', color: '#ffffff', fontFamily: 'Arial Black',
      padding: { x: 22, y: 11 },
      backgroundColor: color,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover',  () => btn.setAlpha(0.82));
    btn.on('pointerout',   () => btn.setAlpha(1));
    btn.on('pointerdown',  onClick);

    return btn;
  }

  _showStatus(msg, color = '#00ff88') {
    this._statusText.setText(msg).setColor(color);
  }

  _getInput(id) {
    return (this._nameEl?.getChildByID(id) ?? this._codeEl?.getChildByID(id))?.value?.trim();
  }

  // ─── Network ─────────────────────────────────────────────────────────────

  _registerNetworkHandlers() {
    this._onRoomCreated = ({ roomId }) => {
      this._roomId = roomId;
      this._showStatus(`Room created: ${roomId}\nWaiting for opponent…`, '#00ff88');
    };

    this._onRoomJoined = ({ roomId }) => {
      this._roomId = roomId;
      this._showStatus(`Joined ${roomId}. Starting soon…`, '#00ff88');
    };

    this._onRoomError = ({ message }) => {
      this._showStatus(message, '#ff6b6b');
    };

    this._onGameStarted = (data) => {
      // Clean up before leaving
      this.net.off('room_created',  this._onRoomCreated);
      this.net.off('room_joined',   this._onRoomJoined);
      this.net.off('room_error',    this._onRoomError);
      this.net.off('game_started',  this._onGameStarted);

      this.scene.start('GameScene', { ...data, net: this.net });
    };

    this.net
      .on('room_created',  this._onRoomCreated)
      .on('room_joined',   this._onRoomJoined)
      .on('room_error',    this._onRoomError)
      .on('game_started',  this._onGameStarted);
  }
}
