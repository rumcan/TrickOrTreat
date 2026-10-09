import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = []; page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  await page.getByRole('button', { name: /Preview expansion locally/ }).click();
  await page.getByRole('button', { name: /Play rescue campaign/ }).click();
  await page.getByRole('button', { name: /skip intro/ }).waitFor();
  await page.keyboard.press('Space');
  const result = await page.evaluate(async () => {
    const g = window.__tot.game; g.state = 'pause';
    const { Renderer } = await import('/src/game/render.ts');
    const { heroSheet } = await import('/src/game/art/characters.ts');
    const { weaponIcon } = await import('/src/game/art/fx.ts');
    const { makeWeapon, HERO_INFO, WEAPONS, COSTUMES } = await import('/src/game/data.ts');
    const { screenDirToWorld } = await import('/src/game/config.ts');
    const samples = [];
    const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 800;
    const renderer = new Renderer(canvas, 0), ctx = renderer.ctx;
    const draw = ctx.drawImage.bind(ctx);
    let expectedIcon, heldCalls = [], sheetImage;
    ctx.drawImage = (...args) => {
      if (args[0] === expectedIcon) heldCalls.push({ width: args[3], height: args[4], x: args[1], y: args[2], m: ctx.getTransform(), order: 'gun' });
      if (args[0] === sheetImage) heldCalls.push({ order: 'kid' });
      draw(...args);
    };
    ctx.fillStyle = '#253142'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    g.p.invuln = g.p.dashT = g.p.hurtT = g.p.recoil = 0;
    // All kid/costume/gun combinations retain the grip and dimensions at every aim angle.
    for (let kid = 0; kid < HERO_INFO.length; kid++) for (const costume of [null, ...COSTUMES.map(c => c.id)]) for (const weapon of WEAPONS) for (let direction = 0; direction < 8; direction++) {
      const angle = direction * Math.PI / 4;
      const aim = screenDirToWorld(Math.cos(angle), Math.sin(angle));
      g.p.aimX = aim.x; g.p.aimY = aim.y; g.p.back = Math.sin(angle) < -.01;
      g.p.flip = Math.cos(angle) < 0; g.p.moving = direction % 2 === 1; g.p.anim = direction;
      renderer.hero = heroSheet(kid, costume); sheetImage = renderer.hero.img;
      g.p.weapons[0] = makeWeapon(weapon.id, 0); g.p.cur = 0; expectedIcon = weaponIcon(weapon.id);
      heldCalls = []; ctx.setTransform(1, 0, 0, 1, 0, 0); renderer.drawPlayer(g, 100, 150);
      const gun = heldCalls.find(c => c.order === 'gun');
      if (!gun || gun.width !== 32 || gun.height !== 16 || gun.x !== -8 || gun.y !== -10) throw new Error('Incorrect held gun size/grip');
      if (Math.abs(gun.m.f - (128 + Math.sin(angle) * 2)) > .001) throw new Error('Gun grip left waist height');
      if (heldCalls.map(c => c.order).join(',') !== (g.p.back ? 'gun,kid' : 'kid,gun')) throw new Error('Weapon/body layer order incorrect');
      samples.push(1);
    }
    // Clear testing draws and make a native-art contact sheet for visual review.
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#253142'; ctx.fillRect(0, 0, 1000, 800);
    const previewGuns = ['pea', 'soaker', 'rocket', 'gloom'];
    for (let row = 0; row < 4; row++) for (let kid = 0; kid < 5; kid++) {
      const angle = [0, -Math.PI / 4, Math.PI, Math.PI / 2][row];
      const aim = screenDirToWorld(Math.cos(angle), Math.sin(angle));
      Object.assign(g.p, { aimX: aim.x, aimY: aim.y, back: Math.sin(angle) < -.01, flip: Math.cos(angle) < 0, moving: false, anim: 0 });
      renderer.hero = heroSheet(kid); g.p.weapons[0] = makeWeapon(previewGuns[row], 0);
      ctx.setTransform(2, 0, 0, 2, kid * 200, row * 200);
      renderer.drawPlayer(g, 50, 85);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#f2e6c9'; ctx.font = '14px sans-serif';
      ctx.fillText(`${HERO_INFO[kid].name} / ${previewGuns[row]}`, kid * 200 + 12, row * 200 + 22);
    }
    window.__weaponReview = canvas.toDataURL();
    // Check actual companion draw calls, including mirrored/back-facing kids.
    const live = window.__tot.renderer, liveCtx = live.ctx, original = liveCtx.drawImage.bind(liveCtx);
    let friendCalls = [];
    const friend = g.friends[0]; Object.assign(friend, { status: 'rescued', x: g.p.x + 1, y: g.p.y + 1, hp: 80 });
    g.activeFriend = friend.hero; g.state = 'play';
    const friendIcon = weaponIcon(friend.weapon.def.id);
    liveCtx.drawImage = (...args) => {
      if (args[0] === friendIcon && args.length === 5 && args[3] === 32 && args[4] === 16) friendCalls.push(args.slice(1));
      original(...args);
    };
    for (const back of [false, true]) for (const flip of [false, true]) {
      friend.back = back; friend.flip = flip; friendCalls = []; live.render(g, 0);
      if (!friendCalls.some(c => c[0] === -8 && c[1] === -32)) throw new Error('Companion gun is not at waist');
    }
    liveCtx.drawImage = original; g.state = 'pause';
    return { playerSamples: samples.length, companionSamples: 4 };
  });
  console.log(JSON.stringify(result));
  assert.equal(result.playerSamples, 5 * 11 * 13 * 8);
  await page.evaluate(() => {
    const review = document.createElement('img'); review.id = 'review';
    review.alt = 'All five kids with waist-height guns'; review.src = window.__weaponReview;
    review.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:800px;z-index:9999';
    document.body.append(review);
  });
  await page.locator('#review').screenshot({ path: 'art/world/checks/weapon-waist-review.png' });
  assert.deepEqual(errors, []);
  console.log('Waist-height guns passed for all kids, costumes, weapons, eight aim angles and companion facing directions.');
} finally { await browser.close(); }
