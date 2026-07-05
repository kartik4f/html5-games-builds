import Board          from '../game/Board.js';
import TurnIndicator  from '../game/TurnIndicator.js';

/**
 * GameScene — the main gameplay screen.
 *
 * Data received from LobbyScene (via scene.start):
 *   net          NetworkManager instance
 *   roomId       string
 *   symbol       'X' | 'O'  — this player's symbol
 *   currentTurn  'X' | 'O'  — who moves first
 *   opponentName string
 */
export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }

  // `init` runs before `create` and receives the data object from scene.start()
  init(data) {
    this.net          = data.net;
    this.roomId       = data.roomId;
    this.mySymbol     = data.symbol;
    this.currentTurn  = data.currentTurn;
    this.opponentName = data.opponentName;
  }

  create() {
    const cx = 400, cy = 300;

    // ── Background decoration ──────────────────────────────────────────────
    this.add.rectangle(cx, cy, 800, 600, 0x1a1a2e);

    // ── Header ─────────────────────────────────────────────────────────────
    this.add.text(cx, 38, 'TIC-TAC-TOE', {
      fontSize: '26px', color: '#ffffff', fontFamily: 'Arial Black',
    }).setOrigin(0.5);

    // ── Player labels ──────────────────────────────────────────────────────
    const oppSymbol  = this.mySymbol === 'X' ? 'O' : 'X';
    const myColor    = this.mySymbol === 'X' ? '#e94560' : '#4a90d9';
    const oppColor   = this.mySymbol === 'X' ? '#4a90d9' : '#e94560';

    this.add.text(145, 80, `YOU\n(${this.mySymbol})`, {
      fontSize: '16px', color: myColor, align: 'center',
    }).setOrigin(0.5);

    this.add.text(655, 80, `${this.opponentName}\n(${oppSymbol})`, {
      fontSize: '16px', color: oppColor, align: 'center',
    }).setOrigin(0.5);

    // ── Turn indicator ─────────────────────────────────────────────────────
    this._turnIndicator = new TurnIndicator(this, cx, 116);
    this._refreshTurnIndicator();

    // ── Board (centred vertically with generous padding) ───────────────────
    const boardSize = 310;
    const boardX    = cx - boardSize / 2;
    const boardY    = 145;

    this._board = new Board(this, boardX, boardY, boardSize);
    this._board.onCellClick = (index) => this._handleClick(index);
    this._board.setClickable(this.mySymbol === this.currentTurn);

    // ── Room code footer ───────────────────────────────────────────────────
    this.add.text(cx, 500, `Room: ${this.roomId}`, {
      fontSize: '13px', color: '#333355',
    }).setOrigin(0.5);

    // ── Network handlers ───────────────────────────────────────────────────
    this._onMoveMade   = (d) => this._handleMoveMade(d);
    this._onGameOver   = (d) => this._handleGameOver(d);
    this._onDisconnect = ()  => this._handleOpponentDisconnect();
    this._onGameStarted= (d) => this._handleRematch(d);

    this.net
      .on('move_made',             this._onMoveMade)
      .on('game_over',             this._onGameOver)
      .on('opponent_disconnected', this._onDisconnect)
      .on('game_started',          this._onGameStarted); // rematch
  }

  // ─── Input ───────────────────────────────────────────────────────────────

  _handleClick(index) {
    if (this.currentTurn !== this.mySymbol) return;
    this.net.emit('make_move', { roomId: this.roomId, index });
    // Disable board immediately to prevent double-click spamming
    this._board.setClickable(false);
  }

  // ─── Network handlers ─────────────────────────────────────────────────────

  _handleMoveMade({ index, symbol, currentTurn }) {
    this._board.placeSymbol(index, symbol);
    this.currentTurn = currentTurn;
    this._refreshTurnIndicator();
    // Re-enable board only if it's now our turn
    this._board.setClickable(this.currentTurn === this.mySymbol);
  }

  _handleGameOver({ winner, isDraw }) {
    this._board.setClickable(false);

    if (winner) {
      this._board.drawWinLine(winner.line);
    }

    const isWinner = winner?.symbol === this.mySymbol;
    const result   = isDraw ? 'draw' : (isWinner ? 'win' : 'lose');

    // Brief pause so the win-line animation plays before transitioning
    this.time.delayedCall(900, () => {
      this._cleanup();
      this.scene.start('GameOverScene', {
        result,
        net:          this.net,
        roomId:       this.roomId,
        mySymbol:     this.mySymbol,
        opponentName: this.opponentName,
      });
    });
  }

  _handleOpponentDisconnect() {
    this._board.setClickable(false);
    this._turnIndicator.setMessage('Opponent disconnected!', '#ff6b6b');

    this.time.delayedCall(2500, () => {
      this._cleanup();
      this.scene.start('LobbyScene');
    });
  }

  /** Called when a rematch is agreed (game_started arrives while in GameScene) */
  _handleRematch({ symbol, currentTurn, opponentName }) {
    this.mySymbol     = symbol;
    this.currentTurn  = currentTurn;
    this.opponentName = opponentName;

    this._board.reset();
    this._board.setClickable(this.currentTurn === this.mySymbol);
    this._refreshTurnIndicator();
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  _refreshTurnIndicator() {
    this._turnIndicator.update(
      this.currentTurn === this.mySymbol,
      this.mySymbol,
      this.currentTurn,
    );
  }

  /** Unregister all handlers before leaving the scene. */
  _cleanup() {
    this.net
      .off('move_made',             this._onMoveMade)
      .off('game_over',             this._onGameOver)
      .off('opponent_disconnected', this._onDisconnect)
      .off('game_started',          this._onGameStarted);
  }

  // Phaser lifecycle — called when the scene is stopped
  shutdown() {
    this._cleanup();
    this._board?.destroy();
    this._turnIndicator?.destroy();
  }
}
