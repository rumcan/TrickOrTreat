import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import sharp from 'sharp';
import { chromium } from 'playwright-core';

const poster = 'art/new/thumb_posterpng.png';
assert.deepEqual(await fs.readFile('public/images/newlogo.png'), await fs.readFile('art/new/newlogo.png'));
const logoMetadata = await sharp('public/images/newlogo.png').metadata();
const logoStats = await sharp('public/images/newlogo.png').stats();
assert.equal(logoMetadata.hasAlpha, true);
assert.equal(logoStats.channels.at(-1).min, 0, 'The replacement logo must preserve transparent pixels');
const expectedThumb = await sharp(poster).resize(512, 512).jpeg({ quality: 92 }).toBuffer();
assert.deepEqual(await fs.readFile('public/thumbnail.jpg'), expectedThumb);
const thumb = await sharp('public/thumbnail.jpg').metadata();
assert.equal(thumb.width, 512); assert.equal(thumb.height, 512); assert.equal(thumb.format, 'jpeg');
for (const name of ['splash', 'splash_portrait']) {
  const source = await sharp(`art/new/${name}.png`).metadata(), output = await sharp(`public/images/${name}.webp`).metadata();
  assert.equal(output.width, source.width); assert.equal(output.height, source.height);
}
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const [width, height, file] of [[1440, 900, 'splash.webp'], [390, 844, 'splash_portrait.webp'], [844, 390, 'splash.webp']]) {
    await page.setViewportSize({ width, height });
    await page.goto('http://127.0.0.1:5173/');
    await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
    const logo = page.getByRole('img', { name: 'Trick or Treat — Maple Falls' });
    await logo.evaluate(img => img.decode());
    assert.ok(await logo.evaluate(img => img.naturalWidth > 0 && new URL(img.src).pathname.endsWith('/images/newlogo.png')));
    const splash = page.getByTestId('splash-art');
    await splash.evaluate(async img => { await img.decode(); });
    assert.equal(await splash.evaluate(img => new URL(img.currentSrc).pathname.split('/').at(-1)), file);
    // currentSrc includes the picture's selected source, not just img.src.
    await page.screenshot({ path: `art/world/checks/splash-${width}x${height}.png` });
    console.log(`${width}x${height}: ${file} selected and decoded.`);
  }
  const layers = await page.evaluate(async () => {
    const { gameAudio } = await import('/src/game/audio.ts');
    const { settings } = await import('/src/game/settings.ts'); settings.muted = false;
    gameAudio.unlock(); gameAudio.last.clear();
    const calls = [], original = gameAudio.bank.play;
    gameAudio.bank.play = (dir, id, opts) => { calls.push({ id, ...opts }); return true; };
    for (const event of ['dash', 'reload', 'pickup']) gameAudio.play(event, .5);
    gameAudio.bank.play = original;
    return calls;
  });
  assert.deepEqual(layers.map(call => call.id), ['swoosh', 'reload', 'click', 'pickup', 'tick']);
  assert.equal(layers[0].vol, .2, 'Dash must be a quiet whoosh, without the bang');
  assert.ok(layers.every(call => call.rate === (['swoosh', 'click', 'tick'].includes(call.id) ? 1.04 : 1) && call.vol > 0 && call.vol <= .5));
  assert.deepEqual(errors, []);
  console.log('Exact poster-derived thumbnail, responsive splash art and subtle swoosh/click/tick layers passed.');
} finally { await browser.close(); }
