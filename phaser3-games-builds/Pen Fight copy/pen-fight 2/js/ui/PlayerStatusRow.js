//==================================================
// PlayerStatusRow.js
//==================================================
// A small row of colored dots — one per pen — sitting in what used to
// be empty space at the top of GameScene (Classroom / Vs Computer).
// At a glance: which color is which player, who's still alive (a ✕
// fades in over an eliminated pen's dot), and — turn-based only —
// whose turn it is right now (a glowing ring).
//
// Built as a Phaser DOM Element via createFromHTML() + node.children[0]
// (see WinPopup.js's file header for why), setOrigin(0,0) with an
// explicit top-left position (see TurnTimer.js's constructor comment).
//==================================================

export default class PlayerStatusRow {
  constructor(scene, x, y, colors) {
    this.scene = scene;

    const dotsHtml = colors
      .map(
        (color, i) => `<div class="hud-player-dot" data-player-index="${i}" style="background:#${color.toString(16).padStart(6, '0')}">
          <span class="hud-player-dot-x">✕</span>
        </div>`,
      )
      .join('');

    this.dom = scene.add
      .dom(x, y)
      .createFromHTML(`<div class="hud-player-status">${dotsHtml}</div>`)
      .setOrigin(0, 0);
    this.dom.setDepth(1000);

    const el = this.dom.node.children[0];

    this.el = el;
    this.dots = colors.map((_, i) => el.querySelector(`[data-player-index="${i}"]`));
  }

  //--------------------------------------------------
  // Eliminated
  //--------------------------------------------------

  setEliminated(index, eliminated) {
    const dot = this.dots[index];

    if (!dot) return;

    dot.classList.toggle('eliminated', eliminated);

    if (eliminated) dot.classList.remove('active');
  }

  //--------------------------------------------------
  // Whose turn (turn-based only — chaos has no single "current" pen)
  //--------------------------------------------------

  setActive(index) {
    this.dots.forEach((dot, i) => dot && dot.classList.toggle('active', i === index));
  }

  clearActive() {
    this.dots.forEach((dot) => dot && dot.classList.remove('active'));
  }

  //--------------------------------------------------
  // Destroy
  //--------------------------------------------------

  destroy() {
    this.dom.destroy();
  }
}
