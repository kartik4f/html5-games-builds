//==================================================
// MenuScene.js
//==================================================
// The start screen (Home -> Classroom / Vs Computer / Online), built
// as a Phaser DOM Element instead of a plain HTML overlay living
// outside the game. That means it's parented inside Phaser's DOM
// container and scaled/letterboxed by the Scale Manager exactly like
// the canvas — one coordinate system, one scaling story, for the
// whole app (see GAME in Constants.js and the dom.createContainer
// config in main.js).
//
// The markup itself lives in menu.html (loaded once via
// this.load.html()) — this file just wires it up: showing/hiding
// screens, toggles/steppers, and handing off to GameScene/NetGameScene
// once the player picks a mode. Every previous main.js DOM-overlay
// responsibility now lives here instead.
//==================================================

import { GAME } from './Constants.js';
import { MATCH, GAME_MODE, POWERUPS, LOCAL_MATCH, AI, CONTROLS } from './GameConfig.js';
import { ensureSocket, onOpen, send, setHandler } from './net/connection.js';
import { PENS, STICKERS, TEXTURES, levelForWins, nextLevel, isUnlocked } from './PenLibrary.js';
import { getProfile, setSelectedPen, setSelectedSticker, setCustomSticker, setSelectedTexture, getSelectedStyle } from './PlayerProfile.js';
import audioFX from './AudioFX.js';

// The ?room=CODE auto-join link should only ever be honored once, the
// very first time the app loads — not every time the player returns
// to this scene (e.g. after a match, via "Main Menu"). Module-level
// state persists across MenuScene restarts within the same page load.
let autoJoinAttempted = false;

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super('MenuScene');
  }

  //--------------------------------------------------
  // Preload — the HTML fragment only needs to be fetched once; Phaser's
  // html cache persists across scene restarts.
  //--------------------------------------------------

  preload() {
    if (!this.cache.html.has('menu-html')) {
      this.load.html('menu-html', 'menu.html');
    }
  }

  //--------------------------------------------------
  // Create
  //--------------------------------------------------

  create() {
    this.cameras.main.setBackgroundColor(GAME.BACKGROUND);

    this.menuDom = this.add
      .dom(0, 0)
      .createFromCache('menu-html')
      .setOrigin(0, 0);

    const root = this.menuDom.node;

    // Sized in the same game-unit pixels as everything else — Phaser's
    // DOM container transform handles scaling this along with the
    // canvas, so this is authored space, not real device pixels.
    root.style.width = `${GAME.WIDTH}px`;
    root.style.height = `${GAME.HEIGHT}px`;

    const $ = (id) => root.querySelector(`#${id}`);

    //------------------------------------------
    // Screens
    //------------------------------------------

    const screens = {
      home: $('screen-home'),
      classroom: $('screen-classroom'),
      vsComputer: $('screen-vs-computer'),
      onlineMain: $('screen-online-main'),
      create: $('screen-create'),
      join: $('screen-join'),
      status: $('screen-status'),
      penLocker: $('screen-pen-locker'),
    };

    const showScreen = (name) => {
      for (const key of Object.keys(screens)) {
        screens[key].classList.toggle('hidden', key !== name);
      }
    };

    const showStatus = (text) => {
      $('status-text').textContent = text;
      showScreen('status');
    };

    //------------------------------------------
    // Mute toggle (see menu.html's #btn-mute) — a floating corner
    // button, a sibling of every screen panel above rather than
    // nested inside `screens`, so it's visible regardless of which
    // one showScreen() currently has active. Reflects/persists
    // AudioFX.js's own muted flag (see its own MUTED_STORAGE_KEY) —
    // this is just the UI for it, not where the state actually lives.
    //------------------------------------------

    const muteBtn = $('btn-mute');

    const refreshMuteBtn = () => {
      const muted = audioFX.muted;

      muteBtn.textContent = muted ? '🔇' : '🔊';
      muteBtn.classList.toggle('muted', muted);
      muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
      muteBtn.title = muted ? 'Unmute' : 'Mute';
    };

    muteBtn.addEventListener('click', () => {
      audioFX.toggleMuted();
      refreshMuteBtn();
    });

    refreshMuteBtn();

    $('btn-home-online').addEventListener('click', () =>
      showScreen('onlineMain'),
    );
    $('btn-home-classroom').addEventListener('click', () =>
      showScreen('classroom'),
    );
    $('btn-home-computer').addEventListener('click', () =>
      showScreen('vsComputer'),
    );
    $('back-from-online-main').addEventListener('click', () =>
      showScreen('home'),
    );
    $('back-from-classroom').addEventListener('click', () =>
      showScreen('home'),
    );
    $('back-from-vc').addEventListener('click', () => showScreen('home'));

    $('btn-home-pen-locker').addEventListener('click', () => {
      showScreen('penLocker');
      refreshPenLocker();
    });
    $('back-from-pen-locker').addEventListener('click', () => showScreen('home'));

    //------------------------------------------
    // Small shared UI helpers (scoped to this menu instance's DOM)
    //------------------------------------------

    // A toggle button that flips ON/OFF and reports its state.
    const wireToggle = (id) => {
      const btn = $(id);

      btn.addEventListener('click', () => {
        const on = btn.dataset.on !== 'true';

        btn.dataset.on = String(on);
        btn.textContent = on ? 'ON' : 'OFF';
        btn.classList.toggle('on', on);
      });

      return () => btn.dataset.on === 'true';
    };

    // A row of mutually-exclusive buttons (mode select, difficulty select).
    const wireChoiceGroup = (ids, initialValue) => {
      const buttons = ids.map((id) => $(id));

      let current = initialValue;

      function refresh() {
        buttons.forEach((b) =>
          b.classList.toggle('active', b.dataset.value === current),
        );
      }

      buttons.forEach((b) => {
        b.addEventListener('click', () => {
          current = b.dataset.value;
          refresh();
        });
      });

      refresh();

      return () => current;
    };

    // Hide/show the turn-based-only toggle rows for a given screen
    // prefix depending on whether Chaos was picked — chaos runs on its
    // own fixed whole-match countdown, so those toggles wouldn't do
    // anything.
    const wireModeVisibility = (prefix, getMode) => {
      const rowIds = [
        `${prefix}-row-turn-timer`,
        `${prefix}-row-wait-settle`,
        `${prefix}-row-match-time`,
      ];

      return () => {
        const chaos = getMode() === GAME_MODE.CHAOS;

        for (const id of rowIds) {
          $(id).classList.toggle('hidden', chaos);
        }
      };
    };

    const wireStepper = (minusId, plusId, valueId, min, max, initial) => {
      const valueEl = $(valueId);

      let value = initial;
      valueEl.textContent = String(value);

      $(minusId).addEventListener('click', () => {
        value = Math.max(min, value - 1);
        valueEl.textContent = String(value);
      });

      $(plusId).addEventListener('click', () => {
        value = Math.min(max, value + 1);
        valueEl.textContent = String(value);
      });

      return () => value;
    };

    //------------------------------------------
    // Classroom setup
    //------------------------------------------

    const classroomMode = wireChoiceGroup(
      ['classroom-mode-turn-based', 'classroom-mode-chaos'],
      GAME_MODE.TURN_BASED,
    );
    const refreshClassroomVisibility = wireModeVisibility(
      'classroom',
      classroomMode,
    );

    $('classroom-mode-turn-based').addEventListener(
      'click',
      refreshClassroomVisibility,
    );
    $('classroom-mode-chaos').addEventListener(
      'click',
      refreshClassroomVisibility,
    );
    refreshClassroomVisibility();

    const classroomFlickMode = wireChoiceGroup(
      ['classroom-flick-pullback', 'classroom-flick-swipe'],
      'pullback',
    );

    const classroomPlayers = wireStepper(
      'classroom-players-minus',
      'classroom-players-plus',
      'classroom-players-value',
      2,
      4,
      3,
    );

    const isClassroomTurnTimerOn = wireToggle('classroom-toggle-turn-timer');
    const isClassroomWaitSettleOn = wireToggle('classroom-toggle-wait-settle');
    const isClassroomMatchTimeOn = wireToggle('classroom-toggle-match-time');
    const isClassroomPowerUpsOn = wireToggle('classroom-toggle-power-ups');

    $('btn-classroom-start').addEventListener('click', () => {
      const isTurnBased = classroomMode() === GAME_MODE.TURN_BASED;

      MATCH.MODE = classroomMode();
      MATCH.USE_TURN_TIMER = isClassroomTurnTimerOn();
      MATCH.WAIT_FOR_SETTLE = isTurnBased ? isClassroomWaitSettleOn() : false;
      MATCH.USE_MATCH_TIME_LIMIT = isTurnBased
        ? isClassroomMatchTimeOn()
        : false;

      POWERUPS.ENABLED = isClassroomPowerUpsOn();
      CONTROLS.FLICK_MODE = classroomFlickMode();

      LOCAL_MATCH.PLAYER_COUNT = classroomPlayers();
      AI.PLAYER_IDS = []; // Classroom is human-only, on the same device

      this.scene.stop();
      this.scene.start('GameScene');
    });

    //------------------------------------------
    // Vs Computer setup
    //------------------------------------------

    const vcMode = wireChoiceGroup(
      ['vc-mode-turn-based', 'vc-mode-chaos'],
      GAME_MODE.TURN_BASED,
    );
    const refreshVcVisibility = wireModeVisibility('vc', vcMode);

    $('vc-mode-turn-based').addEventListener('click', refreshVcVisibility);
    $('vc-mode-chaos').addEventListener('click', refreshVcVisibility);
    refreshVcVisibility();

    const vcDifficulty = wireChoiceGroup(
      ['vc-diff-easy', 'vc-diff-medium', 'vc-diff-hard'],
      'medium',
    );
    const vcFlickMode = wireChoiceGroup(['vc-flick-pullback', 'vc-flick-swipe'], 'pullback');

    const vcOpponents = wireStepper(
      'vc-opponents-minus',
      'vc-opponents-plus',
      'vc-opponents-value',
      1,
      3,
      1,
    );

    const isVcTurnTimerOn = wireToggle('vc-toggle-turn-timer');
    const isVcWaitSettleOn = wireToggle('vc-toggle-wait-settle');
    const isVcMatchTimeOn = wireToggle('vc-toggle-match-time');
    const isVcPowerUpsOn = wireToggle('vc-toggle-power-ups');

    $('btn-vc-start').addEventListener('click', () => {
      const isTurnBased = vcMode() === GAME_MODE.TURN_BASED;

      MATCH.MODE = vcMode();
      MATCH.USE_TURN_TIMER = isVcTurnTimerOn();
      MATCH.WAIT_FOR_SETTLE = isTurnBased ? isVcWaitSettleOn() : false;
      MATCH.USE_MATCH_TIME_LIMIT = isTurnBased ? isVcMatchTimeOn() : false;

      POWERUPS.ENABLED = isVcPowerUpsOn();
      CONTROLS.FLICK_MODE = vcFlickMode();

      const opponents = vcOpponents();

      LOCAL_MATCH.PLAYER_COUNT = 1 + opponents; // playerId 0 is always the human
      AI.DIFFICULTY = vcDifficulty();
      AI.PLAYER_IDS = Array.from({ length: opponents }, (_, i) => i + 1);

      this.scene.stop();
      this.scene.start('GameScene');
    });

    //------------------------------------------
    // Online
    //------------------------------------------

    let onlineMaxPlayers = 2;

    const onlinePlayersValueEl = $('players-value');

    $('players-minus').addEventListener('click', () => {
      onlineMaxPlayers = Math.max(2, onlineMaxPlayers - 1);
      onlinePlayersValueEl.textContent = String(onlineMaxPlayers);
    });

    $('players-plus').addEventListener('click', () => {
      onlineMaxPlayers = Math.min(4, onlineMaxPlayers + 1);
      onlinePlayersValueEl.textContent = String(onlineMaxPlayers);
    });

    const onlineFlickMode = wireChoiceGroup(['flick-pullback', 'flick-swipe'], 'pullback');

    const isOnlineTurnTimerOn = wireToggle('toggle-turn-timer');
    const isOnlineWaitSettleOn = wireToggle('toggle-wait-settle');
    const isOnlineMatchTimeOn = wireToggle('toggle-match-time');
    const isOnlinePowerUpsOn = wireToggle('toggle-power-ups');
    const isOnlineChaosModeOn = wireToggle('toggle-chaos-mode');
    const isOnlineBestOf3On = wireToggle('toggle-best-of-3');

    $('toggle-chaos-mode').addEventListener('click', () => {
      const chaos = isOnlineChaosModeOn();

      for (const id of [
        'row-turn-timer',
        'row-wait-settle',
        'row-match-time',
      ]) {
        $(id).classList.toggle('hidden', chaos);
      }
    });

    const goOnline = () => {
      this.scene.stop();
      this.scene.start('NetGameScene');
    };

    // Handles whatever the server says while we're still in the
    // pre-room menu (not yet inside NetGameScene). Re-registered fresh
    // every time a Quick Play / Create / Join attempt starts, via
    // setHandler() below — see connection.js for why the socket itself
    // is a shared singleton rather than something owned by any one scene.
    const onlineMenuHandler = (msg) => {
      if (msg.type === 'room-joined') {
        const url = new URL(location.href);

        url.searchParams.set('room', msg.code);
        history.replaceState(null, '', url);

        goOnline();
        return;
      }

      if (msg.type === 'room-error') {
        joinErrorEl.textContent =
          msg.reason === 'not-found'
            ? "That room code doesn't exist."
            : 'Could not join that room.';

        showScreen('join');
      }
    };

    $('btn-quick-play').addEventListener('click', () => {
      showStatus('Finding a match…');
      ensureSocket();
      setHandler(onlineMenuHandler);
      onOpen(() => send({ type: 'quick-join', style: getSelectedStyle() }));
    });

    $('btn-create-room').addEventListener('click', () => showScreen('create'));
    $('back-from-create').addEventListener('click', () =>
      showScreen('onlineMain'),
    );

    $('btn-join-room').addEventListener('click', () => showScreen('join'));
    $('back-from-join').addEventListener('click', () =>
      showScreen('onlineMain'),
    );

    $('btn-do-create').addEventListener('click', () => {
      showStatus('Creating room…');
      ensureSocket();
      setHandler(onlineMenuHandler);
      onOpen(() =>
        send({
          type: 'create-room',
          maxPlayers: onlineMaxPlayers,
          useTurnTimer: isOnlineTurnTimerOn(),
          waitForSettle: isOnlineWaitSettleOn(),
          useMatchTimeLimit: isOnlineMatchTimeOn(),
          usePowerUps: isOnlinePowerUpsOn(),
          chaosMode: isOnlineChaosModeOn(),
          bestOf3: isOnlineBestOf3On(),
          flickMode: onlineFlickMode(),
          style: getSelectedStyle(),
        }),
      );
    });

    const codeInput = $('room-code-input');
    const joinErrorEl = $('join-error');

    const doJoin = () => {
      const code = codeInput.value.trim().toUpperCase();

      if (!code) return;

      joinErrorEl.textContent = '';
      showStatus(`Joining room ${code}…`);
      ensureSocket();
      setHandler(onlineMenuHandler);
      onOpen(() => send({ type: 'join-room', code, style: getSelectedStyle() }));
    };

    $('btn-do-join').addEventListener('click', doJoin);
    codeInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') doJoin();
    });

    //------------------------------------------
    // Pen Locker — select a base pen color + sticker, gated by wins
    // (see PenLibrary.js's unlockWins / PlayerProfile.js's wins
    // counter). Grids are built here at runtime from the catalog
    // rather than hardcoded in menu.html.
    //------------------------------------------

    const penGridEl = $('pen-grid');
    const stickerGridEl = $('sticker-grid');
    const textureGridEl = $('texture-grid');
    const levelNameEl = $('locker-level-name');
    const winsTextEl = $('locker-wins-text');
    const progressFillEl = $('locker-progress-fill');
    const previewPenEl = $('locker-preview-pen');
    const previewStickerEl = $('locker-preview-sticker');
    const customStickerInput = $('sticker-custom-input');
    const useCustomStickerBtn = $('btn-use-custom-sticker');

    const refreshPenLocker = () => {
      const profile = getProfile();
      const wins = profile.wins;
      const level = levelForWins(wins);
      const upNext = nextLevel(wins);

      levelNameEl.textContent = `Lv ${level.level} — ${level.name}`;
      winsTextEl.textContent = `${wins} win${wins === 1 ? '' : 's'}`;

      if (upNext) {
        const span = upNext.winsRequired - level.winsRequired;
        const into = wins - level.winsRequired;

        progressFillEl.style.width = `${Math.round((into / span) * 100)}%`;
      } else {
        progressFillEl.style.width = '100%';
      }

      const style = getSelectedStyle();

      const renderPreview = () => {
        previewPenEl.classList.toggle('holo-preview', !!style.holo);
        previewPenEl.style.background = style.holo ? '' : `#${style.color.toString(16).padStart(6, '0')}`;
        previewStickerEl.textContent = style.sticker;
      };

      renderPreview();

      // Pen grid
      penGridEl.innerHTML = '';

      for (const pen of PENS) {
        const unlocked = isUnlocked(pen, wins);

        const btn = document.createElement('div');

        btn.className = 'pen-swatch' + (pen.id === profile.penId ? ' selected' : '') + (unlocked ? '' : ' locked');
        btn.style.background = `#${pen.color.toString(16).padStart(6, '0')}`;
        btn.title = pen.name;

        if (!unlocked) {
          const lock = document.createElement('div');

          lock.className = 'swatch-lock';
          lock.innerHTML = `<span class="lock-icon">🔒</span><span>${pen.unlockWins} wins</span>`;
          btn.appendChild(lock);
        }

        btn.addEventListener('click', () => {
          if (!unlocked) return;

          setSelectedPen(pen.id);
          refreshPenLocker();
        });

        penGridEl.appendChild(btn);
      }

      // Sticker grid
      stickerGridEl.innerHTML = '';

      for (const sticker of STICKERS) {
        const unlocked = isUnlocked(sticker, wins);

        const btn = document.createElement('div');

        btn.className = 'sticker-swatch' + (sticker.id === profile.stickerId ? ' selected' : '') + (unlocked ? '' : ' locked');
        btn.textContent = sticker.emoji || '—';
        btn.title = sticker.name;

        if (!unlocked) {
          const lock = document.createElement('div');

          lock.className = 'swatch-lock';
          lock.innerHTML = `<span class="lock-icon">🔒</span><span>${sticker.unlockWins} wins</span>`;
          btn.appendChild(lock);
        }

        btn.addEventListener('click', () => {
          if (!unlocked) return;

          setSelectedSticker(sticker.id);
          refreshPenLocker();
        });

        stickerGridEl.appendChild(btn);
      }

      // Custom (typed/paste-your-own) sticker tile — always unlocked
      // (see setCustomSticker() in PlayerProfile.js), shown only once
      // the player has actually typed something at least once so the
      // grid doesn't show a confusing empty slot before then.
      if (profile.customStickerEmoji) {
        const btn = document.createElement('div');

        btn.className = 'sticker-swatch' + (profile.stickerId === 'custom' ? ' selected' : '');
        btn.textContent = profile.customStickerEmoji;
        btn.title = 'Your custom sticker';

        btn.addEventListener('click', () => {
          setCustomSticker(profile.customStickerEmoji);
          refreshPenLocker();
        });

        stickerGridEl.appendChild(btn);
      }

      // Texture grid — orthogonal to color/sticker (see PenLibrary.js's
      // TEXTURES) — e.g. the holographic shimmer shown via a CSS
      // gradient preview here, the real shader-driven version only
      // rendering in-game (see Pen.js/NetPen.js's setTextured()).
      textureGridEl.innerHTML = '';

      for (const texture of TEXTURES) {
        const unlocked = isUnlocked(texture, wins);

        const btn = document.createElement('div');

        btn.className =
          'texture-swatch' +
          (texture.id === 'holographic' ? ' holo-preview' : '') +
          (texture.id === profile.textureId ? ' selected' : '') +
          (unlocked ? '' : ' locked');
        btn.textContent = texture.name;
        btn.title = texture.name;

        if (!unlocked) {
          const lock = document.createElement('div');

          lock.className = 'swatch-lock';
          lock.innerHTML = `<span class="lock-icon">🔒</span><span>${texture.unlockWins} wins</span>`;
          btn.appendChild(lock);
        }

        btn.addEventListener('click', () => {
          if (!unlocked) return;

          setSelectedTexture(texture.id);
          refreshPenLocker();
        });

        textureGridEl.appendChild(btn);
      }

      // Keep the input showing whatever's currently saved, so
      // reopening this screen doesn't look like it forgot what was
      // typed — but never fight the player mid-keystroke.
      if (document.activeElement !== customStickerInput) {
        customStickerInput.value = profile.customStickerEmoji || '';
      }
    };

    const applyCustomSticker = () => {
      const value = customStickerInput.value;

      if (!value || !value.trim()) return;

      setCustomSticker(value);
      refreshPenLocker();
    };

    useCustomStickerBtn.addEventListener('click', applyCustomSticker);
    customStickerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyCustomSticker();
    });

    //------------------------------------------
    // Auto-join via ?room=CODE (shareable link) — skips straight past
    // Home, once per page load only (see autoJoinAttempted above).
    //------------------------------------------

    if (!autoJoinAttempted) {
      const roomFromLink = new URLSearchParams(location.search).get('room');

      if (roomFromLink) {
        autoJoinAttempted = true;

        codeInput.value = roomFromLink.toUpperCase();
        showStatus(`Joining room ${roomFromLink.toUpperCase()}…`);
        ensureSocket();
        setHandler(onlineMenuHandler);
        onOpen(() =>
          send({ type: 'join-room', code: roomFromLink.toUpperCase(), style: getSelectedStyle() }),
        );
      }
    }
  }
}
