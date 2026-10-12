import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const wave = Buffer.alloc(44 + 4800 * 2);
wave.write('RIFF'); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8); wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22); wave.writeUInt32LE(48000, 24); wave.writeUInt32LE(96000, 28); wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(wave.length - 44, 40);
const root = path.resolve('dist/public');
const server = createServer(async (request, response) => {
  try {
    let pathname = new URL(request.url, 'http://localhost').pathname;
    if (!path.extname(pathname)) pathname = '/index.html';
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root + path.sep)) { response.writeHead(403).end(); return; }
    const content = await readFile(file);
    response.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/html');
    response.end(content);
  } catch { response.writeHead(404).end(); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.route('**/api/ready', route => route.fulfill({ json: { app: 'Locat', status: 'ready' } }));
  await page.route('**/api/trpc/**', route => {
    if (route.request().url().includes('auth.register')) {
      const input = route.request().postDataJSON()['0'].json;
      return route.fulfill({ json: [{ result: { data: { json: { token: 'test-only', user: { id: 1, username: input.username, displayName: input.displayName, lcCode: 'TEST1234', publicKey: input.keys.publicKey, bio: null, usernameVisibility: 'everyone', profileVisibility: 'everyone', presenceVisibility: 'everyone', allowAvatarDownload: false } } } } }] });
    }
    return route.fulfill({ json: [{ result: { data: { json: null } } }] });
  });
  await page.goto(`${origin}/music`);
  await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
  assert.equal(await page.getByRole('navigation', { name: 'Modules' }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Sign in', exact: true }).count(), 1);
  const connection = page.getByRole('button', { name: 'Connect to server', exact: true });
  const position = await connection.boundingBox();
  assert.ok(position.x < 30 && position.y > 700);
  await connection.click();
  await page.getByRole('dialog').waitFor();
  assert.equal(await page.getByRole('textbox', { name: 'Server address' }).count(), 1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'New to Locat? Create account' }).click();
  await page.getByRole('textbox', { name: 'Username', exact: true }).fill('testalice');
  await page.locator('#password').fill('Evergreen orbit meadow 9274!');
  await page.locator('#password-confirm').fill('Evergreen orbit meadow 9274!');
  await page.getByRole('button', { name: 'Create account', exact: true }).click();
  await page.getByTestId('dashboard-masthead').waitFor();
  assert.equal(new URL(page.url()).pathname, '/');
  assert.equal(await page.getByTestId('module-card-messages').getAttribute('aria-disabled'), null);
  assert.equal(await page.getByTestId('module-card-calendar').getAttribute('aria-disabled'), 'true');
  assert.equal(await page.getByTestId('module-card-hub').getAttribute('aria-disabled'), 'true');
  await page.context().setOffline(true);
  await page.waitForFunction(() => document.querySelector('[data-testid="module-card-messages"]')?.getAttribute('aria-disabled') === 'true');
  assert.equal(await page.getByTestId('module-card-music').getAttribute('aria-disabled'), null);
  await page.close();
  const native = await browser.newPage();
  await native.addInitScript(() => { window.__TAURI_INTERNALS__ = {}; });
  await native.goto(origin);
  await native.getByRole('heading', { name: 'Welcome back' }).waitFor();
  assert.equal(await native.getByRole('button', { name: 'Sign in', exact: true }).isDisabled(), true);
  assert.equal(await native.getByText('Local mode', { exact: true }).count(), 0);
  let accountRequests = 0;
  await native.route('**/api/trpc/**', route => { accountRequests++; return route.abort(); });
  await native.getByRole('button', { name: 'Use non-server mode', exact: true }).click();
  await native.getByTestId('native-offline-home').waitFor();
  assert.equal(await native.getByTestId('local-disabled-messages').getAttribute('aria-disabled'), 'true');
  await native.getByRole('button', { name: 'Local Music', exact: false }).click();
  await native.getByLabel('Choose local music').setInputFiles({ name: 'offline.wav', mimeType: 'audio/wav', buffer: wave });
  await native.waitForFunction(() => document.querySelector('audio')?.readyState >= 1);
  assert.ok(await native.locator('audio').evaluate(audio => audio.src.startsWith('blob:') && audio.duration > 0));
  await native.getByRole('button', { name: 'Close media', exact: true }).click();
  await native.getByRole('button', { name: 'Local Cinema', exact: false }).click();
  const movieBytes = await native.evaluate(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 64;
    const context = canvas.getContext('2d'); context.fillStyle = 'orange'; context.fillRect(0, 0, 64, 64);
    const stream = canvas.captureStream(10), recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
    const chunks = []; recorder.ondataavailable = event => chunks.push(event.data);
    const done = new Promise(resolve => recorder.onstop = resolve);
    recorder.start(); const timer = setInterval(() => context.fillRect(0, 0, 64, 64), 30); await new Promise(resolve => setTimeout(resolve, 300)); clearInterval(timer); recorder.stop(); await done;
    stream.getTracks().forEach(track => track.stop());
    return [...new Uint8Array(await new Blob(chunks, { type: 'video/webm' }).arrayBuffer())];
  });
  await native.getByLabel('Choose local movie').setInputFiles({ name: 'offline.webm', mimeType: 'video/webm', buffer: Buffer.from(movieBytes) });
  await native.waitForFunction(() => document.querySelector('video')?.readyState >= 1);
  await native.getByRole('button', { name: 'Set or manage device passphrase' }).click();
  await native.getByTestId('app-lock-set').click();
  await native.getByTestId('app-lock-new').fill('local meadow 9274');
  await native.getByTestId('app-lock-confirm').fill('local meadow 9274');
  await native.getByRole('button', { name: 'Enable lock', exact: true }).click();
  await native.getByTestId('app-lock-gate').waitFor();
  const stored = await native.evaluate(() => localStorage.getItem('locat-app-lock-v1'));
  assert.ok(stored && !stored.includes('local meadow 9274'));
  await native.getByTestId('app-lock-passcode').fill('wrong passphrase');
  await native.getByTestId('app-lock-submit').click();
  await native.getByText('Passcode is incorrect.', { exact: true }).waitFor();
  await native.getByTestId('app-lock-passcode').fill('local meadow 9274');
  await native.getByTestId('app-lock-submit').click();
  await native.getByTestId('native-offline-home').waitFor();
  await native.getByRole('button', { name: 'Back to login', exact: true }).click();
  await native.getByRole('heading', { name: 'Welcome back' }).waitFor();
  await native.getByRole('button', { name: 'Use non-server mode', exact: true }).click();
  await native.getByTestId('native-offline-home').waitFor();
  assert.equal(accountRequests, 0);
  console.log('Non-server Music/Cinema, disabled account features and local passphrase checks passed');
  console.log('Login-first browser deep link and unconfigured native entry checks passed');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
