//==================================================
// PhysicsEngine.mjs  (server-side, zero-dependency)
//==================================================
// The single-player client simulates pens with Planck (a real Box2D
// port) loaded from a CDN. That's fine for a client, but this is a
// plain Node script with no package.json and nothing installed — so
// instead of depending on a physics engine, this is a small
// self-contained rigid-body sim written specifically for this game:
// two capsule-shaped pens sliding around a table, bouncing off the
// rails and off each other.
//
// It reuses PEN/TABLE/INPUT/SCALE from the client's Constants.js so
// size, damping, friction, restitution and drag feel stay in sync
// with the single-player game even though the engine itself doesn't.
//
// Everything here runs in plain pixel space (no world/pixel scale
// split like the client has) — simpler, and there's no rendering
// layer on the server to keep in sync with.
//==================================================

import { PEN, TABLE, INPUT, SCALE } from '../js/Constants.js';

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
    return { id: this.id, x: this.x, y: this.y, angle: this.angle };
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
// Step
//--------------------------------------------------

export function step(pens, dt) {
  integrate(pens, dt);
  resolveWalls(pens);

  if (pens.length === 2) {
    resolvePenCollision(pens[0], pens[1]);
  }
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

    if (p.speedSq() < REST_LINEAR_PX2 && Math.abs(p.w) < REST_ANGULAR) {
      p.vx = 0;
      p.vy = 0;
      p.w = 0;
    }
  }
}

function resolveWalls(pens) {
  for (const p of pens) {
    const { a, b } = p.getEndpoints();

    const minX = Math.min(a.x, b.x) - RADIUS;
    const maxX = Math.max(a.x, b.x) + RADIUS;
    const minY = Math.min(a.y, b.y) - RADIUS;
    const maxY = Math.max(a.y, b.y) + RADIUS;

    if (minX < TABLE.X) {
      p.x += TABLE.X - minX;

      if (p.vx < 0) p.vx = -p.vx * PEN.RESTITUTION;
    } else if (maxX > TABLE.X + TABLE.WIDTH) {
      p.x -= maxX - (TABLE.X + TABLE.WIDTH);

      if (p.vx > 0) p.vx = -p.vx * PEN.RESTITUTION;
    }

    if (minY < TABLE.Y) {
      p.y += TABLE.Y - minY;

      if (p.vy < 0) p.vy = -p.vy * PEN.RESTITUTION;
    } else if (maxY > TABLE.Y + TABLE.HEIGHT) {
      p.y -= maxY - (TABLE.Y + TABLE.HEIGHT);

      if (p.vy > 0) p.vy = -p.vy * PEN.RESTITUTION;
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

  if (distSq >= minDist * minDist) return;

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

  if (relVelN > 0) return; // already separating

  const invMass = 1; // unit mass, both pens identical
  const invI = 1 / I_SPECIFIC;

  const rACrossN = rA.x * ny - rA.y * nx;
  const rBCrossN = rB.x * ny - rB.y * nx;

  const denomN =
    invMass + invMass + rACrossN * rACrossN * invI + rBCrossN * rBCrossN * invI;

  const e = PEN.RESTITUTION;
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
}
