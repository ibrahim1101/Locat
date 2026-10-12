import test from 'node:test';
import assert from 'node:assert/strict';
import { isLanAddress, isTailscaleAddress, parseLanOrigin, validateReadyResponse, checkLan } from './check-lan.mjs';

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

test('rejects unexpected redirects', async () => {
  await assert.rejects(checkLan('https://locat.example.com', {
    lookupImpl: async () => [{ address: '192.168.1.8' }],
    fetchImpl: async () => ({ status: 302 }),
    output: () => {},
  }), /redirect/);
});

test('accepts ready Locat response', async () => {
  await assert.doesNotReject(checkLan('https://locat.example.com', {
    lookupImpl: async () => [{ address: '192.168.1.8' }],
    fetchImpl: async () => ({ status: 200, json: async () => ({ app: 'Locat', status: 'ready' }) }),
    output: () => {},
  }));
});

test('Tailscale IPv4 bounds exclude adjacent and malformed addresses', () => {
  for (const address of ['100.64.0.0', '100.127.255.255']) assert.equal(isTailscaleAddress(address), true);
  for (const address of ['100.63.255.255', '100.128.0.0', '100.64.0.256', '100.64.0', '192.168.1.8', '::1']) {
    assert.equal(isTailscaleAddress(address), false);
  }
});

test('LAN and Tailscale checks reject mixed routes before making requests', async () => {
  for (const network of ['lan', 'tailscale']) {
    let called = false;
    await assert.rejects(checkLan('https://locat.example.com', {
      network, lookupImpl: async () => [{ address: '192.168.1.8' }, { address: '100.64.1.8' }],
      fetchImpl: async () => { called = true; throw new Error('must not fetch'); }, output: () => {},
    }), /DNS/);
    assert.equal(called, false);
  }
});

test('optional Tailscale check uses the same HTTPS backend and refuses redirects', async () => {
  const options = { network: 'tailscale', lookupImpl: async () => [{ address: '100.64.1.8' }], output: () => {} };
  await checkLan('https://locat.example.com', { ...options, fetchImpl: async (url, init) => {
    assert.equal(url.href, 'https://locat.example.com/api/ready');
    assert.equal(init.redirect, 'manual');
    return { status: 200, json: async () => ({ app: 'Locat', status: 'ready' }) };
  }});
  await assert.rejects(checkLan('https://locat.example.com', { ...options,
    fetchImpl: async () => ({ status: 302 }) }), /redirect/);
});
