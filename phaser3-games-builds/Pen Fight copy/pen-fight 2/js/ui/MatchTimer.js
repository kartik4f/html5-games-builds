//==================================================
// MatchTimer.js
//==================================================
// Whole-match countdown (chaos: always on; turn-based: optional via
// GameConfig.USE_MATCH_TIME_LIMIT). Kept visually distinct from
// TurnTimer since both can be on screen at once in turn-based mode.
// Built as a Phaser DOM Element — see .hud-badge in index.html.
//
// Show/hide toggles display on the *content* span (this.el), not on
// this.dom.node — see WinPopup.js's file header for why (Phaser keeps
// forcing its own node back to display:block, so createFromHTML() +
// node.children[0] is used to get past that).
//==================================================

import { bottomDockLayout } from './BottomDock.js';

export default class MatchTimer {
  constructor(scene) {
    this.scene = scene;

    const html = `<div class="hud-badge">
      <span class="label">⏱</span>
      <span class="value">0:60</span>
    </div>`;

    // Position/size come from BottomDock.js — sits right next to the
    // turn timer bar, same row (see its file header for the layout).
    const { matchBadge } = bottomDockLayout(scene);

    this.dom = scene.add
      .dom(matchBadge.x, matchBadge.y)
      .createFromHTML(html)
      .setOrigin(0, 0);
    this.dom.setDepth(1000);

    const el = this.dom.node.children[0];

    this.el = el;
    this.value = el.querySelector('.value');

    this.hide();
  }

  //--------------------------------------------------
  // Set Time
  //--------------------------------------------------

  setTime(milliseconds) {
    const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    this.value.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    //----------------------------------
    // Color
    //----------------------------------

    if (totalSeconds > 10) {
      this.value.style.color = '#f5f0e6';
    } else if (totalSeconds > 5) {
      this.value.style.color = '#f6d989';
    } else {
      this.value.style.color = '#f28b8b';
    }
  }

  //--------------------------------------------------
  // Show
  //--------------------------------------------------

  show() {
    this.el.style.display = 'block';
  }

  //--------------------------------------------------
  // Hide
  //--------------------------------------------------

  hide() {
    this.el.style.display = 'none';
  }

  //--------------------------------------------------
  // Destroy
  //--------------------------------------------------

  destroy() {
    this.dom.destroy();
  }
}
