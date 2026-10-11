import test from 'node:test';
import assert from 'node:assert/strict';
import { isLanAddress, parseLanOrigin, validateReadyResponse } from './check-lan.mjs';

test('private LAN addresses', () => {
  for (const address of ['192.168.1.5', '10.0.0.1', '172.16.1.2', 'fd00::1']) {
    assert.equal(isLanAddress(address), true);
  }
  for (const address of ['127.0.0.1', '8.8.8.8', '::1', 'fe80::1']) {
    assert.equal(isLanAddress(address), false);
  }
});

test('requires a clean HTTPS origin', () => {
  assert.equal(parseLanOrigin('https://locat.example.com').origin, 'https://locat.example.com');
  assert.throws(() => parseLanOrigin('http://locat.example.com'));
  assert.throws(() => parseLanOrigin('https://locat.example.com/extra'));
});

test('recognizes ready Locat backend', () => {
  assert.doesNotThrow(() => validateReadyResponse(200, { app: 'Locat', status: 'ready' }));
  assert.throws(() => validateReadyResponse(503, { app: 'Locat', status: 'unavailable' }));
});
