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
