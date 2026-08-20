//==================================================
// AdaptiveAI.js
//==================================================
// Session-only (module state — persists across GameScene restarts
// within the same page load, resets on a full reload, same lifecycle
// as GameRules.js's turn-rotation counter or WinStreak.js's in-memory
// half). Vs Computer only.
//
// A fixed Easy/Medium/Hard difficulty repeats forever — a player who
// keeps winning stays bored, one who keeps losing stays frustrated.
// This tracks the last few match outcomes against the AI and returns a
// small multiplier AIController.js applies on top of whichever tier
// the player picked, so the *chosen* difficulty still sets the overall
// feel, but a real streak nudges it — never inverts it.
//==================================================

const MAX_HISTORY = 5;

let history = []; // true = human won that match, false = human lost/drew

export function recordOutcome(humanWon) {
  history.push(!!humanWon);

  if (history.length > MAX_HISTORY) history.shift();
}

// think/jitter/power are multipliers applied to AIController's
// THINK_TIME_MS / AIM_JITTER_DEG / POWER_RANGE for the current
// difficulty tier. Below 1 on think/jitter = faster & more accurate
// (harder); above 1 = slower & sloppier (easier). power works the
// other way — above 1 nudges the AI's shots stronger, below 1 weaker.
export function getDifficultyMultiplier() {
  // Not enough of a track record yet to read anything into it.
  if (history.length < 2) return { think: 1, jitter: 1, power: 1 };

  const winRate = history.filter(Boolean).length / history.length;

  if (winRate >= 0.8) return { think: 0.7, jitter: 0.65, power: 1.15 };
  if (winRate >= 0.6) return { think: 0.85, jitter: 0.82, power: 1.08 };
  if (winRate <= 0.2) return { think: 1.35, jitter: 1.45, power: 0.85 };
  if (winRate <= 0.4) return { think: 1.15, jitter: 1.2, power: 0.93 };

  return { think: 1, jitter: 1, power: 1 };
}

export function resetHistory() {
  history = [];
}
