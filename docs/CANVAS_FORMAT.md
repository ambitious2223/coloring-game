# Canvas format (the generator contract)

A **canvas** is the picture viewers color. It is two files in one folder:

```
src/js/data/canvases/<canvas-id>/
  canvas.svg     geometry: the outlined regions
  canvas.json    metadata: region numbers, label points, palette
```

This is a **frozen contract**. The game only accepts canvases that pass
`node scripts/validate-canvas.mjs <canvas-dir>`. Any generator (ours, or built separately
with Gemini) must produce output that passes it.

---

## `canvas.svg` — rules

- Root: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H">`
- One group `<g id="regions">` holds every colorable region.
- Each region is `<path id="rN" data-number="N" d="..." fill="#ffffff" stroke="#111111" stroke-width="2"/>`
- **Polygons only** — absolute `M` / `L` / `Z`. No curves (`C/Q/S/A/T`), no shortcuts
  (`H/V`), no relative commands (`m/l/z`).
- Numbers are **`1..N`, unique, no gaps**.
- Regions **do not overlap** and together cover the art area. No zero-area slivers.
- **No `<script>`, no external references** (`href`/`xlink:href`).
- **Do not draw number labels in the SVG** — the game renders them.

Example:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <g id="regions">
    <path id="r1" data-number="1" d="M 0 0 L 100 0 L 100 100 Z" fill="#ffffff" stroke="#111111" stroke-width="2"/>
    <path id="r2" data-number="2" d="M 100 0 L 200 0 L 180 90 Z" fill="#ffffff" stroke="#111111" stroke-width="2"/>
  </g>
</svg>
```

## `canvas.json` — rules

```json
{
  "id": "canvas-0042",
  "title": "Voronoi 42",
  "viewBox": [0, 0, 1000, 1000],
  "regionCount": 84,
  "palette": ["#e6194b","#3cb44b","#4363d8","#ffe119","#f58231",
              "#911eb4","#46f0f0","#f032e6","#bcf60c","#fabebe"],
  "regions": [
    { "number": 1, "label": [63.2, 41.8], "area": 4211, "target": 5 }
  ]
}
```

- `viewBox` must equal the SVG's.
- `regionCount` = `regions.length` = number of `rN` paths.
- `label` = a point **guaranteed inside** the polygon (use polylabel / largest
  inscribed-circle centre — **not** the naive centroid; centroids fall outside concave
  shapes). The validator checks this with a point-in-polygon test.
- `area` = polygon area in viewBox units (validator recomputes it via shoelace; ±1%).
- `palette` = array of hex colors (length = number of colors; default 10).
- `target` (optional) = 1-based palette index, for a future "reveal the intended colors"
  mode. If present it must be within `1..palette.length`.

---

## Validate

```bash
node scripts/validate-canvas.mjs src/js/data/canvases/<canvas-id>   # one canvas
node scripts/validate-canvas.mjs --all                              # every canvas
```

Output is `PASS`/`FAIL` per canvas with reasons; exit code 0 only when all pass.

---

## Photo mode (`scripts/photo-to-canvas.mjs`)

Turns a raster image (or a folder of them) into a canvas. Run via
`npm run gen:photo -- --image <file> [--regions 60]` or `--dir <folder>`.

Offline examples: `npm run gen:examples` generates synthetic photos **locally** (no network)
and converts them into `photo-demo-*` canvases.

Pipeline: decode (sharp) → downscale → denoise (median) → **quantize to the game palette**
(so color names stay meaningful) → 8-connected labeling → 3×3 label-mode filter (kills
speckle) → merge small regions to the target count → Moore-trace each region's **outer**
boundary → RDP simplify → polylabel label + area → **spatial numbering**.

Notes:
- Holes are not represented (contract = one simple polygon per region). Paths are emitted
  **largest-first** so inner regions paint on top, which restores the correct look.
- Deterministic (no randomness), so re-running gives identical files.
- Every output must still pass `validate-canvas.mjs`.

## The procedural generator (`scripts/generate-svg.mjs`)

Implemented (Voronoi + mosaic/blobs/mandala, deterministic from `--seed`, polylabel
labels). Run it with `npm run gen -- --style voronoi --seed 42 --regions 90 --out <dir>`.
CLI:

```
node scripts/generate-svg.mjs --style voronoi --seed 42 --regions 90 \
     --size 1000 --out src/js/data/canvases/canvas-0042 [--palette 10] [--targets]
```

- `--style` `voronoi` | `mosaic` | `blobs` | `mandala` (start with `voronoi`)
- `--seed` deterministic (same seed → identical output)
- `--regions` target count (clamp 20–200)
- `--size` square viewBox side (default 1000)
- `--out` output folder
- `--palette` palette size (default 10)
- `--targets` include `target` per region (optional)

**Algorithm guidance (Voronoi):** scatter `--regions` points, Lloyd-relax twice for even
cells, clip to the art box → each cell is a convex polygon; number cells
left-to-right/top-to-bottom; merge/drop cells below an area threshold so every label fits.
Vary point distribution per style (mosaic = jittered grid, blobs = clusters, mandala =
radial rings).

### Acceptance tests

1. Deterministic: same `--seed` twice → identical files.
2. `node scripts/validate-canvas.mjs <out>` exits 0.
3. Opens in a browser: every region visible, outlined, numbered-ready.
4. Region count within ±10% of `--regions`.

---

## Paste-ready prompt for Gemini

```
Build a standalone Node script `generate-svg.mjs` that procedurally generates
numbered, colorable SVG canvases for a TikTok live coloring game.

CLI:
  node generate-svg.mjs --style voronoi --seed 42 --regions 90 --size 1000 --out ./out [--palette 10] [--targets]

Output exactly two files in the --out folder:

1) canvas.svg — pure SVG geometry, no <script>, no external refs, inline attrs only:
   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 W H">
     <g id="regions">
       <path id="r1" data-number="1" d="M ... Z" fill="#ffffff" stroke="#111111" stroke-width="2"/>
       ...
     </g>
   </svg>
   RULES: colorable regions are <path id="rN" data-number="N"> inside #regions.
   Polygons ONLY (absolute M/L/Z, no curves/shortcuts/relative). Numbers 1..N unique, no gaps.
   Non-overlapping, together they cover the art area, no slivers. White fill, dark stroke.
   Do NOT render number labels in the SVG.

2) canvas.json:
   { "id": "...", "title": "...", "viewBox": [0,0,W,H], "regionCount": N,
     "palette": ["#e6194b","#3cb44b","#4363d8","#ffe119","#f58231","#911eb4","#46f0f0","#f032e6","#bcf60c","#fabebe"],
     "regions": [ { "number": 1, "label": [x, y], "area": 4211, "target": 5 }, ... ] }
   RULES: "label" is a point guaranteed INSIDE the polygon (use polylabel / largest
   inscribed-circle centre, NOT the naive centroid). "area" = px^2. "target" optional
   1-based palette index (only with --targets). regionCount = regions.length = #paths.

ALGORITHM: Voronoi cells (suggest d3-delaunay) over random points, Lloyd-relax 2x for even
cells, clip to the art box, merge/drop cells below an area threshold so every label fits.
Deterministic from --seed. Styles: voronoi (start here), mosaic, blobs, mandala.

STYLE: minimal, self-contained, well-commented, no build step.

DONE when: running it twice with the same seed gives identical files, and
`node validate-canvas.mjs <out>` exits 0.
```
