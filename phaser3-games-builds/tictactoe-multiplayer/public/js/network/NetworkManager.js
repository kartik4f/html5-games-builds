/**
 * NetworkManager — thin wrapper around the Socket.io client.
 *
 * Usage:
 *   const net = new NetworkManager();
 *   net.on('game_started', handler);   // register
 *   net.off('game_started', handler);  // unregister specific handler
 *   net.emit('make_move', { ... });
 */
export default class NetworkManager {
  constructor() {
    // `io` is a global injected by /socket.io/socket.io.js
    this.socket = io();
  }

  /** Register a listener. Returns `this` for chaining. */
  on(event, handler) {
    this.socket.on(event, handler);
    return this;
  }

  /**
   * Remove a listener.
   * Pass the same handler reference used in `on()`, or omit it to remove all
   * listeners for that event.
   */
  off(event, handler) {
    if (handler) {
      this.socket.off(event, handler);
    } else {
      this.socket.off(event);
    }
    return this;
  }

  /** Send an event to the server. */
  emit(event, data) {
    this.socket.emit(event, data);
  }

  get id() {
    return this.socket.id;
  }
}
