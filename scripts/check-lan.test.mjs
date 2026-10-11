import test from 'node:test';
import assert from 'node:assert/strict';
import { isLanAddress } from './check-lan.mjs';

test('private LAN addresses', () => {
  assert.equal(isLanAddress('192.168.1.5'), true);
  assert.equal(isLanAddress('127.0.0.1'), false);
});
