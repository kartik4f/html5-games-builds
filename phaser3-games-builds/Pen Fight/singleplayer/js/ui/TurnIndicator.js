//==================================================
// TurnIndicator.js
//==================================================

export default class TurnIndicator {
  constructor(scene) {
    this.scene = scene;

    //------------------------------------------
    // Container
    //------------------------------------------

    this.container = scene.add.container(scene.scale.width * 0.5, 100);

    this.container.setDepth(1000);
    this.container.setAlpha(0);

    //------------------------------------------
    // Background
    //------------------------------------------

    this.background = scene.add.graphics();

    this.background.fillStyle(0x000000, 0.55);

    this.background.fillRoundedRect(-140, -25, 280, 50, 12);

    //------------------------------------------
    // Text
    //------------------------------------------

    this.text = scene.add.text(0, 0, '', {
      fontFamily: 'Arial',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#ffffff',
    });

    this.text.setOrigin(0.5);

    //------------------------------------------

    this.container.add([this.background, this.text]);
  }

  //--------------------------------------------------
  // Show
  //--------------------------------------------------

  show(playerId) {
    this.scene.tweens.killTweensOf(this.container);

    this.text.setText(`Player ${playerId + 1}'s Turn`);

    this.container.y = 70;
    this.container.alpha = 0;

    this.scene.tweens.add({
      targets: this.container,

      alpha: 1,

      y: 100,

      duration: 250,

      ease: 'Back.Out',

      onComplete: () => {
        this.scene.time.delayedCall(1000, () => this.hide());
      },
    });
  }

  //--------------------------------------------------
  // Hide
  //--------------------------------------------------

  hide() {
    this.scene.tweens.add({
      targets: this.container,

      alpha: 0,

      y: 70,

      duration: 250,

      ease: 'Sine.In',
    });
  }

  //--------------------------------------------------
  // Destroy
  //--------------------------------------------------

  destroy() {
    this.container.destroy(true);
  }
}
