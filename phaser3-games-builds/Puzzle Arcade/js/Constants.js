//==================================================
// Constants.js
//==================================================

export const GAME = {
  WIDTH: 1920,
  HEIGHT: 1080,
  BACKGROUND: '#101010',
  FPS: 60,
};

// Every puzzle module draws into a fixed 600x600 local coordinate space
// (with a 20px internal margin, exactly like the original canvas
// prototype) — unchanged regardless of screen layout. GameScene displays
// it at BOARD_DISPLAY_SIZE by scaling the board container, so no puzzle
// file needs to know about the real (landscape) canvas size.
export const BOARD_LOCAL_SIZE = 600;
export const BOARD_DISPLAY_SIZE = 820;
export const BOARD_SCALE = BOARD_DISPLAY_SIZE / BOARD_LOCAL_SIZE;
export const BOARD_X = 110;
export const BOARD_Y = 190;

// Right-hand sidebar (objective, stats, controls, hint) fills the rest of
// the landscape canvas next to the board.
export const SIDEBAR_X = BOARD_X + BOARD_DISPLAY_SIZE + 70;
export const SIDEBAR_WIDTH = GAME.WIDTH - SIDEBAR_X - 90;

export const MAX_LEVELS = 10;

// N,E,S,W offsets used by grid-walking puzzles.
export const DIRS4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];

// Gravity Blocks is the only puzzle that listens for arrow keys — GameScene
// checks against this instead of a magic number when routing keydown.
export const GRAVITY_GAME_INDEX = 2;

// Four everyday scenarios, each built on the same underlying puzzle
// mechanic: Homeward Bound = Path Shift, Backyard Golf = Gravity Blocks,
// Pipeline = Color Flow, Moving Day = Shape Packing.
export const GAME_TITLES = {
  1: 'Homeward Bound',
  2: 'Backyard Golf',
  3: 'Pipeline',
  4: 'Moving Day',
};

export const GAME_ICONS = {
  1: '🐕',
  2: '⛳',
  3: '🚰',
  4: '📦',
};

export const OBJECTIVES = {
  1: 'Rotate the road tiles until they form one connected route from the 🐕 dog to its 🏠 home.',
  2: 'Tilt the green (arrow keys or the on-screen pad) to putt the ball past the rocks and into the ⛳ hole.',
  3: 'Connect each pipe from its SOURCE to the matching OUTLET. Every pipe needs its own cells — no sharing, no crossing.',
  4: 'Select, rotate, and load every box into the truck bed without any overlap before moving day is done.',
};

export const INSTRUCTIONS = {
  1: 'Tap a road tile to rotate it clockwise. Link every tile into one continuous road from the dog to home.',
  2: 'Use the arrow keys or the on-screen pad to tilt the green. The ball rolls until it hits a rock or the edge — get it into the hole.',
  3: 'Drag from a pipe\'s SOURCE to its matching OUTLET. Each cell belongs to one pipe only, so plan routes that don\'t run into each other.',
  4: 'The big grid is the truck bed. Select a box below, tap it again to rotate, then tap a spot in the truck to load it. Fit every box in.',
};

export const HELP_TEXT = {
  1: 'Tap a road tile to rotate it.',
  2: 'Arrow keys or the pad tilt the green.',
  3: 'Drag from SOURCE to the matching OUTLET. Cells can\'t be shared between pipes.',
  4: 'Select a box, then tap its spot in the truck.',
};
