#!/usr/bin/env node
/**
 * generate-svg.mjs
 * ----------------
 * Procedurally generates numbered, colorable SVG canvases and metadata
 * for TikTok live coloring games.
 *
 * Usage:
 *   node generate-svg.mjs --style voronoi --seed 42 --regions 90 --size 1000 --out ./out [--palette 10] [--targets]
 */

import fs from 'node:fs';
import path from 'node:path';

// ==========================================
// 1. CLI ARGUMENT PARSING
// ==========================================

function parseArgs(argv) {
  const args = {
    style: 'voronoi',
    seed: '42',
    regions: 90,
    size: 1000,
    out: './out',
    palette: 10,
    targets: false,
    // photo mode (delegates to photo-to-canvas.mjs)
    image: null,
    dir: null,
    smooth: true,
    epsilon: null
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--style' && i + 1 < argv.length) {
      args.style = argv[++i];
    } else if (arg === '--seed' && i + 1 < argv.length) {
      args.seed = argv[++i];
    } else if (arg === '--regions' && i + 1 < argv.length) {
      args.regions = parseInt(argv[++i], 10);
    } else if (arg === '--size' && i + 1 < argv.length) {
      args.size = parseInt(argv[++i], 10);
    } else if (arg === '--out' && i + 1 < argv.length) {
      args.out = argv[++i];
    } else if (arg === '--palette' && i + 1 < argv.length) {
      args.palette = parseInt(argv[++i], 10);
    } else if (arg === '--image' && i + 1 < argv.length) {
      args.image = argv[++i];
    } else if (arg === '--dir' && i + 1 < argv.length) {
      args.dir = argv[++i];
    } else if (arg === '--epsilon' && i + 1 < argv.length) {
      args.epsilon = parseFloat(argv[++i]);
    } else if (arg === '--no-smooth') {
      args.smooth = false;
    } else if (arg === '--targets') {
      args.targets = true;
    }
  }

  return args;
}

// ==========================================
// 2. DETERMINISTIC SEEDED PRNG (Mulberry32)
// ==========================================

function createPRNG(seedInput) {
  let seed;
  if (typeof seedInput === 'number' && !isNaN(seedInput)) {
    seed = seedInput >>> 0;
  } else {
    // FNV-1a hash string seed
    let h = 2166136261 >>> 0;
    const str = String(seedInput);
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    seed = h;
  }

  return function nextFloat() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ==========================================
// 3. COLOR PALETTE GENERATOR
// ==========================================

const BASE_PALETTE = [
  '#e6194b', '#3cb44b', '#4363d8', '#ffe119', '#f58231',
  '#911eb4', '#46f0f0', '#f032e6', '#bcf60c', '#fabebe',
  '#008080', '#e6beff', '#9a6324', '#fffac8', '#800000',
  '#aaffc3', '#808000', '#ffd8b1', '#000075', '#808080'
];

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

function getPalette(count) {
  if (count <= BASE_PALETTE.length) {
    return BASE_PALETTE.slice(0, count);
  }
  const palette = [...BASE_PALETTE];
  const needed = count - BASE_PALETTE.length;
  for (let i = 0; i < needed; i++) {
    const hue = Math.round((i * 360) / needed) % 360;
    palette.push(hslToHex(hue, 70, 50));
  }
  return palette;
}

// ==========================================
// 4. GEOMETRY & POLYGON CLIPPER
// ==========================================

function pointToSegmentDistSq(px, py, ax, ay, bx, by) {
  let dx = bx - ax;
  let dy = by - ay;
  if (dx !== 0 || dy !== 0) {
    const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    if (t > 1) {
      ax = bx;
      ay = by;
    } else if (t > 0) {
      ax += t * dx;
      ay += t * dy;
    }
  }
  dx = px - ax;
  dy = py - ay;
  return dx * dx + dy * dy;
}

function pointInPolygon(px, py, polygon) {
  let inside = false;
  const len = polygon.length;
  for (let i = 0, j = len - 1; i < len; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > py) !== (yj > py)) &&
      (px < ((xj - xi) * (py - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointToPolygonDist(px, py, polygon) {
  let minDistSq = Infinity;
  const len = polygon.length;
  for (let i = 0, j = len - 1; i < len; j = i++) {
    const distSq = pointToSegmentDistSq(
      px, py,
      polygon[i][0], polygon[i][1],
      polygon[j][0], polygon[j][1]
    );
    if (distSq < minDistSq) {
      minDistSq = distSq;
    }
  }
  const dist = Math.sqrt(minDistSq);
  return pointInPolygon(px, py, polygon) ? dist : -dist;
}

function getPolygonCentroidAndArea(poly) {
  let cx = 0, cy = 0, area2 = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const cross = a[0] * b[1] - b[0] * a[1];
    area2 += cross;
    cx += (a[0] + b[0]) * cross;
    cy += (a[1] + b[1]) * cross;
  }
  const area = Math.abs(area2) / 2;
  if (Math.abs(area2) < 1e-6) {
    return { centroid: poly[0] ? [poly[0][0], poly[0][1]] : [0, 0], area: 0 };
  }
  cx = cx / (3 * area2);
  cy = cy / (3 * area2);
  return { centroid: [cx, cy], area };
}

function cleanPolygon(poly) {
  if (poly.length < 3) return [];

  const pts = [];
  for (let i = 0; i < poly.length; i++) {
    const pt = poly[i];
    if (pts.length === 0) {
      pts.push(pt);
    } else {
      const prev = pts[pts.length - 1];
      const distSq = (pt[0] - prev[0]) ** 2 + (pt[1] - prev[1]) ** 2;
      if (distSq > 1e-8) {
        pts.push(pt);
      }
    }
  }

  if (pts.length > 1) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if ((first[0] - last[0]) ** 2 + (first[1] - last[1]) ** 2 < 1e-8) {
      pts.pop();
    }
  }

  if (pts.length < 3) return [];

  const result = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const pPrev = pts[(i + n - 1) % n];
    const pCurr = pts[i];
    const pNext = pts[(i + 1) % n];

    const v1x = pCurr[0] - pPrev[0];
    const v1y = pCurr[1] - pPrev[1];
    const v2x = pNext[0] - pCurr[0];
    const v2y = pNext[1] - pCurr[1];

    const cross = v1x * v2y - v1y * v2x;
    if (Math.abs(cross) > 1e-6) {
      result.push(pCurr);
    }
  }

  if (result.length < 3) return [];

  let area2 = 0;
  for (let i = 0; i < result.length; i++) {
    const a = result[i];
    const b = result[(i + 1) % result.length];
    area2 += a[0] * b[1] - b[0] * a[1];
  }

  if (Math.abs(area2) < 1e-5) return [];

  if (area2 < 0) {
    result.reverse();
  }

  return result;
}

function clipPolygonByHalfPlane(poly, Mx, My, Nx, Ny) {
  if (poly.length === 0) return [];

  const out = [];
  const len = poly.length;

  for (let i = 0; i < len; i++) {
    const curr = poly[i];
    const prev = poly[(i + len - 1) % len];

    const fCurr = (curr[0] - Mx) * Nx + (curr[1] - My) * Ny;
    const fPrev = (prev[0] - Mx) * Nx + (prev[1] - My) * Ny;

    const currIn = fCurr <= 1e-9;
    const prevIn = fPrev <= 1e-9;

    if (currIn) {
      if (!prevIn) {
        const t = fPrev / (fPrev - fCurr);
        const ix = prev[0] + t * (curr[0] - prev[0]);
        const iy = prev[1] + t * (curr[1] - prev[1]);
        out.push([ix, iy]);
      }
      out.push(curr);
    } else if (prevIn) {
      const t = fPrev / (fPrev - fCurr);
      const ix = prev[0] + t * (curr[0] - prev[0]);
      const iy = prev[1] + t * (curr[1] - prev[1]);
      out.push([ix, iy]);
    }
  }

  return cleanPolygon(out);
}

// ==========================================
// 5. POLYLABEL (POLE OF INACCESSIBILITY)
// ==========================================

function polylabel(polygon, precision = 0.5) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < polygon.length; i++) {
    const p = polygon[i];
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  }

  const width = maxX - minX;
  const height = maxY - minY;
  const cellSize = Math.min(width, height);
  if (cellSize === 0) return [minX, minY];

  const h = cellSize / 2;
  const { centroid } = getPolygonCentroidAndArea(polygon);

  let bestCell = {
    x: centroid[0],
    y: centroid[1],
    h: 0,
    d: pointToPolygonDist(centroid[0], centroid[1], polygon),
    max: 0
  };
  bestCell.max = bestCell.d;

  const bboxX = minX + width / 2;
  const bboxY = minY + height / 2;
  const bboxDist = pointToPolygonDist(bboxX, bboxY, polygon);
  if (bboxDist > bestCell.d) {
    bestCell = { x: bboxX, y: bboxY, h: 0, d: bboxDist, max: bboxDist };
  }

  const cellQueue = [];

  function addCell(x, y, cellH) {
    const d = pointToPolygonDist(x, y, polygon);
    const max = d + cellH * Math.SQRT2;
    cellQueue.push({ x, y, h: cellH, d, max });
  }

  for (let x = minX; x < maxX; x += cellSize) {
    for (let y = minY; y < maxY; y += cellSize) {
      addCell(x + h, y + h, h);
    }
  }

  cellQueue.sort((a, b) => (b.max - a.max) || (a.x - b.x) || (a.y - b.y));

  while (cellQueue.length > 0) {
    const cell = cellQueue.shift();

    if (cell.d > bestCell.d) {
      bestCell = cell;
    }

    if (cell.max - bestCell.d <= precision) continue;

    const h2 = cell.h / 2;
    addCell(cell.x - h2, cell.y - h2, h2);
    addCell(cell.x + h2, cell.y - h2, h2);
    addCell(cell.x - h2, cell.y + h2, h2);
    addCell(cell.x + h2, cell.y + h2, h2);

    cellQueue.sort((a, b) => (b.max - a.max) || (a.x - b.x) || (a.y - b.y));
  }

  const resX = Math.round(bestCell.x * 100) / 100;
  const resY = Math.round(bestCell.y * 100) / 100;
  return [Object.is(resX, -0) ? 0 : resX, Object.is(resY, -0) ? 0 : resY];
}

// ==========================================
// 6. VORONOI CELL COMPUTATION
// ==========================================

function computeVoronoiCells(points, width, height) {
  const cells = [];
  const initialBox = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height]
  ];

  for (let i = 0; i < points.length; i++) {
    const Pi = points[i];
    let poly = [...initialBox];

    const neighbors = [];
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const Pj = points[j];
      const distSq = (Pj[0] - Pi[0]) ** 2 + (Pj[1] - Pi[1]) ** 2;
      neighbors.push({ j, distSq, Pj });
    }
    neighbors.sort((a, b) => a.distSq - b.distSq);

    for (let k = 0; k < neighbors.length; k++) {
      const Pj = neighbors[k].Pj;
      const Mx = (Pi[0] + Pj[0]) / 2;
      const My = (Pi[1] + Pj[1]) / 2;
      const Nx = Pj[0] - Pi[0];
      const Ny = Pj[1] - Pi[1];

      poly = clipPolygonByHalfPlane(poly, Mx, My, Nx, Ny);
      if (poly.length === 0) break;
    }

    cells.push(poly);
  }

  return cells;
}

// ==========================================
// 7. INITIAL POINT GENERATORS
// ==========================================

function generatePoints(style, numRegions, size, rng) {
  const points = [];
  const margin = size * 0.02;

  if (style === 'mosaic') {
    const cols = Math.round(Math.sqrt(numRegions));
    const rows = Math.ceil(numRegions / cols);
    const cellW = size / cols;
    const cellH = size / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (points.length >= numRegions) break;
        const x = (c + 0.15 + rng() * 0.7) * cellW;
        const y = (r + 0.15 + rng() * 0.7) * cellH;
        points.push([x, y]);
      }
    }
  } else if (style === 'blobs') {
    const numFoci = 3 + Math.floor(rng() * 3);
    const foci = [];
    for (let f = 0; f < numFoci; f++) {
      foci.push([
        size * (0.2 + rng() * 0.6),
        size * (0.2 + rng() * 0.6)
      ]);
    }
    for (let i = 0; i < numRegions; i++) {
      const focus = foci[i % numFoci];
      const angle = rng() * 2 * Math.PI;
      const dist = Math.pow(rng(), 1.5) * (size * 0.4);
      let x = focus[0] + Math.cos(angle) * dist;
      let y = focus[1] + Math.sin(angle) * dist;
      x = Math.max(margin, Math.min(size - margin, x));
      y = Math.max(margin, Math.min(size - margin, y));
      points.push([x, y]);
    }
  } else if (style === 'mandala') {
    const center = [size / 2, size / 2];
    points.push([center[0], center[1]]);
    const rings = Math.ceil(Math.sqrt(numRegions / 2));
    let count = 1;
    for (let ring = 1; ring <= rings && count < numRegions; ring++) {
      const radius = (ring / (rings + 0.5)) * (size * 0.45);
      const ringPoints = Math.min(numRegions - count, 6 * ring);
      const angleOffset = ring % 2 === 0 ? Math.PI / ringPoints : 0;
      for (let k = 0; k < ringPoints && count < numRegions; k++) {
        const angle = angleOffset + (k * 2 * Math.PI) / ringPoints;
        const x = center[0] + radius * Math.cos(angle);
        const y = center[1] + radius * Math.sin(angle);
        points.push([x, y]);
        count++;
      }
    }
  } else {
    // Default 'voronoi'
    for (let i = 0; i < numRegions; i++) {
      const x = margin + rng() * (size - 2 * margin);
      const y = margin + rng() * (size - 2 * margin);
      points.push([x, y]);
    }
  }

  while (points.length < numRegions) {
    points.push([
      margin + rng() * (size - 2 * margin),
      margin + rng() * (size - 2 * margin)
    ]);
  }

  return points;
}

// ==========================================
// 8. MAIN SCRIPT
// ==========================================

async function main() {
  const args = parseArgs(process.argv);

  // Photo mode: convert a raster image (or a folder of them) into canvases.
  if (args.style === 'photo' || args.image || args.dir) {
    const { generatePhotoCanvas } = await import('./photo-to-canvas.mjs');
    await generatePhotoCanvas(args);
    return;
  }

  const rng = createPRNG(args.seed);

  // 1. Initial point placement
  let points = generatePoints(args.style, args.regions, args.size, rng);

  // 2. Lloyd Relaxation (2 iterations for even cell distribution)
  const relaxIterations = 2;
  for (let iter = 0; iter < relaxIterations; iter++) {
    const cells = computeVoronoiCells(points, args.size, args.size);
    const newPoints = [];
    for (let i = 0; i < points.length; i++) {
      const poly = cells[i];
      if (poly && poly.length >= 3) {
        const { centroid } = getPolygonCentroidAndArea(poly);
        const clampedX = Math.max(1, Math.min(args.size - 1, centroid[0]));
        const clampedY = Math.max(1, Math.min(args.size - 1, centroid[1]));
        newPoints.push([clampedX, clampedY]);
      } else {
        newPoints.push(points[i]);
      }
    }
    points = newPoints;
  }

  // 3. Final Voronoi generation
  let cells = computeVoronoiCells(points, args.size, args.size);

  // 4. Merge/drop tiny cells below minArea threshold
  const minAreaThreshold = Math.max(10, (args.size * args.size) / (args.regions * 25));
  let modified = true;
  while (modified && points.length > 3) {
    modified = false;
    let minAreaIndex = -1;
    let smallestArea = Infinity;

    for (let i = 0; i < cells.length; i++) {
      const { area } = getPolygonCentroidAndArea(cells[i]);
      if (area < minAreaThreshold && area < smallestArea) {
        smallestArea = area;
        minAreaIndex = i;
      }
    }

    if (minAreaIndex !== -1) {
      points.splice(minAreaIndex, 1);
      cells = computeVoronoiCells(points, args.size, args.size);
      modified = true;
    }
  }

  // Filter out any residual empty cells
  const validCells = [];
  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i];
    if (cell && cell.length >= 3) {
      validCells.push(cell);
    }
  }

  // 5. Generate Palette & Region Metadata
  const palette = getPalette(args.palette);
  const regionCount = validCells.length;
  const jsonRegions = [];
  const svgPaths = [];

  function formatCoord(val) {
    const rounded = Math.round(val * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
  }

  for (let i = 0; i < regionCount; i++) {
    const num = i + 1;
    const poly = validCells[i];
    const { area } = getPolygonCentroidAndArea(poly);
    const labelPoint = polylabel(poly, 0.5);

    const pathD = 'M ' + poly.map((p) => `${formatCoord(p[0])},${formatCoord(p[1])}`).join(' L ') + ' Z';

    svgPaths.push(
      `    <path id="r${num}" data-number="${num}" d="${pathD}" fill="#ffffff" stroke="#111111" stroke-width="2"/>`
    );

    const regionObj = {
      number: num,
      label: labelPoint,
      area: Math.round(area)
    };

    if (args.targets) {
      regionObj.target = Math.floor(rng() * palette.length) + 1;
    }

    jsonRegions.push(regionObj);
  }

  // 6. Build File Contents
  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${args.size} ${args.size}">
  <g id="regions">
${svgPaths.join('\n')}
  </g>
</svg>
`;

  const titleStyle = args.style.charAt(0).toUpperCase() + args.style.slice(1);
  const jsonContent = JSON.stringify(
    {
      id: `${args.style}-${args.seed}-${regionCount}`,
      title: `${titleStyle} Canvas`,
      viewBox: [0, 0, args.size, args.size],
      regionCount: regionCount,
      palette: palette,
      regions: jsonRegions
    },
    null,
    2
  ) + '\n';

  // 7. Output to disk
  fs.mkdirSync(args.out, { recursive: true });
  fs.writeFileSync(path.join(args.out, 'canvas.svg'), svgContent, 'utf8');
  fs.writeFileSync(path.join(args.out, 'canvas.json'), jsonContent, 'utf8');
}

main().catch((e) => {
  console.error(e && e.message ? e.message : e);
  process.exitCode = 1;
});
