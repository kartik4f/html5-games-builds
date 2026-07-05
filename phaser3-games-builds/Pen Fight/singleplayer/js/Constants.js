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

  BACKGROUND: 0xc2c2c2,

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

  BORDER: 6,

  COLOR: 0x684082,

  BORDER_COLOR: 0x5d4037,

  CORNER_RADIUS: 16,
};

//--------------------------------------------------
// Pen Physics
//--------------------------------------------------
/* 
export const PEN = {
  LENGTH: 120,

  WIDTH: 14,

  END_RADIUS: 7,

  DENSITY: 1.0,

  FRICTION: 0.35,

  RESTITUTION: 0.25,

  LINEAR_DAMPING: 0.4,

  ANGULAR_DAMPING: 1.8,

  COLORS: [0x1e88e5, 0x43a047, 0xe53935],
}; */

export const PEN = {
  LENGTH: 120,
  WIDTH: 14,
  END_RADIUS: 7,

  DENSITY: 0.5, // was 1.0

  FRICTION: 0.75, // was 0.35

  RESTITUTION: 1, // was 0.25

  LINEAR_DAMPING: 1.8, // was 0.40

  ANGULAR_DAMPING: 3.5, // was 1.8

  COLORS: [0x1e88e5, 0x43a047, 0xe53935],

  // Elimination uses a slightly smaller body
  ELIMINATION_PADDING: 4,
};

//--------------------------------------------------
// Input
//--------------------------------------------------

export const INPUT = {
  // Maximum drag distance (pixels)
  MAX_DRAG_DISTANCE: 180,

  // Ignore tiny drags
  MIN_DRAG_DISTANCE: 10,

  // Convert drag distance to impulse
  IMPULSE_MULTIPLIER: 0.06,

  // Easier finger selection
  TOUCH_RADIUS: 20,

  // Desktop + multitouch
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
