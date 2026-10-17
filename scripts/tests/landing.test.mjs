import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

for (const [file, hero] of [['portrait_red_boy.png', 'tommy'], ['portrait_orange_boy.png', 'sam'], ['portrait_purple_girl.png', 'jess'], ['portrait_yellow_girl.png', 'maya'], ['portrait_blue_boy.png', 'leo']]) {
  const expected = await sharp(`art/new/${file}`).resize({ width: 768, withoutEnlargement: true }).webp({ quality: 90 }).toBuffer();
  assert.ok((await fs.readFile(`public/images/ui/portrait_${hero}.webp`)).equals(expected), `${hero} uses the latest supplied portrait`);
  const face = await sharp(`art/new/${file}`).resize(256, 256, { fit: 'cover', position: 'north' }).webp({ quality: 90 }).toBuffer();
  assert.ok((await fs.readFile(`public/images/ui/face_${hero}.webp`)).equals(face), `${hero} HUD face comes from their new portrait`);
}
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  const go = page.getByRole('button', { name: 'Go trick-or-treating' });
  await go.waitFor({ timeout: 120000 });
  for (const [width, height] of [[1440, 900], [390, 844], [844, 390]]) {
    await page.setViewportSize({ width, height });
    const header = page.getByRole('banner', { name: 'Game header' });
    assert.equal(await header.getByRole('region', { name: 'Full game unlock' }).count(), 1);
    const picker = page.getByRole('region', { name: 'Character selection' });
    assert.equal(await picker.getByRole('button', { name: /^Select / }).count(), 5);
    for (const name of ['Tommy', 'Sam', 'Jess', 'Maya', 'Leo']) {
      const portrait = picker.getByRole('img', { name: `${name} portrait` });
      await portrait.evaluate(img => img.decode());
      assert.ok(await portrait.evaluate(img => img.naturalWidth > 0 && new URL(img.src).pathname.endsWith('.webp')));
    }
    await go.scrollIntoViewIfNeeded();
    const bounds = await picker.boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width, 'Character picker must fit the viewport');
    await page.screenshot({ path: `art/world/checks/landing-${width}x${height}.png` });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const [hero, name] of ['Tommy', 'Sam', 'Jess', 'Maya', 'Leo'].entries()) {
    await page.getByRole('button', { name: new RegExp(`^Select ${name}`) }).click();
    assert.equal(await page.getByRole('button', { name: new RegExp(`^Select ${name}`) }).getAttribute('aria-pressed'), 'true');
    if (hero === 3) {
      assert.equal(await go.isDisabled(), true, 'Locked kids cannot start a run');
      await page.getByRole('button', { name: /Preview expansion locally/ }).click();
      assert.equal(await go.isEnabled(), true, 'Verified access unlocks the selected kid without another selection screen');
    }
    await go.click();
    await page.waitForFunction(() => !!window.__tot?.game);
    assert.equal(await page.evaluate(() => window.__tot.game.hero), hero, 'Go must start the selected kid');
    // hide and seek is shelved: whichever kid starts, it is the same night with no intro scene
    assert.equal(await page.evaluate(() => window.__tot.game.campaign), false);
    await page.waitForFunction(() => window.__tot.game.state === 'play');
    await page.evaluate(() => window.__tot.game.endRun(false));
    // the night ends at the talent constellations; the way back to the title is there
    await page.getByRole('button', { name: 'Spend talent points' }).click();
    await page.getByRole('button', { name: 'Main menu' }).click();
    await go.waitFor();
    assert.equal(await page.getByRole('button', { name: new RegExp(`^Select ${name}`) }).getAttribute('aria-pressed'), 'true');
  }
  const routing = await page.evaluate(async () => {
    const { gameAudio, SFX_LOW_PASS_HZ, SFX_PLAYBACK_RATE, DETAIL_LOW_PASS_HZ, DETAIL_PLAYBACK_RATE, TOP_HIGH_PASS_HZ } = await import('/src/game/audio.ts');
    gameAudio.unlock();
    return {
      baseHz: SFX_LOW_PASS_HZ, baseRate: SFX_PLAYBACK_RATE,
      detailHz: DETAIL_LOW_PASS_HZ, detailRate: DETAIL_PLAYBACK_RATE,
      baseBus: gameAudio.bank.dest('reload') === gameAudio.master,
      detailBus: gameAudio.bank.dest('swoosh') === gameAudio.detailMaster,
      separateBuses: gameAudio.master !== gameAudio.detailMaster,
      // the bright layer of an effect has a bus of its own, and playing an effect starts both recordings
      topHz: TOP_HIGH_PASS_HZ, topBus: gameAudio.bank.dest('top-shot') === gameAudio.topMaster && gameAudio.topMaster !== gameAudio.master,
      layered: (() => { const asked = [], play = gameAudio.bank.play.bind(gameAudio.bank); gameAudio.bank.play = (dir, id, opts) => { asked.push(id); return play(dir, id, opts); }; const hidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden'); Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); try { gameAudio.setMuted(false); gameAudio.play('reload'); } finally { delete document.hidden; gameAudio.bank.play = play; } return asked.slice(0, 2).join(); })(), // (its small click detail follows unless a click has just played)
    };
  });
  assert.deepEqual(routing, { baseHz: 700, baseRate: 1, detailHz: 1000, detailRate: 1.04, baseBus: true, detailBus: true, separateBuses: true, topHz: 180, topBus: true, layered: 'reload,top-reload' });
  assert.deepEqual(errors, []);
  console.log('Supplied portraits, responsive header/character selection, premium gating, direct starts for all five kids, saved selection and separate deep/detail sound buses passed.');
} finally { await browser.close(); }
