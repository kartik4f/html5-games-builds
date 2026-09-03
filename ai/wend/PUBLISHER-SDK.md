# PlayLearn Publisher SDK

A small `postMessage`-based JavaScript SDK that lets a game running inside
the PlayLearn player integrate with the app: read the player's age group,
language and accessibility settings, know whether ads are enabled for this
session, and report the player's score/progress back to PlayLearn so it
feeds into the child's skill profile — the same way every built-in
PlayLearn game already works.

This is the recommended way to build a game for PlayLearn. It is **not** a
network API — your game never calls out to a PlayLearn server directly.
Everything happens through `window.postMessage` between your game's iframe
and the PlayLearn player that hosts it, which is what makes it work
offline, instantly, and without any API keys or publisher accounts.

## Quick start

1. Include the SDK script, served by PlayLearn itself, before your own
   game code:

   ```html
   <script src="/uploads/sdk/playlearn-sdk.js"></script>
   ```

2. Call `PlayLearnSDK.init(...)` as early as possible to receive the
   player's context:

   ```html
   <script>
     PlayLearnSDK.init(function (ctx) {
       console.log(ctx.ageGroupId, ctx.difficulty, ctx.prefs, ctx.adsEnabled);
       // ...size your game / pick a difficulty tier / apply prefs...
     });
   </script>
   ```

3. When the player finishes a round, report the result:

   ```js
   PlayLearnSDK.reportComplete({ performance: 0.8, score: 120, levelReached: 3 });
   ```

That's the whole integration. Package your game as a ZIP with an
`index.html` at its root (plus any assets it needs) and upload it from the
**Creator → Upload a game** tab — PlayLearn extracts it, serves it under
`/uploads/games/<your-slug>/`, and iframes it in the player exactly like
every game shipped with the app.

## Where your game runs

Your game is loaded in a sandboxed iframe:

```
sandbox="allow-scripts allow-pointer-lock allow-forms allow-popups"
```

Notably **no** `allow-same-origin` — your game's iframe has an opaque
origin. That's intentional (it keeps an uploaded game from ever reaching
into the PlayLearn app itself) and it's why the only way to talk to the
host is `postMessage`, not `fetch`, cookies, or `localStorage` shared with
the parent page. Build your game as a fully self-contained bundle — inline
or bundle your own CSS/JS/images/fonts, since your game generally won't
have reliable third-party network access from inside the sandbox either.

## The `init` context

`PlayLearnSDK.init(callback)` registers your callback and tells the host
your game is ready to receive its context. The host may take a moment to
reply — start rendering your game immediately with sensible defaults and
just re-apply the real values once `callback` fires (most games can get
away with reading whatever arrived by the time the player actually
interacts).

```ts
{
  contentId: string;
  sessionId: string | null;
  ageGroupId: string;
  classLabel?: string;
  language: string;        // e.g. 'en' | 'hi'
  difficulty: number;      // 1 (easiest) .. 5 (hardest)
  prefs: {
    darkMode: boolean;
    muteAudio: boolean;
    reduceMotion: boolean;
    highContrast: boolean;
    largeText: boolean;
  };
  adsEnabled: boolean;      // true when this content is on the free-ads tier
}
```

Use `difficulty` to scale your game's actual difficulty (grid size, time
limits, problem complexity, whatever fits your game) rather than exposing
your own separate difficulty picker — PlayLearn already knows what's
appropriate for this child. Respect `prefs`: skip/shorten animations under
`reduceMotion`, mute any sound under `muteAudio`, and switch to a
high-contrast, larger-text presentation when those flags are set. Show a
labeled "Advertisement" placeholder only when `adsEnabled` is true — do
not show one otherwise, and do not load any third-party ad SDK (PlayLearn
doesn't have live ad serving wired in yet; this is a placeholder contract
for when it does).

You can also read the latest context at any time without a new callback:

```js
const ctx = PlayLearnSDK.getContext(); // null until init's callback has fired once
```

## Reporting results

```js
PlayLearnSDK.reportComplete({
  performance: 0.8,     // 0..1 — how well they did. Required.
  score: 120,            // optional, game-specific
  levelReached: 3,        // optional, game-specific
});
```

Call this exactly once per finished round/session. It ends the PlayLearn
session the same way any built-in game's completion does, and the
`performance` value feeds directly into the child's skill profile for the
skills this content is tagged with. `performance` is clamped to `[0, 1]`
host-side regardless of what you send.

Optional extras:

```js
PlayLearnSDK.reportProgress({ anything: 'you want' }); // informational only, not persisted
PlayLearnSDK.requestClose();                            // ask the host to close the player without recording a result
```

You generally don't need `requestClose()` — the player already shows its
own close (✕) button on top of every game, so you don't need to build your
own quit/back button.

## Full message contract

If you'd rather implement the `postMessage` handshake yourself instead of
using the SDK helper functions (e.g. from a non-JS game engine that only
gives you access to raw `postMessage`), here's the wire format:

**Host → Game** (sent once, right after your game signals it's ready):

```json
{ "type": "playlearn:init", "payload": { "...": "the context object above" } }
```

**Game → Host:**

```json
{ "type": "playlearn:ready" }
{ "type": "playlearn:progress", "payload": { "...": "anything, informational only" } }
{ "type": "playlearn:complete", "payload": { "performance": 0.8, "score": 120, "levelReached": 3 } }
{ "type": "playlearn:requestClose" }
```

Send `playlearn:ready` as soon as your script runs; the host replies with
`playlearn:init`. The SDK (`/uploads/sdk/playlearn-sdk.js`) is a thin,
dependency-free wrapper around exactly this — reading its source is a fine
way to see a complete reference implementation.

## Examples in the wild

Every default game shipped with PlayLearn — Memory Match, Reflex Rush,
Pattern Sequence, Word Scramble, Math Blitz, Shape Match, and Speed Sort —
is built against this exact SDK and contract. Their bundles live under
`backend/uploads/games/<slug>/index.html` in the PlayLearn repo and are a
good reference for a real, working integration (context handling with
sensible defaults, prefs-aware styling, an ads placeholder, and a single
guarded `reportComplete` call per round).
