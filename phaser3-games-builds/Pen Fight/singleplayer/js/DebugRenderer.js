//==================================================
// DebugRenderer.js
//==================================================

import { DEBUG } from './Constants.js';
import PhysicsUtils from './PhysicsUtils.js';

export default class DebugRenderer {
  constructor(scene, physics) {
    this.scene = scene;
    this.physics = physics;

    this.enabled = DEBUG.ENABLED;

    this.graphics = scene.add.graphics();

    this.graphics.setDepth(10000);

    this.registerKeys();
  }

  //--------------------------------------------------
  // Keyboard
  //--------------------------------------------------

  registerKeys() {
    this.scene.input.keyboard.on(
      'keydown-D',

      () => {
        this.enabled = !this.enabled;

        this.graphics.setVisible(this.enabled);
      },
    );
  }

  //--------------------------------------------------
  // Update
  //--------------------------------------------------

  update() {
    this.graphics.clear();

    if (!this.enabled) return;

    for (
      let body = this.physics.world.getBodyList();
      body;
      body = body.getNext()
    ) {
      this.drawBody(body);
    }
  }

  //--------------------------------------------------
  // Draw One Body
  //--------------------------------------------------

  drawBody(body) {
    const g = this.graphics;

    const position = PhysicsUtils.pixelVec(body.getPosition());

    const angle = body.getAngle();

    //------------------------------------------
    // Fixtures
    //------------------------------------------

    for (
      let fixture = body.getFixtureList();
      fixture;
      fixture = fixture.getNext()
    ) {
      const shape = fixture.getShape();

      switch (shape.getType()) {
        case 'circle':
          this.drawCircle(position, angle, shape, body.isAwake());

          break;

        case 'polygon':
          this.drawPolygon(position, angle, shape, body.isAwake());

          break;

        case 'edge':
          this.drawEdge(shape);

          break;
      }
    }

    //------------------------------------------
    // Center
    //------------------------------------------

    if (DEBUG.DRAW_CENTERS) {
      g.fillStyle(0xff0000);

      g.fillCircle(position.x, position.y, 3);
    }

    //------------------------------------------
    // Velocity
    //------------------------------------------

    if (DEBUG.DRAW_VELOCITIES) {
      const v = body.getLinearVelocity();

      g.lineStyle(2, 0x00ffff);

      g.beginPath();

      g.moveTo(position.x, position.y);

      g.lineTo(
        position.x + v.x * 20,

        position.y + v.y * 20,
      );

      g.strokePath();
    }
  }

  //--------------------------------------------------
  // Circle
  //--------------------------------------------------

  drawCircle(position, angle, shape, awake) {
    const g = this.graphics;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const x =
      position.x + PhysicsUtils.toPixels(shape.m_p.x * cos - shape.m_p.y * sin);

    const y =
      position.y + PhysicsUtils.toPixels(shape.m_p.x * sin + shape.m_p.y * cos);

    g.lineStyle(
      1,

      awake ? 0x00ff00 : 0x888888,
    );

    g.strokeCircle(
      x,

      y,

      PhysicsUtils.toPixels(shape.m_radius),
    );
  }

  //--------------------------------------------------
  // Polygon
  //--------------------------------------------------

  drawPolygon(position, angle, shape, awake) {
    const g = this.graphics;

    g.lineStyle(
      1,

      awake ? 0x00ff00 : 0x888888,
    );

    const verts = shape.m_vertices;

    g.beginPath();

    for (let i = 0; i < verts.length; i++) {
      const v = verts[i];

      const x =
        position.x +
        PhysicsUtils.toPixels(v.x * Math.cos(angle) - v.y * Math.sin(angle));

      const y =
        position.y +
        PhysicsUtils.toPixels(v.x * Math.sin(angle) + v.y * Math.cos(angle));

      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }

    g.closePath();

    g.strokePath();
  }

  //--------------------------------------------------
  // Edge
  //--------------------------------------------------

  drawEdge(shape) {
    const g = this.graphics;

    g.lineStyle(1, 0xffffff);

    g.beginPath();

    g.moveTo(
      PhysicsUtils.toPixels(shape.m_vertex1.x),

      PhysicsUtils.toPixels(shape.m_vertex1.y),
    );

    g.lineTo(
      PhysicsUtils.toPixels(shape.m_vertex2.x),

      PhysicsUtils.toPixels(shape.m_vertex2.y),
    );

    g.strokePath();
  }
}
