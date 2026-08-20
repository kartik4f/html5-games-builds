//==================================================
// ws-lite.js
//==================================================
// A minimal, dependency-free WebSocket server, hand-rolled from the
// RFC6455 handshake + framing spec using only Node built-ins.
//
// Why not the `ws` npm package? This project's sandbox couldn't reach
// the npm registry to install anything, so everything here uses only
// what ships with Node (http, crypto, events) — which also means the
// people playing this game don't need to run `npm install` at all,
// just `node server.js`.
//
// Supports exactly what this game needs: text frames, ping/pong,
// close. No compression, no fragmentation of outgoing messages (our
// JSON payloads are small), single-frame incoming messages assumed.
//==================================================

import crypto from 'node:crypto';
import { EventEmitter } from 'node:events';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function acceptKeyFor(key) {
  return crypto.createHash('sha1').update(key + GUID).digest('base64');
}

//--------------------------------------------------
// One connection
//--------------------------------------------------

class WSConnection extends EventEmitter {
  constructor(socket) {
    super();

    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.closed = false;

    socket.setNoDelay(true);

    socket.on('data', (chunk) => this._onData(chunk));
    socket.on('close', () => this._onClose());
    socket.on('error', (err) => this.emit('error', err));
  }

  //------------------------------------------
  // Incoming
  //------------------------------------------

  _onData(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);

    // Drain as many complete frames as are currently buffered.
    while (this._tryParseOne()) {
      // keep going
    }
  }

  _tryParseOne() {
    const buf = this.buffer;

    if (buf.length < 2) return false;

    const byte0 = buf[0];
    const byte1 = buf[1];

    const opcode = byte0 & 0x0f;
    const masked = (byte1 & 0x80) !== 0;

    let payloadLen = byte1 & 0x7f;
    let offset = 2;

    if (payloadLen === 126) {
      if (buf.length < offset + 2) return false;

      payloadLen = buf.readUInt16BE(offset);
      offset += 2;
    } else if (payloadLen === 127) {
      if (buf.length < offset + 8) return false;

      payloadLen = Number(buf.readBigUInt64BE(offset));
      offset += 8;
    }

    let maskKey = null;

    if (masked) {
      if (buf.length < offset + 4) return false;

      maskKey = buf.subarray(offset, offset + 4);
      offset += 4;
    }

    if (buf.length < offset + payloadLen) return false; // wait for more bytes

    let payload = buf.subarray(offset, offset + payloadLen);

    if (masked) {
      const unmasked = Buffer.alloc(payloadLen);

      for (let i = 0; i < payloadLen; i++) {
        unmasked[i] = payload[i] ^ maskKey[i % 4];
      }

      payload = unmasked;
    } else {
      payload = Buffer.from(payload);
    }

    // Consume these bytes from the accumulator
    this.buffer = Buffer.from(buf.subarray(offset + payloadLen));

    this._handleFrame(opcode, payload);

    return true;
  }

  _handleFrame(opcode, payload) {
    switch (opcode) {
      case 0x1: // text
        this.emit('message', payload.toString('utf8'));
        break;

      case 0x8: // close
        this._sendFrame(0x8, Buffer.alloc(0));
        this.socket.end();
        break;

      case 0x9: // ping -> pong
        this._sendFrame(0xa, payload);
        break;

      case 0xa: // pong
        break;

      default:
        break;
    }
  }

  _onClose() {
    if (this.closed) return;

    this.closed = true;
    this.emit('close');
  }

  //------------------------------------------
  // Outgoing
  //------------------------------------------

  _sendFrame(opcode, payload) {
    if (this.closed || this.socket.destroyed) return;

    const len = payload.length;
    let header;

    if (len < 126) {
      header = Buffer.alloc(2);
      header[0] = 0x80 | opcode;
      header[1] = len;
    } else if (len < 65536) {
      header = Buffer.alloc(4);
      header[0] = 0x80 | opcode;
      header[1] = 126;
      header.writeUInt16BE(len, 2);
    } else {
      header = Buffer.alloc(10);
      header[0] = 0x80 | opcode;
      header[1] = 127;
      header.writeBigUInt64BE(BigInt(len), 2);
    }

    try {
      this.socket.write(Buffer.concat([header, payload]));
    } catch {
      // socket already gone; close event will clean up
    }
  }

  send(data) {
    const str = typeof data === 'string' ? data : JSON.stringify(data);

    this._sendFrame(0x1, Buffer.from(str, 'utf8'));
  }

  close() {
    if (this.closed) return;

    this._sendFrame(0x8, Buffer.alloc(0));
    this.socket.end();
  }
}

//--------------------------------------------------
// Server: upgrades matching HTTP requests to WS connections
//--------------------------------------------------

export function createWSServer(httpServer, { path = '/ws' } = {}) {
  const emitter = new EventEmitter();

  httpServer.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    const isWebSocket = (req.headers['upgrade'] || '').toLowerCase() === 'websocket';

    const url = req.url || '/';
    const onPath = url === path || url.startsWith(path + '?');

    if (!key || !isWebSocket || !onPath) {
      socket.destroy();
      return;
    }

    const accept = acceptKeyFor(key);

    const headers = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '',
      '',
    ].join('\r\n');

    socket.write(headers);

    const conn = new WSConnection(socket);

    emitter.emit('connection', conn, req);
  });

  return emitter;
}
