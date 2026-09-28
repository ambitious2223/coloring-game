import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixelEngine } from '../src/js/core/pixel-engine.js';

// 3 cells of colour 1, 2 of colour 2, 1 of colour 3, plus a background cell (0).
const regions = [
  { number: 1, target: 1 },
  { number: 2, target: 1 },
  { number: 3, target: 1 },
  { number: 4, target: 2 },
  { number: 5, target: 2 },
  { number: 6, target: 3 },
  { number: 7, target: 0 },
];

test('counts only fillable cells', () => {
  const e = createPixelEngine({ regions });
  assert.equal(e.total(), 6);
  assert.equal(e.remaining(1), 3);
  assert.equal(e.remaining(2), 2);
  assert.equal(e.remaining(3), 1);
  assert.equal(e.remaining(9), 0);
});

test('one gift fills one random cell of its colour', () => {
  const e = createPixelEngine({ regions });
  const out = e.fillRandom(1, 1);
  assert.equal(out.length, 1);
  assert.equal(out[0].color, 1);
  assert.equal(e.remaining(1), 2);
});

test('filling an empty colour does nothing', () => {
  const e = createPixelEngine({ regions });
  assert.deepEqual(e.fillRandom(9, 1), []);
});

test('fillColor finishes a whole colour; fillNearestColor picks the smallest', () => {
  const e = createPixelEngine({ regions });
  assert.equal(e.fillNearestColor().length, 1); // colour 3 has just 1 cell
  assert.equal(e.remaining(3), 0);
  assert.equal(e.fillColor(1).length, 3);
  assert.equal(e.remaining(1), 0);
});

test('fillAny fills across colours', () => {
  const e = createPixelEngine({ regions });
  assert.equal(e.fillAny(4).length, 4);
  assert.equal(e.progress().filled, 4);
});

test('progress and milestones fire once each', () => {
  const e = createPixelEngine({ regions, milestones: [0.5, 1] });
  assert.deepEqual(e.checkMilestones(), []);
  e.fillAny(3); // 3/6 = 50%
  assert.deepEqual(e.checkMilestones(), [0.5]);
  assert.deepEqual(e.checkMilestones(), []); // not repeated
  e.fillAny(3); // 100%
  assert.deepEqual(e.checkMilestones(), [1]);
  assert.equal(e.progress().percent, 1);
});

test('reset restores every cell', () => {
  const e = createPixelEngine({ regions });
  e.fillAny(6);
  assert.equal(e.progress().filled, 6);
  e.reset();
  assert.equal(e.progress().filled, 0);
  assert.equal(e.remaining(1), 3);
});
