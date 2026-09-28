import test from 'node:test';
import assert from 'node:assert/strict';
import { premiumPaint, premiumDefs, PREMIUM_STYLES } from '../src/js/core/fills.js';

test('every premium style maps to a paint', () => {
  for (const style of PREMIUM_STYLES) {
    const p = premiumPaint(style);
    assert.ok(p && typeof p.fill === 'string' && p.fill.startsWith('url(#'), `${style} should map to a url fill`);
  }
});

test('unknown styles return null', () => {
  assert.equal(premiumPaint('nope'), null);
});

test('defs define each referenced paint id', () => {
  const defs = premiumDefs();
  for (const id of ['cc-gold', 'cc-neon', 'cc-rainbow', 'cc-stripes', 'cc-dots', 'cc-glow']) {
    assert.ok(defs.includes(`id="${id}"`), `defs should define ${id}`);
  }
});
