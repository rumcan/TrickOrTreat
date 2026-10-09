import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';
const manifest = JSON.parse(await fs.readFile('dist/assets/manifest.json', 'utf8'));
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  const loaded = new Set();
  page.on('response', response => { if (response.ok()) loaded.add(new URL(response.url()).pathname); });
  page.on('console', message => { if (message.text().includes('[assets] override failed')) errors.push(message.text()); });
  await page.goto(process.env.TOT_PRODUCTION_URL || 'http://127.0.0.1:5174/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const splash = page.getByTestId('splash-art');
  await splash.evaluate(async img => { await img.decode(); });
  assert.ok(await splash.evaluate(img => img.currentSrc.endsWith('/images/splash.webp')));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('[data-testid="splash-art"]').currentSrc.endsWith('/images/splash_portrait.webp'));
  await splash.evaluate(async img => { await img.decode(); });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const item of Object.values(manifest.overrides)) {
    const file = typeof item === 'string' ? item : item.file;
    assert.ok(loaded.has(`/assets/${file}`), `Production loader missed ${file}`);
  }
  assert.equal(await page.getByRole('button', { name: /Preview expansion locally/ }).count(), 0);
  assert.equal(await page.evaluate(() => typeof window.__tot), 'undefined');
  assert.equal(await page.getByRole('button', { name: /Unlock not available yet|Checking ownership/ }).isDisabled(), true);
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.getByText('Ring doorbells', { exact: true }).waitFor();
  await page.keyboard.press('i');
  await page.getByRole('dialog', { name: 'Run inventory' }).waitFor();
  await page.screenshot({ path: 'art/world/checks/production-inventory.png' });
  assert.deepEqual(errors, []);
  console.log(`Production build: ${Object.keys(manifest.overrides).length} packed assets loaded; free gameplay and inventory work; developer preview absent; unpaid expansion remains locked.`);
} finally { await browser.close(); }
