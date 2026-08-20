//==================================================
// PhysicsEngine.mjs  (server-side, zero-dependency)
//==================================================
// The single-player client simulates pens with Planck (a real Box2D
// port) loaded from a CDN. That's fine for a client, but this is a
// plain Node script with no package.json and nothing installed — so
// instead of depending on a physics engine, this is a small
// self-contained rigid-body sim written specifically for this game:
// 2-4 capsule-shaped pens sliding around a table, bouncing off each
// other. There is deliberately no collision with the table edge —
// real pen fight has no walls, a pen that slides off is out (see
// GameRoom.mjs, which checks PenBody.isCompletelyOutside() every tick).
//
// It reuses PEN/INPUT/SCALE from the client's Constants.js so size,
// damping, friction, restitution and drag feel stay in sync with the
// single-player game even though the engine itself doesn't. The
// table's bounds (for the out-of-bounds check) are passed in by the
// caller rather than imported, so this file has no notion of "the"
// table beyond the shape of a pen.
//
// Everything here runs in plain pixel space (no world/pixel scale
// split like the client has) — simpler, and there's no rendering
// layer on the server to keep in sync with.
//==================================================

import { PEN, INPUT, SCALE } from '../js/Constants.js';
import { POWERUPS } from '../js/GameConfig.js';

//--------------------------------------------------
// Shape constants (mirrors Pen.js's fixture composition: a rectangle
// with two end-caps whose radius equals the half-width — i.e. an
// exact capsule/stadium shape)
//--------------------------------------------------

export const HALF_BODY = PEN.LENGTH / 2 - PEN.END_RADIUS;
export const RADIUS = PEN.END_RADIUS;

// Moment of inertia *per unit mass* for a rectangle approximation of
// the pen. Absolute mass doesn't matter here (both pens are
// identical), so everything below works in a "unit mass" system —
// impulse == velocity change, and this is I/m rather than I.
const I_SPECIFIC = (PEN.LENGTH * PEN.LENGTH + PEN.WIDTH * PEN.WIDTH) / 12;

// Client's Pen.update() hard-snaps to rest below 0.0008 (world units
// squared) / 0.03 rad/s. Converting the linear threshold to pixel
// space: v_world = v_px / SCALE, so v_px^2 = 0.0008 * SCALE^2.
const REST_LINEAR_PX2 = 0.0008 * SCALE * SCALE;
const REST_ANGULAR = 0.03;

function clamp01(v) {
  return Math.max(0, Math.min(1, v));
}

// Phaser's Cubic.Out easing — same curve InputController uses, so a
// given drag length produces the same "feel" as single-player.
function cubicOut(t) {
  const f = t - 1;

  return f * f * f + 1;
}

//--------------------------------------------------
// One pen
//--------------------------------------------------

export class PenBody {
  constructor(id, x, y) {
    this.id = id;

    this.x = x;
    this.y = y;
    this.angle = 0;

    this.vx = 0;
    this.vy = 0;
    this.w = 0;

    // Helicopter Shot power-up (see GameRoom.mjs's nextShotHelicopter /
    // _onShoot) — ms remaining on the temporary hard-spin + extra-bounce
    // window opened by activateHelicopter(). 0 = not active.
    this.helicopterMs = 0;
  }

  // Helicopter Shot — mirrors Pen.js's activateHelicopter() on the
  // client, kept in the same spin direction the pen was already
  // turning (or positive if it wasn't turning at all).
  activateHelicopter() {
    const spin = POWERUPS.HELICOPTER_SPIN_VELOCITY * (this.w < 0 ? -1 : 1);

    this.w += spin;
    this.helicopterMs = POWERUPS.HELICOPTER_DURATION;
  }

  // Capsule <-> circle overlap — mirrors Pen.overlapsCircle() on the
  // client (see its comment for why this matters for a 145px-long pen
  // against a ~26px pickup): used for power-up pickup detection so a
  // pen that visibly sweeps across a pickup actually collects it, not
  // only one whose *center* happens to land inside the pickup radius.
  overlapsCircle(x, y, radius) {
    const { a, b } = this.getEndpoints();
    const dist = distancePointToSegment(x, y, a.x, a.y, b.x, b.y);

    return dist <= radius + RADIUS;
  }

  getEndpoints() {
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    return {
      a: { x: this.x - HALF_BODY * cos, y: this.y - HALF_BODY * sin },
      b: { x: this.x + HALF_BODY * cos, y: this.y + HALF_BODY * sin },
    };
  }

  speedSq() {
    return this.vx * this.vx + this.vy * this.vy;
  }

  isMoving() {
    return this.speedSq() > 0.5 || Math.abs(this.w) > 0.02;
  }

  // Mirrors Pen.isSettled — pure velocity check, used by the
  // wait-for-settle turn handoff.
  isSettled(linearThresholdPx2, angularThreshold) {
    return (
      this.speedSq() <= linearThresholdPx2 && Math.abs(this.w) <= angularThreshold
    );
  }

  stop() {
    this.vx = 0;
    this.vy = 0;
    this.w = 0;
  }

  // Lobby placement check — the (unshrunk) rotated rectangle has to
  // be fully within the table, inset by `margin` on every side.
  isFullyInside(table, margin = 0) {
    const halfLength = PEN.LENGTH / 2;
    const halfWidth = PEN.WIDTH / 2;

    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    const corners = [
      { x: -halfLength, y: -halfWidth },
      { x: halfLength, y: -halfWidth },
      { x: halfLength, y: halfWidth },
      { x: -halfLength, y: halfWidth },
    ];

    for (const c of corners) {
      const wx = this.x + c.x * cos - c.y * sin;
      const wy = this.y + c.x * sin + c.y * cos;

      if (wx < table.X + margin || wx > table.X + table.WIDTH - margin) return false;
      if (wy < table.Y + margin || wy > table.Y + table.HEIGHT - margin) return false;
    }

    return true;
  }

  // Mirrors Pen.getWorldBounds()/isCompletelyOutside() — a rotated
  // rectangle (shrunk slightly by PEN.ELIMINATION_PADDING) has to be
  // fully clear of the table on at least one side to count as "out".
  isCompletelyOutside(table) {
    const halfLength = PEN.LENGTH / 2 - PEN.ELIMINATION_PADDING;
    const halfWidth = PEN.WIDTH / 2 - PEN.ELIMINATION_PADDING;

    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    const corners = [
      { x: -halfLength, y: -halfWidth },
      { x: halfLength, y: -halfWidth },
      { x: halfLength, y: halfWidth },
      { x: -halfLength, y: halfWidth },
    ];

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const c of corners) {
      const wx = this.x + c.x * cos - c.y * sin;
      const wy = this.y + c.x * sin + c.y * cos;

      minX = Math.min(minX, wx);
      maxX = Math.max(maxX, wx);
      minY = Math.min(minY, wy);
      maxY = Math.max(maxY, wy);
    }

    return (
      maxX < table.X ||
      minX > table.X + table.WIDTH ||
      maxY < table.Y ||
      minY > table.Y + table.HEIGHT
    );
  }

  // Apply a velocity-change impulse at a point given in the pen's own
  // *local* (unrotated) frame — mirrors Pen.shoot(localPoint, impulse).
  applyImpulseAtLocalPoint(dvx, dvy, localX, localY) {
    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    const rx = localX * cos - localY * sin;
    const ry = localX * sin + localY * cos;

    this.vx += dvx;
    this.vy += dvy;

    // Unit-mass system: impulse J == (dvx, dvy), dw = invI * (r x J)
    this.w += (rx * dvy - ry * dvx) / I_SPECIFIC;
  }

  snapshot() {
    return {
      id: this.id,
      x: this.x,
      y: this.y,
      angle: this.angle,
      // Lets clients show the spinning-rotor visual for the actual
      // duration of the Helicopter Shot window, not just at the
      // instant it's collected (see NetPen.js's setHelicopterActive()).
      helicopterActive: this.helicopterMs > 0,
    };
  }
}

//--------------------------------------------------
// Turn a raw drag vector into the same velocity change the client's
// InputController would produce for an identical drag.
//--------------------------------------------------

export function computeShotVelocity(dxRaw, dyRaw) {
  let dx = dxRaw;
  let dy = dyRaw;

  let length = Math.sqrt(dx * dx + dy * dy);

  if (length < INPUT.MIN_DRAG_DISTANCE) return null;

  if (length > INPUT.MAX_DRAG_DISTANCE) {
    const scale = INPUT.MAX_DRAG_DISTANCE / length;

    dx *= scale;
    dy *= scale;
    length = INPUT.MAX_DRAG_DISTANCE;
  }

  const dragAmount = length / INPUT.MAX_DRAG_DISTANCE;
  const power = cubicOut(clamp01(dragAmount));

  // Client: impulse = dx * MULT * power * mass ; deltaV = impulse / mass
  // -> mass cancels, deltaV_world = dx * MULT * power. Convert to px/s.
  return {
    dvx: dx * INPUT.IMPULSE_MULTIPLIER * power * SCALE,
    dvy: dy * INPUT.IMPULSE_MULTIPLIER * power * SCALE,
  };
}

//--------------------------------------------------
// Closest points between two segments (standard algorithm)
//--------------------------------------------------

function closestPointsSegmentSegment(p1, p2, p3, p4) {
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;
  const rx = p1.x - p3.x;
  const ry = p1.y - p3.y;

  const a = d1x * d1x + d1y * d1y;
  const e = d2x * d2x + d2y * d2y;
  const f = d2x * rx + d2y * ry;

  let s;
  let t;

  if (a <= 1e-9 && e <= 1e-9) {
    s = 0;
    t = 0;
  } else if (a <= 1e-9) {
    s = 0;
    t = clamp01(f / e);
  } else {
    const c = d1x * rx + d1y * ry;

    if (e <= 1e-9) {
      t = 0;
      s = clamp01(-c / a);
    } else {
      const b = d1x * d2x + d1y * d2y;
      const denom = a * e - b * b;

      s = denom > 1e-9 ? clamp01((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;

      if (t < 0) {
        t = 0;
        s = clamp01(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp01((b - c) / a);
      }
    }
  }

  return {
    cp1: { x: p1.x + d1x * s, y: p1.y + d1y * s },
    cp2: { x: p3.x + d2x * t, y: p3.y + d2y * t },
  };
}

//--------------------------------------------------
// Distance from a point to a segment — used by PenBody.overlapsCircle()
// for power-up pickup detection (a degenerate case of the
// segment-segment closest-point math above, simpler to reason about on
// its own).
//--------------------------------------------------

function distancePointToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;

  const abLenSq = abx * abx + aby * aby;

  const t = abLenSq > 1e-9 ? clamp01((apx * abx + apy * aby) / abLenSq) : 0;

  const cx = ax + abx * t;
  const cy = ay + aby * t;

  const dx = px - cx;
  const dy = py - cy;

  return Math.sqrt(dx * dx + dy * dy);
}

//--------------------------------------------------
// Default lobby layout — spaces N pens evenly around an ellipse
// inscribed in the table so nobody starts overlapping, whatever N is
// (2-4). All start at angle 0, well clear of each other.
//--------------------------------------------------

export function defaultLayout(n, table) {
  const cx = table.X + table.WIDTH / 2;
  const cy = table.Y + table.HEIGHT / 2;

  const rx = table.WIDTH * 0.28;
  const ry = table.HEIGHT * 0.28;

  const positions = [];

  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;

    positions.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    });
  }

  return positions;
}

//--------------------------------------------------
// Capsule-capsule distance / overlap — exposed so lobby placement can
// reject a spot that overlaps another player's pen, using the exact
// same shape math the collision resolver uses.
//--------------------------------------------------

export function capsuleGap(A, B) {
  const ea = A.getEndpoints();
  const eb = B.getEndpoints();

  const { cp1, cp2 } = closestPointsSegmentSegment(ea.a, ea.b, eb.a, eb.b);

  const dx = cp2.x - cp1.x;
  const dy = cp2.y - cp1.y;

  return Math.sqrt(dx * dx + dy * dy) - RADIUS * 2;
}

export function capsulesOverlap(A, B) {
  return capsuleGap(A, B) < 0;
}

//--------------------------------------------------
// Step
//--------------------------------------------------

// Returns an array of collision events that happened this step —
// [{ aId, bId, x, y, speed }] — so the caller (GameRoom) can forward
// them to clients for hit sounds/particles/juice. Empty most ticks; at
// most one entry per pen pair per tick.
//
// Sub-stepped when any pen is moving fast enough to cross more than
// its own radius within this tick — a hard-hit pen's impulse can put
// it well past RADIUS*2 px/tick (see PEN/INPUT tuning in
// Constants.js), and resolveCollisions() only ever checks positions
// *after* integrate() has already moved everyone, so a single big
// integrate() can let two pens' capsules skip straight past each
// other between one tick and the next with no contact ever measured
// in between — the discrete-physics equivalent of the client's
// tunneling problem (see Pen.js's setBullet(true) for that side).
// Breaking the tick into smaller sub-steps, each moving at most
// RADIUS px, closes that gap without needing real swept-shape math.
const MAX_SUBSTEPS = 8;

export function step(pens, dt) {
  let maxMovementPx = 0;

  for (const p of pens) {
    maxMovementPx = Math.max(maxMovementPx, Math.sqrt(p.speedSq()) * dt);
  }

  const subSteps =
    maxMovementPx > RADIUS
      ? Math.min(MAX_SUBSTEPS, Math.ceil(maxMovementPx / RADIUS))
      : 1;

  const subDt = dt / subSteps;

  // One collision event per pair per call, even if that pair's
  // capsules happen to still be overlapping across several sub-steps
  // — callers use this purely for one-shot hit sound/particle juice,
  // not a physically exact log of every micro-contact.
  const seenPairs = new Set();
  const events = [];

  for (let s = 0; s < subSteps; s++) {
    integrate(pens, subDt);

    for (const event of resolveCollisions(pens)) {
      const key = event.aId < event.bId ? `${event.aId}-${event.bId}` : `${event.bId}-${event.aId}`;

      if (seenPairs.has(key)) continue;

      seenPairs.add(key);
      events.push(event);
    }
  }

  return events;
}

// All-pairs collision resolution — O(n^2), trivial for the 2-4 pens
// this game supports.
function resolveCollisions(pens) {
  const events = [];

  for (let i = 0; i < pens.length; i++) {
    for (let j = i + 1; j < pens.length; j++) {
      const event = resolvePenCollision(pens[i], pens[j]);

      if (event) events.push(event);
    }
  }

  return events;
}

function integrate(pens, dt) {
  const linFactor = 1 / (1 + dt * PEN.LINEAR_DAMPING);
  const angFactor = 1 / (1 + dt * PEN.ANGULAR_DAMPING);

  for (const p of pens) {
    p.vx *= linFactor;
    p.vy *= linFactor;
    p.w *= angFactor;

    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.angle += p.w * dt;

    if (p.helicopterMs > 0) {
      p.helicopterMs = Math.max(0, p.helicopterMs - dt * 1000);
    }

    if (p.speedSq() < REST_LINEAR_PX2 && Math.abs(p.w) < REST_ANGULAR) {
      p.vx = 0;
      p.vy = 0;
      p.w = 0;
    }
  }
}

function resolvePenCollision(A, B) {
  const ea = A.getEndpoints();
  const eb = B.getEndpoints();

  const { cp1, cp2 } = closestPointsSegmentSegment(ea.a, ea.b, eb.a, eb.b);

  const dx = cp2.x - cp1.x;
  const dy = cp2.y - cp1.y;
  const distSq = dx * dx + dy * dy;
  const minDist = RADIUS * 2;

  if (distSq >= minDist * minDist) return null;

  const dist = Math.sqrt(distSq);
  const nx = dist > 1e-6 ? dx / dist : 1;
  const ny = dist > 1e-6 ? dy / dist : 0;

  const penetration = minDist - dist;

  // Position correction, split evenly
  A.x -= nx * penetration * 0.5;
  A.y -= ny * penetration * 0.5;
  B.x += nx * penetration * 0.5;
  B.y += ny * penetration * 0.5;

  const contact = {
    x: (cp1.x + cp2.x) / 2,
    y: (cp1.y + cp2.y) / 2,
  };

  const rA = { x: contact.x - A.x, y: contact.y - A.y };
  const rB = { x: contact.x - B.x, y: contact.y - B.y };

  const velA = { x: A.vx - A.w * rA.y, y: A.vy + A.w * rA.x };
  const velB = { x: B.vx - B.w * rB.y, y: B.vy + B.w * rB.x };

  const relVel = { x: velB.x - velA.x, y: velB.y - velA.y };
  const relVelN = relVel.x * nx + relVel.y * ny;

  if (relVelN > 0) return null; // already separating

  // Impact speed, captured before the impulse response below changes
  // the velocities — this is what the client uses to size the hit's
  // sound/particles/shake (same calibration as single-player, see
  // JUICE.COLLISION_SPEED_CALIBRATION_PX in Constants.js).
  const impactSpeed = Math.sqrt(relVel.x * relVel.x + relVel.y * relVel.y);

  const invMass = 1; // unit mass, both pens identical
  const invI = 1 / I_SPECIFIC;

  const rACrossN = rA.x * ny - rA.y * nx;
  const rBCrossN = rB.x * ny - rB.y * nx;

  const denomN =
    invMass + invMass + rACrossN * rACrossN * invI + rBCrossN * rBCrossN * invI;

  // Helicopter Shot (see PenBody.activateHelicopter()) temporarily
  // raises whichever pen is spinning to a much bouncier restitution —
  // take the harder of the two if either side currently has it active.
  const restA = A.helicopterMs > 0 ? POWERUPS.HELICOPTER_RESTITUTION : PEN.RESTITUTION;
  const restB = B.helicopterMs > 0 ? POWERUPS.HELICOPTER_RESTITUTION : PEN.RESTITUTION;
  const e = Math.max(restA, restB);
  const j = (-(1 + e) * relVelN) / denomN;

  const jx = j * nx;
  const jy = j * ny;

  A.vx -= jx * invMass;
  A.vy -= jy * invMass;
  A.w -= invI * (rA.x * jy - rA.y * jx);

  B.vx += jx * invMass;
  B.vy += jy * invMass;
  B.w += invI * (rB.x * jy - rB.y * jx);

  //------------------------------------------
  // Simple Coulomb friction along the tangent
  //------------------------------------------

  const tx = -ny;
  const ty = nx;

  const relVelT = relVel.x * tx + relVel.y * ty;

  const rACrossT = rA.x * ty - rA.y * tx;
  const rBCrossT = rB.x * ty - rB.y * tx;

  const denomT =
    invMass + invMass + rACrossT * rACrossT * invI + rBCrossT * rBCrossT * invI;

  let jt = -relVelT / denomT;

  const maxJt = PEN.FRICTION * Math.abs(j);

  jt = Math.max(-maxJt, Math.min(maxJt, jt));

  const jtx = jt * tx;
  const jty = jt * ty;

  A.vx -= jtx * invMass;
  A.vy -= jty * invMass;
  A.w -= invI * (rA.x * jty - rA.y * jtx);

  B.vx += jtx * invMass;
  B.vy += jty * invMass;
  B.w += invI * (rB.x * jty - rB.y * jtx);

  return { aId: A.id, bId: B.id, x: contact.x, y: contact.y, speed: impactSpeed };
}
