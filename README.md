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

## Turn relay mode (collective mural)

A calmer, co-creative mode (Controls → **Game mode: Turns**):

1. **Sign-up** — viewers comment `join` (or send the priority gift) and appear as avatars.
2. **Turns** — the queue loops round-robin. Each turn the current player's **photo +
   nickname** flies in, they **pick a colour 1–10**, and the **next section** fills with it,
   credited to them. Two people can fill the whole mural by alternating.
3. **Skip** — after the host-set timeout the turn passes; the next player colours that same
   section.
4. **Complete** — when the canvas is full, a "made by" roll credits everyone.

On screen, an **instruction bar** always tells viewers exactly what to type for the current
phase (*"To join the mural, comment 'join'"*, *"Ayla1, comment a color number 1–10"*), and
**toasts** announce joins, turns, skips and the finish — so you don't have to explain it
live.

Host controls: Sign-up **Free / Gift**, Open sign-up, Start, Skip, End, **skip seconds**,
**regions per turn** (1–6). Paid extras (via gifts): **priority sign-up**, **premium
colours** (gold / neon / rainbow / stripes / dots), **name the artwork**, **sign the
artwork**. Map gifts → these effects in the Tikora hub UI.

## Pixel mode (paid)

The monetization mode. A pixel picture where every cell already knows its colour — viewers
**fill it with gifts** (one gift = one pixel), so the result is predetermined and organized.

1. **9 colors** (black, white, 7 rainbow). Each colour maps to **one gift** in the hub
   (`fill_1 … fill_9`).
2. A gift of a colour fills **a random unfilled cell of that colour**; progress is shown as
   `filled / fillable`.
3. **Power-ups** (big gifts): `reveal_color` (finish a colour), `fill_brush` (fill several
   cells), `reveal_all` (complete the mural), `golden_pixel`.
4. **Milestones** fire at 25/50/75/100% — toasts + celebration.
5. A **palette beside the canvas** (right side, matched to the canvas height) shows each
   color's number, swatch, the **gift image** + name of the gift that fills it, and **how
   many pixels are left**; a color turns ✓ when finished. Icon styles: B&W / glitch / fade
   (Controls → *Trigger icons*). Suggested 1-coin gift wiring: `docs/PIXEL_GIFTS.md`
   (`src/js/data/pixel-gifts.json`).
6. **Gift on the pixels:** every unfilled pixel shows its color's gift as a watermark (so
   zooming in shows which gift fills it). Style bar on the palette: **Off / Color / B&W /
   Fade** — always visible. Watermarks disappear as cells fill.
7. **Auto camera** (Controls) auto-zooms to each fill; turn it off to keep the full view.
   Wheel to zoom (up to 10×), drag to pan, double-click to reset.

Suggested 1-coin gift wiring lives in `docs/PIXEL_GIFTS.md` (`src/js/data/pixel-gifts.json`):
GG · Ice Cream Cone · Rose · Blow a kiss · Thumbs Up · Go Popular · TikTok · Love you · Heart.
6. **Zoom:** wheel to zoom, drag to pan, auto-zoom to the last filled cell, double-click to
   reset.

Generate pixel canvases offline:

```bash
npm run gen:pixel -- --shape heart   # heart | star | smiley | diamond
npm run gen:pixel -- --image "C:\photos\cat.jpg" --grid-size 16 --bg "#ffffff" --out src/js/data/canvases/pixel-cat
npm run canvases:index      # refresh the canvas index after adding canvases
```

**The Canvas dropdown is filtered by mode:** Pixel shows only pixel canvases; Free/Turns show
only standard ones. **Host controls in Pixel mode:** **left-click** a pixel to fill it with
its correct color, **right-click** to clear it. (During a real game, gifts fill the pixels.)

Modes are switchable live (Controls → **Game mode: Free / Turns / Pixel**); the canvas
auto-pairs per mode and Pixel keeps a playlist in `src/js/data/canvases/index.json`.

## Controls, testing & going live

The **Controls** panel (button in the header, or the `` ` `` key) is the streamer surface:

- **Source** — `Hub (live)` receives real TikTok events; `Bridge (TikFinity)` connects
  directly to a local bridge WebSocket as a backup; `Hub + Bridge` uses both (chat is
  de-duplicated); `Demo` runs a local simulator; `Off` is silent. Opening the game picks Hub
  if reachable, else Demo.
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

### Chat commands
Free interactions can trigger effects too. The hub parses chat and routes either a
**direct effect** (`!wipe` → `wipe_canvas`) or the **generic `command`** effect
(`{ name, args }`) which the game routes in `src/js/main.js`. The game declares its
command words in `tikora.manifest.json` (`commands`). Full contract: `docs/COMMANDS.md`.

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
