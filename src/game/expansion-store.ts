export type ExpansionState = { owned: boolean; loading: boolean; buying: boolean; bits: number | null; error: string; preview: boolean };
export interface ExpansionPort {
  quantity(): Promise<number>;
  price(): Promise<number | null>;
  buy(key: string): Promise<{ success: boolean }>;
  getKey(): string | null;
  setKey(key: string): void;
  uuid(): string;
}
export function createExpansionStore(port: ExpansionPort, development = false) {
  let view: ExpansionState = { owned: false, loading: true, buying: false, bits: null, error: '', preview: false };
  let restoring: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  const update = (next: Partial<ExpansionState>) => { view = { ...view, ...next }; for (const fn of listeners) fn(); };
  return {
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    snapshot: () => view,
    hasAccess: () => view.owned || (development && view.preview),
    restore() {
      if (view.buying) return Promise.resolve();
      if (restoring) return restoring;
      update({ loading: true, bits: null, error: '' });
      restoring = Promise.resolve().then(async () => {
        try {
          update({ owned: (await port.quantity()) > 0 });
          const price = await port.price();
          update({ bits: price !== null && Number.isSafeInteger(price) && price > 0 ? price : null });
        } catch { update({ error: 'Connect to RUN to check ownership and the expansion price.' }); }
        finally { update({ loading: false }); restoring = null; }
      });
      return restoring;
    },
    async purchase() {
      if (view.buying || view.loading || view.owned || !view.bits) return;
      update({ buying: true, error: '' });
      try {
        let key = port.getKey();
        if (!key) { key = port.uuid(); port.setKey(key); }
        const result = await port.buy(key);
        if (!result.success) { port.setKey(''); return; }
        if ((await port.quantity()) <= 0) throw new Error('Purchase pending. Use Restore to check your permanent unlock.');
        update({ owned: true });
        port.setKey('');
      } catch (error) { update({ error: error instanceof Error ? error.message : 'Unlock failed. Retry or restore.' }); }
      finally { update({ buying: false }); }
    },
    preview() { if (development) update({ preview: true }); },
  };
}
