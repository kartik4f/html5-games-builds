//==================================================
// Pen.js
//==================================================

import { PEN } from './Constants.js';
import PhysicsUtils from './PhysicsUtils.js';

export default class Pen {
  constructor(scene, physics, x, y, color, playerId) {
    this.scene = scene;
    this.physics = physics;
    this.color = color;
    this.playerId = playerId;

    this.selected = false;

    this.createBody(x, y);
    this.createGraphics();
    this.glowTime = 0;
  }

  //--------------------------------------------------
  // Physics
  //--------------------------------------------------

  createBody(x, y) {
    this.body = this.physics.world.createDynamicBody({
      position: PhysicsUtils.worldVec(x, y),

      angle: 0,
    });

    this.body.setLinearDamping(PEN.LINEAR_DAMPING);
    this.body.setAngularDamping(PEN.ANGULAR_DAMPING);

    const halfBody = PEN.LENGTH / 2 - PEN.END_RADIUS;

    // Center rectangle

    this.body.createFixture(
      planck.Box(
        PhysicsUtils.toWorld(halfBody),

        PhysicsUtils.toWorld(PEN.WIDTH / 2),
      ),

      {
        density: PEN.DENSITY,
        friction: PEN.FRICTION,
        restitution: PEN.RESTITUTION,
      },
    );

    // Left circle

    this.body.createFixture(
      planck.Circle(
        planck.Vec2(-PhysicsUtils.toWorld(halfBody), 0),

        PhysicsUtils.toWorld(PEN.END_RADIUS),
      ),

      {
        density: PEN.DENSITY,
        friction: PEN.FRICTION,
        restitution: PEN.RESTITUTION,
      },
    );

    // Right circle

    this.body.createFixture(
      planck.Circle(
        planck.Vec2(PhysicsUtils.toWorld(halfBody), 0),

        PhysicsUtils.toWorld(PEN.END_RADIUS),
      ),

      {
        density: PEN.DENSITY,
        friction: PEN.FRICTION,
        restitution: PEN.RESTITUTION,
      },
    );
  }

  //--------------------------------------------------
  // Graphics
  //--------------------------------------------------

  createGraphics() {
    this.container = this.scene.add.container();

    this.shadow = this.scene.add.graphics();
    this.pen = this.scene.add.graphics();
    this.selection = this.scene.add.graphics();

    //---------------- Shadow ----------------

    this.shadow.fillStyle(0x000000, 0.18);

    this.shadow.fillRoundedRect(
      -PEN.LENGTH / 2 + 2,
      -PEN.WIDTH / 2 + 2,

      PEN.LENGTH,
      PEN.WIDTH,

      PEN.END_RADIUS,
    );

    //---------------- Pen ----------------

    this.drawPen();

    //---------------- Selection ----------------

    this.selection.lineStyle(3, 0xffff00);

    this.selection.strokeRoundedRect(
      -PEN.LENGTH / 2 - 5,
      -PEN.WIDTH / 2 - 5,

      PEN.LENGTH + 10,
      PEN.WIDTH + 10,

      PEN.END_RADIUS + 5,
    );

    this.selection.setVisible(false);

    this.container.add([this.shadow, this.pen, this.selection]);
  }

  //--------------------------------------------------
  // Draw Pen
  //--------------------------------------------------

  drawPen() {
    const g = this.pen;

    g.clear();

    // Barrel

    g.fillStyle(this.color);

    g.fillRoundedRect(
      -PEN.LENGTH / 2,
      -PEN.WIDTH / 2,

      PEN.LENGTH,
      PEN.WIDTH,

      PEN.END_RADIUS,
    );

    // Rear Cap

    g.fillStyle(0x222222);

    g.fillRect(
      -PEN.LENGTH / 2,
      -PEN.WIDTH / 2,

      10,
      PEN.WIDTH,
    );

    // Metallic Tip

    g.fillStyle(0xd0d0d0);

    g.fillTriangle(
      PEN.LENGTH / 2,
      -PEN.WIDTH / 2,

      PEN.LENGTH / 2,
      PEN.WIDTH / 2,

      PEN.LENGTH / 2 + 14,
      0,
    );

    // Highlight

    g.fillStyle(0xffffff, 0.3);

    g.fillRect(
      -20,
      -PEN.WIDTH / 2,

      40,
      2,
    );
  }

  //--------------------------------------------------
  // Update
  //--------------------------------------------------

  update() {
    const p = PhysicsUtils.pixelVec(this.body.getPosition());

    this.container.setPosition(p.x, p.y);
    this.container.rotation = this.body.getAngle();

    if (this.selected) {
      this.updateGlow();
    }

    const v = this.body.getLinearVelocity();

    if (
      v.lengthSquared() < 0.0008 &&
      Math.abs(this.body.getAngularVelocity()) < 0.03
    ) {
      this.body.setLinearVelocity(planck.Vec2(0, 0));
      this.body.setAngularVelocity(0);
    }
    // this.resolveTinyOverlap();
  }

  //--------------------------------------------------
  // Shoot
  //--------------------------------------------------

  shoot(localPoint, impulse) {
    const worldPoint = this.body.getWorldPoint(localPoint);

    this.body.applyLinearImpulse(
      planck.Vec2(impulse.x, impulse.y),

      worldPoint,

      true,
    );
  }

  //--------------------------------------------------
  // Glow
  //--------------------------------------------------

  updateGlow() {
    this.glowTime += 0.05;

    const scale = 1 + Math.sin(this.glowTime) * 0.03;

    this.container.setScale(scale);

    this.selection.alpha = 0.6 + Math.sin(this.glowTime * 2) * 0.2;
  }

  //--------------------------------------------------
  // Selection
  //--------------------------------------------------

  setSelected(selected) {
    this.selected = selected;

    this.selection.setVisible(selected);

    if (selected) {
      this.container.setScale(1.05);
    } else {
      this.container.setScale(1);
    }
  }

  //--------------------------------------------------
  // Helpers
  //--------------------------------------------------

  containsPoint(x, y, tolerance = 0) {
    if (PhysicsUtils.bodyContainsPoint(this.body, x, y)) return true;

    if (tolerance <= 0) return false;

    // Fall back to a capsule distance check so small screens / fat
    // fingers get some slack when selecting the pen.
    const local = this.getLocalPoint(x, y);

    const halfBody = PhysicsUtils.toWorld(PEN.LENGTH / 2 - PEN.END_RADIUS);

    const clampedX = Phaser.Math.Clamp(local.x, -halfBody, halfBody);

    const dx = local.x - clampedX;
    const dy = local.y;

    const dist = Math.sqrt(dx * dx + dy * dy);

    const radius =
      PhysicsUtils.toWorld(PEN.END_RADIUS) + PhysicsUtils.toWorld(tolerance);

    return dist <= radius;
  }

  getLocalPoint(x, y) {
    return this.body.getLocalPoint(PhysicsUtils.worldVec(x, y));
  }

  isMoving() {
    return PhysicsUtils.isBodyMoving(this.body);
  }

  // Pure velocity check, ignoring Planck's isAwake() sleep timer.
  // Used by the optional turn-based settle wait (GameConfig.WAIT_FOR_SETTLE).
  isSettled(linearThreshold, angularThreshold) {
    const v = this.body.getLinearVelocity();
    const av = this.body.getAngularVelocity();

    const speed = v.x * v.x + v.y * v.y;

    if (speed > linearThreshold) return false;
    if (Math.abs(av) > angularThreshold) return false;

    return true;
  }

  // Snap velocity to zero (used when the settle wait times out)
  stop() {
    PhysicsUtils.stopBody(this.body);
  }

  isMoving() {
    const v = this.body.getLinearVelocity();
    const av = this.body.getAngularVelocity();

    const speed = v.x * v.x + v.y * v.y;

    if (speed > 0.0005) return true;
    if (Math.abs(av) > 0.02) return true;

    // ALSO check contact bias (important)
    if (this.body.isAwake && this.body.isAwake()) return true;

    return false;
  }

  //--------------------------------------------------
  // Reset
  //--------------------------------------------------

  reset(x, y, angle = 0) {
    this.body.setTransform(
      PhysicsUtils.worldVec(x, y),

      angle,
    );

    this.body.setLinearVelocity(planck.Vec2(0, 0));

    this.body.setAngularVelocity(0);

    this.body.setAwake(true);

    this.update();
  }

  //--------------------------------------------------
  // Shoot
  //--------------------------------------------------

  shoot(localPoint, impulse) {
    const worldPoint = this.body.getWorldPoint(localPoint);

    this.body.applyLinearImpulse(
      planck.Vec2(impulse.x, impulse.y),

      worldPoint,

      true,
    );
  }

  //--------------------------------------------------
  // Is Sleeping
  //--------------------------------------------------

  isSleeping() {
    return this.body.isSleeping && this.body.isSleeping();
  }

  //--------------------------------------------------
  // Destroy
  //--------------------------------------------------

  destroy() {
    this.physics.world.destroyBody(this.body);

    this.container.destroy(true);
  }

  resolveTinyOverlap() {
    const v = this.body.getLinearVelocity();

    const speed = v.x * v.x + v.y * v.y;

    if (speed < 0.0003) {
      // tiny nudge to break solver lock
      this.body.applyForceToCenter(
        planck.Vec2(
          (Math.random() - 0.5) * 0.0005,
          (Math.random() - 0.5) * 0.0005,
        ),
        true,
      );
    }
  }

  //--------------------------------------------------
  // World Bounds
  //--------------------------------------------------

  getWorldBounds() {
    const position = this.body.getPosition();

    const angle = this.body.getAngle();

    const halfLength = PEN.LENGTH / 2 - PEN.ELIMINATION_PADDING;

    const halfWidth = PEN.WIDTH / 2 - PEN.ELIMINATION_PADDING;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

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
      const worldX = position.x * 50 + c.x * cos - c.y * sin;

      const worldY = position.y * 50 + c.x * sin + c.y * cos;

      minX = Math.min(minX, worldX);
      maxX = Math.max(maxX, worldX);

      minY = Math.min(minY, worldY);
      maxY = Math.max(maxY, worldY);
    }

    return {
      left: minX,
      right: maxX,
      top: minY,
      bottom: maxY,
    };
  }

  //--------------------------------------------------
  // Completely outside table?
  //--------------------------------------------------

  isCompletelyOutside(table) {
    const b = this.getWorldBounds();

    return (
      b.right < table.X ||
      b.left > table.X + table.WIDTH ||
      b.bottom < table.Y ||
      b.top > table.Y + table.HEIGHT
    );
  }

  //--------------------------------------------------
  // Fade Out & Destroy
  //--------------------------------------------------

  fadeOutAndDestroy() {
    // Prevent multiple calls
    if (this.destroying) return;

    this.destroying = true;

    this.body.setActive(false);

    this.scene.tweens.add({
      targets: this.container,

      alpha: 0,

      y: this.container.y + 30,

      scaleX: 0.85,
      scaleY: 0.85,

      duration: 350,

      ease: 'Quad.In',

      onComplete: () => {
        this.destroy();
      },
    });
  }
}

/* 
Pen should have two completely separate responsibilities:
Pen
│
├── Physics Body (Planck)
│
└── Visual Container (Phaser)
       │
       ├── Shadow
       ├── Barrel
       ├── Tip
       ├── Cap
       ├── Selection Ring
       └── Debug Layer */
