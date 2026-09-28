import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../src/js/core/rate-limit.js';

test('cooldown blocks a second immediate action from the same user', () => {
  const rl = createRateLimiter({ cooldownMs: 10000 });
  assert.equal(rl.check('a').ok, true);
  rl.record('a');
  const second = rl.check('a');
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'cooldown');
  // a different user is unaffected
  assert.equal(rl.check('b').ok, true);
});

test('share cap limits a user to N accepted actions', () => {
  const rl = createRateLimiter({ cooldownMs: 0, shareCap: 2 });
  rl.record('a');
  rl.record('a');
  const third = rl.check('a');
  assert.equal(third.ok, false);
  assert.equal(third.reason, 'cap');
});
