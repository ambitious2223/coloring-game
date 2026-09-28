# Architecture

Color Chaos is a **static web game** (no build step) that runs in the streamer's browser
and talks to the local Tikora hub over WebSocket.

```
TikTok LIVE
  -> Tikora hub (Electron app, port 27016)
       - broadcasts events (chat / gift / like / ...)
       - routes gift-triggered effects to this game (by slug + api key)
  -> Color Chaos (browser, port 45125)
       - loads hub-client.js from the hub, calls connectHub(...)
       - onChat  -> parse "region color" -> engine -> board
       - onEffect -> run power-up -> board
       - reportState -> hub UI
```

If the hub is unreachable, the connector falls back to an **offline mock** that emits
simulated viewer chat every 3s, so the game is always demoable and testable.

## Modules

```
src/js/
  config.js            ?game=&key=&lang=&canvas= -> config
  core/                DOM-free, unit-tested:
    engine.js            regions, colors, lock/chaos modes, progress
    parser.js            "12 green" / "12 3" -> { region, color }
    rate-limit.js        per-user cooldown + share cap (fairness)
    palette.js           default 10 colors -> 1-based palette
  ui/                  DOM:
    board.js             injects canvas.svg, indexes paths, draws labels, sets fill
    palette-bar.js       the on-screen palette
    ticker.js            live coloring feed
    host-dock.js         backtick dock (mode, inject, simulate, reset)
  integrations/
    connector.js         hub-client loader + connectHub, or offline mock
  i18n/index.js          en / tr / ar strings + color-name index (all languages)
  main.js                boot: config -> i18n -> canvas fetch -> engine/UI -> connector
```

## Data flow (one accepted color)

```
onChat({username, message})
  -> parseChat(message, palette, colorIndex)     // null if not "region color"
  -> limiter.check(user)                          // cooldown / cap
  -> engine.apply({regionNumber, color, user})    // lock rules live here
  -> board.setColor(number, color) + board.flash  // fill the SVG path
  -> ticker.add(...) ; updateProgress() ; reportState()
```

## Modes

- **lock** (default): `engine.apply` marks the region `locked`; later colors are rejected
  unless `override: true` (used by the gift `overwrite` effect).
- **chaos**: any color overwrites; regions are never locked.

## Effects (gift-triggered, mapped in the hub UI)

`premium_color`, `multi_fill`, `clear_region`, `wipe_canvas`, `overwrite`, `lock_region`,
`rename_region`, `rainbow_sweep`. Each effect is acked with `{ ok: true, effect }`. Keep
the list in sync between `tikora.manifest.json` and `CAPABILITIES` in `src/js/main.js`.

## Canvas pipeline

`scripts/generate-svg.mjs` (the procedural generator, built in parallel) or the placeholder
`scripts/gen-demo-canvas.mjs` writes `canvas.svg` + `canvas.json`.
`scripts/validate-canvas.mjs` is the contract gate. See `docs/CANVAS_FORMAT.md`.

## Server

`scripts/serve.mjs` — dependency-free static server over `src/` on port 45125, correct MIME
types for ES modules / SVG / JSON, path-traversal guarded, `Cache-Control: no-store`.
