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
