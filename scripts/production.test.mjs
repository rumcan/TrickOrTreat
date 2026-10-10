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
  assert.ok(await splash.evaluate(img => img.currentSrc.split('?')[0].endsWith('/images/splash.webp')));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(() => document.querySelector('[data-testid="splash-art"]').currentSrc.split('?')[0].endsWith('/images/splash_portrait.webp'));
  await splash.evaluate(async img => { await img.decode(); });
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const item of Object.values(manifest.overrides)) {
    const file = typeof item === 'string' ? item : item.file;
    assert.ok(loaded.has(`/assets/${file}`), `Production loader missed ${file}`);
  }
  assert.equal(await page.getByRole('button', { name: /Preview expansion locally/ }).count(), 0);
  assert.equal(await page.getByRole('button', { name: 'Collection', exact: true }).count(), 0, 'No art collection in production');
  assert.equal(await page.evaluate(() => typeof window.__tot), 'undefined');
  await page.getByRole('button', { name: 'Discover the full game' }).click();
  const showcase = page.getByRole('dialog', { name: 'HIDE & SHRIEK' });
  await showcase.waitFor();
  assert.equal(await showcase.getByRole('button', { name: /Purchase currently unavailable|Checking ownership/ }).isDisabled(), true);
  await showcase.getByRole('button', { name: 'Close full game showcase' }).click();
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.getByText('Ring doorbells', { exact: true }).waitFor();
  await page.keyboard.press('i');
  await page.getByRole('dialog', { name: 'Run inventory' }).waitFor();
  await page.screenshot({ path: 'art/world/checks/production-inventory.png' });
  assert.deepEqual(errors, []);
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const context = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const mobile = await context.newPage();
    const mobileErrors = []; mobile.on('pageerror', error => mobileErrors.push(error.message));
    await mobile.goto(process.env.TOT_PRODUCTION_URL || 'http://127.0.0.1:5174/');
    await mobile.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
    await mobile.getByRole('button', { name: 'Go trick-or-treating' }).tap();
    await mobile.getByTestId('touch-move').waitFor();
    assert.equal(await mobile.getByTestId('touch-aim').count(), 0, 'Movement is drag-anywhere; there is no aim stick');
    assert.equal(await mobile.evaluate(() => typeof window.__tot), 'undefined', 'Touch controls must not require development globals');
    await mobile.getByRole('button', { name: 'Map', exact: true }).tap();
    await mobile.getByRole('button', { name: 'Map', exact: true }).tap();
    await mobile.getByRole('button', { name: 'Your run build', exact: true }).tap();
    await mobile.getByRole('dialog', { name: 'Run inventory' }).waitFor();
    assert.equal(await mobile.getByTestId('touch-move').count(), 0);
    await mobile.getByRole('button', { name: 'Close inventory', exact: true }).tap();
    await mobile.getByTestId('touch-move').waitFor();
    await mobile.getByRole('button', { name: 'Pause', exact: true }).tap();
    await mobile.getByRole('button', { name: /Resume/i }).waitFor();
    assert.equal(await mobile.getByTestId('touch-move').count(), 0);
    await mobile.getByRole('button', { name: /Resume/i }).tap();
    await mobile.getByTestId('touch-move').waitFor();
    assert.deepEqual(mobileErrors, []);
    console.log(`Production ${viewport.width}x${viewport.height}: touch controls, map/build access and pause/resume work without development tools.`);
    await context.close();
  }
  console.log(`Production build: ${Object.keys(manifest.overrides).length} packed assets loaded; free gameplay and inventory work; developer preview absent; unpaid expansion remains locked.`);
} finally { await browser.close(); }
