//==================================================
// main.js
//==================================================

import { GAME } from './Constants.js';
import MenuScene from './MenuScene.js';
import GameScene from './GameScene.js';

const config = {
  type: Phaser.AUTO,

  parent: 'game',

  width: GAME.WIDTH,

  height: GAME.HEIGHT,

  backgroundColor: GAME.BACKGROUND,

  scene: [MenuScene, GameScene],

  scale: {
    parent: 'game',
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,

    width: GAME.WIDTH,

    height: GAME.HEIGHT,
    // parent: 'game',
  },

  fps: {
    target: GAME.FPS,

    forceSetTimeOut: true,
  },
};

window.addEventListener('load', () => {
  // Phaser renders text onto canvas, so if a webfont finishes loading
  // after a Text object is created, it won't automatically re-render
  // with the new font. Wait for fonts to be ready first to avoid a
  // fallback-font flash on the title screen.
  const ready = document.fonts ? document.fonts.ready : Promise.resolve();

  ready.then(() => {
    new Phaser.Game(config);
  });
});

/* At this point, we have a clean architecture
index.html
        │
        ▼
main.js
        │
        ▼
GameScene
        │
 ┌──────┼────────┬────────────┐
 ▼      ▼        ▼            ▼
Physics PenMgr InputCtrl DebugRenderer
        │
        ▼
       Pen
        │
        ▼
    Planck Body */
