# Phaser 3 Multiplayer Game Development — Advanced Guide

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Choosing Your Stack](#choosing-your-stack)
3. [Real-Time Multiplayer (WebSockets)](#real-time-multiplayer)
4. [Turn-Based Multiplayer](#turn-based-multiplayer)
5. [Core Multiplayer Concepts](#core-concepts)
6. [State Synchronization Patterns](#state-sync)
7. [Lag Compensation & Prediction](#lag-compensation)
8. [Authoritative Server Model](#authoritative-server)
9. [Recommended Project Structure](#project-structure)
10. [Production Considerations](#production)

---

## 1. Architecture Overview {#architecture-overview}

All multiplayer games share the same fundamental problem: **multiple clients must agree on a shared game state**. The approaches differ in how strictly that agreement is enforced and how quickly updates must propagate.

```
┌─────────────┐         ┌─────────────────┐         ┌─────────────┐
│  Client A   │◄───────►│   Game Server   │◄───────►│  Client B   │
│ (Phaser 3)  │  WS/UDP │ (Node/Colyseus) │  WS/UDP │ (Phaser 3)  │
└─────────────┘         └─────────────────┘         └─────────────┘
```

**Two topologies to know:**

| Topology | How it works | Use case |
|---|---|---|
| **Authoritative server** | Server runs game logic, clients send inputs only | Real-time action games |
| **Peer-relay / room server** | Server relays messages, clients run their own logic | Turn-based, card games |

Never trust the client for game logic in competitive games. Even in casual games, the server should be the single source of truth.

---

## 2. Choosing Your Stack {#choosing-your-stack}

### Option A — Raw WebSockets + Node.js (`ws` package)
Best when you want full control and minimal abstraction.

```
npm install ws          # server
# no extra client lib needed — browser WebSocket API works fine with Phaser 3
```

### Option B — Socket.io
Adds rooms, namespaces, and auto-reconnect on top of WebSockets. Good for turn-based or lower-frequency updates.

```
npm install socket.io          # server
npm install socket.io-client   # client (bundle with webpack/vite)
```

### Option C — Colyseus (Recommended for real-time)
Purpose-built multiplayer framework. Gives you typed room state with delta-sync, matchmaking, and a Phaser 3 SDK.

```
npm install colyseus            # server
npm install colyseus.js         # client
```

Colyseus handles state serialization, room lifecycle, and delta patching out of the box — letting you focus on game logic.

### Option D — Nakama / PlayFab (BaaS)
Managed backend services. Good for shipping fast without running infrastructure. Higher cost at scale.

---

## 3. Real-Time Multiplayer {#real-time-multiplayer}

### 3.1 Minimal Socket.io Setup

**Server (`server.js`)**
```javascript
import { createServer } from 'http';
import { Server } from 'socket.io';

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: '*' } });

const rooms = new Map(); // roomId -> gameState

io.on('connection', (socket) => {
  socket.on('join_room', ({ roomId, playerId }) => {
    socket.join(roomId);

    if (!rooms.has(roomId)) {
      rooms.set(roomId, { players: {} });
    }

    const room = rooms.get(roomId);
    room.players[playerId] = { x: 400, y: 300, playerId };

    // Send current state to the joiner
    socket.emit('state_snapshot', room);

    // Tell everyone else about the new player
    socket.to(roomId).emit('player_joined', room.players[playerId]);
  });

  socket.on('player_input', ({ roomId, playerId, input }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    // SERVER runs the physics — never trust client position directly
    applyInput(room.players[playerId], input);

    // Broadcast updated position to everyone in room
    io.to(roomId).emit('player_update', {
      playerId,
      x: room.players[playerId].x,
      y: room.players[playerId].y,
    });
  });

  socket.on('disconnect', () => {
    // Clean up player from rooms
  });
});

function applyInput(player, input) {
  const speed = 4;
  if (input.left)  player.x -= speed;
  if (input.right) player.x += speed;
  if (input.up)    player.y -= speed;
  if (input.down)  player.y += speed;
}

httpServer.listen(3000);
```

**Phaser 3 Client Scene**
```javascript
import { io } from 'socket.io-client';

class GameScene extends Phaser.Scene {
  constructor() { super('GameScene'); }

  create() {
    this.socket = io('http://localhost:3000');
    this.players = {};        // sprite map: playerId -> sprite
    this.myPlayerId = crypto.randomUUID();
    this.inputBuffer = [];    // queued inputs for client-side prediction

    this.cursors = this.input.keyboard.createCursorKeys();

    // --- Socket event handlers ---
    this.socket.emit('join_room', {
      roomId: 'room1',
      playerId: this.myPlayerId,
    });

    this.socket.on('state_snapshot', (state) => {
      Object.values(state.players).forEach((p) => this.spawnPlayer(p));
    });

    this.socket.on('player_joined', (p) => this.spawnPlayer(p));

    this.socket.on('player_update', ({ playerId, x, y }) => {
      if (this.players[playerId] && playerId !== this.myPlayerId) {
        // Interpolate remote players — never snap
        this.tweens.add({
          targets: this.players[playerId],
          x, y,
          duration: 50, // ~1 server tick
          ease: 'Linear',
        });
      }
    });
  }

  spawnPlayer(p) {
    if (this.players[p.playerId]) return;
    const sprite = this.add.rectangle(p.x, p.y, 32, 32,
      p.playerId === this.myPlayerId ? 0x00ff00 : 0xff0000);
    this.players[p.playerId] = sprite;
  }

  update() {
    const input = {
      left:  this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up:    this.cursors.up.isDown,
      down:  this.cursors.down.isDown,
    };

    const moving = Object.values(input).some(Boolean);
    if (moving) {
      // Optimistic local movement (client-side prediction)
      const me = this.players[this.myPlayerId];
      if (me) {
        const speed = 4;
        if (input.left)  me.x -= speed;
        if (input.right) me.x += speed;
        if (input.up)    me.y -= speed;
        if (input.down)  me.y += speed;
      }

      // Send input to server
      this.socket.emit('player_input', {
        roomId: 'room1',
        playerId: this.myPlayerId,
        input,
      });
    }
  }
}
```

### 3.2 Colyseus Setup (Recommended)

**Server Room (`GameRoom.ts`)**
```typescript
import { Room, Client } from 'colyseus';
import { Schema, MapSchema, type } from '@colyseus/schema';

class Player extends Schema {
  @type('float32') x: number = 400;
  @type('float32') y: number = 300;
}

class GameState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}

export class GameRoom extends Room<GameState> {
  maxClients = 4;

  onCreate() {
    this.setState(new GameState());

    // Run game loop at 20 ticks/sec
    this.setSimulationInterval((dt) => this.update(dt), 1000 / 20);

    this.onMessage('input', (client, input) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;

      const speed = 4;
      if (input.left)  player.x -= speed;
      if (input.right) player.x += speed;
      if (input.up)    player.y -= speed;
      if (input.down)  player.y += speed;
    });
  }

  onJoin(client: Client) {
    const player = new Player();
    this.state.players.set(client.sessionId, player);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
  }

  update(dt: number) {
    // Additional server-side game logic here
  }
}
```

**Phaser 3 Client**
```javascript
import Colyseus from 'colyseus.js';

class GameScene extends Phaser.Scene {
  async create() {
    const client = new Colyseus.Client('ws://localhost:2567');
    this.room = await client.joinOrCreate('game_room');
    this.players = {};

    // Colyseus gives you fine-grained change callbacks
    this.room.state.players.onAdd((player, sessionId) => {
      const isMe = sessionId === this.room.sessionId;
      const sprite = this.add.rectangle(player.x, player.y, 32, 32,
        isMe ? 0x00ff00 : 0xff0000);
      this.players[sessionId] = sprite;

      // Colyseus automatically calls this when server state changes
      player.onChange(() => {
        if (sessionId !== this.room.sessionId) {
          // Interpolate remote players
          this.tweens.add({
            targets: sprite,
            x: player.x, y: player.y,
            duration: 50,
          });
        }
      });
    });

    this.room.state.players.onRemove((_, sessionId) => {
      this.players[sessionId]?.destroy();
      delete this.players[sessionId];
    });

    this.cursors = this.input.keyboard.createCursorKeys();
  }

  update() {
    const input = {
      left:  this.cursors.left.isDown,
      right: this.cursors.right.isDown,
      up:    this.cursors.up.isDown,
      down:  this.cursors.down.isDown,
    };

    if (Object.values(input).some(Boolean)) {
      this.room.send('input', input);

      // Client-side prediction: move local player immediately
      const me = this.players[this.room.sessionId];
      const speed = 4;
      if (me) {
        if (input.left)  me.x -= speed;
        if (input.right) me.x += speed;
        if (input.up)    me.y -= speed;
        if (input.down)  me.y += speed;
      }
    }
  }
}
```

---

## 4. Turn-Based Multiplayer {#turn-based-multiplayer}

Turn-based games need far less bandwidth — you only send moves, not continuous state.

### Core Pattern: Command / Event sourcing

```javascript
// Server manages turn order and validates moves
class TurnBasedRoom extends Room {
  onCreate() {
    this.setState(new GameState());

    this.onMessage('move', (client, move) => {
      const state = this.state;

      // Only the current player can move
      if (state.currentTurn !== client.sessionId) {
        client.send('error', 'Not your turn');
        return;
      }

      // Validate move legality
      if (!this.isLegal(state, move)) {
        client.send('error', 'Illegal move');
        return;
      }

      // Apply move and advance turn
      this.applyMove(state, move);
      state.currentTurn = this.nextPlayer(state.currentTurn);

      // Check win condition
      const winner = this.checkWinner(state);
      if (winner) {
        this.broadcast('game_over', { winner });
        this.disconnect();
      }
    });
  }

  isLegal(state, move) { /* game-specific */ return true; }
  applyMove(state, move) { /* game-specific */ }
  nextPlayer(current) { /* cycle through player list */ }
  checkWinner(state) { /* return sessionId or null */ }
}
```

### Reconnection Handling (critical for turn-based)

```javascript
// Server — allow reconnection within 60 seconds
async onLeave(client, consented) {
  if (!consented) {
    try {
      await this.allowReconnection(client, 60);
      // Player reconnected — restore their view
      client.send('state_snapshot', this.state);
    } catch {
      // Timed out — treat as forfeit
      this.state.forfeit(client.sessionId);
    }
  }
}
```

---

## 5. Core Multiplayer Concepts {#core-concepts}

### Tick Rate vs Frame Rate

- **Server tick rate**: How often the server advances game state (typically 20–60 Hz for action games, 1–5 Hz for turn-based)
- **Client frame rate**: How often Phaser renders (typically 60 fps)
- These are independent. The client renders at 60 fps but interpolates between server ticks.

### Message Types

| Type | Direction | Example |
|---|---|---|
| Input | Client → Server | `{ left, right, up, down, fire }` |
| State delta | Server → Client | Colyseus schema patches |
| State snapshot | Server → Client | Full state on join |
| Event | Server → All | `player_died`, `item_spawned` |

### Sequence Numbers

Always number your inputs. The server uses sequence numbers to apply inputs in order and the client uses them for reconciliation.

```javascript
// Client
let seq = 0;
function sendInput(input) {
  const msg = { seq: seq++, tick: Date.now(), ...input };
  pendingInputs.push(msg);   // keep for reconciliation
  socket.emit('input', msg);
}

// Server acknowledges with last processed seq
socket.emit('state_update', { ...state, lastSeq: msg.seq });

// Client reconciliation
function onStateUpdate(serverState) {
  // Remove inputs the server has processed
  pendingInputs = pendingInputs.filter(i => i.seq > serverState.lastSeq);

  // Snap to server position
  myPlayer.x = serverState.x;
  myPlayer.y = serverState.y;

  // Re-apply unacknowledged inputs
  for (const input of pendingInputs) {
    applyInputLocally(myPlayer, input);
  }
}
```

---

## 6. State Synchronization Patterns {#state-sync}

### Pattern 1: Snapshot (simplest)
Server sends the full game state every tick. Easy to implement, expensive at scale.

```
Server → Client: { players: [...], projectiles: [...], score: ... }
```

Good up to ~10 entities. Avoid for large worlds.

### Pattern 2: Delta Sync
Only send what changed since the last acknowledged state. Colyseus does this automatically via its Schema system.

```
Server → Client: { changed: { player_id: { x: 412 } } }
```

### Pattern 3: Event-driven
Only emit discrete events; clients maintain their own state machine.

```
Server → Client: "player_abc fired at angle 1.57"
Client: spawn bullet sprite, simulate trajectory locally
```

Good for low-frequency events like firing, collecting items, deaths.

**In practice: combine all three.** Use delta sync for entity positions, events for discrete actions, and full snapshots on join or desync.

---

## 7. Lag Compensation & Prediction {#lag-compensation}

### Client-Side Prediction
Apply your own player's input immediately without waiting for server confirmation. Revert if the server disagrees (reconciliation — see §5).

### Remote Player Interpolation
Never snap remote players to their new position — interpolate between the last two received positions.

```javascript
class RemotePlayer {
  constructor(scene) {
    this.sprite = scene.add.rectangle(0, 0, 32, 32, 0xff0000);
    this.positionBuffer = []; // { x, y, timestamp }
  }

  onServerUpdate(x, y) {
    this.positionBuffer.push({ x, y, timestamp: Date.now() });
    // Keep last ~1 second of positions
    const cutoff = Date.now() - 1000;
    this.positionBuffer = this.positionBuffer.filter(p => p.timestamp > cutoff);
  }

  // Call this in Phaser update()
  interpolate() {
    // Render state 100ms in the past — ensures we always have two
    // positions to interpolate between
    const renderTime = Date.now() - 100;

    const buf = this.positionBuffer;
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i].timestamp <= renderTime && renderTime <= buf[i + 1].timestamp) {
        const t = (renderTime - buf[i].timestamp) /
                  (buf[i + 1].timestamp - buf[i].timestamp);
        this.sprite.x = Phaser.Math.Linear(buf[i].x, buf[i + 1].x, t);
        this.sprite.y = Phaser.Math.Linear(buf[i].y, buf[i + 1].y, t);
        break;
      }
    }
  }
}
```

### Server-Side Lag Compensation (for shooters)
When a player fires, they see the world 100ms in the past. The server must rewind the world to that point to check if the shot hit.

```javascript
// Server maintains a ring buffer of past states
const stateHistory = []; // [{ timestamp, state }]

function onFireEvent(client, { timestamp, direction }) {
  // Find the world state at the time the client fired
  const pastState = stateHistory.find(s => s.timestamp <= timestamp);
  if (!pastState) return;

  // Cast ray against past positions, not current ones
  const hit = raycast(direction, pastState.entities);
  if (hit) {
    applyDamage(hit.entityId);
    io.to(roomId).emit('hit_confirmed', { hitId: hit.entityId });
  }
}
```

---

## 8. Authoritative Server Model {#authoritative-server}

The server is the **only** source of truth. Clients are displays + input sources.

**Rules:**
- Validate every input server-side before applying it
- Never apply a client-sent position directly — only apply client-sent inputs
- Rate-limit inputs to prevent speed hacks (e.g., max 1 jump per 500ms)
- Detect and disconnect cheating clients

```javascript
// Rate limiting example
const rateLimits = new Map(); // playerId -> { jumpCount, windowStart }

function validateJump(playerId) {
  const now = Date.now();
  const limit = rateLimits.get(playerId) || { count: 0, windowStart: now };

  if (now - limit.windowStart > 1000) {
    // New 1-second window
    limit.count = 0;
    limit.windowStart = now;
  }

  limit.count++;
  rateLimits.set(playerId, limit);

  if (limit.count > 2) {
    console.warn(`Player ${playerId} exceeded jump rate limit`);
    return false; // Ignore input — optionally kick player
  }
  return true;
}
```

---

## 9. Recommended Project Structure {#project-structure}

```
/
├── client/
│   ├── src/
│   │   ├── scenes/
│   │   │   ├── BootScene.js
│   │   │   ├── LobbyScene.js       # matchmaking UI
│   │   │   └── GameScene.js        # main game
│   │   ├── network/
│   │   │   ├── NetworkManager.js   # socket abstraction
│   │   │   └── Interpolator.js     # remote player interpolation
│   │   ├── entities/
│   │   │   ├── LocalPlayer.js      # prediction + reconciliation
│   │   │   └── RemotePlayer.js     # interpolated remote entity
│   │   └── main.js
│   └── index.html
│
└── server/
    ├── src/
    │   ├── rooms/
    │   │   ├── GameRoom.ts         # Colyseus room
    │   │   └── LobbyRoom.ts
    │   ├── schema/
    │   │   ├── GameState.ts
    │   │   └── Player.ts
    │   ├── systems/
    │   │   ├── PhysicsSystem.ts    # server-side physics
    │   │   └── CombatSystem.ts
    │   └── index.ts
    └── package.json
```

### NetworkManager abstraction
Wrap your socket library so swapping it out is trivial:

```javascript
class NetworkManager {
  constructor() {
    this.listeners = {};
  }

  async connect(url, roomName) {
    const client = new Colyseus.Client(url);
    this.room = await client.joinOrCreate(roomName);
    return this.room;
  }

  send(type, data) {
    this.room?.send(type, data);
  }

  on(event, callback) {
    this.room?.onMessage(event, callback);
  }

  get sessionId() {
    return this.room?.sessionId;
  }
}
```

---

## 10. Production Considerations {#production}

### Scaling
- A single Node.js process handles ~1,000 concurrent WebSocket connections comfortably
- Use **Redis pub/sub** to share state across multiple server processes
- Colyseus has built-in support for distributed rooms via `@colyseus/redis-presence`

### Networking
- **WebSockets** are the right default — they work through firewalls and proxies
- **WebRTC data channels** give you UDP-like behavior (unordered, unreliable) for lower latency, at the cost of complexity. Only worth it for sub-60ms-sensitive games

### Security
- Authenticate players before letting them into rooms (JWT is common)
- Never expose internal player IDs — use session IDs
- Sanitize all incoming messages (`zod` or `@sinclair/typebox` for schema validation)

### Monitoring
- Track tick rate drift (server under load = slow ticks = lag)
- Log and alert on desync events
- Use Colyseus Monitor (`@colyseus/monitor`) for real-time room inspection in dev

### Testing
- Unit test your game logic independently of the network layer
- Use Colyseus's `LocalDriver` to run room tests without a real WebSocket server

```typescript
// Colyseus room test example
import { ColyseusTestServer, boot } from '@colyseus/testing';
import { GameRoom } from '../src/rooms/GameRoom';

let server: ColyseusTestServer;

beforeAll(async () => {
  server = await boot({ GameRoom });
});

test('two players can join and move', async () => {
  const room = await server.createRoom('game_room');
  const client1 = await server.connectTo(room);
  const client2 = await server.connectTo(room);

  client1.send('input', { right: true });
  await server.processMessage();

  expect(room.state.players.get(client1.sessionId).x).toBeGreaterThan(400);
});
```

---

## Quick Decision Tree

```
What kind of game?
├── Turn-based / async
│   └── Socket.io rooms + simple state machine — no interpolation needed
├── Real-time, casual (< 4 players, low precision)
│   └── Socket.io with snapshot sync at 20 Hz
└── Real-time, competitive (action, shooter)
    └── Colyseus + authoritative server + client prediction + interpolation
```

---

## Further Reading

- [Colyseus Docs](https://docs.colyseus.io)
- [Gabriel Gambetta — Fast-Paced Multiplayer](https://www.gabrielgambetta.com/client-server-game-architecture.html) — the canonical reference on prediction, interpolation, lag compensation
- [Valve — Source Multiplayer Networking](https://developer.valvesoftware.com/wiki/Source_Multiplayer_Networking) — battle-tested concepts applicable to any engine
- [Phaser 3 Docs](https://newdocs.phaser.io)
