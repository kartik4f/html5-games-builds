//==================================================
// JuiceFX.js
//==================================================
// Visual "juice" helpers shared by single-player (GameScene) and
// multiplayer (NetGameScene): collision/elimination particle bursts,
// speed trails behind fast-moving pens, and floating call-out text
// (e.g. a power-up pickup). Everything here is generated at runtime (a
// single tiny circle texture, plain Phaser Text) — no image assets, no
// npm packages.
//==================================================

const DOT_TEXTURE = 'fx-dot';

function ensureDotTexture(scene) {
  if (scene.textures.exists(DOT_TEXTURE)) return;

  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0xffffff, 1);
  g.fillCircle(6, 6, 6);
  g.generateTexture(DOT_TEXTURE, 12, 12);
  g.destroy();
}

//--------------------------------------------------
// One-shot particle burst (collision spark / elimination puff)
//--------------------------------------------------

export function burst(scene, x, y, color, options = {}) {
  ensureDotTexture(scene);

  const {
    count = 14,
    speed = 220,
    life = 420,
    scale = 0.9,
    gravityY = 0,
  } = options;

  const emitter = scene.add.particles(x, y, DOT_TEXTURE, {
    speed: { min: speed * 0.3, max: speed },
    angle: { min: 0, max: 360 },
    scale: { start: scale, end: 0 },
    alpha: { start: 1, end: 0 },
    lifespan: life,
    tint: color,
    blendMode: 'ADD',
    gravityY,
    emitting: false,
  });

  emitter.explode(count, x, y);

  scene.time.delayedCall(life + 60, () => emitter.destroy());
}

// Elimination puff — a slightly larger, slower, dustier burst using
// each pen's own color plus a neutral "poof" tone.
export function eliminationPuff(scene, x, y, color) {
  burst(scene, x, y, color, { count: 10, speed: 140, life: 500, scale: 1.1 });
  burst(scene, x, y, 0xffffff, { count: 8, speed: 90, life: 400, scale: 0.7 });
}

//--------------------------------------------------
// Floating call-out text — rises and fades, then destroys itself. Used
// for power-up pickups so what just happened ("SPEED BOOST!") reads
// clearly at the moment it happens, on top of the sound/particle
// burst — not just from the pen's own after-the-fact charged glow
// (see Pen.setBoosted() / NetPen.setBoosted()).
//--------------------------------------------------

export function floatingText(scene, x, y, text, color = '#3b2a20') {
  const t = scene.add
    .text(x, y, text, {
      fontFamily: 'Architects Daughter, cursive',
      fontSize: '22px',
      color,
      stroke: '#fffdf6',
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(2000);

  scene.tweens.add({
    targets: t,
    y: y - 54,
    alpha: 0,
    duration: 950,
    ease: 'Cubic.Out',
    onComplete: () => t.destroy(),
  });
}

//--------------------------------------------------
// Speed trail — a small manual-emit particle emitter a pen can feed
// its position every frame while moving fast. One emitter per pen,
// created once and reused for the pen's lifetime.
//--------------------------------------------------

export class Trail {
  constructor(scene, color) {
    ensureDotTexture(scene);

    this.emitter = scene.add.particles(0, 0, DOT_TEXTURE, {
      lifespan: 260,
      speed: 0,
      scale: { start: 0.45, end: 0 },
      alpha: { start: 0.4, end: 0 },
      tint: color,
      emitting: false,
    });

    this.emitter.setDepth(-1);
  }

  emitAt(x, y) {
    // .explode() instead of .emitParticleAt() — same one-shot manual
    // emission burst() already uses successfully elsewhere in this
    // file; emitParticleAt() throws ("Cannot read properties of null
    // (reading 'length')" deep in Phaser's particle init) when called
    // on a freshly-created manual emitter before it's been through a
    // scene update tick, which a fast-moving pen's very first trail
    // dot can easily hit.
    this.emitter.explode(1, x, y);
  }

  destroy() {
    this.emitter.destroy();
  }
}

// Squared-speed threshold helpers so callers don't need to know each
// mode's velocity units — pass a 0..1 "how fast is this, relative to
// a full-power shot" ratio instead.
export const TRAIL_SPEED_RATIO_THRESHOLD = 0.35;
