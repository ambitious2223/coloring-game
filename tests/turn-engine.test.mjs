import test from 'node:test';
import assert from 'node:assert/strict';
import { createQueue } from '../src/js/core/queue.js';
import { createTurnEngine } from '../src/js/core/turn-engine.js';

const u = (id) => ({ userId: id, name: id, avatar: '' });
const sections = [[1], [2], [3]];

test('start with players enters await-color on the first player', () => {
  const q = createQueue();
  const e = createTurnEngine({ sections, queue: q });
  e.addPlayer(u('a'));
  e.addPlayer(u('b'));
  assert.equal(e.state, 'signup');
  assert.equal(e.start(), 'await-color');
  assert.equal(e.current.userId, 'a');
});

test('a turn colours the next section, credits the author, and passes the turn', () => {
  const q = createQueue();
  const e = createTurnEngine({ sections, queue: q });
  e.addPlayer(u('a'));
  e.addPlayer(u('b'));
  e.start();

  const first = e.setColor(5);
  assert.deepEqual(first.regions, [1]);
  assert.equal(first.color, 5);
  assert.equal(first.author.userId, 'a');
  assert.equal(e.current.userId, 'b');

  const second = e.setColor(3);
  assert.deepEqual(second.regions, [2]);
  assert.equal(second.author.userId, 'b');
  assert.equal(e.current.userId, 'a'); // circular loop
});

test('skip passes the turn but leaves the section for the next player', () => {
  const q = createQueue();
  const e = createTurnEngine({ sections, queue: q });
  e.addPlayer(u('a'));
  e.addPlayer(u('b'));
  e.start();

  assert.equal(e.skip().userId, 'b');
  const res = e.setColor(2);
  assert.deepEqual(res.regions, [1]); // section 1 still first
  assert.equal(res.author.userId, 'b');
});

test('two players can fill the whole mural by alternating', () => {
  const q = createQueue();
  const e = createTurnEngine({ sections, queue: q });
  e.addPlayer(u('a'));
  e.addPlayer(u('b'));
  e.start();
  e.setColor(1);
  e.setColor(2);
  e.setColor(3);
  assert.equal(e.state, 'complete');
  assert.deepEqual(e.progress(), { done: 3, total: 3 });
  assert.equal(e.results().length, 3);
});

test('start with no players waits; a join wakes it', () => {
  const q = createQueue();
  const e = createTurnEngine({ sections, queue: q });
  assert.equal(e.start(), 'waiting');
  e.addPlayer(u('a'));
  assert.equal(e.state, 'await-color');
});

test('setColor/skip are ignored unless await-color', () => {
  const q = createQueue();
  const e = createTurnEngine({ sections, queue: q });
  assert.equal(e.setColor(1), null);
  assert.equal(e.skip(), null);
});
