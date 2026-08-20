//==================================================
// NetPen.js
//==================================================
// Render-only pen for multiplayer. No physics body at all — the
// server is the only thing that simulates physics; this just draws a
// pen and moves it wherever setTransform() says to, every time a
// 'state' message arrives from the server. Visuals are a straight
// port of Pen.js's drawing code so both modes look identical.
//==================================================

import { PEN } from '../Constants.js';

export default class NetPen {
  constructor(scene, x, y, color, playerId) {
    this.scene = scene;
    this.color = color;
    this.playerId = playerId;

    this.selected = false;
    this.glowTime = 0;

    this.createGraphics();
    this.setTransform(x, y, 0);
  }

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

  drawPen() {
    const g = this.pen;

    g.clear();

    g.fillStyle(this.color);

    g.fillRoundedRect(
      -PEN.LENGTH / 2,
      -PEN.WIDTH / 2,

      PEN.LENGTH,
      PEN.WIDTH,

      PEN.END_RADIUS,
    );

    g.fillStyle(0x222222);

    g.fillRect(-PEN.LENGTH / 2, -PEN.WIDTH / 2, 10, PEN.WIDTH);

    g.fillStyle(0xd0d0d0);

    g.fillTriangle(
      PEN.LENGTH / 2,
      -PEN.WIDTH / 2,

      PEN.LENGTH / 2,
      PEN.WIDTH / 2,

      PEN.LENGTH / 2 + 14,
      0,
    );

    g.fillStyle(0xffffff, 0.3);

    g.fillRect(-20, -PEN.WIDTH / 2, 40, 2);
  }

  //--------------------------------------------------
  // Driven entirely by server snapshots
  //--------------------------------------------------

  setTransform(x, y, angle) {
    this.container.setPosition(x, y);
    this.container.rotation = angle;

    if (this.selected) this.updateGlow();
  }

  updateGlow() {
    this.glowTime += 0.05;

    const scale = 1 + Math.sin(this.glowTime) * 0.03;

    this.container.setScale(scale);

    this.selection.alpha = 0.6 + Math.sin(this.glowTime * 2) * 0.2;
  }

  setSelected(selected) {
    this.selected = selected;

    this.selection.setVisible(selected);

    this.container.setScale(selected ? 1.05 : 1);
  }

  //--------------------------------------------------
  // Local hit test (screen point -> is it on this pen?), pure math,
  // no physics body needed. Mirrors Pen.containsPoint.
  //--------------------------------------------------

  containsPoint(x, y, tolerance = 0) {
    const angle = this.container.rotation;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const dx = x - this.container.x;
    const dy = y - this.container.y;

    // world -> local
    const localX = dx * cos + dy * sin;
    const localY = -dx * sin + dy * cos;

    const halfBody = PEN.LENGTH / 2 - PEN.END_RADIUS;

    const clampedX = Phaser.Math.Clamp(localX, -halfBody, halfBody);

    const ddx = localX - clampedX;
    const ddy = localY;

    const dist = Math.sqrt(ddx * ddx + ddy * ddy);

    const radius = PEN.END_RADIUS + tolerance;

    return dist <= radius;
  }

  destroy() {
    this.container.destroy(true);
  }
}
