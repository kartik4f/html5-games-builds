//==================================================
// Holographic.js
//==================================================
// The holographic shimmer texture (see PenLibrary.js's TEXTURES,
// unlocked at 45 wins, selectable from the Texture section of the Pen
// Locker — menu.html/MenuScene.js's textureGridEl). Shared by
// Pen.js/NetPen.js's setTextured(), the only callers.
//
// Real WebGL shader path: Phaser's own built-in Shine Pre FX pipeline
// (Phaser.FX.Shine — see
// https://docs.phaser.io/api-documentation/class/fx-shine), attached
// to one small overlay Image shaped like the pen's own barrel
// silhouette. Pre FX pipelines render their Game Object into its own
// small render texture *first*, and only composite the shaded result
// into the scene afterward — unlike a custom Post FX pipeline (which
// composites through a full-camera-sized render target well after
// every object's own transform has already been flattened into scene
// space, so a shader's UV space ends up spanning the whole canvas
// rather than the one object it's nominally attached to — that's
// exactly what made an earlier hand-rolled Post FX version of this
// effect render "way too big"). Being Pre FX, the Shine shader's UV
// space is inherently bounded to this one small overlay image, on any
// renderer resolution or pen rotation, with no manual scoping math
// needed.
//
// Canvas-safe fallback: Pre FX (like all of Phaser's FX pipelines) is
// WebGL-only — see isWebGLRenderer() below, and Pen.js/NetPen.js's
// own _setHoloFallback(), a plain Graphics+Tween sweep local to the
// pen's own container, used instead whenever WebGL (or Shine
// specifically) isn't available.
//==================================================

import { PEN } from '../Constants.js';

const HOLO_SHAPE_TEXTURE = 'fx-holo-shape';

export function isWebGLRenderer(scene) {
  return scene?.sys?.game?.renderer?.type === Phaser.WEBGL;
}

// A small shared texture — just the pen's own barrel silhouette (the
// same capsule shape drawPen() fills first, before any of its shading
// bands) — generated once and reused by every pen's overlay Image, so
// the Shine effect only ever lights up pixels actually inside that
// silhouette, not the overlay's full rectangular bounds.
function ensureShapeTexture(scene) {
  if (scene.textures.exists(HOLO_SHAPE_TEXTURE)) return;

  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(0, 0, PEN.LENGTH, PEN.WIDTH, PEN.END_RADIUS);
  g.generateTexture(HOLO_SHAPE_TEXTURE, PEN.LENGTH, PEN.WIDTH);
  g.destroy();
}

// container — the pen's own Container (see Pen.js's createGraphics());
// the overlay is added as a plain child of it, at local (0,0) with the
// Image default origin (0.5, 0.5) — since that's exactly the barrel's
// own centerline in the same local coordinate space drawPen() draws
// into, no extra offset math is needed for it to sit exactly over the
// barrel and inherit the container's own position/rotation for free.
//
// Returns null (rather than throwing) if Shine couldn't be attached
// for any reason (an unusual WebGL/driver combination, etc.) — the
// caller falls back to the Canvas sweep in that case, same "degrade,
// don't crash" stance as fx/DayNight.js's own Light2D/overlay split.
export function createHoloShineOverlay(scene, container) {
  try {
    ensureShapeTexture(scene);

    const img = scene.add.image(0, 0, HOLO_SHAPE_TEXTURE);

    if (!img.preFX) {
      img.destroy();

      return null;
    }

    img.setBlendMode(Phaser.BlendModes.ADD);
    img.setAlpha(0.4);

    // speed / lineWidth / gradient — a fairly slow, soft-edged single
    // band, so it reads as a gentle traveling shimmer rather than a
    // strobing scanline.
    img.preFX.addShine(0.4, 0.35, 3);

    container.add(img);

    return {
      gameObject: img,
      destroy: () => img.destroy(),
    };
  } catch (err) {
    return null;
  }
}
