import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createExpansionStore } from '../src/game/expansion-store.ts';

test('release shop offers one active, permanent full-game unlock for 100 RUN Bits', async () => {
  const config = JSON.parse(await fs.readFile(new URL('../rundot/shop.config.json', import.meta.url), 'utf8'));
  const source = await fs.readFile(new URL('../src/game/expansion.ts', import.meta.url), 'utf8');
  const itemId = source.match(/FULL_GAME_ITEM = '([^']+)'/)[1];
  const entitlementId = source.match(/FULL_GAME_ENTITLEMENT = '([^']+)'/)[1];
  const matches = config.items.filter(item => item.itemId === itemId);
  assert.equal(matches.length, 1);
  const [item] = matches;
  assert.equal(item.active, true);
  assert.equal(item.unique, true);
  assert.equal(item.category, 'non_consumable');
  assert.deepEqual(item.price, { type: 'bucks', value: '100' });
  assert.deepEqual(item.entitlements, [{ entitlementId, quantity: 1, consumable: false }]);
  assert.equal(item.refundEligible, true);
  assert.equal(item.refundWindowHours, 24);
  assert.ok(!item.releasedAt && !item.expiresAt && !item.regions?.length, 'No accidental region or release-window restriction');
});

function harness(development = false) {
  const state = { quantity: 0, price: 100, key: '', calls: [], cancelled: false, fail: false, grant: true };
  const port = {
    quantity: async () => state.quantity,
    price: async () => state.price,
    buy: async key => { state.calls.push(key); if (state.fail) throw new Error('Offline'); if (state.cancelled) return { success: false }; if (state.grant) state.quantity = 1; return { success: true }; },
    getKey: () => state.key, setKey: key => { state.key = key; }, uuid: () => 'stable-request-id',
  };
  return { state, store: createExpansionStore(port, development), port };
}
test('production starts locked; preview cannot unlock it', async () => {
  const { store } = harness(); await store.restore(); store.preview(); assert.equal(store.hasAccess(), false);
});
test('cancellation never unlocks and clears only the cancelled request', async () => {
  const { store, state } = harness(); state.cancelled = true; await store.restore(); await store.purchase();
  assert.equal(store.hasAccess(), false); assert.equal(state.key, ''); assert.equal(state.calls.length, 1);
});
test('network retries reuse the persisted key; a verified purchase cannot charge again', async () => {
  const { store, state } = harness(); await store.restore(); state.fail = true; await store.purchase();
  assert.equal(state.key, 'stable-request-id'); assert.equal(store.hasAccess(), false);
  state.fail = false; await store.purchase(); await store.purchase();
  assert.equal(store.hasAccess(), true); assert.deepEqual(state.calls, ['stable-request-id', 'stable-request-id']); assert.equal(state.key, '');
});
test('successful order without server entitlement stays locked; restore grants later', async () => {
  const { store, state } = harness(); await store.restore(); state.grant = false; await store.purchase();
  assert.equal(store.hasAccess(), false); assert.match(store.snapshot().error, /pending/);
  state.quantity = 1; await store.restore(); assert.equal(store.hasAccess(), true);
});
test('double clicks cannot create concurrent orders', async () => {
  const { port, state } = harness(); let finish;
  port.buy = key => { state.calls.push(key); return new Promise(resolve => { finish = () => { state.quantity = 1; resolve({ success: true }); }; }); };
  const store = createExpansionStore(port); await store.restore(); const first = store.purchase(); await store.purchase();
  assert.equal(state.calls.length, 1); finish(); await first; assert.equal(store.hasAccess(), true);
});
test('missing price prevents purchases; refunded entitlement locks again', async () => {
  const { store, state } = harness(); state.price = null; await store.restore(); await store.purchase(); assert.equal(state.calls.length, 0);
  state.quantity = 1; await store.restore(); assert.equal(store.hasAccess(), true);
  state.quantity = 0; await store.restore(); assert.equal(store.hasAccess(), false);
});
