# Pen Fight — Multiplayer (Phase 2)

This adds a real 2-player online mode on top of the existing single-player
game, following the server-authoritative approach recommended in `inifo.txt`:
the server owns physics and turn order; browsers only render and send input.

**Scope of this pass** (matches `inifo.txt` Phase 2 on purpose): two players,
same pens, turns, synced physics, wait-until-settled. No elimination, score,
or win/draw popup yet — that's Phase 4 in your own roadmap, and layering it
on top of this is now mechanical (the server already tracks pen positions
every tick, elimination just needs an out-of-bounds check + a `game-over`
broadcast).

## What's new

```
server/            <- plain Node scripts, no package.json, nothing to install
  server.mjs         entry point: serves the game files + the /ws endpoint
  ws-lite.mjs         hand-rolled WebSocket server (no `ws` package needed)
  PhysicsEngine.mjs   self-contained 2D physics for exactly 2 pens
  TurnManager.mjs     whose turn / can-act / wait-for-settle
  Room.mjs            ties it together: 1 match, 2 seats, broadcasts state

multiplayer.html   <- new entry page for online play
js/net/             <- thin client: render + input only, no physics
  NetGameScene.js
  NetPen.js
  main-multiplayer.js
```

Your original single-player game (`index.html`) is untouched and still works
exactly as before — multiplayer is a fully separate mode.

This still isn't an npm project — there's no `package.json` anywhere and
nothing to `npm install`. The server files use a `.mjs` extension, which is
what tells Node "these are ES modules" without needing a `package.json` to
declare it. Just plain scripts, run directly with `node`.

## Why no dependencies

I built this in a sandboxed environment with no access to the npm registry,
so I couldn't install (or test) `planck` or `ws` even if I wanted to. Rather
than hand you untested code, I wrote a small dependency-free WebSocket
server and a purpose-built 2D physics simulation for the two pens, using
only what ships with Node. I fully tested this version end-to-end
(handshake, turn enforcement, physics, settle-timeout, disconnect/reconnect)
using scripted WebSocket clients. Net effect: nothing to install, `node
server.mjs` just works.

The physics engine reuses your tuned constants (`PEN`, `TABLE`, `INPUT` in
`js/Constants.js`) for size/damping/friction/restitution/drag-feel, and the
turn timer/settle-wait tuning from `MATCH` in `js/GameConfig.js` — so the
gameplay tuning knobs you already have still apply. The physics _engine_
itself isn't Planck, so it won't feel byte-identical to single-player, but
it uses the same collision-response math (impulse + rotation) any 2D physics
engine would.

## Running it

```bash
cd server
node server.mjs
```

Then open `http://localhost:8080` in two browser tabs (or on two computers
on the same WiFi — use your machine's LAN IP instead of `localhost`, e.g.
`http://192.168.1.23:8080`). First tab to load becomes Player 1, second
becomes Player 2. A third tab just spectates.

No `npm install`, no `package.json`, no build step — just the one `node`
command. Requires Node 18+.

## Known limits (all intentional, all easy follow-ups)

- No elimination / win condition yet — pens just bounce forever.
- No reconnect UI — if you refresh, you rejoin as a fresh connection into
  whichever seat is open (game state is preserved, you just re-enter).
- One room only — everyone who opens the page joins the same match. Adding
  room codes (`?room=abc123`) is a small change to `server.mjs`/`Room.mjs`
  when you're ready to support multiple simultaneous matches.
- Positions snap directly from server ticks (60/sec) rather than being
  interpolated — fine on a LAN, would benefit from client-side interpolation
  over a slower/laggier connection.
