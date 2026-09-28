// Color Chaos - canvas contract validator.
//
// This is THE contract between the game and any canvas generator (including the
// one built separately with Gemini). A canvas is valid only if this exits 0.
//
//   node scripts/validate-canvas.mjs <canvas-dir>
//   node scripts/validate-canvas.mjs --all     (every dir under src/js/data/canvases)
//
// A canvas dir must contain: canvas.svg + canvas.json
//
// Rules enforced:
//   - SVG has no <script>, no external refs; viewBox matches JSON.
//   - Colorable regions live in <g id="regions"> as <path id="rN">.
//   - Paths are polygons only (absolute M/L/Z; no curves/shortcuts).
//   - Numbers are 1..N, unique, no gaps; regionCount == JSON regions == path count.
//   - Every region has a point-labelled entry whose label lies INSIDE the polygon.
//   - Areas are positive; palette is a non-empty array; target (if present) is in range.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CANVAS_ROOT = path.resolve(__dirname, '..', 'src', 'js', 'data', 'canvases');

function parsePolygon(d) {
  if (typeof d !== 'string' || !d.trim()) return { ok: false, error: 'empty d attribute' };
  if (/[CcQqSsAaTtHhVv]/.test(d)) return { ok: false, error: 'curves/shortcuts not allowed (use absolute M/L/Z)' };
  if (/[mlz]/.test(d)) return { ok: false, error: 'relative commands not allowed (use absolute M/L/Z)' };

  const tokens = d.replace(/,/g, ' ').match(/[MLZ]|-?(?:\d+\.?\d*|\.\d+)/g) || [];
  const points = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === 'M' || t === 'L') {
      const x = Number(tokens[i + 1]);
      const y = Number(tokens[i + 2]);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return { ok: false, error: `bad coordinate near "${t}"` };
      points.push([x, y]);
      i += 3;
    } else if (t === 'Z') {
      i += 1;
    } else {
      return { ok: false, error: `unexpected token "${t}"` };
    }
  }
  if (points.length < 3) return { ok: false, error: 'fewer than 3 points' };
  return { ok: true, points };
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

function pointInPolygon([px, py], points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersect = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function validateCanvas(dir) {
  const errors = [];
  const svgPath = path.join(dir, 'canvas.svg');
  const jsonPath = path.join(dir, 'canvas.json');

  if (!fs.existsSync(svgPath)) errors.push('missing canvas.svg');
  if (!fs.existsSync(jsonPath)) errors.push('missing canvas.json');
  if (errors.length) return { name: path.basename(dir), errors };

  const svg = fs.readFileSync(svgPath, 'utf8');
  let json;
  try {
    json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    return { name: path.basename(dir), errors: [`canvas.json invalid JSON: ${e.message}`] };
  }

  // --- SVG-level rules ---
  if (/<script/i.test(svg)) errors.push('SVG must not contain <script>');
  if (/\b(href|xlink:href)\s*=/i.test(svg)) errors.push('SVG must not contain external references (href)');

  const group = svg.match(/<g[^>]*id="regions"[^>]*>([\s\S]*?)<\/g>/);
  if (!group) {
    errors.push('missing <g id="regions"> group');
    return { name: path.basename(dir), errors };
  }

  const found = new Map(); // number -> points
  const pathRe = /<path\b([^>]*)\/?>/g;
  let m;
  while ((m = pathRe.exec(group[1])) !== null) {
    const attrs = m[1];
    const idMatch = attrs.match(/id="r(\d+)"/);
    const dMatch = attrs.match(/\bd="([^"]*)"/);
    if (!idMatch) {
      errors.push('a <path> in #regions has no id="rN"');
      continue;
    }
    const number = Number(idMatch[1]);
    if (found.has(number)) errors.push(`duplicate region id r${number}`);
    const poly = parsePolygon(dMatch ? dMatch[1] : '');
    if (!poly.ok) {
      errors.push(`region r${number}: ${poly.error}`);
      continue;
    }
    found.set(number, poly.points);
  }

  // --- JSON-level rules ---
  if (!json || typeof json !== 'object') errors.push('canvas.json must be an object');
  const regions = Array.isArray(json.regions) ? json.regions : null;
  if (!regions) errors.push('canvas.json: "regions" must be an array');
  const palette = Array.isArray(json.palette) ? json.palette : null;
  if (!palette || palette.length === 0) errors.push('canvas.json: "palette" must be a non-empty array');
  if (!Array.isArray(json.viewBox) || json.viewBox.length !== 4) errors.push('canvas.json: "viewBox" must be [x,y,w,h]');

  if (Array.isArray(json.viewBox) && json.viewBox.length === 4) {
    const vb = json.viewBox.join(' ');
    const svgVb = (svg.match(/viewBox="([^"]+)"/) || [])[1];
    if (svgVb && svgVb.replace(/\s+/g, ' ').trim() !== vb.replace(/\s+/g, ' ').trim()) {
      errors.push(`viewBox mismatch: svg="${svgVb}" json="${vb}"`);
    }
  }

  if (regions) {
    if (json.regionCount !== regions.length) errors.push(`regionCount (${json.regionCount}) != regions.length (${regions.length})`);
    if (json.regionCount !== found.size) errors.push(`regionCount (${json.regionCount}) != paths in SVG (${found.size})`);

    const nums = regions.map((r) => r && r.number);
    const set = new Set(nums);
    if (set.size !== nums.length) errors.push('duplicate region numbers in JSON');
    for (let i = 1; i <= regions.length; i++) {
      if (!set.has(i)) errors.push(`missing region number ${i} (numbers must be 1..N, no gaps)`);
    }

    for (const r of regions) {
      if (!r || typeof r !== 'object') continue;
      if (!found.has(r.number)) {
        errors.push(`region ${r.number}: no matching <path id="r${r.number}">`);
        continue;
      }
      const points = found.get(r.number);
      if (!Array.isArray(r.label) || r.label.length !== 2 || !r.label.every(Number.isFinite)) {
        errors.push(`region ${r.number}: label must be [x, y]`);
      } else if (!pointInPolygon(r.label, points)) {
        errors.push(`region ${r.number}: label ${JSON.stringify(r.label)} is OUTSIDE the polygon`);
      }
      if (typeof r.area !== 'number' || !(r.area > 0)) {
        errors.push(`region ${r.number}: area must be a positive number`);
      } else if (Math.abs(r.area - shoelace(points)) > Math.max(1, r.area * 0.01)) {
        errors.push(`region ${r.number}: area (${r.area}) does not match geometry (${shoelace(points).toFixed(1)})`);
      }
      if (r.target != null) {
        if (!palette || !Number.isInteger(r.target) || r.target < 1 || r.target > palette.length) {
          errors.push(`region ${r.number}: target ${r.target} out of palette range 1..${palette ? palette.length : '?'}`);
        }
      }
    }
  }

  return { name: json && json.id ? json.id : path.basename(dir), errors };
}

function listCanvasDirs() {
  if (!fs.existsSync(CANVAS_ROOT)) return [];
  return fs
    .readdirSync(CANVAS_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => path.join(CANVAS_ROOT, e.name))
    .filter((d) => fs.existsSync(path.join(d, 'canvas.json')) || fs.existsSync(path.join(d, 'canvas.svg')));
}

function main() {
  const arg = process.argv[2];
  const dirs = arg === '--all' || !arg ? listCanvasDirs() : [path.resolve(process.cwd(), arg)];

  if (dirs.length === 0) {
    console.error('No canvases found to validate.');
    process.exitCode = 1;
    return;
  }

  let failed = 0;
  for (const dir of dirs) {
    const { name, errors } = validateCanvas(dir);
    if (errors.length === 0) {
      console.log(`PASS  ${name}  (${dir})`);
    } else {
      failed += 1;
      console.log(`FAIL  ${name}  (${dir})`);
      for (const e of errors) console.log(`        - ${e}`);
    }
  }

  console.log(`\n${dirs.length - failed}/${dirs.length} canvas(es) valid.`);
  process.exitCode = failed ? 1 : 0;
}

main();
