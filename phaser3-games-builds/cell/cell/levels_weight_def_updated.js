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
