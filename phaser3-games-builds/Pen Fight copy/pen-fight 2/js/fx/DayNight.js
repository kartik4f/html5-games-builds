//==================================================
// DayNight.js
//==================================================
// Manual day/night theme toggle — shared by GameScene.js (local) and
// NetGameScene.js (online) via the ☀️/🌙 HUD button (see
// ui/DayNightToggle.js). Dims the table; on WebGL it also layers
// Phaser's real Light2D system on top with a few warm point lights
// positioned like desk lamps, so pens crossing under one visibly
// brighten.
//
// Falls back to a flat semi-transparent dark overlay on the Canvas
// renderer, where Light2D isn't available, so a night theme is never
// just missing for whoever's on an older device.
//
// Persisted per-browser in localStorage — same small-store pattern as
// PlayerProfile.js / WinStreak.js — so a player's choice survives
// leaving and coming back, without needing an account or server round
// trip for something this cosmetic.
//==================================================

import { TABLE } from '../Constants.js';

const STORAGE_KEY = 'penfight_daynight_v1';

const NIGHT_BG = 0x14172a;
const DAY_BG = 0xfbf3df; // matches GAME.BACKGROUND — restored verbatim on 'day'

const NIGHT_AMBIENT = 0x3a3f5c;

const NIGHT_OVERLAY_COLOR = 0x0a0e2a;
const NIGHT_OVERLAY_ALPHA = 0.45;

// Positions expressed as fractions of the table's own box (dx: -0.5..0.5
// from center, dy: 0..1 down from the top) so these scale automatically
// if TABLE's own dimensions are ever retuned in Constants.js.
const LAMP_LIGHTS = [
  { dx: 0, dy: 0.18, radius: 340, color: 0xfff3c4, intensity: 1.6 },
  { dx: -0.42, dy: 0.62, radius: 300, color: 0xffe6a8, intensity: 1.3 },
  { dx: 0.42, dy: 0.62, radius: 300, color: 0xffe6a8, intensity: 1.3 },
];

function loadMode() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'night' ? 'night' : 'day';
  } catch {
    return 'day'; // localStorage unavailable (private browsing, etc.)
  }
}

function saveMode(mode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Ignore — nothing useful to do if storage isn't available.
  }
}

function isWebGL(scene) {
  return scene?.sys?.game?.renderer?.type === Phaser.WEBGL;
}

// scene — the GameScene/NetGameScene instance.
// table — the Graphics object returned by TableView.js's drawTable(),
// the one thing that actually gets the Light2D pipeline (pens stay
// unlit/full-brightness on top of it, which reads fine — like glow-
// in-the-dark pens on a dim desk — without touching Pen.js/NetPen.js
// at all).
export function createDayNight(scene, table) {
  let mode = loadMode();
  let lights = [];
  let overlay = null;

  //------------------------------------------
  // Real Light2D lighting (WebGL only)
  //------------------------------------------

  function lampPositions() {
    return LAMP_LIGHTS.map((l) => ({
      ...l,
      x: TABLE.X + TABLE.WIDTH / 2 + l.dx * TABLE.WIDTH,
      y: TABLE.Y + TABLE.HEIGHT * l.dy,
    }));
  }

  function addLights() {
    try {
      scene.lights.enable();
      scene.lights.setAmbientColor(NIGHT_AMBIENT);

      lights = lampPositions().map((l) => scene.lights.addLight(l.x, l.y, l.radius, l.color, l.intensity));

      table.setPipeline('Light2D');

      return true;
    } catch (err) {
      // Fall through to the flat overlay below — degrade, don't crash.
      removeLights();

      return false;
    }
  }

  function removeLights() {
    for (const l of lights) {
      try {
        scene.lights.removeLight(l);
      } catch {
        // Ignore — best-effort cleanup only.
      }
    }

    lights = [];

    try {
      table.resetPipeline();
    } catch {
      // Ignore.
    }

    try {
      scene.lights.disable();
    } catch {
      // Ignore.
    }
  }

  //------------------------------------------
  // Flat overlay fallback — the Canvas-renderer path, and also just a
  // guaranteed-simple "it's dark now" cue if Light2D throws for any
  // reason on an unusual WebGL/driver combination.
  //------------------------------------------

  function ensureOverlay() {
    if (overlay) return;

    overlay = scene.add.graphics();
    overlay.setDepth(-95); // above the table (-100), below pens (default 0)
    overlay.fillStyle(NIGHT_OVERLAY_COLOR, NIGHT_OVERLAY_ALPHA);
    overlay.fillRoundedRect(TABLE.X, TABLE.Y, TABLE.WIDTH, TABLE.HEIGHT, TABLE.CORNER_RADIUS);
  }

  function removeOverlay() {
    if (!overlay) return;

    overlay.destroy();
    overlay = null;
  }

  //------------------------------------------
  // Apply whatever `mode` currently is to the live scene.
  //------------------------------------------

  function apply() {
    scene.cameras.main.setBackgroundColor(mode === 'night' ? NIGHT_BG : DAY_BG);

    // Always start from a clean slate before deciding what this call
    // needs — apply() isn't guaranteed to only ever run once per
    // actual mode change (e.g. a stray double-fired click on the
    // toggle button), so unconditionally tearing down any previously-
    // added lights/pipeline/overlay first keeps repeated calls
    // idempotent instead of leaking duplicate lights on top of the
    // ones an earlier call already added.
    removeLights();
    removeOverlay();

    if (mode === 'night') {
      const lit = isWebGL(scene) && addLights();

      if (!lit) ensureOverlay();
    }
  }

  apply();

  function setMode(next) {
    mode = next === 'night' ? 'night' : 'day';

    saveMode(mode);
    apply();

    return mode;
  }

  function toggle() {
    return setMode(mode === 'day' ? 'night' : 'day');
  }

  function destroy() {
    removeLights();
    removeOverlay();
  }

  return {
    getMode: () => mode,
    setMode,
    toggle,
    destroy,
  };
}
