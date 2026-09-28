import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPixelCanvas, heartGrid, PIXEL_PALETTE } from '../scripts/pixel-to-canvas.mjs';

test('heart grid is 16x16 with background and fillable colours', () => {
  const grid = heartGrid();
  assert.equal(grid.length, 16);
  assert.ok(grid.every((r) => r.length === 16));
  const flat = grid.flat();
  assert.ok(flat.includes(0), 'has background cells');
  assert.ok(flat.includes(1), 'has black outline cells');
  assert.ok(flat.includes(2), 'has white highlight cells');
  assert.ok(flat.some((v) => v >= 3 && v <= 9), 'has rainbow cells');
  assert.ok(flat.every((v) => v >= 0 && v <= PIXEL_PALETTE.length));
});

test('buildPixelCanvas emits a valid-looking pixel canvas', () => {
  const { svg, json, regionCount } = buildPixelCanvas({ grid: heartGrid(), id: 'pixel-heart', title: 'Pixel Heart' });
  assert.equal(regionCount, 256);
  assert.equal(json.regionCount, 256);
  assert.equal(json.type, 'pixel');
  assert.equal(json.numbering, 'color');
  assert.equal(json.palette.length, 9);
  assert.equal(json.regions.length, 256);
  assert.equal((svg.match(/<path /g) || []).length, 256);
  assert.deepEqual(json.viewBox, [0, 0, 1000, 1000]);
  // every region has a target 0..9 and a positive area
  assert.ok(json.regions.every((r) => Number.isInteger(r.target) && r.target >= 0 && r.target <= 9));
  assert.ok(json.regions.every((r) => r.area > 0));
});
