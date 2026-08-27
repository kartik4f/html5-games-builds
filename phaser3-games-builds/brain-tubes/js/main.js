import BootScene from './BootScene.js';
import MenuScene from './MenuScene.js';
import GameScene from './GameScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game-root',
  width: 1920,
  height: 1080,
  backgroundColor: '#fff7ed',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1920,
    height: 1080,
    fullscreenTarget: 'game-root',
  },
  render: { antialias: true, roundPixels: true },
  input: { activePointers: 3 },
  scene: [BootScene, MenuScene, GameScene],
};

new Phaser.Game(config);
