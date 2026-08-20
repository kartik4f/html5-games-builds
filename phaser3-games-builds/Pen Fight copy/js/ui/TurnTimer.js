//==================================================
// TurnTimer.js
//==================================================
// A depleting bar (like a health bar) instead of just a number, so the
// turn running out reads at a glance. Built as a Phaser DOM Element
// (real HTML/CSS) — see .hud-timer-* classes in index.html — instead
// of hand-drawn Graphics, so it's crisp text at any scale and shares
// styling with the rest of the DOM-based HUD.
//
// Show/hide toggles display on the *content* div (this.el), not on
// this.dom.node — Phaser keeps forcing its own node back to
// display:block every update, so a node-level display:none would get
// silently fought and never stick. createFromHTML() + node.children[0]
// sidesteps that (see WinPopup.js for the same pattern, explained in
// more detail there).
//==================================================

export default class TurnTimer {
  // x, y: the bar's exact top-left corner (setOrigin(0,0) — see
  // WinPopup.js's file header for why). Reused by both GameScene
  // (position from BottomDock.js) and NetGameScene (its own bottom
  // placement), so this class itself stays layout-agnostic.
  constructor(scene, x, y) {
    this.scene = scene;

    this.maxMilliseconds = 1;

    const html = `<div class="hud-timer-track">
      <div class="hud-timer-fill"></div>
      <div class="hud-timer-label">5</div>
    </div>`;

    this.dom = scene.add
      .dom(x, y)
      .createFromHTML(html)
      .setOrigin(0, 0);
    this.dom.setDepth(1000);

    const el = this.dom.node.children[0];

    this.el = el;
    this.fill = el.querySelector('.hud-timer-fill');
    this.label = el.querySelector('.hud-timer-label');

    this.hide();
  }

  //--------------------------------------------------
  // Set Time
  //--------------------------------------------------

  setTime(milliseconds, maxMilliseconds) {
    if (maxMilliseconds) this.maxMilliseconds = maxMilliseconds;

    const seconds = Math.max(0, milliseconds / 1000);

    this.label.textContent = seconds.toFixed(0);

    //----------------------------------
    // Bar fill
    //----------------------------------

    const ratio = Math.max(0, Math.min(1, milliseconds / this.maxMilliseconds));

    let color = '#3f8556';

    if (ratio <= 0.2) {
      color = '#d1495b';
    } else if (ratio <= 0.5) {
      color = '#e8b93f';
    }

    this.fill.style.width = `${ratio * 100}%`;
    this.fill.style.backgroundColor = color;

    //----------------------------------
    // Urgency pulse
    //----------------------------------

    // Written to this.el.style.transform (the content div, i.e.
    // this.dom.node.children[0]) rather than via this.dom.setScale() —
    // the dom Element itself is setOrigin(0,0) now (see the WIDTH/
    // HEIGHT comment above), so scaling it directly would grow the bar
    // from its top-left corner instead of its center. Scaling this.el
    // instead, with its own transform-origin:center, keeps the pulse
    // centered regardless of the outer element's anchor, and — since
    // Phaser only ever touches this.dom.node (the wrapper), never
    // node.children[0] — nothing fights this assignment away.
    if (ratio <= 0.2) {
      const pulse = 1 + Math.sin(this.scene.time.now * 0.02) * 0.06;

      this.el.style.transformOrigin = 'center';
      this.el.style.transform = `scale(${pulse})`;
    } else {
      this.el.style.transform = 'none';
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
