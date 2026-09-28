# Tikora hub integration — Color Chaos

Color Chaos is a game in the **Tikora hub** (the Windows desktop app). Live TikTok events
reach the game, and gifts fire in-game effects.

| Field | Value |
|---|---|
| Game slug | `color-chaos` |
| Type | `webapp` |
| Port | `3040` |
| Launch | `start-game.bat` (`npm run serve`) |
| Relay | `ws://127.0.0.1:27016/` |
| Client | `http://127.0.0.1:27016/hub-client.js` |

## How it connects

`src/js/integrations/connector.js`:

1. Loads `http://127.0.0.1:27016/hub-client.js`, then calls
   `connectHub({ url, gameSlug, apiKey, capabilities, onChat, onEffect, onStatus })`.
2. If the hub is unreachable, falls back to the built-in **offline mock** (simulated chat)
   so the game stays playable.

Config resolution (first wins): URL query `?game=&key=&lang=&canvas=` →
`window.TIKORA_GAME_CONFIG` → defaults. Tikora's launcher injects `?game=&key=`.

> A key is only needed for routed `effect`s. Without a key the game still receives the
> broadcast event stream (chat / gifts), so comments register even before the key is set.

## Events consumed (hub -> game)

| Hub event | Handled as |
|---|---|
| `event` `type: chat` | a color command: `"12 green"` / `"12 3"` (see parser) |
| `event` `type: gift` | **ignored** — gifts become effects via the hub; the game never sees gift names as logic |
| `effect` | run a power-up, then `ackEffect(id)` |
| `like` / `follow` / `share` / `subscribe` / `member` | reserved |

> **No gift names in code.** The game only understands `effect` keys. Gift → effect
> mappings are created entirely by the streamer in the Tikora hub UI.

## Effect keys this game understands

| `effect_key` | Effect | Optional payload |
|---|---|---|
| `premium_color` | apply a premium color (gold/neon/rainbow) to a region | `{ "color": "gold" }` |
| `multi_fill` | fill N uncolored regions with random colors | `{ "count": 3 }` |
| `clear_region` | clear one colored region back to white | – |
| `wipe_canvas` | clear the whole canvas | – |
| `overwrite` | recolor N locked regions (overrides lock) | `{ "count": 1 }` |
| `lock_region` | protect a region from overwrite | – |
| `rename_region` | label a region with the gifter's name | `{ "name": "..." }` |
| `rainbow_sweep` | fill a series of regions with random colors | `{ "count": 5 }` |

Declared in `tikora.manifest.json` (the hub reads it, so effects appear even when the game
is offline) and mirrored in `CAPABILITIES` in `src/js/main.js`.

## State reported (game -> hub)

`hub.reportState(...)` on changes:

```js
{ ready: true, phase: "playing", canvas: "canvas-demo", mode: "lock" | "chaos",
  colored: 34, total: 120 }
```

## Testing without the desktop app

- `npm test` covers the core logic (parser, engine, rate limiting) with Node's test runner.
- With no hub running, the game auto-uses the offline mock (simulated chat every 3s).
- Press **`** for the host dock: change mode, inject a color, simulate, reset.

## Hub-side registration (one-time, in the Tikora repo)

Add a `BUILTIN_GAMES` entry in `electron/data/database.cjs` →
`ensureBuiltinIntegrations()`:

```js
{
  name: 'Color Chaos',
  slug: 'color-chaos',
  projectDir: 'C:\\dev\\color-chaos',
  batName: 'start-game.bat',
  type: 'webapp',
  icon: '🎨',
  description: 'Collaborative numbered coloring game for TikTok LIVE.',
  price: 0,
  port: 3040,
}
```

No default gift→effect mappings are seeded — the streamer creates them in the Hub UI.
