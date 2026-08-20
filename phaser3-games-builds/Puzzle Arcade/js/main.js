//==================================================
// main.js
//==================================================

import { GAME } from './Constants.js';
import GameScene from './scenes/GameScene.js';

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

    // autoRound keeps the displayed canvas at a whole-pixel CSS size.
    // Without it, Phaser.Scale.FIT can land on a fractional size (e.g.
    // 699.125px), which throws off the browser's own pointer-to-canvas
    // mapping just enough that click/tap hit areas drift away from the
    // button they're drawn on — exactly the symptom reported.
    autoRound: true,

    width: GAME.WIDTH,

    height: GAME.HEIGHT,
  },

  render: {
    // Keep transforms on whole pixels too, for the same reason.
    roundPixels: true,
  },

  fps: {
    target: GAME.FPS,

    forceSetTimeOut: true,
  },
};

window.addEventListener('load', () => {
  // Phaser bakes text onto canvas at creation time, so if the webfont
  // finishes loading after a Text object is created, it won't
  // automatically re-render with the new font — wait for it first to
  // avoid a fallback-font flash across the whole UI.
  const ready = document.fonts ? document.fonts.ready : Promise.resolve();
  ready.then(() => {
    new Phaser.Game(config);
  });
});

/* Architecture:
index.html
        │
        ▼
main.js
        │
        ▼
   GameScene (UI chrome, board container, input, undo/redo, level flow)
        │
        ▼
 puzzles/{PathShift, GravityBlocks, ColorFlow, ShapePacking}
   (each owns its own state + draw/hint/win logic, extends PuzzleBase) */
