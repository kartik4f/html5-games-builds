//==================================================
// Layout.js
//==================================================
// Evenly spaces N (2-4) pens around an ellipse inscribed in the
// table, all facing angle 0, guaranteed non-overlapping. This is the
// client-side twin of server/PhysicsEngine.mjs's defaultLayout() —
// same math, kept here so local games (Classroom, Vs Computer) can
// start any player count without hand-placed per-N position lists.
//==================================================

export function defaultLayout(n, table) {
  const cx = table.X + table.WIDTH / 2;
  const cy = table.Y + table.HEIGHT / 2;

  const rx = table.WIDTH * 0.28;
  const ry = table.HEIGHT * 0.28;

  const positions = [];

  for (let i = 0; i < n; i++) {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;

    positions.push({
      x: cx + Math.cos(angle) * rx,
      y: cy + Math.sin(angle) * ry,
    });
  }

  return positions;
}
