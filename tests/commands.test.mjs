import test from 'node:test';
import assert from 'node:assert/strict';
import { COMMANDS, findCommand, parseCommand, commandFromPayload } from '../src/js/core/commands.js';

test('parses a bare and a !-prefixed command with args', () => {
  assert.deepEqual(parseCommand('join'), { name: 'join', args: [] });
  assert.deepEqual(parseCommand('!color 12 green'), { name: 'color', args: ['12', 'green'] });
  assert.deepEqual(parseCommand('  Spawn   Dragon '), { name: 'spawn', args: ['Dragon'] });
  assert.equal(parseCommand(''), null);
  assert.equal(parseCommand(null), null);
});

test('findCommand is case/! insensitive and located in the table', () => {
  assert.ok(findCommand('JOIN'));
  assert.ok(findCommand('!wipe'));
  assert.equal(findCommand('nope'), null);
  assert.ok(COMMANDS.length >= 4);
});

test('commandFromPayload accepts args array', () => {
  assert.deepEqual(commandFromPayload({ name: 'color', args: ['12', '3'] }), { name: 'color', args: ['12', '3'] });
});

test('commandFromPayload accepts arg1/arg2/rest placeholders', () => {
  assert.deepEqual(commandFromPayload({ name: 'spawn', arg1: 'dragon', arg2: 'left' }), {
    name: 'spawn',
    args: ['dragon', 'left'],
  });
  assert.deepEqual(commandFromPayload({ command: 'gold' }), { name: 'gold', args: [] });
  assert.equal(commandFromPayload({}), null);
});
