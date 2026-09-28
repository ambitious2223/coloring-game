import test from 'node:test';
import assert from 'node:assert/strict';
import { buildPalette } from '../src/js/core/palette.js';
import { parseChat } from '../src/js/core/parser.js';
import { createI18n } from '../src/js/i18n/index.js';

const palette = buildPalette();
const i18n = createI18n('en');
const colorIndex = i18n.colorIndex(palette);

test('parses "region colorword"', () => {
  assert.deepEqual(parseChat('12 green', palette, colorIndex), { region: 12, color: 2 });
});

test('parses "region colorindex"', () => {
  assert.deepEqual(parseChat('12 3', palette, colorIndex), { region: 12, color: 3 });
});

test('tolerates a leading # on the region', () => {
  assert.deepEqual(parseChat('#12 green', palette, colorIndex), { region: 12, color: 2 });
});

test('parses a hex color', () => {
  assert.deepEqual(parseChat('12 #e6194b', palette, colorIndex), { region: 12, color: 1 });
});

test('parses color words in Turkish and Arabic', () => {
  assert.deepEqual(parseChat('12 kirmizi', palette, colorIndex), { region: 12, color: 1 });
  assert.deepEqual(parseChat('12 أحمر', palette, colorIndex), { region: 12, color: 1 });
});

test('rejects malformed or out-of-range input', () => {
  assert.equal(parseChat('green', palette, colorIndex), null);
  assert.equal(parseChat('12 nope', palette, colorIndex), null);
  assert.equal(parseChat('12 99', palette, colorIndex), null);
  assert.equal(parseChat('', palette, colorIndex), null);
  assert.equal(parseChat(null, palette, colorIndex), null);
});
