//--------------------------------------------------
// Game Modes
//--------------------------------------------------

export const GAME_MODE = {
  // Players take turns in order; only the current player's pen can be shot
  TURN_BASED: 'turn-based',

  // No turn order — any alive pen can be shot by anyone, anytime
  CHAOS: 'chaos',
};

//--------------------------------------------------
// Match Rules
//--------------------------------------------------

export const MATCH = {
  // GAME_MODE.TURN_BASED or GAME_MODE.CHAOS
  MODE: GAME_MODE.TURN_BASED,

  // Turn-based mode only — enable a per-turn countdown that forces
  // the turn to pass on timeout. Not applicable to chaos mode, which
  // always runs on CHAOS_MATCH_TIME below instead.
  USE_TURN_TIMER: true,

  // Per-turn timer duration (ms, turn-based mode only)
  TURN_TIME: 10000,

  // Chaos mode only — whole-match countdown (ms). Always on, not a
  // toggle: without a turn order there's no other natural end
  // condition, so the match is timed instead. When it runs out, the
  // match ends (win if exactly one pen is left alive, draw otherwise).
  CHAOS_MATCH_TIME: 60000,

  // Turn-based mode only — an additional whole-match time limit,
  // independent of the per-turn timer above. Off by default; flip
  // this on to also cap how long a turn-based match can run. When it
  // runs out the match ends immediately (win if exactly one pen is
  // left alive, draw otherwise), even mid-turn.
  USE_MATCH_TIME_LIMIT: false,

  // Whole-match time limit duration (ms, turn-based mode only)
  // (only used when USE_MATCH_TIME_LIMIT is true)
  MATCH_TIME_LIMIT: 60000,

  // Delay before the next turn starts (turn-based mode only, ms)
  TURN_CHANGE_DELAY: 50,

  // Turn-based mode only. If true, wait for the shot pen to physically
  // settle before handing off to the next player (slower, more "fair").
  // If false, the next player can act immediately after a shot.
  // Chaos mode never waits for settling — there's no turn to hand off.
  WAIT_FOR_SETTLE: true,

  // Squared linear speed below which a pen counts as "settled".
  // Pen.update() snaps a pen fully to rest once it drops below 0.0008 —
  // keep this at or under that so the handoff never fires while the
  // pen is still visibly creeping.
  // (only used when WAIT_FOR_SETTLE is true)
  SETTLE_LINEAR_THRESHOLD: 0.0008,

  // Angular speed (rad/s) below which a pen counts as "settled"
  // (see note above — keep at or under Pen.update()'s 0.03)
  // (only used when WAIT_FOR_SETTLE is true)
  SETTLE_ANGULAR_THRESHOLD: 0.03,

  // Hard cap (ms) on how long to wait for settling before forcing the
  // handoff anyway — damping decays velocity exponentially, so a hard
  // shot could otherwise stall the handoff for several seconds.
  // (only used when WAIT_FOR_SETTLE is true)
  SETTLE_MAX_WAIT: 5000,
};

//--------------------------------------------------
// Local match setup (Classroom / Vs Computer) — how many pens on the
// table and, for Vs Computer, which of them are AI-controlled. Set by
// the unified home screen (js/main.js) right before starting
// GameScene; GameScene reads these once in create().
//--------------------------------------------------

export const LOCAL_MATCH = {
  // Total pens this match (2-4). Classroom defaults to the original
  // 3-player hotseat match; Vs Computer sets this to 1 + however many
  // computer opponents were chosen.
  PLAYER_COUNT: 3,
};

export const AI = {
  // Empty = a normal human-only local match (Classroom). Non-empty =
  // Vs Computer — playerIds in this list are driven by AIController
  // instead of local input. The human is always playerId 0.
  PLAYER_IDS: [],

  // 'easy' | 'medium' | 'hard'
  DIFFICULTY: 'medium',

  // Vs Computer only — a brief pause after the match loads, before the
  // very first turn (or, in chaos mode, the free-for-all) actually
  // begins. Gives the human player a moment to see the table and get
  // oriented before the turn timer starts counting down or an AI takes
  // its first shot. Classroom has no AI opponents, so this never
  // applies there (see GameRules.js's startGraceMs).
  START_GRACE_MS: 3000,
};

//--------------------------------------------------
// Power-ups (optional, off by default)
//--------------------------------------------------

export const POWERUPS = {
  // Toggled from the Classroom/Vs Computer setup screens in
  // js/main.js. When on, a random pickup periodically
  // appears on the table: a Speed Boost (grants the next shot extra
  // power) or an Ink Puddle hazard (slows any pen crossing it while
  // it lasts). See js/PowerUps.js for the full behavior.
  ENABLED: false,

  SPAWN_INTERVAL: 8000,

  PICKUP_RADIUS: 26,
  INK_RADIUS: 60,
  INK_LIFETIME: 7000,

  SPEED_BOOST_MULTIPLIER: 1.6,

  // Extra per-tick velocity multiplier applied to any pen currently
  // inside an ink puddle (on top of the pen's normal damping).
  INK_DAMPING_FACTOR: 0.94,

  // Helicopter Shot pickup — charges the next shot to spin hard and
  // briefly hit much harder on impact (see Pen.js's activateHelicopter()
  // client-side, and PhysicsEngine.mjs/GameRoom.mjs server-side).
  // rad/s added to the pen's own spin the instant the charged shot is
  // taken (kept in the same direction the pen was already turning, or
  // positive if it wasn't turning at all).
  HELICOPTER_SPIN_VELOCITY: 16,

  // ms the extra bounce (and the visible spin-down) lasts after that
  // shot is taken.
  HELICOPTER_DURATION: 1400,

  // Temporary restitution value while active — PEN.RESTITUTION is
  // normally 1 (a little rebound, not bouncy-ball); this briefly makes
  // any pen it clips get knocked away noticeably harder.
  HELICOPTER_RESTITUTION: 1.9,
};

/*
Turn-based (MODE: GAME_MODE.TURN_BASED)

USE_TURN_TIMER — per-turn countdown; forces the turn to pass on timeout
WAIT_FOR_SETTLE — true waits for the shot pen to physically settle (bounded by SETTLE_MAX_WAIT) before the next player can act; false hands off immediately
TURN_CHANGE_DELAY — small pause between turns either way
Chaos (MODE: GAME_MODE.CHAOS)

No turn order — any alive pen can be grabbed and shot by anyone at any time, including simultaneously (multi-touch now supports several independent drags at once, keyed per pointer)
CHAOS_MATCH_TIME — always-on whole-match countdown; on timeout the match ends (win if exactly one pen alive, otherwise a draw)
Never waits for settling — physics for one shot just keeps running in the background while others act
*/
