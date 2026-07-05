import LobbyScene    from './scenes/LobbyScene.js';
import GameScene     from './scenes/GameScene.js';
import GameOverScene from './scenes/GameOverScene.js';

/**
 * Phaser game configuration.
 * `dom.createContainer: true` is required for the HTML input elements
 * used in LobbyScene.
 */
const config = {
  type:            Phaser.AUTO,
  width:           800,
  height:          560,
  backgroundColor: '#1a1a2e',
  parent:          document.body,
  dom:             { createContainer: true },
  scene:           [LobbyScene, GameScene, GameOverScene],
};

new Phaser.Game(config);
