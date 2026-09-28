import test from 'node:test';
import assert from 'node:assert/strict';
import { createEngine } from '../src/js/core/engine.js';

const regions = [1, 2, 3, 4];

test('lock mode: first color locks, later colors are rejected', () => {
  const e = createEngine({ regionNumbers: regions, paletteSize: 10, mode: 'lock' });
  const first = e.apply({ regionNumber: 1, color: 2, user: 'a' });
  assert.equal(first.ok, true);
  assert.equal(first.verb, 'colored');

  const second = e.apply({ regionNumber: 1, color: 5, user: 'b' });
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'locked');
  assert.equal(e.region(1).color, 2);
});

test('lock mode: override recolors a locked region', () => {
  const e = createEngine({ regionNumbers: regions, paletteSize: 10, mode: 'lock' });
  e.apply({ regionNumber: 1, color: 2, user: 'a' });
  const res = e.apply({ regionNumber: 1, color: 5, user: 'b', override: true });
  assert.equal(res.ok, true);
  assert.equal(res.verb, 'overwrote');
  assert.equal(e.region(1).color, 5);
});

test('chaos mode: any color overwrites', () => {
  const e = createEngine({ regionNumbers: regions, paletteSize: 10, mode: 'chaos' });
  e.apply({ regionNumber: 1, color: 2, user: 'a' });
  const res = e.apply({ regionNumber: 1, color: 5, user: 'b' });
  assert.equal(res.ok, true);
  assert.equal(res.verb, 'recolored');
  assert.equal(e.region(1).color, 5);
});

test('rejects unknown region and bad color', () => {
  const e = createEngine({ regionNumbers: regions, paletteSize: 10 });
  assert.equal(e.apply({ regionNumber: 99, color: 1 }).reason, 'unknown-region');
  assert.equal(e.apply({ regionNumber: 1, color: 99 }).reason, 'bad-color');
});

test('progress + clear', () => {
  const e = createEngine({ regionNumbers: regions, paletteSize: 10 });
  e.apply({ regionNumber: 1, color: 1 });
  e.apply({ regionNumber: 2, color: 1 });
  assert.deepEqual(e.progress(), { colored: 2, total: 4 });
  e.clear(1);
  assert.deepEqual(e.progress(), { colored: 1, total: 4 });
  e.clearAll();
  assert.deepEqual(e.progress(), { colored: 0, total: 4 });
});
