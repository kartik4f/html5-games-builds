/**
 * GameRoom — pure game logic, no socket/io references.
 * The server reads the returned results and broadcasts them.
 */

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],             // diagonals
];

export default class GameRoom {
  constructor(id) {
    this.id = id;
    /** @type {{ socketId: string, name: string, symbol: 'X'|'O' }[]} */
    this.players = [];
    this.board = Array(9).fill(null);
    this.currentTurn = 'X';
    this.gameActive = false;
    this.playAgainVotes = new Set();
  }

  // ─── Player management ────────────────────────────────────────────────────

  /**
   * Adds a player to the room.
   * @returns {string|null} The assigned symbol ('X' or 'O'), or null if full.
   */
  addPlayer(socketId, name) {
    if (this.isFull()) return null;
    const symbol = this.players.length === 0 ? 'X' : 'O';
    this.players.push({ socketId, name, symbol });
    return symbol;
  }

  removePlayer(socketId) {
    this.players = this.players.filter((p) => p.socketId !== socketId);
    this.gameActive = false;
  }

  isFull() { return this.players.length >= 2; }
  isEmpty() { return this.players.length === 0; }

  getPlayer(socketId) {
    return this.players.find((p) => p.socketId === socketId) ?? null;
  }

  getOpponent(socketId) {
    return this.players.find((p) => p.socketId !== socketId) ?? null;
  }

  // ─── Game lifecycle ────────────────────────────────────────────────────────

  /**
   * Resets board and returns per-player start payloads.
   * @returns {{ socketId, symbol, currentTurn, opponentName }[]}
   */
  startGame() {
    this.board = Array(9).fill(null);
    this.currentTurn = 'X';
    this.gameActive = true;
    this.playAgainVotes.clear();

    return this.players.map((p) => ({
      socketId:     p.socketId,
      symbol:       p.symbol,
      currentTurn:  this.currentTurn,
      opponentName: this.getOpponent(p.socketId)?.name ?? 'Unknown',
    }));
  }

  // ─── Move handling ─────────────────────────────────────────────────────────

  /**
   * Attempts to place a symbol at `index`.
   * @returns {{ error: string }|{ symbol, board, currentTurn, winner, isDraw }}
   */
  makeMove(socketId, index) {
    const player = this.getPlayer(socketId);
    if (!player)                        return { error: 'Not in this room' };
    if (!this.gameActive)               return { error: 'Game not active' };
    if (player.symbol !== this.currentTurn) return { error: 'Not your turn' };
    if (index < 0 || index > 8)        return { error: 'Invalid cell' };
    if (this.board[index] !== null)     return { error: 'Cell already taken' };

    this.board[index] = player.symbol;

    const winner = this._checkWinner();
    const isDraw = !winner && this.board.every((c) => c !== null);

    if (winner || isDraw) {
      this.gameActive = false;
    } else {
      this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
    }

    return {
      symbol:       player.symbol,
      index,
      board:        [...this.board],
      currentTurn:  this.currentTurn,
      winner,   // { symbol, line } | null
      isDraw,
    };
  }

  // ─── Rematch ───────────────────────────────────────────────────────────────

  /**
   * Registers a rematch vote.
   * @returns {boolean} true when all players have voted → caller should startGame()
   */
  votePlayAgain(socketId) {
    this.playAgainVotes.add(socketId);
    return this.playAgainVotes.size >= this.players.length;
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  _checkWinner() {
    for (const [a, b, c] of WIN_LINES) {
      if (
        this.board[a] &&
        this.board[a] === this.board[b] &&
        this.board[a] === this.board[c]
      ) {
        return { symbol: this.board[a], line: [a, b, c] };
      }
    }
    return null;
  }
}
