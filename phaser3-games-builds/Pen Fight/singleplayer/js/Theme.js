//==================================================
// Theme.js
//==================================================
// Shared "school notebook / chalkboard" look — one place to tune the
// palette and fonts so every UI piece (menu, HUD, popups) stays
// consistent.
//==================================================

export const THEME = {
  //------------------------------------------
  // Fonts
  //------------------------------------------

  // Bold doodle font for titles / headlines
  FONT_HEADING: '"Architects Daughter", "Comic Sans MS", cursive',

  // Everyday handwriting font for body text / buttons
  FONT_BODY: '"Patrick Hand", "Comic Sans MS", cursive',

  //------------------------------------------
  // Paper (menu background)
  //------------------------------------------

  PAPER: 0xfbf3df,
  PAPER_LINE: 0xaecbeb,
  PAPER_MARGIN: 0xe08a8a,

  //------------------------------------------
  // Chalkboard (play table)
  //------------------------------------------

  CHALKBOARD: 0x2f4a3d,
  CHALKBOARD_FRAME: 0x7a5230,
  CHALK: 0xf5f0e6,

  //------------------------------------------
  // Ink / accent colors
  //------------------------------------------

  INK_BLUE: 0x2f6fb3,
  INK_BLUE_DARK: 0x224f82,
  INK_RED: 0xd1495b,
  INK_RED_DARK: 0xa73749,
  PENCIL_YELLOW: 0xe8b93f,
  CHALK_GREEN: 0x3f8556,
  CHALK_GREEN_DARK: 0x2e6440,
  WOOD_BROWN: 0x9c7b52,
  WOOD_BROWN_DARK: 0x7a5f3e,

  //------------------------------------------
  // Text colors (CSS strings, for Phaser text objects)
  //------------------------------------------

  TEXT_INK: '#3b2a20',
  TEXT_PAPER: '#fbf3df',
  TEXT_MUTED: '#8a7a63',
};
