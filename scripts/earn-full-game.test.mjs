import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright-core';

// The full game can be earned: once a save has earned MORE than 15,000 Essence over all its runs (spent or not), the
// full game is unlocked on that save without buying it. Spending Essence on talents never takes it away.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const out = await page.evaluate(async () => {
    const d = await import('/src/game/data.ts');
    const { Game } = await import('/src/game/engine.ts');
    const { expansion, hasFullGame } = await import('/src/game/expansion.ts');
    const input = () => ({ keys: new Set(), pressed: new Set(), mouseActive: false, mdown: false, rpressed: false, wheel: 0, touchFiring: false, endFrame() { this.pressed.clear(); this.rpressed = false; this.wheel = 0; } });
    const res = { threshold: d.ESSENCE_UNLOCK, start: hasFullGame() };
    // what a save has earned: its own count, or for an older save what it holds plus what its talents cost
    res.oldSave = d.essenceEarned({ soul: 100, talents: { sharp: 5 }, best: 0, hero: 0 });
    res.counted = d.essenceEarned({ soul: 10, talents: {}, best: 0, hero: 0, earned: 9000 });
    // exactly 15,000 is not "more than"
    d.storeSave({ soul: 15000, talents: {}, best: 0, hero: 0, earned: 15000 });
    res.atThreshold = hasFullGame();
    // a run that takes the save over the line
    const save = { soul: 14990, talents: {}, best: 0, hero: 0, earned: 14990 };
    const g = new Game(0, save, input(), false, 1337);
    res.lockedKidBefore = new Game(3, save, input(), true, 1).hero === 0 && !new Game(3, save, input(), true, 1).campaign;
    g.xpCollected = 600; // 100 Essence, plus what the run pays for its wave
    g.bankRewards();
    res.gained = g.soulEarned;
    res.run = { earned: save.earned, soul: save.soul, unlocked: hasFullGame(), told: g.fullGameEarned, state: expansion.snapshot().earned, owned: expansion.snapshot().owned };
    // the full game is really open: the fourth kid and the rescue campaign
    const full = new Game(3, save, input(), true, 1);
    res.open = { hero: full.hero, campaign: full.campaign, talent: d.talentUnlocked(d.TALENT_BY_ID.heavy, { trigger: 1 }) };
    // spending it all on talents changes nothing, and neither does coming back another day
    save.soul = 0; d.storeSave(save);
    res.afterSpending = hasFullGame();
    expansion.revokeEarned();
    res.revoked = hasFullGame();
    const again = d.loadSave();
    res.nextDay = { unlocked: hasFullGame(), earned: again.earned };
    // leave a half-way save behind for the screens
    expansion.revokeEarned();
    d.storeSave({ soul: 200, talents: { sharp: 5 }, best: 0, hero: 0, earned: 5000 });
    return res;
  });
  assert.equal(out.threshold, 15000);
  assert.equal(out.start, false, 'A new player does not have the full game');
  assert.equal(out.oldSave, 100 + 15 + 30 + 45 + 60 + 75, 'An older save counts what it holds plus what its talents cost');
  assert.equal(out.counted, 9000, 'A save keeps its own count of Essence earned');
  assert.equal(out.atThreshold, false, 'Exactly 15,000 is not enough: it takes more than 15,000');
  assert.equal(out.lockedKidBefore, true, 'Before the unlock the full-game kid and the campaign are closed');
  assert.ok(out.gained >= 100, 'The run earned its Essence');
  assert.deepEqual(out.run, { earned: 14990 + out.gained, soul: 14990 + out.gained, unlocked: true, told: true, state: true, owned: false }, 'The run that passes 15,000 unlocks the full game and says so');
  assert.deepEqual(out.open, { hero: 3, campaign: true, talent: true }, 'The full game is really open: Maya, the rescue campaign, full-game talents');
  assert.equal(out.afterSpending, true, 'Spending the Essence on talents does not take the unlock away');
  assert.deepEqual([out.revoked, out.nextDay.unlocked, out.nextDay.earned], [false, true, 14990 + out.gained], 'The unlock comes back with the save on the next visit');

  // on screen: the showcase shows the other way in and how far along you are
  await page.reload();
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: 'Support the creator' }).click();
  const line = page.locator('.unlock-earn');
  await line.waitFor();
  assert.match(await line.innerText(), /more than 15,000 Essence\. So far: 5,000\./, 'The showcase shows the free way in and the progress');
  await fs.mkdir('art/world/checks', { recursive: true });
  await line.scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'art/world/checks/earn-full-game.png' });
  await page.evaluate(() => localStorage.clear());
  assert.deepEqual(errors, [], 'No page errors');
  console.log('earn the full game: unlocks above 15,000 Essence earned, survives spending and reloads, progress shown: ok');
} finally { await browser.close(); }
