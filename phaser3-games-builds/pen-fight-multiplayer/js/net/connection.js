//==================================================
// connection.js
//==================================================
// One shared WebSocket for the whole page. The pre-room HTML menu
// (Quick Play / Create Room / Join Room) needs to talk to the server
// before the Phaser game even exists, and once a room is joined the
// game needs to keep using that *same* connection rather than opening
// a second one — so the socket lives here, outside any one scene.
//
// Handoff race: the server sends 'room-joined' immediately followed
// by a 'lobby-state' broadcast. The menu's handler reacts to
// 'room-joined' by booting the Phaser scene, but scene creation is
// asynchronous — the follow-up 'lobby-state' can easily arrive before
// the scene has called setHandlerAndCatchUp(), and a plain "swap the
// handler" design would silently drop it. So: from the moment a
// 'room-joined' arrives, every message is buffered as well as
// delivered live, and whoever calls setHandlerAndCatchUp() next gets
// that buffer replayed before switching over to live delivery.
//
// Outgoing messages are queued if the socket isn't OPEN yet.
//==================================================

let ws = null;
let handler = null;
let buffering = false;
let buffer = [];
const outQueue = [];

export function ensureSocket() {
  if (ws) return ws;

  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';

  ws = new WebSocket(`${proto}//${location.host}/ws`);

  ws.addEventListener('open', () => {
    for (const msg of outQueue.splice(0)) {
      ws.send(JSON.stringify(msg));
    }
  });

  ws.addEventListener('message', (ev) => {
    let msg;

    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }

    if (msg.type === 'room-joined') {
      buffering = true;
      buffer = [msg];
    } else if (buffering) {
      buffer.push(msg);
    }

    if (handler) handler(msg);
  });

  return ws;
}

// Take over message delivery, first replaying anything buffered since
// the last 'room-joined' so nothing sent in the handoff window is lost.
export function setHandlerAndCatchUp(fn) {
  handler = fn;

  const toReplay = buffer;

  buffer = [];
  buffering = false;

  for (const msg of toReplay) fn(msg);
}

export function setHandler(fn) {
  handler = fn;
}

export function send(msg) {
  if (!ws) ensureSocket();

  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  } else {
    outQueue.push(msg);
  }
}

export function onOpen(fn) {
  const socket = ensureSocket();

  if (socket.readyState === WebSocket.OPEN) {
    fn();
    return;
  }

  socket.addEventListener('open', fn, { once: true });
}

export function onClose(fn) {
  ensureSocket().addEventListener('close', fn);
}

export function onError(fn) {
  ensureSocket().addEventListener('error', fn);
}

// Leave the online mode cleanly so a later return trip (Home -> Play
// Online again, in the same page load) opens a fresh connection
// instead of reusing a closed/stale one. Safe to call even if no
// socket was ever opened.
export function closeSocket() {
  if (ws) {
    try {
      ws.close();
    } catch {
      // already closed/closing — fine either way
    }
  }

  ws = null;
  handler = null;
  buffering = false;
  buffer = [];
  outQueue.length = 0;
}
