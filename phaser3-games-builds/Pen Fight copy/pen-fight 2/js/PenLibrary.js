//==================================================
// PenLibrary.js
//==================================================
// The catalog of pens (base colors) and stickers a player can pick to
// personalize their own pen, plus the expertise-level ladder that
// gates the "premium" ones. Pure data + a few small lookup helpers —
// no rendering, no storage (see PlayerProfile.js for the localStorage
// side of this).
//
// Progression is wins-based (see PlayerProfile.recordWin()): every
// match playerId 0 (the device's own player) wins counts, across
// Classroom, Vs Computer, and Online alike. "Premium" here just means
// "unlocks at a higher win count" — there's no currency or purchase
// flow, everything is earned by playing.
//==================================================

export const PENS = [
  { id: 'classic-blue', name: 'Classic Blue', color: 0x1e88e5, unlockWins: 0 },
  { id: 'classic-green', name: 'Classic Green', color: 0x43a047, unlockWins: 0 },
  { id: 'classic-red', name: 'Classic Red', color: 0xe53935, unlockWins: 0 },
  { id: 'classic-violet', name: 'Classic Violet', color: 0x8e24aa, unlockWins: 0 },
  { id: 'sunset-orange', name: 'Sunset Orange', color: 0xff7043, unlockWins: 3 },
  { id: 'bubblegum-pink', name: 'Bubblegum Pink', color: 0xec407a, unlockWins: 6 },
  { id: 'gold-rush', name: 'Gold Rush', color: 0xffb300, unlockWins: 10, premium: true },
  { id: 'midnight-black', name: 'Midnight Black', color: 0x2b2b2b, unlockWins: 15, premium: true },
  { id: 'neon-lime', name: 'Neon Lime', color: 0xc6ff00, unlockWins: 22, premium: true },
  { id: 'royal-teal', name: 'Royal Teal', color: 0x00897b, unlockWins: 30, premium: true },
  { id: 'chrome-silver', name: 'Chrome Silver', color: 0xb0bec5, unlockWins: 40, premium: true },
  { id: 'ruby-shine', name: 'Ruby Shine', color: 0xad1457, unlockWins: 55, premium: true },
];

// sticker '' (id 'none') means no sticker drawn at all — always free,
// since that's just "the pen as-is".
export const STICKERS = [
  { id: 'none', name: 'None', emoji: '', unlockWins: 0 },
  { id: 'star', name: 'Star', emoji: '⭐', unlockWins: 0 },
  { id: 'flame', name: 'Flame', emoji: '🔥', unlockWins: 4 },
  { id: 'heart', name: 'Heart', emoji: '❤️', unlockWins: 7 },
  { id: 'lightning', name: 'Lightning', emoji: '⚡', unlockWins: 12, premium: true },
  { id: 'skull', name: 'Skull', emoji: '💀', unlockWins: 18, premium: true },
  { id: 'crown', name: 'Crown', emoji: '👑', unlockWins: 26, premium: true },
  { id: 'rainbow', name: 'Rainbow', emoji: '🌈', unlockWins: 35, premium: true },
];

// Pen surface textures — a step up from a flat sticker: an animated
// shimmer sweep over the barrel (see Pen.js/NetPen.js's
// setTextured()). Kept as its own small catalog (not folded into PENS) since it's an
// orthogonal choice — any base color can have any texture.
export const TEXTURES = [
  { id: 'none', name: 'Plain', unlockWins: 0 },
  { id: 'holographic', name: 'Holographic', unlockWins: 45, premium: true },
];

export function findTexture(id) {
  return TEXTURES.find((t) => t.id === id) || TEXTURES[0];
}

// Expertise ladder — purely a label + gate threshold, reused for both
// "what level am I" display and PENS/STICKERS' unlockWins comparisons.
export const LEVELS = [
  { level: 1, name: 'Rookie', winsRequired: 0 },
  { level: 2, name: 'Apprentice', winsRequired: 3 },
  { level: 3, name: 'Skilled', winsRequired: 8 },
  { level: 4, name: 'Veteran', winsRequired: 15 },
  { level: 5, name: 'Expert', winsRequired: 25 },
  { level: 6, name: 'Master', winsRequired: 40 },
  { level: 7, name: 'Legend', winsRequired: 55 },
];

export function levelForWins(wins) {
  let current = LEVELS[0];

  for (const l of LEVELS) {
    if (wins >= l.winsRequired) current = l;
  }

  return current;
}

export function nextLevel(wins) {
  return LEVELS.find((l) => l.winsRequired > wins) || null;
}

export function isUnlocked(item, wins) {
  return wins >= (item.unlockWins || 0);
}

export function findPen(id) {
  return PENS.find((p) => p.id === id) || PENS[0];
}

export function findSticker(id) {
  return STICKERS.find((s) => s.id === id) || STICKERS[0];
}
