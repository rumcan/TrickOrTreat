import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: /Preview expansion locally/ }).click();
  await page.getByRole('button', { name: /Play rescue campaign/ }).click();
  await page.waitForFunction(() => window.__tot?.game);
  await page.keyboard.press('Space');
  const result = await page.evaluate(async () => {
    const g = window.__tot.game;
    const { settings, saveSettings, loadSettings } = await import('/src/game/settings.ts');
    const { cellAt } = await import('/src/game/map.ts');
    const rounds = [];
    for (const type of ['hex', 'alpha', 'warden', 'king']) {
      g.time = g.nextBossAt; g.director(0.001);
      if (g.boss?.type !== type) throw new Error(`Wrong boss: ${g.boss?.type}, expected ${type}`);
      g.spawnEnemy('zombie', g.p.x + 2, g.p.y); g.ebullets.push({ x: g.p.x, y: g.p.y, dead: false });
      const kills = g.kills; g.killEnemy(g.boss);
      if (g.enemies.length || g.ebullets.length || g.bullets.length || g.state !== 'shop' || !g.bossBreak || g.kills !== kills + 1) throw new Error('Boss did not safely clear the encounter');
      const time = g.time; g.update(0.03); if (g.time !== time) throw new Error('Upgrade break must freeze the run');
      const level = g.p.weapons[0].level; g.shopUpgrade(0); if (g.p.weapons[0].level !== level + 1) throw new Error('Cannot upgrade after boss');
      rounds.push({ type, cleared: true, coins: g.p.coins }); g.closeShop();
    }
    if (!g.bossKilled || g.bossWins !== 4) throw new Error('Campaign finale not recorded');
    settings.gore = 'green';
    for (let n = 0; n < 150; n++) g.killEnemy(g.spawnEnemy('zombie', g.p.x + n % 3, g.p.y + n % 4));
    if (g.particles.length > 900 || g.decals.length > 160) throw new Error('Unbounded gore buffers');
    const counts = { particles: g.particles.length, decals: g.decals.length };
    settings.gore = 'red'; saveSettings(); if (loadSettings().gore !== 'red') throw new Error('Blood setting does not persist');
    settings.gore = 'off'; const before = g.decals.length;
    g.killEnemy(g.spawnEnemy('zombie', g.p.x, g.p.y)); if (g.decals.length !== before) throw new Error('Off setting still emits gore');
    settings.gore = 'green'; saveSettings();
    // Test swept movement against a solid district wall, including ghost phasing.
    const target = { x: 20, y: 30 }; g.moveCircle(target, 10, 0, .24, 2);
    if (target.x >= 22 || cellAt(g.map, target.x, target.y) !== 0) throw new Error('Dash/ghost crossed the west boundary');
    const renderer = window.__tot.renderer;
    const timings = [];
    for (const mode of ['off', 'green', 'off', 'green']) {
      settings.gore = mode;
      for (let n = 0; n < 10; n++) renderer.render(g, 1 / 60);
      settings.gore = mode; const start = performance.now();
      for (let n = 0; n < 30; n++) renderer.render(g, 1 / 60);
      timings.push({ mode, msPerFrame: (performance.now() - start) / 30 });
    }
    settings.gore = 'green'; g.state = 'play'; g.p.invuln = 999; renderer.render(g, 1 / 60);
    return { rounds, counts, timings };
  });
  console.log(JSON.stringify(result, null, 2));
  assert.equal(result.rounds.length, 4);
  await page.screenshot({ path: 'art/world/checks/green-gore-stress.png' });
  console.log('Four boss clears, safe upgrades, ghost/dash boundaries, gore settings and bounded effects passed.');
} finally { await browser.close(); }
