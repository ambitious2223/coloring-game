// Color Chaos - regenerate the example photo canvases, 100% offline.
//
//   npm run gen:examples
//
// Generates a set of synthetic "photos" locally with sharp (no network at all),
// converts each into a numbered canvas via the photo pipeline, and leaves the
// results in src/js/data/canvases/photo-demo-*. Deterministic and re-runnable.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { generatePhotoCanvas } from './photo-to-canvas.mjs';

const IMAGES_DIR = 'examples';
const CANVAS_ROOT = path.join('src', 'js', 'data', 'canvases');

const SCENES = {
  sunset: `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#0b1a4a"/><stop offset="45%" stop-color="#e2602a"/>
      <stop offset="75%" stop-color="#f6b23a"/><stop offset="100%" stop-color="#fbe6a2"/>
    </linearGradient>
    <linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#2a5d8f"/><stop offset="100%" stop-color="#0a1f3d"/>
    </linearGradient>
  </defs>
  <rect width="900" height="380" fill="url(#sky)"/>
  <rect y="380" width="900" height="220" fill="url(#water)"/>
  <ellipse cx="200" cy="120" rx="120" ry="26" fill="#ffffff" opacity="0.12"/>
  <ellipse cx="520" cy="90" rx="150" ry="22" fill="#ffffff" opacity="0.10"/>
  <circle cx="670" cy="320" r="60" fill="#ffe08a"/>
  <path d="M0 380 L170 250 L330 380 Z" fill="#2b3a55"/>
  <path d="M250 380 L430 200 L650 380 Z" fill="#3c4f6e"/>
  <path d="M520 380 L700 250 L900 380 Z" fill="#1b2740"/>
  <rect y="378" width="900" height="8" fill="#0a1220"/>
</svg>`,

  abstract: `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#3b0764"/><stop offset="50%" stop-color="#7c3aed"/>
      <stop offset="100%" stop-color="#06b6d4"/>
    </linearGradient>
  </defs>
  <rect width="800" height="600" fill="url(#bg)"/>
  <circle cx="250" cy="220" r="170" fill="#f43f5e" opacity="0.75"/>
  <circle cx="520" cy="300" r="190" fill="#f59e0b" opacity="0.70"/>
  <circle cx="380" cy="430" r="150" fill="#22d3ee" opacity="0.70"/>
  <rect x="60" y="60" width="220" height="140" fill="#a3e635" opacity="0.60"/>
  <rect x="520" y="80" width="200" height="160" fill="#e879f9" opacity="0.60"/>
</svg>`,

  portrait: `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="72%">
      <stop offset="0%" stop-color="#fde68a"/><stop offset="60%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </radialGradient>
  </defs>
  <rect width="700" height="700" fill="url(#bg)"/>
  <ellipse cx="350" cy="300" rx="120" ry="145" fill="#3f2a1d"/>
  <circle cx="350" cy="300" r="95" fill="#d9a066"/>
  <circle cx="320" cy="300" r="10" fill="#241812"/>
  <circle cx="380" cy="300" r="10" fill="#241812"/>
  <path d="M255 300 a95 95 0 0 0 190 0 L445 250 L255 250 Z" fill="#3f2a1d"/>
  <path d="M350 395 C250 395 180 470 170 700 L530 700 C520 470 450 395 350 395 Z" fill="#1e3a8a"/>
</svg>`,
};

async function main() {
  fs.mkdirSync(IMAGES_DIR, { recursive: true });
  const names = Object.keys(SCENES);

  for (const name of names) {
    const file = path.join(IMAGES_DIR, `demo-${name}.png`);
    await sharp(Buffer.from(SCENES[name])).png().toFile(file);
    console.log(`[examples] wrote ${file}`);
  }

  for (const name of names) {
    await generatePhotoCanvas({
      image: path.join(IMAGES_DIR, `demo-${name}.png`),
      out: path.join(CANVAS_ROOT, `photo-demo-${name}`),
      regions: 60,
      size: 900,
      palette: 10,
    });
  }

  console.log('[examples] done');
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exitCode = 1;
});
