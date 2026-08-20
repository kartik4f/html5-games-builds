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
import { Trail } from '../JuiceFX.js';

export default class NetPen {
  constructor(scene, x, y, color, playerId) {
    this.scene = scene;
    this.color = color;
    this.playerId = playerId;

    this.selected = false;
    this.glowTime = 0;
    this.eliminated = false;
    this.connected = true;
    this.tween = null;

    this.createGraphics();
    this.setTransform(x, y, 0);

    this.trail = new Trail(scene, color);
  }

  //--------------------------------------------------
  // Speed trail — the server tells us positions, not velocities, so
  // NetGameScene decides frame-to-frame whether this pen moved far
  // enough between snapshots to count as "fast" and calls this.
  //--------------------------------------------------

  emitTrail() {
    this.trail.emitAt(this.container.x, this.container.y);
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

    //---------------- Boost indicator (see setBoosted()) ----------------
    // Mirrors Pen.js — the server tells us (via 'state' msg.nextShotBoost)
    // which players currently have a Speed Boost queued for their next
    // shot; this is what makes that visible on the pen itself, not just
    // as a one-off pickup effect.

    this.boostIcon = this.scene.add
      .text(0, -PEN.WIDTH / 2 - 22, '⚡', { fontSize: '22px' })
      .setOrigin(0.5);

    this.boostIcon.setVisible(false);
    this.boostTween = null;

    this.container.add([this.shadow, this.pen, this.selection, this.boostIcon]);
  }

  setBoosted(active) {
    this.boostIcon.setVisible(active);

    if (active) {
      if (this.boostTween) return;

      this.boostTween = this.scene.tweens.add({
        targets: this.boostIcon,
        scale: { from: 0.85, to: 1.2 },
        duration: 380,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    } else if (this.boostTween) {
      this.boostTween.stop();
      this.boostTween = null;
      this.boostIcon.setScale(1);
    }
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
  // Eliminated (fell off the table) — fade it out of the way rather
  // than destroying it, since a restart brings it right back.
  //--------------------------------------------------

  setEliminated(eliminated) {
    if (eliminated === this.eliminated) return; // idempotent, no re-tween

    this.eliminated = eliminated;

    if (this.tween) this.tween.stop();

    this.tween = this.scene.tweens.add({
      targets: this.container,
      alpha: eliminated ? 0.25 : 1,
      duration: 300,
      ease: eliminated ? 'Quad.In' : 'Quad.Out',
    });

    if (eliminated) this.setSelected(false);
  }

  //--------------------------------------------------
  // Connected (lobby only) — an empty seat shows as a faint ghost of
  // its assigned color so you can see where a joining player will
  // appear, without looking like a real placed pen yet.
  //--------------------------------------------------

  setConnected(connected) {
    if (connected === this.connected) return;

    this.connected = connected;

    this.container.setAlpha(connected ? 1 : 0.2);
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
    if (this.boostTween) this.boostTween.stop();

    this.container.destroy(true);

    this.trail.destroy();
  }
}
