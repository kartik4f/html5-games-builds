# Pen Fight

A school-desk pen-flicking game. Open `index.html` and pick one of three
ways to play — everything now lives behind a single start screen.

## Three ways to play

- **Play Online** — real multiplayer over the internet: quick-play
  matchmaking, or create/join a room by a short code or shareable link.
  Server-authoritative (see `MULTIPLAYER_README.md` for how that works).
- **Play in Classroom** — local hotseat, 2-4 players passing the same
  device around the table.
- **Play against Computer** — you vs 1-3 computer opponents on the same
  device, with Easy / Medium / Hard difficulty.

All three share the same table, physics feel, real pen-fight elimination
rules (no walls — slide off the table and you're out), and the optional
extras below. Turn-based or Chaos (simultaneous free-for-all) mode is
available in every mode except Play Online's quick-play (which is always
turn-based; Chaos is a toggle when you create a room there).

**Portrait, on any device.** The whole game — menus and table alike —
runs in a portrait-oriented canvas (see `GAME`/`TABLE` in
`js/Constants.js`) that's scaled and letterboxed to fit whatever screen
it's opened on via Phaser's `Scale.FIT`, so it looks right whether that
screen is a phone held upright, a tablet, or a widescreen desktop window.

**One UI system, built on Phaser DOM.** The start screen and every
in-game HUD element (turn/status text, timers, the win/game-over
popups) are all real HTML/CSS, added as Phaser DOM Elements
(`this.add.dom(...)`, see `js/MenuScene.js` and `js/ui/*.js`) rather
than a separate overlay bolted on next to the canvas. That means the
whole UI scales, letterboxes, and re-centers together with the game
automatically — one coordinate system and one scaling story for
everything on screen.

## Making it fun

- **Juice** — synthesized hit/eliminate/win sounds (no audio files),
  particle bursts, and speed trails. Always on.
- **Power-Ups** — an optional Speed Boost (⚡, supercharges your next shot —
  the pen glows and pulses with a ⚡ icon until that shot is taken) or Ink
  Puddle (slows anyone standing in it) pickup appears on the table now and
  then. Toggle per match/room.
- **Computer opponents** — Easy/Medium/Hard AI with its own aim, reaction
  time, and power tuned per difficulty (see `js/AIController.js`).
- **Best of 3** (online rooms) — play a short series instead of one match.
- **Win streak** — a small per-browser streak counter shown in online play.

## Running it

```bash
cd server
node server.mjs
```

Then open `http://localhost:8080` (works fully offline for Classroom and
Vs Computer — the server is only needed for Play Online, but starting it
is harmless either way and it's what serves the page). No `npm install`,
no `package.json`, no build step — see `MULTIPLAYER_README.md` for why.

Alternatively, for Classroom or Vs Computer only, you can skip the server
entirely and just open `index.html` directly in a browser — Play Online
just won't be able to connect anywhere without the server running.

## What's where

```
index.html          <- shell + all CSS (menu + in-game HUD styling)
menu.html            <- the start screen's markup (loaded into MenuScene via this.load.html())
js/main.js           <- boots the one Phaser.Game (dom.createContainer enabled) + its 3 scenes

js/MenuScene.js      <- the start screen, as a Phaser DOM Element (see menu.html)
js/GameScene.js      <- local match (Classroom + Vs Computer), Planck physics
js/ui/               <- in-game HUD pieces, also Phaser DOM Elements
  TurnTimer.js, MatchTimer.js, TurnIndicator.js, WinPopup.js,
  PlayerStatusRow.js, BottomDock.js (GameScene's bottom HUD layout)
js/AIController.js   <- the computer opponent(s)
js/Layout.js          shared N-player table layout (2-4 pens)
js/PenManager.js / Pen.js / Physics.js / InputController.js / GameRules.js
js/PowerUps.js       <- Speed Boost / Ink Puddle (Classroom + Vs Computer)
js/AudioFX.js        <- synthesized sound effects (Web Audio API)
js/JuiceFX.js        <- particle bursts / trails / floating pickup text
js/AppShell.js       <- lets any scene ask to return to the Home screen

js/net/              <- online play: thin client, no physics (server-authoritative)
  NetGameScene.js, NetPen.js, connection.js, WinStreak.js

server/              <- plain Node scripts, zero dependencies (see MULTIPLAYER_README.md)
```

For the full detail on how online multiplayer works (rooms, lobby
positioning, the physics/collision protocol, testing notes), see
`MULTIPLAYER_README.md`.
