//==================================================
// TurnIndicator.js
//==================================================
// The transient "Player N's Turn" card that fades/slides in for a
// second at the start of each turn. Built as a Phaser DOM Element —
// see .hud-turn-indicator in index.html — with the fade/slide done via
// a real CSS transition (toggled by the .show class) instead of a
// Phaser tween.
//
// Uses createFromHTML() + node.children[0] (not a direct-element
// add.dom(x,y,el)) even though it never toggles `display` — Phaser
// forces its *own* inline style (display, transform, opacity, etc.)
// onto whatever element is passed directly, every render frame, which
// would silently override this file's CSS transition/transform too.
// Routing through node.children[0] keeps Phaser's hands off the actual
// content element, the same reasoning as WinPopup.js's file header.
//==================================================

// .hud-turn-indicator's fixed CSS size — see TurnTimer.js's WIDTH/
// HEIGHT comment for why setOrigin(0,0) + an explicit top-left
// position is used instead of the default center origin.
const WIDTH = 400;
const HEIGHT = 60;

export default class TurnIndicator {
  constructor(scene) {
    this.scene = scene;
    this.hideTimer = null;

    const html = `<div class="hud-turn-indicator"></div>`;

    const centerX = scene.scale.width * 0.5;
    const centerY = 100;

    this.dom = scene.add
      .dom(centerX - WIDTH / 2, centerY - HEIGHT / 2)
      .createFromHTML(html)
      .setOrigin(0, 0);
    this.dom.setDepth(1000);

    this.el = this.dom.node.children[0];
  }

  //--------------------------------------------------
  // Show
  //--------------------------------------------------

  show(playerId) {
    if (this.hideTimer) this.hideTimer.remove();

    this.el.textContent = `Player ${playerId + 1}'s Turn`;

    // Force a reflow before adding the class so the transition always
    // plays, even if show() is called again while already visible.
    this.el.classList.remove('show');
    void this.el.offsetWidth;
    this.el.classList.add('show');

    this.hideTimer = this.scene.time.delayedCall(1000, () => this.hide());
  }

  //--------------------------------------------------
  // Hide
  //--------------------------------------------------

  hide() {
    this.el.classList.remove('show');
  }

  //--------------------------------------------------
  // Destroy
  //--------------------------------------------------

  destroy() {
    if (this.hideTimer) this.hideTimer.remove();
    this.dom.destroy();
  }
}
