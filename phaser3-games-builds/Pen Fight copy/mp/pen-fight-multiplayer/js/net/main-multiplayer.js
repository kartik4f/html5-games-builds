//==================================================
// main-multiplayer.js
//==================================================

import { GAME } from '../Constants.js';
import NetGameScene from './NetGameScene.js';

const config = {
  type: Phaser.AUTO,

  parent: 'game',

  width: GAME.WIDTH,
  height: GAME.HEIGHT,

  backgroundColor: GAME.BACKGROUND,

  scene: [NetGameScene],

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
};

window.addEventListener('load', () => {
  const ready = document.fonts ? document.fonts.ready : Promise.resolve();

  ready.then(() => {
    new Phaser.Game(config);
  });
});
