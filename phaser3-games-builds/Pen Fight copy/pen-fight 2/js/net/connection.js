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
//
// Reconnect handling: `ws` MUST be reset to null the moment the
// underlying socket closes for *any* reason, intentional or not.
// Without that, a connection that drops unexpectedly (a network blip,
// a mobile tab getting backgrounded, the host's free-tier sleep/
// restart cycle, ...) leaves `ws` pointing at a dead, CLOSED socket
// forever — ensureSocket()'s `if (ws) return ws;` would keep handing
// that same dead object back out, and send() would queue every future
// message into outQueue with nothing left to ever flush it. No error,
// no visible break — every subsequent shot just silently goes nowhere
// for the rest of the page's life. Resetting `ws` here is what lets a
// later ensureSocket()/send() open a fresh connection instead.
//==================================================

let ws = null;
let handler = null;
let buffering = false;
let buffer = [];
const outQueue = [];

// Persistent across reconnects — a plain `someWs.addEventListener(...)`
// would stop firing the moment that particular WebSocket instance is
// replaced, which defeats the purpose for anything that needs to react
// to every close/error for as long as the page lives (see onClose()).
const closeListeners = new Set();
const errorListeners = new Set();

let intentionalClose = false;
let reconnectTimer = null;

function connect() {
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

  ws.addEventListener('error', (ev) => {
    for (const fn of errorListeners) fn(ev);
  });

  ws.addEventListener('close', () => {
    const wasIntentional = intentionalClose;

    ws = null;

    for (const fn of closeListeners) fn({ intentional: wasIntentional });

    if (!wasIntentional) {
      // Best-effort auto-reconnect of the socket itself. This does NOT
      // resume an in-progress match — the server has no
      // reconnect-into-the-same-seat support (see MULTIPLAYER_README's
      // Known limits — a fresh connection is always treated as a new
      // join). It just means the page has a live socket again instead
      // of a permanently dead one, so heading back to Home and
      // rejoining actually works without a manual page reload.
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        ensureSocket();
      }, 1500);
    }
  });
}

export function ensureSocket() {
  if (ws) return ws;

  intentionalClose = false;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  connect();

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

// fn receives { intentional: boolean } — false means the socket
// dropped unexpectedly and is worth surfacing to the player (see
// NetGameScene.js). Persists across reconnects; returns an
// unsubscribe function so a scene can stop listening once it's done
// with the connection (see the Home button handlers).
export function onClose(fn) {
  closeListeners.add(fn);

  return () => closeListeners.delete(fn);
}

export function onError(fn) {
  errorListeners.add(fn);

  return () => errorListeners.delete(fn);
}

// Leave the online mode cleanly so a later return trip (Home -> Play
// Online again, in the same page load) opens a fresh connection
// instead of reusing a closed/stale one. Safe to call even if no
// socket was ever opened.
export function closeSocket() {
  intentionalClose = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

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
