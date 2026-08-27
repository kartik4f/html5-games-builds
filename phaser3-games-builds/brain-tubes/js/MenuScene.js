import { showMenu } from './DomUI.js';
import { generateLevel } from './LevelGenerator.js';
const W = 1920,
  H = 1080;
export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }
  create() {
    this.add.rectangle(W / 2, H / 2, W, H, 0xfff3d6);
    showMenu(
      this,
      (mode) => this.start(mode),
      () => this.scale.startFullscreen(),
    );
  }
  start(mode) {
    this.selected = mode;
    const levels = Array.from({ length: 10 }, (_, index) =>
      generateLevel(mode, index + 1),
    );
    this.scene.start('GameScene', { mode, level: 1, levels });
  }
}
