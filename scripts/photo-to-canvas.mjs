// Color Chaos - photo -> numbered canvas generator.
//
// Pipeline (best practice for usable paint-by-number output):
//   decode (sharp) -> downscale -> denoise -> quantize to the game palette
//   -> connected-component labeling (8-conn) -> merge small regions to a target
//   count -> trace each region's outer boundary -> simplify (RDP)
//   -> polylabel label + area -> spatial numbering -> emit canvas.svg/json.
//
// Design notes:
//  - Quantizing straight to the GAME PALETTE (not free k-means colors) keeps the
//    on-screen color names meaningful and the game's color words working.
//  - Holes are not represented (contract = one simple polygon per region). Their
//    area is covered by the enclosing region; paths are emitted largest-first so
//    inner regions paint on top, which restores the correct look.
//  - Deterministic: no randomness (quantization + labeling + merging are stable).
//
// Used by generate-svg.mjs (--style photo / --image / --dir).

import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#ffe119', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
];

const BASE_PALETTE = [
  ...DEFAULT_PALETTE,
  '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080',
];

function getPalette(count) {
  if (count <= BASE_PALETTE.length) return BASE_PALETTE.slice(0, count);
  const palette = [...BASE_PALETTE];
  const needed = count - BASE_PALETTE.length;
  for (let i = 0; i < needed; i++) {
    const hue = Math.round((i * 360) / needed) % 360;
    palette.push(hslToHex(hue, 70, 50));
  }
  return palette;
}

function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ---- geometry helpers (mirrors of the ones in generate-svg.mjs) ----

function shoelace(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > py) !== (yj > py)) && (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointToSegmentDistSq(px, py, ax, ay, bx, by) {
  let dx = bx - ax, dy = by - ay;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    if (t > 1) { ax = bx; ay = by; } else if (t > 0) { ax += t * dx; ay += t * dy; }
  }
  dx = px - ax; dy = py - ay;
  return dx * dx + dy * dy;
}

function pointToPolygonDist(px, py, polygon) {
  let min = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const d = pointToSegmentDistSq(px, py, polygon[i][0], polygon[i][1], polygon[j][0], polygon[j][1]);
    if (d < min) min = d;
  }
  const dist = Math.sqrt(min);
  return pointInPolygon(px, py, polygon) ? dist : -dist;
}

function polygonCentroid(poly) {
  let cx = 0, cy = 0, a2 = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const cross = a[0] * b[1] - b[0] * a[1];
    a2 += cross; cx += (a[0] + b[0]) * cross; cy += (a[1] + b[1]) * cross;
  }
  if (Math.abs(a2) < 1e-6) return poly[0] || [0, 0];
  return [cx / (3 * a2), cy / (3 * a2)];
}

function polylabel(polygon, precision = 0.5) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  }
  const width = maxX - minX, height = maxY - minY;
  const cellSize = Math.min(width, height);
  if (cellSize === 0) return [minX, minY];
  const h = cellSize / 2;
  const c = polygonCentroid(polygon);
  let best = { x: c[0], y: c[1], h: 0, d: pointToPolygonDist(c[0], c[1], polygon), max: 0 };
  best.max = best.d;
  const bx = minX + width / 2, by = minY + height / 2;
  const bd = pointToPolygonDist(bx, by, polygon);
  if (bd > best.d) best = { x: bx, y: by, h: 0, d: bd, max: bd };

  const queue = [];
  const add = (x, y, ch) => {
    const d = pointToPolygonDist(x, y, polygon);
    queue.push({ x, y, h: ch, d, max: d + ch * Math.SQRT2 });
  };
  for (let x = minX; x < maxX; x += cellSize) for (let y = minY; y < maxY; y += cellSize) add(x + h, y + h, h);
  queue.sort((a, b) => b.max - a.max || a.x - b.x || a.y - b.y);
  while (queue.length) {
    const cell = queue.shift();
    if (cell.d > best.d) best = cell;
    if (cell.max - best.d <= precision) continue;
    const h2 = cell.h / 2;
    add(cell.x - h2, cell.y - h2, h2);
    add(cell.x + h2, cell.y - h2, h2);
    add(cell.x - h2, cell.y + h2, h2);
    add(cell.x + h2, cell.y + h2, h2);
    queue.sort((a, b) => b.max - a.max || a.x - b.x || a.y - b.y);
  }
  const rx = Math.round(best.x * 100) / 100, ry = Math.round(best.y * 100) / 100;
  return [Object.is(rx, -0) ? 0 : rx, Object.is(ry, -0) ? 0 : ry];
}

// Ramer-Douglas-Peucker on an open polyline (caller closes the loop).
function rdp(points, eps) {
  if (points.length < 3) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = 1; keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    if (b - a < 2) continue;
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy) || 1;
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      const d = Math.abs((px - ax) * dy - (py - ay) * dx) / len;
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > eps && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

// ---- steps ----

function quantizeToPalette(data, channels, paletteRgb) {
  const n = data.length / channels;
  const labels = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * channels], g = data[i * channels + 1], b = data[i * channels + 2];
    let best = 0, bestD = Infinity;
    for (let k = 0; k < paletteRgb.length; k++) {
      const [pr, pg, pb] = paletteRgb[k];
      const d = (r - pr) ** 2 + (g - pg) ** 2 + (b - pb) ** 2;
      if (d < bestD) { bestD = d; best = k; }
    }
    labels[i] = best;
  }
  return labels;
}

// 3x3 majority filter on the label map: removes single-pixel speckle so a noisy
// image does not explode into hundreds of thousands of regions (which would make
// the merge step blow up). Deterministic.
function modeFilterLabels(labels, w, h, iterations = 1) {
  let cur = labels;
  for (let it = 0; it < iterations; it++) {
    const next = new Int16Array(cur.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const counts = new Map();
        let bestLab = cur[y * w + x], bestN = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const l = cur[ny * w + nx];
            const c = (counts.get(l) || 0) + 1;
            counts.set(l, c);
            if (c > bestN) { bestN = c; bestLab = l; }
          }
        }
        next[y * w + x] = bestLab;
      }
    }
    cur = next;
  }
  return cur;
}

// 8-connected component labeling (union-find).
function connectedComponents(labels, w, h) {
  const comp = new Int32Array(w * h).fill(-1);
  const parent = [];
  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const union = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[b] = a; };
  let next = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = labels[i];
      let link = -1;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const ni = ny * w + nx;
          if (comp[ni] !== -1 && labels[ni] === l) {
            if (link === -1) link = comp[ni]; else union(link, comp[ni]);
          }
        }
      }
      if (link === -1) { comp[i] = next; parent[next] = next; next++; } else comp[i] = link;
    }
  }
  for (let i = 0; i < comp.length; i++) comp[i] = find(comp[i]);
  const remap = new Map();
  let n = 0;
  for (let i = 0; i < comp.length; i++) {
    const r = comp[i];
    if (!remap.has(r)) remap.set(r, n++);
    comp[i] = remap.get(r);
  }
  return { comp, count: n };
}

// Merge the smallest regions into their most-similar neighbor until the count
// is at/below target and no region is below minArea. Returns a flat region map.
function mergeSmallRegions(comp, labels, w, h, target, minArea) {
  let n = 0;
  for (let i = 0; i < comp.length; i++) if (comp[i] + 1 > n) n = comp[i] + 1;

  const parent = new Array(n);
  const count = new Int32Array(n);
  const color = new Int16Array(n);
  const adj = new Array(n);
  for (let r = 0; r < n; r++) { parent[r] = r; adj[r] = new Set(); }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const r = comp[i];
      count[r]++;
      if (color[r] === 0 && labels[i] === 0) color[r] = 0;
      color[r] = labels[i];
      if (x + 1 < w && comp[i + 1] !== r) { adj[r].add(comp[i + 1]); adj[comp[i + 1]].add(r); }
      if (y + 1 < h && comp[i + w] !== r) { adj[r].add(comp[i + w]); adj[comp[i + w]].add(r); }
    }
  }

  const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
  const pal = getPalette(BASE_PALETTE.length); // only used for color distance below
  const rgb = (idx) => hexToRgb(BASE_PALETTE[Math.min(idx, BASE_PALETTE.length - 1)]);
  const colorDist = (a, b) => {
    const ca = rgb(color[a]), cb = rgb(color[b]);
    return (ca[0] - cb[0]) ** 2 + (ca[1] - cb[1]) ** 2 + (ca[2] - cb[2]) ** 2;
  };
  void pal;

  let active = n;
  while (active > target) {
    let minRoot = -1, minCount = Infinity;
    for (let r = 0; r < n; r++) {
      if (find(r) === r && count[r] > 0 && count[r] < minCount) { minCount = count[r]; minRoot = r; }
    }
    if (minRoot < 0) break;
    if (minCount >= minArea && active <= target) break;

    // pick the neighbor with the closest color (largest region as tie-break)
    let best = -1, bestDist = Infinity, bestCount = -1;
    for (const nb of adj[minRoot]) {
      const rn = find(nb);
      if (rn === minRoot) continue;
      const d = colorDist(minRoot, rn);
      if (d < bestDist || (d === bestDist && count[rn] > bestCount)) {
        bestDist = d; best = rn; bestCount = count[rn];
      }
    }
    if (best < 0) break;

    parent[best] = minRoot; // keep minRoot as the surviving root
    count[minRoot] += count[best];
    count[best] = 0;
    for (const nb of adj[best]) {
      const rn = find(nb);
      if (rn !== minRoot) adj[minRoot].add(rn);
    }
    adj[minRoot].delete(minRoot);
    adj[best].clear();
    active--;
  }

  // flatten + renumber
  const remap = new Map();
  const flat = new Int32Array(comp.length);
  let m = 0;
  for (let i = 0; i < comp.length; i++) {
    const r = find(comp[i]);
    if (!remap.has(r)) remap.set(r, m++);
    flat[i] = remap.get(r);
  }
  return { comp: flat, count: m };
}

// Moore-neighbour boundary tracing of one 8-connected region -> pixel-centre polygon.
function traceBoundary(isFg, bbox) {
  const { x0, y0, x1, y1 } = bbox;
  // collect pixels, find start = topmost then leftmost
  let sx = -1, sy = -1;
  outer: for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      if (isFg(x, y)) { sx = x; sy = y; break outer; }
    }
  }
  if (sx < 0) return null;

  // clockwise neighbour order starting West
  const N8 = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
  const dirIndex = (dx, dy) => N8.findIndex(([a, b]) => a === dx && b === dy);

  const contour = [[sx, sy]];
  let b = [sx, sy];
  let c = [sx - 1, sy]; // known background (west of start)
  const startB = [sx, sy];
  let secondB = null;
  const maxSteps = (x1 - x0 + 2) * (y1 - y0 + 2) * 4 + 16;
  let steps = 0;

  while (steps++ < maxSteps) {
    let ci = dirIndex(c[0] - b[0], c[1] - b[1]);
    if (ci < 0) ci = 0;
    let found = null, lastBg = null;
    for (let k = 1; k <= 8; k++) {
      const idx = (ci + k) % 8;
      const nx = b[0] + N8[idx][0], ny = b[1] + N8[idx][1];
      if (isFg(nx, ny)) { found = [nx, ny]; c = lastBg || [b[0] + N8[(idx + 7) % 8][0], b[1] + N8[(idx + 7) % 8][1]]; break; }
      lastBg = [nx, ny];
    }
    if (!found) break;
    b = found;
    if (b[0] === startB[0] && b[1] === startB[1]) {
      if (secondB && contour.length > 2) break;
    }
    if (!secondB) secondB = b;
    contour.push([b[0] + 0.5, b[1] + 0.5]);
  }
  // drop the duplicate first point if present, keep pixel-centre coords
  contour[0] = [sx + 0.5, sy + 0.5];
  if (contour.length > 1) {
    const a = contour[0], z = contour[contour.length - 1];
    if (a[0] === z[0] && a[1] === z[1]) contour.pop();
  }
  return contour.length >= 3 ? contour : null;
}

function regionBBox(comp, id, w, h) {
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (comp[y * w + x] === id) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x0 > x1 ? null : { x0, y0, x1, y1 };
}

function collectImages(args) {
  const out = [];
  const code = process.cwd();
  if (args.image) {
    out.push({ file: path.resolve(code, args.image), outDir: resolveOut(args, args.image) });
  }
  if (args.dir) {
    const dir = path.resolve(code, args.dir);
    const exts = ['.png', '.jpg', '.jpeg', '.webp'];
    for (const f of fs.readdirSync(dir)) {
      if (exts.includes(path.extname(f).toLowerCase())) {
        out.push({ file: path.join(dir, f), outDir: resolveOut(args, f) });
      }
    }
  }
  return out;
}

function resolveOut(args, nameOrPath) {
  if (args.out && !args.dir) return path.resolve(process.cwd(), args.out);
  const base = path.basename(nameOrPath).replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').toLowerCase();
  const root = path.resolve(process.cwd(), args.out || 'src/js/data/canvases');
  return path.join(root, `photo-${base}`);
}

export async function generatePhotoCanvas(args, log = console.log) {
  const mod = await import('sharp').catch(() => null);
  if (!mod || !mod.default) {
    throw new Error("sharp is not installed. Run: npm install --save-dev sharp");
  }
  const sharp = mod.default;

  const size = Number(args.size) || 1000;
  const paletteCount = Math.max(2, Math.min(20, Number(args.palette) || 10));
  const palette = getPalette(paletteCount);
  const paletteRgb = palette.map(hexToRgb);
  const target = Math.max(8, Number(args.regions) || 60);
  const smooth = args.smooth !== false;
  const eps = args.epsilon != null ? Number(args.epsilon) : 1.6;

  const images = collectImages(args);
  if (!images.length) throw new Error('No input image. Use --image <file> or --dir <folder>.');

  const results = [];
  for (const item of images) {
    const meta = await sharp(item.file).metadata();
    const long = Math.max(meta.width || 0, meta.height || 0);
    if (!long) { log(`skip (unreadable): ${item.file}`); continue; }
    const scale = size / long;
    const w = Math.max(8, Math.round((meta.width || 0) * scale));
    const h = Math.max(8, Math.round((meta.height || 0) * scale));

    let pipe = sharp(item.file).resize(w, h, { fit: 'fill' }).removeAlpha();
    if (smooth) pipe = pipe.median(3);
    const { data, info } = await pipe.raw().toBuffer({ resolveWithObject: true });

    let labels = quantizeToPalette(data, info.channels, paletteRgb);
    labels = modeFilterLabels(labels, w, h, smooth ? 1 : 2);
    const cc = connectedComponents(labels, w, h);
    const minArea = Math.max(4, Math.floor((w * h) / (target * 12)));
    const merged = mergeSmallRegions(cc.comp, labels, w, h, target, minArea);

    // trace each region
    const raw = [];
    for (let id = 0; id < merged.count; id++) {
      const bbox = regionBBox(merged.comp, id, w, h);
      if (!bbox) continue;
      const isFg = (x, y) =>
        x >= 0 && y >= 0 && x < w && y < h && merged.comp[y * w + x] === id;
      const contour = traceBoundary(isFg, bbox);
      if (!contour || contour.length < 3) continue;
      const simplified = rdp(contour, eps);
      if (simplified.length < 3) continue;
      const area = shoelace(simplified);
      if (area < minArea * 0.5) continue;
      // palette color = the region's (uniform) label
      let colorIdx = 0;
      for (let y = bbox.y0; y <= bbox.y1 && !colorIdx; y++) {
        for (let x = bbox.x0; x <= bbox.x1; x++) {
          if (merged.comp[y * w + x] === id) { colorIdx = labels[y * w + x]; break; }
        }
      }
      raw.push({ points: simplified, area, colorIdx: colorIdx + 1 });
    }

    // spatial numbering: top-to-bottom rows, then left-to-right
    const withCentroid = raw.map((r) => ({ ...r, cen: polygonCentroid(r.points) }));
    withCentroid.sort((a, b) => (a.cen[1] - b.cen[1]) || (a.cen[0] - b.cen[0]));
    withCentroid.forEach((r, i) => { r.number = i + 1; });

    // emit paths largest-first so inner regions paint on top (hole fix)
    const emission = [...withCentroid].sort((a, b) => b.area - a.area);
    const fmt = (n) => { const v = Math.round(n * 100) / 100; return Object.is(v, -0) ? 0 : v; };
    const svgPaths = emission.map((r) => {
      const d = 'M ' + r.points.map((p) => `${fmt(p[0])},${fmt(p[1])}`).join(' L ') + ' Z';
      return `    <path id="r${r.number}" data-number="${r.number}" d="${d}" fill="#ffffff" stroke="#111111" stroke-width="2"/>`;
    });

    const jsonRegions = withCentroid.map((r) => ({
      number: r.number,
      label: polylabel(r.points, 0.5),
      area: Math.round(r.area),
      target: r.colorIdx,
    }));

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">\n  <g id="regions">\n${svgPaths.join('\n')}\n  </g>\n</svg>\n`;
    const title = path.basename(item.file).replace(/\.[^.]+$/, '');
    const json = {
      id: path.basename(item.outDir),
      title,
      viewBox: [0, 0, w, h],
      regionCount: jsonRegions.length,
      palette,
      regions: jsonRegions,
    };

    fs.mkdirSync(item.outDir, { recursive: true });
    fs.writeFileSync(path.join(item.outDir, 'canvas.svg'), svg, 'utf8');
    fs.writeFileSync(path.join(item.outDir, 'canvas.json'), JSON.stringify(json, null, 2) + '\n', 'utf8');
    log(`[photo] ${path.basename(item.file)} -> ${jsonRegions.length} regions -> ${item.outDir}`);
    results.push({ file: item.file, outDir: item.outDir, regions: jsonRegions.length });
  }

  return results;
}
