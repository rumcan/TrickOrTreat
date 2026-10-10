import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

const url = process.env.TOT_PUBLIC_URL || 'https://run.world/catalog/game/AFjPSjQH9kbcCl57sgO3';
const [expected] = JSON.parse(await fs.readFile('rundot/shop.config.json', 'utf8')).items;
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // A verification run must never debit a wallet or create an actual order.
  const orderAttempts = [];
  await page.route(/\/v1\/shop\/.*(?:purchase|orders)/, async route => {
    if (route.request().method() !== 'GET') {
      orderAttempts.push(new URL(route.request().url()).pathname);
      await route.abort();
    } else await route.continue();
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  let game;
  for (let i = 0; i < 120 && !game; i++) {
    for (const frame of page.frames()) {
      if (await frame.getByRole('button', { name: 'Go trick-or-treating' }).count()) { game = frame; break; }
    }
    if (!game) await page.waitForTimeout(2000);
  }
  assert.ok(game, 'Hosted game loads');
  const storefront = await game.evaluate(async itemId => {
    const api = window.RundotGameAPI;
    const catalog = await api.shop.getCatalog();
    const item = await api.shop.getItemDetail(itemId);
    const quantity = await api.entitlements.getQuantity(itemId);
    return { configId: catalog.configId, item, quantity, listed: catalog.items.some(item => item.itemId === itemId) };
  }, expected.itemId);
  assert.equal(storefront.listed, true, 'Item is listed in the active storefront');
  assert.equal(storefront.item.active, true);
  assert.equal(storefront.item.unique, true);
  assert.equal(storefront.item.category, 'non_consumable');
  assert.deepEqual(storefront.item.entitlements, expected.entitlements);
  assert.deepEqual(storefront.item.resolvedPrice.finalPrice, expected.price);
  assert.equal(storefront.quantity, 0, 'Unpaid fresh session stays locked');
  await game.getByRole('button', { name: 'Restore purchase / retry' }).click();
  await game.getByRole('button', { name: 'Discover the full game' }).click();
  const dialog = game.getByRole('dialog', { name: 'HIDE & SHRIEK' });
  const buy = dialog.getByRole('button', { name: `Unlock forever - ${expected.price.value} RUN Bits`, exact: true });
  await buy.waitFor({ timeout: 30000 });
  assert.equal(await buy.isDisabled(), false, 'Live purchase CTA is available');
  assert.equal(await dialog.getByText('Purchase currently unavailable', { exact: true }).count(), 0);
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const layout = await dialog.evaluate(dialog => {
      const bounds = dialog.getBoundingClientRect();
      return { inside: bounds.left >= 0 && bounds.right <= innerWidth + 1 && bounds.bottom <= innerHeight + 1, overflow: dialog.scrollWidth > dialog.clientWidth + 1 };
    });
    assert.ok(layout.inside && !layout.overflow, 'Purchase page fits desktop and phone screens');
  }
  // Exercise the real CTA through a client-only cancellation stub, never an order.
  await game.evaluate(() => {
    const api = window.RundotGameAPI;
    window.__purchaseCheckOriginal = api.shop.purchase;
    window.__purchaseCheckCalls = 0;
    api.shop.purchase = async () => { window.__purchaseCheckCalls++; return { success: false, cancelled: true, order: null }; };
  });
  try {
    await buy.click();
    await game.waitForFunction(label => window.__purchaseCheckCalls === 1 && Array.from(document.querySelectorAll('button')).some(button => button.textContent === label && !button.disabled), `Unlock forever - ${expected.price.value} RUN Bits`, { timeout: 15000 });
    assert.equal(await game.evaluate(() => window.__purchaseCheckCalls), 1, 'CTA invokes the SDK purchase boundary once');
    assert.equal(await dialog.getByRole('button', { name: 'Play rescue campaign', exact: true }).count(), 0, 'Cancellation never unlocks premium');
    assert.equal(await buy.isDisabled(), false, 'Player can retry after cancellation');
  } finally {
    await game.evaluate(() => {
      window.RundotGameAPI.shop.purchase = window.__purchaseCheckOriginal;
      delete window.__purchaseCheckOriginal; delete window.__purchaseCheckCalls;
    });
  }
  assert.deepEqual(orderAttempts, [], 'Verification made no real purchase/order requests');
  await page.screenshot({ path: 'art/world/checks/run-purchase.png' });
  console.log(`RUN storefront verified: active permanent ${expected.price.value} Bits unlock, config ${storefront.configId}, enabled responsive CTA, restore and cancellation; no wallet debit or actual order.`);
} finally { await browser.close(); }
