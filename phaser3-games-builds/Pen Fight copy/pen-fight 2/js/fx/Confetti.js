//==================================================
// Confetti.js
//==================================================
// A full-screen confetti blast — the celebration a spectator's Cheer
// panel (see ui/CheerButton.js) triggers for everyone in the room (see
// NetGameScene.js's onServerMessage() 'cheer' case, the only caller).
// Built the same way as JuiceFX.js's burst()/Trail — a tiny
// runtime-generated texture fed into one-shot Phaser particle emitters
// — but rectangular, multi-colored "paper" pieces raining down from
// the top of the screen instead of exploding outward from a single
// point. Paired with cheerEmojiPop() below, which shows which preset
// emoji was actually picked.
//==================================================

import { GAME, TABLE } from '../Constants.js';

const CONFETTI_TEXTURE = 'fx-confetti';

const COLORS = [0xff6b6b, 0xffd93d, 0x6bcbef, 0xa78bfa, 0x4ade80, 0xff9f43];

function ensureConfettiTexture(scene) {
  if (scene.textures.exists(CONFETTI_TEXTURE)) return;

  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 10, 6);
  g.generateTexture(CONFETTI_TEXTURE, 10, 6);
  g.destroy();
}

// One emitter per color (tint is baked in at creation, same
// constraint JuiceFX.js's Trail.setColor() works around) — each fires
// its own one-shot burst of pieces spread across the top of the
// screen, falling with gravity and a little sideways drift/spin so it
// reads as actual confetti rather than a straight-down rain.
export function confettiBlast(scene, options = {}) {
  ensureConfettiTexture(scene);

  const { count = 90, life = 1800 } = options;

  const perColor = Math.max(1, Math.round(count / COLORS.length));

  const emitters = COLORS.map((color) => {
    const emitter = scene.add.particles(0, -20, CONFETTI_TEXTURE, {
      x: { min: 0, max: GAME.WIDTH },
      y: -20,
      speedY: { min: 160, max: 340 },
      speedX: { min: -80, max: 80 },
      rotate: { min: 0, max: 360 },
      scale: { start: 1, end: 0.7 },
      alpha: { start: 1, end: 0 },
      lifespan: life,
      tint: color,
      gravityY: 260,
      emitting: false,
    });

    emitter.setDepth(3000); // above every other HUD/game element

    emitter.explode(perColor);

    return emitter;
  });

  scene.time.delayedCall(life + 100, () => {
    for (const emitter of emitters) emitter.destroy();
  });
}

//--------------------------------------------------
// A big floating copy of whichever preset emoji a spectator picked
// (see ui/CheerButton.js) — rises and fades from the middle of the
// table so "which emoji was this cheer" reads clearly at a glance,
// even with confettiBlast()'s confetti also going off at the same
// time. Deliberately a plain Phaser Text rather than folded into
// confettiBlast()'s particle emitters, since those bake a tint into a
// small generated rectangle texture — emoji glyphs need their own
// real glyph rendering, not a tinted rectangle.
//--------------------------------------------------

export function cheerEmojiPop(scene, emoji) {
  const x = GAME.WIDTH / 2;
  const y = TABLE.Y + TABLE.HEIGHT / 2;

  const t = scene.add
    .text(x, y, emoji, { fontSize: '96px' })
    .setOrigin(0.5)
    .setDepth(3000)
    .setScale(0.4)
    .setAlpha(0);

  scene.tweens.add({
    targets: t,
    scale: 1,
    alpha: 1,
    duration: 220,
    ease: 'Back.Out',
    onComplete: () => {
      scene.tweens.add({
        targets: t,
        y: y - 120,
        alpha: 0,
        duration: 900,
        delay: 250,
        ease: 'Cubic.Out',
        onComplete: () => t.destroy(),
      });
    },
  });
}
