import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  assert.equal(await page.getByRole('button', { name: 'Open time leaderboard' }).count(), 0, 'Offline guests must not see the leaderboard');
  await page.evaluate(async () => {
    const api = window.RundotGameAPI;
    window.__boardCheck = { profile: { id: 'player-1', username: 'MaplePhoenix', isAnonymous: false }, calls: [], fail: false };
    api.isMock = () => false;
    api.getProfile = () => { if (!window.__boardCheck.profile) throw new Error('Signed out'); return window.__boardCheck.profile; };
    api.leaderboard.getPagedScores = async ({ mode, cursor }) => {
      const state = window.__boardCheck; state.calls.push([mode, cursor]);
      if (state.fail) throw new Error('Connection unavailable. Please retry.');
      return { entries: cursor ? [{ profileId: 'player-3', username: 'LongNightKid', score: 620, rank: 3 }] : [
        { profileId: 'player-2', username: 'PumpkinRunner', score: mode === 'survival' ? 920 : 850, rank: 1 },
        { profileId: 'player-1', username: 'MaplePhoenix', score: 770, rank: 2 },
      ], nextCursor: cursor ? null : 'second-page', totalEntries: 3 };
    };
    api.leaderboard.getMyRank = async () => ({ rank: 2, score: 770, totalPlayers: 3 });
    window.dispatchEvent(new Event('focus'));
  });
  await page.getByRole('button', { name: 'Open time leaderboard' }).click();
  const drawer = page.getByRole('dialog', { name: 'Time leaderboard' });
  await drawer.getByText('PumpkinRunner', { exact: true }).waitFor();
  await page.waitForFunction(() => Math.abs(document.querySelector('.records-drawer').getBoundingClientRect().x) < .01);
  assert.equal(await drawer.locator('.records-row').count(), 2);
  const bounds = await drawer.boundingBox(); assert.equal(bounds.x, 0); assert.ok(bounds.width <= 420);
  assert.ok(await drawer.getByText('15:20', { exact: true }).isVisible());
  assert.ok(await drawer.locator('.is-you').getByText('MaplePhoenix').isVisible());
  await drawer.getByRole('button', { name: 'More records' }).click();
  await drawer.getByText('LongNightKid', { exact: true }).waitFor();
  assert.equal(await drawer.locator('.records-row').count(), 3);
  await drawer.getByRole('button', { name: 'Rescue campaign', exact: true }).click();
  await drawer.getByText('14:10', { exact: true }).waitFor();
  assert.equal(await drawer.locator('.records-row').count(), 2, 'Mode switch replaces the page, not mixing records');
  await page.screenshot({ path: 'art/world/checks/leaderboard-desktop.png' });
  await page.keyboard.press('Escape');
  assert.equal(await drawer.count(), 0);
  assert.ok(await page.getByRole('button', { name: 'Open time leaderboard' }).evaluate(button => button === document.activeElement), 'Return focus after closing');
  await page.setViewportSize({ width: 320, height: 568 });
  await page.getByRole('button', { name: 'Open time leaderboard' }).click();
  await drawer.getByText('PumpkinRunner', { exact: true }).waitFor();
  await page.waitForFunction(() => Math.abs(document.querySelector('.records-drawer').getBoundingClientRect().x) < .01);
  const phone = await drawer.boundingBox(); assert.equal(phone.x, 0); assert.ok(phone.width <= 320 && phone.height <= 568);
  await page.screenshot({ path: 'art/world/checks/leaderboard-phone.png' });
  await page.evaluate(() => { window.__boardCheck.fail = true; });
  await drawer.getByRole('button', { name: 'Refresh', exact: true }).click();
  await drawer.getByRole('alert').waitFor();
  await page.evaluate(() => { window.__boardCheck.fail = false; });
  await drawer.getByRole('button', { name: 'Refresh', exact: true }).click();
  await drawer.getByText('PumpkinRunner', { exact: true }).waitFor();
  await page.evaluate(() => { window.__boardCheck.profile = null; window.dispatchEvent(new Event('focus')); });
  await drawer.waitFor({ state: 'detached' });
  assert.equal(await page.getByRole('button', { name: 'Open time leaderboard' }).count(), 0, 'Logout removes both drawer and trigger');
  assert.deepEqual(errors, []);
  console.log('Signed-in names/times, left drawer, rank, pagination, mode switch, retry, guest/logout gates, keyboard focus and phone layout passed with mocked RUN data; no real leaderboard writes.');
} finally { await browser.close(); }
