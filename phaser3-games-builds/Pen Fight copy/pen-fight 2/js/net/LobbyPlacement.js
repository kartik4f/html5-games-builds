//==================================================
// LobbyPlacement.js
//==================================================
// A client-side mirror of GameRoom.mjs's _isValidPlacement() — used
// purely for live UX feedback while dragging a pen in the online lobby
// (tinting it when the current drag spot would be rejected, and
// snapping back instantly on release instead of waiting on a server
// round trip). The server is still the sole authority: this can be
// slightly wrong at the margins with zero real consequence, since
// every placement is re-validated server-side regardless (see
// GameRoom.mjs's _onSetPosition()).
//
// Lobby pens are always placed at angle 0 (see NetGameScene's
// onPointerMove()/GameRoom.mjs's PenBody construction during
// placement), which is what lets this skip the general rotated-capsule
// math PhysicsEngine.mjs needs for in-match physics — every pen here
// is just a horizontal capsule, so overlap reduces to a couple of
// straightforward 1D/segment checks.
//==================================================

import { PEN, TABLE } from '../Constants.js';

// Must match GameRoom.mjs's own PLACEMENT_MARGIN — kept as a separate
// constant there since the server has no reason to import client-only
// concerns, but the two need to agree for this preview to be accurate.
const PLACEMENT_MARGIN = 24;

const HALF_BODY = PEN.LENGTH / 2 - PEN.END_RADIUS;

function endpoints(x, y) {
  return { ax: x - HALF_BODY, ay: y, bx: x + HALF_BODY, by: y };
}

// Closest distance between two horizontal segments of equal length —
// general segment-segment closest-point math, specialized for "both
// segments are horizontal" (dy1 = dy2 = 0), which is all lobby
// placement ever needs (see file header).
function segmentDistance(a, b) {
  // Segments only overlap in x if their x-ranges intersect *and*
  // they're at the same y — otherwise the closest points are just
  // whichever endpoints are nearest.
  const sameLevel = Math.abs(a.ay - b.ay) < 1e-6;
  const xOverlap = a.ax <= b.bx && b.ax <= a.bx;

  if (sameLevel && xOverlap) return Math.abs(a.ay - b.ay); // literally 0 here, kept for clarity

  // General case: closest point is between some pair of endpoints —
  // cheap enough to just check all four combinations directly rather
  // than port the full closest-point-on-segment algorithm for a shape
  // that never rotates during placement.
  const candidates = [
    distPointToSegment(a.ax, a.ay, b),
    distPointToSegment(a.bx, a.ay, b),
    distPointToSegment(b.ax, b.ay, a),
    distPointToSegment(b.bx, b.ay, a),
  ];

  return Math.min(...candidates);
}

function distPointToSegment(px, py, seg) {
  const abx = seg.bx - seg.ax;
  const aby = seg.by - seg.ay;
  const apx = px - seg.ax;
  const apy = py - seg.ay;

  const abLenSq = abx * abx + aby * aby;
  const t = abLenSq > 1e-9 ? Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq)) : 0;

  const cx = seg.ax + abx * t;
  const cy = seg.ay + aby * t;

  return Math.hypot(px - cx, py - cy);
}

export function capsulesOverlap(ax, ay, bx, by) {
  const dist = segmentDistance(endpoints(ax, ay), endpoints(bx, by));

  return dist < PEN.END_RADIUS * 2;
}

// Mirrors PenBody.isFullyInside(TABLE, PLACEMENT_MARGIN) for angle 0.
export function isFullyInsideTable(x, y) {
  const halfLength = PEN.LENGTH / 2;
  const halfWidth = PEN.WIDTH / 2;

  return (
    x - halfLength >= TABLE.X + PLACEMENT_MARGIN &&
    x + halfLength <= TABLE.X + TABLE.WIDTH - PLACEMENT_MARGIN &&
    y - halfWidth >= TABLE.Y + PLACEMENT_MARGIN &&
    y + halfWidth <= TABLE.Y + TABLE.HEIGHT - PLACEMENT_MARGIN
  );
}

// otherPlayers — [{ playerId, x, y }] for every OTHER seated player
// (exclude the one currently being dragged) — see NetGameScene.js's
// use of this against this.lobbyPlayers.
export function isValidPlacement(x, y, otherPlayers) {
  if (!isFullyInsideTable(x, y)) return false;

  for (const p of otherPlayers) {
    if (capsulesOverlap(x, y, p.x, p.y)) return false;
  }

  return true;
}
