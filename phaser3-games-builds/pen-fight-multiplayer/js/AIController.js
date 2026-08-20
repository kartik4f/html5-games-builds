//==================================================
// AIController.js
//==================================================
// The "Play against Computer" opponent brain. Mode-agnostic — it
// works for both turn-based (only acts when canPlayerInteract(pen)
// says it's actually that pen's turn) and chaos (canPlayerInteract is
// true for any alive pen at any time, so each AI just loops on its
// own random "think time" between shots).
//
// No pathfinding or lookahead — each AI simply: waits a short random
// "thinking" delay once it's able to act, picks a target (random or
// nearest opponent depending on difficulty), aims at it with some
// random jitter, and shoots with power scaled by difficulty. That's
// enough to feel like an opponent without being unbeatable or requiring
// real physics simulation/prediction.
//==================================================

import { PEN, INPUT } from './Constants.js';
import PhysicsUtils from './PhysicsUtils.js';

const THINK_TIME_MS = {
  easy: { min: 900, max: 1800 },
  medium: { min: 600, max: 1200 },
  hard: { min: 350, max: 800 },
};

const AIM_JITTER_DEG = {
  easy: 30,
  medium: 14,
  hard: 5,
};

const POWER_RANGE = {
  easy: [0.35, 0.65],
  medium: [0.55, 0.85],
  hard: [0.75, 1.0],
};

// 'random' = pick any alive opponent; 'nearest' = pick the closest one.
const TARGETING_MODE = {
  easy: 'random',
  medium: 'nearest',
  hard: 'nearest',
};

export default class AIController {
  constructor(scene, penManager, gameRules, config = {}) {
    this.scene = scene;
    this.penManager = penManager;
    this.gameRules = gameRules;

    this.difficulty = config.difficulty || 'medium';
    this.aiPlayerIds = new Set(config.aiPlayerIds || []);

    // playerId -> ms remaining before this AI takes its shot. Only
    // present while canPlayerInteract(pen) is true for that pen —
    // this doubles as "have I started thinking about this chance yet".
    this.pending = new Map();
  }

  get enabled() {
    return this.aiPlayerIds.size > 0;
  }

  //--------------------------------------------------
  // Update — call once per frame with the frame's delta in ms.
  //--------------------------------------------------

  update(deltaMs) {
    if (!this.enabled || this.gameRules.gameOver) return;

    for (const playerId of this.aiPlayerIds) {
      const pen = this.penManager.getPens()[playerId];

      if (!pen) continue;
      if (!this.gameRules.alivePens.has(pen)) continue;

      const canAct = this.gameRules.canPlayerInteract(pen);

      if (!canAct) {
        this.pending.delete(playerId);
        continue;
      }

      if (!this.pending.has(playerId)) {
        this.pending.set(playerId, this._randomThinkTime());
        continue;
      }

      const remaining = this.pending.get(playerId) - deltaMs;

      if (remaining > 0) {
        this.pending.set(playerId, remaining);
        continue;
      }

      this.pending.delete(playerId);
      this._takeShot(pen);
    }
  }

  _randomThinkTime() {
    const range = THINK_TIME_MS[this.difficulty] || THINK_TIME_MS.medium;

    return range.min + Math.random() * (range.max - range.min);
  }

  //--------------------------------------------------
  // Target selection
  //--------------------------------------------------

  _pickTarget(pen) {
    const others = this.penManager
      .getPens()
      .filter((p) => p !== pen && this.gameRules.alivePens.has(p));

    if (others.length === 0) return null;

    const mode = TARGETING_MODE[this.difficulty] || 'nearest';

    if (mode === 'random') {
      return others[Math.floor(Math.random() * others.length)];
    }

    let best = others[0];
    let bestDistSq = Infinity;

    for (const other of others) {
      const dx = other.container.x - pen.container.x;
      const dy = other.container.y - pen.container.y;
      const distSq = dx * dx + dy * dy;

      if (distSq < bestDistSq) {
        bestDistSq = distSq;
        best = other;
      }
    }

    return best;
  }

  //--------------------------------------------------
  // Shot — mirrors InputController.fire()'s exact impulse math, just
  // driven by an aim direction instead of a pointer drag.
  //--------------------------------------------------

  _takeShot(pen) {
    const target = this._pickTarget(pen);

    if (!target) return;

    const dx = target.container.x - pen.container.x;
    const dy = target.container.y - pen.container.y;

    const dist = Math.sqrt(dx * dx + dy * dy) || 1;

    const dirX = dx / dist;
    const dirY = dy / dist;

    // Aim jitter — rotate the aim direction a random amount so the AI
    // isn't a laser (a lot on easy, barely any on hard).
    const jitterDeg = AIM_JITTER_DEG[this.difficulty] ?? 14;
    const jitterRad = Phaser.Math.DegToRad((Math.random() * 2 - 1) * jitterDeg);

    const cos = Math.cos(jitterRad);
    const sin = Math.sin(jitterRad);

    const aimX = dirX * cos - dirY * sin;
    const aimY = dirX * sin + dirY * cos;

    const [powerMin, powerMax] = POWER_RANGE[this.difficulty] || POWER_RANGE.medium;
    const dragAmount = powerMin + Math.random() * (powerMax - powerMin);

    const dragLength = INPUT.MAX_DRAG_DISTANCE * dragAmount;

    const shotDx = aimX * dragLength;
    const shotDy = aimY * dragLength;

    const power = Phaser.Math.Easing.Cubic.Out(Phaser.Math.Clamp(dragAmount, 0, 1));
    const mass = pen.body.getMass();

    const impulse = {
      x: shotDx * INPUT.IMPULSE_MULTIPLIER * power * mass,
      y: shotDy * INPUT.IMPULSE_MULTIPLIER * power * mass,
    };

    // A small random offset along the pen's width adds natural spin
    // and imperfection — more pronounced on easier difficulties,
    // nearly dead-center on hard.
    const wobble = (AIM_JITTER_DEG[this.difficulty] ?? 14) / AIM_JITTER_DEG.easy;
    const offsetPx = (Math.random() * 2 - 1) * PEN.WIDTH * 0.3 * wobble;
    const localPoint = planck.Vec2(0, PhysicsUtils.toWorld(offsetPx));

    pen.shoot(localPoint, impulse);

    this.gameRules.onPlayerAction(pen);
  }
}
