//==================================================
// Pen.js
//==================================================

import { PEN } from './Constants.js';
import { POWERUPS } from './GameConfig.js';
import PhysicsUtils from './PhysicsUtils.js';
import { Trail } from './JuiceFX.js';
import { shadeColor } from './ColorUtils.js';
import { isWebGLRenderer, createHoloShineOverlay } from './fx/Holographic.js';

// Squared world-space speed above which a pen is considered "fast
// enough" to leave a trail — well above Pen.isMoving()'s threshold,
// so only genuinely hard shots trail, not every idle creep.
const TRAIL_SPEED_SQ_THRESHOLD = 0.01;

export default class Pen {
  constructor(scene, physics, x, y, color, playerId, sticker = '', holo = false) {
    this.scene = scene;
    this.physics = physics;
    this.color = color;
    this.playerId = playerId;
    // Cosmetic-only emoji drawn on the barrel (see PenLibrary.js /
    // PlayerProfile.js) — '' means no sticker, same as not having one.
    this.sticker = sticker || '';
    // Holographic texture (see setTextured() below) — applied after
    // createGraphics() so the container/pen graphics already exist.
    this.holo = false;
    this._holoShine = null;
    this._holoFallbackTween = null;
    this._holoFallbackGraphics = null;

    // Shadow style (see setNightShadow() below) — null (not
    // false/true) so createGraphics()'s initial setNightShadow(false)
    // call actually draws the shadow instead of getting skipped by
    // that method's own no-op guard.
    this._nightShadow = null;

    this.selected = false;

    // Set the moment elimination starts (fadeOutAndDestroy) and never
    // cleared — PenManager keeps every pen (including eliminated ones)
    // in its list for the rest of the match, since removing one would
    // shift array indices out from under GameRules' currentTurnIndex.
    // That means PenManager.update() keeps calling this pen's update()
    // every frame for the rest of the match, well after its physics
    // body/container/particle trail have been torn down — this flag is
    // what makes that a no-op instead of a crash (see update() below).
    this.destroying = false;

    // Power-ups (see PowerUps.js) — consumed by the next shot, then
    // reset to 1. 1 = no boost.
    this.nextShotBoost = 1;

    // Helicopter Shot power-up (see PowerUps.js / activateHelicopter()
    // below) — true once charged, consumed by the next shot.
    this.nextShotHelicopter = false;
    this.helicopterActive = false;
    this.helicopterTimer = null;
    this.helicopterSpinTween = null;
    this.heliChargeTween = null;

    // Shield power-up (see PowerUps.js / activateShield() below) —
    // active immediately on pickup (not queued for the next shot like
    // the two above), saves this pen from its next elimination.
    this.hasShield = false;
    this.shieldTimer = null;
    this.shieldTween = null;

    this.createBody(x, y);
    this.createGraphics();
    this.glowTime = 0;

    this.trail = new Trail(scene, color);

    this.setTextured(holo);
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

    // Bullet flag — turns on continuous collision detection (Planck
    // sweeps the body's motion each step instead of only checking its
    // end-of-step position) for this body against regular (non-bullet)
    // dynamic bodies. Without this, a hard-hit pen moving fast enough
    // to cross another pen's whole width within a single physics step
    // (1/60s) can tunnel straight through it with no collision ever
    // registering — every pen is a bullet, so this covers pen-on-pen
    // hits at any speed the game's impulse range can produce.
    this.body.setBullet(true);

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

    // Back-reference so Physics.js's contact callback can turn a
    // Planck body back into the Pen that owns it (for collision juice).
    this.body.penRef = this;
  }

  //--------------------------------------------------
  // Graphics
  //--------------------------------------------------

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
    // A Speed Boost pickup (PowerUps.js) is otherwise invisible once
    // its own pickup animation finishes — this is what tells the
    // player "your NEXT shot is boosted" until they actually take it.

    this.boostIcon = this.scene.add
      .text(22, -PEN.WIDTH / 2 - 22, '⚡', { fontSize: '22px' })
      .setOrigin(0.5);

    this.boostIcon.setVisible(false);
    this.boostTween = null;

    //---------------- Helicopter indicator (see setHelicopterCharged() / activateHelicopter()) ----------------

    this.helicopterIcon = this.scene.add
      .text(-22, -PEN.WIDTH / 2 - 22, '🚁', { fontSize: '22px' })
      .setOrigin(0.5);

    this.helicopterIcon.setVisible(false);

    //---------------- Shield indicator (see activateShield()) ----------------
    // Below the pen rather than above (where boost/helicopter live) so
    // a pen that's charged with one of those *and* shielded doesn't
    // show two overlapping icons.

    this.shieldIcon = this.scene.add
      .text(0, PEN.WIDTH / 2 + 22, '🛡️', { fontSize: '20px' })
      .setOrigin(0.5);

    this.shieldIcon.setVisible(false);

    //---------------- Sticker (cosmetic, see PlayerProfile.js) ----------------
    // Printed on the barrel itself, so it rotates/moves with the pen
    // like it's actually stuck on there — unlike the power-up icons
    // above, which stay screen-upright relative to the pen's own frame
    // regardless of what's drawn on the barrel underneath them.

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
  // Change cosmetic style after creation (not currently used locally —
  // GameScene picks the style once at pen-creation time — but kept
  // symmetrical with NetPen.setStyle() in case a future screen wants
  // to preview a change live).
  //--------------------------------------------------

  setStyle(color, sticker = '', holo = false) {
    this.color = color;
    this.sticker = sticker || '';

    this.drawPen();
    this.trail.setColor(color);

    this.stickerText.setText(this.sticker);
    this.stickerText.setVisible(!!this.sticker);

    this.setTextured(holo);
  }

  //--------------------------------------------------
  // Holographic texture (see PenLibrary.js's TEXTURES) — a real WebGL
  // shader (Phaser's built-in Shine Pre FX pipeline) with a Canvas-safe
  // fallback sweep for whenever WebGL/Shine isn't available. See
  // fx/Holographic.js's own file comment for the full explanation of
  // why Pre FX (not the Post FX pipeline this used to be) is what
  // keeps the shimmer correctly scoped to the pen's own barrel.
  //--------------------------------------------------

  setTextured(active) {
    this.holo = !!active;

    this._applyHoloEffect();
  }

  _applyHoloEffect() {
    // Tear down whichever path (if any) is currently running before
    // deciding what this call needs — makes repeated calls (e.g.
    // setStyle() called again with holo already on) idempotent instead
    // of stacking a second overlay/sweep on top of an existing one.
    if (this._holoShine) {
      this._holoShine.destroy();
      this._holoShine = null;
    }

    this._setHoloFallback(false);

    if (!this.holo) return;

    if (isWebGLRenderer(this.scene)) {
      this._holoShine = createHoloShineOverlay(this.scene, this.container);

      // createHoloShineOverlay() returns null if Shine couldn't be
      // attached for any reason (an unusual WebGL/driver combination,
      // say) — degrade to the Canvas sweep rather than silently
      // showing no texture at all.
      if (!this._holoShine) this._setHoloFallback(true);

      return;
    }

    this._setHoloFallback(true);
  }

  // The Canvas-renderer fallback — a small Graphics+Tween sweep, local
  // to the pen's own container, drawn entirely in the pen's own local
  // coordinates (-PEN.LENGTH/2..+PEN.LENGTH/2 etc.), so it moves/
  // rotates with the pen for free and can never render outside its
  // footprint. Also used as the WebGL-side fallback if Shine itself
  // ever fails to attach (see _applyHoloEffect() above).
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

  //--------------------------------------------------
  // Boost indicator — active from the moment a Speed Boost pickup is
  // collected (PowerUps.js) until the boosted shot is actually taken
  // (InputController.js), so the player always has a clear answer to
  // "do I currently have a boost queued up?"
  //--------------------------------------------------

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
  // Helicopter Shot indicator (charged) — mirrors setBoosted() above,
  // but for the Helicopter Shot pickup (see PowerUps.js): the pen's
  // next shot will spin hard and briefly hit much harder once taken
  // (see activateHelicopter() below).
  //--------------------------------------------------

  setHelicopterCharged(active) {
    this.helicopterIcon.setVisible(active);

    if (active) {
      if (this.heliChargeTween) return;

      this.heliChargeTween = this.scene.tweens.add({
        targets: this.helicopterIcon,
        scale: { from: 0.85, to: 1.2 },
        duration: 320,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    } else if (this.heliChargeTween) {
      this.heliChargeTween.stop();
      this.heliChargeTween = null;
      this.helicopterIcon.setScale(1);
    }
  }

  //--------------------------------------------------
  // Helicopter Shot — fired immediately after a charged shot is taken
  // (see InputController.fire() / AIController._takeShot()). Sends the
  // pen into a hard spin and temporarily raises its bounce, so
  // whatever it clips during that window gets knocked away much
  // harder — the visible spin is what makes that readable in the
  // moment, not just a stat change nobody can see.
  //--------------------------------------------------

  activateHelicopter() {
    this.setHelicopterCharged(false);

    this.helicopterActive = true;

    const currentSpin = this.body.getAngularVelocity();
    const spin = POWERUPS.HELICOPTER_SPIN_VELOCITY * (currentSpin < 0 ? -1 : 1);

    this.body.setAngularVelocity(currentSpin + spin);

    for (let f = this.body.getFixtureList(); f; f = f.getNext()) {
      f.setRestitution(POWERUPS.HELICOPTER_RESTITUTION);
    }

    this.helicopterIcon.setVisible(true);
    this.helicopterIcon.setAngle(0);

    if (this.helicopterSpinTween) this.helicopterSpinTween.stop();

    this.helicopterSpinTween = this.scene.tweens.add({
      targets: this.helicopterIcon,
      angle: 360,
      duration: 260,
      repeat: -1,
      ease: 'Linear',
    });

    if (this.helicopterTimer) this.helicopterTimer.remove();

    this.helicopterTimer = this.scene.time.delayedCall(
      POWERUPS.HELICOPTER_DURATION,
      () => this.deactivateHelicopter(),
    );
  }

  deactivateHelicopter() {
    this.helicopterActive = false;

    if (!this.destroying) {
      for (let f = this.body.getFixtureList(); f; f = f.getNext()) {
        f.setRestitution(PEN.RESTITUTION);
      }
    }

    this.helicopterIcon.setVisible(false);
    this.helicopterIcon.setAngle(0);

    if (this.helicopterSpinTween) {
      this.helicopterSpinTween.stop();
      this.helicopterSpinTween = null;
    }

    this.helicopterTimer = null;
  }

  //--------------------------------------------------
  // Shield — active immediately on pickup (unlike the "charged for the
  // next shot" pickups above), saves this pen the next time it would
  // be eliminated within its window (see GameRules.checkOutOfBounds()),
  // then it's consumed. Expires on its own if never used.
  //--------------------------------------------------

  activateShield() {
    this.hasShield = true;

    this.shieldIcon.setVisible(true);

    if (!this.shieldTween) {
      this.shieldTween = this.scene.tweens.add({
        targets: this.shieldIcon,
        scale: { from: 0.85, to: 1.15 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    if (this.shieldTimer) this.shieldTimer.remove();

    this.shieldTimer = this.scene.time.delayedCall(POWERUPS.SHIELD_DURATION, () => this.clearShield());
  }

  clearShield() {
    this.hasShield = false;

    this.shieldIcon.setVisible(false);

    if (this.shieldTween) {
      this.shieldTween.stop();
      this.shieldTween = null;
      this.shieldIcon.setScale(1);
    }

    this.shieldTimer = null;
  }

  // Called by GameRules the moment this pen would otherwise be
  // eliminated — pulls it back to a valid spot on the table instead.
  consumeShieldSave(table) {
    this.clearShield();
    this.pullBackOntoTable(table);
  }

  pullBackOntoTable(table) {
    const margin = Math.max(PEN.LENGTH / 2, PEN.WIDTH / 2) + 12;

    const clampedX = Phaser.Math.Clamp(this.container.x, table.X + margin, table.X + table.WIDTH - margin);
    const clampedY = Phaser.Math.Clamp(this.container.y, table.Y + margin, table.Y + table.HEIGHT - margin);

    this.body.setTransform(PhysicsUtils.worldVec(clampedX, clampedY), this.body.getAngle());
    this.body.setLinearVelocity(planck.Vec2(0, 0));
    this.body.setAngularVelocity(0);

    this.update();
  }

  //--------------------------------------------------
  // Draw Pen
  //--------------------------------------------------

  drawPen() {
    const g = this.pen;

    g.clear();

    const halfL = PEN.LENGTH / 2;
    const halfW = PEN.WIDTH / 2;
    const r = PEN.END_RADIUS;

    // Barrel — base fill first, then a few translucent light/dark
    // bands layered on top (same "poor man's gradient" idiom
    // TableView.js uses for its wood-grain/vignette shading) so the
    // barrel reads as a lit cylinder instead of a flat rounded
    // rectangle. Left as its own base fill (rather than folding the
    // shading into one pass) so setStyle()'s texture/holo pipeline
    // still has a single well-defined "real" barrel color underneath
    // it all — see setTextured() below.

    g.fillStyle(this.color);
    g.fillRoundedRect(-halfL, -halfW, PEN.LENGTH, PEN.WIDTH, r);

    // Top sheen — brightest right at the top edge, fading out by
    // mid-barrel, like light grazing the top of a rounded pen.
    g.fillStyle(shadeColor(this.color, 0.55), 0.35);
    g.fillRoundedRect(-halfL + 4, -halfW, PEN.LENGTH - 8, halfW * 0.55, {
      tl: r * 0.6,
      tr: r * 0.6,
      bl: 0,
      br: 0,
    });

    // Bottom shade — darkest right at the bottom edge, leaving a thin
    // strip of the true base color visible between the two bands
    // (the "core" tone of the cylinder, where neither light nor
    // shadow dominates).
    g.fillStyle(shadeColor(this.color, -0.45), 0.3);
    g.fillRoundedRect(-halfL + 4, halfW * 0.15, PEN.LENGTH - 8, halfW * 0.85, {
      tl: 0,
      tr: 0,
      bl: r * 0.6,
      br: r * 0.6,
    });

    // A crisp thin glint near the top edge — the sharp highlight a
    // rounded plastic/metal barrel catches, distinct from the softer
    // sheen band above.
    g.fillStyle(0xffffff, 0.55);
    g.fillRoundedRect(-halfL + 14, -halfW + 3, PEN.LENGTH - 28, 2.5, 1.5);

    // Edge outline — a subtle darker stroke so the barrel reads as a
    // distinct solid object against the table/other pens, not just a
    // flat color patch.
    g.lineStyle(1.5, shadeColor(this.color, -0.5), 0.55);
    g.strokeRoundedRect(-halfL, -halfW, PEN.LENGTH, PEN.WIDTH, r);

    // Rear Cap — same light-top/dark-bottom treatment as the barrel,
    // scaled down.
    g.fillStyle(0x222222);
    g.fillRect(-halfL, -halfW, 10, PEN.WIDTH);

    g.fillStyle(0x555555, 0.5);
    g.fillRect(-halfL, -halfW, 10, halfW * 0.5);

    // Metallic Tip — a bright top half over the base gray gives it a
    // faceted, cone-like read instead of a flat gray wedge.
    g.fillStyle(0xd0d0d0);
    g.fillTriangle(halfL, -halfW, halfL, halfW, halfL + 14, 0);

    g.fillStyle(0xffffff, 0.5);
    g.fillTriangle(halfL, -halfW, halfL, 0, halfL + 14, 0);
  }

  //--------------------------------------------------
  // Shadow — day mode keeps the original crisp, tight shadow; night
  // mode (see fx/DayNight.js + GameScene.js/NetGameScene.js's day/
  // night toggle handlers, the only callers) swaps it for several
  // nested, growing, fading rounded rects underneath the pen instead —
  // the same "poor man's gradient" idiom as drawPen()'s new shading
  // bands and TableView.js's vignette — so it reads as a soft blurred
  // shadow cast by the desk lamps (see DayNight.js's LAMP_LIGHTS)
  // rather than a hard-edged cutout.
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
    // A soft shadow drifts further from directly-under the object than
    // a sharp one does — larger offset than the day version, not just
    // blurrier.
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
  // Update
  //--------------------------------------------------

  update() {
    // Eliminated — this.body/this.container/this.trail's emitter are
    // either about to be destroyed (fadeOutAndDestroy's tween is what
    // drives the visible fade-out, not this method) or already are.
    // PenManager still calls update() on this pen every frame for the
    // rest of the match (see the this.destroying comment above), so
    // this guard is what actually stops that from touching torn-down
    // Planck/Phaser objects.
    if (this.destroying) return;

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

    if (v.lengthSquared() > TRAIL_SPEED_SQ_THRESHOLD) {
      this.trail.emitAt(this.container.x, this.container.y);
    }
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

  //--------------------------------------------------
  // Capsule <-> circle overlap — used by PowerUps.js so a pickup counts
  // as "collected" the moment the pen's actual drawn body (a 145x16
  // capsule, not just its center point) touches the pickup's circle,
  // rather than only when the pen's *center* happens to land inside a
  // small pickup radius. Without this, a shot that visibly sweeps clean
  // across a pickup can still miss it — the pen is 145px long, so its
  // center point is very often well outside a 26px pickup radius even
  // while the rest of the pen is plainly overlapping it on screen.
  //--------------------------------------------------

  capsuleDistanceToPoint(x, y) {
    const local = this.getLocalPoint(x, y);

    const halfBody = PhysicsUtils.toWorld(PEN.LENGTH / 2 - PEN.END_RADIUS);

    const clampedX = Phaser.Math.Clamp(local.x, -halfBody, halfBody);

    const dx = local.x - clampedX;
    const dy = local.y;

    return PhysicsUtils.toPixels(Math.sqrt(dx * dx + dy * dy));
  }

  overlapsCircle(x, y, radius) {
    return this.capsuleDistanceToPoint(x, y) <= radius + PEN.END_RADIUS;
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
    // Also set directly here (not just by fadeOutAndDestroy) so a
    // direct destroy() call — e.g. PenManager.destroy() at scene
    // teardown — is just as safe against a stray update() landing
    // afterward.
    this.destroying = true;

    if (this.boostTween) this.boostTween.stop();
    if (this.heliChargeTween) this.heliChargeTween.stop();
    if (this.helicopterSpinTween) this.helicopterSpinTween.stop();
    if (this.helicopterTimer) this.helicopterTimer.remove();
    if (this.shieldTween) this.shieldTween.stop();
    if (this.shieldTimer) this.shieldTimer.remove();
    if (this._holoShine) {
      this._holoShine.destroy();
      this._holoShine = null;
    }
    this._setHoloFallback(false);

    this.physics.world.destroyBody(this.body);

    this.container.destroy(true);

    this.trail.destroy();
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
