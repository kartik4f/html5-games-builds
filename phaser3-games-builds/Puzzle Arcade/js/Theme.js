//==================================================
// Theme.js
//==================================================

export const THEME = {
  // Deep slate-navy rather than flat black/gray, with a soft top-to-bottom
  // gradient (see GameScene.buildHeader) for a bit of depth.
  BG_TOP: 0x161c2c,
  BG_BOTTOM: 0x0a0d14,
  BG: 0x0b0e14,

  PANEL: 0x1b2130,
  PANEL_BORDER: 0x2c3446,
  PANEL_LIGHT: 0x242c3e,

  BUTTON: 0x2a3142,
  BUTTON_HOVER: 0x3a4358,
  BUTTON_ACTIVE_BG: 0xffffff,
  BUTTON_ACTIVE_TEXT: '#12141c',
  BUTTON_DISABLED_ALPHA: 0.35,
  BUTTON_BORDER: 0x3d4a63,

  TEXT: '#f3f5fa',
  TEXT_MUTED: '#8b93a7',
  TEXT_DIM: '#c2c8d8',
  HINT: '#ffd166',

  START: 0x4ade80,
  END: 0x60a5fa,
  LASER: 0xff4444,
  WALL: 0x666666,
  GRID_LINE: 0x3a3a3a,

  PACKING_COLORS: [0x60a5fa, 0xf87171, 0xfacc15, 0x4ade80, 0xc084fc],
  // Up to 8 pipes per Pipeline level — kept visually distinct at a glance.
  FLOW_COLORS: [0xff5b5b, 0x5ba7ff, 0xffd166, 0xb87cff, 0x4ade80, 0xfb923c, 0x22d3ee, 0xf472b6],

  FONT: '"Baloo 2", Arial, sans-serif',
};

// One accent color per game, used for the active tab, sidebar title, and
// board frame — gives each everyday scenario its own visual identity.
export const ACCENTS = {
  1: { color: 0xffa94d, hex: '#ffa94d' }, // Homeward Bound — warm amber
  2: { color: 0x4ade80, hex: '#4ade80' }, // Backyard Golf — grass green
  3: { color: 0x60a5fa, hex: '#60a5fa' }, // Pipeline — pipe blue
  4: { color: 0xc084fc, hex: '#c084fc' }, // Moving Day — box purple
};
