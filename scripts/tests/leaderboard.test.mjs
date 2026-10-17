import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { createLeaderboardService } from '../../src/game/leaderboard-service.ts';
function harness(enabled = true) {
  const state = { profile: { id: 'kid-1', username: 'MaplePhoenix', isAnonymous: false }, calls: [], fail: false, accepted: true, tag: 'ZAP' };
  const port = {
    guestTag: () => state.tag,
    profile: () => { if (!state.profile) throw new Error('No host'); return state.profile; },
    page: async (mode, cursor) => { state.calls.push(['read', mode, cursor]); return { entries: [{ profileId: 'kid-1', username: 'MaplePhoenix', score: 360, rank: 1 }, { profileId: 'npc', username: 'Not a real player', score: 500, rank: 1, isSeed: true }, { profileId: 'bad', username: 'Bad score', score: NaN, rank: 2 }], totalEntries: 3, nextCursor: null }; },
    rank: async mode => { state.calls.push(['rank', mode]); return { rank: 1, score: 360, totalPlayers: 1 }; },
    submit: async data => { state.calls.push(['submit', data]); if (state.fail) throw new Error('Offline'); return { accepted: state.accepted, rank: state.accepted ? 1 : null }; },
  };
  return { state, port, service: createLeaderboardService(port, enabled) };
}
test('missing and placeholder profiles make no leaderboard calls', async () => {
  const { service, state } = harness();
  for (const profile of [null, { id: 'unknown-user', username: 'unknown-user' }, { id: 'unknown-user', username: 'unknown-user', isAnonymous: true }, { id: '', username: 'Nobody', isAnonymous: true }]) {
    state.profile = profile;
    assert.equal(service.profile(), null); assert.equal(service.beginRun(), null);
    await assert.rejects(() => service.read('survival'), /unavailable/);
    assert.equal(await service.finish(null, 'survival', 360, {}), '');
  }
  assert.equal(state.calls.length, 0);
});
test('guests rank as Guest_ plus their own three letters, never under a host or free-text name', async () => {
  const { service, state, port } = harness();
  state.profile = { id: 'anon-7', username: 'some host handle', isAnonymous: true };
  assert.deepEqual(service.profile(), { id: 'anon-7', username: 'Guest_ZAP', isAnonymous: true, guest: true });
  assert.match(await service.finish(service.beginRun(), 'survival', 200, { hero: 'Tommy' }), /rank #1/);
  const sent = state.calls.find(call => call[0] === 'submit')[1];
  assert.deepEqual(sent.metadata, { hero: 'Tommy', guestTag: 'ZAP' });
  port.page = async () => ({ totalEntries: 5, entries: [
    { profileId: 'anon-7', username: 'some host handle', score: 200, rank: 1, metadata: { guestTag: 'OLD' } },
    { profileId: 'anon-8', username: 'x', score: 190, rank: 2, metadata: { guestTag: 'bob' } },
    { profileId: 'anon-9', username: 'x', score: 180, rank: 3, metadata: { guestTag: 'ASS' } },
    { profileId: 'anon-10', username: 'x', score: 170, rank: 4, metadata: { guestTag: '<b>hello there</b>' } },
    { profileId: 'kid-1', username: 'MaplePhoenix', score: 160, rank: 5, metadata: { hero: 'Sam' } },
  ] });
  const names = (await service.read('survival')).page.entries.map(e => e.username);
  assert.deepEqual(names, ['Guest_ZAP', 'Guest_BOB', 'Guest', 'Guest', 'MaplePhoenix'], 'Own row shows the current letters; bad tags fall back to plain Guest; signed-in names are untouched');
  state.tag = 'not three letters';
  assert.equal(service.profile(), null, 'A guest without valid letters cannot submit');
});
test('guest letters are exactly three A-Z, upper-cased, and rude spellings are refused', async () => {
  const { cleanGuestTag, randomGuestTag, guestName } = await import('../../src/game/leaderboard-service.ts');
  assert.equal(cleanGuestTag('abc'), 'ABC'); assert.equal(cleanGuestTag(' Zed '), 'ZED'); assert.equal(guestName('ABC'), 'Guest_ABC');
  for (const bad of ['', 'AB', 'ABCD', 'A1C', 'A C', 'ÄBC', 'a.b', null, undefined, 123, 'ASS', 'fuk', 'Sex', 'KKK']) assert.equal(cleanGuestTag(bad), null, String(bad));
  // even a generator that keeps landing on a refused word ends on allowed letters
  const rolls = [0 / 26, 18 / 26, 18 / 26, 1 / 26, 14 / 26, 1 / 26]; let i = 0;
  assert.equal(randomGuestTag(() => rolls[i++ % rolls.length]), 'BOB');
  for (let n = 0; n < 500; n++) assert.ok(cleanGuestTag(randomGuestTag()));
});
test('named signed-in players can read records; NPC and invalid entries are not displayed', async () => {
  const { service, state } = harness(); state.profile.isAnonymous = undefined;
  const { page, rank } = await service.read('rescue', 'page-2');
  assert.equal(page.entries.length, 1); assert.equal(page.entries[0].username, 'MaplePhoenix');
  assert.equal(rank.score, 360); assert.deepEqual(state.calls[0], ['read', 'rescue', 'page-2']);
});
test('records are seconds, mode-specific, idempotent and can improve after endless continuation', async () => {
  const { service, state } = harness(), run = service.beginRun();
  assert.match(await service.finish(run, 'survival', 361.8, { hero: 'Tommy', wave: 3 }), /rank #1/);
  assert.equal(await service.finish(run, 'survival', 361.9, {}), '');
  await service.finish(run, 'survival', 500, {});
  const submissions = state.calls.filter(call => call[0] === 'submit'); assert.equal(submissions.length, 2);
  assert.equal(submissions[0][1].score, 361); assert.equal(submissions[0][1].duration, 361);
  assert.equal(submissions[0][1].period, 'alltime'); assert.equal(submissions[0][1].mode, 'survival');
});
test('practice, development, too-short, invalid, duplicate and changed-account runs cannot submit', async () => {
  const { service, state } = harness(), run = service.beginRun();
  for (const time of [0, 9.99, NaN, Infinity, 86401]) assert.equal(await service.finish(run, 'survival', time, {}), '');
  assert.equal(await service.finish(run, 'survival', 100, {}, true), '');
  state.profile = { id: 'kid-2', username: 'AnotherKid', isAnonymous: false };
  assert.equal(await service.finish(run, 'survival', 100, {}), '');
  assert.equal(state.calls.length, 0);
  assert.equal(harness(false).service.beginRun(), null);
});
test('a sign-out while reading discards private context', async () => {
  const { service, state, port } = harness();
  port.page = async () => { state.profile = null; return { entries: [], totalEntries: 0 }; };
  await assert.rejects(() => service.read('survival'), /session changed/);
});
test('failed or rejected uploads never claim an accepted rank', async () => {
  const { service, state } = harness(); state.accepted = false;
  assert.match(await service.finish(service.beginRun(), 'survival', 100, {}), /kept your previous record/);
  state.fail = true;
  assert.match(await service.finish(service.beginRun(), 'survival', 101, {}), /local record is safe/);
});
test('committed RUN config matches units, modes, sort order and query period', async () => {
  const config = JSON.parse(await fs.readFile('rundot/leaderboard.config.json', 'utf8'));
  assert.equal(config.scoreOrder, 'highest'); assert.equal(config.minDurationSec, 10); assert.equal(config.maxScore, 86400);
  assert.deepEqual(Object.keys(config.modes), ['survival', 'rescue']);
  assert.equal(config.periods.alltime.type, 'alltime'); assert.equal(config.antiCheat.enableRateLimit, true);
  assert.ok(!config.seedEntries, 'Use real people, not fake leaderboard names');
});
