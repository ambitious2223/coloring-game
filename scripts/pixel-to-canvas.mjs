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

/** Grid from an image via sharp (dev-dependency). bgHex marks background cells. */
export async function gridFromImage(file, gridSize, palette, bgHex) {
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
    if (shape !== 'heart') throw new Error(`Unknown shape "${shape}" (try --shape heart, or --image <file>)`);
    grid = heartGrid();
    id = args.id || 'pixel-heart';
    title = args.title || 'Pixel Heart';
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
