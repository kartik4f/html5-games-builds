//==================================================
// CheerButton.js
//==================================================
// The spectator Cheer panel — a small vertical stack of preset emoji
// buttons docked to the left-middle of the screen (see
// NetGameScene.js's createHud(), the only caller). Spectators only
// (see NetGameScene.js's this.myPlayerId === null guard).
//
// Picking one sends a 'cheer' message carrying that emoji to the
// server (see GameRoom.mjs's _onCheer()), which validates it against
// its own CHEER_EMOJIS whitelist and broadcasts it back to the whole
// room so everyone's confetti + emoji pop (see fx/Confetti.js) and
// cheer sound (see AudioFX.js's playCheer()) fire in sync, not just
// the sender's own screen.
//
// "1 at a time": picking any single emoji starts one shared cooldown
// across the whole panel — every button disables together, so a
// spectator can't queue up a second cheer (same emoji or different)
// until it elapses. The server enforces the same cooldown
// independently (see GameRoom.mjs's CHEER_COOLDOWN_MS) — this is a UX
// affordance, not the real limit.
//==================================================

const COOLDOWN_MS = 5000;

// Must match GameRoom.mjs's CHEER_EMOJIS exactly (same values, order
// doesn't matter for validation but keeping it identical avoids any
// "why is the order different" confusion when reading both files
// side by side). This client-side copy is only ever used to build the
// picker UI — the server copy is what actually gets enforced.
const CHEER_EMOJIS = ['🎉', '👏', '🔥', '❤️', '😂'];

export function createCheerButton(scene, x, y, onCheer) {
  const buttonsHtml = CHEER_EMOJIS.map(
    (emoji) => `<div class="cheer-emoji-btn" data-emoji="${emoji}">${emoji}</div>`,
  ).join('');

  const dom = scene.add
    .dom(x, y)
    .createFromHTML(`<div class="hud-cheer-panel">${buttonsHtml}</div>`)
    // Left-middle anchor: x,y is the vertical center of the panel's
    // left edge, matching how NetGameScene.js positions it (left
    // margin, GAME.HEIGHT / 2).
    .setOrigin(0, 0.5);
  dom.setDepth(1000);

  const panelEl = dom.node.children[0];
  const buttonEls = Array.from(panelEl.querySelectorAll('.cheer-emoji-btn'));

  let cooldownUntil = 0;
  let tickEvent = null;
  let activeBtn = null;

  function render() {
    const remainingMs = cooldownUntil - Date.now();

    if (remainingMs > 0) {
      panelEl.classList.add('disabled');

      if (activeBtn) activeBtn.textContent = `${Math.ceil(remainingMs / 1000)}s`;

      return;
    }

    panelEl.classList.remove('disabled');

    if (activeBtn) {
      activeBtn.textContent = activeBtn.dataset.emoji;
      activeBtn = null;
    }

    if (tickEvent) {
      tickEvent.remove();
      tickEvent = null;
    }
  }

  for (const btn of buttonEls) {
    btn.addEventListener('click', () => {
      if (Date.now() < cooldownUntil) return;

      onCheer(btn.dataset.emoji);

      activeBtn = btn;
      cooldownUntil = Date.now() + COOLDOWN_MS;
      render();

      if (tickEvent) tickEvent.remove();

      tickEvent = scene.time.addEvent({ delay: 250, loop: true, callback: render });
    });
  }

  function destroy() {
    if (tickEvent) tickEvent.remove();
  }

  return { dom, destroy };
}
