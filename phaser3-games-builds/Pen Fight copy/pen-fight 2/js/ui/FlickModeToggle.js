//==================================================
// FlickModeToggle.js
//==================================================
// A real sliding switch — top-right corner — that lets a player flip
// between pull-back and swipe flick feel at any point during play, not
// just on the pre-match setup screen. Built on the shared
// ui/SwitchToggle.js widget. Shared by GameScene.js (local) and
// NetGameScene.js (online); each owns its own notion of "what does
// toggling actually change" (see their respective call sites) — this
// file only builds the widget and its label/icon set.
//==================================================

import { createSwitchToggle } from './SwitchToggle.js';

export function createFlickModeToggle(scene, x, y, initialMode, onToggle) {
  const switchEl = createSwitchToggle(scene, x, y, {
    initialOn: initialMode === 'swipe',
    onLabel: 'SWIPE',
    offLabel: 'PULL',
    onIcon: '👆',
    offIcon: '🎯',
    extraClass: 'hud-switch--flick',
    onToggle,
    isOn: (mode) => mode === 'swipe',
  });

  return {
    dom: switchEl.dom,
    setMode: (mode) => switchEl.setOn(mode === 'swipe'),
  };
}
