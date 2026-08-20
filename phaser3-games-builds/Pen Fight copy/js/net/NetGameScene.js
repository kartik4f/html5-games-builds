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
import { setHandlerAndCatchUp, send, closeSocket } from './connection.js';
import audioFX from '../AudioFX.js';
import { burst, eliminationPuff, floatingText } from '../JuiceFX.js';
import { getWinStreak, recordMatchOutcome } from './WinStreak.js';
import { returnHome } from '../AppShell.js';
import TurnTimer from '../ui/TurnTimer.js';

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

    this.createTable();
    this.createHud();
    this.createCountdownUI();
    this.createGameOverUI();

    this.mode = MODE.LOBBY;

    this.myPlayerId = null;
    this.maxPlayers = 2;
    this.colors = PEN.COLORS;
    this.roomCode = '';
    this.config = { useTurnTimer: true, waitForSettle: true, useMatchTimeLimit: false, chaosMode: false };
    this.chaosMode = false;

    this.pens = []; // NetPen[], index-matched to server playerId
    this.lobbyPlayers = [];
    this.lastPenPositions = {}; // playerId -> {x,y}, for trail deltas
    this.powerUpView = null; // { id, container } — mirrors server's this.powerUp

    this.turnState = { currentIndex: 0, turnActive: false, waitingForSettle: false, turnTimeLeft: -1, started: false };
    this.connected = [];
    this.alive = [];
    this.gameOver = false;
    this.winner = null;

    this.aimGraphics = this.add.graphics();
    this.drag = null;

    this.input.on('pointerdown', (p) => this.onPointerDown(p));
    this.input.on('pointermove', (p) => this.onPointerMove(p));
    this.input.on('pointerup', () => this.onPointerUp());

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
    drawTable(this);
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

    this.homeButtonDom = this.add
      .dom(homeX, homeY)
      .createFromHTML('<div class="hud-home-btn">← Home</div>')
      .setOrigin(0, 0);
    this.homeButtonDom.setDepth(1000);

    const homeEl = this.homeButtonDom.node.children[0];

    homeEl.addEventListener('click', () => {
      closeSocket();
      this.scene.stop();
      returnHome();
    });

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

    // Per-browser bragging-rights streak (see WinStreak.js) — a local
    // stat, not something the server tracks. Right-edge anchored.
    const streakW = 280;

    this.streakDom = this.add
      .dom(GAME.WIDTH - 16 - streakW, homeY)
      .createFromHTML('<div class="hud-net-streak"></div>')
      .setOrigin(0, 0);
    this.streakDom.setDepth(1000);

    const streakEl = this.streakDom.node.children[0];

    this.streakText = { setText: (t) => { streakEl.textContent = t; } };

    this.refreshStreakText();
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

    if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});

    this.roomCodeText.setText(`Room ${this.roomCode} — link copied!`);

    this.time.delayedCall(1500, () => this.updateRoomCodeText());
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
        this.roomCode = msg.code;
        this.config = msg.config;
        this.chaosMode = !!msg.config.chaosMode;

        this.ensurePens();
        this.updateRoomCodeText();
        this.refreshHud();
        break;

      case 'lobby-state':
        this.mode = MODE.LOBBY;
        this.roomCode = msg.code;
        this.maxPlayers = msg.maxPlayers;
        this.colors = msg.colors;
        this.config = msg.config;
        this.chaosMode = !!msg.config.chaosMode;
        this.lobbyPlayers = msg.players;

        this.ensurePens();
        this.applyLobbyPositions();
        this.updateRoomCodeText();
        this.hideCountdown();
        this.hideGameOver();
        this.clearPowerUpView();
        this.refreshHud();
        break;

      case 'countdown':
        this.mode = MODE.COUNTDOWN;
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

        const isHelicopter = msg.kind === 'helicopter';
        const color = isHelicopter ? 0x26c6da : 0xffd54f;

        burst(this, msg.x, msg.y, color, { count: 16, speed: 200 });
        floatingText(
          this,
          msg.x,
          msg.y - 40,
          isHelicopter ? '🚁 HELICOPTER SHOT!' : '⚡ SPEED BOOST!',
          isHelicopter ? '#00838f' : '#c98a1f',
        );
        break;
      }

      case 'room-error':
        this.statusText.setText('Room error');
        this.setSubText(msg.reason === 'not-found' ? 'That room no longer exists' : '', false);
        break;

      default:
        break;
    }
  }

  ensurePens() {
    if (this.pens.length === this.maxPlayers) return;

    this.pens = [];

    for (let i = 0; i < this.maxPlayers; i++) {
      const color = this.colors[i] ?? PEN.COLORS[i % PEN.COLORS.length];

      this.pens[i] = new NetPen(this, GAME.WIDTH / 2, GAME.HEIGHT / 2, color, i);
      this.pens[i].setConnected(false);
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
    if (
      this.gameOver ||
      this.mode !== MODE.PLAYING ||
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

  refreshHud() {
    this.updateTurnTimerBar();

    if (this.gameOver) return; // the overlay covers messaging now

    if (this.mode === MODE.LOBBY) {
      const joined = this.lobbyPlayers.filter((p) => p.connected).length;

      this.statusText.setText(`WAITING FOR PLAYERS (${joined}/${this.maxPlayers})`);

      if (this.myPlayerId === null) {
        this.setSubText('You are spectating', false);
      } else {
        this.setSubText('Drag your pen to choose a starting spot', true);
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
        this.setSubText('Drag your pen back, then release — anytime', true);
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

    if (isMe && this.turnState.turnTimeLeft >= 0) {
      // A live countdown number — no pulse here, it's already urgent
      // on its own, and re-pulsing every second would look jittery.
      this.setSubText(`${Math.ceil(this.turnState.turnTimeLeft / 1000)}s to shoot`, false);
    } else {
      this.setSubText(isMe ? 'Drag your pen back, then release' : '', isMe);
    }
  }

  //--------------------------------------------------
  // Input
  //--------------------------------------------------

  canIAct() {
    if (this.gameOver || this.mode !== MODE.PLAYING || this.myPlayerId === null) return false;

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

    if (this.mode === MODE.LOBBY) {
      if (this.myPlayerId === null) return; // spectators can't place a pen

      const pen = this.pens[this.myPlayerId];

      if (!pen) return;

      const tolerance = pointer.wasTouch ? INPUT.TOUCH_RADIUS : 0;

      if (!pen.containsPoint(pointer.worldX, pointer.worldY, tolerance)) return;

      this.drag = { mode: 'position', pen };
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
      start: { x: pointer.worldX, y: pointer.worldY },
      current: { x: pointer.worldX, y: pointer.worldY },
    };
  }

  onPointerMove(pointer) {
    if (!this.drag) return;

    if (this.drag.mode === 'position') {
      this.drag.pen.setTransform(pointer.worldX, pointer.worldY, 0);
      return;
    }

    this.drag.current.x = pointer.worldX;
    this.drag.current.y = pointer.worldY;
  }

  onPointerUp() {
    if (!this.drag) return;

    if (this.drag.mode === 'position') {
      const pen = this.drag.pen;

      this.drag = null;

      send({ type: 'set-position', x: pen.container.x, y: pen.container.y });
      return;
    }

    const { start, current } = this.drag;

    this.drag = null;
    this.aimGraphics.clear();

    const dx = start.x - current.x;
    const dy = start.y - current.y;

    if (Math.hypot(dx, dy) < INPUT.MIN_DRAG_DISTANCE) return;
    if (!this.canIAct()) return;

    send({
      type: 'shoot',
      touchX: start.x,
      touchY: start.y,
      releaseX: current.x,
      releaseY: current.y,
    });

    // Client-side prediction — start the shooter's own pen moving
    // immediately instead of waiting a full network round trip for the
    // server's next 'state' broadcast to confirm the shot (see
    // NetPen.predictShot()/updatePrediction()). Mirrors the server's
    // own computeShotVelocity() math (PhysicsEngine.mjs) so the
    // predicted motion matches what's about to actually happen.
    const myPen = this.pens[this.myPlayerId];

    if (myPen) {
      let ddx = dx;
      let ddy = dy;
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
