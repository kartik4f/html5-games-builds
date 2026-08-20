//==================================================
// main.js
//==================================================
// The single entry point for the whole game. Boots one Phaser.Game
// with DOM Element support enabled and three scenes:
//
//   MenuScene              -> the start screen (Home -> Classroom /
//                              Vs Computer / Online), built out of
//                              Phaser DOM Elements — see MenuScene.js.
//                              Auto-started; the only scene running
//                              at boot.
//   GameScene               -> Classroom / Vs Computer (local Planck
//                              physics; Vs Computer additionally
//                              enables AIController for some pens)
//   NetGameScene             -> Play Online (server-authoritative,
//                              WebSocket, no client physics)
//
// GameScene/NetGameScene are registered up front but NOT auto-started;
// MenuScene explicitly stops itself and starts whichever one the
// player picked. Returning to Home (AppShell's returnHome) just starts
// MenuScene again — Phaser tears down whatever scene was running
// (including its DOM Elements) as part of that, so there's nothing
// else to clean up by hand.
//==================================================

import { GAME } from './Constants.js';
import MenuScene from './MenuScene.js';
import GameScene from './GameScene.js';
import NetGameScene from './net/NetGameScene.js';
import { setReturnHome } from './AppShell.js';
import audioFX from './AudioFX.js';

const game = new Phaser.Game({
  type: Phaser.AUTO,

  parent: 'game',

  width: GAME.WIDTH,
  height: GAME.HEIGHT,

  backgroundColor: GAME.BACKGROUND,

  // Lets scenes use this.add.dom(...) — Phaser creates and manages a
  // DOM container div layered over the canvas, scaled/positioned to
  // match it via the Scale Manager below (same letterboxing behavior
  // as the canvas itself, on any device/orientation).
  dom: {
    createContainer: true,
  },

  scene: [MenuScene],

  scale: {
    parent: 'game',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,

    width: GAME.WIDTH,
    height: GAME.HEIGHT,
  },

  fps: {
    target: GAME.FPS,
    forceSetTimeOut: true,
  },
});

game.scene.add('GameScene', GameScene, false);
game.scene.add('NetGameScene', NetGameScene, false);

//--------------------------------------------------
// Return to Home (called by GameScene's "Main Menu" and
// NetGameScene's "Home" button via AppShell.returnHome())
//--------------------------------------------------

setReturnHome(() => {
  game.scene.start('MenuScene');
});

//--------------------------------------------------
// Unlock the shared Web Audio context (see AudioFX.js) on the very
// first real user gesture anywhere on the page.
//
// Every individual playX() call (playCollision(), playWin(), etc.)
// already calls AudioFX's own ensure()/resume() itself, but by the
// time the *first* one actually fires — a physics collision landing a
// tick after a shot, a 'win'/'cheer' message arriving from the
// server, a delayed countdown beep — that call happens well outside
// the click/tap handler that indirectly led to it. Browsers with a
// strict autoplay policy (Safari/iOS in particular, and Chrome's own)
// only count an AudioContext as "resumed by a user gesture" if
// resume() runs synchronously inside a trusted gesture event itself;
// calling it later from an unrelated async callback is silently
// ignored, leaving the context stuck 'suspended' — and every sound a
// silent no-op — for the rest of the session.
//
// Binding directly to the raw pointerdown/keydown event here, before
// any scene-specific handler runs, is what actually satisfies that
// requirement — the very first tap/keypress on the page (e.g. the
// menu's own "Play" button) creates and resumes the context while
// still inside a real gesture, so every later playX() call just finds
// it already running.
//--------------------------------------------------

function unlockAudioOnce() {
  // resume() already calls ensure() itself (see AudioFX.js) — this is
  // the only call actually needed here.
  audioFX.resume();

  document.removeEventListener('pointerdown', unlockAudioOnce);
  document.removeEventListener('keydown', unlockAudioOnce);
}

document.addEventListener('pointerdown', unlockAudioOnce);
document.addEventListener('keydown', unlockAudioOnce);
