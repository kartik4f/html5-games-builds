//==================================================
// DayNightToggle.js
//==================================================
// A real sliding switch — flips the table between day and night theme
// (see fx/DayNight.js for the actual lighting swap). Built on the
// shared ui/SwitchToggle.js widget. Shared by GameScene.js (local,
// docked under the flick toggle) and NetGameScene.js (online, docked
// under the Home button — its own top-right column is already full of
// the flick toggle + win-streak + spectator badges).
//==================================================

import { createSwitchToggle } from './SwitchToggle.js';

export function createDayNightToggle(scene, x, y, initialMode, onToggle) {
  const switchEl = createSwitchToggle(scene, x, y, {
    initialOn: initialMode === 'night',
    onLabel: 'NIGHT',
    offLabel: 'DAY',
    onIcon: '🌙',
    offIcon: '☀️',
    extraClass: 'hud-switch--daynight',
    onToggle,
    isOn: (mode) => mode === 'night',
  });

  return {
    dom: switchEl.dom,
    setMode: (mode) => switchEl.setOn(mode === 'night'),
  };
}
