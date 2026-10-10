import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.TOT_PRODUCTION_URL || 'http://127.0.0.1:5175/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  assert.equal(await page.evaluate(() => typeof window.__tot), 'undefined');
  assert.equal(await page.getByRole('button', { name: 'Open time leaderboard' }).count(), 0);
  await page.evaluate(() => {
    const api = window.RundotGameAPI;
    window.__rankedRunCheck = { submitted: [] };
    api.isMock = () => false;
    api.getProfile = () => ({ id: 'test-player', username: 'NightRunner', isAnonymous: false });
    // Replace the write surface before gameplay. No real score or account mutation is possible.
    api.leaderboard.submitScore = async data => { window.__rankedRunCheck.submitted.push(data); return { accepted: true, rank: 4 }; };
    api.leaderboard.getPagedScores = async () => ({ entries: [{ profileId: 'test-player', username: 'NightRunner', score: window.__rankedRunCheck.submitted[0]?.score || 10, rank: 4 }], totalEntries: 1, nextCursor: null });
    api.leaderboard.getMyRank = async () => ({ rank: 4, score: window.__rankedRunCheck.submitted[0]?.score || 10, totalPlayers: 1 });
    window.dispatchEvent(new Event('focus'));
  });
  await page.getByRole('button', { name: 'Open time leaderboard' }).waitFor();
  await page.getByRole('button', { name: 'Go trick-or-treating' }).click();
  await page.waitForFunction(() => {
    const timer = document.querySelector('.hm-clock')?.textContent?.match(/(\d+):(\d+)/);
    return timer && Number(timer[1]) * 60 + Number(timer[2]) >= 12;
  }, { timeout: 45000 });
  await page.keyboard.press('p');
  await page.getByRole('button', { name: /Quit run/ }).click();
  await page.getByText('Time recorded on RUN · rank #4', { exact: true }).waitFor();
  const submitted = await page.evaluate(() => window.__rankedRunCheck.submitted);
  assert.equal(submitted.length, 1); assert.ok(submitted[0].score >= 12);
  assert.equal(submitted[0].score, submitted[0].duration);
  assert.equal(submitted[0].period, 'alltime'); assert.equal(submitted[0].mode, 'survival');
  assert.equal(submitted[0].metadata.hero, 'Tommy');
  await page.getByRole('button', { name: 'Quit to menu' }).click();
  await page.getByRole('button', { name: 'Open time leaderboard' }).click();
  await page.getByRole('dialog', { name: 'Time leaderboard' }).getByText('NightRunner', { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log('Production authenticated run uploads seconds/mode once, displays accepted rank and returns to named leaderboard, without DEV globals. SDK write is simulated; no real score submitted.');
} finally { await browser.close(); }
