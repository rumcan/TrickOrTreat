import test from 'node:test';
import assert from 'node:assert/strict';
import { createExpansionStore } from '../src/game/expansion-store.ts';

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
