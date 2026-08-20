//==================================================
// ui/Button.js
//==================================================

import { THEME } from '../Theme.js';

// Dark-theme button with rounded corners, a bordered flat fill, hover and
// press feedback, and an "active" (selected) / "disabled" state. Returns a
// Container with helper methods attached.
//
// `activeColor` lets a button (e.g. a tab) use its own accent color for
// the active-state fill instead of the default white.
export function createButton(scene, x, y, w, h, label, onClick, fontSize = '15px', activeColor = THEME.BUTTON_ACTIVE_BG) {
  const container = scene.add.container(x, y);

  const bg = scene.add.graphics();
  const drawBg = (fill, border) => {
    bg.clear();
    bg.fillStyle(fill, 1);
    bg.fillRoundedRect(-w / 2, -h / 2, w, h, 10);
    bg.lineStyle(2, border, 1);
    bg.strokeRoundedRect(-w / 2 + 1, -h / 2 + 1, w - 2, h - 2, 9);
  };
  drawBg(THEME.BUTTON, THEME.BUTTON_BORDER);

  const text = scene.add
    .text(0, 0, label, {
      fontFamily: THEME.FONT,
      fontSize,
      fontStyle: '600',
      color: THEME.TEXT,
    })
    .setOrigin(0.5);

  container.add([bg, text]);
  container.setSize(w, h);
  // NOTE: Container hit-testing resolves the shape against the object's
  // top-left, not its center — a hitArea drawn at (-w/2,-h/2) like the
  // button's own graphics ends up sitting a further half-width/height off
  // to the top-left of the visible button. (0,0,w,h) is what actually
  // lines up with the rendered shape.
  container.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);

  container._active = false;
  container._disabled = false;
  container._hover = false;

  container.setActive2 = (isActive) => {
    container._active = isActive;
    container._refresh();
  };

  container.setDisabled = (isDisabled) => {
    container._disabled = isDisabled;
    container._refresh();
  };

  container._refresh = () => {
    if (container._active) {
      drawBg(activeColor, activeColor);
      text.setColor(THEME.BUTTON_ACTIVE_TEXT);
    } else if (container._hover && !container._disabled) {
      drawBg(THEME.BUTTON_HOVER, THEME.BUTTON_BORDER);
      text.setColor(THEME.TEXT);
    } else {
      drawBg(THEME.BUTTON, THEME.BUTTON_BORDER);
      text.setColor(THEME.TEXT);
    }
    container.setAlpha(container._disabled ? THEME.BUTTON_DISABLED_ALPHA : 1);
    container.input.enabled = !container._disabled;
  };

  container.on('pointerover', () => {
    if (container._disabled) return;
    container._hover = true; container._refresh();
    scene.input.setDefaultCursor('pointer');
  });
  container.on('pointerout', () => {
    container._hover = false; container._refresh();
    scene.input.setDefaultCursor('default');
  });

  container.on('pointerdown', () => {
    if (container._disabled) return;
    scene.tweens.add({ targets: container, scale: 0.94, duration: 70, ease: 'Cubic.easeOut' });
  });
  const release = () => {
    if (container._disabled) return;
    scene.tweens.add({ targets: container, scale: 1, duration: 110, ease: 'Back.easeOut' });
  };
  container.on('pointerup', () => {
    release();
    if (!container._disabled) onClick();
  });
  container.on('pointerupoutside', release);

  container.bg = bg;
  container.label = text;

  return container;
}
