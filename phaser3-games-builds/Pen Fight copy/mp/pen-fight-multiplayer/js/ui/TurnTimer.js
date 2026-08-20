//==================================================
// TurnTimer.js
//==================================================
// A depleting bar (like a health bar) instead of just a number, so the
// turn running out reads at a glance.
//==================================================

import { THEME } from '../Theme.js';

const BAR_WIDTH = 460;
const BAR_HEIGHT = 26;
const BAR_PADDING = 4;

export default class TurnTimer {
  constructor(scene) {
    this.scene = scene;

    this.maxMilliseconds = 1;

    //------------------------------------------
    // Container
    //------------------------------------------

    this.container = scene.add.container(scene.scale.width * 0.5, 694);

    this.container.setDepth(1000);

    //------------------------------------------
    // Track (wooden frame around the bar)
    //------------------------------------------

    this.track = scene.add.graphics();

    this.track.fillStyle(THEME.WOOD_BROWN_DARK, 0);

    this.track.fillRoundedRect(
      -BAR_WIDTH / 2 - BAR_PADDING,
      -BAR_HEIGHT / 2 - BAR_PADDING,
      BAR_WIDTH + BAR_PADDING * 2,
      BAR_HEIGHT + BAR_PADDING * 2,
      14,
    );

    this.track.lineStyle(3, THEME.WOOD_BROWN_DARK, 0.9);

    this.track.strokeRoundedRect(
      -BAR_WIDTH / 2 - BAR_PADDING,
      -BAR_HEIGHT / 2 - BAR_PADDING,
      BAR_WIDTH + BAR_PADDING * 2,
      BAR_HEIGHT + BAR_PADDING * 2,
      14,
    );

    //------------------------------------------
    // Fill (redrawn every setTime() call, shrinks from full to empty)
    //------------------------------------------

    this.fill = scene.add.graphics();

    //------------------------------------------
    // Text (seconds left, overlaid on the bar)
    //------------------------------------------

    this.text = scene.add.text(0, 0, '5.0', {
      fontFamily: THEME.FONT_HEADING,
      fontSize: '18px',
      color: THEME.TEXT_INK,
      stroke: '#f5f0e6',
      strokeThickness: 3,
    });

    this.text.setOrigin(0.5);

    //------------------------------------------

    this.container.add([this.track, this.fill, this.text]);

    this.hide();
  }

  //--------------------------------------------------
  // Set Time
  //--------------------------------------------------

  setTime(milliseconds, maxMilliseconds) {
    if (maxMilliseconds) this.maxMilliseconds = maxMilliseconds;

    const seconds = Math.max(0, milliseconds / 1000);

    this.text.setText(seconds.toFixed(0));

    //----------------------------------
    // Bar fill
    //----------------------------------

    const ratio = Phaser.Math.Clamp(milliseconds / this.maxMilliseconds, 0, 1);

    let color = THEME.CHALK_GREEN;

    if (ratio <= 0.2) {
      color = 0xd1495b;
    } else if (ratio <= 0.5) {
      color = THEME.PENCIL_YELLOW;
    }

    const width = BAR_WIDTH * ratio;

    this.fill.clear();

    if (width > 1) {
      this.fill.fillStyle(color, 1);

      this.fill.fillRoundedRect(
        -BAR_WIDTH / 2,
        -BAR_HEIGHT / 2,
        width,
        BAR_HEIGHT,
        Math.min(8, width / 2),
      );
    }

    //----------------------------------
    // Urgency pulse
    //----------------------------------

    if (ratio <= 0.2) {
      const pulse = 1 + Math.sin(this.scene.time.now * 0.02) * 0.06;

      this.container.setScale(pulse);
    } else {
      this.container.setScale(1);
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
