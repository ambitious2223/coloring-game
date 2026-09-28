# AGENTS.md — Color Chaos

You are working on **Color Chaos**, a Windows-hosted web game for TikTok LIVE. It is a
**game that plugs into the Tikora hub** (`C:\dev\windows app interactive for streams`):
the hub connects to TikTok, broadcasts live events over a local WebSocket, and routes
per-game *effects*. Viewers color a numbered picture by commenting `region color`.

The project owner **does not read or write code**. Everything you tell them must be plain
language: what changed, what it looks like now, whether it works.

Stack: **vanilla HTML + CSS + ES modules, no build step**, served by a tiny Node static
server. Node 20+ (developed on 24). Tests via `node --test`. No framework, no bundler.

---

## 0. Non-negotiable: never claim something works without proving it

1. **Run it.** `npm run serve`, then confirm `http://localhost:45125` loads.
2. **Watch the output** for errors/warnings for a few seconds after start.
3. **Visual changes:** look at the running page (screenshot or DOM inspection) before
   describing it. Do not describe a UI you have not seen.
4. **Logic changes:** add/extend a test in `tests/`, run `npm test`, confirm it passes.
   Core logic lives in DOM-free modules (`src/js/core/*`) precisely so it is testable.
5. Only then report, in this shape: **what you built**, **what you verified** (be
   specific — "ran serve, fetched /, unit test X passes"), **what is still untested/TODO**.

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
- For anything risky (hub protocol, the canvas format, git history), branch first and
  confirm before merging to `main`.
- Never force-push. Never rewrite `main` history.
- Do not commit secrets. Do not commit `node_modules/`.

## 3. Tech-stack conventions

- **No build step.** Plain ES modules loaded by the browser. Keep it that way.
- **Core logic is DOM-free and tested.** `src/js/core/*` (engine, parser, rate-limit,
  palette) must not touch `document`/`window`, so `node --test` can cover it.
- **UI modules** (`src/js/ui/*`) may use the DOM; they stay thin and delegate logic down.
- **i18n:** every UI string lives in `src/js/i18n/index.js` for **en/tr/ar** (Arabic is
  RTL). Never hardcode visible text in a component.
- **No gift names in code, ever.** The game only understands `effect` keys. Which gift
  triggers which effect is configured by the streamer in the Tikora hub UI.
- **The canvas format is a contract.** `scripts/validate-canvas.mjs` is the authority; any
  generator (ours or built separately) must pass it. See `docs/CANVAS_FORMAT.md`.
- **Keep `tikora.manifest.json` and the `CAPABILITIES` list in `src/js/main.js` in sync.**

## 4. Model/credit economy

- Small mechanical edits (copy, CSS, a label): just do it and verify quickly.
- Anything touching the hub protocol, the canvas format, or the server: think it through
  and verify thoroughly.
- Do not re-read the whole repo each session; read the relevant files.

## 5. Multi-agent & file safety (the canvas generator is built in parallel)

A separate effort (Gemini) builds `scripts/generate-svg.mjs` against the same contract.
Therefore:
- **Only edit files in your own scope.** The generator owner edits `scripts/generate-svg.mjs`
  and `docs/CANVAS_FORMAT.md` *requests*; this repo's game code is owned here.
- **Re-read a file immediately before editing it** — a parallel session may have changed it.
- **Prefer targeted edits** over whole-file rewrites.
- **The meeting point is `npm run validate`.** If a canvas fails, fix the generator, not
  the validator, unless the contract itself changes (and then update docs + validator +
  game together).

---

## 6. Current status (update as work lands)

- **Version:** 0.1.0-alpha (local dev, not released)
- **Done (this scaffold):**
  - Repo at `C:\dev\color-chaos`, git init, remote `origin` → GitHub `coloring-game`.
  - `scripts/serve.mjs` static server on **:45125** (verified: /, css, js, canvas all 200).
  - `scripts/gen-demo-canvas.mjs` placeholder generator (jittered lattice).
  - `scripts/generate-svg.mjs` — the real procedural generator (Voronoi + mosaic/blobs/
    mandala, deterministic from `--seed`, polylabel labels). Canvases: `canvas-voronoi-42`,
    `canvas-mosaic-7`, `canvas-blobs-3`, `canvas-mandala-9`, `canvas-demo` — all **PASS**.
  - `scripts/validate-canvas.mjs` — the canvas contract validator.
  - Canvas format, hub manifests (`game.manifest.json`, `tikora.manifest.json`).
  - Game: SVG board + number labels, palette, live feed, host dock (backtick), lock mode
    (default) + chaos mode, rate-limiting, EN/TR/AR i18n, hub connector with offline mock.
  - Tests: 13 passing (`npm test`). Syntax check: all files clean.
  - Committed and pushed to GitHub. Registered in Tikora's Game Store (`BUILTIN_GAMES`,
    port 45125) on branch `feat/clash-royale-integration`.
- **Verified by headless screenshot:** the page renders (canvas + labels + palette + i18n),
  and the mock feed colors regions end-to-end (parser → engine → board → feed → progress),
  on both the demo canvas and a generated Voronoi canvas.
- **Not built yet:** chaos-mode-specific gift tools beyond the current set, snapshot/
  timelapse, sounds, the `target`-color reveal mode.
- **Hub integration:** contract ready (`docs/HUB_INTEGRATION.md`), **no gift→effect
  mappings are seeded** — the streamer creates them in the hub UI.

## 7. Quick commands

```
npm run serve        # http://localhost:45125
npm run gen -- --style voronoi --seed 42 --regions 90 --out src/js/data/canvases/my-canvas
npm test             # core logic tests (node --test)
npm run validate     # validate the demo canvas
npm run validate:all # validate every canvas
npm run gen:demo     # regenerate the placeholder demo canvas
npm run verify       # validate:all + test
```
