import test from 'node:test';
import assert from 'node:assert/strict';
import { createQueue } from '../src/js/core/queue.js';

const u = (id, name) => ({ userId: id, name: name || id, avatar: '' });

test('add + dedupe by userId', () => {
  const q = createQueue();
  assert.equal(q.add(u('a')), true);
  assert.equal(q.add(u('a')), false);
  assert.equal(q.size(), 1);
  assert.equal(q.has('a'), true);
});

test('current + circular advance', () => {
  const q = createQueue();
  q.add(u('a'));
  q.add(u('b'));
  assert.equal(q.current().userId, 'a');
  assert.equal(q.advance().userId, 'b');
  assert.equal(q.advance().userId, 'a'); // wraps
});

test('priority insert plays right after the current player', () => {
  const q = createQueue();
  q.add(u('a'));
  q.add(u('b'));
  q.add(u('c'));
  q.add(u('vip'), { priority: true });
  assert.deepEqual(q.list().map((p) => p.userId), ['a', 'vip', 'b', 'c']);
  assert.equal(q.advance().userId, 'vip');
});

test('remove adjusts the cursor so the turn does not skip', () => {
  const q = createQueue();
  q.add(u('a'));
  q.add(u('b'));
  q.add(u('c'));
  q.advance(); // cursor at b
  q.remove('a'); // remove before cursor
  assert.equal(q.current().userId, 'b');
  q.remove('b'); // remove the current player -> next becomes current
  assert.equal(q.current().userId, 'c');
});

test('setCursor jumps to a player', () => {
  const q = createQueue();
  q.add(u('a'));
  q.add(u('b'));
  assert.equal(q.setCursor('b'), true);
  assert.equal(q.current().userId, 'b');
  assert.equal(q.setCursor('nope'), false);
});
