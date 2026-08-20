//==================================================
// WinStreak.js
//==================================================
// A tiny per-browser win-streak counter for online multiplayer, kept
// in localStorage. Purely a local bragging-rights stat — the server
// has no notion of it and doesn't need one, since it's scoped to
// "this browser", not "this player" in any authoritative sense.
//==================================================

const STORAGE_KEY = 'penfight_winstreak_v1';

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) return { streak: 0, best: 0 };

    const parsed = JSON.parse(raw);

    return { streak: parsed.streak || 0, best: parsed.best || 0 };
  } catch {
    // localStorage unavailable (private browsing, etc.) — just don't persist.
    return { streak: 0, best: 0 };
  }
}

function save(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore — nothing useful to do if storage isn't available.
  }
}

export function getWinStreak() {
  return load();
}

// Call once per finished match. outcome is 'win' | 'loss' | 'draw' |
// null (null = spectator, don't touch the streak).
export function recordMatchOutcome(outcome) {
  const state = load();

  if (outcome === 'win') {
    state.streak += 1;
    state.best = Math.max(state.best, state.streak);
  } else if (outcome === 'loss') {
    state.streak = 0;
  }
  // 'draw' — streak carries over unchanged.

  save(state);

  return state;
}
