class SocketManager {
  constructor() {
    this.socket = io();
  }

  on(event, callback) {
    this.socket.on(event, callback);
  }

  emit(event, payload) {
    this.socket.emit(event, payload);
  }

  createRoom() {
    this.emit('createRoom');
  }

  joinRandom() {
    this.emit('joinRandom');
  }

  updatePen(payload) {
    this.emit('updatePen', payload);
  }

  sendPlayerInput(payload) {
    this.emit('playerInput', payload);
  }

  sendPlayerOut() {
    this.emit('playerOut');
  }
}
