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

    // Client-side shot prediction (see NetGameScene.onPointerUp()) —
    // only ever set on the local player's own pen, right after it
    // sends a 'shoot' message, so that pen starts visibly moving
    // immediately instead of sitting frozen for a full network round
    // trip waiting on the server's next authoritative 'state' snapshot.
    this.predicting = false;
    this.predVx = 0;
    this.predVy = 0;
    this.predStartX = 0;
    this.predStartY = 0;
    this.predMsLeft = 0;

    this._heliCharged = false;
    this._heliSpinning = false;
    this.heliChargeTween = null;
    this.helicopterSpinTween = null;

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
      .text(22, -PEN.WIDTH / 2 - 22, '⚡', { fontSize: '22px' })
      .setOrigin(0.5);

    this.boostIcon.setVisible(false);
    this.boostTween = null;

    //---------------- Helicopter indicator (see setHelicopterCharged() / setHelicopterActive()) ----------------
    // Same idea as boostIcon above, but for the Helicopter Shot pickup —
    // the server tells us (via 'state' msg.nextShotHelicopter and each
    // pen's own snapshot().helicopterActive) whether this pen currently
    // has one charged, or is currently mid-spin from having just taken
    // one, respectively.

    this.helicopterIcon = this.scene.add
      .text(-22, -PEN.WIDTH / 2 - 22, '🚁', { fontSize: '22px' })
      .setOrigin(0.5);

    this.helicopterIcon.setVisible(false);

    this.container.add([
      this.shadow,
      this.pen,
      this.selection,
      this.boostIcon,
      this.helicopterIcon,
    ]);
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

  //--------------------------------------------------
  // Helicopter Shot — two independent server-driven signals share one
  // icon: "charged" (pulses, waiting to be fired) and "spinning"
  // (rotates, currently mid-shot). They don't overlap in practice —
  // the server clears charged the same tick it sets spinning — but
  // each is tracked separately so either can toggle off without
  // stomping the other.
  //--------------------------------------------------

  setHelicopterCharged(active) {
    this._heliCharged = active;
    this._syncHelicopterIcon();
  }

  setHelicopterActive(active) {
    this._heliSpinning = active;
    this._syncHelicopterIcon();
  }

  _syncHelicopterIcon() {
    this.helicopterIcon.setVisible(this._heliCharged || this._heliSpinning);

    if (this._heliSpinning) {
      if (this.heliChargeTween) {
        this.heliChargeTween.stop();
        this.heliChargeTween = null;
        this.helicopterIcon.setScale(1);
      }

      if (!this.helicopterSpinTween) {
        this.helicopterSpinTween = this.scene.tweens.add({
          targets: this.helicopterIcon,
          angle: 360,
          duration: 260,
          repeat: -1,
          ease: 'Linear',
        });
      }

      return;
    }

    if (this.helicopterSpinTween) {
      this.helicopterSpinTween.stop();
      this.helicopterSpinTween = null;
      this.helicopterIcon.setAngle(0);
    }

    if (this._heliCharged) {
      if (!this.heliChargeTween) {
        this.heliChargeTween = this.scene.tweens.add({
          targets: this.helicopterIcon,
          scale: { from: 0.85, to: 1.2 },
          duration: 320,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.InOut',
        });
      }
    } else if (this.heliChargeTween) {
      this.heliChargeTween.stop();
      this.heliChargeTween = null;
      this.helicopterIcon.setScale(1);
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
  // Client-side shot prediction (see NetGameScene.onPointerUp()) — a
  // short-lived local "coast" applied only to the shooter's own pen
  // the instant they release, so it starts moving immediately instead
  // of waiting a full round trip for the server to confirm the shot.
  // Capped at predMsLeft either way, so a slow/lost network reply
  // never leaves the pen drifting on its own for long.
  //--------------------------------------------------

  predictShot(vx, vy) {
    this.predicting = true;
    this.predVx = vx;
    this.predVy = vy;
    this.predStartX = this.container.x;
    this.predStartY = this.container.y;
    this.predMsLeft = 400;
  }

  updatePrediction(deltaMs) {
    if (!this.predicting) return;

    const dt = deltaMs / 1000;

    this.container.x += this.predVx * dt;
    this.container.y += this.predVy * dt;

    // A rough, purely-visual damping feel — doesn't need to match the
    // server's real physics, this is only ever on screen for a few
    // frames before real data takes over.
    const damping = Math.exp(-3.5 * dt);

    this.predVx *= damping;
    this.predVy *= damping;

    this.predMsLeft -= deltaMs;

    if (this.predMsLeft <= 0) this.predicting = false;
  }

  //--------------------------------------------------
  // Driven entirely by server snapshots
  //--------------------------------------------------

  setTransform(x, y, angle) {
    if (this.predicting) {
      // Until the server's own position has visibly moved away from
      // where this shot started, every incoming snapshot is still an
      // older, pre-shot tick (in flight when we fired) — accept it as
      // a no-op and keep predicting rather than snapping the pen back
      // to where it started.
      const dx = x - this.predStartX;
      const dy = y - this.predStartY;

      if (dx * dx + dy * dy > 25) {
        this.predicting = false;
      } else {
        return;
      }
    }

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
    if (this.heliChargeTween) this.heliChargeTween.stop();
    if (this.helicopterSpinTween) this.helicopterSpinTween.stop();

    this.container.destroy(true);

    this.trail.destroy();
  }
}
