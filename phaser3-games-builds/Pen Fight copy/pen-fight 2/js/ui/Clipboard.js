//==================================================
// Clipboard.js
//==================================================
// Copies text to the clipboard, working over both HTTPS and plain
// HTTP — this game is explicitly meant to be played over a LAN
// address too (see server/server.mjs's own boot message, "Friends on
// your network: http://<your-lan-ip>:PORT"), where the modern
// navigator.clipboard API doesn't exist at all: browsers only expose
// it in a "secure context" (HTTPS, or localhost). Without this file,
// NetGameScene.js's old copyInviteLink() would silently no-op on any
// LAN game (the `if (navigator.clipboard)` guard just skipped the
// copy) while still telling the player "link copied!" — nothing ever
// actually reached their clipboard.
//
// Falls back to the older execCommand('copy') technique via a hidden
// off-screen textarea (still broadly supported, and works over plain
// HTTP), and only reports success when a copy actually happened —
// callers should show their own honest fallback (e.g. the raw link,
// selectable) when this resolves false rather than claim it worked.
//==================================================

export async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);

      return true;
    } catch {
      // Denied/unsupported despite existing — fall through to the
      // legacy path below rather than giving up.
    }
  }

  try {
    const textarea = document.createElement('textarea');

    textarea.value = text;
    textarea.setAttribute('readonly', '');

    // Off-screen, not display:none — execCommand('copy') needs the
    // element focusable/selectable, which a hidden element isn't.
    textarea.style.position = 'fixed';
    textarea.style.top = '-1000px';
    textarea.style.left = '-1000px';

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    const ok = document.execCommand('copy');

    document.body.removeChild(textarea);

    return ok;
  } catch {
    return false;
  }
}
