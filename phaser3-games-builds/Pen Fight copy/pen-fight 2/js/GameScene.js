//==================================================
// GameScene.js
//==================================================

import Physics from './Physics.js';
import PenManager from './PenManager.js';
import InputController from './InputController.js';
import DebugRenderer from './DebugRenderer.js';
import GameRules from './GameRules.js';
import PowerUpManager from './PowerUps.js';
import AIController from './AIController.js';

import TurnTimer from './ui/TurnTimer.js';
import MatchTimer from './ui/MatchTimer.js';
import TurnIndicator from './ui/TurnIndicator.js';
import WinPopup from './ui/WinPopup.js';
import PlayerStatusRow from './ui/PlayerStatusRow.js';
import { bottomDockLayout } from './ui/BottomDock.js';

import { drawTable } from './TableView.js';

import { GAME, INPUT, JUICE, PEN } from './Constants.js';
import { POWERUPS, LOCAL_MATCH, AI, CONTROLS } from './GameConfig.js';
import { createFlickModeToggle } from './ui/FlickModeToggle.js';
import { createDayNightToggle } from './ui/DayNightToggle.js';
import { createDayNight } from './fx/DayNight.js';
import audioFX from './AudioFX.js';
import { burst, eliminationPuff, floatingText } from './JuiceFX.js';
import { returnHome } from './AppShell.js';
import { recordOutcome } from './AdaptiveAI.js';
import { getSelectedStyle, recordWin } from './PlayerProfile.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
  }
  init() {
    window.currentScene = this;
  }

  //--------------------------------------------------
  // Create
  //--------------------------------------------------

  create() {
    //------------------------------------------
    // Background
    //------------------------------------------

    this.cameras.main.setBackgroundColor(GAME.BACKGROUND);

    this.addUIItems();

    //------------------------------------------
    // Multi-touch
    //------------------------------------------

    this.input.addPointer(INPUT.MAX_POINTERS - 1);

    //------------------------------------------
    // Physics World
    //------------------------------------------

    this.physicsWorld = new Physics();

    this.physicsWorld.onPenCollision = (penA, penB, relSpeedPx) => {
      const strength = Phaser.Math.Clamp(
        relSpeedPx / JUICE.COLLISION_SPEED_CALIBRATION_PX,
        0,
        1,
      );

      // Only bother with juice for hits with some real force behind
      // them — otherwise every gentle nudge would clack and flash.
      if (strength < JUICE.MIN_STRENGTH) return;

      const x = (penA.container.x + penB.container.x) / 2;
      const y = (penA.container.y + penB.container.y) / 2;

      audioFX.playCollision(strength);
      burst(this, x, y, 0xffffff, {
        count: Math.round(6 + strength * 10),
        speed: 120 + strength * 220,
      });
    };

    //------------------------------------------
    // Draw Table
    //------------------------------------------

    this.createTable();

    // Day/Night theme (see fx/DayNight.js + the ☀️/🌙 toggle wired up
    // in addUIItems() below) — applies its saved/default mode to the
    // table immediately, before any pens are drawn on top of it.
    this.dayNight = createDayNight(this, this.table);
    this.dayNightToggleUI.setMode(this.dayNight.getMode());

    //------------------------------------------
    // Pen Manager
    //------------------------------------------

    this.penManager = new PenManager(
      this,

      this.physicsWorld,
    );

    // playerId 0 (Classroom's first hotseat player / Vs Computer's
    // human seat) gets this device's own saved pen customization (see
    // PlayerProfile.js) — everyone else keeps the default palette.
    this.penManager.createPens(LOCAL_MATCH.PLAYER_COUNT, getSelectedStyle());

    // Sync every pen's shadow style to whatever this.dayNight already
    // settled on above (see the day/night toggle handler in
    // addUIItems() for the other half of this — live toggling once a
    // match is already running).
    const startNight = this.dayNight.getMode() === 'night';

    for (const pen of this.penManager.pens) pen.setNightShadow(startNight);

    // ------------------------------------------
    // Game Rules
    // -----------------------------------------
    this.gameRules = new GameRules(this, this.penManager);

    //------------------------------------------
    // Power-ups (optional, off by default — see the setup screens in js/main.js)
    //------------------------------------------

    this.powerUps = new PowerUpManager(this, this.penManager);
    this.powerUps.setEnabled(POWERUPS.ENABLED);

    //------------------------------------------
    // Camera
    //------------------------------------------

    // this.cameras.main.startFollow(
    //   this.penManager.getPens()[0].container,
    //   true,
    //   0.12,
    //   0.12,
    // );

    //------------------------------------------
    // Input
    //------------------------------------------

    this.inputController = new InputController(
      this,
      this.penManager,
      this.gameRules,
    );

    //------------------------------------------
    // Debug
    //------------------------------------------

    this.debugRenderer = new DebugRenderer(
      this,

      this.physicsWorld,
    );

    //------------------------------------------
    // Computer opponent(s) — a no-op if AI.PLAYER_IDS is empty
    // (Classroom mode never sets it; only Vs Computer does).
    //------------------------------------------

    this.aiController = new AIController(this, this.penManager, this.gameRules, {
      difficulty: AI.DIFFICULTY,
      aiPlayerIds: AI.PLAYER_IDS,
    });

    this.cameras.main.setZoom(1);

    this.events.on('turn-changed', (pen) => {
      /*    this.cameras.main.flash(200, 255, 255, 255);

      this.cameras.main.zoomTo(1.08, 200);

      this.time.delayedCall(200, () => {
        this.cameras.main.zoomTo(1.0, 300);
      });

      this.cameras.main.startFollow(pen.container, true, 0.12, 0.12); */
      const index = this.penManager.getPens().indexOf(pen);

      this.turnText.setText(`PLAYER ${index + 1} TURN`);
    });

    this.events.on('chaos-started', () => {
      this.turnText.setText('FREE FOR ALL');

      this.turnIndicator.hide();
    });

    this.events.on('pen-eliminated', (pen) => {
      audioFX.playEliminate();
      eliminationPuff(this, pen.container.x, pen.container.y, pen.color);
    });

    this.events.on('game-over', (result) => {
      if (result.result === 'draw') {
        audioFX.playDraw();
      } else {
        audioFX.playWin();
      }
    });

    // Vs Computer only — feeds AdaptiveAI.js so a long win/loss streak
    // against the AI nudges its difficulty instead of repeating forever.
    this.events.on('game-over', (result) => {
      if (AI.PLAYER_IDS.length === 0) return;

      const humanWon = result.result === 'win' && result.winner && result.winner.playerId === 0;

      recordOutcome(humanWon);
    });

    // Progression (see PlayerProfile.js) — playerId 0 is always this
    // device's own seat, in every local mode, so a win there is what
    // counts toward unlocking pens/stickers. Fires regardless of
    // whether the match had any AI opponents (Classroom hotseat wins
    // count the same as beating the computer).
    this.events.on('game-over', (result) => {
      if (result.result !== 'win' || !result.winner || result.winner.playerId !== 0) return;

      const { leveledUp } = recordWin();

      if (leveledUp) {
        this.time.delayedCall(600, () => {
          floatingText(this, GAME.WIDTH / 2, GAME.HEIGHT / 2 - 160, '🎉 LEVEL UP!', '#c98a1f');
        });
      }
    });

    this.events.on('shield-saved', (pen) => {
      audioFX.playPickup();
      burst(this, pen.container.x, pen.container.y, 0x42a5f5, { count: 20, speed: 240 });
      floatingText(this, pen.container.x, pen.container.y - 40, '🛡️ SHIELD SAVED YOU!', '#1565c0');
    });

    //------------------------------------------
    // Start Match
    // (must come after all 'turn-changed' / 'chaos-started' listeners
    // above, since start() emits them synchronously)
    //------------------------------------------

    this.gameRules.start();
  }

  addUIItems() {
    // Home button — top-left corner, same "← Home" pill NetGameScene
    // uses (see .hud-home-btn in index.html), so leaving a Classroom/
    // Vs Computer match works the same way as leaving an online one.
    this.homeButtonDom = this.add
      .dom(16, 10)
      .createFromHTML('<div class="hud-home-btn">← Home</div>')
      .setOrigin(0, 0);
    this.homeButtonDom.setDepth(1000);

    this.homeButtonDom.node.children[0].addEventListener('click', () => {
      this.scene.stop();
      returnHome();
    });

    // Right-hand switch column — flick-mode above, day/night below,
    // both the same size (see HUD_SWITCH_W/H) so they stack cleanly
    // with no gap-guessing.
    const HUD_SWITCH_W = 172;
    const HUD_SWITCH_H = 40;
    const HUD_SWITCH_X = GAME.WIDTH - 16 - HUD_SWITCH_W;
    const HUD_SWITCH_GAP = 10;

    // Flick-mode switch — top-right corner. Flips the same
    // CONTROLS.FLICK_MODE global InputController.js/AIController.js
    // already read live on every shot, so a mid-match toggle takes
    // effect on the very next drag with no other bookkeeping needed —
    // unlike online play, this is a single shared device, so there's
    // one convention for whoever's dragging, not a per-player one.
    createFlickModeToggle(this, HUD_SWITCH_X, 10, CONTROLS.FLICK_MODE, () => {
      CONTROLS.FLICK_MODE = CONTROLS.FLICK_MODE === 'swipe' ? 'pullback' : 'swipe';

      return CONTROLS.FLICK_MODE;
    });

    // Day/Night switch — docked right under the flick-mode switch.
    // this.dayNight isn't created until createTable() runs later in
    // create() below, so this starts on the 'day' label and gets
    // synced to whatever's actually saved right after — the click
    // handler itself only ever reads this.dayNight lazily, well after
    // create() has finished.
    this.dayNightToggleUI = createDayNightToggle(
      this,
      HUD_SWITCH_X,
      10 + HUD_SWITCH_H + HUD_SWITCH_GAP,
      'day',
      () => {
        const mode = this.dayNight.toggle();

        // Pens don't get relit by Light2D themselves (see fx/DayNight.js's
        // own comment on that scope decision) — this is what still makes
        // them visibly respond to the theme change, with a softer/wider
        // shadow standing in for actual lighting.
        for (const pen of this.penManager?.pens ?? []) pen.setNightShadow(mode === 'night');

        return mode;
      },
    );

    // Bottom dock: turn text sits right above the turn-timer-bar +
    // match-badge row — see BottomDock.js for the full layout and why
    // it moved down here from the top of the screen. Routed through
    // createFromHTML()+node.children[0] (not a direct-element
    // add.dom(x,y,el)) so Phaser's per-frame inline style writes land
    // on the wrapper only, never on this element — see WinPopup.js's
    // file header for the full reasoning.
    const { turnText: turnTextLayout, turnBar } = bottomDockLayout(this);

    this.turnTextDom = this.add
      .dom(turnTextLayout.x, turnTextLayout.y)
      .createFromHTML('<div class="hud-text">PLAYER 1 TURN</div>')
      .setOrigin(0, 0);
    this.turnTextDom.setDepth(1000);

    const turnTextEl = this.turnTextDom.node.children[0];

    // Keep a .setText() shim so the rest of this file (and anything
    // else that touches it) doesn't need to know it's a DOM Element.
    this.turnText = { setText: (t) => { turnTextEl.textContent = t; } };

    // Vs Computer only — shown for the brief settle-in pause before
    // the first turn/round actually starts (see GameRules.start()'s
    // startGraceMs). The very next 'turn-changed' or 'chaos-started'
    // event overwrites this with the real turn text once play begins.
    this.events.on('match-grace', () => {
      this.turnText.setText('GET READY…');
    });

    this.turnTimer = new TurnTimer(this, turnBar.x, turnBar.y);
    this.matchTimer = new MatchTimer(this);

    // Player status row — top of screen, filling the space the turn
    // text/match badge used to occupy before they moved down to the
    // bottom dock. One dot per pen (colors match PenManager.createPens'
    // own PEN.COLORS[i % length] assignment, so no need to wait for
    // the actual Pen instances to exist yet).
    const statusRowWidth = 320;

    this.playerStatusRow = new PlayerStatusRow(
      this,
      GAME.WIDTH / 2 - statusRowWidth / 2,
      12,
      Array.from(
        { length: LOCAL_MATCH.PLAYER_COUNT },
        (_, i) => PEN.COLORS[i % PEN.COLORS.length],
      ),
    );

    this.events.on('turn-changed', (pen) => {
      this.playerStatusRow.setActive(this.penManager.getPens().indexOf(pen));
    });

    this.events.on('chaos-started', () => {
      // No single "current" pen in chaos — nothing to ring-highlight.
      this.playerStatusRow.clearActive();
    });

    this.events.on('pen-eliminated', (pen) => {
      this.playerStatusRow.setEliminated(this.penManager.getPens().indexOf(pen), true);
    });

    this.events.on('turn-changed', () => {
      if (this.gameRules.useTurnTimer) this.turnTimer.show();

      if (this.gameRules.useMatchTimer) this.matchTimer.show();
    });

    this.events.on('chaos-started', () => {
      // Chaos has no per-turn timer, only the whole-match countdown
      if (this.gameRules.useMatchTimer) this.matchTimer.show();
    });

    this.events.on('turn-timer', (timeLeft) => {
      this.turnTimer.setTime(timeLeft, this.gameRules.turnTimeLimit);
    });

    this.events.on('match-timer', (timeLeft) => {
      this.matchTimer.setTime(timeLeft);
    });

    this.events.on('game-over', (result) => {
      this.turnTimer.hide();
      this.matchTimer.hide();
      this.turnIndicator.hide();
      this.playerStatusRow.clearActive();
      this.inputController.cancel();

      this.winPopup.show(result);
    });

    this.turnIndicator = new TurnIndicator(this);
    this.events.on('turn-changed', (pen) => {
      this.turnIndicator.show(pen.playerId);
    });

    this.winPopup = new WinPopup(this);

    this.winPopup.onPlayAgain = () => {
      this.scene.restart();
    };

    this.winPopup.onMainMenu = () => {
      this.scene.stop();
      returnHome();
    };
  }

  //--------------------------------------------------
  // Draw Table
  //--------------------------------------------------

  createTable() {
    this.table = drawTable(this);
  }

  //--------------------------------------------------
  // Update
  //--------------------------------------------------

  update(time, delta) {
    this.delta = delta;

    //------------------------------------------
    // Physics
    //------------------------------------------

    this.physicsWorld.step();

    // ------------------------------------------
    // Game Rules
    //  ----------------------------------------
    this.gameRules.update();

    //------------------------------------------
    // Power-ups (no-op if disabled or the match is over)
    //------------------------------------------

    if (!this.gameRules.gameOver) this.powerUps.update(delta);

    //------------------------------------------
    // Computer opponent(s) (no-op unless AI.PLAYER_IDS is set)
    //------------------------------------------

    this.aiController.update(delta);

    //------------------------------------------
    // Pens
    //------------------------------------------

    this.penManager.update();

    //------------------------------------------
    // Input visuals
    //------------------------------------------

    this.inputController.update();

    //------------------------------------------
    // Debug overlay
    //------------------------------------------

    this.debugRenderer.update();
  }
}
