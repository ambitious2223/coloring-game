# AGENTS.md — Color Chaos

You are working on **Color Chaos** — a web game for TikTok LIVE. It is a single, self-contained
project that **plugs into the Tikora hub** as an external dependency: the hub connects to
TikTok, broadcasts live events over a local WebSocket, and routes per-game *effects* to this
game. Viewers color a numbered picture (by comment or by turn relay).

The project owner **does not read or write code**. Everything you tell them must be plain
language: what changed, what it looks like now, whether it works.

Stack: **vanilla HTML + CSS + ES modules, no build step**, served by a tiny Node static
server. Node 20+ (developed on 24). Tests via `node --test`. No framework, no bundler.

---

## Scope — this file is about Color Chaos ONLY

**Your job is this game and how it talks to the hub. Nothing else.**

- **Work only inside this repo** (`C:\dev\color-chaos`). Do not edit the Tikora app
  (`C:\dev\windows app interactive for streams`), Tikora Royale, or any other project.
- The hub is a **fixed external contract** from this project's point of view. If something
  needs to change **on the hub side**, do **not** implement it here — write it down as a
  checklist in the relevant doc (e.g. `docs/COMMANDS.md`) and tell the owner. Hub work is
  the hub owner's job.
- The only things that concern you are: the game itself, the canvas format, and the
  **game-side** of the hub protocol (manifest, effects, commands, input sources).

## Safety & downloads (read first — this outranks everything below)

Windows Defender once raised a false-positive **"Trojan:Win32/ClickFix"** alert because an
agent ran a command line containing a URL that downloads and writes a file. The owner had
to deal with the panic. That must never happen again. Hard rules:

1. **Never use download-and-write/execute one-liners.** No `Invoke-WebRequest` / `iwr` /
   `curl` / `wget` in the same command line as a URL and an output file. No `| iex`, no
   `-EncodedCommand`, no base64 payloads, no obfuscation, no pipe-to-shell. These match the
   "ClickFix" malware signature and **will** be quarantined even when completely benign.
2. **No network downloads without explicit permission.** If a task seems to need a file
   from the internet, STOP and ask the owner first — what, from where, and why. Prefer
   first-party, well-known sources only.
3. **Prefer package managers.** Dependencies come from `npm install`, never from a raw URL.
4. **Generate assets locally.** For tests and examples, create deterministic assets in-repo
   (e.g. with `sharp`) instead of downloading them.
5. **Never touch antivirus.** Do not add exclusions, disable protection, or "allow" a
   threat to work around a block. If something is blocked, stop and report it.
6. **Keep commands simple and auditable.** Avoid clever one-liners; write a small script
   file and run it so the intent is visible.
7. **If Defender flags anything: stop immediately, do not retry, tell the owner.**

## 0. Non-negotiable: never claim something works without proving it

1. **Run it.** `npm run serve`, then confirm `http://localhost:45125` loads.
2. **Watch the output** for errors/warnings for a few seconds after start.
3. **Visual changes:** look at the running page (headless screenshot or DOM inspection)
   before describing it. Do not describe a UI you have not seen.
4. **Logic changes:** add/extend a test in `tests/`, run `npm test`, confirm it passes.
   Core logic lives in DOM-free modules (`src/js/core/*`) precisely so it is testable.
5. Only then report, in this shape: **what you built**, **what you verified** (be specific
   — "ran serve, fetched /, unit test X passes"), **what is still untested/TODO**.

If something fails, fix it and re-verify, up to 3 attempts, without asking. Only stop and
ask if still stuck after 3 real attempts — and explain in plain language, not a stack trace.

---

## 1. Session shape — small verified steps

Work in a loop: restate the one small thing → build it → verify it (§0) → report → pause.
Do not land several features in one unverified sweep.

## 2. Git discipline

- Tracked in git, remote `origin` = `https://github.com/ambitious2223/coloring-game`.
- Commit after each verified piece. Commit messages a non-coder can read
  ("Add lock mode to the coloring board"), never "fix stuff".
- For anything risky (the canvas format, the hub-facing protocol, git history), branch first
  and confirm before merging to `main`.
- Never force-push. Never rewrite `main` history.
- Do not commit secrets. Do not commit `node_modules/`.

## 3. Tech-stack conventions

- **No build step.** Plain ES modules loaded by the browser. Keep it that way.
- **Core logic is DOM-free and tested.** `src/js/core/*` (engine, parser, palette,
  rate-limit, sections, queue, turn-engine, fills, commands) must not touch
  `document`/`window`, so `node --test` can cover it.
- **UI modules** (`src/js/ui/*`) may use the DOM; they stay thin and delegate logic down.
- **i18n:** every UI string lives in `src/js/i18n/index.js` for **en/tr/ar** (Arabic is
  RTL). Never hardcode visible text in a component.
- **No gift names in code, ever.** The game only understands **effect keys**. Which gift or
  interaction triggers which effect is configured by the streamer in the hub UI.
- **Generators are dev tools; the game stays zero-dependency.** `sharp` is a devDependency
  used only by `scripts/photo-to-canvas.mjs`. Never import it from `src/`.
- **Keep `tikora.manifest.json` and the `CAPABILITIES` list in `src/js/main.js` in sync.**

## 4. Integrating with the hub — the game's side only

The hub is external. This game's responsibilities:

- **Connection.** `src/js/integrations/connector.js` loads the hub's browser client
  (`http://127.0.0.1:27016/hub-client.js`) and calls `connectHub(...)`. Sources are
  swappable: **Hub** (live) / **Bridge** (direct TikFinity WebSocket, default
  `ws://127.0.0.1:21213/`, a backup for detecting interactions) / **Hub + Bridge** (both,
  chat de-duplicated) / **Demo** (offline simulator) / **Off** (silent). Auto picks Hub if
  reachable, else Demo. Effect delivery needs the game's key; broadcast events (chat/gifts)
  arrive without it.
- **Declare capabilities.** `tikora.manifest.json` is the authoritative list of the game's
  **effects** and **commands**; the hub reads it so they appear in the hub UI even when the
  game is offline. Mirror the effect keys in `CAPABILITIES` (`src/js/main.js`).
- **Handle effects.** Inbound `{type:"effect", data:{id, effect, payload}}` → run the
  matching action, then `ackEffect(id, ...)`. Effects with `name`/`args` are chat
  **commands** routed by the hub → handled in `runCommand()`.
- **Report state.** `reportState({...})` on round/mode changes.
- **Contract docs:** `docs/HUB_INTEGRATION.md` (events/effects/state),
  `docs/COMMANDS.md` (chat-command protocol), `docs/CANVAS_FORMAT.md` (canvas contract).
- **Never implement hub-side behaviour here.** Anything that needs the hub to change is a
  note for the hub owner.

## 5. Canvas format (contract)

Canvases are `canvas.svg` + `canvas.json`; `scripts/validate-canvas.mjs` is the authority
and every canvas must pass it (`npm run validate:all`). Generators:
`scripts/generate-svg.mjs` (procedural; `--style voronoi|mosaic|blobs|mandala`) and
`scripts/photo-to-canvas.mjs` (photo → canvas via `--style photo`/`--image`/`--dir`). Keep
both deterministic. Full rules: `docs/CANVAS_FORMAT.md`. If a canvas fails, fix the
generator — not the validator — unless the contract itself changes (then update docs +
validator + game together).

---

## 6. Current status (update as work lands)

- **Version:** 0.1.0-alpha (local dev, not released)
- **Server:** `scripts/serve.mjs` static server on **:45125** (verified 200s).
- **Generators:** `generate-svg.mjs` (procedural, deterministic), `photo-to-canvas.mjs`
  (quantize → merge → trace → simplify; `sharp` dev-dep), `gen-examples.mjs`
  (`npm run gen:examples`, fully offline). Canvases include `canvas-mandala` (**default**,
  96 regions) + Voronoi/mosaic/blobs + photo demos — all valid.
- **Game UI:** SVG board with number labels, palette, progress + ticker, lock (default) and
  chaos modes, EN/TR/AR i18n.
- **Controls panel** (`src/js/ui/control-panel.js`): left drawer (header button or `` ` ``) —
  Source, auto-simulate, mode, Simulate, Reset, manual send; **click-to-color** for testing.
- **Live mode:** `H` / Go Live hides all chrome (canvas + progress + ticker); **exit** via
  `H`, `Escape`, or the fading "Exit Live" pill. Never hide the only way back again.
- **Turn relay mode** (`core/sections.js`, `core/queue.js`, `core/turn-engine.js`,
  `core/fills.js`): round-robin queue (2 people can fill a whole mural), centre-outward
  sections, spotlight card (avatar + name + "pick a color 1–10" + countdown), host-set skip
  timer, credits on completion, premium fills (gold/neon/rainbow/stripes/dots). Host
  controls: Game mode, Sign-up Free/Gift, Open sign-up/Start/Skip/End, skip seconds,
  regions/turn.
- **Chat commands** (`docs/COMMANDS.md`, `src/js/core/commands.js`): the hub parses chat and
  routes a direct effect or the generic `command` effect (`{ name, args }`); `runCommand()`
  handles `join` / `gold` / `wipe` / `color`. Command words are declared in
  `tikora.manifest.json` (`commands`).
  - **On-screen guidance:** an always-on **instruction bar** (`#instrBar`) tells viewers the
    exact thing to type for the current phase (free / join / waiting / turn / pixel /
    complete), and **toasts** (`#toasts`, capped at 4) announce joins, turn starts, skips,
    colours and the finish. Both stay visible in Live mode and are i18n'd.
  - **Pixel mode (paid)** (`core/pixel-engine.js`, `scripts/pixel-to-canvas.mjs`): a pixel
    canvas (`type:'pixel'`, `numbering:'color'`, background cells = target 0). 9 colours
    (black, white, 7 rainbow) mapped one-per-gift via effects `fill_1..fill_9`; a gift fills
    a **random unfilled cell** of its colour; power-ups `reveal_color` / `fill_brush` /
    `reveal_all` / `golden_pixel`; **milestones** at 25/50/75/100%; a **legend overlay** with
    animatable trigger icons (bw/glitch/fade); **zoom/pan + auto-focus** on the board.
    `npm run gen:pixel` builds pixel canvases (procedural heart, or from an image); the
    canvas index (`canvas-index.json`) drives the Canvas picker + playlist. Switching mode
    reloads only when the canvas type must change. The palette sits **beside the canvas**
    (right side, matched to its box height) and shows, per color, a **crayon-style chip +
    number badge**, the **gift image + name** (from `src/js/data/pixel-gifts.json`), and
    **pixels left**. Every unfilled pixel also shows its color's gift as a **watermark**
    (style bar on the palette: Off / Color / B&W / Fade, always visible); watermarks hide as
    cells fill. An **Auto camera** toggle (Controls) controls auto-zoom (max 10×). Suggested
    1-coin gift wiring is in `docs/PIXEL_GIFTS.md` (GG · Ice Cream Cone · Rose · Blow a kiss ·
    Thumbs Up · Go Popular · TikTok · Love you · Heart).
- **Tests:** **46 passing** (`npm test`); syntax clean.
- **Verified by headless screenshot:** canvas + labels + palette + i18n render; controls +
  TEST banner in setup; Live mode hides chrome; regions color end-to-end (parser → engine →
  board → ticker → progress); a hub-routed `gold` command rendered a premium gradient region.
- **Not built yet:** snapshot/timelapse of the finished mural, sounds, the `target`-color
  reveal mode, per-region author badges.
- **Bridge backup** (`connector.js` `normalizeBridgeMessage`): `Bridge (TikFinity)` /
  `Hub + Bridge` sources read a local bridge directly for interactions when the hub isn't
  supplying them. Verified live (status showed "Bridge connected").
- **Hub integration:** game-side contract ready (`docs/HUB_INTEGRATION.md`,
  `docs/COMMANDS.md`); **no mappings are seeded** — the streamer creates gift/interaction/
  command → effect mappings in the hub UI.

## 7. Quick commands

```
npm run serve        # http://localhost:45125
npm run gen -- --style voronoi --seed 42 --regions 90 --out src/js/data/canvases/my-canvas
npm run gen:photo -- --image "C:\photos\cat.jpg" --regions 60   # or --dir <folder>
npm run gen:examples # regenerate the offline example photo canvases (no network)
npm run gen:pixel -- --shape heart   # or --image <file> --grid-size 16
npm run canvases:index # rebuild the canvas index after adding canvases
npm test             # core logic tests (node --test)
npm run validate     # validate the demo canvas
npm run validate:all # validate every canvas
npm run gen:demo     # regenerate the placeholder demo canvas
npm run verify       # validate:all + test
```
