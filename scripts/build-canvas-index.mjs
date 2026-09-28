// Color Chaos - build the canvas index used by the game (mode <-> canvas pairing).
//   node scripts/build-canvas-index.mjs
// Scans src/js/data/canvases/*/canvas.json and writes index.json.
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'src', 'js', 'data', 'canvases');

function main() {
  const dirs = fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const canvases = [];
  for (const name of dirs) {
    const file = path.join(ROOT, name, 'canvas.json');
    if (!fs.existsSync(file)) continue;
    try {
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      canvases.push({
        id: j.id || name,
        dir: name,
        type: j.type === 'pixel' ? 'pixel' : 'standard',
        title: j.title || name,
        numbering: j.numbering || 'unique',
        regionCount: j.regionCount || (Array.isArray(j.regions) ? j.regions.length : 0),
      });
    } catch {
      /* skip broken canvas */
    }
  }

  canvases.sort((a, b) => a.id.localeCompare(b.id));
  const out = { generated: new Date().toISOString(), canvases };
  fs.writeFileSync(path.join(ROOT, 'index.json'), JSON.stringify(out, null, 2) + '\n', 'utf8');
  const pixels = canvases.filter((c) => c.type === 'pixel').length;
  console.log(`[canvases] index: ${canvases.length} total, ${pixels} pixel`);
}

main();
