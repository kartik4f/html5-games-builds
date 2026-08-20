const GAME_WIDTH = 1920;
const GAME_HEIGHT = 1080;
const PLAY_AREA = { x: 60, y: 170, width: 1800, height: 850 };

const DEPTHS = {
  TISSUE_BG: 0,
  FLUID: 2,
  NORMAL_CELL: 20,
  HEALTH_METER: 110,
  DRAGGING_CELL: 220,
  DRAGGING_HEALTH_METER: 230,
  FLOATING_TEXT: 500,
  HUD: 1000,
};

// Fixed layout for the tutorial level's 6 cells -- shared by
// CellManager.createTutorialCells (which actually spawns them) and
// GameScene's tutorial hand-drag hint (which needs to know exactly
// where the source/target cells sit to draw an accurate drag path
// between them).
const TUTORIAL_LAYOUT = {
  V: { x: PLAY_AREA.x + 1080, y: PLAY_AREA.y + 310 },
  H: { x: PLAY_AREA.x + 1260, y: PLAY_AREA.y + 560 },
  T: { x: PLAY_AREA.x + 520, y: PLAY_AREA.y + 310 },
  K: { x: PLAY_AREA.x + 520, y: PLAY_AREA.y + 560 },
  R1: { x: PLAY_AREA.x + 350, y: PLAY_AREA.y + 430 },
  R2: { x: PLAY_AREA.x + 690, y: PLAY_AREA.y + 430 },
};

const CELL_KEYS = {
  R: 'R_CELL',
  T: 'T_CELL',
  K: 'K_CELL',
  V: 'VISIBLE_CANCER_CELL',
  H: 'HIDDEN_CANCER_CELL',
};

// Fallback spawn position for the tutorial's hand-drag hint, used only
// on the rare frame where the live cell it wants to point at can't be
// found (e.g. destroyed mid-animation) -- normal operation always
// prefers the cell's actual live x/y (see GameScene.getCellPosByKey).
const CELL_KEY_TO_TUTORIAL_LAYOUT = {
  [CELL_KEYS.T]: 'T',
  [CELL_KEYS.K]: 'K',
  [CELL_KEYS.V]: 'V',
  [CELL_KEYS.H]: 'H',
};

// The "bad protein" dust cancer cells passively leak needs to read as a
// clearly different kind of particle from the round attack-hit sparks
// (see showDamageReaction), so it's a lumpy, irregular clump instead of
// a plain circle -- baked once as a white shape and tinted per cancer
// type at spawn time (see CancerCell.spawnDustParticle).
const DUST_PROTEIN_TEXTURE_KEY = 'cellTex_dustProtein';

// Extra sensing range (px) added on top of a K-cell's own radius plus
// whatever it's scanning for. A K-cell doesn't need to attach to a
// hidden cancer cell to reveal it -- just getting within this range is
// enough. Shared by the CellManager's actual detection check and by the
// translucent "scanner" ring drawn around every K-cell, so the visual
// always matches the real range.
const K_CELL_DETECTION_BUFFER = 90;

const COLORS = {
  bg: 0x07111f,
  panel: 0x0f2745,
  panelStroke: 0x67e8f9,
  r: 0xff4d4d,
  t: 0xdbeafe,
  k: 0xffffff,
  v: 0x00d4ff,
  h: 0x8b0000,
  green: 0x22c55e,
  yellow: 0xfacc15,
  danger: 0xef4444,
};

// --- Color helpers -----------------------------------------------------
// Cell size/color are configurable per level (see ConfigManager /
// ConfigScene), stored as a '#rrggbb' string (the format an <input
// type="color"> works with) and converted to Phaser's numeric 0xRRGGBB
// form wherever it's actually drawn.
function hexStringToNumber(hex, fallback = 0xffffff) {
  if (typeof hex === 'number') return hex;
  const clean = String(hex || '')
    .replace('#', '')
    .trim();
  const parsed = parseInt(clean, 16);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function numberToHexString(num) {
  const clamped = Math.max(0, Math.min(0xffffff, Math.round(Number(num) || 0)));
  return '#' + clamped.toString(16).padStart(6, '0');
}

function isValidHexColorString(hex) {
  return typeof hex === 'string' && /^#[0-9a-fA-F]{6}$/.test(hex.trim());
}

function darkenColor(colorNum, factor) {
  const r = (colorNum >> 16) & 0xff;
  const g = (colorNum >> 8) & 0xff;
  const b = colorNum & 0xff;
  return (
    (Math.round(r * factor) << 16) |
    (Math.round(g * factor) << 8) |
    Math.round(b * factor)
  );
}

// The original hand-picked rim/shadow tones aren't a uniform "darken" of
// their base color (e.g. K's white body pairs with a light-blue rim, not
// a grey one) -- so when a cell is left at its default color, use the
// original curated rim exactly. Only a genuinely custom color falls back
// to an auto-darkened rim (see resolveRimColor).
const DEFAULT_RIM_COLORS = {
  R_CELL: 0xb91c1c,
  T_CELL: 0x60a5fa,
  K_CELL: 0x93c5fd,
  VISIBLE_CANCER_CELL: 0x0891b2,
  HIDDEN_CANCER_CELL: 0xb91c1c, // disguise rim matches R
};

function resolveRimColor(typeKey, baseColorNum) {
  const defaultBase =
    DEFAULT_CELL_DEFS[typeKey] && DEFAULT_CELL_DEFS[typeKey].color;
  if (baseColorNum === defaultBase) return DEFAULT_RIM_COLORS[typeKey];
  return darkenColor(baseColorNum, 0.62);
}

// Reads a cell type's configured radius/color out of the level config
// (falling back to DEFAULT_CELL_DEFS when absent), in both hex-string
// and numeric form.
function resolveCellAppearance(config, typeKey) {
  const fallbackDef = DEFAULT_CELL_DEFS[typeKey];
  const appearance =
    (config && config.cellAppearance && config.cellAppearance[typeKey]) || {};
  const radius =
    Number(appearance.radius) > 0
      ? Number(appearance.radius)
      : fallbackDef.radius;
  const colorHex = isValidHexColorString(appearance.color)
    ? appearance.color
    : numberToHexString(fallbackDef.color);
  return { radius, colorHex, colorNum: hexStringToNumber(colorHex) };
}

// Cells are animated with non-uniform scale every frame (idle pulse +
// collision "squeeze", roughly 0.75x-1.3x) and briefly up to 1.25x
// during a split. A texture baked 1:1 at rest size would show visible
// softening/pixelation once scaled up. Baking at CELL_TEXTURE_SUPERSAMPLE
// times the logical size (then displaying it back down at the original
// size via baseVisualScale, see Cell below) keeps the jelly effect crisp
// across that whole scale range while costing almost nothing -- there
// are only 6 of these textures at a time, generated once per config.
const CELL_TEXTURE_SUPERSAMPLE = 2;

// Renders a "jelly sphere" cell design (shadow, rim, body, highlights,
// stroke) once into a reusable texture, instead of every Cell instance
// drawing its own Graphics object every time its visual state changes.
// Textures are cached in Phaser's global texture manager (keyed by
// `key`, which encodes radius+color -- see bakeAllCellTextures), so
// calling this again with the same key (same size/color combo) across
// scene restarts is a cheap no-op, and changing size/color in the
// Configurator naturally produces a fresh key instead of stomping the
// old texture.
//
// `spiky: true` adds small triangular nubs around the rim, producing a
// sea-urchin-like silhouette using the exact same colors -- used to
// tell a detected H-cell apart from a true V-cell without touching
// color or adding any text.
function bakeCellTexture(
  scene,
  key,
  radius,
  baseColor,
  rimColor,
  options = {},
) {
  if (scene.textures.exists(key)) return;
  const S = CELL_TEXTURE_SUPERSAMPLE;
  const spiky = !!options.spiky;
  const pad = spiky ? 26 : 14;
  const size = Math.ceil(radius * 2 + pad * 2) * S;
  const cx = size / 2;
  const cy = size / 2;
  const r = radius * S;
  const g = scene.make.graphics({ x: 0, y: 0, add: false });

  if (spiky) {
    // Spikes are drawn first so the smooth body (drawn next) covers
    // their base, leaving only the pointed tips poking past the rim.
    const spikeCount = 11;
    const halfAngle = 0.13;
    const tipDistance = r * 1.22;
    const baseDistance = r * 0.92;
    g.fillStyle(rimColor, 0.95);
    for (let i = 0; i < spikeCount; i++) {
      const angle = (i / spikeCount) * Math.PI * 2;
      const tipX = cx + Math.cos(angle) * tipDistance;
      const tipY = cy + Math.sin(angle) * tipDistance;
      const b1x = cx + Math.cos(angle - halfAngle) * baseDistance;
      const b1y = cy + Math.sin(angle - halfAngle) * baseDistance;
      const b2x = cx + Math.cos(angle + halfAngle) * baseDistance;
      const b2y = cy + Math.sin(angle + halfAngle) * baseDistance;
      g.fillTriangle(tipX, tipY, b1x, b1y, b2x, b2y);
    }
  }

  g.fillStyle(0x000000, 0.18);
  g.fillCircle(cx + 4 * S, cy + 5 * S, r * 1.02);
  g.fillStyle(rimColor, 0.95);
  g.fillCircle(cx, cy, r);
  g.fillStyle(baseColor, 0.92);
  g.fillCircle(cx, cy, r * 0.88);
  g.fillStyle(0xffffff, 0.08);
  g.fillCircle(cx - r * 0.08, cy + r * 0.08, r * 0.62);
  g.fillStyle(0xffffff, 0.28);
  g.fillEllipse(cx - r * 0.35, cy - r * 0.35, r * 0.9, r * 0.45);
  g.fillStyle(0xffffff, 0.18);
  g.fillCircle(cx - r * 0.15, cy - r * 0.15, r * 0.12);
  g.fillStyle(0xffffff, 0.12);
  g.fillCircle(cx + r * 0.24, cy + r * 0.22, r * 0.38);
  g.lineStyle(2 * S, 0xffffff, 0.25);
  g.strokeCircle(cx, cy, r * 0.92);
  g.generateTexture(key, size, size);
  g.destroy();
  // generateTexture() can default a texture to nearest-neighbor
  // filtering depending on renderer/version. Force smooth (bilinear)
  // filtering explicitly so scaling the sprite for the pulse/squeeze
  // animation blends pixels instead of showing hard blocky edges.
  const tex = scene.textures.get(key);
  if (tex && tex.setFilter) tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

function bakeDustProteinTexture(scene) {
  if (scene.textures.exists(DUST_PROTEIN_TEXTURE_KEY)) return;
  const size = 22;
  const cx = size / 2;
  const cy = size / 2;
  // A handful of overlapping, unevenly-sized circles reads as a lumpy
  // clump/aggregate rather than a clean single dot -- distinct at a
  // glance from the perfectly round attack-hit particles.
  const lobes = [
    { dx: -3.2, dy: -2.2, r: 4.4 },
    { dx: 3.1, dy: -1.4, r: 3.6 },
    { dx: -1.2, dy: 3.3, r: 4 },
    { dx: 2.6, dy: 2.6, r: 2.9 },
    { dx: 0.2, dy: -0.4, r: 3.2 },
  ];
  const g = scene.make.graphics({ x: 0, y: 0, add: false });
  g.fillStyle(0xffffff, 1);
  lobes.forEach((l) => g.fillCircle(cx + l.dx, cy + l.dy, l.r));
  g.generateTexture(DUST_PROTEIN_TEXTURE_KEY, size, size);
  g.destroy();
  const tex = scene.textures.get(DUST_PROTEIN_TEXTURE_KEY);
  if (tex && tex.setFilter) tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
}

// Bakes (or reuses, if an identical size/color combo was already baked)
// every texture this level's config needs, and returns a lookup table
// of the resulting texture keys. Called once per GameScene start, since
// size/color are per-level config now rather than fixed constants.
function bakeAllCellTextures(scene, config) {
  const appearances = {
    R: resolveCellAppearance(config, CELL_KEYS.R),
    T: resolveCellAppearance(config, CELL_KEYS.T),
    K: resolveCellAppearance(config, CELL_KEYS.K),
    V: resolveCellAppearance(config, CELL_KEYS.V),
    H: resolveCellAppearance(config, CELL_KEYS.H),
  };

  const bake = (typeKey, label, appearance, spiky) => {
    const key =
      'cellTex_' +
      label +
      '_' +
      Math.round(appearance.radius) +
      '_' +
      appearance.colorHex.replace('#', '') +
      (spiky ? '_spiky' : '');
    const rimColor = resolveRimColor(typeKey, appearance.colorNum);
    bakeCellTexture(
      scene,
      key,
      appearance.radius,
      appearance.colorNum,
      rimColor,
      {
        spiky,
      },
    );
    return key;
  };

  const keys = {
    R: bake(CELL_KEYS.R, 'R', appearances.R, false),
    T: bake(CELL_KEYS.T, 'T', appearances.T, false),
    K: bake(CELL_KEYS.K, 'K', appearances.K, false),
    V: bake(CELL_KEYS.V, 'V', appearances.V, false),
    H: bake(CELL_KEYS.H, 'H', appearances.H, false),
    // Detected H keeps H's own configured size but takes on V's
    // configured color, plus the spiky "revealed" silhouette -- same
    // color as V is the whole point (it now reads as visible cancer),
    // the spikes are what still sets it apart from a true V-cell.
    H_DETECTED: bake(
      CELL_KEYS.H,
      'H_detected',
      {
        radius: appearances.H.radius,
        colorHex: appearances.V.colorHex,
        colorNum: appearances.V.colorNum,
      },
      true,
    ),
  };

  bakeDustProteinTexture(scene);
  return keys;
}

// ---------------------------------------------------------------------
// Every piece of user-facing text in the game lives here, in one place,
// instead of scattered as inline literals through the gameplay/UI code.
// Per naming convention: the visible cancer cell (internal key
// VISIBLE_CANCER_CELL / CELL_KEYS.V) is always displayed as "Cancer
// Cell", and the hidden cancer cell (internal key HIDDEN_CANCER_CELL /
// CELL_KEYS.H) is always displayed as "Smart Cancer Cell" -- those
// internal keys/ids are unchanged, only the text a player actually sees
// is renamed.
// ---------------------------------------------------------------------
const STRINGS = {
  cellDisplayName: {
    R_CELL: 'R-Cell',
    T_CELL: 'T-Cell',
    K_CELL: 'K-Cell',
    VISIBLE_CANCER_CELL: 'Cancer Cell',
    HIDDEN_CANCER_CELL: 'Smart Cancer Cell',
  },

  tutorial: {
    steps: [
      'Tutorial: Drag the T-Cell near the blue Cancer Cell. T-Cells auto-attack the Cancer Cell.',
      'Great. Auto attack is active. Click the Cancer Cell to add bonus manual damage.',
      'Now drag the K-Cell near the red Smart Cancer Cell. K-Cells reveal and attack the Smart Cancer Cell.',
      'Excellent. Keep clicking or wait for auto attack until all cancer cells are destroyed.',
      'Tutorial complete. You learned T-Cell to Cancer Cell, K-Cell to Smart Cancer Cell, auto attack, and click bonus damage.',
    ],
    completeReason:
      'Tutorial complete. You learned the immune response mechanics.',
    legendTitle: 'Cell Guide',
    legendRoles: {
      R_CELL: 'Neutral -- no attack',
      T_CELL: 'Attacks Cancer Cell',
      K_CELL: 'Reveals & attacks Smart Cancer Cell',
      VISIBLE_CANCER_CELL: 'Visible target for T-Cell',
      HIDDEN_CANCER_CELL: 'Hidden until a K-Cell gets close',
    },
    matchupTitle: 'Who Attacks Whom',
    dragHintLabel: 'Drag me here',
  },

  gameScene: {
    allCancerDestroyedReason: 'All cancer cells destroyed before time ran out.',
    survivedFullTimeReason: 'You survived the full simulation time.',
    timeUpDangerReason:
      'Time ended, but health was at or below danger threshold.',
  },

  floating: {
    notAttached: 'Not attached',
    destroyed: 'Destroyed',
    cellLost: 'Cell Lost',
    split: 'Split',
    detectedByK: 'Detected by K-Cell',
    detected: 'Detected',
    attachHintVisible: 'Attach T-Cell to this Cancer Cell',
    attachHintHidden: 'Attach K-Cell to this Smart Cancer Cell',
    ruleTAttached: 'T-Cell attached: auto attack enabled',
    ruleKAttached: 'K-Cell attached: auto attack enabled',
    ruleRAttached: 'R-Cell attached: no attack damage',
    ruleWrongAttacker: 'Attached, but not the correct attacker',
  },

  hud: {
    subtitle:
      'Drag cells. Attach T-Cell to Cancer Cell and K-Cell to Smart Cancer Cell. Correct attachments auto-attack.',
    timerLabel: 'Play Time Left',
    healthPrefix: 'Health ',
    healthSeparator: ' / ',
    statTDps: 'T DPS',
    statKDps: 'K DPS',
    statCancerHp: 'Cancer HP',
    statSmartHp: 'Smart HP',
    heartRelaxed: 'RELAXED',
    heartWatch: 'WATCH',
    heartCaution: 'CAUTION',
    bpmSuffix: ' BPM',
  },

  levelSelect: {
    title: 'Choose Level Preset',
    backButton: 'Back To Configurator',
    cellsLabel: 'Cells: ',
    playTimeLabel: 'Play Time: ',
    tHitLabel: 'T Hit: ',
    kHitLabel: '  |  K Hit: ',
    cancerHpLabel: 'Cancer HP: ',
    smartHpLabel: '  |  Smart HP: ',
    maxAttachLabel: 'Max Attach: ',
    cancerDragLabel: 'Cancer Drag: ',
    counterAttackLabel: 'Cancer Counter-Attack: ',
    playPrefix: 'Play ',
    yes: 'Yes',
    no: 'No',
  },

  result: {
    won: 'Level Complete',
    lost: 'Simulation Failed',
    levelPrefix: 'Level: ',
    unknownLevel: 'Unknown',
    finalHealthPrefix: '\nFinal Health: ',
    survivedPrefix: '\nSurvived: ',
    survivedSuffix: ' seconds',
    restartLevel: 'Restart Level',
    configurator: 'Configurator',
    levelSelect: 'Level Select',
  },

  configurator: {
    panelTitle: 'Configurator',
    panelSubtitle:
      'Edit level balance. Use Total Play Time Allowed for the actual timer.',
    loadTutorial: 'Load Tutorial',
    loadLevel1: 'Load Level 1',
    loadLevel2: 'Load Level 2',
    loadLevel3: 'Load Level 3',
    loadLevel4: 'Load Level 4',
    loadLevel5: 'Load Level 5',
    savedSuccess: 'Config saved successfully.',
    balancerPopupBlocked:
      'Please allow pop-ups for this page, then try opening the Difficulty Balancer again.',
    xlsxLoadFailed:
      'Could not load the spreadsheet library -- check your internet connection and try again.',
    actions: {
      saveConfig: 'Save Config',
      startGame: 'Start Game',
      goToLevelSelect: 'Go To Level Select',
      exportJson: 'Export Levels JSON',
      loadJson: 'Load Levels JSON',
      openBalancer: 'Open Difficulty Balancer',
      downloadXlsx: 'Download Level Balance (XLSX)',
    },
    sections: {
      levelSettings: 'Level Settings',
      counterAttack: 'Cancer Counter-Attack (Advanced Levels)',
      counterAttackHint:
        "Attack DPS is the cancer cell's TOTAL damage per second, split evenly across every healthy cell currently attached to it. Healthy cell health only matters when the toggle above is on -- otherwise healthy cells stay invulnerable to cancer, as before.",
      appearance: 'Cell Appearance (Size & Color)',
      appearanceHint:
        'Smart Cancer Cell color is only its disguise before detection -- once detected it always switches to the Cancer Cell color above, plus a spiky outline, regardless of this setting.',
      distribution: 'Cell Distribution Percentages',
      distributionHint:
        'R + T + K + Cancer Cell + Smart Cancer Cell must equal 100.',
      immuneDamage: 'Immune Cell Damage',
      autoAttackDps: 'Auto Attack Damage Per Second',
      cancerHealth: 'Cancer Cell Health',
      splitTimeRange: 'Split Time Range Seconds',
      lifeTimes: 'Healthy Cell Life Times Seconds',
      lifeTimesHint: 'Cancer cells do not have lifetime.',
      cancerImpact: 'Cancer Impact On Player Health',
    },
    fields: {
      levelName: 'Level Name',
      totalCellsCount: 'Total Cells Count',
      totalPlayTime: 'Total Play Time Allowed Seconds',
      totalSurvivalTime: 'Survival Time Seconds',
      playerHealth: 'Player Health',
      playerHealthDangerThresholdPercent: 'Danger Threshold Percent',
      maxCells: 'Max Cells',
      cancerDamageInterval: 'Cancer Damage Interval',
      maxAttackersPerCancer: 'Max Attackers Per Cancer Cell',
      allowCancerCellDragging: 'Allow Cancer Cell Dragging',
      winOnAllCancerDestroyed: 'Win If All Cancer Destroyed Early',
      cancerCellsCanAttackHealthy: 'Cancer Cells Can Attack Healthy Cells',
      cancerAttackDps_VISIBLE_CANCER_CELL: 'Cancer Cell Attack DPS (Total)',
      cancerAttackDps_HIDDEN_CANCER_CELL:
        'Smart Cancer Cell Attack DPS (Total)',
      healthyHealth_R_CELL: 'R-Cell Health',
      healthyHealth_T_CELL: 'T-Cell Health',
      healthyHealth_K_CELL: 'K-Cell Health',
      appearance_radius_R_CELL: 'R-Cell Radius',
      appearance_color_R_CELL: 'R-Cell Color',
      appearance_radius_T_CELL: 'T-Cell Radius',
      appearance_color_T_CELL: 'T-Cell Color',
      appearance_radius_K_CELL: 'K-Cell Radius',
      appearance_color_K_CELL: 'K-Cell Color',
      appearance_radius_VISIBLE_CANCER_CELL: 'Cancer Cell Radius',
      appearance_color_VISIBLE_CANCER_CELL: 'Cancer Cell Color',
      appearance_radius_HIDDEN_CANCER_CELL: 'Smart Cancer Cell Radius',
      appearance_color_HIDDEN_CANCER_CELL: 'Smart Cancer Cell Color (disguise)',
      dist_R_CELL: 'R-Cells Percent',
      dist_T_CELL: 'T-Cells Percent',
      dist_K_CELL: 'K-Cells Percent',
      dist_VISIBLE_CANCER_CELL: 'Cancer Cell Percent',
      dist_HIDDEN_CANCER_CELL: 'Smart Cancer Cell Percent',
      damage_T_CELL: 'T-Cell Hits Per Click',
      damage_K_CELL: 'K-Cell Hits Per Click',
      dps_T_CELL: 'T-Cell Damage Per Second',
      dps_K_CELL: 'K-Cell Damage Per Second',
      health_VISIBLE_CANCER_CELL: 'Cancer Cell Health',
      health_HIDDEN_CANCER_CELL: 'Smart Cancer Cell Health',
      splitMin_R_CELL: 'R Split Min',
      splitMax_R_CELL: 'R Split Max',
      splitMin_T_CELL: 'T Split Min',
      splitMax_T_CELL: 'T Split Max',
      splitMin_K_CELL: 'K Split Min',
      splitMax_K_CELL: 'K Split Max',
      splitMin_VISIBLE_CANCER_CELL: 'Cancer Cell Split Min',
      splitMax_VISIBLE_CANCER_CELL: 'Cancer Cell Split Max',
      splitMin_HIDDEN_CANCER_CELL: 'Smart Cancer Cell Split Min',
      splitMax_HIDDEN_CANCER_CELL: 'Smart Cancer Cell Split Max',
      life_R_CELL: 'R Life Time',
      life_T_CELL: 'T Life Time',
      life_K_CELL: 'K Life Time',
      impact_VISIBLE_CANCER_CELL: 'Cancer Cell Impact',
      impact_HIDDEN_CANCER_CELL: 'Smart Cancer Cell Impact',
    },
  },
};

const DEFAULT_CELL_DEFS = {
  R_CELL: {
    key: 'R_CELL',
    category: 'healthy',
    label: 'R',
    color: COLORS.r,
    radius: 40,
    maxHealth: 0,
    hitsPerClick: 0,
    lifeTime: 80,
    splitTime: 10,
    impactOnPlayerHealth: 0,
    canDivide: true,
  },
  T_CELL: {
    key: 'T_CELL',
    category: 'healthy',
    label: 'T',
    color: COLORS.t,
    radius: 45,
    maxHealth: 0,
    hitsPerClick: 2,
    lifeTime: 90,
    splitTime: 20,
    impactOnPlayerHealth: 0,
    canDivide: true,
  },
  K_CELL: {
    key: 'K_CELL',
    category: 'healthy',
    label: 'K',
    color: COLORS.k,
    radius: 45,
    maxHealth: 0,
    hitsPerClick: 1,
    lifeTime: 90,
    splitTime: 30,
    impactOnPlayerHealth: 0,
    canDivide: true,
  },
  VISIBLE_CANCER_CELL: {
    key: 'VISIBLE_CANCER_CELL',
    category: 'cancer',
    label: 'V',
    color: COLORS.v,
    radius: 50,
    maxHealth: 100,
    hitsPerClick: 0,
    lifeTime: Infinity,
    splitTime: 30,
    impactOnPlayerHealth: 1,
    canDivide: true,
  },
  HIDDEN_CANCER_CELL: {
    key: 'HIDDEN_CANCER_CELL',
    category: 'cancer',
    label: 'H',
    color: COLORS.r, // disguised as an R-cell until detected
    detectedColor: COLORS.v,
    radius: 50,
    maxHealth: 100,
    hitsPerClick: 0,
    lifeTime: Infinity,
    splitTime: 30,
    impactOnPlayerHealth: 1,
    canDivide: true,
  },
};

class ConfigManager {
  static clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  static presets = {
    tutorial: {
      id: 'tutorial',
      name: 'Tutorial: Immune Response',
      difficulty: 'Tutorial',
      totalCellsCount: 6,
      totalSurvivalTime: 300,
      totalPlayTime: 300,
      playerHealth: 999,
      playerHealthDangerThresholdPercent: 1,
      maxCells: 20,
      cancerDamageInterval: 999,
      allowCancerCellDragging: false,
      maxAttackersPerCancer: 6,
      distribution: {
        R_CELL: 34,
        T_CELL: 17,
        K_CELL: 17,
        VISIBLE_CANCER_CELL: 16,
        HIDDEN_CANCER_CELL: 16,
      },
      splitTimes: {
        R_CELL: 999,
        T_CELL: 999,
        K_CELL: 999,
        VISIBLE_CANCER_CELL: 999,
        HIDDEN_CANCER_CELL: 999,
      },
      splitTimeRanges: {
        R_CELL: { min: 999, max: 999 },
        T_CELL: { min: 999, max: 999 },
        K_CELL: { min: 999, max: 999 },
        VISIBLE_CANCER_CELL: { min: 999, max: 999 },
        HIDDEN_CANCER_CELL: { min: 999, max: 999 },
      },
      lifeTimes: { R_CELL: 999, T_CELL: 999, K_CELL: 999 },
      impacts: { VISIBLE_CANCER_CELL: 0, HIDDEN_CANCER_CELL: 0 },
      cellDamage: { T_CELL: 20, K_CELL: 20 },
      damagePerSecond: { T_CELL: 10, K_CELL: 10 },
      cancerHealth: { VISIBLE_CANCER_CELL: 40, HIDDEN_CANCER_CELL: 40 },
    },
    level1: {
      id: 'level1',
      name: 'Level 1: First Response',
      difficulty: 'Easy',
      totalCellsCount: 34,
      totalSurvivalTime: 120,
      totalPlayTime: 120,
      playerHealth: 115,
      playerHealthDangerThresholdPercent: 25,
      maxCells: 115,
      cancerDamageInterval: 6,
      allowCancerCellDragging: true,
      maxAttackersPerCancer: 3,
      distribution: {
        R_CELL: 60,
        T_CELL: 13,
        K_CELL: 11,
        VISIBLE_CANCER_CELL: 10,
        HIDDEN_CANCER_CELL: 6,
      },
      splitTimes: {
        R_CELL: 18,
        T_CELL: 28,
        K_CELL: 32,
        VISIBLE_CANCER_CELL: 34,
        HIDDEN_CANCER_CELL: 36,
      },
      splitTimeRanges: {
        R_CELL: { min: 15, max: 22 },
        T_CELL: { min: 24, max: 34 },
        K_CELL: { min: 26, max: 38 },
        VISIBLE_CANCER_CELL: { min: 30, max: 42 },
        HIDDEN_CANCER_CELL: { min: 32, max: 46 },
      },
      lifeTimes: { R_CELL: 95, T_CELL: 100, K_CELL: 100 },
      impacts: { VISIBLE_CANCER_CELL: 1, HIDDEN_CANCER_CELL: 1 },
      cellDamage: { T_CELL: 6, K_CELL: 5 },
      damagePerSecond: { T_CELL: 2.4, K_CELL: 2 },
      cancerHealth: { VISIBLE_CANCER_CELL: 130, HIDDEN_CANCER_CELL: 115 },
    },
    level2: {
      id: 'level2',
      name: 'Level 2: Hidden Threats',
      difficulty: 'Medium',
      totalCellsCount: 42,
      totalSurvivalTime: 135,
      totalPlayTime: 135,
      playerHealth: 120,
      playerHealthDangerThresholdPercent: 25,
      maxCells: 135,
      cancerDamageInterval: 5.5,
      allowCancerCellDragging: true,
      maxAttackersPerCancer: 2,
      distribution: {
        R_CELL: 55,
        T_CELL: 15,
        K_CELL: 12,
        VISIBLE_CANCER_CELL: 10,
        HIDDEN_CANCER_CELL: 8,
      },
      splitTimes: {
        R_CELL: 16,
        T_CELL: 25,
        K_CELL: 29,
        VISIBLE_CANCER_CELL: 31,
        HIDDEN_CANCER_CELL: 32,
      },
      splitTimeRanges: {
        R_CELL: { min: 13, max: 20 },
        T_CELL: { min: 21, max: 31 },
        K_CELL: { min: 23, max: 35 },
        VISIBLE_CANCER_CELL: { min: 25, max: 38 },
        HIDDEN_CANCER_CELL: { min: 26, max: 40 },
      },
      lifeTimes: { R_CELL: 85, T_CELL: 95, K_CELL: 95 },
      impacts: { VISIBLE_CANCER_CELL: 1.1, HIDDEN_CANCER_CELL: 1.25 },
      cellDamage: { T_CELL: 9, K_CELL: 8 },
      damagePerSecond: { T_CELL: 4, K_CELL: 3.4 },
      cancerHealth: { VISIBLE_CANCER_CELL: 135, HIDDEN_CANCER_CELL: 125 },
    },
    level3: {
      id: 'level3',
      name: 'Level 3: Rapid Mutation',
      difficulty: 'Hard',
      totalCellsCount: 48,
      totalSurvivalTime: 150,
      totalPlayTime: 150,
      playerHealth: 135,
      playerHealthDangerThresholdPercent: 20,
      maxCells: 165,
      cancerDamageInterval: 5.5,
      allowCancerCellDragging: true,
      maxAttackersPerCancer: 2,
      distribution: {
        R_CELL: 50,
        T_CELL: 17,
        K_CELL: 14,
        VISIBLE_CANCER_CELL: 11,
        HIDDEN_CANCER_CELL: 8,
      },
      splitTimes: {
        R_CELL: 15,
        T_CELL: 23,
        K_CELL: 26,
        VISIBLE_CANCER_CELL: 29,
        HIDDEN_CANCER_CELL: 31,
      },
      splitTimeRanges: {
        R_CELL: { min: 12, max: 18 },
        T_CELL: { min: 19, max: 29 },
        K_CELL: { min: 21, max: 32 },
        VISIBLE_CANCER_CELL: { min: 24, max: 36 },
        HIDDEN_CANCER_CELL: { min: 26, max: 39 },
      },
      lifeTimes: { R_CELL: 82, T_CELL: 92, K_CELL: 92 },
      impacts: { VISIBLE_CANCER_CELL: 1.1, HIDDEN_CANCER_CELL: 1.3 },
      cellDamage: { T_CELL: 12, K_CELL: 11 },
      damagePerSecond: { T_CELL: 5.4, K_CELL: 4.8 },
      cancerHealth: { VISIBLE_CANCER_CELL: 155, HIDDEN_CANCER_CELL: 140 },
    },
    level4: {
      id: 'level4',
      name: 'Level 4: Adaptive Cancer',
      difficulty: 'Advanced',
      totalCellsCount: 55,
      totalSurvivalTime: 165,
      totalPlayTime: 165,
      playerHealth: 150,
      playerHealthDangerThresholdPercent: 20,
      maxCells: 180,
      cancerDamageInterval: 5,
      allowCancerCellDragging: true,
      maxAttackersPerCancer: 2,
      // Cancer cells fight back here -- see cancerAttackDamagePerSecond
      // below, which is the *total* DPS a cancer cell deals, split
      // across every healthy cell attached to it.
      cancerCellsCanAttackHealthy: true,
      cancerAttackDamagePerSecond: {
        VISIBLE_CANCER_CELL: 2.6,
        HIDDEN_CANCER_CELL: 3.1,
      },
      healthyCellHealth: { R_CELL: 18, T_CELL: 22, K_CELL: 22 },
      distribution: {
        R_CELL: 48,
        T_CELL: 18,
        K_CELL: 15,
        VISIBLE_CANCER_CELL: 11,
        HIDDEN_CANCER_CELL: 8,
      },
      splitTimes: {
        R_CELL: 14,
        T_CELL: 21,
        K_CELL: 24,
        VISIBLE_CANCER_CELL: 27,
        HIDDEN_CANCER_CELL: 29,
      },
      splitTimeRanges: {
        R_CELL: { min: 11, max: 17 },
        T_CELL: { min: 17, max: 27 },
        K_CELL: { min: 19, max: 30 },
        VISIBLE_CANCER_CELL: { min: 22, max: 34 },
        HIDDEN_CANCER_CELL: { min: 24, max: 37 },
      },
      lifeTimes: { R_CELL: 78, T_CELL: 88, K_CELL: 88 },
      impacts: { VISIBLE_CANCER_CELL: 1.15, HIDDEN_CANCER_CELL: 1.35 },
      cellDamage: { T_CELL: 11, K_CELL: 10 },
      damagePerSecond: { T_CELL: 5, K_CELL: 4.4 },
      cancerHealth: { VISIBLE_CANCER_CELL: 165, HIDDEN_CANCER_CELL: 148 },
    },
    level5: {
      id: 'level5',
      name: 'Level 5: Full Assault',
      difficulty: 'Expert',
      totalCellsCount: 60,
      totalSurvivalTime: 180,
      totalPlayTime: 180,
      playerHealth: 160,
      playerHealthDangerThresholdPercent: 20,
      maxCells: 195,
      cancerDamageInterval: 5,
      // Cancer cells can't be dragged at all here -- you have to bring
      // T/K-cells to them instead of repositioning the threat.
      allowCancerCellDragging: false,
      maxAttackersPerCancer: 1,
      cancerCellsCanAttackHealthy: true,
      cancerAttackDamagePerSecond: {
        VISIBLE_CANCER_CELL: 3.2,
        HIDDEN_CANCER_CELL: 3.8,
      },
      healthyCellHealth: { R_CELL: 16, T_CELL: 20, K_CELL: 20 },
      distribution: {
        R_CELL: 45,
        T_CELL: 19,
        K_CELL: 16,
        VISIBLE_CANCER_CELL: 11,
        HIDDEN_CANCER_CELL: 9,
      },
      splitTimes: {
        R_CELL: 13,
        T_CELL: 19,
        K_CELL: 22,
        VISIBLE_CANCER_CELL: 25,
        HIDDEN_CANCER_CELL: 27,
      },
      splitTimeRanges: {
        R_CELL: { min: 10, max: 16 },
        T_CELL: { min: 15, max: 25 },
        K_CELL: { min: 17, max: 28 },
        VISIBLE_CANCER_CELL: { min: 20, max: 32 },
        HIDDEN_CANCER_CELL: { min: 22, max: 35 },
      },
      lifeTimes: { R_CELL: 76, T_CELL: 86, K_CELL: 86 },
      impacts: { VISIBLE_CANCER_CELL: 1.2, HIDDEN_CANCER_CELL: 1.4 },
      cellDamage: { T_CELL: 14, K_CELL: 13 },
      damagePerSecond: { T_CELL: 6, K_CELL: 5.2 },
      cancerHealth: { VISIBLE_CANCER_CELL: 170, HIDDEN_CANCER_CELL: 155 },
    },
  };

  // Canonical order of the "core" level presets (excludes tutorial),
  // reused by export/import/validation and the level-select screen so
  // adding a new level only means editing it in one place.
  static coreLevelIds = ['level1', 'level2', 'level3', 'level4', 'level5'];

  static currentConfig = ConfigManager.clone(ConfigManager.presets.level1);

  static loadPreset(id) {
    ConfigManager.currentConfig = ConfigManager.normalizeConfig(
      ConfigManager.clone(
        ConfigManager.presets[id] || ConfigManager.presets.level1,
      ),
    );
    return ConfigManager.currentConfig;
  }

  static saveConfig(c) {
    const normalized = ConfigManager.normalizeConfig(ConfigManager.clone(c));
    ConfigManager.currentConfig = normalized;
    // Previously this only updated the in-memory currentConfig, so
    // editing e.g. Level 2 in the Configurator and clicking "Save
    // Config" never touched ConfigManager.presets.level2 -- Level
    // Select's cards and getExportPayload() both read straight from
    // `presets`, so the edit silently vanished from both the moment
    // you left the Configurator or exported JSON. Writing the saved
    // config back into its matching preset (when it has one) keeps
    // all three -- current session, Level Select, and JSON export --
    // in sync with whatever was last saved.
    if (normalized.id && ConfigManager.presets[normalized.id]) {
      ConfigManager.presets[normalized.id] = ConfigManager.clone(normalized);
    }
    return ConfigManager.currentConfig;
  }

  static getCurrentConfig() {
    // presets is the single source of truth for any level that has one
    // (see saveConfig above). Reading through it here -- instead of
    // trusting whatever object happens to be sitting in
    // currentConfig -- guarantees Start Game, GameScene, and anything
    // else that calls getCurrentConfig() always uses the actually-saved
    // preset, never a stale or out-of-sync copy. Only a true one-off
    // custom config (no matching id in presets) falls back to
    // currentConfig itself.
    const id = ConfigManager.currentConfig && ConfigManager.currentConfig.id;
    const source =
      (id && ConfigManager.presets[id]) || ConfigManager.currentConfig;
    return ConfigManager.normalizeConfig(ConfigManager.clone(source));
  }

  static randomRange(min, max) {
    const safeMin = Number(min);
    const safeMax = Number(max);
    if (Number.isNaN(safeMin) || Number.isNaN(safeMax)) return 1;
    const low = Math.max(0.1, Math.min(safeMin, safeMax));
    const high = Math.max(low, Math.max(safeMin, safeMax));
    return Phaser.Math.FloatBetween(low, high);
  }

  static getSplitRange(key, c) {
    const fallback = Number(
      c.splitTimes && c.splitTimes[key]
        ? c.splitTimes[key]
        : DEFAULT_CELL_DEFS[key].splitTime,
    );
    const saved = c.splitTimeRanges && c.splitTimeRanges[key];
    if (!saved) return { min: fallback, max: fallback };
    const min = Number(saved.min);
    const max = Number(saved.max);
    if (Number.isNaN(min) || Number.isNaN(max))
      return { min: fallback, max: fallback };
    return { min: Math.min(min, max), max: Math.max(min, max) };
  }

  static getCellDef(key, c) {
    const d = ConfigManager.clone(DEFAULT_CELL_DEFS[key]);
    const appearance = resolveCellAppearance(c, key);
    d.radius = appearance.radius;
    d.color = appearance.colorNum;
    d.splitTimeRange = ConfigManager.getSplitRange(key, c);
    d.splitTime = ConfigManager.randomRange(
      d.splitTimeRange.min,
      d.splitTimeRange.max,
    );
    if (d.category === 'healthy') {
      d.lifeTime = Number(c.lifeTimes[key]);
      // Healthy cells are invulnerable (maxHealth 0) unless a level
      // opts into cancer counter-attacks and configures real HP for
      // them -- see cancerCellsCanAttackHealthy / healthyCellHealth.
      d.maxHealth = Number(
        (c.healthyCellHealth && c.healthyCellHealth[key]) || 0,
      );
    } else d.lifeTime = Infinity;
    if (key === CELL_KEYS.T) d.hitsPerClick = Number(c.cellDamage.T_CELL);
    if (key === CELL_KEYS.K) d.hitsPerClick = Number(c.cellDamage.K_CELL);
    if (key === CELL_KEYS.V || key === CELL_KEYS.H) {
      d.maxHealth = Number(c.cancerHealth[key]);
      d.impactOnPlayerHealth = Number(c.impacts[key]);
    }
    if (key === CELL_KEYS.H) {
      // A detected H-cell should read as "revealed cancer", so it takes
      // on whatever color V is currently configured to, not a fixed
      // default -- matching the H_DETECTED texture baked in
      // bakeAllCellTextures.
      d.detectedColor = resolveCellAppearance(c, CELL_KEYS.V).colorNum;
    }
    return d;
  }

  static distributionToCounts(c) {
    const total = Math.max(1, Math.round(Number(c.totalCellsCount)));
    const rows = Object.entries(c.distribution).map(([key, p]) => {
      const exact = (total * Number(p)) / 100;
      return {
        key,
        floor: Math.floor(exact),
        remainder: exact - Math.floor(exact),
      };
    });
    let used = rows.reduce((s, r) => s + r.floor, 0);
    rows.sort((a, b) => b.remainder - a.remainder);
    let i = 0;
    while (used < total) {
      rows[i % rows.length].floor += 1;
      used += 1;
      i += 1;
    }
    const counts = {};
    rows.forEach((r) => {
      counts[r.key] = r.floor;
    });
    return counts;
  }

  static validate(c) {
    const errors = [];
    const requiredNumbers = [
      ['totalCellsCount', c.totalCellsCount],
      ['totalSurvivalTime', c.totalSurvivalTime],
      ['totalPlayTime', c.totalPlayTime],
      ['playerHealth', c.playerHealth],
      [
        'playerHealthDangerThresholdPercent',
        c.playerHealthDangerThresholdPercent,
      ],
      ['maxCells', c.maxCells],
      ['cancerDamageInterval', c.cancerDamageInterval],
      ['maxAttackersPerCancer', c.maxAttackersPerCancer],
    ];

    [
      'distribution',
      'splitTimes',
      'lifeTimes',
      'impacts',
      'cellDamage',
      'damagePerSecond',
      'cancerHealth',
    ].forEach((g) => {
      Object.keys(c[g] || {}).forEach((k) =>
        requiredNumbers.push([g + '.' + k, c[g][k]]),
      );
    });

    requiredNumbers.forEach(([name, value]) => {
      if (Number.isNaN(Number(value))) errors.push(name + ' must be a number.');
    });

    if (Number(c.totalCellsCount) <= 0)
      errors.push('totalCellsCount must be greater than 0.');
    if (Number(c.totalSurvivalTime) <= 0)
      errors.push('totalSurvivalTime must be greater than 0.');
    if (Number(c.totalPlayTime) <= 0)
      errors.push('totalPlayTime must be greater than 0.');
    if (Number(c.playerHealth) <= 0)
      errors.push('playerHealth must be greater than 0.');
    if (Number(c.maxCells) < Number(c.totalCellsCount))
      errors.push('maxCells must be greater than or equal to totalCellsCount.');
    if (Number(c.cancerDamageInterval) <= 0)
      errors.push('cancerDamageInterval must be greater than 0.');
    if (Number(c.maxAttackersPerCancer) < 1)
      errors.push('maxAttackersPerCancer must be at least 1.');

    const threshold = Number(c.playerHealthDangerThresholdPercent);
    if (threshold < 1 || threshold > 100)
      errors.push('Danger threshold percent must be between 1 and 100.');

    const distTotal = Object.values(c.distribution || {}).reduce(
      (s, v) => s + Number(v),
      0,
    );
    if (Math.abs(distTotal - 100) > 0.001) {
      errors.push(
        'Cell distribution percentage must equal 100. Current total: ' +
          distTotal,
      );
    }

    Object.entries(c.cancerHealth || {}).forEach(([key, value]) => {
      if (Number(value) <= 0)
        errors.push('Cancer health for ' + key + ' must be greater than 0.');
    });

    if (typeof c.allowCancerCellDragging !== 'boolean')
      errors.push('allowCancerCellDragging must be boolean.');
    if (typeof c.winOnAllCancerDestroyed !== 'boolean')
      errors.push('winOnAllCancerDestroyed must be boolean.');
    if (typeof c.cancerCellsCanAttackHealthy !== 'boolean')
      errors.push('cancerCellsCanAttackHealthy must be boolean.');
    ['VISIBLE_CANCER_CELL', 'HIDDEN_CANCER_CELL'].forEach((key) => {
      const v = Number(
        c.cancerAttackDamagePerSecond && c.cancerAttackDamagePerSecond[key],
      );
      if (Number.isNaN(v) || v < 0)
        errors.push(
          'cancerAttackDamagePerSecond.' + key + ' must be 0 or greater.',
        );
    });
    ['R_CELL', 'T_CELL', 'K_CELL'].forEach((key) => {
      const v = Number(c.healthyCellHealth && c.healthyCellHealth[key]);
      if (Number.isNaN(v) || v < 0)
        errors.push('healthyCellHealth.' + key + ' must be 0 or greater.');
    });

    Object.keys(DEFAULT_CELL_DEFS).forEach((key) => {
      const appearance = (c.cellAppearance && c.cellAppearance[key]) || {};
      if (
        Number.isNaN(Number(appearance.radius)) ||
        Number(appearance.radius) <= 0
      )
        errors.push(
          'cellAppearance.' + key + '.radius must be greater than 0.',
        );
      if (!isValidHexColorString(appearance.color))
        errors.push(
          'cellAppearance.' + key + '.color must be a hex color like #ff4d4d.',
        );
    });

    return { valid: errors.length === 0, errors };
  }

  static getExportPayload() {
    const presets = ConfigManager.clone(ConfigManager.presets);
    return {
      game: 'Cell Defense: Cancer Awareness',
      version: 2,
      exportedAt: new Date().toISOString(),
      presetOrder: ConfigManager.coreLevelIds,
      presets,
      currentConfig: ConfigManager.getCurrentConfig(),
    };
  }

  static normalizeConfig(c) {
    if (!c) return c;
    if (!c.totalPlayTime) c.totalPlayTime = c.totalSurvivalTime || 120;
    if (!c.totalSurvivalTime) c.totalSurvivalTime = c.totalPlayTime;
    if (typeof c.winOnAllCancerDestroyed !== 'boolean')
      c.winOnAllCancerDestroyed = true;
    // Caps how many healthy (T/K) cells can be attached to a single
    // cancer cell at once -- without this, auto-attachment lets a
    // player pile every idle T/K-cell onto one cancer cell (or drag the
    // cancer cell into a crowd) and shred/detect it instantly. Old saved
    // configs and imports won't have this field, so default it here.
    if (
      !Number.isFinite(Number(c.maxAttackersPerCancer)) ||
      Number(c.maxAttackersPerCancer) <= 0
    )
      c.maxAttackersPerCancer = 3;
    // Lets a cancer cell counter-attack the healthy cells attached to
    // it, splitting its total damage-per-second across all of them
    // (see CellManager.handleCancerCounterAttacks). Off by default so
    // existing levels are unaffected.
    if (typeof c.cancerCellsCanAttackHealthy !== 'boolean')
      c.cancerCellsCanAttackHealthy = false;
    if (!c.cancerAttackDamagePerSecond) c.cancerAttackDamagePerSecond = {};
    ['VISIBLE_CANCER_CELL', 'HIDDEN_CANCER_CELL'].forEach((key) => {
      const v = Number(c.cancerAttackDamagePerSecond[key]);
      c.cancerAttackDamagePerSecond[key] = Number.isFinite(v) && v >= 0 ? v : 0;
    });
    // Healthy cells are invulnerable (see getCellDef) unless given real
    // HP here -- only meaningful when cancerCellsCanAttackHealthy is on.
    if (!c.healthyCellHealth) c.healthyCellHealth = {};
    ['R_CELL', 'T_CELL', 'K_CELL'].forEach((key) => {
      const v = Number(c.healthyCellHealth[key]);
      c.healthyCellHealth[key] = Number.isFinite(v) && v >= 0 ? v : 0;
    });
    if (c.lifeTimes) {
      delete c.lifeTimes.VISIBLE_CANCER_CELL;
      delete c.lifeTimes.HIDDEN_CANCER_CELL;
    }
    if (!c.damagePerSecond)
      c.damagePerSecond = ConfigManager.clone(
        c.cellDamage || { T_CELL: 2, K_CELL: 1 },
      );
    if (!c.splitTimeRanges) c.splitTimeRanges = {};
    Object.keys(DEFAULT_CELL_DEFS).forEach((key) => {
      if (!c.splitTimeRanges[key]) {
        const split = Number(
          c.splitTimes && c.splitTimes[key]
            ? c.splitTimes[key]
            : DEFAULT_CELL_DEFS[key].splitTime,
        );
        c.splitTimeRanges[key] = { min: split, max: split };
      }
    });
    if (!c.cellAppearance) c.cellAppearance = {};
    Object.keys(DEFAULT_CELL_DEFS).forEach((key) => {
      const existing = c.cellAppearance[key] || {};
      const fallbackDef = DEFAULT_CELL_DEFS[key];
      c.cellAppearance[key] = {
        radius:
          Number(existing.radius) > 0
            ? Number(existing.radius)
            : fallbackDef.radius,
        color: isValidHexColorString(existing.color)
          ? existing.color
          : numberToHexString(fallbackDef.color),
      };
    });
    return c;
  }

  static extractImportedPresets(jsonData) {
    if (!jsonData || typeof jsonData !== 'object') return null;
    if (jsonData.presets && typeof jsonData.presets === 'object')
      return jsonData.presets;
    if (Array.isArray(jsonData.levels)) {
      const mapped = {};
      jsonData.levels
        .slice(0, ConfigManager.coreLevelIds.length)
        .forEach((level, index) => {
          mapped[ConfigManager.coreLevelIds[index]] = level;
        });
      return mapped;
    }
    if (ConfigManager.coreLevelIds.some((id) => jsonData[id])) {
      const mapped = {};
      ConfigManager.coreLevelIds.forEach((id) => {
        if (jsonData[id]) mapped[id] = jsonData[id];
      });
      return mapped;
    }
    return null;
  }

  static importLevelsFromJson(jsonData) {
    const importedPresets = ConfigManager.extractImportedPresets(jsonData);
    if (!importedPresets) {
      return {
        valid: false,
        errors: [
          'JSON must contain presets, levels, or level1/level2/level3 objects.',
        ],
      };
    }

    const requiredIds = ConfigManager.coreLevelIds;
    const errors = [];
    const nextPresets = {};

    requiredIds.forEach((id) => {
      if (!importedPresets[id]) {
        errors.push('Missing preset: ' + id);
        return;
      }
      const preset = ConfigManager.normalizeConfig(
        ConfigManager.clone(importedPresets[id]),
      );
      preset.id = id;
      preset.name = preset.name || id;
      preset.difficulty = preset.difficulty || 'Custom';
      const result = ConfigManager.validate(preset);
      if (!result.valid)
        errors.push(id + ' validation errors:\n' + result.errors.join('\n'));
      else nextPresets[id] = preset;
    });

    if (errors.length) return { valid: false, errors };

    // requiredIds only ever covers level1-5 -- tutorial isn't a
    // required/scored preset, but it must never simply vanish from
    // ConfigManager.presets (buildLevelBalanceTable, the Difficulty
    // Balancer, and the xlsx export all read presets.tutorial
    // unconditionally). Use an imported tutorial if the JSON provided
    // one, otherwise carry the existing tutorial preset forward so an
    // import can never silently delete it.
    if (importedPresets.tutorial) {
      try {
        const tutorialPreset = ConfigManager.normalizeConfig(
          ConfigManager.clone(importedPresets.tutorial),
        );
        tutorialPreset.id = 'tutorial';
        tutorialPreset.name =
          tutorialPreset.name || 'Tutorial: Immune Response';
        tutorialPreset.difficulty = tutorialPreset.difficulty || 'Tutorial';
        nextPresets.tutorial = tutorialPreset;
      } catch (e) {
        nextPresets.tutorial = ConfigManager.clone(
          ConfigManager.presets.tutorial,
        );
      }
    } else if (ConfigManager.presets.tutorial) {
      nextPresets.tutorial = ConfigManager.clone(
        ConfigManager.presets.tutorial,
      );
    }

    ConfigManager.presets = ConfigManager.clone(nextPresets);
    ConfigManager.currentConfig = ConfigManager.clone(
      ConfigManager.presets.level1,
    );
    return { valid: true, errors: [] };
  }
}

// ---------------------------------------------------------------------
// Level Balance / Difficulty Balancer / Difficulty Score: every number
// in all three flows below comes from ONE place --
// LEVEL_BALANCE_ROW_DEFS -- read live off ConfigManager.presets at the
// moment the user clicks a button. Nothing here is a pre-baked
// snapshot: the exported .xlsx and the interactive Difficulty Balancer
// are just two different views (a workbook vs. a live tool) generated
// from buildLevelBalanceTable() on demand. Weight, Direction, and
// Rationale are design judgments (not derived from the config itself),
// so they live in the row defs alongside the getter that reads each
// parameter's live value out of a normalized level config.
// ---------------------------------------------------------------------
function avgSplitTime(config, key) {
  const range = config.splitTimeRanges && config.splitTimeRanges[key];
  if (!range) return 0;
  return Math.round(((Number(range.min) + Number(range.max)) / 2) * 10) / 10;
}

const LEVEL_BALANCE_ROW_DEFS = [
  {
    label: 'Total Play Time (sec)',
    category: 'Core Settings',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 2,
    rationale:
      'Longer runs give cancer more time to split and chip away at player health; net effect is more cumulative pressure despite also giving the player more time to react.',
    get: (c) => Number(c.totalPlayTime || c.totalSurvivalTime),
  },
  {
    label: 'Player Max Health',
    category: 'Core Settings',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 5,
    rationale:
      'Bigger health pool is a bigger buffer against cancer damage ticks and counter-attacks.',
    get: (c) => Number(c.playerHealth),
  },
  {
    label: 'Danger Threshold (%)',
    category: 'Core Settings',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 4,
    rationale:
      'A higher danger threshold shrinks the safety margin before an INSTANT loss -- the game ends the moment health drops to or below this threshold, any time, not just at time-out.',
    get: (c) => Number(c.playerHealthDangerThresholdPercent),
  },
  {
    label: 'Max Cells (population cap)',
    category: 'Core Settings',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 3,
    rationale:
      'Raises the ceiling both sides can split up to, but in a 120s match this cap is rarely the binding constraint -- population growth is limited by split-time pacing long before it is limited by this cap.',
    get: (c) => Number(c.maxCells),
  },
  {
    label: 'Cancer Damage Interval (sec)',
    category: 'Core Settings',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 5,
    rationale:
      'Controls how often the passive health-drain tick fires, which is what actually triggers the instant danger-threshold loss -- a SMALLER value means MORE FREQUENT ticks, so difficulty moves opposite to the number.',
    get: (c) => Number(c.cancerDamageInterval),
  },
  {
    label: 'Max Attackers Per Cancer Cell',
    category: 'Core Settings',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 4,
    rationale:
      'Caps how many T/K-cells can pile onto one cancer cell at once. A SMALLER cap forces more spread-out, sequential attacks, so difficulty moves opposite to the number.',
    get: (c) => Number(c.maxAttackersPerCancer),
  },
  {
    label: 'Allow Cancer Cell Dragging',
    category: 'Core Settings',
    kind: 'bool',
    scorable: true,
    direction: 'Decreases',
    weight: 4,
    rationale:
      'When the player can drag cancer cells into a cluster of healthy cells, attachment is trivial. Disabled (Level 5) forces bringing attackers to a stationary target instead.',
    get: (c) => (c.allowCancerCellDragging ? 1 : 0),
  },
  {
    label: 'Cancer Cells Can Attack Healthy',
    category: 'Core Settings',
    kind: 'bool',
    scorable: true,
    direction: 'Increases',
    weight: 5,
    rationale:
      'A binary toggle that opens an entirely new attrition mechanic: attached healthy cells now take continuous damage back and can die mid-fight, fundamentally changing the risk of every attachment (Levels 4-5 only).',
    get: (c) => (c.cancerCellsCanAttackHealthy ? 1 : 0),
  },
  {
    label: 'Win If All Cancer Destroyed Early',
    category: 'Core Settings',
    kind: 'bool',
    scorable: false,
    direction: 'Structural',
    weight: 0,
    rationale:
      'A win-condition rule, not a difficulty lever -- identical across every non-tutorial level, so it contributes no variance to the score.',
    get: (c) => (c.winOnAllCancerDestroyed ? 1 : 0),
  },

  {
    label: 'R-Cell Share (%)',
    category: 'Cell Distribution (%)',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 1,
    rationale:
      'R-cells are inert filler with no attack. A bigger R-cell share crowds out the T/K attacker population at a fixed total cell count.',
    get: (c) => Number(c.distribution.R_CELL),
  },
  {
    label: 'T-Cell Share (%)',
    category: 'Cell Distribution (%)',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 4,
    rationale:
      'Directly sets how large the T-cell army is -- a linear multiplier on total offensive output against the Cancer Cell.',
    get: (c) => Number(c.distribution.T_CELL),
  },
  {
    label: 'K-Cell Share (%)',
    category: 'Cell Distribution (%)',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 4,
    rationale:
      'Directly sets how large the K-cell army is -- a linear multiplier on total offensive output against the Smart Cancer Cell.',
    get: (c) => Number(c.distribution.K_CELL),
  },
  {
    label: 'Cancer Cell Share (%)',
    category: 'Cell Distribution (%)',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 5,
    rationale:
      'Directly sets the size of the visible-cancer population -- a linear multiplier on total enemy HP that must be cleared.',
    get: (c) => Number(c.distribution.VISIBLE_CANCER_CELL),
  },
  {
    label: 'Smart Cancer Cell Share (%)',
    category: 'Cell Distribution (%)',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 5,
    rationale:
      'Directly sets the size of the hidden-cancer population -- a linear multiplier on total enemy HP, compounded by detection delay.',
    get: (c) => Number(c.distribution.HIDDEN_CANCER_CELL),
  },

  {
    label: 'T-Cell Click Damage',
    category: 'Player Damage Output',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 3,
    rationale: 'Higher manual-click damage clears the Cancer Cell faster.',
    get: (c) => Number(c.cellDamage.T_CELL),
  },
  {
    label: 'K-Cell Click Damage',
    category: 'Player Damage Output',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 3,
    rationale:
      'Higher manual-click damage clears the Smart Cancer Cell faster.',
    get: (c) => Number(c.cellDamage.K_CELL),
  },
  {
    label: 'T-Cell Auto DPS',
    category: 'Player Damage Output',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 5,
    rationale:
      "The player's primary continuous damage source once attached -- the single biggest lever on how fast the Cancer Cell side of the fight goes.",
    get: (c) => Number(c.damagePerSecond.T_CELL),
  },
  {
    label: 'K-Cell Auto DPS',
    category: 'Player Damage Output',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 5,
    rationale:
      "The player's primary continuous damage source once attached -- the single biggest lever on how fast the Smart Cancer Cell side of the fight goes.",
    get: (c) => Number(c.damagePerSecond.K_CELL),
  },

  {
    label: 'Cancer Cell Health',
    category: 'Cancer Cell Health',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 5,
    rationale:
      'The core enemy-toughness stat -- directly multiplies total damage that must be dealt per cell killed.',
    get: (c) => Number(c.cancerHealth.VISIBLE_CANCER_CELL),
  },
  {
    label: 'Smart Cancer Cell Health',
    category: 'Cancer Cell Health',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 5,
    rationale:
      'The core enemy-toughness stat for hidden cancer -- directly multiplies total damage required, on top of the detection delay already paid.',
    get: (c) => Number(c.cancerHealth.HIDDEN_CANCER_CELL),
  },

  {
    label: 'R-Cell Split Time (avg sec)',
    category: 'Split Time (avg of min/max, sec)',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 1,
    rationale:
      'Longer average split time means slower R-cell reinforcement -- but R-cells do not attack, so the effect is minor.',
    get: (c) => avgSplitTime(c, 'R_CELL'),
  },
  {
    label: 'T-Cell Split Time (avg sec)',
    category: 'Split Time (avg of min/max, sec)',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 3,
    rationale:
      'Longer average split time means slower arrival of new attackers.',
    get: (c) => avgSplitTime(c, 'T_CELL'),
  },
  {
    label: 'K-Cell Split Time (avg sec)',
    category: 'Split Time (avg of min/max, sec)',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 3,
    rationale:
      'Longer average split time means slower arrival of new attackers/detectors.',
    get: (c) => avgSplitTime(c, 'K_CELL'),
  },
  {
    label: 'Cancer Cell Split Time (avg sec)',
    category: 'Split Time (avg of min/max, sec)',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 5,
    rationale:
      'Controls how fast the cancer population REGROWS -- unlike a flat stat, this compounds over the match, making it the closest thing to an exponential difficulty lever in the whole system. Difficulty moves opposite to the number (faster splitting = smaller value = harder).',
    get: (c) => avgSplitTime(c, 'VISIBLE_CANCER_CELL'),
  },
  {
    label: 'Smart Cancer Cell Split Time (avg sec)',
    category: 'Split Time (avg of min/max, sec)',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 5,
    rationale:
      'Controls how fast the hidden-cancer population REGROWS -- the same compounding arms-race dynamic as visible cancer split time, difficulty moving opposite to the number.',
    get: (c) => avgSplitTime(c, 'HIDDEN_CANCER_CELL'),
  },

  {
    label: 'R-Cell Lifetime (sec)',
    category: 'Healthy Cell Lifetime (sec)',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 1,
    rationale:
      'Longer natural lifespan keeps the (inert) population count higher for longer; minor effect since R-cells do not attack.',
    get: (c) => Number(c.lifeTimes.R_CELL),
  },
  {
    label: 'T-Cell Lifetime (sec)',
    category: 'Healthy Cell Lifetime (sec)',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 2,
    rationale:
      'Natural lifespan of a T-cell before it ages out. At 76-100s against a 120s clock, most cells die in combat (or to counter-attack) long before they would naturally expire, so this is rarely the binding factor.',
    get: (c) => Number(c.lifeTimes.T_CELL),
  },
  {
    label: 'K-Cell Lifetime (sec)',
    category: 'Healthy Cell Lifetime (sec)',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 2,
    rationale:
      'Natural lifespan of a K-cell before it ages out. At 76-100s against a 120s clock, most cells die in combat (or to counter-attack) long before they would naturally expire, so this is rarely the binding factor.',
    get: (c) => Number(c.lifeTimes.K_CELL),
  },

  {
    label: 'Cancer Cell Impact (per damage tick)',
    category: 'Cancer Impact on Player Health',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 4,
    rationale:
      "Sets the MAGNITUDE of the passive health-drain per tick -- paired with Cancer Damage Interval's frequency, this is what actually pushes the player toward the instant danger-threshold loss.",
    get: (c) => Number(c.impacts.VISIBLE_CANCER_CELL),
  },
  {
    label: 'Smart Cancer Cell Impact (per damage tick)',
    category: 'Cancer Impact on Player Health',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 5,
    rationale:
      'Sets the MAGNITUDE of the passive health-drain per tick for hidden cancer -- often accruing silently before detection, compounding the danger-threshold pressure.',
    get: (c) => Number(c.impacts.HIDDEN_CANCER_CELL),
  },

  {
    label: 'Cancer Attack DPS -- Cancer Cell (total, split)',
    category: 'Counter-Attack (Advanced Levels)',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 4,
    rationale:
      'Total damage per second a Cancer Cell deals back, divided evenly across every healthy cell attached to it. Zero where the mechanic is off.',
    get: (c) =>
      Number(
        (c.cancerAttackDamagePerSecond &&
          c.cancerAttackDamagePerSecond.VISIBLE_CANCER_CELL) ||
          0,
      ),
  },
  {
    label: 'Cancer Attack DPS -- Smart Cancer Cell (total, split)',
    category: 'Counter-Attack (Advanced Levels)',
    kind: 'num',
    scorable: true,
    direction: 'Increases',
    weight: 5,
    rationale:
      'Total damage per second a Smart Cancer Cell deals back, divided evenly across every healthy cell attached to it. Zero where the mechanic is off.',
    get: (c) =>
      Number(
        (c.cancerAttackDamagePerSecond &&
          c.cancerAttackDamagePerSecond.HIDDEN_CANCER_CELL) ||
          0,
      ),
  },
  {
    label: 'Healthy Cell HP -- R-Cell (counter-attack)',
    category: 'Counter-Attack (Advanced Levels)',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 1,
    rationale:
      'How much punishment an R-cell can absorb from counter-attack before dying. Zero (invulnerable) where the mechanic is off.',
    get: (c) =>
      Number((c.healthyCellHealth && c.healthyCellHealth.R_CELL) || 0),
  },
  {
    label: 'Healthy Cell HP -- T-Cell (counter-attack)',
    category: 'Counter-Attack (Advanced Levels)',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 3,
    rationale:
      'How much punishment a T-cell can absorb from counter-attack before dying. Zero (invulnerable) where the mechanic is off.',
    get: (c) =>
      Number((c.healthyCellHealth && c.healthyCellHealth.T_CELL) || 0),
  },
  {
    label: 'Healthy Cell HP -- K-Cell (counter-attack)',
    category: 'Counter-Attack (Advanced Levels)',
    kind: 'num',
    scorable: true,
    direction: 'Decreases',
    weight: 3,
    rationale:
      'How much punishment a K-cell can absorb from counter-attack before dying. Zero (invulnerable) where the mechanic is off.',
    get: (c) =>
      Number((c.healthyCellHealth && c.healthyCellHealth.K_CELL) || 0),
  },
];
// Same slider-range heuristic used by the Difficulty Balancer's own
// upload parser, kept in sync so a value uploaded back in gets the
// same slider bounds it would have gotten fresh from the game.
function computeDifficultyParamRange(row, values) {
  if (row.kind === 'bool') return { min: 0, max: 1, step: 1 };
  if (row.label.indexOf('(%)') !== -1) return { min: 0, max: 100, step: 1 };
  const dMin = Math.min(...values);
  const dMax = Math.max(...values);
  const isInt = values.every((v) => Number.isInteger(v));
  const step = isInt ? 1 : 0.1;
  let sMin = dMin <= 5 ? 0 : Math.floor((dMin * 0.4) / step) * step;
  let sMax = Math.ceil((dMax * 1.8) / step) * step;
  if (sMax <= sMin) sMax = sMin + (isInt ? 10 : 1);
  return {
    min: Math.round(sMin * 100) / 100,
    max: Math.round(sMax * 100) / 100,
    step,
  };
}

// Single source of truth for both the exported workbook and the
// interactive balancer: reads every row def's live value out of
// Tutorial + Level 1-5's CURRENT presets (normalized, so missing
// fields on older/legacy presets still resolve to their real
// defaults). Nothing here is cached between calls -- every click of
// either the Download or Open Balancer button re-reads
// ConfigManager.presets from scratch.
function buildLevelBalanceTable() {
  const levelIds = ['tutorial'].concat(ConfigManager.coreLevelIds);
  const levelLabels = [
    'Tutorial',
    'Level 1',
    'Level 2',
    'Level 3',
    'Level 4',
    'Level 5',
  ];
  const configs = levelIds.map((id) => {
    // Defensive fallback: level1 is always guaranteed to exist (it's
    // one of the required core levels), so if a preset is ever
    // unexpectedly missing -- e.g. tutorial, which importLevelsFromJson
    // doesn't require -- fall back to it rather than crashing on
    // ConfigManager.clone(undefined).
    const preset = ConfigManager.presets[id] || ConfigManager.presets.level1;
    return ConfigManager.normalizeConfig(ConfigManager.clone(preset));
  });
  const rows = LEVEL_BALANCE_ROW_DEFS.map((def) => ({
    label: def.label,
    category: def.category,
    kind: def.kind,
    scorable: def.scorable,
    direction: def.direction,
    weight: def.weight,
    rationale: def.rationale,
    values: configs.map((c) => def.get(c)),
  }));
  return { levelLabels, rows };
}

// The Difficulty Balancer only scores Level 1-5 (Tutorial is
// intentionally trivial/extreme and would dominate any min-max
// normalization), and only the rows marked scorable -- matches the
// exported workbook's Difficulty Weighting / Difficulty Score sheets.
function buildDifficultyBalancerData() {
  const table = buildLevelBalanceTable();
  return table.rows
    .filter((r) => r.scorable)
    .map((r) => {
      const values = r.values.slice(1); // drop Tutorial, keep Level 1-5
      const range = computeDifficultyParamRange(r, values);
      return {
        label: r.label,
        category: r.category,
        kind: r.kind,
        direction: r.direction,
        weight: r.weight,
        values,
        min: range.min,
        max: range.max,
        step: range.step,
      };
    });
}

// ExcelJS (not SheetJS) is used here specifically because SheetJS's
// free/community build can write DATA and number formats but cannot
// reliably write cell styling (fonts, fills, borders, colors) --
// that's a Pro-only feature there. ExcelJS supports full style writing
// for free, client-side, which is what lets this exported workbook
// visually match the reference Level Balance.xlsx (navy header bars,
// gray italic category text, red/green direction text, the yellow
// Difficulty Index highlight, etc.) instead of being a plain data
// dump. Fetched from a CDN on first use, not loaded unconditionally on
// every game load.
let excelJsLoadPromise = null;
function ensureExcelJsLoaded() {
  if (window.ExcelJS) return Promise.resolve();
  if (excelJsLoadPromise) return excelJsLoadPromise;
  excelJsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src =
      'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
    script.onload = () => resolve();
    script.onerror = () => {
      excelJsLoadPromise = null;
      reject(new Error(STRINGS.configurator.xlsxLoadFailed));
    };
    document.head.appendChild(script);
  });
  return excelJsLoadPromise;
}

// 1-based column number -> "A"/"B".../"AA" etc, since ExcelJS (unlike
// SheetJS) doesn't ship its own column-letter helper.
function excelColLetter(n) {
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Builds the same 3-sheet workbook structure as the original exported
// Level Balance.xlsx (Level Balance / Difficulty Weighting /
// Difficulty Score, the last one formula-driven with INDEX/MATCH/
// MIN/MAX cross-sheet lookups), generated client-side, live, from
// whatever is currently configured -- so it can never drift out of
// sync with the game the way a one-off exported snapshot can. Styling
// (colors, fonts, borders, fills) mirrors the original reference
// workbook exactly.
async function exportLevelBalanceXlsx() {
  try {
    await ensureExcelJsLoaded();
  } catch (err) {
    window.alert(err.message);
    return;
  }

  const NAVY = 'FF0F2745';
  const WHITE = 'FFFFFFFF';
  const GRAY_TEXT = 'FF6B7280';
  const STRUCTURAL_FILL = 'FFF3F4F6';
  const BORDER_COLOR = 'FFD1D5DB';
  const RED = 'FFB91C1C';
  const GREEN = 'FF15803D';
  const YELLOW_FILL = 'FFFEF3C7';
  const thinBorder = {
    top: { style: 'thin', color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
    left: { style: 'thin', color: { argb: BORDER_COLOR } },
    right: { style: 'thin', color: { argb: BORDER_COLOR } },
  };
  const headerFont = {
    name: 'Arial',
    size: 11,
    bold: true,
    color: { argb: WHITE },
  };
  const headerFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: NAVY },
  };
  const styleHeaderCell = (cell) => {
    cell.font = headerFont;
    cell.fill = headerFill;
    cell.alignment = {
      horizontal: 'center',
      vertical: 'middle',
      wrapText: true,
    };
    cell.border = thinBorder;
  };
  const noteFont = {
    name: 'Arial',
    size: 10,
    italic: true,
    color: { argb: GRAY_TEXT },
  };
  const noteAlignment = { wrapText: true, vertical: 'top' };

  const table = buildLevelBalanceTable();
  const scorableRows = table.rows.filter((r) => r.scorable);

  const wb = new ExcelJS.Workbook();

  // ---------------- Sheet 1: Level Balance ----------------
  const lbSheet = wb.addWorksheet('Level Balance', {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }],
  });
  lbSheet.columns = [{ width: 40 }, { width: 26 }].concat(
    table.levelLabels.map(() => ({ width: 13 })),
  );
  const lbHeaderRow = lbSheet.addRow(
    ['Parameter', 'Category'].concat(table.levelLabels),
  );
  lbHeaderRow.height = 22;
  lbHeaderRow.eachCell(styleHeaderCell);

  table.rows.forEach((r) => {
    const row = lbSheet.addRow([r.label, r.category].concat(r.values));
    row.getCell(1).font = r.scorable
      ? { name: 'Arial', size: 11 }
      : { name: 'Arial', size: 11, italic: true, color: { argb: GRAY_TEXT } };
    row.getCell(2).font = {
      name: 'Arial',
      size: 10,
      italic: true,
      color: { argb: GRAY_TEXT },
    };
    for (let col = 1; col <= 2 + table.levelLabels.length; col++) {
      row.getCell(col).border = thinBorder;
    }
    for (let lvl = 0; lvl < table.levelLabels.length; lvl++) {
      const cell = row.getCell(3 + lvl);
      cell.font = cell.font || { name: 'Arial', size: 11 };
      cell.alignment = { horizontal: 'center' };
      if (r.kind === 'bool') cell.numFmt = '[=1]"Yes";[=0]"No";General';
      else if (!Number.isInteger(r.values[lvl])) cell.numFmt = '0.0';
      if (!r.scorable)
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: STRUCTURAL_FILL },
        };
    }
  });
  lbSheet.addRow([]);
  const lbNoteRow = lbSheet.addRow([
    'Note: rows shaded gray are structural/won\u2019t vary with difficulty (e.g. a win-condition ' +
      'rule that is identical across levels) and are excluded from the Difficulty Weighting and ' +
      'Difficulty Score sheets. Tutorial values are intentionally extreme/trivial (e.g. 999s cooldowns) ' +
      'and are excluded from the min/max normalization used to compute the Difficulty Score.',
  ]);
  lbSheet.mergeCells(
    lbNoteRow.number,
    1,
    lbNoteRow.number,
    2 + table.levelLabels.length,
  );
  lbNoteRow.height = 30;
  lbNoteRow.getCell(1).font = noteFont;
  lbNoteRow.getCell(1).alignment = noteAlignment;

  // ---------------- Sheet 2: Difficulty Weighting ----------------
  const dwSheet = wb.addWorksheet('Difficulty Weighting', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  dwSheet.columns = [
    { width: 42 },
    { width: 24 },
    { width: 16 },
    { width: 10 },
    { width: 70 },
  ];
  const dwHeaderRow = dwSheet.addRow([
    'Parameter',
    'Category',
    'Effect As Value Increases',
    'Weight (1-5)',
    'Rationale',
  ]);
  dwHeaderRow.height = 30;
  dwHeaderRow.eachCell(styleHeaderCell);

  scorableRows.forEach((r) => {
    const row = dwSheet.addRow([
      r.label,
      r.category,
      r.direction,
      r.weight,
      r.rationale,
    ]);
    row.getCell(1).font = { name: 'Arial', size: 11 };
    row.getCell(2).font = {
      name: 'Arial',
      size: 10,
      italic: true,
      color: { argb: GRAY_TEXT },
    };
    const dirCell = row.getCell(3);
    dirCell.font = {
      name: 'Arial',
      size: 11,
      bold: true,
      color: { argb: r.direction === 'Increases' ? RED : GREEN },
    };
    dirCell.alignment = { horizontal: 'center' };
    const weightCell = row.getCell(4);
    weightCell.font = { name: 'Arial', size: 11, bold: true };
    weightCell.alignment = { horizontal: 'center' };
    const ratCell = row.getCell(5);
    ratCell.font = { name: 'Arial', size: 11 };
    ratCell.alignment = { wrapText: true, vertical: 'top' };
    for (let col = 1; col <= 5; col++) row.getCell(col).border = thinBorder;
  });
  dwSheet.addRow([]);
  const dwLegendRow = dwSheet.addRow([
    'Weight is a 1-5 design judgment (5 = swings outcomes the most), not derived from ' +
      'gameplay telemetry. "Effect As Value Increases" states which way difficulty moves as the ' +
      'raw number goes up -- for a couple of parameters (Cancer Damage Interval, Max Attackers ' +
      'Per Cancer Cell, split times on cancer cells) that direction is intentionally inverted; see ' +
      'each row\u2019s rationale.',
  ]);
  dwSheet.mergeCells(dwLegendRow.number, 1, dwLegendRow.number, 5);
  dwLegendRow.height = 44;
  dwLegendRow.getCell(1).font = noteFont;
  dwLegendRow.getCell(1).alignment = noteAlignment;

  // ---------------- Sheet 3: Difficulty Score (formula-driven) ----------------
  const dsSheet = wb.addWorksheet('Difficulty Score', {
    views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }],
  });
  dsSheet.columns = [
    { width: 42 },
    { width: 8 },
    { width: 8 },
    { width: 8 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
    { width: 11 },
  ];
  const dsHeaderRow = dsSheet.addRow([
    'Parameter',
    'LB Row',
    'Weight',
    'Sign',
    'Min (L1-L5)',
    'Max (L1-L5)',
    'Level 1',
    'Level 2',
    'Level 3',
    'Level 4',
    'Level 5',
  ]);
  dsHeaderRow.height = 26;
  dsHeaderRow.eachCell(styleHeaderCell);

  scorableRows.forEach((r, i) => {
    const rowNum = i + 2; // 1-based Excel row (row 1 is the header)
    const row = dsSheet.addRow([r.label]);
    row.getCell(2).value = {
      formula: 'MATCH($A' + rowNum + ",'Level Balance'!$A:$A,0)",
    };
    row.getCell(3).value = {
      formula:
        "INDEX('Difficulty Weighting'!$D:$D,MATCH($A" +
        rowNum +
        ",'Difficulty Weighting'!$A:$A,0))",
    };
    row.getCell(4).value = {
      formula:
        "IF(INDEX('Difficulty Weighting'!$C:$C,MATCH($A" +
        rowNum +
        ',\'Difficulty Weighting\'!$A:$A,0))="Increases",1,' +
        "IF(INDEX('Difficulty Weighting'!$C:$C,MATCH($A" +
        rowNum +
        ',\'Difficulty Weighting\'!$A:$A,0))="Decreases",-1,0))',
    };
    row.getCell(5).value = {
      formula:
        "MIN(INDEX('Level Balance'!$D:$H,$B" +
        rowNum +
        ",1):INDEX('Level Balance'!$D:$H,$B" +
        rowNum +
        ',5))',
    };
    row.getCell(6).value = {
      formula:
        "MAX(INDEX('Level Balance'!$D:$H,$B" +
        rowNum +
        ",1):INDEX('Level Balance'!$D:$H,$B" +
        rowNum +
        ',5))',
    };
    for (let lvl = 0; lvl < 5; lvl++) {
      const col = 7 + lvl;
      const raw =
        "INDEX('Level Balance'!$D:$H,$B" + rowNum + ',' + (lvl + 1) + ')';
      const norm =
        'IFERROR((' +
        raw +
        '-$E' +
        rowNum +
        ')/($F' +
        rowNum +
        '-$E' +
        rowNum +
        '),0)';
      row.getCell(col).value = {
        formula: 'ROUND(' + norm + '*$C' + rowNum + '*$D' + rowNum + ',4)',
      };
    }
    for (let col = 1; col <= 11; col++) {
      const cell = row.getCell(col);
      cell.font = { name: 'Arial', size: 11 };
      cell.border = thinBorder;
      if (col >= 2) cell.alignment = { horizontal: 'center' };
    }
  });

  const lastParamRow = scorableRows.length + 1;
  const totalRow = lastParamRow + 1;
  const totalRowObj = dsSheet.addRow(['TOTAL WEIGHTED SCORE']);
  const doubleTopBorder = Object.assign({}, thinBorder, {
    top: { style: 'double', color: { argb: 'FF000000' } },
  });
  totalRowObj.getCell(1).font = { name: 'Arial', size: 11, bold: true };
  totalRowObj.getCell(1).border = doubleTopBorder;
  for (let col = 2; col <= 6; col++)
    totalRowObj.getCell(col).border = thinBorder;
  for (let lvl = 0; lvl < 5; lvl++) {
    const col = 7 + lvl;
    const cl = excelColLetter(col);
    const cell = totalRowObj.getCell(col);
    cell.value = { formula: 'SUM(' + cl + '2:' + cl + lastParamRow + ')' };
    cell.font = { name: 'Arial', size: 11, bold: true };
    cell.numFmt = '0.00';
    cell.alignment = { horizontal: 'center' };
    cell.border = doubleTopBorder;
  }

  const indexRow = totalRow + 1;
  const indexRowObj = dsSheet.addRow(['DIFFICULTY INDEX (0-100)']);
  indexRowObj.getCell(1).font = { name: 'Arial', size: 11, bold: true };
  indexRowObj.getCell(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: YELLOW_FILL },
  };
  for (let col = 2; col <= 6; col++)
    indexRowObj.getCell(col).border = thinBorder;
  const totalRangeStr = 'G' + totalRow + ':K' + totalRow;
  for (let lvl = 0; lvl < 5; lvl++) {
    const col = 7 + lvl;
    const cl = excelColLetter(col);
    const cell = indexRowObj.getCell(col);
    cell.value = {
      formula:
        'ROUND((' +
        cl +
        totalRow +
        '-MIN(' +
        totalRangeStr +
        '))/' +
        '(MAX(' +
        totalRangeStr +
        ')-MIN(' +
        totalRangeStr +
        '))*100,1)',
    };
    cell.font = { name: 'Arial', size: 12, bold: true, color: { argb: RED } };
    cell.numFmt = '0.0';
    cell.alignment = { horizontal: 'center' };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: YELLOW_FILL },
    };
    cell.border = thinBorder;
  }

  dsSheet.addRow([]);
  const dsExplainRow = dsSheet.addRow([
    'How this is computed: each parameter\u2019s Level 1-5 values are min-max normalized to 0-1 ' +
      '(Tutorial excluded), multiplied by its Weight and by +1/-1 depending on whether it Increases ' +
      'or Decreases difficulty (from the Difficulty Weighting sheet), then summed per level into a ' +
      'TOTAL WEIGHTED SCORE. The DIFFICULTY INDEX rescales that total to 0-100 across Level 1-5 so ' +
      'the hardest of the five reads 100 and the easiest reads 0 -- it is a relative ranking of ' +
      'these five levels against each other, not an absolute difficulty unit. All cells above are ' +
      'live formulas: editing any value on the Level Balance sheet, or any Weight/Direction on the ' +
      'Difficulty Weighting sheet, recalculates this entire sheet.',
  ]);
  dsSheet.mergeCells(dsExplainRow.number, 1, dsExplainRow.number, 11);
  dsExplainRow.height = 60;
  dsExplainRow.getCell(1).font = noteFont;
  dsExplainRow.getCell(1).alignment = noteAlignment;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = 'level-balance-' + stamp + '.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

// The Difficulty Balancer's full HTML/CSS/JS, self-contained (no
// external requests unless its own Upload button is used) so it works
// in the new window with no server. __DATA_JSON__ is replaced with the
// live dataset from buildDifficultyBalancerData() just before opening.
const BALANCER_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Level Difficulty Balancer</title>
<style>
  :root {
    --bg: #07111f;
    --panel: #0f2745;
    --panel-alt: #123059;
    --stroke: #67e8f9;
    --stroke-dim: rgba(103,232,249,0.35);
    --text: #e2e8f0;
    --text-dim: #94a3b8;
    --green: #22c55e;
    --yellow: #facc15;
    --danger: #ef4444;
    --cancer: #ff4d4d;
    --smart: #f87171;
    --mono: ui-monospace, "SF Mono", "Cascadia Code", "Roboto Mono", Menlo, monospace;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: radial-gradient(ellipse at top, #0c1c33 0%, var(--bg) 60%);
    color: var(--text); font-family: Arial, Helvetica, sans-serif;
    min-height: 100vh;
  }
  .wrap { max-width: 1280px; margin: 0 auto; padding: 28px 24px 60px; }

  header { margin-bottom: 22px; }
  header .eyebrow {
    font-family: var(--mono); font-size: 11px; letter-spacing: 0.18em; color: var(--stroke);
    text-transform: uppercase; margin-bottom: 6px;
  }
  header h1 { margin: 0 0 6px; font-size: 28px; letter-spacing: -0.01em; }
  header p { margin: 0; color: var(--text-dim); font-size: 14px; max-width: 780px; line-height: 1.5; }

  .toolbar { display: flex; gap: 10px; margin-top: 16px; flex-wrap: wrap; }
  button {
    font-family: Arial, sans-serif; font-size: 13px; font-weight: bold; cursor: pointer;
    border-radius: 8px; padding: 9px 16px; border: 1px solid var(--stroke-dim);
    background: var(--panel); color: var(--text); transition: background 120ms ease, transform 80ms ease;
  }
  button:hover { background: var(--panel-alt); }
  button:active { transform: scale(0.97); }
  button.primary { background: var(--stroke); color: #052e2e; border-color: var(--stroke); }
  button.primary:hover { background: #8ff0ff; }
  .upload-status {
    margin-top: 10px; font-family: var(--mono); font-size: 12px; min-height: 16px;
  }
  .upload-status.ok { color: #86efac; }
  .upload-status.err { color: #fca5a5; }
  .upload-status.busy { color: var(--stroke); }

  /* ---- Dashboard: the signature element, styled like the game's own
     health-bar / heart-monitor readouts for visual continuity ---- */
  .dashboard {
    display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px;
    margin: 26px 0 30px;
  }
  .gauge-card {
    background: var(--panel); border: 1px solid var(--stroke-dim); border-radius: 14px;
    padding: 14px 12px 16px; display: flex; flex-direction: column; align-items: center;
    box-shadow: 0 10px 24px rgba(0,0,0,0.35);
  }
  .gauge-card .lvl-name { font-size: 13px; font-weight: bold; color: var(--text); margin-bottom: 10px; }
  .gauge-track {
    width: 34px; height: 160px; border-radius: 17px; background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.12); position: relative; overflow: hidden;
    box-shadow: inset 0 2px 6px rgba(0,0,0,0.5);
  }
  .gauge-fill {
    position: absolute; bottom: 0; left: 0; right: 0; border-radius: 0 0 17px 17px;
    transition: height 220ms ease, background 220ms ease; height: 0%;
  }
  .gauge-readout {
    margin-top: 10px; font-family: var(--mono); font-size: 20px; font-weight: bold;
    color: var(--stroke); text-shadow: 0 0 10px rgba(103,232,249,0.55);
    background: #05131f; border: 1px solid var(--stroke-dim); border-radius: 6px;
    padding: 3px 10px; min-width: 54px; text-align: center;
  }
  .gauge-sub { margin-top: 6px; font-size: 10px; color: var(--text-dim); text-align: center; line-height: 1.4; }
  .gauge-sub b { color: var(--text); font-family: var(--mono); }

  /* ---- Parameter grid ---- */
  .grid-panel {
    background: var(--panel); border: 1px solid var(--stroke-dim); border-radius: 14px;
    overflow: hidden;
  }
  .grid-scroll { max-height: 640px; overflow-y: auto; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  thead th {
    position: sticky; top: 0; background: #0a1d38; color: var(--stroke);
    font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.06em;
    padding: 10px 8px; border-bottom: 1px solid var(--stroke-dim); text-align: center; z-index: 2;
  }
  thead th.param-col { text-align: left; }
  tbody tr.category-row td {
    background: #0d2340; color: var(--stroke); font-weight: bold; font-size: 11.5px;
    padding: 7px 10px; letter-spacing: 0.03em; border-top: 1px solid var(--stroke-dim);
    border-bottom: 1px solid var(--stroke-dim);
  }
  tbody tr.param-row td {
    padding: 7px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); vertical-align: middle;
  }
  tbody tr.param-row:hover td { background: rgba(255,255,255,0.03); }
  .param-label { color: var(--text); }
  .param-label .dir-tag {
    display: inline-block; margin-left: 6px; font-family: var(--mono); font-size: 9px;
    padding: 1px 5px; border-radius: 4px; vertical-align: middle;
  }
  .dir-tag.inc { background: rgba(239,68,68,0.18); color: #fca5a5; }
  .dir-tag.dec { background: rgba(34,197,94,0.18); color: #86efac; }

  select.dir-select, input.weight-input {
    background: #05131f; color: var(--text); border: 1px solid var(--stroke-dim);
    border-radius: 5px; font-family: var(--mono); font-size: 11.5px; padding: 3px 4px;
  }
  input.weight-input { width: 38px; text-align: center; }
  select.dir-select { width: 84px; }

  .cell-control { display: flex; flex-direction: column; align-items: center; gap: 2px; min-width: 74px; }
  .cell-control input[type=range] {
    width: 66px; accent-color: var(--stroke); height: 14px; cursor: pointer;
  }
  .cell-control input[type=range]:disabled { cursor: not-allowed; opacity: 0.45; }
  .cell-control .val-badge {
    font-family: var(--mono); font-size: 10.5px; color: var(--text); background: rgba(255,255,255,0.06);
    border-radius: 4px; padding: 1px 6px; min-width: 34px; text-align: center;
  }
  .toggle-switch {
    position: relative; width: 40px; height: 20px; border-radius: 10px; background: rgba(255,255,255,0.12);
    cursor: pointer; border: 1px solid var(--stroke-dim);
  }
  .toggle-switch .knob {
    position: absolute; top: 1px; left: 1px; width: 16px; height: 16px; border-radius: 50%;
    background: var(--text-dim); transition: left 140ms ease, background 140ms ease;
  }
  .toggle-switch.on { background: rgba(34,197,94,0.25); }
  .toggle-switch.on .knob { left: 19px; background: var(--green); }
  .toggle-switch.locked { cursor: not-allowed; opacity: 0.45; }
  .equal-checkbox-wrap { display: flex; justify-content: center; align-items: center; }
  .equal-checkbox { width: 16px; height: 16px; accent-color: var(--stroke); cursor: pointer; }

  .dist-sum-row td { background: #0a1220; border-top: 1px solid var(--stroke-dim); border-bottom: 1px solid var(--stroke-dim); padding: 7px 8px; }
  .dist-sum-row .dist-sum-label { font-size: 11.5px; font-weight: bold; color: var(--text-dim); text-align: right; padding-right: 10px; }
  .dist-sum-badge {
    display: inline-block; font-family: var(--mono); font-size: 11.5px; font-weight: bold;
    padding: 2px 8px; border-radius: 5px;
  }
  .dist-sum-badge.ok { color: #86efac; background: rgba(34,197,94,0.14); }
  .dist-sum-badge.warn { color: #fca5a5; background: rgba(239,68,68,0.16); }

  .warning-banner {
    display: none; margin-top: 14px; padding: 10px 14px; border-radius: 10px;
    background: rgba(239,68,68,0.14); border: 1px solid rgba(239,68,68,0.4);
    color: #fca5a5; font-size: 13px; font-weight: bold;
  }
  .warning-banner.show { display: block; }

  footer { margin-top: 22px; font-size: 11.5px; color: var(--text-dim); line-height: 1.6; }
  footer b { color: var(--text); }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="eyebrow">Cell Defense &middot; Design Instrument</div>
    <h1>Level Difficulty Balancer</h1>
    <p>Drag any value below and every level's Difficulty Index recalculates instantly, using the exact same
      min-max-normalize &times; weight &times; direction method as the exported Level Balance workbook.
      Adjust a Weight or flip a Direction to test a different balancing philosophy across all five levels at once.
      Opened from the game, this already reflects the live configured levels; opened on its own, upload a
      Level Balance .xlsx (from the Configurator's Download button) to load real data instead of the demo below.</p>
    <div class="toolbar">
      <button class="primary" id="resetBtn">Reset to Loaded Data</button>
      <button id="exportPresetsBtn">Export cell-defense-level-presets.json</button>
      <button id="uploadBtn">Upload Level Balance (.xlsx)</button>
      <input type="file" id="uploadInput" accept=".xlsx" style="display:none;" />
    </div>
    <div id="uploadStatus" class="upload-status"></div>
    <div id="distWarningBanner" class="warning-banner"></div>
  </header>

  <div class="dashboard" id="dashboard"></div>

  <div class="grid-panel">
    <div class="grid-scroll">
      <table>
        <thead>
          <tr>
            <th class="param-col">Parameter</th>
            <th>Weight</th>
            <th>Direction</th>
            <th>Equal</th>
            <th>Level 1</th>
            <th>Level 2</th>
            <th>Level 3</th>
            <th>Level 4</th>
            <th>Level 5</th>
          </tr>
        </thead>
        <tbody id="tbody"></tbody>
      </table>
    </div>
  </div>

  <footer>
    <b>How the Difficulty Index is computed:</b> for each parameter, its five current level values are
    min-max normalized to 0&ndash;1, multiplied by that parameter's Weight and by +1 (Direction: Increases) or
    &minus;1 (Direction: Decreases), then summed per level into a Total Weighted Score. Each level's score is
    then rescaled to 0&ndash;100 across the current five levels &mdash; so this is a relative ranking of these
    five levels against each other, not an absolute difficulty unit. All values here start from the game's
    real level presets; nothing you change here edits the game itself &mdash; use Export to copy your tuned
    numbers back into the Configurator.
  </footer>
</div>

<script>
// Fallback demo dataset -- only used if this file is opened directly
// (e.g. double-clicked) without live data. When opened via the game's
// "Open Difficulty Balancer" button, or after uploading an exported
// Level Balance .xlsx below, this is replaced entirely.
let ORIGINAL_DATA = __DATA_JSON__;
const LEVEL_LABELS = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5'];
const LEVEL_IDS = ['level1', 'level2', 'level3', 'level4', 'level5'];

// Full normalized configs (Tutorial + Level 1-5), only present when
// this page was opened via the game's "Open Difficulty Balancer"
// button -- needed to reconstruct a complete, game-importable preset
// on export, since the 34 rows above only cover the values a slider
// can touch (not id/name/appearance/etc). Null in the standalone demo.
let BASE_CONFIGS = __BASE_CONFIGS_JSON__;

let data = ORIGINAL_DATA.map(r => ({ ...r, values: [...r.values] }));

function gaugeColor(score) {
  if (score <= 35) return '#22c55e';
  if (score <= 65) return '#facc15';
  return '#ef4444';
}

function computeDifficulty() {
  const totals = [0, 0, 0, 0, 0];
  data.forEach(row => {
    const vals = row.values;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const sign = row.direction === 'Increases' ? 1 : -1;
    vals.forEach((v, i) => {
      const norm = max === min ? 0 : (v - min) / (max - min);
      totals[i] += norm * row.weight * sign;
    });
  });
  const tMin = Math.min(...totals);
  const tMax = Math.max(...totals);
  const index = totals.map(t => (tMax === tMin ? 50 : ((t - tMin) / (tMax - tMin)) * 100));
  return { totals, index };
}

function renderDashboard() {
  const { totals, index } = computeDifficulty();
  const dash = document.getElementById('dashboard');
  dash.innerHTML = '';
  LEVEL_LABELS.forEach((label, i) => {
    const score = index[i];
    const color = gaugeColor(score);
    const card = document.createElement('div');
    card.className = 'gauge-card';
    card.innerHTML =
      '<div class="lvl-name">' + label + '</div>' +
      '<div class="gauge-track">' +
        '<div class="gauge-fill" style="height:' + score + '%; background:linear-gradient(180deg, ' + color + ', ' + color + 'cc);"></div>' +
      '</div>' +
      '<div class="gauge-readout" style="color:' + color + '; text-shadow:0 0 10px ' + color + '88;">' + score.toFixed(1) + '</div>' +
      '<div class="gauge-sub">Difficulty Index<br/>Total score: <b>' + totals[i].toFixed(2) + '</b></div>';
    dash.appendChild(card);
  });
  updateDistributionSums();
}

// The 5 Cell Distribution (%) rows must sum to 100 for each level --
// same rule the game's own ConfigManager.validate() enforces. This is
// checked live (every renderDashboard() call, i.e. on every slider
// drag) rather than only on export, so a bad edit is flagged the
// moment it happens.
const DISTRIBUTION_LABELS = [
  'R-Cell Share (%)', 'T-Cell Share (%)', 'K-Cell Share (%)',
  'Cancer Cell Share (%)', 'Smart Cancer Cell Share (%)',
];
let distSumBadges = [];

function updateDistributionSums() {
  const rowsByLabel = {};
  data.forEach((r) => { if (DISTRIBUTION_LABELS.indexOf(r.label) !== -1) rowsByLabel[r.label] = r; });
  const sums = [0, 0, 0, 0, 0];
  const offenders = [];
  for (let lvl = 0; lvl < 5; lvl++) {
    let sum = 0;
    DISTRIBUTION_LABELS.forEach((label) => {
      if (rowsByLabel[label]) sum += rowsByLabel[label].values[lvl];
    });
    sums[lvl] = sum;
    const ok = Math.abs(sum - 100) < 0.05;
    if (!ok) offenders.push(LEVEL_LABELS[lvl] + ' (' + sum.toFixed(0) + '%)');
    if (distSumBadges[lvl]) {
      distSumBadges[lvl].textContent = sum.toFixed(0) + '%' + (ok ? ' \u2713' : ' \u26A0');
      distSumBadges[lvl].className = 'dist-sum-badge' + (ok ? ' ok' : ' warn');
    }
  }
  const banner = document.getElementById('distWarningBanner');
  if (banner) {
    if (offenders.length) {
      banner.textContent = '\u26A0 Cell Distribution % must sum to 100 for every level. Off for: ' + offenders.join(', ') + '.';
      banner.classList.add('show');
    } else {
      banner.classList.remove('show');
    }
  }
}

// Builds all 5 level cells for a row together (rather than one at a
// time) so that when "Equal" is on, editing Level 1 can directly push
// the new value into the other 4 cells' sliders/badges/switches
// without a full grid rebuild -- keeps dragging smooth.
function buildLevelCellsForRow(row) {
  const wraps = [];
  const sliderEls = [];
  const switchEls = [];
  const badgeEls = [];

  function formatValue(v) {
    return row.kind === 'bool' ? (v ? 'Yes' : 'No') : (row.step < 1 ? v.toFixed(1) : v);
  }

  function syncFromLevel1() {
    const v0 = row.values[0];
    for (let i = 1; i < 5; i++) {
      row.values[i] = v0;
      if (row.kind === 'bool') {
        if (switchEls[i]) switchEls[i].classList.toggle('on', !!v0);
      } else if (sliderEls[i]) {
        sliderEls[i].value = v0;
      }
      if (badgeEls[i]) badgeEls[i].textContent = formatValue(v0);
    }
  }

  for (let levelIdx = 0; levelIdx < 5; levelIdx++) {
    const wrap = document.createElement('div');
    wrap.className = 'cell-control';
    const locked = levelIdx > 0 && row.equal;

    if (row.kind === 'bool') {
      const sw = document.createElement('div');
      sw.className = 'toggle-switch' + (row.values[levelIdx] ? ' on' : '') + (locked ? ' locked' : '');
      sw.innerHTML = '<div class="knob"></div>';
      const badge = document.createElement('div');
      badge.className = 'val-badge';
      badge.textContent = formatValue(row.values[levelIdx]);
      switchEls[levelIdx] = sw;
      badgeEls[levelIdx] = badge;
      sw.addEventListener('click', () => {
        if (levelIdx > 0 && row.equal) return;
        row.values[levelIdx] = row.values[levelIdx] ? 0 : 1;
        sw.classList.toggle('on');
        badge.textContent = formatValue(row.values[levelIdx]);
        if (levelIdx === 0 && row.equal) syncFromLevel1();
        renderDashboard();
      });
      wrap.appendChild(sw);
      wrap.appendChild(badge);
    } else {
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min = row.min; slider.max = row.max; slider.step = row.step;
      slider.value = row.values[levelIdx];
      slider.disabled = locked;
      const badge = document.createElement('div');
      badge.className = 'val-badge';
      badge.textContent = formatValue(row.values[levelIdx]);
      sliderEls[levelIdx] = slider;
      badgeEls[levelIdx] = badge;
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        row.values[levelIdx] = v;
        badge.textContent = formatValue(v);
        if (levelIdx === 0 && row.equal) syncFromLevel1();
        renderDashboard();
      });
      wrap.appendChild(slider);
      wrap.appendChild(badge);
    }
    wraps.push(wrap);
  }
  return wraps;
}

// The "Equal" checkbox: when checked, Level 1's current value is
// copied to Levels 2-5 immediately and their controls lock (read-only,
// dimmed) so they can only change by editing Level 1. Unchecking
// discards any edits on this row and resets all 5 levels back to
// their original default values (from ORIGINAL_DATA), rather than
// just leaving them at whatever they were synced to.
function makeEqualCheckbox(row) {
  const wrap = document.createElement('div');
  wrap.className = 'equal-checkbox-wrap';
  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.className = 'equal-checkbox';
  cb.checked = !!row.equal;
  cb.title = 'Use Level 1\u2019s value for all 5 levels';
  cb.addEventListener('change', () => {
    row.equal = cb.checked;
    if (row.equal) {
      const v0 = row.values[0];
      for (let i = 1; i < 5; i++) row.values[i] = v0;
    } else {
      const original = ORIGINAL_DATA.find((r) => r.label === row.label);
      if (original) row.values = [...original.values];
    }
    renderGrid();
    renderDashboard();
  });
  wrap.appendChild(cb);
  return wrap;
}

function renderGrid() {
  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';
  distSumBadges = [];
  let currentCategory = null;
  let lastDistTr = null;
  data.forEach(row => {
    if (row.category !== currentCategory) {
      currentCategory = row.category;
      const catRow = document.createElement('tr');
      catRow.className = 'category-row';
      const td = document.createElement('td');
      td.colSpan = 9;
      td.textContent = currentCategory;
      catRow.appendChild(td);
      tbody.appendChild(catRow);
    }
    const tr = document.createElement('tr');
    tr.className = 'param-row';

    const labelTd = document.createElement('td');
    labelTd.className = 'param-label';
    labelTd.innerHTML = row.label +
      '<span class="dir-tag ' + (row.direction === 'Increases' ? 'inc' : 'dec') + '">' +
      (row.direction === 'Increases' ? '\u25B2 harder' : '\u25BC harder') + '</span>';
    tr.appendChild(labelTd);

    const weightTd = document.createElement('td');
    const weightInput = document.createElement('input');
    weightInput.type = 'number';
    weightInput.className = 'weight-input';
    weightInput.min = 1; weightInput.max = 5; weightInput.step = 1;
    weightInput.value = row.weight;
    weightInput.addEventListener('input', () => {
      row.weight = parseFloat(weightInput.value) || 0;
      renderDashboard();
    });
    weightTd.style.textAlign = 'center';
    weightTd.appendChild(weightInput);
    tr.appendChild(weightTd);

    const dirTd = document.createElement('td');
    const dirSelect = document.createElement('select');
    dirSelect.className = 'dir-select';
    ['Increases', 'Decreases'].forEach(opt => {
      const o = document.createElement('option');
      o.value = opt; o.textContent = opt;
      if (row.direction === opt) o.selected = true;
      dirSelect.appendChild(o);
    });
    dirSelect.addEventListener('change', () => {
      row.direction = dirSelect.value;
      const tag = labelTd.querySelector('.dir-tag');
      tag.className = 'dir-tag ' + (row.direction === 'Increases' ? 'inc' : 'dec');
      tag.textContent = row.direction === 'Increases' ? '\u25B2 harder' : '\u25BC harder';
      renderDashboard();
    });
    dirTd.style.textAlign = 'center';
    dirTd.appendChild(dirSelect);
    tr.appendChild(dirTd);

    const equalTd = document.createElement('td');
    equalTd.appendChild(makeEqualCheckbox(row));
    tr.appendChild(equalTd);

    buildLevelCellsForRow(row).forEach(cellWrap => {
      const td = document.createElement('td');
      td.style.textAlign = 'center';
      td.appendChild(cellWrap);
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
    if (DISTRIBUTION_LABELS.indexOf(row.label) !== -1) lastDistTr = tr;
  });

  if (lastDistTr) {
    const sumTr = document.createElement('tr');
    sumTr.className = 'dist-sum-row';
    const labelTd = document.createElement('td');
    labelTd.className = 'dist-sum-label';
    labelTd.colSpan = 4;
    labelTd.textContent = 'Distribution Sum (must total 100)';
    sumTr.appendChild(labelTd);
    for (let lvl = 0; lvl < 5; lvl++) {
      const td = document.createElement('td');
      td.style.textAlign = 'center';
      const badge = document.createElement('span');
      badge.className = 'dist-sum-badge';
      td.appendChild(badge);
      sumTr.appendChild(td);
      distSumBadges.push(badge);
    }
    lastDistTr.parentNode.insertBefore(sumTr, lastDistTr.nextSibling);
  }

  updateDistributionSums();
}

document.getElementById('resetBtn').addEventListener('click', () => {
  data = ORIGINAL_DATA.map(r => ({ ...r, values: [...r.values] }));
  renderGrid();
  renderDashboard();
});

// Writes one row's current value back into the right nested field of
// a full level config object -- the inverse of the getters in the
// game's LEVEL_BALANCE_ROW_DEFS. Split-time rows are stored as an
// avg(min,max) in this tool but as a {min,max} range in the real
// config, so a new avg is applied by re-centering the ORIGINAL min/max
// window (preserving that level's original spread) on the new value.
function setAvgSplitTime(config, key, newAvg) {
  const range = config.splitTimeRanges && config.splitTimeRanges[key];
  if (!range) return;
  const halfWidth = (Number(range.max) - Number(range.min)) / 2;
  range.min = Math.max(0, Math.round((newAvg - halfWidth) * 10) / 10);
  range.max = Math.round((newAvg + halfWidth) * 10) / 10;
  if (config.splitTimes) config.splitTimes[key] = Math.round(newAvg * 10) / 10;
}

function applyRowValueToConfig(config, label, value) {
  switch (label) {
    case 'Total Play Time (sec)':
      config.totalPlayTime = value; config.totalSurvivalTime = value; break;
    case 'Player Max Health': config.playerHealth = value; break;
    case 'Danger Threshold (%)': config.playerHealthDangerThresholdPercent = value; break;
    case 'Max Cells (population cap)': config.maxCells = value; break;
    case 'Cancer Damage Interval (sec)': config.cancerDamageInterval = value; break;
    case 'Max Attackers Per Cancer Cell': config.maxAttackersPerCancer = value; break;
    case 'Allow Cancer Cell Dragging': config.allowCancerCellDragging = !!value; break;
    case 'Cancer Cells Can Attack Healthy': config.cancerCellsCanAttackHealthy = !!value; break;
    case 'R-Cell Share (%)': config.distribution.R_CELL = value; break;
    case 'T-Cell Share (%)': config.distribution.T_CELL = value; break;
    case 'K-Cell Share (%)': config.distribution.K_CELL = value; break;
    case 'Cancer Cell Share (%)': config.distribution.VISIBLE_CANCER_CELL = value; break;
    case 'Smart Cancer Cell Share (%)': config.distribution.HIDDEN_CANCER_CELL = value; break;
    case 'T-Cell Click Damage': config.cellDamage.T_CELL = value; break;
    case 'K-Cell Click Damage': config.cellDamage.K_CELL = value; break;
    case 'T-Cell Auto DPS': config.damagePerSecond.T_CELL = value; break;
    case 'K-Cell Auto DPS': config.damagePerSecond.K_CELL = value; break;
    case 'Cancer Cell Health': config.cancerHealth.VISIBLE_CANCER_CELL = value; break;
    case 'Smart Cancer Cell Health': config.cancerHealth.HIDDEN_CANCER_CELL = value; break;
    case 'R-Cell Split Time (avg sec)': setAvgSplitTime(config, 'R_CELL', value); break;
    case 'T-Cell Split Time (avg sec)': setAvgSplitTime(config, 'T_CELL', value); break;
    case 'K-Cell Split Time (avg sec)': setAvgSplitTime(config, 'K_CELL', value); break;
    case 'Cancer Cell Split Time (avg sec)': setAvgSplitTime(config, 'VISIBLE_CANCER_CELL', value); break;
    case 'Smart Cancer Cell Split Time (avg sec)': setAvgSplitTime(config, 'HIDDEN_CANCER_CELL', value); break;
    case 'R-Cell Lifetime (sec)': config.lifeTimes.R_CELL = value; break;
    case 'T-Cell Lifetime (sec)': config.lifeTimes.T_CELL = value; break;
    case 'K-Cell Lifetime (sec)': config.lifeTimes.K_CELL = value; break;
    case 'Cancer Cell Impact (per damage tick)': config.impacts.VISIBLE_CANCER_CELL = value; break;
    case 'Smart Cancer Cell Impact (per damage tick)': config.impacts.HIDDEN_CANCER_CELL = value; break;
    case 'Cancer Attack DPS -- Cancer Cell (total, split)':
      config.cancerAttackDamagePerSecond.VISIBLE_CANCER_CELL = value; break;
    case 'Cancer Attack DPS -- Smart Cancer Cell (total, split)':
      config.cancerAttackDamagePerSecond.HIDDEN_CANCER_CELL = value; break;
    case 'Healthy Cell HP -- R-Cell (counter-attack)': config.healthyCellHealth.R_CELL = value; break;
    case 'Healthy Cell HP -- T-Cell (counter-attack)': config.healthyCellHealth.T_CELL = value; break;
    case 'Healthy Cell HP -- K-Cell (counter-attack)': config.healthyCellHealth.K_CELL = value; break;
    default: break; // unrecognized row (e.g. a custom label from an edited xlsx) -- left untouched
  }
}

document.getElementById('exportPresetsBtn').addEventListener('click', () => {
  if (!BASE_CONFIGS) {
    setUploadStatus(
      'Export needs the full level structure, which only comes from opening this tool via the ' +
      'game\u2019s Configurator (\u201cOpen Difficulty Balancer\u201d) -- an uploaded .xlsx alone only has ' +
      'the tuned values, not each level\u2019s complete config.',
      'err',
    );
    return;
  }
  const presets = {};
  Object.keys(BASE_CONFIGS).forEach((id) => {
    presets[id] = JSON.parse(JSON.stringify(BASE_CONFIGS[id]));
  });
  data.forEach((row) => {
    LEVEL_IDS.forEach((id, i) => {
      if (presets[id]) applyRowValueToConfig(presets[id], row.label, row.values[i]);
    });
  });
  const payload = {
    game: 'Cell Defense: Cancer Awareness',
    version: 2,
    exportedAt: new Date().toISOString(),
    presetOrder: LEVEL_IDS,
    presets,
    currentConfig: presets.level1,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'cell-defense-level-presets.json';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setUploadStatus('Exported cell-defense-level-presets.json with your current tuned values.', 'ok');
});

// ---- Upload a Level Balance .xlsx (e.g. one downloaded from the game's
// Configurator) and rebuild the entire dataset from it, instead of the
// hardcoded fallback above. ExcelJS is fetched from a CDN on first use,
// not eagerly, so opening this tool never makes a network request
// unless Upload is actually clicked. (Same library the export side
// uses, since SheetJS's free build can read but not write styling.) ----
let excelJsPromise = null;
function ensureExcelJsLoaded() {
  if (window.ExcelJS) return Promise.resolve();
  if (excelJsPromise) return excelJsPromise;
  excelJsPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the spreadsheet library -- check your internet connection and try again.'));
    document.head.appendChild(script);
  });
  return excelJsPromise;
}

function computeParamRange(label, kind, values) {
  if (kind === 'bool') return { min: 0, max: 1, step: 1 };
  if (label.indexOf('(%)') !== -1) return { min: 0, max: 100, step: 1 };
  const dMin = Math.min(...values);
  const dMax = Math.max(...values);
  const isInt = values.every((v) => Number.isInteger(v));
  const step = isInt ? 1 : 0.1;
  let sMin = dMin <= 5 ? 0 : Math.floor((dMin * 0.4) / step) * step;
  let sMax = Math.ceil((dMax * 1.8) / step) * step;
  if (sMax <= sMin) sMax = sMin + (isInt ? 10 : 1);
  return { min: Math.round(sMin * 100) / 100, max: Math.round(sMax * 100) / 100, step };
}

// Reads the "Level Balance" + "Difficulty Weighting" sheets (the same
// two sheets the game's Configurator exports) out of an uploaded
// workbook and rebuilds the balancer's row list from them. A row only
// becomes editable here if it has a matching entry in "Difficulty
// Weighting" -- structural/non-scored rows in "Level Balance" (like a
// win-condition flag) are intentionally left out, same as the export.
function parseWorkbookToBalancerData(workbook) {
  const lbSheet = workbook.getWorksheet('Level Balance');
  if (!lbSheet) throw new Error('No "Level Balance" sheet found in this workbook.');
  const lbRows = [];
  lbSheet.eachRow((row) => lbRows.push(row.values.slice(1)));
  if (!lbRows.length) throw new Error('"Level Balance" sheet is empty.');
  const header = lbRows[0];
  const levelCol = header.indexOf('Level 1');
  if (levelCol === -1) throw new Error('"Level Balance" sheet is missing a "Level 1" column.');

  const weightMap = {};
  const dwSheet = workbook.getWorksheet('Difficulty Weighting');
  if (dwSheet) {
    const dwRows = [];
    dwSheet.eachRow((row) => dwRows.push(row.values.slice(1)));
    for (let i = 1; i < dwRows.length; i++) {
      const row = dwRows[i];
      if (!row || !row[0]) continue;
      weightMap[row[0]] = { direction: row[2], weight: Number(row[3]) };
    }
  }

  const parsed = [];
  for (let i = 1; i < lbRows.length; i++) {
    const row = lbRows[i];
    if (!row || !row[0] || !row[1]) continue;
    const label = row[0];
    const meta = weightMap[label];
    if (!meta || !meta.direction || Number.isNaN(meta.weight)) continue;
    const category = row[1];
    const values = [];
    let allNumeric = true;
    for (let lv = 0; lv < 5; lv++) {
      const v = Number(row[levelCol + lv]);
      if (Number.isNaN(v)) { allNumeric = false; break; }
      values.push(v);
    }
    if (!allNumeric) continue;
    const isBool = values.every((v) => v === 0 || v === 1) && (Math.max(...values) - Math.min(...values) <= 1);
    const kind = isBool ? 'bool' : 'num';
    const range = computeParamRange(label, kind, values);
    parsed.push({
      label, category, kind, direction: meta.direction, weight: meta.weight,
      values, min: range.min, max: range.max, step: range.step,
    });
  }
  if (!parsed.length) throw new Error('Found the expected sheets, but no matching parameter rows.');
  return parsed;
}

function setUploadStatus(text, kind) {
  const el = document.getElementById('uploadStatus');
  el.textContent = text;
  el.className = 'upload-status' + (kind ? ' ' + kind : '');
}

document.getElementById('uploadBtn').addEventListener('click', () => {
  document.getElementById('uploadInput').click();
});

document.getElementById('uploadInput').addEventListener('change', (evt) => {
  const file = evt.target.files && evt.target.files[0];
  evt.target.value = '';
  if (!file) return;
  setUploadStatus('Loading ' + file.name + '...', 'busy');
  ensureExcelJsLoaded()
    .then(() => {
      const reader = new FileReader();
      reader.onerror = () => setUploadStatus('Could not read that file.', 'err');
      reader.onload = () => {
        const workbook = new ExcelJS.Workbook();
        workbook.xlsx.load(reader.result)
          .then((wb) => {
            const parsed = parseWorkbookToBalancerData(wb);
            ORIGINAL_DATA = parsed;
            data = ORIGINAL_DATA.map(r => ({ ...r, values: [...r.values] }));
            renderGrid();
            renderDashboard();
            setUploadStatus('Loaded ' + parsed.length + ' parameters from ' + file.name + '.', 'ok');
          })
          .catch((err) => setUploadStatus('Upload failed: ' + err.message, 'err'));
      };
      reader.readAsArrayBuffer(file);
    })
    .catch((err) => setUploadStatus(err.message, 'err'));
});

renderGrid();
renderDashboard();
</script>
</body>
</html>
`;

function openDifficultyBalancer() {
  const data = buildDifficultyBalancerData();
  // Full normalized configs for every level (including tutorial, passed
  // through unedited) -- the 34 scored rows above are only a slice of
  // each level's real config, so reconstructing a valid,
  // game-importable preset on export needs the complete structure
  // (appearance, id, name, etc.), not just the values a slider can
  // touch.
  const baseConfigs = {};
  ['tutorial'].concat(ConfigManager.coreLevelIds).forEach((id) => {
    const preset = ConfigManager.presets[id] || ConfigManager.presets.level1;
    baseConfigs[id] = ConfigManager.normalizeConfig(
      ConfigManager.clone(preset),
    );
  });
  const html = BALANCER_HTML_TEMPLATE.replace(
    '__DATA_JSON__',
    JSON.stringify(data),
  ).replace('__BASE_CONFIGS_JSON__', JSON.stringify(baseConfigs));
  const win = window.open('', '_blank');
  if (!win) {
    window.alert(STRINGS.configurator.balancerPopupBlocked);
    return;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
}

class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }
  create() {
    this.scene.start('ConfigScene');
  }
}

class ConfigScene extends Phaser.Scene {
  constructor() {
    super('ConfigScene');
    this.domElement = null;
    this.bound = [];
    this.levelsFileInput = null;
  }

  create() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg).setOrigin(0);
    this.add
      .text(960, 54, 'Cell Defense: Cancer Awareness', {
        fontFamily: 'Arial',
        fontSize: '48px',
        color: '#67e8f9',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(
        960,
        105,
        'Cancer cells remain alive until destroyed. Adjust level balance and play time below.',
        {
          fontFamily: 'Arial',
          fontSize: '24px',
          color: '#cbd5e1',
        },
      )
      .setOrigin(0.5);
    this.createPanel(ConfigManager.getCurrentConfig());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
  }

  field(id, label, value, type = 'number') {
    const step = type === 'number' ? 'step="0.01"' : '';
    return `<div class="cd-field"><label for="${id}">${label}</label><input id="${id}" type="${type}" ${step} value="${value}" /></div>`;
  }

  selectBool(id, label, value) {
    return `<div class="cd-field"><label for="${id}">${label}</label><select id="${id}"><option value="true" ${value ? 'selected' : ''}>true</option><option value="false" ${!value ? 'selected' : ''}>false</option></select></div>`;
  }

  section(title, html, help = '') {
    return `<div class="cd-section"><h2>${title}</h2><div class="cd-grid">${html}</div>${help ? `<div class="cd-help">${help}</div>` : ''}</div>`;
  }

  panelHTML(c) {
    const d = c.distribution;
    const life = c.lifeTimes;
    const impacts = c.impacts;
    const damage = c.cellDamage;
    const dps = c.damagePerSecond || c.cellDamage;
    const ranges = c.splitTimeRanges;
    const health = c.cancerHealth;
    const appearance = c.cellAppearance;

    const S = STRINGS.configurator;
    return `<div class="cd-panel"><h1>${S.panelTitle}</h1><p>${S.panelSubtitle}</p><div class="cd-actions"><button class="cd-btn secondary" id="load-tutorial">${S.loadTutorial}</button><button class="cd-btn secondary" id="load-level1">${S.loadLevel1}</button><button class="cd-btn secondary" id="load-level2">${S.loadLevel2}</button><button class="cd-btn secondary" id="load-level3">${S.loadLevel3}</button><button class="cd-btn secondary" id="load-level4">${S.loadLevel4}</button><button class="cd-btn secondary" id="load-level5">${S.loadLevel5}</button></div>${this.section(S.sections.levelSettings, this.field('levelName', S.fields.levelName, c.name, 'text') + this.field('totalCellsCount', S.fields.totalCellsCount, c.totalCellsCount) + this.field('totalPlayTime', S.fields.totalPlayTime, c.totalPlayTime || c.totalSurvivalTime) + this.field('totalSurvivalTime', S.fields.totalSurvivalTime, c.totalSurvivalTime) + this.field('playerHealth', S.fields.playerHealth, c.playerHealth) + this.field('playerHealthDangerThresholdPercent', S.fields.playerHealthDangerThresholdPercent, c.playerHealthDangerThresholdPercent) + this.field('maxCells', S.fields.maxCells, c.maxCells) + this.field('cancerDamageInterval', S.fields.cancerDamageInterval, c.cancerDamageInterval) + this.field('maxAttackersPerCancer', S.fields.maxAttackersPerCancer, c.maxAttackersPerCancer) + this.selectBool('allowCancerCellDragging', S.fields.allowCancerCellDragging, c.allowCancerCellDragging) + this.selectBool('winOnAllCancerDestroyed', S.fields.winOnAllCancerDestroyed, c.winOnAllCancerDestroyed))}${this.section(S.sections.counterAttack, this.selectBool('cancerCellsCanAttackHealthy', S.fields.cancerCellsCanAttackHealthy, c.cancerCellsCanAttackHealthy) + this.field('cancerAttackDps_VISIBLE_CANCER_CELL', S.fields.cancerAttackDps_VISIBLE_CANCER_CELL, c.cancerAttackDamagePerSecond.VISIBLE_CANCER_CELL) + this.field('cancerAttackDps_HIDDEN_CANCER_CELL', S.fields.cancerAttackDps_HIDDEN_CANCER_CELL, c.cancerAttackDamagePerSecond.HIDDEN_CANCER_CELL) + this.field('healthyHealth_R_CELL', S.fields.healthyHealth_R_CELL, c.healthyCellHealth.R_CELL) + this.field('healthyHealth_T_CELL', S.fields.healthyHealth_T_CELL, c.healthyCellHealth.T_CELL) + this.field('healthyHealth_K_CELL', S.fields.healthyHealth_K_CELL, c.healthyCellHealth.K_CELL), S.sections.counterAttackHint)}${this.section(S.sections.appearance, this.field('appearance_radius_R_CELL', S.fields.appearance_radius_R_CELL, appearance.R_CELL.radius) + this.field('appearance_color_R_CELL', S.fields.appearance_color_R_CELL, appearance.R_CELL.color, 'color') + this.field('appearance_radius_T_CELL', S.fields.appearance_radius_T_CELL, appearance.T_CELL.radius) + this.field('appearance_color_T_CELL', S.fields.appearance_color_T_CELL, appearance.T_CELL.color, 'color') + this.field('appearance_radius_K_CELL', S.fields.appearance_radius_K_CELL, appearance.K_CELL.radius) + this.field('appearance_color_K_CELL', S.fields.appearance_color_K_CELL, appearance.K_CELL.color, 'color') + this.field('appearance_radius_VISIBLE_CANCER_CELL', S.fields.appearance_radius_VISIBLE_CANCER_CELL, appearance.VISIBLE_CANCER_CELL.radius) + this.field('appearance_color_VISIBLE_CANCER_CELL', S.fields.appearance_color_VISIBLE_CANCER_CELL, appearance.VISIBLE_CANCER_CELL.color, 'color') + this.field('appearance_radius_HIDDEN_CANCER_CELL', S.fields.appearance_radius_HIDDEN_CANCER_CELL, appearance.HIDDEN_CANCER_CELL.radius) + this.field('appearance_color_HIDDEN_CANCER_CELL', S.fields.appearance_color_HIDDEN_CANCER_CELL, appearance.HIDDEN_CANCER_CELL.color, 'color'), S.sections.appearanceHint)}${this.section(S.sections.distribution, this.field('dist_R_CELL', S.fields.dist_R_CELL, d.R_CELL) + this.field('dist_T_CELL', S.fields.dist_T_CELL, d.T_CELL) + this.field('dist_K_CELL', S.fields.dist_K_CELL, d.K_CELL) + this.field('dist_VISIBLE_CANCER_CELL', S.fields.dist_VISIBLE_CANCER_CELL, d.VISIBLE_CANCER_CELL) + this.field('dist_HIDDEN_CANCER_CELL', S.fields.dist_HIDDEN_CANCER_CELL, d.HIDDEN_CANCER_CELL), S.sections.distributionHint)}${this.section(S.sections.immuneDamage, this.field('damage_T_CELL', S.fields.damage_T_CELL, damage.T_CELL) + this.field('damage_K_CELL', S.fields.damage_K_CELL, damage.K_CELL))}${this.section(S.sections.autoAttackDps, this.field('dps_T_CELL', S.fields.dps_T_CELL, dps.T_CELL) + this.field('dps_K_CELL', S.fields.dps_K_CELL, dps.K_CELL))}${this.section(S.sections.cancerHealth, this.field('health_VISIBLE_CANCER_CELL', S.fields.health_VISIBLE_CANCER_CELL, health.VISIBLE_CANCER_CELL) + this.field('health_HIDDEN_CANCER_CELL', S.fields.health_HIDDEN_CANCER_CELL, health.HIDDEN_CANCER_CELL))}${this.section(S.sections.splitTimeRange, this.field('splitMin_R_CELL', S.fields.splitMin_R_CELL, ranges.R_CELL.min) + this.field('splitMax_R_CELL', S.fields.splitMax_R_CELL, ranges.R_CELL.max) + this.field('splitMin_T_CELL', S.fields.splitMin_T_CELL, ranges.T_CELL.min) + this.field('splitMax_T_CELL', S.fields.splitMax_T_CELL, ranges.T_CELL.max) + this.field('splitMin_K_CELL', S.fields.splitMin_K_CELL, ranges.K_CELL.min) + this.field('splitMax_K_CELL', S.fields.splitMax_K_CELL, ranges.K_CELL.max) + this.field('splitMin_VISIBLE_CANCER_CELL', S.fields.splitMin_VISIBLE_CANCER_CELL, ranges.VISIBLE_CANCER_CELL.min) + this.field('splitMax_VISIBLE_CANCER_CELL', S.fields.splitMax_VISIBLE_CANCER_CELL, ranges.VISIBLE_CANCER_CELL.max) + this.field('splitMin_HIDDEN_CANCER_CELL', S.fields.splitMin_HIDDEN_CANCER_CELL, ranges.HIDDEN_CANCER_CELL.min) + this.field('splitMax_HIDDEN_CANCER_CELL', S.fields.splitMax_HIDDEN_CANCER_CELL, ranges.HIDDEN_CANCER_CELL.max))}${this.section(S.sections.lifeTimes, this.field('life_R_CELL', S.fields.life_R_CELL, life.R_CELL) + this.field('life_T_CELL', S.fields.life_T_CELL, life.T_CELL) + this.field('life_K_CELL', S.fields.life_K_CELL, life.K_CELL), S.sections.lifeTimesHint)}${this.section(S.sections.cancerImpact, this.field('impact_VISIBLE_CANCER_CELL', S.fields.impact_VISIBLE_CANCER_CELL, impacts.VISIBLE_CANCER_CELL) + this.field('impact_HIDDEN_CANCER_CELL', S.fields.impact_HIDDEN_CANCER_CELL, impacts.HIDDEN_CANCER_CELL))}<div class="cd-actions"><button class="cd-btn" id="save-config">${S.actions.saveConfig}</button><button class="cd-btn" id="start-game">${S.actions.startGame}</button><button class="cd-btn secondary" id="level-select">${S.actions.goToLevelSelect}</button><button class="cd-btn secondary" id="export-levels-json">${S.actions.exportJson}</button><button class="cd-btn secondary" id="load-levels-json">${S.actions.loadJson}</button><button class="cd-btn secondary" id="open-difficulty-balancer">${S.actions.openBalancer}</button><button class="cd-btn secondary" id="download-level-balance-xlsx">${S.actions.downloadXlsx}</button></div><div class="cd-error" id="error-box"></div><div class="cd-success" id="success-box">${S.savedSuccess}</div></div>`;
  }

  createPanel(c) {
    if (this.domElement) this.domElement.destroy();
    this.domElement = this.add.dom(960, 575).createFromHTML(this.panelHTML(c));
    this.addEvents();
  }

  bind(id, fn, eventName = 'click') {
    const el = this.domElement.node.querySelector('#' + id);
    if (!el) return;
    el.addEventListener(eventName, fn);
    this.bound.push({ el, fn, eventName });
  }

  addEvents() {
    this.bind('load-tutorial', () =>
      this.createPanel(ConfigManager.loadPreset('tutorial')),
    );
    this.bind('load-level1', () =>
      this.createPanel(ConfigManager.loadPreset('level1')),
    );
    this.bind('load-level2', () =>
      this.createPanel(ConfigManager.loadPreset('level2')),
    );
    this.bind('load-level3', () =>
      this.createPanel(ConfigManager.loadPreset('level3')),
    );
    this.bind('load-level4', () =>
      this.createPanel(ConfigManager.loadPreset('level4')),
    );
    this.bind('load-level5', () =>
      this.createPanel(ConfigManager.loadPreset('level5')),
    );
    this.bind('save-config', () => this.save(false));
    this.bind('start-game', () => {
      if (this.save(true))
        this.scene.start('GameScene', {
          config: ConfigManager.getCurrentConfig(),
        });
    });
    this.bind('level-select', () => {
      if (this.save(true)) this.scene.start('LevelSelectScene');
    });
    this.bind('export-levels-json', () => this.exportLevelsJson());
    this.bind('load-levels-json', () => this.openLevelsJsonPicker());
    this.bind('open-difficulty-balancer', () => openDifficultyBalancer());
    this.bind('download-level-balance-xlsx', () => exportLevelBalanceXlsx());
  }

  read() {
    const root = this.domElement.node;
    const value = (id) => root.querySelector('#' + id).value;
    const number = (id) => Number(value(id));
    const base = ConfigManager.getCurrentConfig();
    return {
      id: base.id || 'custom',
      name: value('levelName') || 'Custom Level',
      difficulty: base.difficulty || 'Custom',
      totalCellsCount: number('totalCellsCount'),
      totalSurvivalTime: number('totalSurvivalTime'),
      totalPlayTime: number('totalPlayTime'),
      playerHealth: number('playerHealth'),
      playerHealthDangerThresholdPercent: number(
        'playerHealthDangerThresholdPercent',
      ),
      maxCells: number('maxCells'),
      cancerDamageInterval: number('cancerDamageInterval'),
      maxAttackersPerCancer: number('maxAttackersPerCancer'),
      allowCancerCellDragging: value('allowCancerCellDragging') === 'true',
      cancerCellsCanAttackHealthy:
        value('cancerCellsCanAttackHealthy') === 'true',
      cancerAttackDamagePerSecond: {
        VISIBLE_CANCER_CELL: number('cancerAttackDps_VISIBLE_CANCER_CELL'),
        HIDDEN_CANCER_CELL: number('cancerAttackDps_HIDDEN_CANCER_CELL'),
      },
      healthyCellHealth: {
        R_CELL: number('healthyHealth_R_CELL'),
        T_CELL: number('healthyHealth_T_CELL'),
        K_CELL: number('healthyHealth_K_CELL'),
      },
      winOnAllCancerDestroyed: value('winOnAllCancerDestroyed') === 'true',
      cellAppearance: {
        R_CELL: {
          radius: number('appearance_radius_R_CELL'),
          color: value('appearance_color_R_CELL'),
        },
        T_CELL: {
          radius: number('appearance_radius_T_CELL'),
          color: value('appearance_color_T_CELL'),
        },
        K_CELL: {
          radius: number('appearance_radius_K_CELL'),
          color: value('appearance_color_K_CELL'),
        },
        VISIBLE_CANCER_CELL: {
          radius: number('appearance_radius_VISIBLE_CANCER_CELL'),
          color: value('appearance_color_VISIBLE_CANCER_CELL'),
        },
        HIDDEN_CANCER_CELL: {
          radius: number('appearance_radius_HIDDEN_CANCER_CELL'),
          color: value('appearance_color_HIDDEN_CANCER_CELL'),
        },
      },
      distribution: {
        R_CELL: number('dist_R_CELL'),
        T_CELL: number('dist_T_CELL'),
        K_CELL: number('dist_K_CELL'),
        VISIBLE_CANCER_CELL: number('dist_VISIBLE_CANCER_CELL'),
        HIDDEN_CANCER_CELL: number('dist_HIDDEN_CANCER_CELL'),
      },
      cellDamage: {
        T_CELL: number('damage_T_CELL'),
        K_CELL: number('damage_K_CELL'),
      },
      damagePerSecond: {
        T_CELL: number('dps_T_CELL'),
        K_CELL: number('dps_K_CELL'),
      },
      cancerHealth: {
        VISIBLE_CANCER_CELL: number('health_VISIBLE_CANCER_CELL'),
        HIDDEN_CANCER_CELL: number('health_HIDDEN_CANCER_CELL'),
      },
      splitTimes: {
        R_CELL: number('splitMin_R_CELL'),
        T_CELL: number('splitMin_T_CELL'),
        K_CELL: number('splitMin_K_CELL'),
        VISIBLE_CANCER_CELL: number('splitMin_VISIBLE_CANCER_CELL'),
        HIDDEN_CANCER_CELL: number('splitMin_HIDDEN_CANCER_CELL'),
      },
      splitTimeRanges: {
        R_CELL: {
          min: number('splitMin_R_CELL'),
          max: number('splitMax_R_CELL'),
        },
        T_CELL: {
          min: number('splitMin_T_CELL'),
          max: number('splitMax_T_CELL'),
        },
        K_CELL: {
          min: number('splitMin_K_CELL'),
          max: number('splitMax_K_CELL'),
        },
        VISIBLE_CANCER_CELL: {
          min: number('splitMin_VISIBLE_CANCER_CELL'),
          max: number('splitMax_VISIBLE_CANCER_CELL'),
        },
        HIDDEN_CANCER_CELL: {
          min: number('splitMin_HIDDEN_CANCER_CELL'),
          max: number('splitMax_HIDDEN_CANCER_CELL'),
        },
      },
      lifeTimes: {
        R_CELL: number('life_R_CELL'),
        T_CELL: number('life_T_CELL'),
        K_CELL: number('life_K_CELL'),
      },
      impacts: {
        VISIBLE_CANCER_CELL: number('impact_VISIBLE_CANCER_CELL'),
        HIDDEN_CANCER_CELL: number('impact_HIDDEN_CANCER_CELL'),
      },
    };
  }

  save(silent) {
    const c = this.read();
    const r = ConfigManager.validate(c);
    if (!r.valid) {
      this.showErrorMessage(r.errors.join('\n'));
      return false;
    }
    ConfigManager.saveConfig(c);
    if (!silent) this.showSuccessMessage('Config saved successfully.');
    return true;
  }

  exportLevelsJson() {
    if (!this.save(true)) return;
    const blob = new Blob(
      [JSON.stringify(ConfigManager.getExportPayload(), null, 2)],
      { type: 'application/json;charset=utf-8' },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download =
      'cell-defense-level-presets-' +
      new Date().toISOString().slice(0, 10) +
      '.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
    this.showSuccessMessage('Level presets exported successfully as JSON.');
  }

  ensureLevelsFileInput() {
    if (this.levelsFileInput) return this.levelsFileInput;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.position = 'fixed';
    input.style.left = '-9999px';
    input.addEventListener('change', (e) => this.loadLevelsJsonFile(e));
    document.body.appendChild(input);
    this.levelsFileInput = input;
    return input;
  }

  openLevelsJsonPicker() {
    const input = this.ensureLevelsFileInput();
    input.value = '';
    input.click();
  }

  loadLevelsJsonFile(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const result = ConfigManager.importLevelsFromJson(
          JSON.parse(reader.result),
        );
        if (!result.valid) {
          this.showErrorMessage(result.errors.join('\n\n'));
          return;
        }
        this.createPanel(ConfigManager.getCurrentConfig());
        this.time.delayedCall(60, () =>
          this.showSuccessMessage('Level presets loaded successfully.'),
        );
      } catch (err) {
        this.showErrorMessage('Could not parse JSON file.\n' + err.message);
      }
    };
    reader.readAsText(file);
  }

  showErrorMessage(message) {
    if (!this.domElement) return;
    const err = this.domElement.node.querySelector('#error-box');
    const ok = this.domElement.node.querySelector('#success-box');
    if (ok) ok.style.display = 'none';
    if (err) {
      err.textContent = message;
      err.style.display = 'block';
    }
  }

  showSuccessMessage(message) {
    if (!this.domElement) return;
    const err = this.domElement.node.querySelector('#error-box');
    const ok = this.domElement.node.querySelector('#success-box');
    if (err) err.style.display = 'none';
    if (ok) {
      ok.textContent = message;
      ok.style.display = 'block';
    }
  }

  cleanUp() {
    this.bound.forEach(({ el, fn, eventName }) =>
      el.removeEventListener(eventName, fn),
    );
    this.bound = [];
    if (this.domElement) this.domElement.destroy();
    this.domElement = null;
    if (this.levelsFileInput) this.levelsFileInput.remove();
    this.levelsFileInput = null;
  }
}

class LevelSelectScene extends Phaser.Scene {
  constructor() {
    super('LevelSelectScene');
  }

  create() {
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, COLORS.bg).setOrigin(0);
    this.add
      .text(960, 70, STRINGS.levelSelect.title, {
        fontFamily: 'Arial',
        fontSize: '48px',
        color: '#67e8f9',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // 3x2 grid -- tutorial plus 5 core levels. Adding a new preset only
    // means adding it to this list and to ConfigManager.coreLevelIds;
    // the grid positions itself from however many cards there are.
    const cols = [340, 960, 1580];
    const rows = [360, 700];
    [
      ConfigManager.presets.tutorial,
      ConfigManager.presets.level1,
      ConfigManager.presets.level2,
      ConfigManager.presets.level3,
      ConfigManager.presets.level4,
      ConfigManager.presets.level5,
    ].forEach((p, i) => {
      if (!p) return;
      const x = cols[i % cols.length];
      const y = rows[Math.floor(i / cols.length)];
      this.card(x, y, p);
    });

    this.button(960, 990, STRINGS.levelSelect.backButton, 390, 66, () =>
      this.scene.start('ConfigScene'),
    );
  }

  card(x, y, p) {
    this.add
      .rectangle(x, y, 560, 320, COLORS.panel, 0.92)
      .setStrokeStyle(3, COLORS.panelStroke);
    this.add
      .text(x, y - 122, p.name, {
        fontFamily: 'Arial',
        fontSize: '25px',
        color: '#fff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 500 },
      })
      .setOrigin(0.5);
    this.add
      .text(x, y - 86, p.difficulty, {
        fontFamily: 'Arial',
        fontSize: '21px',
        color: '#facc15',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    const s = STRINGS.levelSelect;
    const info = [
      s.cellsLabel + p.totalCellsCount,
      s.playTimeLabel + (p.totalPlayTime || p.totalSurvivalTime) + 's',
      s.tHitLabel + p.cellDamage.T_CELL + s.kHitLabel + p.cellDamage.K_CELL,
      s.cancerHpLabel +
        p.cancerHealth.VISIBLE_CANCER_CELL +
        s.smartHpLabel +
        p.cancerHealth.HIDDEN_CANCER_CELL,
      s.maxAttachLabel + (p.maxAttackersPerCancer || '-'),
      s.cancerDragLabel + (p.allowCancerCellDragging ? s.yes : s.no),
      s.counterAttackLabel + (p.cancerCellsCanAttackHealthy ? s.yes : s.no),
    ].join('\n');
    this.add
      .text(x, y - 5, info, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#cbd5e1',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
    this.button(x, y + 128, s.playPrefix + p.difficulty, 230, 56, () => {
      ConfigManager.loadPreset(p.id);
      this.scene.start('GameScene', {
        config: ConfigManager.getCurrentConfig(),
      });
    });
  }

  button(x, y, label, w, h, cb) {
    const rect = this.add
      .rectangle(x, y, w, h, 0x22c55e)
      .setStrokeStyle(3, 0xbbf7d0)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, {
        fontFamily: 'Arial',
        fontSize: '22px',
        color: '#052e16',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    rect.on('pointerover', () => rect.setFillStyle(0x67e8f9));
    rect.on('pointerout', () => rect.setFillStyle(0x22c55e));
    rect.on('pointerdown', cb);
  }
}

class Cell extends Phaser.GameObjects.Container {
  constructor(scene, x, y, def, config) {
    super(scene, x, y);
    this.scene = scene;
    this.config = config;
    this.id = Phaser.Utils.String.UUID();
    this.key = def.key;
    this.category = def.category;
    this.label = def.label;
    this.radius = def.radius;
    this.currentColor = def.color;
    this.health = def.maxHealth;
    this.maxHealth = def.maxHealth;
    this.hitsPerClick = def.hitsPerClick;
    this.splitTimeRange = def.splitTimeRange || {
      min: def.splitTime,
      max: def.splitTime,
    };
    this.splitTime = def.splitTime;
    this.lifeTime = def.lifeTime;
    this.age = 0;
    this.lastSplitAt = 0;
    this.isAlive = true;
    this.canDivide = def.canDivide;
    this.isDragging = false;
    this.dragStarted = false;
    this.dragThreshold = 8;
    this.suppressClickUntil = 0;
    this.attachedTo = null;
    this.attachedOffset = { x: 0, y: 0 };
    this.lastDamageFeedbackAt = 0;
    this.homeX = x;
    this.homeY = y;
    this.floatPhase = Phaser.Math.FloatBetween(0, Math.PI * 2);
    this.floatSpeed = Phaser.Math.FloatBetween(0.55, 1.15);
    this.floatRadiusX =
      this.category === 'cancer'
        ? Phaser.Math.FloatBetween(1, 3)
        : Phaser.Math.FloatBetween(4, 12);
    this.floatRadiusY =
      this.category === 'cancer'
        ? Phaser.Math.FloatBetween(1, 3)
        : Phaser.Math.FloatBetween(3, 10);
    this.squeezeX = 1;
    this.squeezeY = 1;
    this.squeezeRecoverSpeed = 8;

    this.cellGraphics = scene.add.image(
      0,
      0,
      this.getTextureKeyForCurrentState(),
    );
    // Texture pixels are CELL_TEXTURE_SUPERSAMPLE times bigger than the
    // logical cell size (see bakeCellTexture), so scale back down to
    // display at the intended size. All later scaling (idle pulse,
    // collision squeeze) multiplies on top of this base scale rather
    // than overwriting it, so the extra resolution is preserved.
    this.baseVisualScale = 1 / CELL_TEXTURE_SUPERSAMPLE;
    this.cellGraphics.setScale(this.baseVisualScale);
    this.bodyCircle = scene.add.circle(0, 0, this.radius + 6, 0xffffff, 0.001);

    // K-cells and T-cells read as similar light blue/white shades, but
    // only K-cells can sense hidden cancer cells at range. A soft,
    // translucent "scanner" ring makes that ability visible and gives
    // players an unambiguous way to tell the two apart at a glance.
    this.detectionRing = null;
    if (this.key === CELL_KEYS.K) {
      const ringRadius = this.radius + K_CELL_DETECTION_BUFFER;
      this.detectionRing = scene.add.circle(0, 0, ringRadius, 0x67e8f9, 0.05);
      this.detectionRing.setStrokeStyle(2, 0x67e8f9, 0.4);
      this.detectionRingTween = scene.tweens.add({
        targets: this.detectionRing,
        alpha: 0.15,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    this.healthBarBg = scene.add
      .rectangle(0, 0, this.radius * 2.2, 8, 0x1e293b, 0.9)
      .setVisible(false);
    this.healthBarFill = scene.add
      .rectangle(
        -this.radius * 1.1,
        0,
        this.radius * 2.2,
        8,
        COLORS.green,
        0.95,
      )
      .setOrigin(0, 0.5)
      .setVisible(false);
    this.healthBarContainer = scene.add.container(
      this.x,
      this.y - this.radius - 16,
      [this.healthBarBg, this.healthBarFill],
    );
    this.healthBarContainer.setDepth(DEPTHS.HEALTH_METER).setVisible(false);

    const children = this.detectionRing
      ? [this.detectionRing, this.cellGraphics, this.bodyCircle]
      : [this.cellGraphics, this.bodyCircle];
    this.add(children);
    scene.add.existing(this);
    this.setDepth(DEPTHS.NORMAL_CELL);
    this.redrawCellVisual();
    this.enableDragging(scene);
  }

  enableDragging(scene) {
    this.bodyCircle.setInteractive({ useHandCursor: true });
    scene.input.setDraggable(this.bodyCircle);
    this.bodyCircle.on('dragstart', (p) => {
      if (!this.isAlive || scene.isFinished) return;
      if (
        this.category === 'cancer' &&
        !(scene.configData || {}).allowCancerCellDragging
      )
        return;
      this.dragStarted = false;
      this.isDragging = true;
      this.dragStartX = this.x;
      this.dragStartY = this.y;
      this.dragStartHomeX = this.homeX;
      this.dragStartHomeY = this.homeY;
      this.pointerStartX = p.worldX;
      this.pointerStartY = p.worldY;
    });
    this.bodyCircle.on('drag', (p) => {
      if (!this.isAlive || scene.isFinished || !this.isDragging) return;
      const dist = Phaser.Math.Distance.Between(
        this.pointerStartX,
        this.pointerStartY,
        p.worldX,
        p.worldY,
      );
      if (!this.dragStarted && dist < this.dragThreshold) return;
      if (!this.dragStarted) {
        this.dragStarted = true;
        if (this.category === 'healthy' && scene.cellManager)
          scene.cellManager.detachHealthyCell(this, false);
        this.setDraggingDepth(true);
      }
      this.x = Phaser.Math.Clamp(
        p.worldX,
        PLAY_AREA.x + this.radius,
        PLAY_AREA.x + PLAY_AREA.width - this.radius,
      );
      this.y = Phaser.Math.Clamp(
        p.worldY,
        PLAY_AREA.y + this.radius,
        PLAY_AREA.y + PLAY_AREA.height - this.radius,
      );
      this.homeX = this.x;
      this.homeY = this.y;
      if (
        this.category === 'cancer' &&
        this.attachedCells &&
        this.attachedCells.size > 0
      )
        scene.cellManager.rebuildCancerAttachments(this);
      this.syncHealthMeterPosition();
    });
    this.bodyCircle.on('dragend', () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.setDraggingDepth(false);
      if (!this.dragStarted) {
        this.x = this.dragStartX;
        this.y = this.dragStartY;
        this.homeX = this.dragStartHomeX;
        this.homeY = this.dragStartHomeY;
        this.syncHealthMeterPosition();
        return;
      }
      this.suppressClickUntil = scene.time.now + 160;
      if (this.category === 'healthy') {
        const attached =
          scene.cellManager.attachHealthyCellToNearestCancer(this);
        if (!attached) {
          this.setHomePosition(this.x, this.y);
          scene.showFloatingText(
            this.x,
            this.y - this.radius - 24,
            STRINGS.floating.notAttached,
            '#fecaca',
          );
        }
      } else {
        if (this.attachedCells)
          scene.cellManager.rebuildCancerAttachments(this);
        this.setHomePosition(this.x, this.y);
      }
      this.dragStarted = false;
    });
  }

  updateCell(dt) {
    if (!this.isAlive) return;
    this.age += dt;
    if (this.attachedTo) {
      if (!this.attachedTo.isAlive)
        this.scene.cellManager.detachHealthyCell(this, true);
      else {
        this.x = this.attachedTo.x + this.attachedOffset.x;
        this.y = this.attachedTo.y + this.attachedOffset.y;
      }
    } else if (!this.isDragging) {
      this.idleFloat();
      this.checkBounds();
    }
    const recover = Math.min(1, dt * this.squeezeRecoverSpeed);
    this.squeezeX += (1 - this.squeezeX) * recover;
    this.squeezeY += (1 - this.squeezeY) * recover;
    const pulse = 1 + Math.sin(this.age * 2.5 + this.floatPhase) * 0.04;
    this.cellGraphics.setScale(
      this.baseVisualScale * pulse * this.squeezeX,
      this.baseVisualScale * pulse * this.squeezeY,
    );
    this.syncHealthMeterPosition();
    this.syncHealthMeterDepth();
    if (
      this.category === 'healthy' &&
      this.config.id !== 'tutorial' &&
      this.age >= this.lifeTime
    )
      this.die();
  }

  idleFloat() {
    const t = this.age * this.floatSpeed + this.floatPhase;
    this.x = this.homeX + Math.cos(t) * this.floatRadiusX;
    this.y = this.homeY + Math.sin(t * 1.18) * this.floatRadiusY;
  }

  applyCollisionSqueeze(nx, ny, overlap) {
    const strength = Phaser.Math.Clamp(overlap / this.radius, 0.04, 0.22);
    if (Math.abs(nx) > Math.abs(ny)) {
      this.squeezeX = Math.min(this.squeezeX, 1 - strength);
      this.squeezeY = Math.max(this.squeezeY, 1 + strength * 0.65);
    } else {
      this.squeezeX = Math.max(this.squeezeX, 1 + strength * 0.65);
      this.squeezeY = Math.min(this.squeezeY, 1 - strength);
    }
  }

  setHomePosition(x, y) {
    this.homeX = Phaser.Math.Clamp(
      x,
      PLAY_AREA.x + this.radius,
      PLAY_AREA.x + PLAY_AREA.width - this.radius,
    );
    this.homeY = Phaser.Math.Clamp(
      y,
      PLAY_AREA.y + this.radius,
      PLAY_AREA.y + PLAY_AREA.height - this.radius,
    );
    this.x = this.homeX;
    this.y = this.homeY;
    this.syncHealthMeterPosition();
  }

  checkBounds() {
    const minX = PLAY_AREA.x + this.radius;
    const maxX = PLAY_AREA.x + PLAY_AREA.width - this.radius;
    const minY = PLAY_AREA.y + this.radius;
    const maxY = PLAY_AREA.y + PLAY_AREA.height - this.radius;
    this.x = Phaser.Math.Clamp(this.x, minX, maxX);
    this.y = Phaser.Math.Clamp(this.y, minY, maxY);
    this.homeX = Phaser.Math.Clamp(this.homeX, minX, maxX);
    this.homeY = Phaser.Math.Clamp(this.homeY, minY, maxY);
  }

  canSplit() {
    return (
      this.isAlive &&
      !this.attachedTo &&
      this.canDivide &&
      this.age - this.lastSplitAt >= this.splitTime
    );
  }

  markSplit() {
    this.lastSplitAt = this.age;
    if (this.splitTimeRange)
      this.splitTime = ConfigManager.randomRange(
        this.splitTimeRange.min,
        this.splitTimeRange.max,
      );
  }

  syncHealthMeterDepth() {
    if (!this.healthBarContainer) return;
    this.healthBarContainer.setDepth(
      this.isDragging ? DEPTHS.DRAGGING_HEALTH_METER : DEPTHS.HEALTH_METER,
    );
  }

  syncHealthMeterPosition() {
    if (!this.healthBarContainer) return;
    this.healthBarContainer.x = this.x;
    this.healthBarContainer.y = this.y - this.radius - 16;
  }

  setDraggingDepth(isDragging) {
    this.setDepth(isDragging ? DEPTHS.DRAGGING_CELL : DEPTHS.NORMAL_CELL);
    this.syncHealthMeterDepth();
  }

  setHealthBarVisible(isVisible) {
    if (!this.healthBarContainer || this.maxHealth <= 0) return;
    this.healthBarContainer.setVisible(!!isVisible);
    this.healthBarBg.setVisible(!!isVisible);
    this.healthBarFill.setVisible(!!isVisible);
  }

  updateHealthBar() {
    if (this.maxHealth <= 0) return;
    const ratio = Phaser.Math.Clamp(this.health / this.maxHealth, 0, 1);
    this.healthBarFill.width = this.radius * 2.2 * ratio;
    if (ratio <= 0.3) this.healthBarFill.setFillStyle(COLORS.danger);
    else if (ratio <= 0.6) this.healthBarFill.setFillStyle(COLORS.yellow);
    else this.healthBarFill.setFillStyle(COLORS.green);
  }

  setCellColor(color) {
    this.currentColor = color;
    this.redrawCellVisual();
  }

  // Originally lived only on CancerCell (only cancer cells could take
  // damage). Promoted to the base class so HealthyCell instances can
  // also take damage -- needed for levels where a cancer cell counter-
  // attacks the healthy cells attached to it (see
  // CellManager.handleCancerCounterAttacks). Cancer cells still use
  // this exact same path for T/K-cell attacks, unchanged.
  takeDamage(amount, details, options = {}) {
    if (!this.isAlive || amount <= 0) return;
    this.health -= amount;
    this.updateHealthBar();
    if (this.maxHealth > 0) this.setHealthBarVisible(true);
    const now = this.scene.time.now;
    const shouldShowFeedback =
      options.forceFeedback ||
      now - this.lastDamageFeedbackAt >= 240 ||
      this.health <= 0;
    if (shouldShowFeedback) {
      this.lastDamageFeedbackAt = now;
      this.showDamageReaction(options);
    }
    if (this.health <= 0) {
      const isCancer = this.category === 'cancer';
      this.scene.showFloatingText(
        this.x,
        this.y,
        isCancer ? STRINGS.floating.destroyed : STRINGS.floating.cellLost,
        isCancer ? '#bbf7d0' : '#fecaca',
      );
      this.die();
    }
  }

  showDamageReaction(options = {}) {
    if (!this.isAlive || !this.scene) return;
    const isManual = !!options.manual;
    const ringColor = isManual ? 0xfde047 : 0xff4d6d;
    const particleColor = isManual ? 0xfff7ad : 0xff8fa3;

    const ring = this.scene.add.circle(
      this.x,
      this.y,
      this.radius * 0.85,
      ringColor,
      0,
    );
    ring.setStrokeStyle(isManual ? 6 : 4, ringColor, isManual ? 0.9 : 0.7);
    ring.setDepth(this.depth + 8);
    this.scene.tweens.add({
      targets: ring,
      scale: isManual ? 2.25 : 1.85,
      alpha: 0,
      duration: isManual ? 360 : 280,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });

    const flash = this.scene.add.circle(
      this.x,
      this.y,
      this.radius * 0.95,
      isManual ? 0xfff3a3 : 0xff3355,
      isManual ? 0.32 : 0.24,
    );
    flash.setDepth(this.depth + 7);
    this.scene.tweens.add({
      targets: flash,
      scaleX: 1.12,
      scaleY: 1.12,
      alpha: 0,
      duration: 160,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy(),
    });

    for (let i = 0; i < 8; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const startDistance = this.radius * Phaser.Math.FloatBetween(0.45, 0.9);
      const endDistance = this.radius * Phaser.Math.FloatBetween(1.35, 1.95);
      const dot = this.scene.add.circle(
        this.x + Math.cos(angle) * startDistance,
        this.y + Math.sin(angle) * startDistance,
        Phaser.Math.FloatBetween(2.4, 4.8),
        particleColor,
        0.9,
      );
      dot.setDepth(this.depth + 9);
      this.scene.tweens.add({
        targets: dot,
        x: this.x + Math.cos(angle) * endDistance,
        y: this.y + Math.sin(angle) * endDistance,
        alpha: 0,
        scale: 0.35,
        duration: Phaser.Math.Between(220, 380),
        ease: 'Sine.easeOut',
        onComplete: () => dot.destroy(),
      });
    }

    this.scene.tweens.add({
      targets: this,
      scaleX: isManual ? 1.14 : 1.08,
      scaleY: isManual ? 0.82 : 0.88,
      yoyo: true,
      duration: isManual ? 95 : 80,
      ease: 'Sine.easeInOut',
    });
  }

  die() {
    if (!this.isAlive) return;
    if (this.attachedTo && this.scene.cellManager)
      this.scene.cellManager.detachHealthyCell(this, false);
    this.isAlive = false;
    if (this.detectionRingTween) this.detectionRingTween.stop();
    if (this.healthBarContainer) this.healthBarContainer.destroy();
    this.destroy();
  }

  getTextureKeyForCurrentState() {
    // Texture keys depend on this level's configured size/color, baked
    // once at GameScene start (see bakeAllCellTextures) and stashed on
    // the scene -- not a fixed global lookup anymore.
    const keys = this.scene && this.scene.cellTextureKeys;
    if (!keys) return null;
    if (this.key === CELL_KEYS.R) return keys.R;
    if (this.key === CELL_KEYS.T) return keys.T;
    if (this.key === CELL_KEYS.K) return keys.K;
    if (this.key === CELL_KEYS.V) return keys.V;
    if (this.key === CELL_KEYS.H) {
      // this.isDetected only exists on CancerCell, but key === H implies
      // this Cell always *is* a CancerCell. Checking the actual flag
      // (rather than comparing currentColor to a fixed default) stays
      // correct even when V's color has been customized away from its
      // default in the Configurator.
      return this.isDetected ? keys.H_DETECTED : keys.H;
    }
    return keys.R;
  }

  // Cells used to redraw their entire body with a Graphics object
  // (~10 draw calls) every time their color/state changed. Now every
  // possible look is a pre-baked texture (see bakeAllCellTextures), so
  // "redrawing" is just pointing the sprite at a different texture --
  // no geometry is recomputed and WebGL can batch same-texture cells
  // into a single draw call.
  redrawCellVisual() {
    this.cellGraphics.setTexture(this.getTextureKeyForCurrentState());
  }
}

class HealthyCell extends Cell {}

class CancerCell extends Cell {
  constructor(scene, x, y, def, config) {
    super(scene, x, y, def, config);
    this.isDetected = def.key === CELL_KEYS.V;
    this.detectedColor = def.detectedColor || COLORS.v;
    this.impactOnPlayerHealth = def.impactOnPlayerHealth;
    this.attachedCells = new Set();
    this.lastDamageFeedbackAt = 0;
    this.lastManualClickAttackAt = 0;
    // Ambient "bad protein" dust emission -- a passive tell that this
    // cell is actively harmful. Staggered start + randomized interval so
    // cancer cells don't all puff in lockstep.
    this.dustTimer = Phaser.Math.FloatBetween(0, 1);
    this.dustInterval = Phaser.Math.FloatBetween(0.6, 1.2);
    this.bodyCircle.on('pointerup', (p) => {
      if (!this.isAlive || this.scene.isFinished) return;
      if (this.scene.time.now < this.suppressClickUntil) return;
      p.event.stopPropagation();
      this.scene.cellManager.handleCancerCellClick(this);
    });
  }

  updateCell(dt) {
    super.updateCell(dt);
    this.updateDustEmission(dt);
  }

  // Only cells the player can currently *see* as cancerous emit dust:
  // an always-visible V-cell, or an H-cell only after it's been
  // detected. An undetected H-cell must stay indistinguishable from a
  // normal R-cell, so it emits nothing until revealed. The two also use
  // different dust colors so a freshly-revealed H-cell still reads as
  // "the one that was hiding" rather than looking identical to a V-cell.
  updateDustEmission(dt) {
    if (!this.isAlive) return;
    const emitsDust =
      this.key === CELL_KEYS.V || (this.key === CELL_KEYS.H && this.isDetected);
    if (!emitsDust) return;
    this.dustTimer += dt;
    if (this.dustTimer < this.dustInterval) return;
    this.dustTimer = 0;
    this.dustInterval = Phaser.Math.FloatBetween(0.6, 1.2);
    this.spawnDustParticle();
  }

  spawnDustParticle() {
    if (!this.scene || !this.isAlive) return;
    // V-cells leak a toxic teal clump. A detected H-cell keeps leaking
    // its original hidden-red color, marking it as "the one that was
    // disguised" even though it now looks the same as a V-cell.
    const dustColor = this.key === CELL_KEYS.H ? 0x8b0000 : 0x0891b2;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const startDistance = this.radius * Phaser.Math.FloatBetween(0.3, 0.7);
    const particle = this.scene.add.image(
      this.x + Math.cos(angle) * startDistance,
      this.y + Math.sin(angle) * startDistance,
      DUST_PROTEIN_TEXTURE_KEY,
    );
    particle.setTint(dustColor);
    particle.setAlpha(0.8);
    particle.setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2));
    particle.setScale(Phaser.Math.FloatBetween(0.7, 1.3));
    particle.setDepth(this.depth + 5);
    const driftAngle = angle + Phaser.Math.FloatBetween(-0.4, 0.4);
    const driftDistance = this.radius * Phaser.Math.FloatBetween(1.4, 2.2);
    // A lazy tumble as it drifts, unlike the attack sparks which never
    // rotate -- reinforces that this is a different kind of particle.
    const spin = Phaser.Math.FloatBetween(-2.4, 2.4);
    this.scene.tweens.add({
      targets: particle,
      x: particle.x + Math.cos(driftAngle) * driftDistance,
      y: particle.y + Math.sin(driftAngle) * driftDistance - 16,
      rotation: particle.rotation + spin,
      alpha: 0,
      scale: 0.35,
      duration: Phaser.Math.Between(900, 1400),
      ease: 'Sine.easeOut',
      onComplete: () => particle.destroy(),
    });
  }

  detect() {
    if (this.key !== CELL_KEYS.H || this.isDetected) return;
    this.isDetected = true;
    this.setCellColor(this.detectedColor);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.12,
      scaleY: 1.12,
      duration: 180,
      ease: 'Back.Out',
    });
  }

  die() {
    if (this.attachedCells) {
      Array.from(this.attachedCells).forEach((c) =>
        this.scene.cellManager.detachHealthyCell(c, true),
      );
      this.attachedCells.clear();
    }
    super.die();
  }
}

class CellManager {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.cells = [];
    this.manualClickCooldownMs = 220;
  }

  createInitialCells() {
    if (this.config.id === 'tutorial') {
      this.createTutorialCells();
      return;
    }
    const counts = ConfigManager.distributionToCounts(this.config);
    Object.entries(counts).forEach(([key, count]) => {
      for (let i = 0; i < count; i++) this.createCell(key);
    });
  }

  createTutorialCells() {
    this.createCell(CELL_KEYS.V, TUTORIAL_LAYOUT.V.x, TUTORIAL_LAYOUT.V.y);
    this.createCell(CELL_KEYS.H, TUTORIAL_LAYOUT.H.x, TUTORIAL_LAYOUT.H.y);
    this.createCell(CELL_KEYS.T, TUTORIAL_LAYOUT.T.x, TUTORIAL_LAYOUT.T.y);
    this.createCell(CELL_KEYS.K, TUTORIAL_LAYOUT.K.x, TUTORIAL_LAYOUT.K.y);
    this.createCell(CELL_KEYS.R, TUTORIAL_LAYOUT.R1.x, TUTORIAL_LAYOUT.R1.y);
    this.createCell(CELL_KEYS.R, TUTORIAL_LAYOUT.R2.x, TUTORIAL_LAYOUT.R2.y);
  }

  createCell(key, x, y, currentAliveCount) {
    const aliveCount =
      currentAliveCount === undefined
        ? this.getAliveCells().length
        : currentAliveCount;
    if (aliveCount >= Number(this.config.maxCells)) return null;
    const def = ConfigManager.getCellDef(key, this.config);
    const pos = this.getSpawnPosition(x, y, def.radius);
    const Cls = def.category === 'cancer' ? CancerCell : HealthyCell;
    const cell = new Cls(this.scene, pos.x, pos.y, def, this.config);
    cell.setHomePosition(pos.x, pos.y);
    cell.setDepth(DEPTHS.NORMAL_CELL);
    this.cells.push(cell);
    return cell;
  }

  getSpawnPosition(x, y, radius) {
    if (typeof x === 'number' && typeof y === 'number') {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = radius * 2.7;
      return {
        x: Phaser.Math.Clamp(
          x + Math.cos(angle) * distance,
          PLAY_AREA.x + radius,
          PLAY_AREA.x + PLAY_AREA.width - radius,
        ),
        y: Phaser.Math.Clamp(
          y + Math.sin(angle) * distance,
          PLAY_AREA.y + radius,
          PLAY_AREA.y + PLAY_AREA.height - radius,
        ),
      };
    }
    return {
      x: Phaser.Math.Between(
        PLAY_AREA.x + radius,
        PLAY_AREA.x + PLAY_AREA.width - radius,
      ),
      y: Phaser.Math.Between(
        PLAY_AREA.y + radius,
        PLAY_AREA.y + PLAY_AREA.height - radius,
      ),
    };
  }

  update(dt) {
    // Update every cell once, then take a single snapshot of the alive
    // cells for this frame. All sub-systems below reuse that snapshot
    // instead of each re-filtering the full cell list (which used to
    // happen 8-10+ times per frame).
    for (let i = 0; i < this.cells.length; i++) this.cells[i].updateCell(dt);
    const alive = this.getAliveCells();
    this.updateHiddenCancerDetection(alive);
    this.handleAutoAttachment(alive);
    this.handleAutoAttacks(dt, alive);
    this.handleCancerCounterAttacks(dt, alive);
    this.handleSplits(alive);
    this.resolveSoftOverlaps(alive);
    this.removeDeadCells();
  }

  // Attachment used to require dragging a healthy cell onto a cancer
  // cell and releasing it. Now simple physical contact is enough: any
  // free-floating (not already attached, not being dragged) T- or
  // K-cell that touches a cancer cell auto-attaches, same as a manual
  // drag-and-drop would. Actual damage still only starts once attached
  // (see handleAutoAttacks / getCorrectAttackers) -- this method only
  // creates the attachment, it never deals damage itself.
  //
  // R-cells are deliberately excluded: they're passive (no attack), so
  // they shouldn't auto-latch onto a cancer cell just from incidental
  // contact -- including when a cancer cell is dragged into a resting
  // R-cell. (Manually dragging an R-cell onto a cancer cell and
  // releasing it is unrelated to this method and still works as before.)
  handleAutoAttachment(aliveCells) {
    const cancerCells = aliveCells.filter(
      (c) => c.category === 'cancer' && c.isAlive,
    );
    if (!cancerCells.length) return;
    for (const h of aliveCells) {
      if (
        (h.key !== CELL_KEYS.T && h.key !== CELL_KEYS.K) ||
        !h.isAlive ||
        h.attachedTo ||
        h.isDragging
      )
        continue;
      const touching = cancerCells.some((cancer) => {
        const dist = Phaser.Math.Distance.Between(h.x, h.y, cancer.x, cancer.y);
        // Actual physical contact (small buffer), not the more generous
        // "close enough" range used when releasing a manual drag.
        return dist <= h.radius + cancer.radius + 4;
      });
      if (touching) this.attachHealthyCellToNearestCancer(h);
    }
  }

  handleSplits(aliveCells) {
    if (this.config.id === 'tutorial') return;
    const maxCells = Number(this.config.maxCells);
    // Track the alive count locally instead of re-filtering the whole
    // array on every loop iteration (that was an accidental O(n^2)).
    let currentCount = aliveCells.length;
    for (const cell of aliveCells) {
      if (currentCount >= maxCells) break;
      if (!cell.canSplit()) continue;
      cell.markSplit();
      this.scene.tweens.add({
        targets: cell,
        scaleX: 1.25,
        scaleY: 0.8,
        duration: 180,
        yoyo: true,
      });
      const child = this.createCell(cell.key, cell.x, cell.y, currentCount);
      if (!child) continue;
      currentCount++;
      child.age = 0;
      child.setHomePosition(child.x, child.y);
      child.setScale(0.15);
      this.scene.tweens.add({
        targets: child,
        scaleX: 1,
        scaleY: 1,
        duration: 350,
        ease: 'Back.Out',
      });
      const burst = this.scene.add
        .circle(cell.x, cell.y, 10, 0xffffff, 0.4)
        .setDepth(DEPTHS.NORMAL_CELL - 1);
      this.scene.tweens.add({
        targets: burst,
        scale: 5,
        alpha: 0,
        duration: 300,
        onComplete: () => burst.destroy(),
      });
      this.scene.showFloatingText(
        child.x,
        child.y - child.radius - 18,
        STRINGS.floating.split,
        '#93c5fd',
      );
    }
  }

  // Overlap resolution used to be an O(n^2) brute-force pass over every
  // alive cell against every other alive cell. With ~150-165 cells alive
  // (Level 3's maxCells) that is 12,000+ pair checks, every single frame.
  // Cells only ever need to resolve overlaps with *nearby* cells, so we
  // bucket them into a uniform grid keyed by position and only compare
  // cells that share or neighbor a bucket. This turns the check into
  // roughly O(n) in practice while producing the same result.
  resolveSoftOverlaps(aliveCells) {
    const cellSize = 140; // > max possible "desired" separation (~104px)
    const grid = new Map();
    for (const c of aliveCells) {
      const gx = Math.floor(c.x / cellSize);
      const gy = Math.floor(c.y / cellSize);
      const key = gx + ',' + gy;
      let bucket = grid.get(key);
      if (!bucket) {
        bucket = [];
        grid.set(key, bucket);
      }
      bucket.push(c);
    }

    // These 5 offsets (including self) cover the full 3x3 neighborhood
    // exactly once per pair when iterated over every occupied bucket,
    // so no pair is checked twice and none is missed.
    const neighborOffsets = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
      [-1, 1],
    ];

    for (const [key, bucket] of grid) {
      const parts = key.split(',');
      const gx = Number(parts[0]);
      const gy = Number(parts[1]);
      for (const [ox, oy] of neighborOffsets) {
        const otherBucket = grid.get(gx + ox + ',' + (gy + oy));
        if (!otherBucket) continue;
        const sameBucket = ox === 0 && oy === 0;
        for (let i = 0; i < bucket.length; i++) {
          const a = bucket[i];
          if (!a.isAlive) continue;
          const startJ = sameBucket ? i + 1 : 0;
          for (let j = startJ; j < otherBucket.length; j++) {
            const b = otherBucket[j];
            if (!b.isAlive) continue;
            const ownerA = a.attachedTo || a;
            const ownerB = b.attachedTo || b;
            if (ownerA === ownerB) continue;
            const desired = a.radius + b.radius + 4;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const distance = Math.sqrt(dx * dx + dy * dy) || 0.001;
            if (distance >= desired) continue;
            const overlap = desired - distance;
            const nx = dx / distance;
            const ny = dy / distance;
            a.applyCollisionSqueeze(nx, ny, overlap);
            b.applyCollisionSqueeze(-nx, -ny, overlap);
            const push = overlap * 0.08;
            if (!ownerA.isDragging)
              this.moveCollisionOwner(ownerA, -nx * push, -ny * push);
            if (!ownerB.isDragging)
              this.moveCollisionOwner(ownerB, nx * push, ny * push);
          }
        }
      }
    }
  }

  moveCollisionOwner(cell, dx, dy) {
    if (!cell || !cell.isAlive || cell.isDragging) return;
    const minX = PLAY_AREA.x + cell.radius;
    const maxX = PLAY_AREA.x + PLAY_AREA.width - cell.radius;
    const minY = PLAY_AREA.y + cell.radius;
    const maxY = PLAY_AREA.y + PLAY_AREA.height - cell.radius;
    cell.homeX = Phaser.Math.Clamp(cell.homeX + dx, minX, maxX);
    cell.homeY = Phaser.Math.Clamp(cell.homeY + dy, minY, maxY);
    cell.x = Phaser.Math.Clamp(cell.x + dx, minX, maxX);
    cell.y = Phaser.Math.Clamp(cell.y + dy, minY, maxY);
    cell.syncHealthMeterPosition();
    if (
      cell.category === 'cancer' &&
      cell.attachedCells &&
      cell.attachedCells.size > 0
    )
      this.rebuildCancerAttachments(cell);
  }

  attachHealthyCellToNearestCancer(healthyCell) {
    if (
      !healthyCell ||
      healthyCell.category !== 'healthy' ||
      !healthyCell.isAlive
    )
      return false;
    const maxAttackers = Math.max(
      1,
      Number(this.config.maxAttackersPerCancer) || 3,
    );
    const cancerCells = this.getAliveCells().filter(
      (c) =>
        c.category === 'cancer' &&
        // Skip cancer cells already at their attacker cap -- a healthy
        // cell can still attach to any *other* cancer cell within range,
        // it just won't pile onto one that's already full.
        (!c.attachedCells || c.attachedCells.size < maxAttackers),
    );
    let best = null;
    let bestDistance = Infinity;
    cancerCells.forEach((cancer) => {
      const distance = Phaser.Math.Distance.Between(
        healthyCell.x,
        healthyCell.y,
        cancer.x,
        cancer.y,
      );
      const attachDistance = cancer.radius + healthyCell.radius + 52;
      if (distance <= attachDistance && distance < bestDistance) {
        best = cancer;
        bestDistance = distance;
      }
    });
    if (!best) return false;
    this.detachHealthyCell(healthyCell, false);
    healthyCell.attachedTo = best;
    best.attachedCells.add(healthyCell);
    this.rebuildCancerAttachments(best);
    if (this.isCorrectAttacker(healthyCell, best))
      best.setHealthBarVisible(true);
    if (best.key === CELL_KEYS.H && healthyCell.key === CELL_KEYS.K) {
      best.detect();
      this.scene.showFloatingText(
        best.x,
        best.y - best.radius - 34,
        STRINGS.floating.detectedByK,
        '#67e8f9',
      );
    }
    this.scene.showFloatingText(
      best.x,
      best.y + best.radius + 30,
      this.getAttachmentRuleText(healthyCell, best),
      '#bbf7d0',
    );
    return true;
  }

  detachHealthyCell(healthyCell, restoreHome) {
    if (!healthyCell || !healthyCell.attachedTo) return;
    const target = healthyCell.attachedTo;
    if (target.attachedCells) target.attachedCells.delete(healthyCell);
    healthyCell.attachedTo = null;
    healthyCell.attachedOffset = { x: 0, y: 0 };
    if (restoreHome) healthyCell.setHomePosition(healthyCell.x, healthyCell.y);
    if (target && target.isAlive) {
      this.rebuildCancerAttachments(target);
      this.updateCancerHealthVisibility(target);
    }
  }

  rebuildCancerAttachments(cancerCell) {
    if (!cancerCell || !cancerCell.attachedCells) return;
    const attached = Array.from(cancerCell.attachedCells).filter(
      (c) => c && c.isAlive,
    );
    cancerCell.attachedCells = new Set(attached);
    const total = Math.max(attached.length, 1);
    attached.forEach((cell, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / total;
      const ringRadius = cancerCell.radius + cell.radius + 10;
      cell.attachedOffset = {
        x: Math.cos(angle) * ringRadius,
        y: Math.sin(angle) * ringRadius,
      };
      cell.x = cancerCell.x + cell.attachedOffset.x;
      cell.y = cancerCell.y + cell.attachedOffset.y;
      cell.homeX = cell.x;
      cell.homeY = cell.y;
      cell.syncHealthMeterPosition();
      cell.syncHealthMeterDepth();
    });
  }

  getAttachmentRuleText(h, c) {
    if (h.key === CELL_KEYS.T && c.key === CELL_KEYS.V)
      return STRINGS.floating.ruleTAttached;
    if (h.key === CELL_KEYS.K && c.key === CELL_KEYS.H)
      return STRINGS.floating.ruleKAttached;
    if (h.key === CELL_KEYS.R) return STRINGS.floating.ruleRAttached;
    return STRINGS.floating.ruleWrongAttacker;
  }

  updateHiddenCancerDetection(aliveCells) {
    const undetectedHidden = aliveCells.filter(
      (c) => c.key === CELL_KEYS.H && !c.isDetected,
    );
    if (!undetectedHidden.length) return;
    const kCells = aliveCells.filter((c) => c.key === CELL_KEYS.K && c.isAlive);
    if (!kCells.length) return;
    const buffer = K_CELL_DETECTION_BUFFER;
    undetectedHidden.forEach((h) => {
      const isNearK = kCells.some((k) => {
        const range = h.radius + k.radius + buffer;
        return Phaser.Math.Distance.Between(h.x, h.y, k.x, k.y) <= range;
      });
      if (isNearK) {
        h.detect();
        this.scene.showFloatingText(
          h.x,
          h.y - h.radius - 30,
          STRINGS.floating.detected,
          '#67e8f9',
        );
      }
    });
  }

  isCorrectAttacker(healthyCell, cancerCell) {
    if (!healthyCell || !cancerCell) return false;
    return (
      (healthyCell.key === CELL_KEYS.T && cancerCell.key === CELL_KEYS.V) ||
      (healthyCell.key === CELL_KEYS.K && cancerCell.key === CELL_KEYS.H)
    );
  }

  getCorrectAttackers(cancerCell) {
    const attached = cancerCell.attachedCells
      ? Array.from(cancerCell.attachedCells).filter((c) => c && c.isAlive)
      : [];
    if (cancerCell.key === CELL_KEYS.V)
      return attached.filter((c) => c.key === CELL_KEYS.T);
    if (cancerCell.key === CELL_KEYS.H && cancerCell.isDetected)
      return attached.filter((c) => c.key === CELL_KEYS.K);
    return [];
  }

  updateCancerHealthVisibility(cancerCell) {
    if (!cancerCell || !cancerCell.isAlive || cancerCell.category !== 'cancer')
      return;
    cancerCell.setHealthBarVisible(
      this.getCorrectAttackers(cancerCell).length > 0,
    );
  }

  handleAutoAttacks(dt, aliveCells) {
    if (this.scene.isFinished) return;
    aliveCells
      .filter((cell) => cell.category === 'cancer')
      .forEach((cancerCell) => {
        const attackers = this.getCorrectAttackers(cancerCell);
        this.updateCancerHealthVisibility(cancerCell);
        if (!attackers.length) return;
        const dpsConfig =
          this.config.damagePerSecond || this.config.cellDamage || {};
        const totalDps = attackers.reduce(
          (sum, attacker) =>
            sum + Number(dpsConfig[attacker.key] || attacker.hitsPerClick || 0),
          0,
        );
        const damage = totalDps * dt;
        if (damage <= 0) return;
        cancerCell.takeDamage(damage, '', {
          forceFeedback: false,
          manual: false,
        });
      });
  }

  // Advanced-level mechanic: a cancer cell with healthy cells attached
  // to it fights back. Its configured DPS (cancerAttackDamagePerSecond)
  // is a *fixed total* -- split evenly across every attached healthy
  // cell, not applied per-cell -- so piling more cells onto one cancer
  // cell dilutes the damage each one takes rather than multiplying it.
  // Off by default (cancerCellsCanAttackHealthy), so existing levels
  // are completely unaffected.
  handleCancerCounterAttacks(dt, aliveCells) {
    if (!this.config.cancerCellsCanAttackHealthy || this.scene.isFinished)
      return;
    const dpsConfig = this.config.cancerAttackDamagePerSecond || {};
    aliveCells
      .filter((c) => c.category === 'cancer' && c.isAlive)
      .forEach((cancerCell) => {
        const attached = cancerCell.attachedCells
          ? Array.from(cancerCell.attachedCells).filter(
              (h) => h && h.isAlive && h.maxHealth > 0,
            )
          : [];
        if (!attached.length) return;
        const totalDamage = Number(dpsConfig[cancerCell.key] || 0) * dt;
        if (totalDamage <= 0) return;
        const perCellDamage = totalDamage / attached.length;
        attached.forEach((h) =>
          h.takeDamage(perCellDamage, '', {
            forceFeedback: false,
            manual: false,
          }),
        );
      });
  }

  getManualClickDamage(attackers) {
    const clickDamageConfig = this.config.cellDamage || {};
    return attackers.reduce(
      (sum, attacker) =>
        sum +
        Number(clickDamageConfig[attacker.key] || attacker.hitsPerClick || 0),
      0,
    );
  }

  handleCancerCellClick(cancerCell) {
    if (!cancerCell || !cancerCell.isAlive || this.scene.isFinished) return;
    const attackers = this.getCorrectAttackers(cancerCell);
    if (attackers.length > 0) {
      const now = this.scene.time.now;
      if (now - cancerCell.lastManualClickAttackAt < this.manualClickCooldownMs)
        return;
      cancerCell.lastManualClickAttackAt = now;
      const damage = this.getManualClickDamage(attackers);
      if (damage <= 0) return;
      cancerCell.takeDamage(damage, '', { forceFeedback: true, manual: true });
      return;
    }
    this.scene.showFloatingText(
      cancerCell.x,
      cancerCell.y - cancerCell.radius - 35,
      cancerCell.key === CELL_KEYS.V
        ? STRINGS.floating.attachHintVisible
        : STRINGS.floating.attachHintHidden,
      '#fecaca',
    );
  }

  getAliveCells() {
    return this.cells.filter((c) => c && c.isAlive && c.active);
  }
  getCountByKey(key) {
    return this.getAliveCells().filter((c) => c.key === key).length;
  }
  getCancerCounts() {
    return {
      visible: this.getCountByKey(CELL_KEYS.V),
      hidden: this.getCountByKey(CELL_KEYS.H),
    };
  }
  removeDeadCells() {
    this.cells = this.cells.filter((c) => c && c.isAlive && c.active);
  }
  destroy() {
    this.cells.forEach((c) => {
      if (c && c.active) c.destroy();
      if (c && c.healthBarContainer) c.healthBarContainer.destroy();
    });
    this.cells = [];
  }
}

class HealthManager {
  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    this.maxHealth = Number(config.playerHealth);
    this.playerHealth = Number(config.playerHealth);
    this.dangerThreshold =
      (this.maxHealth * Number(config.playerHealthDangerThresholdPercent)) /
      100;
    this.accumulator = 0;
  }

  update(dt) {
    if (this.scene.isFinished || this.config.id === 'tutorial') return;
    this.accumulator += dt;
    if (this.accumulator >= Number(this.config.cancerDamageInterval)) {
      this.accumulator -= Number(this.config.cancerDamageInterval);
      this.applyCancerDamage();
    }
  }

  applyCancerDamage() {
    const counts = this.scene.cellManager.getCancerCounts();
    const damage =
      counts.visible * Number(this.config.impacts.VISIBLE_CANCER_CELL) +
      counts.hidden * Number(this.config.impacts.HIDDEN_CANCER_CELL);
    if (damage <= 0) return;
    this.playerHealth = Phaser.Math.Clamp(
      this.playerHealth - damage,
      0,
      this.maxHealth,
    );
    if (this.scene.hud) this.scene.hud.showDamageEffect(damage);
    if (this.playerHealth <= this.dangerThreshold)
      this.scene.finishGame(
        false,
        'Player health reached the danger threshold.',
      );
  }

  ratio() {
    return Phaser.Math.Clamp(this.playerHealth / this.maxHealth, 0, 1);
  }
}

class HtmlHUD {
  static ensureDamageStyles() {
    if (document.getElementById('cell-defense-damage-styles')) return;
    const style = document.createElement('style');
    style.id = 'cell-defense-damage-styles';
    style.textContent = `
      .game-hud { overflow: visible !important; align-items: flex-start !important; }
      .hud-right { overflow: visible !important; min-width: 360px !important; display: flex !important; flex-direction: row !important; align-items: stretch !important; gap: 8px !important; }
      .hud-center { overflow: visible !important; }
      .health-bar { position: relative; overflow: hidden; }
      .health-damage-flash { position: absolute; inset: 0; border-radius: inherit; opacity: 0; pointer-events: none; background: linear-gradient(90deg, rgba(239,68,68,0.82), rgba(248,113,113,0.24)); box-shadow: 0 0 24px rgba(239,68,68,0.9), inset 0 0 16px rgba(255,255,255,0.45); z-index: 3; }
      .health-damage-flash.hit { animation: cd-health-hit 420ms ease-out; }
      @keyframes cd-health-hit { 0% { opacity: 0; transform: translateX(-100%) scaleX(0.45); } 24% { opacity: 1; transform: translateX(0) scaleX(1); } 100% { opacity: 0; transform: translateX(0) scaleX(1.08); } }
      .heart-monitor { width: 320px; min-height: 74px; display: block; flex: 0 0 auto; box-sizing: border-box; margin-top: 0; border-radius: 16px; padding: 8px 12px 7px; border: 1px solid rgba(255,255,255,0.42); box-shadow: 0 10px 22px rgba(15,23,42,0.18), inset 0 0 18px rgba(255,255,255,0.28); transition: background 260ms ease, box-shadow 260ms ease, border-color 260ms ease; position: relative; z-index: 4; }
      .heart-monitor .heart-header { display: flex; justify-content: space-between; align-items: center; font-family: Arial, sans-serif; font-size: 12px; font-weight: 800; letter-spacing: 0.07em; margin-bottom: 3px; }
      .heart-monitor svg { display: block; width: 100%; height: 42px; overflow: visible; }
      .heart-wave { fill: none; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 255; animation: cd-heart-wave 1.1s linear infinite; filter: drop-shadow(0 0 5px currentColor); }
      .heart-monitor.relaxed { color: #10b981; background: linear-gradient(135deg, rgba(209,250,229,0.94), rgba(224,242,254,0.9)); border-color: rgba(16,185,129,0.5); box-shadow: 0 0 18px rgba(16,185,129,0.24), inset 0 0 20px rgba(255,255,255,0.5); }
      .heart-monitor.watch { color: #f59e0b; background: linear-gradient(135deg, rgba(254,243,199,0.96), rgba(255,251,235,0.88)); border-color: rgba(245,158,11,0.6); box-shadow: 0 0 20px rgba(245,158,11,0.34), inset 0 0 16px rgba(255,255,255,0.42); }
      .heart-monitor.danger { color: #ef4444; background: linear-gradient(135deg, rgba(254,226,226,0.96), rgba(255,237,213,0.9)); border-color: rgba(239,68,68,0.75); box-shadow: 0 0 24px rgba(239,68,68,0.44), inset 0 0 18px rgba(255,255,255,0.34); animation: cd-monitor-warning 720ms ease-in-out infinite alternate; }
      @keyframes cd-heart-wave { from { stroke-dashoffset: 255; } to { stroke-dashoffset: 0; } }
      @keyframes cd-monitor-warning { from { transform: scale(1); } to { transform: scale(1.025); } }
    `;
    document.head.appendChild(style);
  }

  constructor(scene, config) {
    this.scene = scene;
    this.config = config;
    HtmlHUD.ensureDamageStyles();
    this.dom = scene.add.dom(GAME_WIDTH / 2, 78).createFromHTML(this.getHTML());
    this.dom.setDepth(DEPTHS.HUD);
    this.levelName = this.dom.node.querySelector('#hudLevelName');
    this.subtitle = this.dom.node.querySelector('#hudSubtitle');
    this.healthFill = this.dom.node.querySelector('#hudHealthFill');
    this.healthDamageFlash = this.dom.node.querySelector(
      '#hudHealthDamageFlash',
    );
    this.healthText = this.dom.node.querySelector('#hudHealthText');
    this.timer = this.dom.node.querySelector('#hudTimer');
    this.stats = this.dom.node.querySelector('#hudStats');
    this.counters = this.dom.node.querySelector('#hudCounters');
    this.heartMonitor = this.dom.node.querySelector('#heartMonitor');
    this.heartStatus = this.dom.node.querySelector('#heartStatus');
    this.heartBpm = this.dom.node.querySelector('#heartBpm');
    this.heartWave = this.dom.node.querySelector('#heartWave');
    this.levelName.textContent = config.name;
    this.subtitle.textContent = STRINGS.hud.subtitle;
    this.stats.innerHTML = this.getStatsHTML();
  }

  getHTML() {
    return `<div class="game-hud"><div class="hud-left"><div id="hudLevelName" class="hud-level"></div><div class="health-row"><div class="health-bar"><div id="hudHealthDamageFlash" class="health-damage-flash"></div><div id="hudHealthFill" class="health-fill"></div></div><div id="hudHealthText" class="health-text"></div></div><div id="hudSubtitle" class="hud-subtitle"></div></div><div class="hud-center"><div id="hudTimer" class="hud-timer">0s</div><div class="hud-timer-label">${STRINGS.hud.timerLabel}</div></div><div class="hud-right"><div id="heartMonitor" class="heart-monitor relaxed"><div class="heart-header"><span id="heartStatus">${STRINGS.hud.heartRelaxed}</span><span id="heartBpm">72${STRINGS.hud.bpmSuffix}</span></div><svg viewBox="0 0 220 48" aria-hidden="true"><polyline id="heartWave" class="heart-wave" points="0,30 22,30 31,18 43,39 57,11 72,30 94,30 104,24 115,34 126,30 220,30"></polyline></svg></div><div id="hudStats" class="hud-stats"></div><div id="hudCounters" class="hud-counters"></div></div></div>`;
  }

  getStatsHTML() {
    const dps = this.config.damagePerSecond || this.config.cellDamage;
    return `<div class="hud-kpi"><span>${STRINGS.hud.statTDps}</span><strong>${dps.T_CELL}</strong></div><div class="hud-kpi"><span>${STRINGS.hud.statKDps}</span><strong>${dps.K_CELL}</strong></div><div class="hud-kpi"><span>${STRINGS.hud.statCancerHp}</span><strong>${this.config.cancerHealth.VISIBLE_CANCER_CELL}</strong></div><div class="hud-kpi"><span>${STRINGS.hud.statSmartHp}</span><strong>${this.config.cancerHealth.HIDDEN_CANCER_CELL}</strong></div>`;
  }

  updateHeartMonitor(ratio) {
    if (!this.heartMonitor || !this.heartStatus || !this.heartBpm) return;
    let mode = 'relaxed';
    let label = STRINGS.hud.heartRelaxed;
    if (ratio <= 0.35) {
      mode = 'danger';
      label = STRINGS.hud.heartCaution;
    } else if (ratio <= 0.6) {
      mode = 'watch';
      label = STRINGS.hud.heartWatch;
    }
    const bpm = Math.round(62 + (1 - ratio) * 72);
    this.heartMonitor.className = 'heart-monitor ' + mode;
    this.heartStatus.textContent = label;
    this.heartBpm.textContent = bpm + STRINGS.hud.bpmSuffix;
    if (this.heartWave) {
      const speed = Phaser.Math.Clamp(60 / bpm, 0.42, 1.18);
      this.heartWave.style.animationDuration = speed + 's';
      this.heartWave.style.stroke =
        mode === 'danger'
          ? '#ef4444'
          : mode === 'watch'
            ? '#f59e0b'
            : '#10b981';
    }
  }

  update() {
    const h = this.scene.healthManager;
    const ratio = h.ratio();
    const percent = Math.round(ratio * 100);

    // Dirty-check every DOM write below: this update() runs 60x/sec, and
    // writing style/textContent even to an unchanged value still costs a
    // style recalculation. Skipping unchanged writes is free correctness
    // (nothing visually changes) and cuts most of the per-frame DOM cost.
    if (percent !== this._lastPercent) {
      this._lastPercent = percent;
      this.healthFill.style.width = percent + '%';
      let mode = 'healthy';
      if (ratio <= 0.35) mode = 'danger';
      else if (ratio <= 0.6) mode = 'watch';
      if (mode !== this._lastHealthMode) {
        this._lastHealthMode = mode;
        if (mode === 'danger') {
          this.healthFill.style.background =
            'linear-gradient(90deg,#ef4444,#dc2626)';
          this.healthFill.style.boxShadow = '0 0 18px rgba(239,68,68,.8)';
        } else if (mode === 'watch') {
          this.healthFill.style.background =
            'linear-gradient(90deg,#f59e0b,#fbbf24)';
          this.healthFill.style.boxShadow = '0 0 14px rgba(245,158,11,.6)';
        } else {
          this.healthFill.style.background =
            'linear-gradient(90deg,#10b981,#22c55e)';
          this.healthFill.style.boxShadow = '0 0 14px rgba(16,185,129,.5)';
        }
      }
      this.healthText.textContent =
        STRINGS.hud.healthPrefix +
        Math.ceil(h.playerHealth) +
        STRINGS.hud.healthSeparator +
        h.maxHealth;
      this.updateHeartMonitor(ratio);
    }

    const remaining = Math.max(0, Math.ceil(this.scene.remainingTime));
    if (remaining !== this._lastRemaining) {
      this._lastRemaining = remaining;
      this.timer.textContent = remaining + 's';
      this.timer.style.color = remaining <= 15 ? '#dc2626' : '#0f172a';
    }

    // hud-stats / hud-counters are permanently `display:none` in CSS and
    // nothing in the game ever toggles that, so they're never visible.
    // Recomputing hudCounters every frame used to cost 6 full passes over
    // the cell list (getCountByKey x5 + getAliveCells) for a DOM write
    // nobody can see. Only do that work if the panel is actually enabled.
    if (this.countersVisible) {
      const m = this.scene.cellManager;
      const alive = m.getAliveCells();
      const countBy = (key) =>
        alive.reduce((n, c) => n + (c.key === key ? 1 : 0), 0);
      this.counters.innerHTML = [
        'R: ' + countBy(CELL_KEYS.R),
        'T: ' + countBy(CELL_KEYS.T),
        'K: ' + countBy(CELL_KEYS.K),
        'V: ' + countBy(CELL_KEYS.V),
        'H: ' + countBy(CELL_KEYS.H),
        'Total: ' + alive.length + '/' + this.config.maxCells,
      ].join('<br>');
    }
  }

  showDamageEffect() {
    if (!this.dom || !this.healthDamageFlash) return;
    this.healthDamageFlash.classList.remove('hit');
    void this.healthDamageFlash.offsetWidth;
    this.healthDamageFlash.classList.add('hit');
    const pulse = this.scene.add.rectangle(
      GAME_WIDTH / 2 - 395,
      92,
      290,
      24,
      0xef4444,
      0.28,
    );
    pulse.setDepth(DEPTHS.HUD + 2);
    this.scene.tweens.add({
      targets: pulse,
      scaleX: 1.18,
      scaleY: 1.7,
      alpha: 0,
      duration: 420,
      ease: 'Quad.easeOut',
      onComplete: () => pulse.destroy(),
    });
  }

  destroy() {
    if (this.dom) this.dom.destroy();
  }
}

// Ambient animated backdrop (gradient wash, drifting tissue blobs with
// organelles/nucleus, fluid particles, ECM matrix lines) run as its own
// parallel Scene rather than objects inside GameScene. GameScene
// launches it and immediately sends it to the back of the render order
// (see GameScene.create/cleanUp below), so it renders full-canvas behind
// the play-area dish and HUD, and shuts down cleanly when leaving the
// level -- it never runs during Config/LevelSelect/Result screens.
class TissueScene extends Phaser.Scene {
  constructor() {
    super('TissueScene');
  }

  create() {
    //--------------------------------
    // Background
    //--------------------------------

    this.cameras.main.setBackgroundColor(0x0b0716);

    this.bg = this.add.graphics();

    this.drawGradient();
    this.createParticleTexture();
    this.createFlowField();
    this.frameCount = 0;
    this.fluidParticles = [];

    this.createFluid();
    this.matrixGraphics = this.add.graphics();
    this.matrixGraphics.setBlendMode(Phaser.BlendModes.ADD);
    this.matrixLines = [];

    this.createMatrix();
    this.backgroundCells = [];
    this.foregroundBlobs = [];

    this.createBackgroundCells();
    this.createForegroundBlobs();
    this.createVignette();
    //--------------------------------
    // Camera
    //--------------------------------

    this.cameraTime = 0;

    //--------------------------------
    // Fluid stirring -- dragging the mouse
    // (or a finger, touch works the same
    // way) nudges nearby fluid particles in
    // the direction of the drag. These are
    // scene-level listeners (not tied to any
    // specific interactive object), so they
    // still fire even while GameScene's own
    // cells are being dragged around on top
    // -- dragging a cell incidentally stirs
    // the backdrop too, which reads as a
    // nice bit of physicality rather than a
    // bug. Actual per-particle force is
    // applied once per frame in update().
    //--------------------------------

    this.dragActive = false;
    this.dragX = 0;
    this.dragY = 0;
    this.dragInfluenceRadius = 220;
    this.pendingDragDX = 0;
    this.pendingDragDY = 0;

    this.input.on('pointerdown', (pointer) => {
      this.dragActive = true;
      this.dragX = pointer.x;
      this.dragY = pointer.y;
      this.pendingDragDX = 0;
      this.pendingDragDY = 0;
    });

    this.input.on('pointermove', (pointer) => {
      if (!this.dragActive) return;
      this.pendingDragDX += pointer.x - this.dragX;
      this.pendingDragDY += pointer.y - this.dragY;
      this.dragX = pointer.x;
      this.dragY = pointer.y;
    });

    this.input.on('pointerup', () => {
      this.dragActive = false;
    });
    this.input.on('pointerupoutside', () => {
      this.dragActive = false;
    });
  }

  createFlowField() {
    //--------------------------------
    // No noise-field lookup table needed —
    // getFlow() below is a cheap analytic
    // curl-like function, sampled live by
    // whatever calls it. Sharing one function
    // is what makes every object's motion
    // feel like one current instead of
    // independent per-object wobble.
    //--------------------------------

    this.flowScale = 0.0016;
    this.flowSpeed = 0.00012;
  }

  getFlow(x, y, time) {
    const s = this.flowScale;
    const t = time * this.flowSpeed;

    const angle =
      Math.sin(x * s + t) * Math.cos(y * s * 1.3 - t * 0.8) * Math.PI +
      Math.sin((x + y) * s * 0.6 + t * 1.7) * 0.6;

    return {
      x: Math.cos(angle),
      y: Math.sin(angle),
    };
  }

  createVignette() {
    const g = this.add.graphics();

    g.fillStyle(0x000000, 0.18);

    g.fillRect(0, 0, GAME_WIDTH, 80);
    g.fillRect(0, GAME_HEIGHT - 80, GAME_WIDTH, 80);

    g.fillRect(0, 0, 80, GAME_HEIGHT);
    g.fillRect(GAME_WIDTH - 80, 0, 80, GAME_HEIGHT);

    g.setScrollFactor(0);
  }

  createBackgroundCells() {
    const COUNT = 180;

    for (let i = 0; i < COUNT; i++) {
      const r = Phaser.Math.Between(8, 18);

      const cell = this.add.image(
        Phaser.Math.Between(-200, GAME_WIDTH + 200),

        Phaser.Math.Between(-200, GAME_HEIGHT + 200),

        'particleDot',
      );

      cell.setTint(0xffb6df);
      cell.setAlpha(Phaser.Math.FloatBetween(0.03, 0.08));

      //--------------------------------
      // sizeScale maps the 64px shared
      // texture down to this cell's radius;
      // breathing multiplies on top of it.
      //--------------------------------

      cell.sizeScale = (r * 2) / 64;
      cell.setScale(cell.sizeScale);

      cell.speed = Phaser.Math.FloatBetween(0.03, 0.08);

      cell.seed = Math.random() * 1000;

      cell.baseScale = Phaser.Math.FloatBetween(0.8, 1.3);

      this.backgroundCells.push(cell);
    }
  }

  createForegroundBlobs() {
    const COUNT = 12;

    for (let i = 0; i < COUNT; i++) {
      const r = Phaser.Math.Between(180, 320);

      const blob = this.add.image(
        Phaser.Math.Between(-300, GAME_WIDTH + 300),

        Phaser.Math.Between(-300, GAME_HEIGHT + 300),

        'particleDot',
      );

      blob.setDisplaySize(r * 2, r * 2);
      blob.setTint(0xff88d8);
      blob.setAlpha(0.025);

      blob.speed = Phaser.Math.FloatBetween(0.02, 0.05);

      blob.seed = Math.random() * 1000;

      this.foregroundBlobs.push(blob);
    }
  }

  createMatrix() {
    const COUNT = 45;

    for (let i = 0; i < COUNT; i++) {
      const line = {
        y: Phaser.Math.Between(-100, GAME_HEIGHT + 100),

        amplitude: Phaser.Math.Between(8, 25),

        frequency: Phaser.Math.FloatBetween(0.002, 0.006),

        speed: Phaser.Math.FloatBetween(0.0004, 0.0012),

        thickness: Phaser.Math.FloatBetween(1, 3),

        alpha: Phaser.Math.FloatBetween(0.04, 0.12),

        seed: Math.random() * 1000,
      };

      this.matrixLines.push(line);
    }
  }

  drawMatrix(time) {
    const g = this.matrixGraphics;

    g.clear();

    for (const line of this.matrixLines) {
      const flow = this.getFlow(GAME_WIDTH / 2, line.y, time);
      const flowBoost = 1 + Math.abs(flow.y) * 0.6;

      g.lineStyle(
        line.thickness,

        0xffc9f8,

        line.alpha,
      );

      g.beginPath();

      for (let x = -50; x <= GAME_WIDTH + 50; x += 32) {
        const y =
          line.y +
          Math.sin(x * line.frequency + time * line.speed + line.seed) *
            line.amplitude *
            flowBoost;

        if (x == -50) {
          g.moveTo(x, y);
        } else {
          g.lineTo(x, y);
        }
      }

      g.strokePath();
    }
  }

  createFluid() {
    const COUNT = 900;

    for (let i = 0; i < COUNT; i++) {
      const r = Phaser.Math.FloatBetween(1, 4);

      const colors = [0xffffff, 0xfff4b0, 0x8ee8ff, 0xffc8ef];

      const p = this.add.image(
        Phaser.Math.Between(-100, GAME_WIDTH + 100),
        Phaser.Math.Between(-100, GAME_HEIGHT + 100),

        'particleDot',
      );

      p.setDisplaySize(r * 2, r * 2);
      p.setTint(Phaser.Utils.Array.GetRandom(colors));
      p.setAlpha(Phaser.Math.FloatBetween(0.08, 0.35));

      //--------------------------------
      // Store motion data
      //--------------------------------

      p.seed = Math.random() * 1000;

      p.speed = Phaser.Math.FloatBetween(0.15, 0.45);

      p.flow = Phaser.Math.FloatBetween(0.2, 0.8);

      p.vx = 0;
      p.vy = 0;

      p.depthFactor = Phaser.Math.FloatBetween(0.4, 1);

      p.baseAlpha = p.alpha;

      this.fluidParticles.push(p);
    }
  }

  createParticleTexture() {
    //--------------------------------
    // One shared texture for every dot-like
    // object (fluid, background cells,
    // foreground blobs). This lets WebGL
    // batch hundreds of objects into a
    // handful of draw calls instead of one
    // draw call per object.
    //--------------------------------

    const size = 64;
    const g = this.make.graphics({ add: false });

    g.fillStyle(0xffffff, 1);
    g.fillCircle(size / 2, size / 2, size / 2);

    g.generateTexture('particleDot', size, size);
    g.destroy();
  }

  drawGradient() {
    const g = this.bg;

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    const colors = [0x0b0716, 0x1b1030, 0x31174b, 0x58236d, 0x873d93];

    let radius = 1200;

    for (let i = 0; i < colors.length; i++) {
      g.fillStyle(colors[i], 0.25);

      g.fillCircle(cx, cy, radius);

      radius -= 180;
    }
  }

  update(time, delta) {
    this.frameCount++;

    //--------------------------------
    // Graphics re-tessellation (organic
    // blob outlines, ECM lines) is the
    // most expensive work per frame.
    // The wobble is slow enough that
    // redrawing every other frame is
    // visually indistinguishable but
    // roughly halves that cost.
    //--------------------------------

    const redrawShapes = this.frameCount % 2 === 0;

    this.cameraTime += delta * 0.00015;

    const cam = this.cameras.main;

    cam.scrollX = Math.sin(this.cameraTime) * 8;

    cam.scrollY = Math.cos(this.cameraTime * 0.7) * 6;

    cam.setZoom(1 + Math.sin(this.cameraTime * 0.8) * 0.01);

    //--------------------------------
    // Fluid Simulation
    //--------------------------------

    // Consume whatever drag movement accumulated since last frame, once,
    // so a held-but-stationary pointer applies zero force (no residual
    // push) -- only actual mouse/finger movement while held down stirs
    // the fluid.
    const dragDX = this.pendingDragDX;
    const dragDY = this.pendingDragDY;
    this.pendingDragDX = 0;
    this.pendingDragDY = 0;
    const isStirring =
      this.dragActive && (Math.abs(dragDX) > 0.01 || Math.abs(dragDY) > 0.01);
    const stirRadius = this.dragInfluenceRadius;

    for (const p of this.fluidParticles) {
      //--------------------------------
      // Shared current (flow field)
      //--------------------------------

      const flow = this.getFlow(p.x, p.y, time);

      p.x += flow.x * p.flow;
      p.y += flow.y * p.flow * 0.6;

      //--------------------------------
      // Mouse/touch stirring -- particles
      // within stirRadius of the cursor get
      // pushed along the drag direction,
      // stronger the closer they are.
      //--------------------------------

      if (isStirring) {
        const dx = p.x - this.dragX;
        const dy = p.y - this.dragY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < stirRadius) {
          const falloff = 1 - dist / stirRadius;
          const strength = falloff * falloff * 0.5;
          p.x += dragDX * strength;
          p.y += dragDY * strength;
        }
      }

      //--------------------------------
      // True Brownian motion — a damped
      // random walk, not a periodic sine,
      // so particles never repeat a path
      //--------------------------------

      p.vx = (p.vx + (Math.random() - 0.5) * 0.06) * 0.94;
      p.vy = (p.vy + (Math.random() - 0.5) * 0.06) * 0.94;

      p.x += p.vx;
      p.y += p.vy;

      //--------------------------------
      // Twinkle
      //--------------------------------

      p.alpha = p.baseAlpha + Math.sin(time * 0.002 + p.seed) * 0.05;

      //--------------------------------
      // Wrap
      //--------------------------------

      if (p.x > GAME_WIDTH + 120) {
        p.x = -120;

        p.y = Phaser.Math.Between(
          -50,

          GAME_HEIGHT + 50,
        );
      }
    }
    if (redrawShapes) {
      this.drawMatrix(time);
    }

    //------------------------------------
    // Background Cells
    //------------------------------------

    for (const cell of this.backgroundCells) {
      cell.x += cell.speed;

      cell.y += Math.sin(time * 0.00025 + cell.seed) * 0.08;

      cell.setScale(
        cell.sizeScale *
          (cell.baseScale + Math.sin(time * 0.001 + cell.seed) * 0.05),
      );

      if (cell.x > GAME_WIDTH + 220) {
        cell.x = -220;

        cell.y = Phaser.Math.Between(-100, GAME_HEIGHT + 100);
      }
    }

    //------------------------------------
    // Foreground Tissue
    //------------------------------------

    for (const blob of this.foregroundBlobs) {
      blob.x += blob.speed;

      blob.y += Math.cos(time * 0.0002 + blob.seed) * 0.05;

      blob.alpha = 0.02 + Math.sin(time * 0.0007 + blob.seed) * 0.01;

      if (blob.x > GAME_WIDTH + 350) {
        blob.x = -350;

        blob.y = Phaser.Math.Between(-150, GAME_HEIGHT + 150);
      }
    }
  }
}

class GameScene extends Phaser.Scene {
  constructor() {
    super('GameScene');
    this.isFinished = false;
  }

  init(data) {
    this.configData =
      data && data.config
        ? ConfigManager.clone(data.config)
        : ConfigManager.getCurrentConfig();
  }

  getConfiguredPlayTime() {
    return Number(
      this.configData.totalPlayTime || this.configData.totalSurvivalTime,
    );
  }

  isTutorialLevel() {
    return this.configData && this.configData.id === 'tutorial';
  }

  createTutorialOverlay() {
    this.tutorialStepIndex = -1;
    this.tutorialPanel = this.add
      .rectangle(960, 1000, 1380, 84, 0x08162a, 0.92)
      .setStrokeStyle(3, 0x67e8f9, 0.75)
      .setDepth(DEPTHS.HUD + 10);
    this.tutorialText = this.add
      .text(960, 1000, '', {
        fontFamily: 'Arial',
        fontSize: '27px',
        color: '#e0f2fe',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: 1260 },
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.HUD + 11);
    this.createTutorialLegend();
    this.createTutorialDragHint();
    this.setTutorialMessage(0);
  }

  // A small always-visible "Cell Guide" panel: one row per cell type
  // showing its actual in-game icon (the same baked texture used on the
  // play field, so it's not just a color swatch) next to its name and
  // role, plus a "Who Attacks Whom" mini-diagram below it. Purely
  // informational -- nothing here reacts to tutorial progress.
  createTutorialLegend() {
    const s = STRINGS.tutorial;
    const panelX = 1630;
    const panelTop = 210;
    const panelWidth = 400;
    const rowHeight = 66;
    const iconDiameter = 42;
    const textWrap = panelWidth - 110;

    const items = [
      {
        texKey: this.cellTextureKeys.R,
        name: STRINGS.cellDisplayName.R_CELL,
        role: s.legendRoles.R_CELL,
      },
      {
        texKey: this.cellTextureKeys.T,
        name: STRINGS.cellDisplayName.T_CELL,
        role: s.legendRoles.T_CELL,
      },
      {
        texKey: this.cellTextureKeys.K,
        name: STRINGS.cellDisplayName.K_CELL,
        role: s.legendRoles.K_CELL,
      },
      {
        texKey: this.cellTextureKeys.V,
        name: STRINGS.cellDisplayName.VISIBLE_CANCER_CELL,
        role: s.legendRoles.VISIBLE_CANCER_CELL,
      },
      {
        texKey: this.cellTextureKeys.H,
        name: STRINGS.cellDisplayName.HIDDEN_CANCER_CELL,
        role: s.legendRoles.HIDDEN_CANCER_CELL,
      },
    ];

    const panelHeight = 56 + items.length * rowHeight + 30 + 40 + rowHeight * 2;
    this.add
      .rectangle(
        panelX,
        panelTop + panelHeight / 2,
        panelWidth,
        panelHeight,
        0x08162a,
        0.88,
      )
      .setStrokeStyle(3, 0x67e8f9, 0.6)
      .setDepth(DEPTHS.HUD + 5);
    this.add
      .text(panelX, panelTop + 30, s.legendTitle, {
        fontFamily: 'Arial',
        fontSize: '24px',
        color: '#67e8f9',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.HUD + 6);

    let rowY = panelTop + 70;
    const iconX = panelX - panelWidth / 2 + 44;
    const textX = iconX + 44;
    items.forEach((item) => {
      this.addLegendIcon(iconX, rowY, item.texKey, iconDiameter);
      this.add
        .text(textX, rowY - 13, item.name, {
          fontFamily: 'Arial',
          fontSize: '19px',
          color: '#e0f2fe',
          fontStyle: 'bold',
          wordWrap: { width: textWrap },
        })
        .setOrigin(0, 0.5)
        .setDepth(DEPTHS.HUD + 6);
      this.add
        .text(textX, rowY + 14, item.role, {
          fontFamily: 'Arial',
          fontSize: '14px',
          color: '#94a3b8',
          wordWrap: { width: textWrap },
        })
        .setOrigin(0, 0.5)
        .setDepth(DEPTHS.HUD + 6);
      rowY += rowHeight;
    });

    rowY += 20;
    this.add
      .text(panelX, rowY, s.matchupTitle, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color: '#facc15',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.HUD + 6);
    rowY += 46;

    const matchups = [
      { fromKey: this.cellTextureKeys.T, toKey: this.cellTextureKeys.V },
      { fromKey: this.cellTextureKeys.K, toKey: this.cellTextureKeys.H },
    ];
    matchups.forEach((m) => {
      const fromX = panelX - 110;
      const toX = panelX + 110;
      this.addLegendIcon(fromX, rowY, m.fromKey, iconDiameter);
      this.add
        .text((fromX + toX) / 2, rowY, '\u2192', {
          fontFamily: 'Arial',
          fontSize: '30px',
          color: '#67e8f9',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(DEPTHS.HUD + 6);
      this.addLegendIcon(toX, rowY, m.toKey, iconDiameter);
      rowY += rowHeight;
    });
  }

  // Draws one cell's actual baked texture at a small fixed on-screen
  // size, regardless of that cell type's configured radius -- reads the
  // texture's real pixel size so the icon always ends up the same
  // diameter instead of guessing a scale from the (possibly
  // level-customized) radius.
  addLegendIcon(x, y, texKey, targetDiameter) {
    const tex = this.textures.get(texKey);
    const source = tex && tex.source && tex.source[0];
    const width = source ? source.width : targetDiameter * 5;
    return this.add
      .image(x, y, texKey)
      .setScale(targetDiameter / width)
      .setDepth(DEPTHS.HUD + 6);
  }

  // A looping hand-drag animation demonstrating the exact gesture the
  // current tutorial step needs: fade in + "press" pulse at the source
  // cell, glide to the target cell, a small "release" bounce plus a
  // "Drag me here" label, a pause, fade out, then repeat. The route
  // (T -> Cancer Cell or K -> Smart Cancer Cell) and visibility are
  // driven by updateDragHintForStep(), called from setTutorialMessage().
  //
  // Route is stored as cell KEYS (CELL_KEYS.T etc), not fixed
  // coordinates -- every read goes through getDragHintPositions(),
  // which looks up each cell's *current* x/y. If the player drags a
  // T-cell, K-cell, or either cancer cell somewhere else on the board,
  // the guide line, the label, and the hand's glide target all follow
  // it there on the very next frame, instead of staying pinned to
  // wherever that cell originally spawned.
  createTutorialDragHint() {
    this.dragHintStopped = false;
    this.dragHintVisible = false;
    this.dragHintLine = this.add.graphics().setDepth(DEPTHS.HUD + 19);
    this.dragHintHand = this.add
      .text(0, 0, '\u{1F446}', { fontSize: '46px' })
      .setOrigin(0.3, 0.15)
      .setDepth(DEPTHS.HUD + 20)
      .setAlpha(0);
    this.dragHintLabel = this.add
      .text(0, 0, STRINGS.tutorial.dragHintLabel, {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#facc15',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.HUD + 20)
      .setAlpha(0);
    this.setDragHintRoute(CELL_KEYS.T, CELL_KEYS.V);
    this.playDragHintLoop();
  }

  // Finds the first alive cell of the given key and returns its live
  // position -- not a cached/spawn position -- so callers always see
  // wherever the player last dragged it to.
  getCellPosByKey(key) {
    if (!this.cellManager) return null;
    const cell = this.cellManager.getAliveCells().find((c) => c.key === key);
    return cell ? { x: cell.x, y: cell.y } : null;
  }

  // Resolves the hint's current from/to route to live coordinates,
  // falling back to the cell's original tutorial spawn spot only in
  // the edge case where it can't be found alive (e.g. destroyed at the
  // exact moment the hint reads it).
  getDragHintPositions() {
    if (!this.dragHintFromKey || !this.dragHintToKey) return null;
    const from =
      this.getCellPosByKey(this.dragHintFromKey) ||
      TUTORIAL_LAYOUT[CELL_KEY_TO_TUTORIAL_LAYOUT[this.dragHintFromKey]];
    const to =
      this.getCellPosByKey(this.dragHintToKey) ||
      TUTORIAL_LAYOUT[CELL_KEY_TO_TUTORIAL_LAYOUT[this.dragHintToKey]];
    if (!from || !to) return null;
    return { from, to };
  }

  setDragHintRoute(fromKey, toKey) {
    this.dragHintFromKey = fromKey;
    this.dragHintToKey = toKey;
  }

  setDragHintVisible(visible) {
    this.dragHintVisible = visible;
    if (!visible) {
      if (this.dragHintLine) this.dragHintLine.clear();
      if (this.dragHintHand) this.dragHintHand.setAlpha(0);
      if (this.dragHintLabel) this.dragHintLabel.setAlpha(0);
    }
  }

  updateDragHintForStep(index) {
    if (!this.dragHintHand) return;
    if (index === 0) {
      this.setDragHintRoute(CELL_KEYS.T, CELL_KEYS.V);
      this.setDragHintVisible(true);
    } else if (index === 2) {
      this.setDragHintRoute(CELL_KEYS.K, CELL_KEYS.H);
      this.setDragHintVisible(true);
    } else {
      this.setDragHintVisible(false);
    }
  }

  // Redraws the dashed guide line and repositions the label every
  // frame from live cell positions. Deliberately separate from the
  // hand's glide tween below -- the line/label should track a dragged
  // cell instantly, with no easing, even while the hand itself is
  // mid-animation or paused between cycles.
  updateDragHintVisual() {
    if (!this.dragHintLine || !this.dragHintVisible) return;
    const pos = this.getDragHintPositions();
    if (!pos) return;
    this.dragHintLine.clear();
    this.dragHintLine.lineStyle(3, 0xfacc15, 0.35);
    this.dragHintLine.lineBetween(pos.from.x, pos.from.y, pos.to.x, pos.to.y);
    if (this.dragHintLabel)
      this.dragHintLabel.setPosition(pos.to.x, pos.to.y - 74);
  }

  playDragHintLoop() {
    if (this.dragHintStopped || !this.dragHintHand) return;
    if (!this.dragHintVisible) {
      this.time.delayedCall(300, () => this.playDragHintLoop());
      return;
    }
    const startPos = this.getDragHintPositions();
    if (!startPos) {
      this.time.delayedCall(300, () => this.playDragHintLoop());
      return;
    }
    this.dragHintHand
      .setPosition(startPos.from.x, startPos.from.y)
      .setScale(1)
      .setAlpha(0);
    this.dragHintLabel.setAlpha(0);
    this.tweens.add({
      targets: this.dragHintHand,
      alpha: 1,
      scale: 0.92,
      duration: 260,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (this.dragHintStopped) return;
        // A plain 0->1 progress proxy, not a direct x/y tween -- lets
        // onUpdate re-read live cell positions every tick and re-aim
        // the glide, so a cell dragged mid-flight doesn't leave the
        // hand heading for a stale spot.
        const progress = { t: 0 };
        this.tweens.add({
          targets: progress,
          t: 1,
          duration: 950,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            if (this.dragHintStopped || !this.dragHintHand) return;
            const live = this.getDragHintPositions() || startPos;
            this.dragHintHand.x = Phaser.Math.Linear(
              live.from.x,
              live.to.x,
              progress.t,
            );
            this.dragHintHand.y = Phaser.Math.Linear(
              live.from.y,
              live.to.y,
              progress.t,
            );
          },
          onComplete: () => {
            if (this.dragHintStopped) return;
            this.tweens.add({
              targets: this.dragHintHand,
              scale: 1.15,
              duration: 140,
              yoyo: true,
              ease: 'Quad.easeOut',
            });
            this.tweens.add({
              targets: this.dragHintLabel,
              alpha: 1,
              duration: 200,
            });
            this.time.delayedCall(500, () => {
              if (this.dragHintStopped) return;
              this.tweens.add({
                targets: [this.dragHintHand, this.dragHintLabel],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                  if (this.dragHintStopped) return;
                  this.time.delayedCall(450, () => this.playDragHintLoop());
                },
              });
            });
          },
        });
      },
    });
  }

  setTutorialMessage(index) {
    if (!this.tutorialText || this.tutorialStepIndex === index) return;
    this.tutorialStepIndex = index;
    const messages = STRINGS.tutorial.steps;
    this.tutorialText.setText(messages[index] || messages[0]);
    this.tweens.add({
      targets: [this.tutorialPanel, this.tutorialText],
      scaleX: 1.02,
      scaleY: 1.02,
      duration: 120,
      yoyo: true,
    });
    this.updateDragHintForStep(index);
  }

  updateTutorialProgress() {
    if (!this.isTutorialLevel() || !this.cellManager || this.isFinished) return;
    const visibleCancer = this.cellManager
      .getAliveCells()
      .find((c) => c.key === CELL_KEYS.V);
    const hiddenCancer = this.cellManager
      .getAliveCells()
      .find((c) => c.key === CELL_KEYS.H);
    const vHasT =
      visibleCancer &&
      visibleCancer.attachedCells &&
      Array.from(visibleCancer.attachedCells).some(
        (c) => c.key === CELL_KEYS.T && c.isAlive,
      );
    const hHasK =
      hiddenCancer &&
      hiddenCancer.attachedCells &&
      Array.from(hiddenCancer.attachedCells).some(
        (c) => c.key === CELL_KEYS.K && c.isAlive,
      );
    if (!visibleCancer && !hiddenCancer) {
      this.setTutorialMessage(4);
      this.finishGame(true, STRINGS.tutorial.completeReason);
      return;
    }
    if (visibleCancer && !vHasT) {
      this.setTutorialMessage(0);
      return;
    }
    if (visibleCancer && vHasT) {
      this.setTutorialMessage(1);
      return;
    }
    if (!visibleCancer && hiddenCancer && !hHasK) {
      this.setTutorialMessage(2);
      return;
    }
    if (hiddenCancer && hHasK) this.setTutorialMessage(3);
  }

  create() {
    // Ambient animated backdrop, running as its own parallel scene so it
    // can keep its own camera/update loop separate from gameplay.
    // sendToBack places it behind GameScene in the render order, so the
    // play-area dish, cells, and HUD all draw on top of it.
    this.scene.launch('TissueScene');
    this.scene.sendToBack('TissueScene');
    // Cell size/color are configurable per level now, so bake (or reuse
    // an already-cached) texture set for this exact config before any
    // Cell is created -- Cell.getTextureKeyForCurrentState() reads the
    // result back off this.cellTextureKeys.
    this.cellTextureKeys = bakeAllCellTextures(this, this.configData);
    // this.createCleanBackground();
    this.elapsedTime = 0;
    this.remainingTime = this.getConfiguredPlayTime();
    this.isFinished = false;
    this.cellManager = new CellManager(this, this.configData);
    this.healthManager = new HealthManager(this, this.configData);
    this.hud = new HtmlHUD(this, this.configData);
    this.cellManager.createInitialCells();
    if (this.isTutorialLevel()) this.createTutorialOverlay();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanUp, this);
  }

  createCleanBackground() {
    const bg = this.add.graphics();
    bg.setDepth(DEPTHS.TISSUE_BG);
    bg.fillGradientStyle(0xffffff, 0xffffff, 0xf8fbff, 0xeef6ff, 1);
    bg.fillRoundedRect(
      PLAY_AREA.x,
      PLAY_AREA.y,
      PLAY_AREA.width,
      PLAY_AREA.height,
      24,
    );
    bg.lineStyle(1, 0x94a3b8, 0.13);
    for (let x = PLAY_AREA.x + 80; x < PLAY_AREA.x + PLAY_AREA.width; x += 80) {
      bg.lineBetween(
        x,
        PLAY_AREA.y + 18,
        x,
        PLAY_AREA.y + PLAY_AREA.height - 18,
      );
    }
    for (
      let y = PLAY_AREA.y + 80;
      y < PLAY_AREA.y + PLAY_AREA.height;
      y += 80
    ) {
      bg.lineBetween(
        PLAY_AREA.x + 18,
        y,
        PLAY_AREA.x + PLAY_AREA.width - 18,
        y,
      );
    }
    bg.lineStyle(4, 0xcbd5e1, 0.85);
    bg.strokeRoundedRect(
      PLAY_AREA.x,
      PLAY_AREA.y,
      PLAY_AREA.width,
      PLAY_AREA.height,
      24,
    );
    bg.lineStyle(2, 0xffffff, 0.75);
    bg.strokeRoundedRect(
      PLAY_AREA.x + 7,
      PLAY_AREA.y + 7,
      PLAY_AREA.width - 14,
      PLAY_AREA.height - 14,
      18,
    );
  }

  update(time, delta) {
    if (this.isFinished) return;
    const dt = delta / 1000;
    this.elapsedTime += dt;
    this.remainingTime = this.getConfiguredPlayTime() - this.elapsedTime;
    this.cellManager.update(dt);
    this.healthManager.update(dt);
    this.hud.update();
    this.updateTutorialProgress();
    if (this.isTutorialLevel()) this.updateDragHintVisual();

    if (
      !this.isTutorialLevel() &&
      this.configData.winOnAllCancerDestroyed &&
      this.isAllCancerDestroyed()
    ) {
      this.finishGame(true, STRINGS.gameScene.allCancerDestroyedReason);
      return;
    }

    if (
      !this.isTutorialLevel() &&
      this.remainingTime <= 0 &&
      this.healthManager.playerHealth > this.healthManager.dangerThreshold
    )
      this.finishGame(true, STRINGS.gameScene.survivedFullTimeReason);
    else if (!this.isTutorialLevel() && this.remainingTime <= 0)
      this.finishGame(false, STRINGS.gameScene.timeUpDangerReason);
  }

  isAllCancerDestroyed() {
    const counts = this.cellManager.getCancerCounts();
    return counts.visible + counts.hidden === 0;
  }

  showFloatingText(x, y, message, color) {
    const text = this.add
      .text(x, y, message, {
        fontFamily: 'Arial',
        fontSize: '20px',
        color,
        fontStyle: 'bold',
        stroke: '#020617',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(DEPTHS.FLOATING_TEXT);
    this.tweens.add({
      targets: text,
      y: y - 34,
      alpha: 0,
      duration: 950,
      ease: 'Sine.easeOut',
      onComplete: () => text.destroy(),
    });
  }

  finishGame(won, reason) {
    if (this.isFinished) return;
    this.isFinished = true;
    this.time.delayedCall(500, () => {
      this.scene.start('ResultScene', {
        won,
        reason,
        config: this.configData,
        health: Math.ceil(this.healthManager.playerHealth),
        survived: Math.floor(this.elapsedTime),
      });
    });
  }

  cleanUp() {
    this.dragHintStopped = true;
    this.tweens.killAll();
    this.time.removeAllEvents();
    if (this.scene.isActive('TissueScene')) this.scene.stop('TissueScene');
    if (this.hud) this.hud.destroy();
    this.hud = null;
    if (this.cellManager) this.cellManager.destroy();
    this.cellManager = null;
  }
}

class ResultScene extends Phaser.Scene {
  constructor() {
    super('ResultScene');
  }
  init(data) {
    this.resultData = data || {};
  }

  create() {
    const won = !!this.resultData.won;
    const r = STRINGS.result;
    this.add
      .rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, won ? 0x052e16 : 0x2a0d12)
      .setOrigin(0);
    this.add
      .rectangle(960, 520, 920, 580, 0x08162a, 0.94)
      .setStrokeStyle(4, won ? 0x86efac : 0xfca5a5);
    this.add
      .text(960, 330, won ? r.won : r.lost, {
        fontFamily: 'Arial',
        fontSize: '72px',
        color: won ? '#86efac' : '#fca5a5',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    this.add
      .text(960, 420, this.resultData.reason || '', {
        fontFamily: 'Arial',
        fontSize: '28px',
        color: '#e2e8f0',
        align: 'center',
        wordWrap: { width: 760 },
      })
      .setOrigin(0.5);
    this.add
      .text(
        960,
        535,
        r.levelPrefix +
          (this.resultData.config
            ? this.resultData.config.name
            : r.unknownLevel) +
          r.finalHealthPrefix +
          (this.resultData.health || 0) +
          r.survivedPrefix +
          (this.resultData.survived || 0) +
          r.survivedSuffix,
        {
          fontFamily: 'Arial',
          fontSize: '28px',
          color: '#cbd5e1',
          align: 'center',
          lineSpacing: 14,
        },
      )
      .setOrigin(0.5);
    this.button(780, 725, r.restartLevel, 300, 72, () =>
      this.scene.start('GameScene', {
        config: ConfigManager.getCurrentConfig(),
      }),
    );
    this.button(1140, 725, r.configurator, 300, 72, () =>
      this.scene.start('ConfigScene'),
    );
    this.button(960, 825, r.levelSelect, 300, 72, () =>
      this.scene.start('LevelSelectScene'),
    );
  }

  button(x, y, label, w, h, cb) {
    const rect = this.add
      .rectangle(x, y, w, h, 0x22c55e)
      .setStrokeStyle(3, 0xbbf7d0)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(x, y, label, {
        fontFamily: 'Arial',
        fontSize: '25px',
        color: '#052e16',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);
    rect.on('pointerover', () => rect.setFillStyle(0x67e8f9));
    rect.on('pointerout', () => rect.setFillStyle(0x22c55e));
    rect.on('pointerdown', cb);
  }
}

const phaserConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  transparent: true,
  backgroundColor: 'rgba(0,0,0,0)',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  dom: { createContainer: true },
  scene: [
    BootScene,
    ConfigScene,
    LevelSelectScene,
    TissueScene,
    GameScene,
    ResultScene,
  ],
};

window.addEventListener('load', () => new Phaser.Game(phaserConfig));
