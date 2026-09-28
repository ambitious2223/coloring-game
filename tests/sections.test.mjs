import test from 'node:test';
import assert from 'node:assert/strict';
import { buildFillOrder, buildSections } from '../src/js/core/sections.js';

const regions = [{ number: 3 }, { number: 1 }, { number: 2 }, { number: 5 }, { number: 4 }];

test('fill order is ascending by region number (centre-outward)', () => {
  assert.deepEqual(buildFillOrder(regions), [1, 2, 3, 4, 5]);
});

test('sections group the fill order per turn', () => {
  assert.deepEqual(buildSections(regions, 1), [[1], [2], [3], [4], [5]]);
  assert.deepEqual(buildSections(regions, 2), [[1, 2], [3, 4], [5]]);
});

test('perTurn is clamped to at least 1 and tolerates junk input', () => {
  assert.deepEqual(buildSections(regions, 0), [[1], [2], [3], [4], [5]]);
  assert.deepEqual(buildSections(regions, NaN), [[1], [2], [3], [4], [5]]);
  assert.deepEqual(buildSections([], 3), []);
});
