# Pen Fight — Online Multiplayer (deep dive)

This is the detailed writeup of how **Play Online** works specifically —
rooms, lobby, server-authoritative physics/collision protocol, and so on.
For the big picture (all three ways to play — Online, Classroom, Vs
Computer — from one start screen) see `README.md` first.

Server-authoritative: the server owns physics, turn order, and room state;
browsers only render and send input.

## What's in `server/`

```
server/            <- plain Node scripts, no package.json, nothing to install
  server.mjs         entry point: serves the game files + the /ws endpoint
  ws-lite.mjs         hand-rolled WebSocket server (no `ws` package needed)
  PhysicsEngine.mjs   2D physics for 2-4 pens (all-pairs collision)
  TurnManager.mjs     whose turn / can-act / wait-for-settle / skips eliminated players
  RoomCode.mjs        generates short 4-character room codes
  RoomManager.mjs     routes connections to rooms (quick-join / create / join by code)
  GameRoom.mjs        one match's full state machine (lobby -> countdown -> playing -> ended)

js/net/             <- thin online client: render + input only, no physics
  connection.js       shared WebSocket used by the whole page (see js/main.js)
  NetGameScene.js
  NetPen.js
  WinStreak.js        per-browser win-streak counter (localStorage only)
```

This isn't an npm project — there's no `package.json` anywhere and nothing
to `npm install`. The server files use a `.mjs` extension, which is what
tells Node "these are ES modules" without needing a `package.json` to
declare it. Just plain scripts, run directly with `node`.

## How it works

**Menu.** Choosing **Play Online** from the home screen (`index.html`)
shows the online menu, not the game table directly:

- **Quick Play** — drops you into an open public 2-player room, or creates
  one if none is waiting.
- **Create Room** — pick 2, 3, or 4 players, and toggle Turn Timer / Wait
  For Settle / Match Time Limit / Power-Ups / Chaos Mode / Best of 3 on or
  off. You get a short room code.
- **Join Room** — enter a 4-character code to join a friend's room.

Sharing a room is also as simple as sending a link: joining or creating a
room updates the address bar to `?room=CODE`, and opening that link
auto-joins the same room.

**Lobby = the table itself.** Once you're in a room, the game table doubles
as the lobby. Each player's pen appears in a default starting spot; drag
your own pen anywhere on the table to choose where you'll start. The server
validates every placement — it must stay fully on the table and can't
overlap another player's pen — and always confirms back, so if a spot is
rejected your pen snaps back to its last valid position.

**Auto-start.** As soon as every seat in the room is filled, there's a short
pause, then a 3-2-1 countdown, then the match begins automatically — no
"ready" button to click.

**Real pen-fight rules.** There are no walls around the table. A pen that
slides completely off the table edge eliminates that player. Turn order
automatically skips eliminated players. Last pen left on the table wins; if
the last two pens go out on the same turn, it's a draw.

**Restart.** After a match ends, restarting sends everyone back to the
lobby to reposition — not an instant replay — and the same auto-countdown
kicks in again once the room fills.

## Making it more fun

A few optional extras, all off by default except the sound/particle "juice"
below (which is always on):

**Juice.** Every collision, elimination, countdown beep, and win/draw plays
a small synthesized sound effect (no audio files — generated on the fly
with the Web Audio API) plus a particle burst and a fading trail behind
fast-moving pens. This applies to every mode, online or local.

**Power-Ups** (room toggle, also available in Classroom/Vs Computer from
their setup screens). Every so often a pickup appears on the table, one of
three: a yellow **Speed Boost** (⚡) that supercharges whoever's pen
touches it for their very next shot; a teal **Helicopter Shot** (🚁) that
sends their next shot into a hard spin with a much harder bounce for a
short window after it's taken; or a dark **Ink Puddle** that slows down
any pen currently sitting in it until it fades away on its own. A floating
callout ("SPEED BOOST!" / "HELICOPTER SHOT!") marks the pickup, and a
charged pen keeps a pulsing ⚡/🚁 glow until that shot is actually taken,
so it's always clear who's charged up. Pickup detection checks the pen's
actual capsule shape (its full 145px length), not just its center point —
a shot that visibly sweeps across a pickup reliably collects it. In online
rooms the server decides spawns/pickups authoritatively, same as
everything else (including broadcasting each player's charged-but-not-yet-
fired state and, per pen, whether it's *currently* mid-spin from a
Helicopter Shot, so both glow and spin show up for every connected
client, not just the player who picked it up).

**Chaos Mode** (room toggle). Ports single-player's simultaneous free-for-all
to multiplayer: no turn order at all, every alive player can flick their own
pen whenever they want, and the match runs on a fixed whole-match countdown
instead of ending when someone runs out of turns.

**Best of 3** (room toggle). The room plays a short series instead of a
single match — the score carries across restarts until someone wins 2, then
the next restart starts a brand new series.

**Win streak.** A small per-browser streak counter (💾 stored locally, not
by the server) shown in the multiplayer HUD and updated after every match —
purely a personal bragging-rights stat.

**Post-match stats.** The end-of-match screen shows how many shots you took
and how long the match lasted, plus the running series score when Best of 3
is on.

**Feels more responsive.** The connection already disables Nagle's
algorithm (`socket.setNoDelay(true)` in `ws-lite.mjs`) so outgoing
messages go straight out with no artificial buffering delay. On top of
that, the moment you release a shot, your own pen starts moving on your
screen immediately — a short client-side prediction (see
`NetPen.predictShot()`/`updatePrediction()` in `js/net/NetPen.js`) bridges
the round trip to the server rather than leaving the pen frozen until the
next authoritative update arrives. It's purely visual and self-corrects
against the server's real position within a fraction of a second either
way, so it can't drift out of sync.

## Why no dependencies

I built this in a sandboxed environment with no access to the npm registry,
so I wrote a small dependency-free WebSocket server and a purpose-built 2D
physics simulation, using only what ships with Node. The physics engine
reuses your tuned constants (`PEN`, `TABLE`, `INPUT` in `js/Constants.js`)
for size/damping/friction/drag-feel, and the turn timer/settle-wait tuning
from `MATCH` in `js/GameConfig.js`.

## Running it

```bash
cd server
node server.mjs
```

Then open `http://localhost:8080` in a browser tab (or on another computer
on the same WiFi — use your machine's LAN IP instead of `localhost`, e.g.
`http://192.168.1.23:8080`). Choose Play Online from the home screen, then
quick-play, create a room, or join one by code/link. Requires Node 18+. No
`npm install`, no `package.json`, no build step. (Classroom and Vs Computer
don't need the server at all — see `README.md`.)

## Testing notes

Server-side logic (room state machine, quick-join matchmaking, position
validation, turn-skip on elimination, win/draw detection, restart-to-lobby,
collision events, power-ups, chaos mode, best-of-3) was verified end-to-end
with scripted WebSocket clients and direct-module tests against a running
`node server.mjs` process, including a smoke test confirming the unified
`index.html` is served correctly at `/`. The AI opponent's target-selection
and shot math (`js/AIController.js`) and the shared table layout
(`js/Layout.js`) were also verified directly in Node with lightweight
stubs. The client-side menu and Phaser scenes were syntax-checked and
cross-referenced by hand, but this environment has no headless browser — a
real run-through in an actual browser is worth doing once you have it open.

## Known limits (all intentional, all easy follow-ups)

- No reconnect-into-the-same-seat UI — if you refresh mid-match, you rejoin
  as a fresh connection; your old seat is freed and treated as disconnected.
- Positions snap directly from server ticks (60/sec) rather than being
  interpolated — fine on a LAN, would benefit from client-side interpolation
  over a slower/laggier connection.
- Collision/hit sound and particle intensity is calibrated from the physics
  math rather than tuned by ear (no way to play-test audio in this
  environment) — `JUICE` in `js/Constants.js` is the one place to retune it
  if hits feel too loud/quiet.
- Only one power-up is ever active on the table at a time.
- Spectator-only UI polish and matchmaking by skill/region are natural next
  steps but out of scope for this pass.
