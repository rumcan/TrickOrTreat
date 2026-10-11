import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';

// The Buddy System constellation: talents that only change the friends at your side. Each one is checked on a real
// game: more health, faster and further fire, crits, healing, getting back up alone, a better gun, a friend from the
// first minute, quicker pick-ups of the player, an extra projectile.
const browser = await chromium.launch({ channel: 'msedge' });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:5173/');
  await page.getByRole('button', { name: 'Go trick-or-treating' }).waitFor({ timeout: 120000 });
  const out = await page.evaluate(async () => {
    const { Game, FRIEND_HP, FRIEND_DOWN_TIME } = await import('/src/game/engine.ts');
    const d = await import('/src/game/data.ts');
    const { expansion } = await import('/src/game/expansion.ts');
    const input = () => ({ keys: new Set(), pressed: new Set(), mouseActive: false, mdown: false, rpressed: false, wheel: 0, touchFiring: false, endFrame() { this.pressed.clear(); this.rpressed = false; this.wheel = 0; } });
    const game = (talents, campaign = false) => { const g = new Game(0, { hero: 0, soul: 0, best: 0, talents }, input(), campaign, 1337); g.state = 'play'; g.pickups = []; g.director = () => {}; g.enemies = []; return g; };
    const res = {};
    const branch = d.TALENTS.filter(t => t.branch === 3);
    res.tree = { count: branch.length, free: branch.filter(t => !t.premium).length, full: branch.filter(t => t.premium).length, name: d.TALENT_BRANCHES[3], roots: branch.filter(t => !t.req.length).map(t => t.id), orphans: branch.filter(t => t.req.some(r => d.TALENT_BY_ID[r].branch !== 3)).map(t => t.id) };
    // none of them touches the kid: every stat a Buddy talent changes is a friend stat
    const mateKeys = ['companionDmg', 'companionArmor', 'reviveSpeed', 'mateHp', 'mateRate', 'mateRange', 'mateCrit', 'mateRegen', 'mateGun', 'mateReviveCd', 'mateDown', 'mateUp', 'matePellets', 'mateStart'];
    res.selfish = branch.filter(t => { const a = d.baseStats(), b = d.baseStats(); t.apply(b, t.max); return Object.keys(a).some(k => a[k] !== b[k] && !mateKeys.includes(k)); }).map(t => t.id);

    // ---- free game: Sleepover Plans brings a friend along, Shared Snacks makes them tougher ----
    const alone = game({});
    const withFriend = game({ buddy: 5, snacks: 3, walkie: 3, sleepover: 1 });
    const pal = withFriend.friends[0];
    res.sleepover = { alone: alone.friends.length, friends: withFriend.friends.length, status: pal?.status, notSelf: pal && pal.hero !== 0 && pal.hero <= 2, helper: withFriend.activeFriend === pal?.hero, maxHp: pal?.maxHp, hp: pal?.hp, base: FRIEND_HP, gun: pal?.weapon.def.id };

    // ---- shooting: rate, extra projectile, crits, range ----
    const shoot = (talents) => {
      const g = game({ sleepover: 1, ...talents }), f = g.friends[0];
      f.x = g.p.x; f.y = g.p.y;
      const e = g.spawnEnemy('zombie', f.x + 1.2, f.y, false, null); e.spawnT = 0; e.maxHp = e.hp = 1e6;
      f.weapon.traits = []; f.weapon.cd = 0; g.bullets = [];
      const random = Math.random; Math.random = () => 0.01; // crits land when they can
      try { g.friendShoot(f, 0.016); } finally { Math.random = random; }
      return { bullets: g.bullets.length, cd: +f.weapon.cd.toFixed(4), dmg: +(g.bullets[0]?.dmg ?? 0).toFixed(3), life: +(g.bullets[0]?.life ?? 0).toFixed(3), g, f, e };
    };
    expansion.preview(); // the full-game stars count from here on
    res.campaignStart = game({ sleepover: 1 }, true).friends.filter(f => f.status === 'rescued').length; // the campaign hides its friends as before
    const plain = shoot({}), fast = shoot({ walkie: 3 }), two = shoot({ double: 1 }), crit = shoot({ sharpeye: 3 }), far = shoot({ range: 3 }), hard = shoot({ buddy: 5 });
    res.shoot = { plain: plain.bullets, two: two.bullets, rate: +(plain.cd / fast.cd).toFixed(2), crit: +(crit.dmg / plain.dmg).toFixed(2), far: +(far.life / plain.life).toFixed(2), hard: +(hard.dmg / plain.dmg).toFixed(2) };
    // out of reach without the telephone, in reach with it
    const reach = (talents) => { const s = shoot(talents); s.e.x = s.f.x + 4.6; s.f.weapon.cd = 0; s.g.bullets = []; s.g.friendShoot(s.f, 0.016); return s.g.bullets.length; };
    res.reach = { without: reach({}), with: reach({ range: 3 }) };
    res.gun = { plain: plain.f.weapon.rarity, better: shoot({ borrow: 2 }).f.weapon.rarity };

    // ---- staying alive ----
    const regen = shoot({ pinky: 3 }); regen.g.enemies = []; regen.f.hp = 10;
    for (let i = 0; i < 60; i++) regen.g.update(1 / 30);
    res.regen = +regen.f.hp.toFixed(0);
    const down = (talents, seconds) => { const s = shoot(talents); s.g.enemies = []; s.f.hp = 0; s.f.downT = 0; s.g.p.x += 6; s.f.x = s.g.p.x - 6; for (let i = 0; i < seconds * 30; i++) s.g.update(1 / 30); return { there: s.g.friends.includes(s.f), hp: s.f.hp, window: s.g.friendDownTime }; };
    res.bff = { before: down({ bff: 1 }, 11), after: down({ bff: 1 }, 13) };
    res.left = { gone: down({}, FRIEND_DOWN_TIME + 1), kept: down({ helpup: 3 }, FRIEND_DOWN_TIME + 1) };
    res.pickup = { plain: plain.g.friendReviveCd, medic: shoot({ medic: 1 }).g.friendReviveCd };
    const big = shoot({ snacks: 3, stickers: 3, tagteam: 1 });
    res.big = { maxHp: big.f.maxHp, dmg: +(big.dmg / plain.dmg).toFixed(2) };
    return res;
  });
  assert.deepEqual(out.tree, { count: 15, free: 8, full: 7, name: 'Buddy System', roots: ['buddy'], orphans: [] }, 'A whole constellation of its own');
  assert.deepEqual(out.selfish, [], 'Buddy talents change friends only');
  assert.deepEqual(out.sleepover, { alone: 0, friends: 1, status: 'rescued', notSelf: true, helper: true, maxHp: 155, hp: 155, base: 80, gun: 'nerf' }, 'Sleepover Plans and Shared Snacks');
  assert.equal(out.campaignStart, 0, 'The rescue campaign still hides every friend');
  assert.deepEqual(out.shoot, { plain: 1, two: 2, rate: 1.24, crit: 2, far: 1.45, hard: 1.4 }, 'Walkie Check, Double Team, Eagle-Eyed Pals, Tin-Can Telephone, Fist Bump');
  assert.deepEqual(out.reach, { without: 0, with: 1 }, 'The telephone lets friends hit what was out of reach');
  assert.deepEqual(out.gun, { plain: 1, better: 3 }, 'Hand-Me-Down Blaster');
  assert.ok(out.regen >= 18 && out.regen <= 20, `Pinky Promise heals 4.5 HP a second (10 → ${out.regen} in 2s)`);
  assert.ok(out.bff.before.there && out.bff.before.hp === 0, 'Best Friends Forever: still down at 11 seconds');
  assert.ok(out.bff.after.there && out.bff.after.hp > 0, 'Best Friends Forever: back up alone after 12 seconds');
  assert.ok(!out.left.gone.there && out.left.kept.there && out.left.kept.window === 45, 'Helping Hand gives 15 more seconds to reach a friend');
  assert.deepEqual(out.pickup, { plain: 60, medic: 30 }, 'Candy Medics');
  assert.deepEqual(out.big, { maxHp: 80 + 75 + 45 + 80, dmg: +(1.36 * 1.6).toFixed(2) }, 'Sticker Swap and Tag Team Champions stack');
  assert.deepEqual(errors, [], 'No page errors');
  console.log('partner talents: 15 Buddy System stars, each changing the friends and only the friends: ok');
} finally { await browser.close(); }
