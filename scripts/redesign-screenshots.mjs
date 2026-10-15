import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

// Capture the real, interactive screens at the reference resolution. This uses
// the development-only game handle already used by the browser test suite.
// node scripts/redesign-screenshots.mjs [--baseline] [--quick] [--mobile]
const flags = new Set(process.argv.slice(2));
const stage = flags.has('--baseline') ? 'before' : 'after';
const out = path.resolve('art/redesign-checks', stage);
const baseURL = flags.has('--serve') ? 'http://127.0.0.1:5181/' : process.env.TOT_URL || 'http://127.0.0.1:5173/';
const viewport = flags.has('--mobile') ? { width: 390, height: 844 } : { width: 1672, height: 941 };
await fs.mkdir(out, { recursive: true });
const comparisons = [
  ['title', 'reference-title.png', '01-title.png'],
  ['pause', 'reference-pause.png', '09-pause.png'],
  ['settings', 'reference-settings.png', '02-settings.png'],
  ['level-up', 'reference-levelup.png', '13-level-up.png'],
  ['gameplay', 'reference-gameplay.png', '08-gameplay.png'],
];
async function compare() {
  const available = [];
  for (const [name, reference, actual] of comparisons) {
    const left = path.resolve('art/redesign', reference), right = path.join(out, actual);
    try { await Promise.all([fs.access(left), fs.access(right)]); } catch { continue; }
    const width = 1672, leftMeta = await sharp(left).metadata(), rightMeta = await sharp(right).metadata();
    const height = Math.max(Math.round(leftMeta.height * width / leftMeta.width), Math.round(rightMeta.height * width / rightMeta.width));
    const label = Buffer.from(`<svg width="${width * 2}" height="52"><rect width="100%" height="100%" fill="#101116"/><g font-family="Arial,sans-serif" font-size="24" font-weight="bold" fill="#ffb644"><text x="26" y="35">SUPPLIED DESIGN — ${name.toUpperCase()}</text><text x="${width + 26}" y="35">ACTUAL GAME — ${stage.toUpperCase()}</text></g></svg>`);
    await sharp({ create: { width: width * 2, height: height + 52, channels: 3, background: '#101116' } }).composite([
      { input: label, left: 0, top: 0 },
      { input: await sharp(left).resize(width, height, { fit: 'contain', background: '#101116' }).png().toBuffer(), left: 0, top: 52 },
      { input: await sharp(right).resize(width, height, { fit: 'contain', background: '#101116' }).png().toBuffer(), left: width, top: 52 },
    ]).png().toFile(path.join(out, `comparison-${name}.png`));
    available.push({ name, reference, actual });
  }
  const cards = available.map(({ name, reference, actual }) => `<section><h2>${name}</h2><div class="pair"><figure><figcaption>Supplied design</figcaption><img src="../../redesign/${reference}" alt="Supplied ${name} design"></figure><figure><figcaption>Actual game (${stage})</figcaption><img src="${actual}" alt="Actual ${name} screenshot"></figure></div><a href="comparison-${name}.png">Open full-resolution comparison</a></section>`).join('');
  const manifest = JSON.parse(await fs.readFile(path.join(out, 'manifest.json'), 'utf8'));
  const screenLinks = manifest.captures.map(c => `<li><a href="${c.file}">${c.name.replace(/^\d+-/, '').replaceAll('-', ' ')}</a></li>`).join('');
  await fs.writeFile(path.join(out, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Trick or Treat design comparisons</title><style>body{margin:30px;background:#101116;color:#f5ead5;font:16px system-ui}h1,h2{color:#ffad31}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0}figcaption{padding:12px 0}img{width:100%;display:block}a{display:inline-block;color:#ffb644;margin-top:12px}section{margin-bottom:50px}ul{columns:3}@media(max-width:700px){.pair{grid-template-columns:1fr}ul{columns:1}}</style><h1>Trick or Treat — design comparisons</h1><p>Supplied designs beside live browser screenshots at ${viewport.width} × ${viewport.height}. Game values vary with the run.</p>${cards}<section><h2>All captured screens</h2><ul>${screenLinks}</ul></section></html>`);
  console.log(`Created ${available.length} full-resolution comparison images and ${path.join(out, 'index.html')}`);
}
if (flags.has('--compare-only')) { await compare(); process.exit(0); }
const localServer = flags.has('--serve') ? await (await import('vite')).createServer({
  configFile:false,
  base:'./',
  plugins:[(await import('@vitejs/plugin-react')).default(),(await import('@tailwindcss/vite')).default()],
  optimizeDeps:{ entries:['index.html'] },
  server:{ host:'127.0.0.1',port:5181,strictPort:true,watch:null },
}) : null;
if (localServer) { await localServer.listen(); console.log(`Screenshot server ready: ${baseURL}`); }
const browser = await chromium.launch({ channel: 'msedge' });
const page = await browser.newPage({ viewport, deviceScaleFactor: 1, reducedMotion: 'reduce' });
const errors = [], captures = [], failures = [];
page.on('pageerror', error => errors.push(error.message));
page.on('pageerror', error => console.error(`Browser: ${error.message}`));

async function settled() {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].filter(img => img.offsetParent && img.currentSrc).map(img => img.decode().catch(() => {})));
  });
  await page.waitForTimeout(250);
}
async function capture(name, locator) {
  if (locator) await locator.waitFor({ state: 'visible', timeout: 15000 });
  await settled();
  const filename = `${name}${flags.has('--mobile') ? '-mobile' : ''}.png`;
  await page.screenshot({ path: path.join(out, filename), animations: 'disabled' });
  const measurement = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    brokenImages: [...document.images].filter(img => img.offsetParent && img.complete && img.currentSrc && !img.naturalWidth).map(img => img.currentSrc),
  }));
  assert.deepEqual(measurement.brokenImages, [], `${name}: visible art must load`);
  assert.ok(measurement.document.width <= measurement.viewport.width + 1, `${name}: no horizontal page overflow`);
  captures.push({ name, file: filename, ...measurement });
  console.log(`Captured ${filename}`);
}
async function attempt(name, task) {
  try { await task(); }
  catch (error) { failures.push({ name, error: String(error) }); console.error(`${name}: ${error.message}`); }
}
async function title() {
  await page.goto(baseURL, { waitUntil: 'domcontentloaded', timeout: 120000 });
  console.log('Page mounted; waiting for art loading.');
  await page.getByRole('button', { name: 'Go trick-or-treating', exact: true }).waitFor({ timeout: 120000 });
}
async function play() {
  await title();
  await page.getByRole('button', { name: 'Go trick-or-treating', exact: true }).click();
  await page.waitForFunction(() => !!window.__tot?.game, { timeout: 60000 });
  await page.evaluate(() => {
    const g = window.__tot.game;
    g.director = () => {}; g.enemies = []; g.tutorial = null;
    g.p.invuln = 99999; g.state = 'play'; g.time = 21;
    g.banner = null; g.toasts = []; g.bossIn = null;
  });
  await page.waitForFunction(() => window.__tot.game.state === 'play');
  await page.locator('.hm-topbar').waitFor();
}
async function setState(state) {
  await page.evaluate(state => { window.__tot.game.state = state; }, state);
  await page.waitForTimeout(160);
}

try {
  await title();
  const menuBounds = await page.locator('.title-nav button:visible').evaluateAll(elements => elements.map(e => { const r=e.getBoundingClientRect(); return { text:e.textContent,left:r.left,right:r.right,bottom:r.bottom,width:r.width }; }));
  for (const bounds of menuBounds) {
    assert.ok(bounds.left >= 0 && bounds.right <= viewport.width + 1 && bounds.bottom <= viewport.height + 1, `${bounds.text}: menu button stays within the screen`);
    assert.ok(bounds.width >= 75, `${bounds.text}: menu button has room for its label`);
  }
  await capture('01-title', page.locator('.title-wrap'));
  const cta = await page.locator('.title-play').boundingBox();
  assert.ok(cta.width <= 361 && cta.height <= 59, 'The main play button keeps its compact dimensions');
  for (const name of ['Talents', 'Character details', 'Settings', 'How to play']) {
    const button = page.getByRole('button', { name, exact:true });
    await button.hover();
    const state = await button.evaluate(element => {
      const text = element.querySelector('span');
      return { text:text?.textContent, opacity:text && getComputedStyle(text).opacity, family:getComputedStyle(element).fontFamily, background:getComputedStyle(element).backgroundImage, frame:getComputedStyle(element).borderImageRepeat };
    });
    assert.equal(state.text, name);
    assert.equal(state.opacity, '1', `${name}: text remains visible on hover`);
    assert.ok(!/nav-|button-go|button-dark/.test(state.background), `${name}: no stretched label image`);
    assert.equal(state.frame, 'round', `${name}: border edge tiles repeat`);
  }
  await capture('01-title-hover', page.locator('.title-wrap'));
  await attempt('settings', async () => {
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await capture('02-settings', page.getByRole('button', { name: 'Confirm', exact: true }));
    const graphics = page.getByRole('button', { name:'High graphics', exact:true });
    const oldGraphics = await graphics.getAttribute('aria-pressed');
    await graphics.click();
    assert.notEqual(await graphics.getAttribute('aria-pressed'), oldGraphics, 'Graphics switch updates immediately');
    assert.equal(await page.evaluate(async () => (await import('/src/game/settings.ts')).settings.highGraphics), oldGraphics !== 'true');
    await graphics.click();
    await page.getByRole('button', { name: 'Confirm', exact: true }).click();
  });
  if (!flags.has('--quick')) {
    await attempt('how-to-play', async () => {
      await title(); await page.getByRole('button', { name: 'How to play', exact: true }).click();
      await capture('03-how-to-play', page.getByRole('button', { name: 'Got it', exact: true }));
    });
    await attempt('character-details', async () => {
      await title(); await page.getByRole('button', { name: 'Character details', exact: true }).click();
      const back = page.getByRole('button', { name:'Back', exact:true });
      await back.hover();
      assert.equal(await back.evaluate(e => getComputedStyle(e).borderImageRepeat), 'round', 'Small Back buttons use fixed corners and repeatable edges');
      assert.equal(await back.locator('span').evaluate(e => getComputedStyle(e).opacity), '1', 'Back label stays visible on hover');
      await capture('04-character-details');
    });
    await attempt('talents', async () => {
      await title(); await page.getByRole('button', { name: /^Talents/ }).click();
      await capture('05-talents', page.locator('.talent-svg'));
    });
    await attempt('night-records', async () => {
      await title();
      // The panel is available to signed-in profiles. Supply deterministic local
      // SDK responses so this screenshot does not depend on a remote account.
      await page.evaluate(() => {
        const api = window.RundotGameAPI;
        if (!api) throw Error('Game SDK unavailable');
        api.isMock = () => false;
        api.getProfile = () => ({ id: 'design-check', username: 'Tommy', isAnonymous: false });
        api.leaderboard.getPagedScores = async () => ({ entries: [
          { profileId: 'maple-1', username: 'PumpkinRunner', score: 1786, rank: 1 },
          { profileId: 'design-check', username: 'Tommy', score: 1027, rank: 2 },
        ], nextCursor: null, totalEntries: 2 });
        api.leaderboard.getMyRank = async () => ({ rank: 2, score: 1027, totalPlayers: 2 });
        window.dispatchEvent(new Event('focus'));
      });
      await page.getByRole('button', { name: 'Open time leaderboard', exact: true }).click();
      await capture('06-night-records', page.locator('.records-drawer'));
    });
    await attempt('collection', async () => {
      await title(); const button = page.getByRole('button', { name: 'Collection', exact: true });
      if (await button.count()) { await button.click(); await capture('07-collection'); }
    });
  }
  await play();
  await capture('08-gameplay', page.locator('.hm-topbar'));
  await setState('pause');
  await capture('09-pause', page.locator('.hm-pause'));
  if (!flags.has('--quick')) {
    await attempt('friends', async () => {
      await page.getByRole('button', { name: /Friends & shared guns/ }).click();
      await capture('10-friends', page.getByRole('button', { name: 'Back', exact: true }));
      await page.getByRole('button', { name: 'Back', exact: true }).click();
    });
    await attempt('controls', async () => {
      await page.getByRole('button', { name: /Controls.*keys and mouse/i }).click();
      await capture('11-controls');
      await page.getByRole('button', { name: /Controls.*keys and mouse/i }).click();
    });
    await attempt('run-build', async () => {
      await page.locator('.hm-menu-row').filter({ hasText: 'Your run build' }).click();
      await capture('12-run-build', page.getByRole('dialog', { name: 'Run inventory' }));
      await page.getByRole('button', { name: 'Close inventory', exact: true }).click();
    });
  }
  await setState('play');
  await page.evaluate(async () => {
    const { SCROLL_BY_ID } = await import('/src/game/data.ts');
    const g = window.__tot.game;
    g.p.level = 2; g.openLevelUp('level');
    g.choices = ['bouncy', 'mixtape', 'sour'].map(id => SCROLL_BY_ID[id]).filter(Boolean);
    if (g.choices.length < 3) g.choices = ['bouncy', 'dmg', 'sour'].map(id => SCROLL_BY_ID[id]).filter(Boolean);
    if (g.choices.length < 3) { const all = Object.values(SCROLL_BY_ID); g.choices = [SCROLL_BY_ID.bouncy, all.find(s => s.desc === '+9% damage'), SCROLL_BY_ID.sour].filter(Boolean); }
    g.lockedChoice = null;
  });
  await capture('13-level-up', page.locator('.hm-level, .hm-modal').last());
  if (!flags.has('--quick')) {
    await attempt('doorstep', async () => {
      await setState('play');
      await page.evaluate(() => { const g = window.__tot.game; g.openLevelUp('house'); g.lockedChoice = null; });
      await capture('14-doorstep');
    });
    await attempt('weapon-inspect', async () => {
      await setState('play');
      await page.evaluate(async () => {
        const { makeWeapon } = await import('/src/game/data.ts'); const g = window.__tot.game;
        g.p.weapons[0] = makeWeapon('pea', 3, 1, true); g.p.weapons[1] = makeWeapon('nerf', 1, 2, true); g.p.cur = 0;
        g.dropWeapon(g.p.x, g.p.y, makeWeapon('stream', 2, 6, true));
        g.inspecting = g.pickups.at(-1); g.inspecting.z = 0; g.inspecting.vz = 0; g.state = 'inspect';
      });
      await capture('15-weapon-inspect', page.getByRole('dialog', { name: 'Inspect weapon' }));
    });
    await attempt('vending', async () => {
      await setState('play');
      await page.evaluate(() => { const g = window.__tot.game; const shop = g.map.shops.find(s => s.prop.kind === 'vending'); if (!shop) throw Error('No vending on map'); g.openVending(shop.prop); });
      await capture('16-vending', page.getByRole('dialog', { name: 'Midnight Candy Machine' }));
    });
    await attempt('shop', async () => {
      await setState('shop');
      await capture('17-shop', page.getByRole('button', { name: 'Leave', exact: true }));
    });
    await attempt('discard-treat', async () => {
      await setState('play');
      await page.evaluate(() => { const g = window.__tot.game; g.scrolls.bouncy = 1; g.scrollOrder.push('bouncy'); g.askDiscard('bouncy'); });
      await capture('18-discard-treat', page.getByRole('dialog', { name: /Discard Pinball Wizard/ }));
    });
    await attempt('map', async () => {
      await setState('play');
      await page.evaluate(() => { window.__tot.game.bigMap = true; });
      await capture('19-map');
      await page.evaluate(() => { window.__tot.game.bigMap = false; });
    });
    await attempt('arcade-recruit', async () => {
      await setState('play');
      await page.evaluate(async () => {
        const g = window.__tot.game;
        (await import('/src/game/expansion.ts')).expansion.preview();
        Object.assign(g.p, g.map.houses.find(h => h.prop.kind === 'arcade').door);
        g.travelArcade('arcade'); g.p.coins = 2500; g.hiringHero = 3; g.state = 'hire';
      });
      await capture('20-arcade-recruit', page.getByRole('dialog', { name: 'Recruit Maya' }));
    });
    await attempt('end-screen', async () => {
      await setState('play'); await page.evaluate(() => window.__tot.game.endRun(false));
      await capture('21-end-screen', page.getByRole('button', { name: 'Spend essence on talents', exact: true }));
    });
  }
  assert.deepEqual(errors, [], 'No browser runtime errors');
} catch (error) {
  console.error(error.message);
  console.error((await page.locator('body').innerText({ timeout: 3000 }).catch(() => '')).slice(0, 2500));
  await page.screenshot({ path: path.join(out, 'capture-error.png') }).catch(() => {});
  throw error;
} finally {
  await fs.writeFile(path.join(out, `manifest${flags.has('--mobile') ? '-mobile' : ''}.json`), JSON.stringify({ baseURL, stage, viewport, captures, failures, browserErrors: errors }, null, 2));
  await browser.close();
  await localServer?.close();
}
assert.deepEqual(failures, [], 'Every requested screen was captured');
console.log(`Verified ${captures.length} screens. Screenshots: ${out}`);
if (!flags.has('--mobile')) await compare();
