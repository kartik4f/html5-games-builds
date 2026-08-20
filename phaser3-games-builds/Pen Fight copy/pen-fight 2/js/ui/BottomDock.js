//==================================================
// BottomDock.js
//==================================================
// GameScene's bottom HUD layout, in one place — turn text, the match
// timer badge, and the turn timer bar all live here now instead of
// being scattered across the top of the screen, so this is the single
// source of truth for where each one sits. Every size below matches
// each element's fixed CSS size in index.html (.hud-text /
// .hud-badge / .hud-timer-track) — see TurnTimer.js's file header for
// why a fixed size + setOrigin(0,0) + an explicit top-left position
// (computed here) is used instead of Phaser's default center origin.
//
//   ┌──────────────────────────────────┐
//   │           PLAYER 1 TURN           │  <- TURN_TEXT
//   ├───────────────────────┬──────────┤
//   │  ▓▓▓▓▓▓▓▓░░░░░░░░░░░  │ ⏱ 0:45   │  <- TURN_BAR + MATCH_BADGE (same row)
//   └───────────────────────┴──────────┘
//                                          ↑ scene.scale.height (bottom edge)
//==================================================

const MARGIN_BOTTOM = 16; // gap from the very bottom edge to the timer row
const ROW_GAP = 8; // gap between the turn-text row and the timer row

const TURN_TEXT = { width: 460, height: 32 };
const TURN_BAR = { width: 400, height: 30 };
const MATCH_BADGE = { width: 130, height: 30 };
const GAP_BAR_BADGE = 10; // gap between the bar and the badge, same row

export function bottomDockLayout(scene) {
  const W = scene.scale.width;
  const H = scene.scale.height;

  const rowWidth = TURN_BAR.width + GAP_BAR_BADGE + MATCH_BADGE.width;
  const rowLeft = (W - rowWidth) / 2;
  const rowTop = H - MARGIN_BOTTOM - TURN_BAR.height;

  const turnTextTop = rowTop - ROW_GAP - TURN_TEXT.height;
  const turnTextLeft = (W - TURN_TEXT.width) / 2;

  return {
    turnText: { x: turnTextLeft, y: turnTextTop, ...TURN_TEXT },
    turnBar: { x: rowLeft, y: rowTop, ...TURN_BAR },
    matchBadge: {
      x: rowLeft + TURN_BAR.width + GAP_BAR_BADGE,
      y: rowTop,
      ...MATCH_BADGE,
    },
  };
}
