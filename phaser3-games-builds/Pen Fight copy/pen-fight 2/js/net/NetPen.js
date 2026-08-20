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
import { shadeColor } from '../ColorUtils.js';
import { isWebGLRenderer, createHoloShineOverlay } from '../fx/Holographic.js';

export default class NetPen {
  constructor(scene, x, y, color, playerId, sticker = '', holo = false) {
    this.scene = scene;
    this.color = color;
    this.playerId = playerId;
    // Cosmetic-only emoji drawn on the barrel (see PenLibrary.js /
    // PlayerProfile.js) — each player's own choice, synced from the
    // server (see GameRoom.mjs's styles / NetGameScene's ensurePens()).
    this.sticker = sticker || '';
    this.holo = false;
    this._holoShine = null;
    this._holoFallbackTween = null;
    this._holoFallbackGraphics = null;

    // See setNightShadow() — null (not false) so createGraphics()'s
    // initial call actually draws the shadow instead of no-op-ing.
    this._nightShadow = null;

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

    this._shielded = false;
    this.shieldTween = null;

    this.createGraphics();
    this.setTransform(x, y, 0);

    this.trail = new Trail(scene, color);

    this.setTextured(holo);
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

    //---------------- Shadow (see setNightShadow() below) ----------------

    this.setNightShadow(false);

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

    //---------------- Shield indicator (see setShielded()) ----------------
    // Below the pen rather than above (where boost/helicopter live) so
    // a pen charged with one of those *and* shielded doesn't show two
    // overlapping icons.

    this.shieldIcon = this.scene.add
      .text(0, PEN.WIDTH / 2 + 22, '🛡️', { fontSize: '20px' })
      .setOrigin(0.5);

    this.shieldIcon.setVisible(false);

    //---------------- Sticker (cosmetic, see PlayerProfile.js) ----------------

    this.stickerText = this.scene.add
      .text(0, 0, this.sticker, { fontSize: '18px' })
      .setOrigin(0.5);

    this.stickerText.setVisible(!!this.sticker);

    this.container.add([
      this.shadow,
      this.pen,
      this.stickerText,
      this.selection,
      this.boostIcon,
      this.helicopterIcon,
      this.shieldIcon,
    ]);
  }

  //--------------------------------------------------
  // Apply a (possibly updated) color/sticker after creation — used
  // when a player's chosen style arrives after this pen was already
  // created with a fallback default (e.g. a spectator's room-joined
  // beats another player's style across the wire), see
  // NetGameScene.ensurePens().
  //--------------------------------------------------

  setStyle(color, sticker = '', holo = false) {
    if (color === this.color && (sticker || '') === this.sticker && !!holo === this.holo) return;

    this.color = color;
    this.sticker = sticker || '';

    this.drawPen();
    this.trail.setColor(color);

    this.stickerText.setText(this.sticker);
    this.stickerText.setVisible(!!this.sticker);

    this.setTextured(holo);
  }

  //--------------------------------------------------
  // Holographic shimmer texture (see PenLibrary.js's TEXTURES /
  // PlayerProfile.js's holo flag) — a straight mirror of Pen.js's own
  // setTextured()/_applyHoloEffect()/_setHoloFallback(), see that file
  // (and fx/Holographic.js) for the full explanation of the real
  // WebGL-shader / Canvas-sweep split.
  //--------------------------------------------------

  setTextured(active) {
    this.holo = !!active;

    this._applyHoloEffect();
  }

  _applyHoloEffect() {
    if (this._holoShine) {
      this._holoShine.destroy();
      this._holoShine = null;
    }

    this._setHoloFallback(false);

    if (!this.holo) return;

    if (isWebGLRenderer(this.scene)) {
      this._holoShine = createHoloShineOverlay(this.scene, this.container);

      if (!this._holoShine) this._setHoloFallback(true);

      return;
    }

    this._setHoloFallback(true);
  }

  // Canvas-renderer fallback (also used if Shine itself fails to
  // attach on WebGL) — see Pen.js's own _setHoloFallback() for the
  // full reasoning, this is a straight port.
  _setHoloFallback(active) {
    if (active === !!this._holoFallbackTween) return;

    if (!active) {
      if (this._holoFallbackTween) {
        this._holoFallbackTween.stop();
        this._holoFallbackTween = null;
      }

      if (this._holoFallbackGraphics) {
        this._holoFallbackGraphics.destroy();
        this._holoFallbackGraphics = null;
      }

      return;
    }

    const g = this.scene.add.graphics();

    g.setBlendMode(Phaser.BlendModes.ADD);
    this.container.add(g);
    this._holoFallbackGraphics = g;

    const state = { t: 0 };

    this._holoFallbackTween = this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: 1500,
      repeat: -1,
      ease: 'Sine.InOut',

      onUpdate: () => {
        g.clear();

        const bandWidth = 22;
        const bandX = -PEN.LENGTH / 2 - bandWidth + state.t * (PEN.LENGTH + bandWidth * 2);

        g.fillStyle(0xffffff, 0.3);
        g.fillRect(bandX, -PEN.WIDTH / 2, bandWidth, PEN.WIDTH);
      },
    });
  }

  setShielded(active) {
    if (active === this._shielded) return;

    this._shielded = active;
    this.shieldIcon.setVisible(active);

    if (active) {
      if (this.shieldTween) return;

      this.shieldTween = this.scene.tweens.add({
        targets: this.shieldIcon,
        scale: { from: 0.85, to: 1.15 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    } else if (this.shieldTween) {
      this.shieldTween.stop();
      this.shieldTween = null;
      this.shieldIcon.setScale(1);
    }
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

    const halfL = PEN.LENGTH / 2;
    const halfW = PEN.WIDTH / 2;
    const r = PEN.END_RADIUS;

    // Barrel — straight port of Pen.js's own drawPen() (see that
    // file's comments for the full reasoning), so both modes render
    // identically.

    g.fillStyle(this.color);
    g.fillRoundedRect(-halfL, -halfW, PEN.LENGTH, PEN.WIDTH, r);

    g.fillStyle(shadeColor(this.color, 0.55), 0.35);
    g.fillRoundedRect(-halfL + 4, -halfW, PEN.LENGTH - 8, halfW * 0.55, {
      tl: r * 0.6,
      tr: r * 0.6,
      bl: 0,
      br: 0,
    });

    g.fillStyle(shadeColor(this.color, -0.45), 0.3);
    g.fillRoundedRect(-halfL + 4, halfW * 0.15, PEN.LENGTH - 8, halfW * 0.85, {
      tl: 0,
      tr: 0,
      bl: r * 0.6,
      br: r * 0.6,
    });

    g.fillStyle(0xffffff, 0.55);
    g.fillRoundedRect(-halfL + 14, -halfW + 3, PEN.LENGTH - 28, 2.5, 1.5);

    g.lineStyle(1.5, shadeColor(this.color, -0.5), 0.55);
    g.strokeRoundedRect(-halfL, -halfW, PEN.LENGTH, PEN.WIDTH, r);

    g.fillStyle(0x222222);
    g.fillRect(-halfL, -halfW, 10, PEN.WIDTH);

    g.fillStyle(0x555555, 0.5);
    g.fillRect(-halfL, -halfW, 10, halfW * 0.5);

    g.fillStyle(0xd0d0d0);
    g.fillTriangle(halfL, -halfW, halfL, halfW, halfL + 14, 0);

    g.fillStyle(0xffffff, 0.5);
    g.fillTriangle(halfL, -halfW, halfL, 0, halfL + 14, 0);
  }

  //--------------------------------------------------
  // Shadow — straight port of Pen.js's own setNightShadow() (see that
  // file's comments for the full reasoning), so both modes render
  // identically.
  //--------------------------------------------------

  setNightShadow(active) {
    if (active === this._nightShadow) return;

    this._nightShadow = !!active;

    const g = this.shadow;

    g.clear();

    if (!this._nightShadow) {
      g.fillStyle(0x000000, 0.18);
      g.fillRoundedRect(-PEN.LENGTH / 2 + 2, -PEN.WIDTH / 2 + 2, PEN.LENGTH, PEN.WIDTH, PEN.END_RADIUS);

      return;
    }

    const layers = 6;
    const offsetX = 3;
    const offsetY = 6;

    for (let i = layers; i >= 1; i--) {
      const grow = i * 3;
      const alpha = 0.05 + (layers - i) * 0.02;

      g.fillStyle(0x000000, alpha);
      g.fillRoundedRect(
        -PEN.LENGTH / 2 - grow + offsetX,
        -PEN.WIDTH / 2 - grow + offsetY,

        PEN.LENGTH + grow * 2,
        PEN.WIDTH + grow * 2,

        PEN.END_RADIUS + grow,
      );
    }
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
  // Lobby-only "is this my pen" highlight (see NetGameScene.js's
  // applyLobbyPositions()) — full brightness + a selection glow for
  // the player's own pen, dimmed for everyone else's, so it's obvious
  // at a glance which one to drag before ever touching it.
  //--------------------------------------------------
  // mode: true = this is your own pen, false = someone else's,
  // null = no distinction to draw (spectating — nothing is "yours").
  // No-ops on a disconnected/empty seat — its ghost alpha (see
  // setConnected() above) always wins over this.
  //--------------------------------------------------

  setLobbyHighlight(mode) {
    if (!this.connected) return;

    if (mode === null) {
      this.container.setAlpha(1);
      this.setSelected(false);
      return;
    }

    this.container.setAlpha(mode ? 1 : 0.5);
    this.setSelected(mode);
  }

  // Called right as a match begins (see NetGameScene.js's 'match-start'
  // handler) — setConnected(true) alone won't reliably clear this:
  // its own early-return (connected === this.connected) is a no-op
  // whenever a pen was *already* connected, which is exactly the case
  // coming out of the lobby, and would otherwise leave an opponent's
  // pen stuck dimmed at 0.5 alpha for the entire match.
  clearLobbyHighlight() {
    this.container.setAlpha(1);
    this.setSelected(false);
  }

  //--------------------------------------------------
  // Lobby placement preview (see LobbyPlacement.js) — live feedback
  // while dragging so an invalid spot (off the table, overlapping
  // another pen) is obviously wrong *before* release, instead of the
  // pen only snapping back after a round trip to the server confirms
  // the rejection (see NetGameScene.js's onPointerMove()/onPointerUp()
  // for the drag itself).
  //--------------------------------------------------

  setPlacementValid(valid) {
    if (valid === this._placementValid) return;

    this._placementValid = valid;

    this.container.setAlpha(valid ? 1 : 0.45);
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
    if (this.shieldTween) this.shieldTween.stop();

    if (this._holoShine) {
      this._holoShine.destroy();
      this._holoShine = null;
    }
    this._setHoloFallback(false);

    this.container.destroy(true);

    this.trail.destroy();
  }
}
