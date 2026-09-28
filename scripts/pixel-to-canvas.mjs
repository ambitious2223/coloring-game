// Color Chaos - pixel canvas generator (Pixel mode / paid).
//
//   node scripts/pixel-to-canvas.mjs --shape heart --out src/js/data/canvases/pixel-heart
//   node scripts/pixel-to-canvas.mjs --image photo.png --grid-size 16 --bg "#ffffff" --out ...
//
// A pixel canvas is a grid of square cells. Each cell has a `target` colour index
// (1..9) or 0 = fixed background. The canvas uses `numbering: "color"`, so the
// number printed on a cell is its target colour (same colour -> same number).
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

export const PIXEL_PALETTE = [
  '#111111', // 1 black
  '#ffffff', // 2 white
  '#e6194b', // 3 red
  '#f58231', // 4 orange
  '#ffe119', // 5 yellow
  '#3cb44b', // 6 green
  '#46f0f0', // 7 cyan
  '#4363d8', // 8 blue
  '#f032e6', // 9 magenta
];

const round = (n) => Math.round(n * 100) / 100;

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function nearestPalette(r, g, b, rgb) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < rgb.length; i++) {
    const d = (r - rgb[i][0]) ** 2 + (g - rgb[i][1]) ** 2 + (b - rgb[i][2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best + 1; // 1-based
}

/** Build the pure canvas artefacts from a grid of colour indices (0 = background). */
export function buildPixelCanvas({
  grid,
  size = 1000,
  palette = PIXEL_PALETTE,
  background = '#ececec',
  id = 'pixel',
  title = 'Pixel',
}) {
  const rows = grid.length;
  const cols = grid[0].length;
  const cw = size / cols;
  const ch = size / rows;
  const paths = [];
  const regions = [];
  let n = 0;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const target = Number(grid[y][x]) || 0;
      n += 1;
      const px = x * cw;
      const py = y * ch;
      const d =
        `M ${round(px)} ${round(py)} L ${round(px + cw)} ${round(py)} ` +
        `L ${round(px + cw)} ${round(py + ch)} L ${round(px)} ${round(py + ch)} Z`;
      const fill = target === 0 ? background : '#ffffff';
      paths.push(
        `    <path id="r${n}" data-number="${n}" d="${d}" fill="${fill}" stroke="#111111" stroke-width="1"/>`
      );
      regions.push({
        number: n,
        label: [round(px + cw / 2), round(py + ch / 2)],
        area: round(cw * ch),
        target,
      });
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">\n  <g id="regions">\n${paths.join('\n')}\n  </g>\n</svg>\n`;
  const json = {
    id,
    title,
    type: 'pixel',
    numbering: 'color',
    background,
    viewBox: [0, 0, size, size],
    regionCount: regions.length,
    palette,
    regions,
  };
  return { svg, json, regionCount: regions.length };
}

const HEART = [
  '................',
  '....XX....XX....',
  '...XXXX..XXXX...',
  '..XXXXXXXXXXXX..',
  '.XXXXXXXXXXXXXX.',
  '.XXXXXXXXXXXXXX.',
  'XXXXXXXXXXXXXXXX',
  'XXXXXXXXXXXXXXXX',
  '.XXXXXXXXXXXXXX.',
  '.XXXXXXXXXXXXXX.',
  '..XXXXXXXXXXXX..',
  '...XXXXXXXXXX...',
  '....XXXXXXXX....',
  '.....XXXXXX.....',
  '......XXXX......',
  '.......XX.......',
];

/** A demo heart: black outline, white highlights, rainbow interior (by column). */
export function heartGrid() {
  const rows = HEART.length;
  const cols = HEART[0].length;
  const at = (x, y) => (y >= 0 && y < rows && x >= 0 && x < cols ? HEART[y][x] : '.');
  const grid = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      if (at(x, y) !== 'X') {
        row.push(0);
        continue;
      }
      const edge = at(x - 1, y) !== 'X' || at(x + 1, y) !== 'X' || at(x, y - 1) !== 'X' || at(x, y + 1) !== 'X';
      if (edge) row.push(1); // black outline
      else if ((x === 5 && y === 4) || (x === 6 && y === 5)) row.push(2); // white highlights
      else row.push(3 + Math.min(6, Math.floor((x / (cols - 1)) * 7))); // rainbow by column
    }
    grid.push(row);
  }
  return grid;
}

function pointInPoly(px, py, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function polygonStar(cx, cy, R, r, points = 5) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    pts.push([cx + Math.cos(a) * rad, cy + Math.sin(a) * rad]);
  }
  return pts;
}

function fillFromMask(n, inside, colorFn) {
  const grid = [];
  for (let y = 0; y < n; y++) {
    const row = [];
    for (let x = 0; x < n; x++) {
      if (!inside(x, y)) {
        row.push(0);
        continue;
      }
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      row.push(edge ? 1 : colorFn(x, y));
    }
    grid.push(row);
  }
  return grid;
}

const rainbowByCol = (n) => (x) => 3 + Math.min(6, Math.floor((x / (n - 1)) * 7));

/** A 5-point star. */
export function starGrid(n = 16) {
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2;
  const poly = polygonStar(cx, cy, n * 0.47, n * 0.2);
  const color = rainbowByCol(n);
  return fillFromMask(n, (x, y) => pointInPoly(x + 0.5, y + 0.5, poly), color);
}

/** A diamond. */
export function diamondGrid(n = 16) {
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2;
  const poly = [
    [cx, 0.5],
    [n - 0.5, cy],
    [cx, n - 0.5],
    [0.5, cy],
  ];
  const color = rainbowByCol(n);
  return fillFromMask(n, (x, y) => pointInPoly(x + 0.5, y + 0.5, poly), color);
}

/** A smiley face (yellow, black eyes/mouth). */
export function smileyGrid(n = 16) {
  const cx = (n - 1) / 2;
  const cy = (n - 1) / 2;
  const R = n * 0.46;
  const inside = (x, y) => Math.hypot(x - cx, y - cy) <= R;
  const eyesMouth = (x, y) => {
    const eye = Math.hypot(x - (cx - 2.6), y - (cy - 2)) < 1.2 || Math.hypot(x - (cx + 2.6), y - (cy - 2)) < 1.2;
    const mouth = y - cy > 1.2 && Math.abs(Math.hypot(x - cx, y - cy) - R * 0.62) < 1.15;
    return eye || mouth;
  };
  return fillFromMask(n, inside, (x, y) => (eyesMouth(x, y) ? 1 : 5));
}

function regularPoly(cx, cy, R, sides, rot = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot - Math.PI / 2 + (i * 2 * Math.PI) / sides;
    pts.push([cx + Math.cos(a) * R, cy + Math.sin(a) * R]);
  }
  return pts;
}
function polyGrid(n, poly, colorFn) {
  return fillFromMask(n, (x, y) => pointInPoly(x + 0.5, y + 0.5, poly), colorFn);
}
const center = (n) => (n - 1) / 2;

export function triangleGrid(n = 16) {
  const c = center(n);
  return polyGrid(n, regularPoly(c, c, n * 0.5, 3), rainbowByCol(n));
}
export function pentagonGrid(n = 16) {
  const c = center(n);
  return polyGrid(n, regularPoly(c, c, n * 0.47, 5), rainbowByCol(n));
}
export function hexagonGrid(n = 16) {
  const c = center(n);
  return polyGrid(n, regularPoly(c, c, n * 0.47, 6), rainbowByCol(n));
}
export function octagonGrid(n = 16) {
  const c = center(n);
  return polyGrid(n, regularPoly(c, c, n * 0.5, 8, Math.PI / 8), rainbowByCol(n));
}
export function circleGrid(n = 16) {
  const c = center(n);
  return fillFromMask(n, (x, y) => Math.hypot(x - c, y - c) <= n * 0.46, rainbowByCol(n));
}
export function squareGrid(n = 16) {
  const c = center(n);
  return fillFromMask(n, (x, y) => Math.max(Math.abs(x - c), Math.abs(y - c)) <= n * 0.46, rainbowByCol(n));
}
export function plusGrid(n = 16) {
  const c = center(n);
  const w = n * 0.17;
  return fillFromMask(n, (x, y) => Math.abs(x - c) <= w || Math.abs(y - c) <= w, rainbowByCol(n));
}
export function crossGrid(n = 16) {
  const c = center(n);
  const w = n * 0.13;
  return fillFromMask(n, (x, y) => Math.abs(x - y) <= w || Math.abs(x + y - 2 * c) <= w, rainbowByCol(n));
}
export function ringGrid(n = 16) {
  const c = center(n);
  return fillFromMask(
    n,
    (x, y) => {
      const d = Math.hypot(x - c, y - c);
      return d <= n * 0.46 && d >= n * 0.28;
    },
    rainbowByCol(n)
  );
}
export function frameGrid(n = 16) {
  const c = center(n);
  return fillFromMask(
    n,
    (x, y) => {
      const m = Math.max(Math.abs(x - c), Math.abs(y - c));
      return m <= n * 0.46 && m >= n * 0.3;
    },
    rainbowByCol(n)
  );
}
export function moonGrid(n = 16) {
  const c = center(n);
  return fillFromMask(
    n,
    (x, y) => Math.hypot(x - c, y - c) <= n * 0.46 && Math.hypot(x - (c - 3), y - (c - 2)) > n * 0.42,
    () => 5
  );
}
export function sunGrid(n = 16) {
  const c = center(n);
  const R = n * 0.3;
  return fillFromMask(
    n,
    (x, y) => {
      const d = Math.hypot(x - c, y - c);
      if (d <= R) return true;
      const a = Math.atan2(y - c, x - c);
      const step = (2 * Math.PI) / 8;
      const off = Math.abs((((a % step) + step) % step) - step / 2);
      return d <= n * 0.46 && off < step * 0.12;
    },
    () => 5
  );
}
export function flowerGrid(n = 16) {
  const c = center(n);
  return fillFromMask(
    n,
    (x, y) => {
      const d = Math.hypot(x - c, y - c);
      const a = Math.atan2(y - c, x - c);
      const bound = n * 0.46 * (0.6 + 0.4 * Math.abs(Math.cos(3 * a)));
      return d <= bound;
    },
    (x, y) => (Math.hypot(x - c, y - c) <= n * 0.14 ? 5 : 9)
  );
}
export function arrowGrid(n = 16) {
  const poly = [
    [n * 0.5, n * 0.06],
    [n * 0.94, n * 0.5],
    [n * 0.66, n * 0.5],
    [n * 0.66, n * 0.94],
    [n * 0.34, n * 0.94],
    [n * 0.34, n * 0.5],
    [n * 0.06, n * 0.5],
  ];
  return polyGrid(n, poly, rainbowByCol(n));
}
export function boltGrid(n = 16) {
  const poly = [
    [n * 0.56, n * 0.04],
    [n * 0.22, n * 0.56],
    [n * 0.5, n * 0.56],
    [n * 0.4, n * 0.96],
    [n * 0.8, n * 0.4],
    [n * 0.52, n * 0.4],
  ];
  return polyGrid(n, poly, () => 5);
}
export function chevronGrid(n = 16) {
  const c = center(n);
  const w = n * 0.15;
  return fillFromMask(
    n,
    (x, y) => {
      const t1 = y - (x - c) * 0.9 - c + n * 0.3;
      const t2 = y + (x - c) * 0.9 - c + n * 0.3;
      return Math.abs(t1) < w || Math.abs(t2) < w;
    },
    rainbowByCol(n)
  );
}

/** Grid from an image via sharp (dev-dependency). bgHex marks background cells. */export async function gridFromImage(file, gridSize, palette, bgHex) {
  const mod = await import('sharp').catch(() => null);
  if (!mod || !mod.default) throw new Error('sharp is not installed. Run: npm install --save-dev sharp');
  const sharp = mod.default;
  const n = Math.max(4, Math.min(64, Number(gridSize) || 16));
  const { data } = await sharp(file)
    .resize(n, n, { fit: 'cover' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgb = palette.map(hexToRgb);
  const bg = bgHex ? hexToRgb(bgHex) : null;
  const grid = [];
  for (let y = 0; y < n; y++) {
    const row = [];
    for (let x = 0; x < n; x++) {
      const i = (y * n + x) * 3;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (bg && (r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2 < 1200) {
        row.push(0);
      } else {
        row.push(nearestPalette(r, g, b, rgb));
      }
    }
    grid.push(row);
  }
  return grid;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const size = Number(args.size) || 1000;
  const palette = args.palette && args.palette !== true ? String(args.palette).split(',') : PIXEL_PALETTE;
  const background = args.background || '#ececec';

  let grid;
  let id = args.id || 'pixel';
  let title = args.title || 'Pixel';
  if (args.image) {
    grid = await gridFromImage(String(args.image), Number(args['grid-size']) || 16, palette, args.bg);
    id = args.id || path.basename(String(args.image)).replace(/\.[^.]+$/, '').toLowerCase();
    title = args.title || id;
  } else {
    const shape = String(args.shape || 'heart');
    const builders = {
      heart: heartGrid,
      star: starGrid,
      smiley: smileyGrid,
      diamond: diamondGrid,
      triangle: triangleGrid,
      pentagon: pentagonGrid,
      hexagon: hexagonGrid,
      octagon: octagonGrid,
      circle: circleGrid,
      square: squareGrid,
      plus: plusGrid,
      cross: crossGrid,
      ring: ringGrid,
      frame: frameGrid,
      moon: moonGrid,
      sun: sunGrid,
      flower: flowerGrid,
      arrow: arrowGrid,
      bolt: boltGrid,
      chevron: chevronGrid,
    };
    const build = builders[shape];
    if (!build) throw new Error(`Unknown shape "${shape}" (heart|star|smiley|diamond, or --image <file>)`);
    grid = build();
    id = args.id || `pixel-${shape}`;
    title = args.title || `Pixel ${shape.charAt(0).toUpperCase() + shape.slice(1)}`;
  }

  const { svg, json } = buildPixelCanvas({ grid, size, palette, background, id, title });
  const outDir = path.resolve(process.cwd(), args.out || `src/js/data/canvases/${id}`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'canvas.svg'), svg, 'utf8');
  fs.writeFileSync(path.join(outDir, 'canvas.json'), JSON.stringify(json, null, 2) + '\n', 'utf8');
  const fillable = json.regions.filter((r) => r.target > 0).length;
  console.log(`[pixel] ${id}: ${json.regionCount} cells (${fillable} fillable) -> ${outDir}`);
}

const isMain = process.argv[1] && url.pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  main().catch((e) => {
    console.error(e && e.message ? e.message : e);
    process.exitCode = 1;
  });
}
