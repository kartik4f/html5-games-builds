# Brain Tubes — Procedural Phaser 3 Prototype

A fullscreen, responsive Phaser 3 puzzle prototype with five educational modes and ten runtime-generated levels per mode.

## Run

Because the project uses ES modules, serve the folder through a local HTTP server. No npm install is required.

Examples:

```bash
cd brain-tubes
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

## Architecture

- `main.js` — Phaser bootstrap and 1920×1080 FIT scaling.
- `BootScene.js` — boot scene.
- `MenuScene.js` — mode selection and fullscreen entry.
- `GameScene.js` — generic tube puzzle engine.
- `Tube.js` / `Item.js` — reusable gameplay objects.
- `Difficulty.js` — level 1–10 difficulty curve.
- `LevelGenerator.js` — solved-state construction + legal scrambling.
- `generators/*.js` — educational content generation by mode.

## Procedural guarantee

A level starts from a solved arrangement. The generator then performs legal top-item transfers into available tube space. Therefore the resulting puzzle has a known solution: reverse the generated moves.

The generator also rejects a trivial solved output when it can perform another legal shuffle.

## Current prototype rules

- Drag only the top item of a tube.
- A move is legal when the destination has capacity.
- A tube is considered solved when every item inside matches that tube's category.
- Empty tubes are allowed as working space.
- Each replay regenerates the puzzle.

## Adding classes later

The engine does not depend on the educational content. New class packs can be added as generator/content modules while keeping `GameScene`, `Tube`, `Item`, and the difficulty system unchanged.
