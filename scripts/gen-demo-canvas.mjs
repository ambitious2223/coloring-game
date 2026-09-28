// Color Chaos - demo/placeholder canvas generator.
//
// Emits the canonical canvas format (canvas.svg + canvas.json) using a jittered
// lattice: every cell is a quad, non-overlapping, covering the art box. This is
// a stand-in until the real procedural generator (Gemini) lands - it lets the
// game be built and seen immediately.
//
//   node scripts/gen-demo-canvas.mjs --cols 8 --rows 10 --size 1000 --seed 42
//        --out src/js/data/canvases/canvas-demo
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true;
  }
  return out;
}

const DEFAULT_PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#ffe119', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
];

// Deterministic PRNG so the same seed always yields the same canvas.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shoelace(points) {
  let s = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

function centroid(points) {
  let x = 0;
  let y = 0;
  for (const [px, py] of points) {
    x += px;
    y += py;
  }
  return [x / points.length, y / points.length];
}

const r2 = (n) => Math.round(n * 100) / 100;

function main() {
  const args = parseArgs(process.argv.slice(2));
  const cols = Number(args.cols) || 8;
  const rows = Number(args.rows) || 10;
  const size = Number(args.size) || 1000;
  const seed = Number(args.seed) || 42;
  const outDir = path.resolve(process.cwd(), args.out || 'src/js/data/canvases/canvas-demo');
  const rng = mulberry32(seed);

  const sx = size / cols;
  const sy = size / rows;

  // Build the lattice; jitter interior points only, so the outer border stays
  // exactly on the art box (clean outline) and cells never leave the canvas.
  const pt = (i, j) => {
    let x = i * sx;
    let y = j * sy;
    const interior = i > 0 && i < cols && j > 0 && j < rows;
    if (interior) {
      x += (rng() - 0.5) * sx * 0.7;
      y += (rng() - 0.5) * sy * 0.7;
    }
    return [x, y];
  };

  const paths = [];
  const regions = [];
  let n = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      n += 1;
      const quad = [pt(i, j), pt(i + 1, j), pt(i + 1, j + 1), pt(i, j + 1)].map(([x, y]) => [r2(x), r2(y)]);
      const d = `M ${quad.map(([x, y]) => `${x} ${y}`).join(' L ')} Z`;
      paths.push(`    <path id="r${n}" data-number="${n}" d="${d}" fill="#ffffff" stroke="#111111" stroke-width="2"/>`);
      regions.push({
        number: n,
        label: centroid(quad).map(r2),
        area: r2(shoelace(quad)),
      });
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">\n  <g id="regions">\n${paths.join('\n')}\n  </g>\n</svg>\n`;

  const json = {
    id: 'canvas-demo',
    title: `Demo Canvas (${cols}x${rows})`,
    viewBox: [0, 0, size, size],
    regionCount: regions.length,
    palette: DEFAULT_PALETTE.slice(),
    regions,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'canvas.svg'), svg, 'utf8');
  fs.writeFileSync(path.join(outDir, 'canvas.json'), JSON.stringify(json, null, 2) + '\n', 'utf8');
  console.log(`[gen-demo] wrote ${regions.length} regions -> ${outDir}`);
}

main();
