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
  const allowIncomplete = process.env.TOT_ALLOW_INCOMPLETE_HERO3D === '1';
  const result = await page.evaluate(async (allowIncomplete) => {
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
      if (args[0] === sheetImage || (args[0] instanceof HTMLImageElement && sheetImage instanceof HTMLImageElement && args[0].src === sheetImage.src)) heldCalls.push({ order: 'kid' });
      draw(...args);
    };
    ctx.fillStyle = '#253142'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    g.p.invuln = g.p.dashT = g.p.hurtT = g.p.recoil = 0;
    // Painted sprites (any look without a rendered aiming sheet): the gun keeps its waist-height grip and size at every
    // aim angle. A costume that is nobody's own forces that path.
    g.p.costume = 'ghost';
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
      if (Math.abs(gun.m.f - (120 + Math.sin(angle) * 2)) > .001) throw new Error('Gun grip left raised hand height');
      if (heldCalls.map(c => c.order).join(',') !== (g.p.back ? 'gun,kid' : 'kid,gun')) throw new Error('Weapon/body layer order incorrect');
      samples.push(1);
    }
    // Aiming sheets (each kid, plain and in their own costume): arms out in 8 directions, the gun gripped exactly where
    // the hands meet and layered kid -> gun -> hands, or behind the whole kid when aimed away from the camera.
    const { heroAim, AIM } = await import('/src/game/art/hero-aim.ts');
    const { HEROES } = await import('/src/game/art/characters.ts');
    const { HERO_COSTUME } = await import('/src/game/data.ts');
    const available = await import('/src/game/art/hero3d.json');
    const missing = [];
    let aimed = 0;
    for (let kid = 0; kid < HERO_INFO.length; kid++) for (const costume of [null, HERO_COSTUME[kid]]) {
      const key = costume ? `${HEROES[kid].id}_${costume}` : HEROES[kid].id;
      if (!available.default[key]) {
        if (!allowIncomplete) throw new Error(`No aiming sheet for ${key}`);
        missing.push(key);
        continue;
      }
      let sheet = null;
      for (let i = 0; i < 300 && !(sheet = heroAim(key)); i++) await new Promise(resolve => setTimeout(resolve, 50));
      if (!sheet) throw new Error(`No aiming sheet for ${key}`);
      if (sheet.img.naturalWidth !== AIM.cols * 2 * AIM.frame * AIM.scale || sheet.img.naturalHeight !== AIM.dirs * AIM.frame * AIM.scale) throw new Error(`Wrong aiming sheet layout for ${key}`);
      renderer.heroIdx = kid; g.p.costume = costume; sheetImage = sheet.img;
      // Vite hot reload can create a second module instance. Warm the renderer's
      // own lazy sheet loader, not just the test's direct import.
      for (let i = 0; i < 300; i++) {
        heldCalls = []; renderer.drawPlayer(g, 100, 150);
        if (heldCalls.some(c => c.order === 'kid')) break;
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      for (let direction = 0; direction < 8; direction++) {
        const angle = direction * Math.PI / 4, aim = screenDirToWorld(Math.cos(angle), Math.sin(angle));
        Object.assign(g.p, { aimX: aim.x, aimY: aim.y, aiming: true, moving: direction % 2 === 1, anim: direction });
        renderer.aimDir = direction;
        g.p.weapons[0] = makeWeapon('pea', 0); g.p.cur = 0; expectedIcon = weaponIcon('pea');
        heldCalls = []; ctx.setTransform(1, 0, 0, 1, 0, 0); renderer.drawPlayer(g, 100, 150);
        const hand = sheet.hands[direction][g.p.moving ? 1 + direction % AIM.walk : 0], gun = heldCalls.find(c => c.order === 'gun');
        if (!gun || Math.abs(gun.m.e - (100 + hand[0])) > .001 || Math.abs(gun.m.f - (150 + hand[1])) > .001) throw new Error(`${key}: gun is not gripped at the hands`);
        if (heldCalls.map(c => c.order).join(',') !== (direction >= 5 ? 'gun,kid' : 'kid,gun,kid')) throw new Error(`${key} dir ${direction}: unexpected layers ${heldCalls.map(c => c.order).join(',')}`);
        aimed++;
      }
    }
    renderer.heroIdx = 0; g.p.costume = null; g.p.aiming = false;
    // Clear testing draws and make a native-art contact sheet for visual review.
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#253142'; ctx.fillRect(0, 0, 1000, 800);
    const previewGuns = ['pea', 'soaker', 'rocket', 'gloom'];
    for (let row = 0; row < 4; row++) for (let kid = 0; kid < 5; kid++) {
      const angle = [0, -Math.PI / 4, Math.PI, Math.PI / 2][row];
      const aim = screenDirToWorld(Math.cos(angle), Math.sin(angle));
      Object.assign(g.p, { aimX: aim.x, aimY: aim.y, back: Math.sin(angle) < -.01, flip: Math.cos(angle) < 0, moving: false, anim: 0 });
      g.p.costume = row >= 2 ? HERO_COSTUME[kid] : null;
      renderer.heroIdx = kid; renderer.hero = heroSheet(kid, g.p.costume); g.p.weapons[0] = makeWeapon(previewGuns[row], 0);
      const look = g.p.costume ? `${HEROES[kid].id}_${g.p.costume}` : HEROES[kid].id;
      sheetImage = null;
      if (available.default[look]) {
        for (let i = 0; i < 300; i++) {
          const image = heroAim(look); if (image) { sheetImage = image.img; break; }
          await new Promise(resolve => setTimeout(resolve,50));
        }
        for (let i = 0; i < 300; i++) {
          heldCalls = []; renderer.drawPlayer(g,-10000,-10000);
          if (heldCalls.some(c => c.order === 'kid')) break;
          await new Promise(resolve => setTimeout(resolve,50));
        }
      }
      ctx.setTransform(2, 0, 0, 2, kid * 200, row * 200);
      renderer.drawPlayer(g, 50, 85);
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = '#f2e6c9'; ctx.font = '14px sans-serif';
      ctx.fillText(`${HERO_INFO[kid].name} / ${g.p.costume || previewGuns[row]}`, kid * 200 + 12, row * 200 + 22);
    }
    window.__weaponReview = canvas.toDataURL();
    // Check actual companion draw calls, including mirrored/back-facing kids.
    const live = window.__tot.renderer, liveCtx = live.ctx, original = liveCtx.drawImage.bind(liveCtx);
    let friendCalls = [];
    const friend = g.friends[0]; Object.assign(friend, { status: 'rescued', x: g.p.x + 1, y: g.p.y + 1, hp: 80 });
    g.activeFriend = friend.hero; g.state = 'play';
    const friendIcon = weaponIcon(friend.weapon.def.id);
    let friendSheet = null;
    for (let i = 0; i < 300 && !(friendSheet = heroAim(HEROES[friend.hero].id)); i++) await new Promise(resolve => setTimeout(resolve, 50));
    if (!friendSheet) throw new Error('Companion has no aiming sheet');
    liveCtx.drawImage = (...args) => {
      if (args[0] === friendIcon && args.length === 5) friendCalls.push({ order: 'gun', width: args[3], height: args[4] });
      if (args[0] === friendSheet.img || (args[0] instanceof HTMLImageElement && args[0].src === friendSheet.img.src)) friendCalls.push({ order: 'kid' });
      original(...args);
    };
    for (let i = 0; i < 300; i++) {
      friendCalls = []; live.render(g, 0);
      if (friendCalls.some(c => c.order === 'kid')) break;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    // a standing companion aims with arms out in the direction they face, gun between body and hands
    for (let direction = 0; direction < 8; direction += 2) {
      const angle = direction * Math.PI / 4, face = screenDirToWorld(Math.cos(angle), Math.sin(angle));
      Object.assign(friend, { faceX: face.x, faceY: face.y, moving: false }); friendCalls = []; live.render(g, 0);
      const gun = friendCalls.find(c => c.order === 'gun');
      if (!gun || gun.width !== 40 || gun.height !== 20) throw new Error('Companion gun is not drawn in hand');
      if (friendCalls.map(c => c.order).join(',') !== (direction >= 5 ? 'gun,kid' : 'kid,gun,kid')) throw new Error('Companion hands are not layered over the gun');
    }
    liveCtx.drawImage = original; g.state = 'pause';
    return { playerSamples: samples.length, aimedSamples: aimed, companionSamples: 4, missing };
  }, allowIncomplete);
  console.log(JSON.stringify(result));
  assert.equal(result.playerSamples, 5 * 6 * 13 * 8);
  assert.equal(result.aimedSamples, (5 * 2 - result.missing.length) * 8);
  if (result.missing.length) console.log(`INCOMPLETE ART: ${result.missing.join(', ')}; painted fallback retained. This is not a full release-art pass.`);
  await page.evaluate(() => {
    const review = document.createElement('img'); review.id = 'review';
    review.alt = 'All five kids with waist-height guns'; review.src = window.__weaponReview;
    review.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:800px;z-index:9999';
    document.body.append(review);
  });
  await page.locator('#review').screenshot({ path: 'art/world/checks/weapon-waist-review.png' });
  assert.deepEqual(errors, []);
  console.log(`Painted fallback validated; ${result.aimedSamples / 8} completed aiming sheets grip guns in eight directions with correct hand layers; companions face correctly. ${result.missing.length ? 'Full release-art check remains blocked by missing models.' : 'All ten held-gun looks are complete.'}`);
} finally { await browser.close(); }
