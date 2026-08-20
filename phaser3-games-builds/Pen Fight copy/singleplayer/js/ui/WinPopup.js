//==================================================
// WinPopup.js
//==================================================

import { THEME } from '../Theme.js';

export default class WinPopup {
  constructor(scene) {
    this.scene = scene;

    this.onPlayAgain = null;
    this.onMainMenu = null;

    //------------------------------------------
    // Root
    //------------------------------------------

    this.container = scene.add.container(
      scene.scale.width / 2,
      scene.scale.height / 2,
    );

    this.container.setDepth(10000);
    this.container.setVisible(false);
    this.container.setAlpha(0);

    //------------------------------------------
    // Dark overlay
    //------------------------------------------

    this.overlay = scene.add.rectangle(
      0,
      0,
      scene.scale.width,
      scene.scale.height,
      0x000000,
      0.6,
    );

    this.overlay.setOrigin(0.5);
    // this.overlay.setInteractive();
    // this.overlay.on('pointerdown', (pointer) => {
    //   pointer.event.stopPropagation();
    // });

    //------------------------------------------
    // Panel
    //------------------------------------------

    this.panel = scene.add.rectangle(0, 0, 420, 300, THEME.PAPER);

    this.panel.setStrokeStyle(5, THEME.WOOD_BROWN_DARK);
    // this.panel.setInteractive(true);

    //------------------------------------------
    // Title
    //------------------------------------------

    this.title = scene.add.text(0, -70, '', {
      fontSize: '40px',
      color: THEME.TEXT_INK,
      fontFamily: THEME.FONT_HEADING,
    });

    this.title.setOrigin(0.5);

    //------------------------------------------

    this.subtitle = scene.add.text(0, -20, '', {
      fontSize: '22px',
      color: THEME.TEXT_MUTED,
      fontFamily: THEME.FONT_BODY,
    });

    this.subtitle.setOrigin(0.5);

    //------------------------------------------

    this.playAgainButton = this.createButton(0, 55, 'Play Again');

    this.mainMenuButton = this.createButton(0, 120, 'Main Menu');

    //------------------------------------------

    this.container.add([
      this.overlay,
      this.panel,
      this.title,
      this.subtitle,
      this.playAgainButton,
      this.mainMenuButton,
    ]);

    //------------------------------------------
    // Button events
    //------------------------------------------

    this.playAgainButton.on('pointerup', () => {
      this.hide();

      if (this.onPlayAgain) this.onPlayAgain();
    });

    this.mainMenuButton.on('pointerup', () => {
      this.hide();

      if (this.onMainMenu) this.onMainMenu();
    });
  }

  //--------------------------------------------------
  // Button
  //--------------------------------------------------

  createButton(x, y, label) {
    const button = this.scene.add.container(x, y);

    const bg = this.scene.add.rectangle(0, 0, 220, 48, THEME.INK_BLUE);

    bg.setStrokeStyle(3, THEME.TEXT_INK);

    const text = this.scene.add.text(0, 0, label, {
      fontSize: '22px',
      color: THEME.TEXT_PAPER,
      fontFamily: THEME.FONT_BODY,
    });

    text.setOrigin(0.5);

    button.add([bg, text]);

    button.setSize(220, 48);

    button.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, 220, 48),
      Phaser.Geom.Rectangle.Contains,
    );

    button.on('pointerover', () => {
      bg.setFillStyle(THEME.INK_BLUE_DARK);
    });

    button.on('pointerout', () => {
      bg.setFillStyle(THEME.INK_BLUE);
    });

    // button.setInteractive(
    //   new Phaser.Geom.Rectangle(-110, -24, 220, 48),
    //   Phaser.Geom.Rectangle.Contains,
    // );
    return button;
  }

  //--------------------------------------------------
  // Show
  //--------------------------------------------------

  show(result) {
    if (result.result === 'draw') {
      this.title.setText('DRAW!');
      this.title.setColor(THEME.TEXT_INK);

      this.subtitle.setText('Nobody Wins');
    } else {
      this.title.setText(`PLAYER ${result.winner.playerId + 1} WINS!`);
      this.title.setColor('#c1272d');

      this.subtitle.setText('Congratulations!');
    }

    this.container.setVisible(true);

    this.container.setAlpha(0);

    this.container.setScale(0.8);

    this.scene.tweens.add({
      targets: this.container,

      alpha: 1,

      scale: 1,

      duration: 300,

      ease: 'Back.Out',
    });
  }

  //--------------------------------------------------
  // Hide
  //--------------------------------------------------

  hide() {
    this.container.setVisible(false);
  }
}
