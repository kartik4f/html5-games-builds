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
  WIDTH: 1280,
  HEIGHT: 720,

  // Notebook paper backdrop
  BACKGROUND: 0xfbf3df,

  FPS: 60,
};

//--------------------------------------------------
// Table
//--------------------------------------------------

export const TABLE = {
  X: 100,
  Y: 60,

  WIDTH: 1080,
  HEIGHT: 600,

  // Wooden chalkboard frame
  BORDER: 14,

  // Chalkboard green playing surface
  COLOR: 0x2f4a3d,

  // Wood frame
  BORDER_COLOR: 0x7a5230,

  CORNER_RADIUS: 16,
};

//--------------------------------------------------
// Pen
//--------------------------------------------------

export const PEN = {
  LENGTH: 145,

  WIDTH: 16,

  END_RADIUS: 8,

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

  COLORS: [0x1e88e5, 0x43a047, 0xe53935],

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
