//==================================================
// NetGameScene.js
//==================================================
// The multiplayer scene: renders whatever the server (GameRoom.mjs)
// says and forwards input. All game logic — physics, whose turn,
// lobby positioning validity, the countdown, elimination — lives on
// the server; this file owns no authority over anything.
//
// Three visual modes, driven entirely by server messages:
//   LOBBY     drag your own pen anywhere on the table to place it
//   COUNTDOWN big 3-2-1 overlay, input locked
//   PLAYING   the familiar pull-back-and-release shooting UI
//==================================================

import { GAME, PEN, INPUT, JUICE, TABLE, SCALE } from '../Constants.js';
import { MATCH } from '../GameConfig.js';
import { drawTable } from '../TableView.js';
import NetPen from './NetPen.js';
import { setHandlerAndCatchUp, send, closeSocket, onClose } from './connection.js';
import audioFX from '../AudioFX.js';
import { burst, eliminationPuff, floatingText } from '../JuiceFX.js';
import { getWinStreak, recordMatchOutcome } from './WinStreak.js';
import { recordWin } from '../PlayerProfile.js';
import { isValidPlacement } from './LobbyPlacement.js';
import { returnHome } from '../AppShell.js';
import TurnTimer from '../ui/TurnTimer.js';
import { createFlickModeToggle } from '../ui/FlickModeToggle.js';
import { createDayNightToggle } from '../ui/DayNightToggle.js';
import { createDayNight } from '../fx/DayNight.js';
import { copyText } from '../ui/Clipboard.js';
import { createCheerButton } from '../ui/CheerButton.js';
import { confettiBlast, cheerEmojiPop } from '../fx/Confetti.js';

const MODE = {
  LOBBY: 'lobby',
  COUNTDOWN: 'countdown',
  PLAYING: 'playing',
};

// Squared position-delta-per-snapshot (px) above which a pen is
// considered "fast" for trail purposes. Server ticks at 60Hz, so this
// is roughly "moved noticeably even across a single tick".
const TRAIL_DELTA_SQ_THRESHOLD = 36;

// Must match .hud-popup-overlay's opacity transition duration in
// index.html — hideGameOver() waits this long before switching
// display back to 'none', so the fade-out actually gets to play.
const HIDE_TRANSITION_MS = 260;

export default class NetGameScene extends Phaser.Scene {
  constructor() {
    super('NetGameScene');
  }

  create() {
    this.cameras.main.setBackgroundColor(GAME.BACKGROUND);

    // This player's OWN flick-feel preference (see the flick-mode
    // toggle in createHud()) — independent of the room's shared
    // config.flickMode (set below once 'room-joined' arrives), which
    // is what the server's physics stays authoritative against (see
    // GameRoom.mjs's _onShoot()). A personal preference that differs
    // from the room's is reconciled purely client-side, by swapping
    // which raw point gets called "touch" vs "release" in the 'shoot'
    // message (see onPointerUp()) — the server's fixed formula then
    // produces exactly the result this player intended, with zero
    // server changes needed and nothing for other clients to even know
    // about. Set here (before createHud() builds the toggle button)
    // since it needs a value to render immediately; re-synced to the
    // room's own default exactly once, the first time it's known (see
    // the 'room-joined'/'lobby-state' handlers).
    this.personalFlickMode = 'pullback';
    this._personalFlickModeSynced = false;

    this.createTable();
    this.createHud();
    this.createCountdownUI();
    this.createGameOverUI();

    this.mode = MODE.LOBBY;

    this.myPlayerId = null;
    this.maxPlayers = 2;
    this.colors = PEN.COLORS;
    this.roomCode = '';
    this.config = {
      useTurnTimer: true,
      waitForSettle: true,
      useMatchTimeLimit: false,
      chaosMode: false,
      flickMode: 'pullback',
    };
    this.chaosMode = false;

    this.pens = []; // NetPen[], index-matched to server playerId
    this.lobbyPlayers = [];
    this.lastPenPositions = {}; // playerId -> {x,y}, for trail deltas
    this.powerUpView = null; // { id, container } — mirrors server's this.powerUp
    this.styles = []; // per-seat cosmetic style ({color, sticker} | null), index-matched to playerId — see GameRoom.mjs
    this.spectatorCount = 0;

    // Lobby placement countdown (see GameRoom.mjs's roomFullAt /
    // placementGraceMs on the lobby-state message) — null while
    // waiting on an open seat, a wall-clock deadline once the room is
    // full and everyone's placing their pen. Computed once from the
    // server's timestamp, then counted down locally every frame (see
    // updateLobbyCountdown()) rather than needing a per-tick broadcast.
    this.lobbyDeadlineAt = null;
    this.lobbyGraceMs = 1; // the bar's "full" duration for the current countdown, set alongside lobbyDeadlineAt

    this.turnState = { currentIndex: 0, turnActive: false, waitingForSettle: false, turnTimeLeft: -1, started: false };
    this.connected = [];
    this.alive = [];
    this.gameOver = false;
    this.winner = null;

    this.aimGraphics = this.add.graphics();
    this.drag = null;
    this.subMessageTimer = null; // see onPointerUp()'s "turn's over" feedback

    // Set the moment the socket drops unexpectedly (see connection.js's
    // file header) — blocks further input and shows a clear message
    // instead of the game silently doing nothing when you try to play.
    // Not something we try to silently resume from: the server has no
    // reconnect-into-the-same-seat support, so the honest thing to do
    // is tell the player plainly and point them back to Home.
    this.connectionLost = false;

    this.input.on('pointerdown', (p) => this.onPointerDown(p));
    this.input.on('pointermove', (p) => this.onPointerMove(p));
    this.input.on('pointerup', (p) => this.onPointerUp(p));

    this.unsubscribeClose = onClose(({ intentional }) => {
      if (intentional || this.connectionLost) return;

      this.connectionLost = true;
      this.drag = null;
      this.aimGraphics.clear();

      this.statusText.setText('Connection lost');
      this.setSubText('Reconnecting… tap ← Home if this doesn\'t clear up', false);
    });

    // js/main.js's online menu handler already reacted to
    // 'room-joined' by booting this scene — anything the server sent
    // in the meantime (starting with that same 'room-joined') gets
    // replayed here before switching over to live delivery.
    setHandlerAndCatchUp((msg) => this.onServerMessage(msg));
  }

  //--------------------------------------------------
  // Table
  //--------------------------------------------------

  createTable() {
    this.table = drawTable(this);

    // Day/Night theme (see fx/DayNight.js + the ☀️/🌙 toggle wired up
    // in createHud() below, which reads this.dayNight.getMode() for
    // its own initial label) — applied immediately so it's already
    // right by the time pens get drawn on top in ensurePens().
    this.dayNight = createDayNight(this, this.table);
  }

  //--------------------------------------------------
  // HUD
  //--------------------------------------------------

  createHud() {
    // Every HUD piece below is created via createFromHTML() +
    // node.children[0], then setOrigin(0,0) with a literal top-left
    // pixel position — not the old "fixed-width band + text-align"
    // workaround for center-anchoring, and not a direct-element
    // add.dom(x,y,el) either. Both of those were compensating for
    // problems that setOrigin(0,0) removes outright: (1) Phaser DOM
    // Elements measure width/height once at creation time, before
    // their real CSS layout applies, so any origin other than (0,0)
    // multiplies that unreliable measurement into the final position;
    // (2) a direct-element add.dom(x,y,el) has Phaser overwrite that
    // same element's display/transform inline styles every render
    // frame, fighting this file's own CSS. Routing through
    // node.children[0] sidesteps both — see WinPopup.js's file header
    // for the fuller explanation of point (2).

    // Home button — top-left corner.
    const homeX = 16;
    const homeY = 10;
    const homeH = 38;

    this.homeButtonDom = this.add
      .dom(homeX, homeY)
      .createFromHTML('<div class="hud-home-btn">← Home</div>')
      .setOrigin(0, 0);
    this.homeButtonDom.setDepth(1000);

    const homeEl = this.homeButtonDom.node.children[0];

    homeEl.addEventListener('click', () => {
      if (this.unsubscribeClose) this.unsubscribeClose();
      closeSocket();
      this.scene.stop();
      returnHome();
    });

    // Shared sizing for every switch/button in this HUD (see
    // index.html's .hud-switch) — one place to retune "how big"
    // without hunting through every x/y math below.
    const HUD_SWITCH_W = 172;
    const HUD_SWITCH_H = 40;
    const HUD_GAP = 10;
    const HUD_RIGHT_X = GAME.WIDTH - 16 - HUD_SWITCH_W;

    // Day/Night switch — under the Home button, on the left, since the
    // right-hand column below is already claimed by the flick toggle +
    // win-streak + spectator badges. createTable() (called just before
    // this, see create()) already built this.dayNight, so this can
    // read its real saved mode straight away instead of guessing.
    this.dayNightToggleUI = createDayNightToggle(
      this,
      homeX,
      homeY + homeH + HUD_GAP,
      this.dayNight.getMode(),
      () => {
        const mode = this.dayNight.toggle();

        // Pens aren't Light2D-lit themselves (see fx/DayNight.js's own
        // comment on that scope decision) — this is what still makes
        // them visibly respond, with a softer/wider shadow standing in
        // for actual lighting.
        for (const pen of this.pens) if (pen) pen.setNightShadow(mode === 'night');

        return mode;
      },
    );

    // Flick-mode switch — top-right corner, tappable anytime (lobby or
    // mid-match). Purely a personal preference — see this.
    // personalFlickMode's comment above for how it's reconciled with
    // the room's own fixed config without needing the server to know.
    this.flickToggle = createFlickModeToggle(
      this,
      HUD_RIGHT_X,
      homeY,
      this.personalFlickMode,
      () => {
        this.personalFlickMode = this.personalFlickMode === 'swipe' ? 'pullback' : 'swipe';

        return this.personalFlickMode;
      },
    );

    // Cheer panel — spectators only. Docked to the left-middle of the
    // screen, clear of both the top HUD row (status text/room code)
    // and the bottom shoot HUD, so it never overlaps anything else on
    // screen regardless of orientation/mode. Built up front since we
    // don't know player-vs-spectator status until 'room-joined'
    // arrives; updateSpectatorControls() below then shows/hides it.
    const HUD_CHEER_X = 14;
    const HUD_CHEER_Y = GAME.HEIGHT / 2;

    this.cheerButton = createCheerButton(this, HUD_CHEER_X, HUD_CHEER_Y, (emoji) =>
      send({ type: 'cheer', emoji }),
    );

    // Defaults to "player" (cheer hidden) until 'room-joined' tells us
    // which one this connection actually is — see
    // updateSpectatorControls(), the only other caller.
    this.cheerButton.dom.setVisible(false);

    // Status — horizontally centered, top of screen.
    const statusW = 520;
    const statusH = 36;
    const centerX = GAME.WIDTH / 2;
    const statusCenterY = 30;

    this.statusDom = this.add
      .dom(centerX - statusW / 2, statusCenterY - statusH / 2)
      .createFromHTML('<div class="hud-net-status">Connecting…</div>')
      .setOrigin(0, 0);
    this.statusDom.setDepth(1000);

    const statusEl = this.statusDom.node.children[0];

    // Punches (a quick scale bump) whenever the text actually changes
    // — not on every call, since refreshHud() gets called on every
    // 'state' message from the server (up to 60Hz), and most of those
    // calls re-set the exact same text.
    let lastStatusText = null;

    this.statusText = {
      setText: (t) => {
        statusEl.textContent = t;

        if (lastStatusText !== null && t !== lastStatusText) this.punch(statusEl);

        lastStatusText = t;
      },
    };

    // Room code — top-center, just below the status text and above
    // the table (see .hud-net-room-code in index.html for the pill
    // styling). Vertically centered in the gap between the status
    // text (bottom ~48) and the table's top edge.
    const roomW = 320;
    const roomH = 34;
    const roomCenterY = (statusCenterY + statusH / 2 + TABLE.Y) / 2;

    this.roomCodeDom = this.add
      .dom(centerX - roomW / 2, roomCenterY - roomH / 2)
      .createFromHTML('<div class="hud-net-room-code"></div>')
      .setOrigin(0, 0);
    this.roomCodeDom.setDepth(1000);

    const roomCodeEl = this.roomCodeDom.node.children[0];

    roomCodeEl.addEventListener('click', () => this.copyInviteLink());

    this.roomCodeText = { setText: (t) => { roomCodeEl.textContent = t; } };

    // Gentle, constant pulse — a lightweight "you can tap this" cue.
    this.startContinuousPulse(roomCodeEl, { scale: 1.045, duration: 1100 });

    // Sub-text — the actionable instruction line ("Drag your pen…"),
    // now docked just below the table instead of stacked under the
    // status text at the top (see setSubText() for the pulse that
    // plays while it's actually telling the active player to do
    // something).
    const subW = 520;
    const subH = 30;
    const subTop = TABLE.Y + TABLE.HEIGHT + 16;

    this.subDom = this.add
      .dom(centerX - subW / 2, subTop)
      .createFromHTML('<div class="hud-net-sub"></div>')
      .setOrigin(0, 0);
    this.subDom.setDepth(1000);

    const subEl = this.subDom.node.children[0];

    this.subText = { setText: (t) => { subEl.textContent = t; } };

    this.setSubText = (t, pulsing = false) => {
      this.subText.setText(t);
      this.setPulsing(subEl, pulsing);
    };

    // Turn timer bar — same visual as GameScene's (see TurnTimer.js),
    // docked at the very bottom edge, just under the sub-text. Only
    // shown for turn-based rooms with useTurnTimer on (see
    // updateTurnTimerBar(), driven from refreshHud()) — chaos rooms
    // have no per-turn timer, only the whole-match countdown.
    const timerW = 400;
    const timerH = 30;

    this.netTurnTimer = new TurnTimer(
      this,
      centerX - timerW / 2,
      this.scale.height - 16 - timerH,
    );

    // Streak + spectator-count badges — combined into one centered row
    // in the open gap between the room code and the table, rather than
    // stacked under the top-right switches (that column's now too
    // short to fit two more text rows above the room code once the
    // switches grew — see HUD_SWITCH_H — without overlapping it).
    const badgesW = 460;
    const badgesH = 26;
    const badgesY = roomCenterY + roomH / 2 + 8;

    this.badgesDom = this.add
      .dom(centerX - badgesW / 2, badgesY)
      .createFromHTML('<div class="hud-net-badges"><span class="badge-streak"></span><span class="badge-spectators"></span></div>')
      .setOrigin(0, 0);
    this.badgesDom.setDepth(1000);

    const streakEl = this.badgesDom.node.children[0].querySelector('.badge-streak');
    const spectatorEl = this.badgesDom.node.children[0].querySelector('.badge-spectators');

    // Per-browser bragging-rights streak (see WinStreak.js) — a local
    // stat, not something the server tracks.
    this.streakText = { setText: (t) => { streakEl.textContent = t; } };

    this.refreshStreakText();

    // Spectator count — purely informational (see GameRoom.mjs's
    // spectators field on room-joined/lobby-state/state), updated live
    // as people watch/stop watching, no toast needed for every +/-1 the
    // way an actual player joining/leaving gets (see 'presence'
    // handling below) — that would get noisy fast in a busy public room.
    this.spectatorText = { setText: (t) => { spectatorEl.textContent = t; } };
  }

  refreshSpectatorText() {
    this.spectatorText.setText(this.spectatorCount > 0 ? `👀 ${this.spectatorCount} watching` : '');
  }

  // Shows exactly one of the flick-mode toggle (top-right) / Cheer
  // panel (left-middle) — see createHud() — the flick toggle is
  // meaningless for a spectator (who never shoots), the Cheer panel
  // is meaningless for a player (see GameRoom.mjs's _onCheer(), which
  // rejects it server-side too). Called once 'room-joined' tells us
  // which one this connection actually is.
  updateSpectatorControls() {
    const isSpectator = this.myPlayerId === null;

    this.cheerButton.dom.setVisible(isSpectator);
    this.flickToggle.dom.setVisible(!isSpectator);
  }

  //--------------------------------------------------
  // Tween-driven "liveliness" helpers — a constant gentle pulse for
  // anything that invites a tap, a start/stop-able pulse for the
  // instruction line, and a one-shot punch for the moment the status
  // line's text actually changes. All three animate an element's own
  // style.transform (never this.xDom itself), so they don't fight
  // Phaser's own per-frame styling of the wrapper node — same
  // reasoning as everywhere else in this file (see createHud()'s file
  // comment).
  //--------------------------------------------------

  startContinuousPulse(el, { scale = 1.06, duration = 900 } = {}) {
    const state = { scale: 1 };

    this.tweens.add({
      targets: state,
      scale,
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
      onUpdate: () => { el.style.transform = `scale(${state.scale})`; },
    });
  }

  setPulsing(el, pulsing, { scale = 1.05, duration = 650 } = {}) {
    const alreadyPulsing = !!el._pulseTween;

    if (pulsing === alreadyPulsing) return;

    if (pulsing) {
      const state = { scale: 1 };

      el._pulseTween = this.tweens.add({
        targets: state,
        scale,
        duration,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
        onUpdate: () => { el.style.transform = `scale(${state.scale})`; },
      });
    } else {
      el._pulseTween.stop();
      el._pulseTween = null;
      el.style.transform = 'none';
    }
  }

  punch(el) {
    const state = { scale: 1 };

    this.tweens.add({
      targets: state,
      scale: 1.12,
      duration: 110,
      yoyo: true,
      ease: 'Quad.Out',
      onUpdate: () => { el.style.transform = `scale(${state.scale})`; },
      onComplete: () => { el.style.transform = 'none'; },
    });
  }

  refreshStreakText() {
    const { streak, best } = getWinStreak();

    this.streakText.setText(streak > 0 ? `🔥 Streak: ${streak} (best ${best})` : best > 0 ? `Best streak: ${best}` : '');
  }

  copyInviteLink() {
    if (!this.roomCode) return;

    const url = new URL(location.href);

    url.searchParams.set('room', this.roomCode);

    const text = url.toString();

    // See ui/Clipboard.js's file header — this only claims "copied!"
    // once a copy has actually happened; on a plain-HTTP LAN game
    // (navigator.clipboard doesn't exist there at all) it falls back
    // to the legacy execCommand path instead of silently doing
    // nothing the way this used to.
    copyText(text).then((ok) => {
      this.roomCodeText.setText(
        ok ? `Room ${this.roomCode} — link copied!` : `Room ${this.roomCode} — couldn't copy, code above`,
      );

      this.time.delayedCall(ok ? 1500 : 2500, () => this.updateRoomCodeText());
    });
  }

  updateRoomCodeText() {
    if (!this.roomCode) {
      this.roomCodeText.setText('');
      return;
    }

    this.roomCodeText.setText(`Room ${this.roomCode} — tap to copy link`);
  }

  //--------------------------------------------------
  // Countdown overlay
  //--------------------------------------------------

  createCountdownUI() {
    // See createHud()'s file comment for why this goes through
    // createFromHTML()+node.children[0] with setOrigin(0,0) rather
    // than a direct-element add.dom(x,y,el) — this element's CSS
    // transition (opacity/transform, toggled by the .show class) would
    // otherwise get fought by Phaser's own per-frame inline styles.
    const W = 300;
    const H = 220;
    const centerX = GAME.WIDTH / 2;
    const centerY = GAME.HEIGHT / 2;

    this.countdownDom = this.add
      .dom(centerX - W / 2, centerY - H / 2)
      .createFromHTML('<div class="hud-countdown"></div>')
      .setOrigin(0, 0);
    this.countdownDom.setDepth(9000);

    this.countdownEl = this.countdownDom.node.children[0];
  }

  showCountdown(value) {
    this.countdownEl.textContent = String(value);

    // Re-trigger the CSS transition (see .hud-countdown / .show in
    // index.html) even if it's already showing.
    this.countdownEl.classList.remove('show');
    void this.countdownEl.offsetWidth;
    this.countdownEl.classList.add('show');
  }

  hideCountdown() {
    this.countdownEl.classList.remove('show');
  }

  //--------------------------------------------------
  // Game-over overlay (winner / draw + rematch)
  //--------------------------------------------------

  createGameOverUI() {
    // Show/hide toggles display on the *content* div (this.gameOverEl),
    // not on this.gameOverDom.node — Phaser keeps forcing its own node
    // back to display:block every update, so a node-level
    // display:none would get silently fought and never stick. Using
    // createFromHTML() + node.children[0] sidesteps that (same pattern
    // as WinPopup.js — see its file header for more detail).
    const html = `<div class="hud-popup-overlay">
      <div class="hud-popup-panel">
        <div class="hud-popup-title"></div>
        <div class="hud-popup-subtitle"></div>
        <div class="hud-popup-stats"></div>
        <button class="menu-btn primary hud-popup-btn" data-action="restart">Play Again</button>
      </div>
    </div>`;

    // setOrigin(0,0): anchors this at the literal top-left corner
    // (0,0) below, instead of Phaser's default center origin offsetting
    // it by half of an unreliably-measured width/height — see
    // TurnTimer.js's WIDTH/HEIGHT comment for the full reasoning.
    this.gameOverDom = this.add.dom(0, 0).createFromHTML(html).setOrigin(0, 0);
    this.gameOverDom.setDepth(10000);

    const el = this.gameOverDom.node.children[0];

    el.style.width = `${GAME.WIDTH}px`;
    el.style.height = `${GAME.HEIGHT}px`;

    this.gameOverTitle = el.querySelector('.hud-popup-title');
    this.gameOverSubtitle = el.querySelector('.hud-popup-subtitle');
    this.gameOverStats = el.querySelector('.hud-popup-stats');

    el.querySelector('[data-action="restart"]').addEventListener('click', () => send({ type: 'restart' }));

    this.gameOverEl = el;
    this.hideGameOver();
  }

  showGameOver(result, winner, meta = {}) {
    this.gameOver = true;

    if (result === 'draw') {
      this.gameOverTitle.textContent = 'DRAW!';
      this.gameOverTitle.style.color = '#3b2a20';
      this.gameOverSubtitle.textContent = 'All remaining pens went off the table';
    } else {
      const youWon = winner === this.myPlayerId;

      this.gameOverTitle.textContent = youWon ? 'YOU WIN!' : `PLAYER ${winner + 1} WINS!`;
      this.gameOverTitle.style.color = '#c1272d';
      this.gameOverSubtitle.textContent =
        this.myPlayerId === null ? 'Match over' : youWon ? 'Nicely flicked' : 'Better luck next time';
    }

    this.updateGameOverStats(meta);

    // Spectators don't have a streak; only track it for an actual player.
    if (this.myPlayerId !== null) {
      const outcome = result === 'draw' ? 'draw' : winner === this.myPlayerId ? 'win' : 'loss';

      recordMatchOutcome(outcome);
      this.refreshStreakText();

      // Progression (see PlayerProfile.js) — online wins count toward
      // unlocking pens/stickers exactly like Classroom/Vs Computer wins
      // do (see GameScene.js's matching game-over listener).
      if (outcome === 'win') {
        const { leveledUp } = recordWin();

        if (leveledUp) {
          this.time.delayedCall(600, () => {
            floatingText(this, GAME.WIDTH / 2, GAME.HEIGHT / 2 - 160, '🎉 LEVEL UP!', '#c98a1f');
          });
        }
      }
    }

    if (this.gameOverHideTimer) {
      this.gameOverHideTimer.remove();
      this.gameOverHideTimer = null;
    }

    this.gameOverEl.style.display = 'flex';

    // Force a reflow before adding 'show' so the fade/scale-in (see
    // .hud-popup-overlay.show in index.html) actually has a
    // display:none -> flex transition to animate from.
    void this.gameOverEl.offsetWidth;
    this.gameOverEl.classList.add('show');

    this.aimGraphics.clear();
    this.drag = null;
  }

  updateGameOverStats(meta) {
    const lines = [];

    if (meta.stats) {
      const shots = meta.stats.shots || [];
      const myShots = this.myPlayerId !== null ? shots[this.myPlayerId] : undefined;

      if (typeof myShots === 'number') {
        lines.push(`You took ${myShots} shot${myShots === 1 ? '' : 's'}`);
      }

      if (typeof meta.stats.durationMs === 'number') {
        lines.push(`Match length: ${Math.max(1, Math.round(meta.stats.durationMs / 1000))}s`);
      }
    }

    if (meta.series) {
      const scoreText = meta.series.wins.map((w, i) => `P${i + 1}: ${w}`).join('   ');

      lines.push(
        meta.series.over ? `🏆 Series won by Player ${meta.series.winner + 1}!` : `Series — ${scoreText}`,
      );
    }

    this.gameOverStats.textContent = lines.join('\n');
  }

  hideGameOver() {
    this.gameOver = false;
    this.gameOverEl.classList.remove('show');

    if (this.gameOverHideTimer) this.gameOverHideTimer.remove();

    // Wait for the fade-out to actually play before switching back to
    // display:none — display can't itself be transitioned.
    this.gameOverHideTimer = this.time.delayedCall(HIDE_TRANSITION_MS, () => {
      this.gameOverHideTimer = null;
      this.gameOverEl.style.display = 'none';
    });
  }

  //--------------------------------------------------
  // Server messages
  //--------------------------------------------------

  onServerMessage(msg) {
    switch (msg.type) {
      case 'room-joined':
        this.myPlayerId = msg.playerId;
        this.maxPlayers = msg.maxPlayers;
        this.colors = msg.colors;
        this.styles = msg.styles || [];
        this.roomCode = msg.code;
        this.config = msg.config;
        this.chaosMode = !!msg.config.chaosMode;
        this.spectatorCount = msg.spectators || 0;

        if (!this._personalFlickModeSynced) {
          this._personalFlickModeSynced = true;
          this.personalFlickMode = this.config.flickMode;
          this.flickToggle.setMode(this.personalFlickMode);
        }

        this.updateSpectatorControls();
        this.ensurePens();
        this.updateRoomCodeText();
        this.refreshSpectatorText();
        this.refreshHud();
        break;

      case 'lobby-state':
        this.mode = MODE.LOBBY;
        this.roomCode = msg.code;
        this.maxPlayers = msg.maxPlayers;
        this.colors = msg.colors;
        this.styles = msg.styles || this.styles;
        this.config = msg.config;
        this.chaosMode = !!msg.config.chaosMode;
        this.lobbyPlayers = msg.players;
        this.spectatorCount = msg.spectators ?? this.spectatorCount;
        if (msg.roomFullAt) {
          this.lobbyGraceMs = msg.placementGraceMs || 1;
          this.lobbyDeadlineAt = msg.roomFullAt + this.lobbyGraceMs;
        } else {
          this.lobbyDeadlineAt = null;
        }

        this.ensurePens();
        this.applyLobbyPositions();
        this.updateRoomCodeText();
        this.refreshSpectatorText();
        this.hideCountdown();
        this.hideGameOver();
        this.clearPowerUpView();
        this.refreshHud();
        break;

      case 'countdown':
        this.mode = MODE.COUNTDOWN;
        this.lobbyDeadlineAt = null;
        this.showCountdown(msg.value);
        audioFX.playCountdownBeep(msg.value <= 1);
        this.refreshHud();
        break;

      case 'match-start':
        this.mode = MODE.PLAYING;
        this.hideCountdown();

        this.alive = new Array(this.maxPlayers).fill(true);
        this.gameOver = false;
        this.lastPenPositions = {}; // fresh match — don't trail the lobby->start snap
        this.clearPowerUpView();

        for (const p of msg.pens) {
          const pen = this.pens[p.id];

          if (pen) {
            pen.setTransform(p.x, p.y, p.angle);
            pen.setConnected(true);
            pen.setEliminated(false);
            pen.clearLobbyHighlight(); // undo the lobby's own-pen/opponent dimming before real play starts
          }
        }

        this.refreshHud();
        break;

      case 'turn-changed':
        this.turnState.currentIndex = msg.currentIndex;
        this.turnState.turnActive = true;
        this.turnState.waitingForSettle = false;
        this.highlightCurrentPen();
        this.refreshHud();
        break;

      case 'state':
        this.connected = msg.connected;

        if (typeof msg.spectators === 'number' && msg.spectators !== this.spectatorCount) {
          this.spectatorCount = msg.spectators;
          this.refreshSpectatorText();
        }

        // Chaos rooms have no TurnManager server-side, so msg.turn is
        // null there — just keep whatever stub turnState we already
        // have (nothing reads it meaningfully in chaos mode anyway).
        if (msg.turn) this.turnState = msg.turn;

        if (msg.alive) {
          this.alive = msg.alive;
          this.applyAliveState();
        }

        // Per-player Speed Boost state — see setBoosted() (GameScene
        // has this too, via Pen.js) for why this needs to persist on
        // the pen itself rather than just flash briefly on pickup.
        if (msg.nextShotBoost) {
          msg.nextShotBoost.forEach((boost, i) => {
            const pen = this.pens[i];

            if (pen) pen.setBoosted(boost > 1);
          });
        }

        // Same idea for a charged Helicopter Shot — each pen's own
        // snapshot (below) separately reports whether it's currently
        // *spinning* (mid-shot), covering the after as well as the
        // before of that pickup.
        if (msg.nextShotHelicopter) {
          msg.nextShotHelicopter.forEach((charged, i) => {
            const pen = this.pens[i];

            if (pen) pen.setHelicopterCharged(!!charged);
          });
        }

        for (const p of msg.pens) {
          const pen = this.pens[p.id];

          if (!pen) continue;

          const prev = this.lastPenPositions[p.id];

          if (prev) {
            const dx = p.x - prev.x;
            const dy = p.y - prev.y;

            if (dx * dx + dy * dy > TRAIL_DELTA_SQ_THRESHOLD) pen.emitTrail();
          }

          this.lastPenPositions[p.id] = { x: p.x, y: p.y };

          pen.setTransform(p.x, p.y, p.angle);
          pen.setHelicopterActive(!!p.helicopterActive);
          pen.setShielded(!!p.hasShield);
        }

        if (msg.collisions && msg.collisions.length) {
          for (const c of msg.collisions) {
            const strength = Phaser.Math.Clamp(
              c.speed / JUICE.COLLISION_SPEED_CALIBRATION_PX,
              0,
              1,
            );

            if (strength < JUICE.MIN_STRENGTH) continue;

            audioFX.playCollision(strength);
            burst(this, c.x, c.y, 0xffffff, {
              count: Math.round(6 + strength * 10),
              speed: 120 + strength * 220,
            });
          }
        }

        this.syncPowerUpView(msg.powerUp);

        if (msg.gameOver && !this.gameOver) {
          const aliveIds = (this.alive || [])
            .map((a, i) => (a ? i : -1))
            .filter((i) => i !== -1);

          this.showGameOver(aliveIds.length === 1 ? 'win' : 'draw', aliveIds.length === 1 ? aliveIds[0] : null);
        }

        this.refreshHud();
        break;

      case 'shield-saved': {
        const pen = this.pens[msg.playerId];

        audioFX.playPickup();
        burst(this, msg.x, msg.y, 0x42a5f5, { count: 20, speed: 240 });
        floatingText(this, msg.x, msg.y - 40, '🛡️ SHIELD SAVED YOU!', '#1565c0');

        if (pen) pen.setTransform(msg.x, msg.y, pen.container.rotation);
        break;
      }

      case 'eliminated': {
        this.alive[msg.playerId] = false;

        const pen = this.pens[msg.playerId];

        if (pen) {
          audioFX.playEliminate();
          eliminationPuff(this, pen.container.x, pen.container.y, pen.color);
        }

        this.applyAliveState();
        break;
      }

      case 'game-over':
        this.winner = msg.winner;
        this.showGameOver(msg.result, msg.winner, { stats: msg.stats, series: msg.series });
        audioFX[msg.result === 'draw' ? 'playDraw' : 'playWin']();
        this.refreshHud();
        break;

      case 'powerup-collected': {
        audioFX.playPickup();

        const colors = { helicopter: 0x26c6da, shield: 0x42a5f5, speed: 0xffd54f };
        const labels = { helicopter: '🚁 HELICOPTER SHOT!', shield: '🛡️ SHIELD!', speed: '⚡ SPEED BOOST!' };
        const textColors = { helicopter: '#00838f', shield: '#1565c0', speed: '#c98a1f' };

        burst(this, msg.x, msg.y, colors[msg.kind] ?? colors.speed, { count: 16, speed: 200 });
        floatingText(this, msg.x, msg.y - 40, labels[msg.kind] ?? labels.speed, textColors[msg.kind] ?? textColors.speed);
        break;
      }

      case 'presence': {
        // Lets everyone in the room know when someone else's connection
        // drops or a spectator comes/goes — without this, a seat just
        // goes quiet with no explanation (see GameRoom.mjs's
        // handleDisconnect()/join() for where these are sent from).
        // Uses the same floating call-out text as in-match events
        // (shield-saved, powerup-collected) rather than a new toast
        // widget — top-center of the table, since this isn't tied to
        // any particular pen's position.
        const toastX = GAME.WIDTH / 2;
        const toastY = TABLE.Y + 36;

        if (msg.event === 'player-disconnected') {
          const label = `PLAYER ${msg.playerId + 1}`;
          const text = msg.duringMatch ? `${label} DISCONNECTED` : `${label} LEFT`;

          floatingText(this, toastX, toastY, text, '#c1272d');
        } else if (msg.event === 'spectator-joined') {
          this.spectatorCount = msg.spectators;
          this.refreshSpectatorText();
          floatingText(this, toastX, toastY, 'A spectator joined', '#8a7a63');
        } else if (msg.event === 'spectator-left') {
          this.spectatorCount = msg.spectators;
          this.refreshSpectatorText();
          floatingText(this, toastX, toastY, 'A spectator left', '#8a7a63');
        }

        break;
      }

      case 'cheer':
        // Broadcast to the whole room (see GameRoom.mjs's _onCheer(),
        // which validates msg.emoji against its own whitelist before
        // this ever arrives) — players see it too, not just the
        // spectator who sent it, so it reads as "the crowd is
        // cheering" rather than a private spectator-only effect.
        confettiBlast(this);
        cheerEmojiPop(this, msg.emoji);
        audioFX.playCheer();
        break;

      case 'room-error':
        this.statusText.setText('Room error');
        this.setSubText(msg.reason === 'not-found' ? 'That room no longer exists' : '', false);
        break;

      default:
        break;
    }
  }

  ensurePens() {
    if (this.pens.length !== this.maxPlayers) {
      this.pens = [];

      for (let i = 0; i < this.maxPlayers; i++) {
        const style = this.styles[i];
        const color = style ? style.color : this.colors[i] ?? PEN.COLORS[i % PEN.COLORS.length];
        const sticker = style ? style.sticker : '';
        const holo = style ? !!style.holo : false;

        this.pens[i] = new NetPen(this, GAME.WIDTH / 2, GAME.HEIGHT / 2, color, i, sticker, holo);
        this.pens[i].setConnected(false);

        // Pick up whatever this.dayNight (created earlier, in
        // createTable()) already settled on — see the day/night toggle
        // handler in createHud() for the other half of this, live
        // toggling once pens already exist.
        this.pens[i].setNightShadow(this.dayNight.getMode() === 'night');
      }

      return;
    }

    // Pens already exist — reconcile any per-seat style that arrived
    // (or changed) since they were created, e.g. a spectator's own
    // room-joined can beat another player's chosen style across the
    // wire, or a seat gets refilled by someone with a different style
    // after a restart.
    for (let i = 0; i < this.maxPlayers; i++) {
      const style = this.styles[i];

      if (style) this.pens[i].setStyle(style.color, style.sticker, style.holo);
    }
  }

  applyLobbyPositions() {
    for (const p of this.lobbyPlayers) {
      const pen = this.pens[p.playerId];

      if (!pen) continue;

      // Don't fight the local player's own in-progress drag.
      const isMyActiveDrag = this.drag && this.drag.mode === 'position' && p.playerId === this.myPlayerId;

      if (!isMyActiveDrag) pen.setTransform(p.x, p.y, 0);

      pen.setConnected(p.connected);

      // Make it obvious which pen is yours before you've even touched
      // it — full brightness + glow for your own seat, dimmed for
      // everyone else's (spectators see no distinction, since none of
      // these are "theirs" — see NetPen.setLobbyHighlight()).
      pen.setLobbyHighlight(this.myPlayerId === null ? null : p.playerId === this.myPlayerId);
    }
  }

  applyAliveState() {
    this.pens.forEach((pen, i) => {
      if (!pen) return;

      pen.setEliminated(!this.alive[i]);
    });
  }

  highlightCurrentPen() {
    if (this.chaosMode) {
      // No single "current" player — just highlight each connected
      // client's own pen so it's easy to spot at a glance.
      this.pens.forEach(
        (pen, i) => pen && pen.setSelected(this.mode === MODE.PLAYING && i === this.myPlayerId && this.alive[i] !== false),
      );
      return;
    }

    this.pens.forEach((pen, i) => pen && pen.setSelected(this.mode === MODE.PLAYING && i === this.turnState.currentIndex));
  }

  //--------------------------------------------------
  // Power-ups (optional, see the room's usePowerUps toggle) — purely
  // a render mirror of the server's authoritative this.powerUp; the
  // server alone decides spawn/pickup/expiry, this just keeps the
  // visual in sync with the current `state` snapshot.
  //--------------------------------------------------

  syncPowerUpView(serverPowerUp) {
    if (!serverPowerUp) {
      this.clearPowerUpView();
      return;
    }

    if (this.powerUpView && this.powerUpView.id === serverPowerUp.id) return;

    this.clearPowerUpView();

    const container = this.createPowerUpGraphics(
      serverPowerUp.kind,
      serverPowerUp.x,
      serverPowerUp.y,
      serverPowerUp.radius,
    );

    this.powerUpView = { id: serverPowerUp.id, container };
  }

  createPowerUpGraphics(kind, x, y, radius) {
    const container = this.add.container(x, y);

    container.setDepth(5);

    const g = this.add.graphics();

    if (kind === 'speed') {
      g.fillStyle(0xffd54f, 0.92);
      g.fillCircle(0, 0, radius * 0.55);
      g.lineStyle(3, 0xff8f00);
      g.strokeCircle(0, 0, radius * 0.55);

      container.add(g);

      const label = this.add.text(0, 0, '⚡', { fontSize: '26px' }).setOrigin(0.5);

      container.add(label);
    } else if (kind === 'helicopter') {
      g.fillStyle(0x26c6da, 0.92);
      g.fillCircle(0, 0, radius * 0.55);
      g.lineStyle(3, 0x00838f);
      g.strokeCircle(0, 0, radius * 0.55);

      container.add(g);

      const label = this.add.text(0, 0, '🚁', { fontSize: '24px' }).setOrigin(0.5);

      container.add(label);
    } else if (kind === 'shield') {
      g.fillStyle(0x42a5f5, 0.92);
      g.fillCircle(0, 0, radius * 0.55);
      g.lineStyle(3, 0x1565c0);
      g.strokeCircle(0, 0, radius * 0.55);

      container.add(g);

      const label = this.add.text(0, 0, '🛡️', { fontSize: '22px' }).setOrigin(0.5);

      container.add(label);
    } else {
      g.fillStyle(0x2b1a12, 0.4);
      g.fillCircle(0, 0, radius);
      g.lineStyle(2, 0x1a0f0a, 0.55);
      g.strokeCircle(0, 0, radius);

      container.add(g);
    }

    this.tweens.add({
      targets: container,
      scale: { from: 0.9, to: 1.08 },
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    return container;
  }

  clearPowerUpView() {
    if (this.powerUpView) {
      this.powerUpView.container.destroy();
      this.powerUpView = null;
    }
  }

  //--------------------------------------------------
  // HUD text
  //--------------------------------------------------

  //--------------------------------------------------
  // Turn timer bar — shown only mid-match, turn-based, useTurnTimer on
  //--------------------------------------------------

  updateTurnTimerBar() {
    // Outside PLAYING, this bar is owned by updateLobbyCountdown()
    // instead (LOBBY's placement countdown, or hidden entirely during
    // COUNTDOWN) — see its comment for why splitting ownership this
    // way rather than one hide() covering every mode doesn't fight
    // between the two.
    if (this.mode !== MODE.PLAYING) return;

    if (
      this.gameOver ||
      this.chaosMode ||
      !this.config.useTurnTimer ||
      !this.turnState.started ||
      this.turnState.turnTimeLeft < 0
    ) {
      this.netTurnTimer.hide();
      return;
    }

    this.netTurnTimer.show();
    this.netTurnTimer.setTime(this.turnState.turnTimeLeft, MATCH.TURN_TIME);
  }

  //--------------------------------------------------
  // Lobby placement countdown — reuses the same bar widget as the
  // in-match turn timer (same "time pressure" visual language players
  // already understand) to show how long is left in the
  // LOBBY_GRACE_MS window before positions lock in and the 3-2-1
  // countdown starts (see GameRoom.mjs's roomFullAt/placementGraceMs).
  // Ticked every frame from update() rather than event-driven, since a
  // countdown needs to visibly move between server messages.
  //--------------------------------------------------

  updateLobbyCountdown() {
    if (this.mode !== MODE.LOBBY || !this.lobbyDeadlineAt) {
      if (this.mode !== MODE.PLAYING) this.netTurnTimer.hide();
      return;
    }

    const msLeft = Math.max(0, this.lobbyDeadlineAt - Date.now());

    this.netTurnTimer.show();
    this.netTurnTimer.setTime(msLeft, this.lobbyGraceMs);
  }

  refreshHud() {
    this.updateTurnTimerBar();

    if (this.gameOver) return; // the overlay covers messaging now

    if (this.mode === MODE.LOBBY) {
      const joined = this.lobbyPlayers.filter((p) => p.connected).length;
      const full = joined === this.maxPlayers;

      this.statusText.setText(
        full ? 'ALL PLAYERS READY!' : `WAITING FOR PLAYERS (${joined}/${this.maxPlayers})`,
      );

      if (this.myPlayerId === null) {
        this.setSubText('You are spectating', false);
      } else if (full) {
        // Room just filled — a placement countdown is now running (see
        // updateLobbyCountdown()), so be explicit that there's a clock
        // on this, not just an open-ended "take your time".
        this.setSubText('Drag your pen to a starting spot before time runs out!', true);
      } else {
        this.setSubText('Drag your pen anywhere on the table to choose a starting spot', true);
      }

      return;
    }

    if (this.mode === MODE.COUNTDOWN) {
      this.statusText.setText('GET READY!');
      this.setSubText('', false);
      return;
    }

    if (this.pens.length) this.highlightCurrentPen();

    if (this.chaosMode) {
      this.statusText.setText('FREE FOR ALL');

      if (this.myPlayerId === null) {
        this.setSubText('You are spectating', false);
      } else if (this.alive[this.myPlayerId] === false) {
        this.setSubText('You are eliminated — watching it out', false);
      } else {
        this.setSubText(`${this.shootInstruction()} — anytime`, true);
      }

      return;
    }

    if (!this.turnState.started) {
      this.statusText.setText('Starting…');
      this.setSubText('', false);
      return;
    }

    const isMe = this.myPlayerId === this.turnState.currentIndex;
    const label = `PLAYER ${this.turnState.currentIndex + 1}`;

    if (this.turnState.waitingForSettle) {
      this.statusText.setText(`${label} SHOT — waiting for pens to settle…`);
      this.setSubText('', false);
      return;
    }

    if (this.myPlayerId === null) {
      this.statusText.setText(`${label}'s turn`);
      this.setSubText('You are spectating', false);
      return;
    }

    this.statusText.setText(isMe ? 'YOUR TURN' : `${label}'s turn`);

    // The turn-timer bar (see updateTurnTimerBar()) already shows this
    // exact countdown as a number — this used to *also* print "Xs to
    // shoot" here, right above the bar, which just duplicated it. One
    // clock, not two.
    this.setSubText(isMe ? this.shootInstruction() : '', isMe);
  }

  // Wording depends on THIS PLAYER's own flick-mode preference (see
  // personalFlickMode's comment in create()), not the room's shared
  // config — pull-back and swipe are opposite gestures, so "drag back"
  // would be actively misleading advice for a player who's personally
  // toggled to swipe, even in a room whose fixed physics convention is
  // pullback.
  shootInstruction() {
    return this.personalFlickMode === 'swipe'
      ? 'Swipe your pen to flick it'
      : 'Drag your pen back, then release';
  }

  //--------------------------------------------------
  // Input
  //--------------------------------------------------

  canIAct() {
    if (this.connectionLost || this.gameOver || this.mode !== MODE.PLAYING || this.myPlayerId === null) return false;

    // Chaos: no turn order — anyone still alive can shoot their own
    // pen whenever they like.
    if (this.chaosMode) return this.alive[this.myPlayerId] !== false;

    return (
      this.turnState.started &&
      this.turnState.turnActive &&
      !this.turnState.waitingForSettle &&
      this.turnState.currentIndex === this.myPlayerId
    );
  }

  onPointerDown(pointer) {
    if (this.drag) return;
    if (this.connectionLost) return;

    if (this.mode === MODE.LOBBY) {
      if (this.myPlayerId === null) return; // spectators can't place a pen

      const pen = this.pens[this.myPlayerId];

      if (!pen) return;

      const tolerance = pointer.wasTouch ? INPUT.TOUCH_RADIUS : 0;

      if (!pen.containsPoint(pointer.worldX, pointer.worldY, tolerance)) return;

      // pointer stored so update()'s self-heal check below can confirm
      // *this specific* pointer released, not just "some" pointer (see
      // that comment for why activePointer alone isn't reliable here).
      this.drag = { mode: 'position', pen, pointer };
      return;
    }

    if (this.mode !== MODE.PLAYING) return;
    if (!this.canIAct()) return;

    const pen = this.pens[this.myPlayerId];

    if (!pen) return;

    const tolerance = pointer.wasTouch ? INPUT.TOUCH_RADIUS : 0;

    if (!pen.containsPoint(pointer.worldX, pointer.worldY, tolerance)) return;

    this.drag = {
      mode: 'shoot',
      pointer,
      start: { x: pointer.worldX, y: pointer.worldY },
      current: { x: pointer.worldX, y: pointer.worldY },
    };
  }

  onPointerMove(pointer) {
    if (!this.drag) return;

    if (this.drag.mode === 'position') {
      this.drag.pen.setTransform(pointer.worldX, pointer.worldY, 0);

      // Live validity preview (see LobbyPlacement.js) — tints the pen
      // the instant the current spot would be rejected, instead of the
      // player only finding out after release (see onPointerUp()'s
      // matching final check for why that round trip felt "laggy").
      const others = this.lobbyPlayers.filter((p) => p.playerId !== this.myPlayerId && p.connected);

      this.drag.pen.setPlacementValid(isValidPlacement(pointer.worldX, pointer.worldY, others));
      return;
    }

    this.drag.current.x = pointer.worldX;
    this.drag.current.y = pointer.worldY;
  }

  // pointer — the specific Phaser Pointer that released, passed
  // straight through from the 'pointerup' listener (see create()) or
  // from update()'s self-heal check. Optional (defaults to whatever
  // drag is in progress) so the self-heal check can still call this
  // with no argument for the no-drag-at-all early-out.
  onPointerUp(pointer) {
    if (!this.drag) return;

    if (this.drag.mode === 'position') {
      const pen = this.drag.pen;

      this.drag = null;

      // Final check, right where the drag actually ended — mirrors
      // GameRoom.mjs's own _isValidPlacement() closely enough that an
      // invalid drop is now visibly obvious *before* release (see the
      // live preview in onPointerMove()), so this just needs to catch
      // it and snap back instantly rather than waiting on a server
      // round trip to reject it and correct the position later. A
      // valid drop still gets sent so the server can confirm it as
      // authoritative and broadcast it to everyone else.
      const others = this.lobbyPlayers.filter((p) => p.playerId !== this.myPlayerId && p.connected);
      const valid = isValidPlacement(pen.container.x, pen.container.y, others);

      pen.setPlacementValid(true);

      if (!valid) {
        const last = this.lobbyPlayers.find((p) => p.playerId === this.myPlayerId);

        if (last) pen.setTransform(last.x, last.y, 0);

        return; // nothing changed server-side — no need to send anything
      }

      send({ type: 'set-position', x: pen.container.x, y: pen.container.y });
      return;
    }

    const { start, current } = this.drag;

    this.drag = null;
    this.aimGraphics.clear();

    const dx = start.x - current.x;
    const dy = start.y - current.y;

    if (Math.hypot(dx, dy) < INPUT.MIN_DRAG_DISTANCE) return;

    if (!this.canIAct()) {
      // The turn/settle window can close mid-drag (deciding how hard
      // to pull takes a moment) — tell the player plainly instead of
      // just silently dropping their shot, which otherwise reads as
      // "the game stopped responding" rather than "you were a beat
      // late" (see the reported "can't flick a second time" issue).
      this.setSubText("Too slow — that turn's over", false);

      if (this.subMessageTimer) this.subMessageTimer.remove();

      this.subMessageTimer = this.time.delayedCall(1400, () => {
        this.subMessageTimer = null;
        this.refreshHud();
      });

      return;
    }

    // The room's physics convention (config.flickMode) is fixed and
    // shared by every client — the server always applies it to
    // whichever point it's told is "touch" vs "release" (see
    // GameRoom.mjs's _onShoot()). When this player's personal
    // preference (personalFlickMode) differs from the room's, swapping
    // which raw point gets labeled touch/release here is enough to
    // make the server's fixed formula produce exactly what this player
    // intended — no server changes needed, and no other client even
    // needs to know this player prefers something different.
    const swapped = this.personalFlickMode !== this.config.flickMode;
    const touchPt = swapped ? current : start;
    const releasePt = swapped ? start : current;

    send({
      type: 'shoot',
      touchX: touchPt.x,
      touchY: touchPt.y,
      releaseX: releasePt.x,
      releaseY: releasePt.y,
    });

    // Client-side prediction — start the shooter's own pen moving
    // immediately instead of waiting a full network round trip for the
    // server's next 'state' broadcast to confirm the shot (see
    // NetPen.predictShot()/updatePrediction()). Mirrors the server's
    // own computeShotVelocity() math (PhysicsEngine.mjs) so the
    // predicted motion matches what's about to actually happen — this
    // is purely local/visual, so it just uses this player's own actual
    // intent (personalFlickMode) directly against the raw drag delta,
    // independent of the touch/release swap above.
    const myPen = this.pens[this.myPlayerId];

    if (myPen) {
      // 'pullback' (default): shot flies opposite the drag — dx/dy
      // above already are that. 'swipe': shot flies the *same* way as
      // the drag.
      let ddx = this.personalFlickMode === 'swipe' ? -dx : dx;
      let ddy = this.personalFlickMode === 'swipe' ? -dy : dy;
      let length = Math.hypot(ddx, ddy);

      if (length > INPUT.MAX_DRAG_DISTANCE) {
        const scale = INPUT.MAX_DRAG_DISTANCE / length;

        ddx *= scale;
        ddy *= scale;
        length = INPUT.MAX_DRAG_DISTANCE;
      }

      const dragAmount = length / INPUT.MAX_DRAG_DISTANCE;
      const power = Phaser.Math.Easing.Cubic.Out(Phaser.Math.Clamp(dragAmount, 0, 1));

      myPen.predictShot(
        ddx * INPUT.IMPULSE_MULTIPLIER * power * SCALE,
        ddy * INPUT.IMPULSE_MULTIPLIER * power * SCALE,
      );
    }
  }

  //--------------------------------------------------
  // Update — advances any in-flight shot prediction (see NetPen), plus
  // the aim line; everything else is event-driven.
  //--------------------------------------------------

  update(time, delta) {
    // Safety net: if a pointerup event ever goes missing — a fast
    // swipe can easily carry the pointer past the canvas edge before
    // release, more so than a slow pull-back drag — this.drag would
    // otherwise stay stuck forever, since onPointerDown() bails out
    // early whenever this.drag is already set. That would silently
    // block *every* future shot attempt for the rest of the match,
    // which is exactly what a missed pointerup here would look like
    // (see the reported "can't flick a second time" issue). Checked
    // against the *specific* pointer this drag started with (stored on
    // this.drag — see onPointerDown()), not just Phaser's
    // this.input.activePointer: on multitouch-capable devices,
    // activePointer tracks whichever pointer moved most recently, which
    // isn't necessarily the one that actually owns this drag — a stray
    // second touch elsewhere on the screen could make activePointer
    // report "still down" even after the real drag's pointer already
    // released, masking exactly the kind of missed pointerup this check
    // exists to catch.
    if (this.drag && !this.drag.pointer.isDown) {
      this.onPointerUp(this.drag.pointer);
    }

    this.updateLobbyCountdown();

    for (const pen of this.pens) {
      if (pen) pen.updatePrediction(delta);
    }

    this.aimGraphics.clear();

    if (!this.drag || this.drag.mode !== 'shoot') return;

    const { start, current } = this.drag;

    const length = Math.hypot(current.x - start.x, current.y - start.y);

    let color = 0x00ff00;

    if (length > 60) color = 0xffff00;
    if (length > 120) color = 0xff0000;

    this.aimGraphics.lineStyle(4, color);
    this.aimGraphics.beginPath();
    this.aimGraphics.moveTo(start.x, start.y);
    this.aimGraphics.lineTo(current.x, current.y);
    this.aimGraphics.strokePath();

    this.aimGraphics.fillStyle(color);
    this.aimGraphics.fillCircle(current.x, current.y, 6);
  }
}
