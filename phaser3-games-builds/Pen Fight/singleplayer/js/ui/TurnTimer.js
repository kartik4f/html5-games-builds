//==================================================
// TurnTimer.js
//==================================================

export default class TurnTimer {
  constructor(scene) {
    this.scene = scene;

    //------------------------------------------
    // Container
    //------------------------------------------

    this.container = scene.add.container(scene.scale.width * 0.5, 45);

    this.container.setDepth(1000);

    //------------------------------------------
    // Background
    //------------------------------------------

    this.background = scene.add.graphics();

    this.background.fillStyle(0x000000, 0.45);

    this.background.fillRoundedRect(-60, -22, 120, 44, 12);

    //------------------------------------------
    // Text
    //------------------------------------------

    this.text = scene.add.text(0, 0, '5.0', {
      fontFamily: 'Arial',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#00ff00',
    });

    this.text.setOrigin(0.5);

    //------------------------------------------

    this.container.add([this.background, this.text]);

    this.hide();
  }

  //--------------------------------------------------
  // Set Time
  //--------------------------------------------------

  setTime(milliseconds) {
    const seconds = Math.max(0, milliseconds / 1000);

    this.text.setText(seconds.toFixed(1));

    //----------------------------------
    // Color
    //----------------------------------

    if (seconds > 3) {
      this.text.setColor('#00ff00');

      this.text.setScale(1);

      return;
    }

    if (seconds > 1) {
      this.text.setColor('#ffff00');

      this.text.setScale(1);

      return;
    }

    this.text.setColor('#ff4040');

    const pulse = 1 + Math.sin(this.scene.time.now * 0.02) * 0.15;

    this.text.setScale(pulse);
  }

  //--------------------------------------------------
  // Show
  //--------------------------------------------------

  show() {
    this.container.setVisible(true);
  }

  //--------------------------------------------------
  // Hide
  //--------------------------------------------------

  hide() {
    this.container.setVisible(false);
  }

  //--------------------------------------------------
  // Destroy
  //--------------------------------------------------

  destroy() {
    this.container.destroy(true);
  }
}
