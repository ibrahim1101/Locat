#!/usr/bin/env node
// Read-only LAN readiness check. Uses Node's normal TLS trust verification.
import { lookup } from 'node:dns/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export function parseLanOrigin(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('Supply a complete https:// server origin'); }
  if (url.protocol !== 'https:') throw new Error('HTTPS is required; HTTP is not accepted');
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') {
    throw new Error('Supply only the HTTPS origin (no credentials, path, query or fragment)');
  }
  return url;
}

export function isLanAddress(address) {
  const lower = address.toLowerCase();
  // Cross-device LAN checks must not pass on loopback or link-local addresses.
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true;
  if (lower.includes(':')) return false;
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  return octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168);
}

export function isTailscaleAddress(address) {
  const octets = address.split('.').map(Number);
  return octets.length === 4 && octets.every(n => Number.isInteger(n) && n >= 0 && n <= 255) &&
    octets[0] === 100 && octets[1] >= 64 && octets[1] <= 127;
}

export function validateReadyResponse(status, body) {
  if (status !== 200) throw new Error(`Server readiness returned HTTP ${status}; expected 200`);
  if (!body || body.app !== 'Locat' || body.status !== 'ready') {
    throw new Error('Server response is not a ready Locat backend');
  }
}

export async function checkLan(origin, { fetchImpl = fetch, lookupImpl = lookup, output = console.log, network = 'lan' } = {}) {
  if (network !== 'lan' && network !== 'tailscale') throw new Error('Unknown network mode');
  const url = parseLanOrigin(origin);
  const addresses = await lookupImpl(url.hostname, { all: true });
  if (!addresses.length) throw new Error('DNS did not return any server address');
  output(`DNS: ${addresses.map(item => item.address).join(', ')}`);
  if (!addresses.every(item => network === 'lan' ? isLanAddress(item.address) : isTailscaleAddress(item.address))) {
    throw new Error(network === 'lan'
      ? 'DNS includes a public, loopback, link-local or Tailscale address; fix LAN DNS before testing'
      : 'DNS must resolve only to Tailscale IPv4 addresses (100.64.0.0/10) for this check');
  }
  const ready = new URL('/api/ready', url);
  const response = await fetchImpl(ready, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    headers: { Accept: 'application/json' },
  });
  if (response.status >= 300 && response.status < 400) {
    throw new Error(`Unexpected HTTP ${response.status} redirect from readiness endpoint`);
  }
  let body;
  try { body = await response.json(); }
  catch { throw new Error('Readiness endpoint did not return JSON'); }
  validateReadyResponse(response.status, body);
  output(`PASS: ${network} route, trusted HTTPS and Locat database/schema readiness`);
  if (network === 'tailscale') output('NOTE: Address range alone does not prove Tailscale identity, invitation or access policy.');
  output('NOTE: This does not verify Android WebView trust, app login, messaging or physical Pi compatibility.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3 && !(process.argv.length === 4 && process.argv[3] === '--tailscale')) {
    console.error('Usage: node scripts/check-lan.mjs https://locat.example.com [--tailscale]');
    process.exitCode = 2;
  } else {
    checkLan(process.argv[2], { network: process.argv[3] ? 'tailscale' : 'lan' }).catch(error => {
      console.error(`FAIL: ${error.message}`);
      process.exitCode = 1;
    });
  }
}
