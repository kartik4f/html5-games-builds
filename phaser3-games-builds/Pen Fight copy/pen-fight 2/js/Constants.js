//==================================================
// Constants.js
//==================================================

//--------------------------------------------------
// Physics scale
//--------------------------------------------------

export const SCALE = 50;

//--------------------------------------------------
// Game
//--------------------------------------------------

export const GAME = {
  // Portrait canvas (9:16) — scaled/letterboxed to fit any device via
  // Phaser.Scale.FIT (see the Phaser.Game config in js/main.js), so
  // this is a design resolution, not a literal device size. Table/HUD
  // layout below is all relative to these two numbers, so this is the one
  // place to retune the aspect ratio.
  WIDTH: 720,
  HEIGHT: 1280,

  // Notebook paper backdrop
  BACKGROUND: 0xfbf3df,

  FPS: 60,
};

//--------------------------------------------------
// Table
//--------------------------------------------------
// Taller-than-wide to suit the portrait canvas above. Y leaves room
// at the top for the HUD (turn/status text, timers); the bottom
// margin leaves room for GameScene's TurnTimer bar, which docks near
// the bottom edge (see js/ui/TurnTimer.js).

export const TABLE = {
  X: 40,
  Y: 170,

  WIDTH: 640,
  HEIGHT: 1000,

  CORNER_RADIUS: 10,

  //------------------------------------------
  // Top-down wood desk look (see TableView.js)
  //------------------------------------------

  WOOD_BASE: 0xb5793f,
  WOOD_GRAIN_LIGHT: 0xc9924f,
  WOOD_GRAIN_DARK: 0x8f5c2e,

  // Thin seam marking where the table ends — not a wall, pens are
  // meant to be able to slide straight across it and off the table.
  EDGE_COLOR: 0x5c3a1e,
  EDGE_WIDTH: 3,

  SHADOW_COLOR: 0x000000,
};

//--------------------------------------------------
// Pen
//--------------------------------------------------

export const PEN = {
  // Bumped up from 145/16/8 — a little bigger/easier to see and grab,
  // especially on touch devices. END_RADIUS must stay WIDTH/2 (the
  // fixture composition — a center box plus two end circles — only
  // forms a true capsule/stadium shape when the end-cap radius matches
  // the barrel's half-width, see Pen.js's createBody()).
  LENGTH: 165,

  WIDTH: 20,

  END_RADIUS: 10,

  // Medium-weight pen
  DENSITY: 1.2,

  // Moderate table friction
  FRICTION: 0.5,

  // A little rebound on collisions, without turning into a bouncy ball
  RESTITUTION: 1,

  // Slides naturally
  LINEAR_DAMPING: 1.9,

  // Stable rotation
  ANGULAR_DAMPING: 2.2,

  // Single-player uses the first 3 (blue/green/red); multiplayer
  // rooms can go up to 4 players and add the 4th (violet).
  COLORS: [0x1e88e5, 0x43a047, 0xe53935, 0x8e24aa],

  ELIMINATION_PADDING: 6,
};
//--------------------------------------------------
// Input
//--------------------------------------------------

export const INPUT = {
  // Maximum pull distance
  MAX_DRAG_DISTANCE: 160,

  // Ignore tiny drags
  MIN_DRAG_DISTANCE: 8,

  // Base impulse (scaled by mass)
  IMPULSE_MULTIPLIER: 0.2,

  TOUCH_RADIUS: 34,

  MAX_POINTERS: 4,
};
//--------------------------------------------------
// Juice (particles / sound) tuning — shared by both single-player
// (GameScene) and multiplayer (NetGameScene) so the two modes feel
// consistent and there's one place to retune "feel".
//--------------------------------------------------

export const JUICE = {
  // Divide a pen-on-pen relative impact speed (px/s) by this to get a
  // 0..1 "how hard was that hit" strength for sound/particles.
  COLLISION_SPEED_CALIBRATION_PX: 320,

  // Below this strength, skip juice entirely (too gentle to matter).
  MIN_STRENGTH: 0.08,
};

//--------------------------------------------------
// Debug
//--------------------------------------------------

export const DEBUG = {
  ENABLED: false,

  DRAW_BODIES: true,

  DRAW_CENTERS: true,

  DRAW_SLEEPING: true,

  DRAW_CONTACTS: true,

  DRAW_VELOCITIES: true,
};
