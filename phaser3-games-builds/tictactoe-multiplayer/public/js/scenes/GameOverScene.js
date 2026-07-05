/**
 * GameOverScene — shows win/lose/draw result and play-again flow.
 *
 * Data received:
 *   net          NetworkManager
 *   roomId       string
 *   result       'win' | 'lose' | 'draw'
 *   mySymbol     'X' | 'O'
 *   opponentName string
 */
export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOverScene');
  }

  init(data) {
    this.net          = data.net;
    this.roomId       = data.roomId;
    this.result       = data.result;
    this.mySymbol     = data.mySymbol;
    this.opponentName = data.opponentName;
  }

  create() {
    const cx = 400;

    // ── Result headline ────────────────────────────────────────────────────
    const RESULTS = {
      win:  { headline: 'You Win!',  sub: `You beat ${this.opponentName}!`,        color: '#00ff88' },
      lose: { headline: 'You Lose',  sub: `${this.opponentName} wins this round`,  color: '#e94560' },
      draw: { headline: 'Draw!',     sub: 'Well played, both of you',              color: '#ffd700' },
    };

    const { headline, sub, color } = RESULTS[this.result];

    this.add.text(cx, 160, headline, {
      fontSize: '60px', color, fontFamily: 'Arial Black',
    }).setOrigin(0.5);

    this.add.text(cx, 235, sub, {
      fontSize: '22px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // ── Play Again ─────────────────────────────────────────────────────────
    this._playAgainBtn = this._makeButton(cx, 330, 'PLAY AGAIN', '#e94560', () => {
      this.net.emit('play_again', { roomId: this.roomId });
      this._playAgainBtn.setText('Waiting for opponent…').disableInteractive().setAlpha(0.6);
    });

    // ── Main Menu ──────────────────────────────────────────────────────────
    this._makeButton(cx, 405, 'MAIN MENU', '#333355', () => {
      this._cleanup();
      this.scene.start('LobbyScene');
    });

    // ── Status line ────────────────────────────────────────────────────────
    this._statusText = this.add.text(cx, 475, '', {
      fontSize: '15px', color: '#ffaa00',
    }).setOrigin(0.5);

    // ── Network handlers ───────────────────────────────────────────────────
    this._onRematchWanted = () => {
      this._statusText.setText(`${this.opponentName} wants a rematch!`);
    };

    this._onGameStarted = (data) => {
      this._cleanup();
      this.scene.start('GameScene', { ...data, net: this.net });
    };

    this._onDisconnect = () => {
      this._statusText.setText('Opponent left the game').setColor('#ff6b6b');
      this._playAgainBtn.disableInteractive().setAlpha(0.4);
    };

    this.net
      .on('opponent_wants_rematch', this._onRematchWanted)
      .on('game_started',          this._onGameStarted)
      .on('opponent_disconnected', this._onDisconnect);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _makeButton(x, y, label, bgColor, onClick) {
    const btn = this.add.text(x, y, label, {
      fontSize: '19px', color: '#ffffff', fontFamily: 'Arial Black',
      padding: { x: 24, y: 12 },
      backgroundColor: bgColor,
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    btn.on('pointerover',  () => btn.setAlpha(0.82));
    btn.on('pointerout',   () => btn.setAlpha(1));
    btn.on('pointerdown',  onClick);
    return btn;
  }

  _cleanup() {
    this.net
      .off('opponent_wants_rematch', this._onRematchWanted)
      .off('game_started',          this._onGameStarted)
      .off('opponent_disconnected', this._onDisconnect);
  }

  shutdown() {
    this._cleanup();
  }
}
