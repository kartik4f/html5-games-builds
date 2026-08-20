//==================================================
// SwitchToggle.js
//==================================================
// A reusable track+thumb switch control — shared by
// ui/FlickModeToggle.js (swipe/pull-back) and ui/DayNightToggle.js
// (day/night), the same underlying widget wearing two different icon/
// label sets. A real sliding switch reads clearly as "this is a
// two-state toggle" at a glance, unlike a plain clickable text pill.
//==================================================

export function createSwitchToggle(scene, x, y, options) {
  const {
    initialOn,
    onLabel,
    offLabel,
    onIcon = '',
    offIcon = '',
    extraClass = '',
    onToggle, // () => the new mode/value; caller owns what "on" means
    isOn, // (value) => boolean — maps onToggle()'s return value to on/off
  } = options;

  const dom = scene.add
    .dom(x, y)
    .createFromHTML(
      `<div class="hud-switch ${extraClass}">` +
        '<span class="hud-switch-icon"></span>' +
        '<span class="hud-switch-label"></span>' +
        '<span class="hud-switch-track"><span class="hud-switch-thumb"></span></span>' +
        '</div>',
    )
    .setOrigin(0, 0);
  dom.setDepth(1000);

  const el = dom.node.children[0];
  const iconEl = el.querySelector('.hud-switch-icon');
  const labelEl = el.querySelector('.hud-switch-label');

  let on = !!initialOn;

  function render() {
    iconEl.textContent = on ? onIcon : offIcon;
    labelEl.textContent = on ? onLabel : offLabel;
    el.classList.toggle('on', on);
  }

  render();

  el.addEventListener('click', () => {
    const value = onToggle();

    on = isOn(value);
    render();
  });

  return {
    dom,
    setOn: (next) => {
      on = !!next;
      render();
    },
  };
}
