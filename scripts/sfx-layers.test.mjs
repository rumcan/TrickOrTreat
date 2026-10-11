import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Every sound effect is two recordings played together: the original deep one and a bright layer on top.
const layer = JSON.parse(fs.readFileSync('src/game/sound/top-layer.json', 'utf8')), top = layer.sounds, guns = layer.guns;
const originals = JSON.parse(fs.readFileSync('src/game/sound/manifest.json', 'utf8')).sfx.map(s => s.id);
test('every bright layer sits on an original recording that is still shipped', () => {
  for (const s of top) {
    // an explosion sits on the monster thud and a landing bullet on the wooden tick: they have no recording of their own
    const base = { boom: 'impact', hit: 'tick' }[s.id] ?? s.id;
    assert.ok(originals.includes(base), `${s.id} has an original in the manifest`);
    assert.ok(fs.statSync(`public/audio/sfx/${base}.mp3`).size > 1000, `${s.id}: the original file is still there`);
  }
});
test('every bright layer has its recording, made from the prompt on file', () => {
  for (const s of top) {
    assert.ok(fs.statSync(`public/audio/sfx/top-${s.id}.mp3`).size > 1500, `top-${s.id}.mp3 exists`);
    const note = JSON.parse(fs.readFileSync(`public/audio/sfx/top-${s.id}.mp3.json`, 'utf8'));
    assert.equal(note.prompt, s.prompt, `top-${s.id} was made from the current prompt`);
    assert.ok(s.gain > 0 && s.gain <= 1 && s.duration >= 0.5, `${s.id}: sane level and length`);
  }
});
test('the effects the game plays most are covered', () => {
  for (const id of ['boom', 'hit', 'reload', 'pickup', 'door', 'hurt', 'swoosh', 'skill', 'revive', 'guardian', 'unlock', 'victory', 'click']) assert.ok(top.some(s => s.id === id), id);
});
test('every gun has its own quiet shot, kept short and spaced out', () => {
  const ids = /GUN_ART_IDS = \[([^\]]+)\]/.exec(fs.readFileSync('src/ui/art.ts', 'utf8'))[1].match(/'([a-z]+)'/g).map(s => s.slice(1, -1));
  assert.equal(ids.length, 24);
  assert.deepEqual(guns.map(g => g.id).sort(), [...ids].sort(), 'one sound per gun, no more and no less');
  assert.ok(!top.some(s => s.id === 'shot'), 'there is no one-size shot layer any more');
  for (const g of guns) {
    assert.ok(fs.statSync(`public/audio/sfx/gun-${g.id}.mp3`).size > 1500, `gun-${g.id}.mp3 exists`);
    assert.ok(fs.statSync(`public/audio/sfx/gun-${g.id}.mp3`).size < 20000, `gun-${g.id}.mp3 is a short recording, not a two-second one`);
    assert.ok(g.gain <= 0.25 && g.max <= 0.4 && g.every >= 0.1, `${g.id}: quiet, short and not restarted on every bullet`);
    assert.equal(JSON.parse(fs.readFileSync(`public/audio/sfx/gun-${g.id}.mp3.json`, 'utf8')).prompt, g.prompt);
  }
  assert.ok(fs.statSync('public/audio/sfx/shot.mp3').size > 1000, 'the deep original shot is still shipped and played under each of them');
});
