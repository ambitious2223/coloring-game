import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBridgeMessage } from '../src/js/integrations/connector.js';

test('normalises a bridge chat message', () => {
  const raw = JSON.stringify({
    event: 'chat',
    data: { uniqueId: 'ayla', nickname: 'Ayla', comment: 'join', profilePictureUrl: 'http://img/x.png' },
  });
  assert.deepEqual(normalizeBridgeMessage(raw), {
    userId: 'ayla',
    username: 'ayla',
    name: 'Ayla',
    avatar: 'http://img/x.png',
    type: 'chat',
    message: 'join',
  });
});

test('normalises a bridge gift message', () => {
  const raw = JSON.stringify({
    event: 'gift',
    data: { uniqueId: 'b', nickname: 'B', giftName: 'Rose', repeatCount: 3, diamondCount: 1 },
  });
  const ev = normalizeBridgeMessage(raw);
  assert.equal(ev.type, 'gift');
  assert.equal(ev.giftName, 'Rose');
  assert.equal(ev.count, 3);
  assert.equal(ev.coins, 1);
});

test('accepts msg.type alias and rejects junk', () => {
  assert.equal(normalizeBridgeMessage(JSON.stringify({ type: 'follow', data: { uniqueId: 'c' } })).type, 'follow');
  assert.equal(normalizeBridgeMessage(JSON.stringify({ event: 'nope', data: {} })), null);
  assert.equal(normalizeBridgeMessage('not json'), null);
  assert.equal(normalizeBridgeMessage(JSON.stringify({ event: 'chat', data: { comment: '' } })), null);
});
