//==================================================
// PowerUps.js  (single-player)
//==================================================
// Optional table pickups/hazards, off by default (see
// GameConfig.POWERUPS.ENABLED, toggled from the Classroom/Vs Computer
// setup screens in js/main.js). Two kinds:
//
//   SPEED  a pulsing yellow pickup — the first pen to touch it gets
//          its next shot boosted, then it's gone and a new spawn
//          timer starts.
//
//   INK    a dark puddle that just appears on the table for a while —
//          any pen currently inside it gets an extra velocity
//          multiplier applied each frame (slows it down faster than
//          normal), then it fades away on its own.
//
// This owns its own spawn timer and graphics; GameScene just calls
// update(deltaMs) once a frame and reads/clears state through here.
//==================================================

import { TABLE } from './Constants.js';
import { POWERUPS } from './GameConfig.js';
import { burst, floatingText } from './JuiceFX.js';
import audioFX from './AudioFX.js';

export const POWERUP_TYPE = {
  SPEED: 'speed',
  INK: 'ink',
};

export default class PowerUpManager {
  constructor(scene, penManager, table = TABLE) {
    this.scene = scene;
    this.penManager = penManager;
    this.table = table;

    this.enabled = false;
    this.active = null; // { type, x, y, radius, graphics, ageMs }
    this.spawnTimer = POWERUPS.SPAWN_INTERVAL;
  }

  setEnabled(enabled) {
    this.enabled = enabled;

    if (!enabled) this.clearActive();
  }

  update(deltaMs) {
    if (!this.enabled) return;

    if (this.active) {
      this.updateActive(deltaMs);
      return;
    }

    this.spawnTimer -= deltaMs;

    if (this.spawnTimer <= 0) {
      this.spawn();
      this.spawnTimer = POWERUPS.SPAWN_INTERVAL;
    }
  }

  //--------------------------------------------------
  // Spawn
  //--------------------------------------------------

  spawn() {
    const pos = this.findSpawnSpot();

    // No clear spot this round (table's crowded) — just try again
    // next timer instead of forcing an overlap.
    if (!pos) return;

    const type = Math.random() < 0.5 ? POWERUP_TYPE.SPEED : POWERUP_TYPE.INK;
    const radius = type === POWERUP_TYPE.SPEED ? POWERUPS.PICKUP_RADIUS : POWERUPS.INK_RADIUS;

    const graphics = this.createGraphics(type, pos.x, pos.y, radius);

    this.active = { type, x: pos.x, y: pos.y, radius, graphics, ageMs: 0 };
  }

  findSpawnSpot(attempts = 20) {
    const margin = 70;

    for (let i = 0; i < attempts; i++) {
      const x = this.table.X + margin + Math.random() * (this.table.WIDTH - margin * 2);
      const y = this.table.Y + margin + Math.random() * (this.table.HEIGHT - margin * 2);

      const clear = this.penManager.getPens().every((pen) => {
        const dx = pen.container.x - x;
        const dy = pen.container.y - y;

        return dx * dx + dy * dy > 90 * 90;
      });

      if (clear) return { x, y };
    }

    return null;
  }

  createGraphics(type, x, y, radius) {
    const container = this.scene.add.container(x, y);

    container.setDepth(5);

    const g = this.scene.add.graphics();

    if (type === POWERUP_TYPE.SPEED) {
      g.fillStyle(0xffd54f, 0.92);
      g.fillCircle(0, 0, radius * 0.55);
      g.lineStyle(3, 0xff8f00);
      g.strokeCircle(0, 0, radius * 0.55);

      container.add(g);

      const label = this.scene.add.text(0, 0, '⚡', { fontSize: '26px' }).setOrigin(0.5);

      container.add(label);
    } else {
      g.fillStyle(0x2b1a12, 0.4);
      g.fillCircle(0, 0, radius);
      g.lineStyle(2, 0x1a0f0a, 0.55);
      g.strokeCircle(0, 0, radius);

      container.add(g);
    }

    // Gentle pulse so it reads as "alive"/interactive rather than a
    // flat decoration.
    this.scene.tweens.add({
      targets: container,
      scale: { from: 0.9, to: 1.08 },
      duration: 550,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });

    return container;
  }

  //--------------------------------------------------
  // Per-frame behavior while a pickup/hazard is active
  //--------------------------------------------------

  updateActive(deltaMs) {
    const { type, x, y, radius } = this.active;

    if (type === POWERUP_TYPE.SPEED) {
      for (const pen of this.penManager.getPens()) {
        const dx = pen.container.x - x;
        const dy = pen.container.y - y;

        if (dx * dx + dy * dy <= radius * radius) {
          this.applySpeedBoost(pen);
          this.clearActive();
          return;
        }
      }

      return;
    }

    // Ink puddle — slows any pen currently inside, then just times out.
    for (const pen of this.penManager.getPens()) {
      const dx = pen.container.x - x;
      const dy = pen.container.y - y;

      if (dx * dx + dy * dy <= radius * radius) {
        const v = pen.body.getLinearVelocity();

        pen.body.setLinearVelocity(
          planck.Vec2(v.x * POWERUPS.INK_DAMPING_FACTOR, v.y * POWERUPS.INK_DAMPING_FACTOR),
        );
      }
    }

    this.active.ageMs += deltaMs;

    if (this.active.ageMs >= POWERUPS.INK_LIFETIME) {
      this.clearActive();
    }
  }

  applySpeedBoost(pen) {
    pen.nextShotBoost = POWERUPS.SPEED_BOOST_MULTIPLIER;

    // Keeps the pen visibly "charged" (see Pen.js) until that boosted
    // shot is actually taken (InputController.js clears it there) —
    // otherwise there'd be nothing on screen linking this pickup to
    // whatever happens on the player's next shot.
    pen.setBoosted(true);

    audioFX.playPickup();
    burst(this.scene, pen.container.x, pen.container.y, 0xffd54f, { count: 16, speed: 200 });
    floatingText(this.scene, pen.container.x, pen.container.y - 40, '⚡ SPEED BOOST!', '#c98a1f');

    this.scene.events.emit('powerup-collected', { type: POWERUP_TYPE.SPEED, pen });
  }

  //--------------------------------------------------

  clearActive() {
    if (this.active) {
      this.active.graphics.destroy();
      this.active = null;
    }
  }

  destroy() {
    this.clearActive();
  }
}
