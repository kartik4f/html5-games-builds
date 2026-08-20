//==================================================
// PlayerProfile.js
//==================================================
// Per-browser player progression + pen customization, kept in
// localStorage — same pattern as js/net/WinStreak.js. No accounts, no
// server-side identity: this is "whoever is using this browser",
// exactly like the win-streak counter already is.
//
// wins increments once per match where playerId 0 (this device's own
// seat) wins — Classroom, Vs Computer, and Online alike (see
// GameScene.js / NetGameScene.js's game-over handling). That count is
// what gates "premium" pens/stickers in PenLibrary.js — there's no
// currency or purchase flow, everything unlocks by playing.
//==================================================

import { PENS, STICKERS, TEXTURES, findPen, findSticker, findTexture, levelForWins, isUnlocked } from './PenLibrary.js';

const STORAGE_KEY = 'penfight_profile_v1';

function defaults() {
  return {
    wins: 0,
    penId: PENS[0].id,
    stickerId: STICKERS[0].id,
    textureId: TEXTURES[0].id,
    // A player's own typed/pasted emoji (see the Pen Locker's "Or type
    // your own" field) — free-form, not gated by wins like the preset
    // gallery (see setCustomSticker() below). Only actually used when
    // stickerId === 'custom' — kept separately rather than overloading
    // one of the preset ids so switching back to a preset never loses
    // whatever the player last typed.
    customStickerEmoji: '',
  };
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return defaults();

    const parsed = JSON.parse(raw);

    return { ...defaults(), ...parsed };
  } catch {
    // localStorage unavailable (private browsing, etc.) — just don't persist.
    return defaults();
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore — nothing useful to do if storage isn't available.
  }
}

export function getProfile() {
  const state = load();

  return { ...state, level: levelForWins(state.wins) };
}

// Call once per finished match where this device's own seat
// (playerId 0) won. Returns { profile, leveledUp } so callers can show
// a "LEVEL UP!" moment the instant it actually happens, not just a
// silently-updated number.
export function recordWin() {
  const state = load();

  const beforeLevel = levelForWins(state.wins).level;

  state.wins += 1;

  const afterLevel = levelForWins(state.wins).level;

  save(state);

  return { profile: getProfile(), leveledUp: afterLevel > beforeLevel };
}

export function setSelectedPen(penId) {
  const state = load();
  const pen = findPen(penId);

  if (!isUnlocked(pen, state.wins)) return getProfile(); // ignore — still locked

  state.penId = pen.id;
  save(state);

  return getProfile();
}

export function setSelectedSticker(stickerId) {
  const state = load();
  const sticker = findSticker(stickerId);

  if (!isUnlocked(sticker, state.wins)) return getProfile(); // ignore — still locked

  state.stickerId = sticker.id;
  save(state);

  return getProfile();
}

export function setSelectedTexture(textureId) {
  const state = load();
  const texture = findTexture(textureId);

  if (!isUnlocked(texture, state.wins)) return getProfile(); // ignore — still locked

  state.textureId = texture.id;
  save(state);

  return getProfile();
}

// Free-form — no win-gating, since this isn't unlockable content, just
// the player typing/pasting whatever emoji they already have on their
// keyboard. Trimmed and capped defensively (matches the server's own
// cap in GameRoom.mjs's sanitizeStyle() — real emoji are far shorter
// than this, the cap is only ever hit by garbage input).
export function setCustomSticker(emoji) {
  const state = load();
  const trimmed = String(emoji || '').trim().slice(0, 8);

  if (!trimmed) return getProfile(); // ignore empty — nothing to select

  state.customStickerEmoji = trimmed;
  state.stickerId = 'custom';
  save(state);

  return getProfile();
}

// What GameScene/NetGameScene/MenuScene actually need to render/send —
// the resolved color + sticker emoji for whatever's currently selected
// (falling back to the always-unlocked defaults if a saved id somehow
// isn't unlocked anymore, though that shouldn't normally happen since
// wins only ever go up).
export function getSelectedStyle() {
  const state = load();

  const pen = findPen(state.penId);
  const penOk = isUnlocked(pen, state.wins) ? pen : PENS[0];

  const texture = findTexture(state.textureId);
  const textureOk = isUnlocked(texture, state.wins) ? texture : TEXTURES[0];
  const holo = textureOk.id === 'holographic';

  // 'custom' isn't in the STICKERS catalog — it's the player's own
  // typed/pasted emoji (see setCustomSticker() above), always allowed
  // regardless of wins.
  if (state.stickerId === 'custom' && state.customStickerEmoji) {
    return {
      color: penOk.color,
      sticker: state.customStickerEmoji,
      penId: penOk.id,
      stickerId: 'custom',
      textureId: textureOk.id,
      holo,
    };
  }

  const sticker = findSticker(state.stickerId);
  const stickerOk = isUnlocked(sticker, state.wins) ? sticker : STICKERS[0];

  return {
    color: penOk.color,
    sticker: stickerOk.emoji,
    penId: penOk.id,
    stickerId: stickerOk.id,
    textureId: textureOk.id,
    holo,
  };
}
