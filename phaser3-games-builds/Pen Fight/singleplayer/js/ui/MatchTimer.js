//==================================================
// MatchTimer.js
//==================================================
// Whole-match countdown (chaos: always on; turn-based: optional via
// GameConfig.USE_MATCH_TIME_LIMIT). Kept visually distinct from
// TurnTimer since both can be on screen at once in turn-based mode.
//==================================================

import { THEME } from '../Theme.js';

export default class MatchTimer {
  constructor(scene) {
    this.scene = scene;

    //------------------------------------------
    // Container
    //------------------------------------------

    this.container = scene.add.container(scene.scale.width - 90, 50);

    this.container.setDepth(1000);

    //------------------------------------------
    // Background — a tiny chalkboard badge
    //------------------------------------------

    this.background = scene.add.graphics();

    this.background.fillStyle(THEME.CHALKBOARD, 0.95);

    this.background.fillRoundedRect(-70, -34, 140, 68, 12);

    this.background.lineStyle(3, THEME.CHALKBOARD_FRAME, 1);

    this.background.strokeRoundedRect(-70, -34, 140, 68, 12);

    //------------------------------------------
    // Label
    //------------------------------------------

    this.label = scene.add.text(0, -16, 'MATCH', {
      fontFamily: THEME.FONT_BODY,
      fontSize: '15px',
      color: '#cfe8d8',
    });

    this.label.setOrigin(0.5);

    //------------------------------------------
    // Text
    //------------------------------------------

    this.text = scene.add.text(0, 12, '0:60', {
      fontFamily: THEME.FONT_HEADING,
      fontSize: '26px',
      color: '#f5f0e6',
    });

    this.text.setOrigin(0.5);

    //------------------------------------------

    this.container.add([this.background, this.label, this.text]);

    this.hide();
  }

  //--------------------------------------------------
  // Set Time
  //--------------------------------------------------

  setTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    this.text.setText(`${minutes}:${seconds.toString().padStart(2, '0')}`);

    //----------------------------------
    // Color
    //----------------------------------

    if (totalSeconds > 10) {
      this.text.setColor('#f5f0e6');
    } else if (totalSeconds > 5) {
      this.text.setColor('#f6d989');
    } else {
      this.text.setColor('#f28b8b');
    }
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
