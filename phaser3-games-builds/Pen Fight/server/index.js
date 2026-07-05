const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const RoomManager = require('./RoomManager');
const PlayerManager = require('./PlayerManager');
const MatchManager = require('./MatchManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

const roomManager = new RoomManager(io);
const playerManager = new PlayerManager();
const matchManager = new MatchManager(io, roomManager);

app.use(express.static(__dirname + '/../client'));

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('createRoom', () => {
    const room = roomManager.createRoom(socket.id);
    if (!room) {
      socket.emit('errorMessage', 'Failed to create room');
      return;
    }
    socket.join(room.code);
    roomManager.addPlayer(socket.id, room.code);
    matchManager.tryStartPlacement(room.code);
    socket.emit('roomCreated', { roomCode: room.code, playerId: socket.id });
    io.to(room.code).emit('roomUpdated', roomManager.getRoomData(room.code));
  });

  socket.on('joinRandom', () => {
    let roomCode = roomManager.findOpenRoom();
    if (!roomCode) {
      const room = roomManager.createRoom(socket.id);
      if (!room) {
        socket.emit('errorMessage', 'Unable to create or join a room');
        return;
      }
      roomCode = room.code;
    }

    const room = roomManager.getRoom(roomCode);
    if (!room) {
      socket.emit('errorMessage', 'Room not found');
      return;
    }

    socket.join(room.code);
    const added = roomManager.addPlayer(socket.id, room.code);
    if (!added) {
      socket.emit('errorMessage', 'Room is full');
      return;
    }

    socket.emit('joinedRoom', { roomCode: room.code, playerId: socket.id });
    io.to(room.code).emit('roomUpdated', roomManager.getRoomData(room.code));
    matchManager.tryStartPlacement(room.code);
  });

  socket.on('updatePen', (payload) => {
    const roomCode = roomManager.getSocketRoom(socket.id);
    if (!roomCode) return;
    const room = roomManager.getRoom(roomCode);
    if (!room || room.state !== 'PLACE_PENS') return;
    roomManager.updatePlayerPosition(socket.id, payload);
    socket
      .to(roomCode)
      .emit('playerUpdate', { playerId: socket.id, ...payload });
  });

  socket.on('playerInput', (payload) => {
    const roomCode = roomManager.getSocketRoom(socket.id);
    if (!roomCode) return;
    const room = roomManager.getRoom(roomCode);
    if (!room || room.state !== 'FIGHT') return;
    if (room.currentTurn !== socket.id) return;
    roomManager.updatePlayerPosition(socket.id, payload);
    io.to(roomCode).emit('physicsUpdate', { playerId: socket.id, ...payload });
    matchManager.nextTurn(roomCode);
  });

  socket.on('playerOut', () => {
    const roomCode = roomManager.getSocketRoom(socket.id);
    if (!roomCode) return;
    matchManager.eliminatePlayer(roomCode, socket.id);
  });

  socket.on('disconnect', () => {
    const roomCode = roomManager.getSocketRoom(socket.id);
    console.log('Client disconnected:', socket.id, 'room:', roomCode);
    if (roomCode) {
      roomManager.removePlayer(socket.id);
      io.to(roomCode).emit('roomUpdated', roomManager.getRoomData(roomCode));
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`PenPen Fight server listening on http://localhost:${PORT}`);
});
