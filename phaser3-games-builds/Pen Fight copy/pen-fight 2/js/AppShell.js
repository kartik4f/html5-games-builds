//==================================================
// AppShell.js
//==================================================
// A tiny hook so any Phaser scene (GameScene, NetGameScene) can ask
// to leave the game and go back to the unified home screen, without
// needing to know how that screen is built. js/main.js — the one
// place that owns the DOM overlay and the single Phaser.Game instance
// — registers the actual implementation once at startup via
// setReturnHome(); everything else just calls returnHome().
//==================================================

let implementation = null;

export function setReturnHome(fn) {
  implementation = fn;
}

export function returnHome() {
  if (implementation) implementation();
}
