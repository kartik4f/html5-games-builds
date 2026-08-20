//==================================================
// ColorUtils.js
//==================================================
// A small color-blending helper used to fake a pseudo-3D "lit
// cylinder" look on the pens (see Pen.js/NetPen.js's drawPen()) —
// layered translucent light/dark bands over the flat base color,
// the same "poor man's gradient" idiom TableView.js already uses for
// the table's wood-grain/vignette shading, rather than a real WebGL
// gradient (Graphics fill gradients don't reliably clip to a rounded-
// rect shape across renderers).
//
// Pure math, no Phaser dependency — trivially unit-testable in Node
// without stubbing a renderer.
//==================================================

// amount > 0 blends the color toward white (lighten); amount < 0
// blends toward black (darken); 0 returns it unchanged. Clamped to
// -1..1 either way.
export function shadeColor(hex, amount) {
  const clamped = Math.max(-1, Math.min(1, amount));

  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;

  const target = clamped > 0 ? 255 : 0;
  const t = Math.abs(clamped);

  const blend = (c) => Math.max(0, Math.min(255, Math.round(c + (target - c) * t)));

  return (blend(r) << 16) | (blend(g) << 8) | blend(b);
}
