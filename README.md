# Color Chaos

A collaborative **coloring game for TikTok LIVE**. The screen shows an outlined picture
split into **numbered regions**. Viewers watch the stream and comment a **region number +
a color** (e.g. `12 green` or `12 3`). The region fills with that color. Together the
audience paints the picture — and, in chaos mode, keeps repainting it forever.

Color Chaos is a game that plugs into the local **Tikora hub**, which connects to TikTok
and routes live events + gift-triggered effects to the game.

- **Slug:** `color-chaos`
- **Port:** `45125`
- **No build step:** vanilla HTML/CSS/ES modules served by a small Node server.

## Safety (no downloads)

This project never downloads anything at runtime, and the tools never fetch from the
internet. All example/test assets are **generated locally**. Raw URL download commands are
banned (they trip Windows Defender's ClickFix heuristic and are a real hazard). See the
"Safety & downloads" rules in `AGENTS.md`.

## Run it

```bash
npm run serve        # http://localhost:45125
```

On Windows, double-click **`Color Chaos Game.bat`** — it installs dependencies on first run,
starts the server, and opens the game in your browser. `start-game.bat` is the same thing
without opening a browser; it is the launcher the Tikora hub uses.

## How it plays

1. A canvas loads: an SVG of numbered regions + an on-screen palette (1–10).
2. A viewer comments `12 green` → region 12 fills; their name appears in the live feed.
3. **Lock mode (default):** the first color locks a region; later colors are rejected.
4. **Chaos mode:** any color overwrites any region at any time.
5. **Gifts** (mapped by the streamer in Tikora) fire effects like *wipe canvas*,
   *multi-fill*, *premium color*, or *overwrite a locked region*.

## Controls, testing & going live

The **Controls** panel (button in the header, or the `` ` `` key) is the streamer surface:

- **Source** — `Hub (live)` receives real TikTok events; `Demo` runs a local simulator
  (auto-simulate on); `Off` is silent. Opening the game picks Hub if reachable, else Demo.
- **Mode** — Lock / Chaos. **Simulate viewer**, **Reset**, and a manual region+color send.
- **A yellow "TEST MODE" banner** shows whenever you are not on the live hub.

**Testing without a stream:** click a palette color, then click a region — it colors
instantly (host action, ignores lock/cooldown). That's the fastest way to see it working.

**Going live (hide all chrome):** press the **Go Live** button or the **`H`** key. This
hides the header, palette, panel and controls, leaving only the **canvas + progress +
ticker** — the clean view to capture. Press `H` again to exit. The choice is remembered.

> Single-window note: with an OBS **Browser Source** the page isn't clickable, so the
> practical setup is a normal browser window captured by OBS, toggling **Live** before you
> start. A dedicated non-interactive overlay URL can be added later if you want it.

## Verify before trusting it

```bash
npm test             # core logic (engine, parser, rate limiting) - node --test
npm run validate     # canvas contract check
npm run verify       # validate:all + test
```

## Project layout

```
scripts/
  serve.mjs            static server (:45125)
  validate-canvas.mjs  THE canvas contract (generators must pass this)
  gen-demo-canvas.mjs  placeholder generator (until the real one lands)
src/
  index.html, css/     the page
  js/config.js         ?game=&key=&lang=&canvas=&source=&live= -> runtime config
  js/core/             DOM-free logic: engine, parser, palette, rate-limit
  js/ui/               board (SVG), palette bar, ticker, control panel
  js/integrations/     swappable input sources (hub / demo / off)
  js/i18n/             en / tr / ar (RTL for Arabic)
  js/data/canvases/    canvas.svg + canvas.json per canvas
game.manifest.json     hub registration metadata
tikora.manifest.json   effects + events the hub reads (authoritative)
docs/                  architecture, canvas format, hub integration
```

## Connecting to the Tikora hub

The hub serves the browser client at `http://127.0.0.1:27016/hub-client.js`; the game
loads it and calls `connectHub(...)` with its slug + key. The **Source** control picks
`Hub (live)`, `Demo` or `Off` (see *Controls* above); with no hub reachable it falls back
to Demo so it is always demoable. Full contract: `docs/HUB_INTEGRATION.md`.

## Canvas format & the generator

Canvases are `canvas.svg` + `canvas.json`. The exact rules are in
`docs/CANVAS_FORMAT.md`.

Generate new canvases procedurally (deterministic from `--seed`):

```bash
npm run gen -- --style voronoi --seed 42 --regions 90 --out src/js/data/canvases/my-canvas
npm run validate -- src/js/data/canvases/my-canvas   # or: npm run validate:all
```

Styles: `voronoi`, `mosaic`, `blobs`, `mandala`. Add `--targets` for a per-region target
color. `scripts/gen-demo-canvas.mjs` is a simpler placeholder generator.

### From a photo

Convert any PNG/JPG/WEBP (or a whole folder) into a canvas:

```bash
npm run gen:photo -- --image "C:\photos\cat.jpg" --regions 60
npm run gen:photo -- --dir "C:\photos" --regions 60          # batch (one canvas per image)
```

The pipeline (implemented in `scripts/photo-to-canvas.mjs`): downscale → denoise →
quantize to the game palette → connected-component labeling → merge small regions to
`--regions` → trace + simplify each region → number them spatially. Output goes under
`src/js/data/canvases/photo-<name>/`. Requires the `sharp` dev-dependency (generator only;
the game itself stays dependency-free). Useful flags: `--palette N`, `--size N`,
`--epsilon N`, `--no-smooth`, `--no-normalise`.

### Regenerate the bundled examples (offline)

```bash
npm run gen:examples
```

Creates a few synthetic "photos" locally with `sharp` (no network at all) and converts them
into the `photo-demo-*` canvases, then validates every canvas. This is the safe way to get
examples without touching the internet.

## License

Private project — not for distribution.
