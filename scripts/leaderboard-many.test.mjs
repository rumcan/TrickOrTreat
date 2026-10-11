import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

// A leaderboard with many players: the records scroll inside their own box, and the Refresh button and the note
// under them are never drawn over a record. (With 13 records the list used to spill out and run under them.)
const browser = await chromium.launch({ channel: 'msedge' });
try {
  for (const viewport of [{ width: 406, height: 756 }, { width: 1440, height: 900 }, { width: 844, height: 390 }]) {
    const page = await browser.newPage({ viewport });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
    await page.evaluate(() => {
      const api = window.RundotGameAPI, me = { id: 'player-1', username: 'MaplePhoenix', isAnonymous: false };
      api.isMock = () => false;
      api.getProfile = () => me;
      api.leaderboard.getPagedScores = async ({ cursor }) => ({
        entries: Array.from({ length: 20 }, (_, i) => { const rank = (cursor ? 20 : 0) + i + 1; return { profileId: rank === 1 ? 'player-1' : `p-${rank}`, username: rank === 1 ? 'MaplePhoenix' : `Guest_${String(rank).padStart(3, '0')}`, score: 1000 - rank * 20, rank }; }),
        nextCursor: cursor ? null : 'second-page', totalEntries: 40,
      });
      api.leaderboard.getMyRank = async () => ({ rank: 1, score: 983, totalPlayers: 40 });
      window.dispatchEvent(new Event('focus'));
    });
    await page.getByRole('button', { name: 'Open time leaderboard' }).click();
    const drawer = page.getByRole('dialog', { name: 'Time leaderboard' });
    await drawer.getByText('Guest_020', { exact: true }).waitFor({ state: 'attached' });
    await page.waitForFunction(() => Math.abs(document.querySelector('.records-drawer').getBoundingClientRect().x) < .01);
    const tag = `${viewport.width}x${viewport.height}`;
    const measure = () => page.evaluate(() => {
      const box = el => { const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; };
      const list = document.querySelector('.records-list'), footer = document.querySelector('.records-drawer footer');
      const L = box(list), F = box(footer);
      const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
      // what is really painted of each row: its box clipped to the list's own box
      const painted = [...list.querySelectorAll('.records-row')].map(row => { const r = box(row); return { ...r, top: Math.max(r.top, L.top), bottom: Math.min(r.bottom, L.bottom) }; }).filter(r => r.bottom > r.top);
      const under = [...footer.children].map(box);
      return { rows: list.querySelectorAll('.records-row').length, scrolls: list.scrollHeight > list.clientHeight + 2, listAboveFooter: L.bottom <= F.top + 0.5,
        covered: painted.filter(r => under.some(u => overlap(r, u))).length, listHeight: Math.round(L.bottom - L.top) };
    });
    const first = await measure();
    assert.deepEqual({ rows: first.rows, scrolls: first.scrolls, listAboveFooter: first.listAboveFooter, covered: first.covered }, { rows: 20, scrolls: true, listAboveFooter: true, covered: 0 }, `${tag}: twenty records scroll in their own box and none is under the buttons (${JSON.stringify(first)})`);
    assert.ok(first.listHeight >= 160, `${tag}: the list keeps a usable height (${first.listHeight})`);
    // the last record can be reached, and more can be fetched
    await drawer.locator('.records-row').last().scrollIntoViewIfNeeded();
    assert.ok(await drawer.getByText('Guest_020', { exact: true }).isVisible(), `${tag}: the last record can be scrolled to`);
    await fs.mkdir('art/world/checks', { recursive: true });
    await page.screenshot({ path: `art/world/checks/leaderboard-many-${tag}.png` });
    await drawer.getByRole('button', { name: 'More records' }).scrollIntoViewIfNeeded();
    await drawer.getByRole('button', { name: 'More records' }).click();
    await drawer.getByText('Guest_040', { exact: true }).waitFor({ state: 'attached' });
    const second = await measure();
    assert.deepEqual([second.rows, second.listAboveFooter, second.covered], [40, true, 0], `${tag}: forty records still stay in their box`);
    assert.deepEqual(errors, [], `${tag}: no page errors`);
    await page.close();
  }
  console.log('leaderboard with many players: records scroll in their own box at phone, desktop and landscape sizes; nothing is drawn over them: ok');
} finally { await browser.close(); }
