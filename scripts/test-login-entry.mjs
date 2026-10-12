import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
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
  console.log('Login-first browser deep link and unconfigured native entry checks passed');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
