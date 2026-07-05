//==================================================
// main.js
//==================================================

import { GAME } from './Constants.js';
import GameScene from './GameScene.js';

const config = {
  type: Phaser.AUTO,

  parent: 'game',

  width: GAME.WIDTH,

  height: GAME.HEIGHT,

  backgroundColor: GAME.BACKGROUND,

  scene: [GameScene],

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
  new Phaser.Game(config);
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
