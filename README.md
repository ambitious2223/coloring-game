# Color Chaos

A collaborative **coloring game for TikTok LIVE**. The screen shows an outlined picture
split into **numbered regions**. Viewers watch the stream and comment a **region number +
a color** (e.g. `12 green` or `12 3`). The region fills with that color. Together the
audience paints the picture — and, in chaos mode, keeps repainting it forever.

Color Chaos is a game that plugs into the local **Tikora hub**, which connects to TikTok
and routes live events + gift-triggered effects to the game.

- **Slug:** `color-chaos`
- **Port:** `3040`
- **No build step:** vanilla HTML/CSS/ES modules served by a small Node server.

## Run it

```bash
npm run serve        # http://localhost:3040
```

On Windows you can double-click `start-game.bat` (also used by the Tikora hub).

## How it plays

1. A canvas loads: an SVG of numbered regions + an on-screen palette (1–10).
2. A viewer comments `12 green` → region 12 fills; their name appears in the live feed.
3. **Lock mode (default):** the first color locks a region; later colors are rejected.
4. **Chaos mode:** any color overwrites any region at any time.
5. **Gifts** (mapped by the streamer in Tikora) fire effects like *wipe canvas*,
   *multi-fill*, *premium color*, or *overwrite a locked region*.

Press **`** (backquote) for the **host dock**: switch modes, inject a color, simulate a
random viewer, or reset — all without a live stream.

## Verify before trusting it

```bash
npm test             # core logic (engine, parser, rate limiting) - node --test
npm run validate     # canvas contract check
npm run verify       # validate:all + test
```

## Project layout

```
scripts/
  serve.mjs            static server (:3040)
  validate-canvas.mjs  THE canvas contract (generators must pass this)
  gen-demo-canvas.mjs  placeholder generator (until the real one lands)
src/
  index.html, css/     the page
  js/config.js         ?game=&key=&lang=&canvas= -> runtime config
  js/core/             DOM-free logic: engine, parser, palette, rate-limit
  js/ui/               board (SVG), palette bar, feed, host dock
  js/integrations/     hub connector + offline mock
  js/i18n/             en / tr / ar (RTL for Arabic)
  js/data/canvases/    canvas.svg + canvas.json per canvas
game.manifest.json     hub registration metadata
tikora.manifest.json   effects + events the hub reads (authoritative)
docs/                  architecture, canvas format, hub integration
```

## Connecting to the Tikora hub

The hub serves the browser client at `http://127.0.0.1:27016/hub-client.js`; the game
loads it and calls `connectHub(...)` with its slug + key. With no hub running, the game
falls back to an offline mock so it is always demoable. Full contract:
`docs/HUB_INTEGRATION.md`.

## Canvas format & the generator

Canvases are `canvas.svg` + `canvas.json`. The exact rules — and the prompt for building
the procedural generator (built in parallel) — are in `docs/CANVAS_FORMAT.md`.

## License

Private project — not for distribution.
