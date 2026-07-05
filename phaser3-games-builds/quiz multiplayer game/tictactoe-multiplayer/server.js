import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import RoomManager from './src/server/RoomManager.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── HTTP + Socket.io setup ────────────────────────────────────────────────

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer);

// Serve the Phaser client
app.use(express.static(join(__dirname, 'public')));

// ─── Game state ────────────────────────────────────────────────────────────

const rooms = new RoomManager();

// ─── Socket events ─────────────────────────────────────────────────────────

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} connected`);

  // ── Create a new room ──────────────────────────────────────────────────

  socket.on('create_room', ({ name }) => {
    const room = rooms.createRoom();
    room.addPlayer(socket.id, name);
    rooms.trackSocket(socket.id, room.id);
    socket.join(room.id);

    socket.emit('room_created', { roomId: room.id });
    console.log(`[room] ${socket.id} created ${room.id}`);
  });

  // ── Join an existing room ──────────────────────────────────────────────

  socket.on('join_room', ({ roomId, name }) => {
    const room = rooms.getRoom(roomId.toUpperCase());

    if (!room) {
      socket.emit('room_error', { message: 'Room not found. Check the code.' });
      return;
    }
    if (room.isFull()) {
      socket.emit('room_error', { message: 'Room is full.' });
      return;
    }

    room.addPlayer(socket.id, name);
    rooms.trackSocket(socket.id, room.id);
    socket.join(room.id);

    socket.emit('room_joined', { roomId: room.id });
    console.log(`[room] ${socket.id} joined ${room.id}`);

    // Both players present — start the game
    if (room.isFull()) {
      _startGame(room);
    }
  });

  // ── Process a move ─────────────────────────────────────────────────────

  socket.on('make_move', ({ roomId, index }) => {
    const room = rooms.getRoom(roomId);
    if (!room) return;

    const result = room.makeMove(socket.id, index);

    if (result.error) {
      socket.emit('move_error', { message: result.error });
      return;
    }

    // Broadcast the move to everyone in the room
    io.to(roomId).emit('move_made', {
      index:       result.index,
      symbol:      result.symbol,
      board:       result.board,
      currentTurn: result.currentTurn,
    });

    // Send game-over if there's a winner or draw
    if (result.winner || result.isDraw) {
      io.to(roomId).emit('game_over', {
        winner: result.winner, // { symbol, line } | null
        isDraw: result.isDraw,
      });
    }
  });

  // ── Rematch vote ───────────────────────────────────────────────────────

  socket.on('play_again', ({ roomId }) => {
    const room = rooms.getRoom(roomId);
    if (!room) return;

    const allVoted = room.votePlayAgain(socket.id);

    if (allVoted) {
      _startGame(room);
    } else {
      // Tell the other player someone wants a rematch
      socket.to(roomId).emit('opponent_wants_rematch');
    }
  });

  // ── Disconnect ─────────────────────────────────────────────────────────

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id} disconnected`);

    const roomId = rooms.getRoomIdForSocket(socket.id);
    rooms.untrackSocket(socket.id);

    if (!roomId) return;

    const room = rooms.getRoom(roomId);
    if (!room) return;

    room.removePlayer(socket.id);
    io.to(roomId).emit('opponent_disconnected');

    if (room.isEmpty()) {
      rooms.deleteRoom(roomId);
      console.log(`[room] ${roomId} deleted`);
    }
  });
});

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Calls room.startGame() and emits personalised `game_started` to each player.
 */
function _startGame(room) {
  const payloads = room.startGame();
  for (const payload of payloads) {
    io.to(payload.socketId).emit('game_started', {
      symbol:       payload.symbol,
      currentTurn:  payload.currentTurn,
      opponentName: payload.opponentName,
      roomId:       room.id,
    });
  }
  console.log(`[game] Room ${room.id} started`);
}

// ─── Start ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT ?? 3000;
httpServer.listen(PORT, () => {
  console.log(`Server running → http://localhost:${PORT}`);
});
