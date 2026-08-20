//==================================================
// WinPopup.js
//==================================================
// End-of-match overlay (winner/draw + Play Again / Main Menu), built
// as a Phaser DOM Element — see .hud-popup-* in index.html. Buttons
// are real <button> elements with native click handlers, so there's
// no more manual Phaser.Geom.Rectangle hit-area bookkeeping.
//==================================================

import { AI } from '../GameConfig.js';

// Must match .hud-popup-overlay's opacity transition duration in
// index.html — hide() waits this long before switching display back
// to 'none', so the fade-out actually gets to play instead of the
// popup vanishing instantly.
const HIDE_TRANSITION_MS = 260;

export default class WinPopup {
  constructor(scene) {
    this.scene = scene;

    this.onPlayAgain = null;
    this.onMainMenu = null;

    //------------------------------------------
    // Root
    //------------------------------------------

    const htmlText = `<div class="hud-popup-overlay">
      <div class="hud-popup-panel">
        <div class="hud-popup-title"></div>
        <div class="hud-popup-subtitle"></div>
        <button class="menu-btn primary hud-popup-btn" data-action="play-again">Play Again</button>
        <button class="menu-btn hud-popup-btn" data-action="main-menu">Main Menu</button>
      </div>
    </div>`;

    // setOrigin(0,0): without it, Phaser's default center origin would
    // offset the node by half of whatever width/height it happened to
    // measure at creation time (unreliable — see TurnTimer.js's WIDTH/
    // HEIGHT comment) instead of anchoring cleanly at (0,0), i.e. the
    // literal top-left corner this popup needs to cover the canvas.
    this.dom = scene.add.dom(0, 0).createFromHTML(htmlText).setOrigin(0, 0);
    this.dom.setDepth(10000);
    const el = this.dom.node.children[0];
    // Sized to fully cover the canvas (the dark scrim) regardless of
    // orientation/canvas size — same pattern as MenuScene's root.
    el.style.width = `${scene.scale.width}px`;
    el.style.height = `${scene.scale.height}px`;

    this.el = el;
    this.title = el.querySelector('.hud-popup-title');
    this.subtitle = el.querySelector('.hud-popup-subtitle');

    //------------------------------------------
    // Button events
    //------------------------------------------

    el.querySelector('[data-action="play-again"]').addEventListener(
      'click',
      () => {
        this.hide();

        if (this.onPlayAgain) this.onPlayAgain();
      },
    );

    el.querySelector('[data-action="main-menu"]').addEventListener(
      'click',
      () => {
        this.hide();

        if (this.onMainMenu) this.onMainMenu();
      },
    );

    this.hide();
  }

  //--------------------------------------------------
  // Show
  //--------------------------------------------------

  show(result) {
    if (result.result === 'draw') {
      this.title.textContent = 'DRAW!';
      this.title.style.color = '#3b2a20';

      this.subtitle.textContent = 'Nobody Wins';
    } else {
      const winnerId = result.winner.playerId;
      const isAiOpponent = AI.PLAYER_IDS.includes(winnerId);

      if (isAiOpponent) {
        this.title.textContent = 'COMPUTER WINS!';
        this.subtitle.textContent = 'Better luck next time';
      } else if (AI.PLAYER_IDS.length > 0 && winnerId === 0) {
        this.title.textContent = 'YOU WIN!';
        this.subtitle.textContent = 'Nicely flicked';
      } else {
        this.title.textContent = `PLAYER ${winnerId + 1} WINS!`;
        this.subtitle.textContent = 'Congratulations!';
      }

      this.title.style.color = '#c1272d';
    }

    if (this.hideTimer) {
      this.hideTimer.remove();
      this.hideTimer = null;
    }

    this.el.style.display = 'flex';

    // Force a reflow before adding the class so the browser actually
    // has a display:none/flex -> 'show' transition to animate, rather
    // than starting from an already-added class (which would just
    // paint at the end state with no transition).
    void this.el.offsetWidth;
    this.el.classList.add('show');
  }

  //--------------------------------------------------
  // Hide
  //--------------------------------------------------

  hide() {
    this.el.classList.remove('show');

    // Wait for the fade-out to actually play before switching back to
    // display:none — display can't itself be transitioned.
    this.hideTimer = this.scene.time.delayedCall(HIDE_TRANSITION_MS, () => {
      this.hideTimer = null;

      // The scene (and this DOM element) may already be gone by the
      // time this fires — e.g. Main Menu was clicked, which stops the
      // scene almost immediately after calling hide().
      if (!this.dom || !this.dom.node) return;

      this.el.style.display = 'none';
    });
  }

  //--------------------------------------------------
  // Destroy
  //--------------------------------------------------

  destroy() {
    if (this.hideTimer) this.hideTimer.remove();

    this.dom.destroy();
  }
}
