// ===== Rebindable keys: the live, saved copy =====
// Wraps the model in keybinds.ts with this device's saved keys and a subscription React and the engine follow.
// The engine asks translateKey() which canonical action a press means; the settings screen writes through the
// assign/clear/reset helpers below.
import * as storage from './storage';
import { BindId, Bindings, AssignResult, bindDef, clearSlot, defaultBindings, isDefault, keyLabel, makeLookup, normalizeKey, reassign, restoreOne, sanitize } from './keybinds';

export * from './keybinds';

const KEY = 'tot_keybinds_v1';
const EMPTY: string[] = [];

function load(): Bindings {
  try {
    return sanitize(JSON.parse(storage.getItem(KEY) || ''));
  } catch {
    return defaultBindings();
  }
}

let current: Bindings = load();
let version = 0;
let lookup = makeLookup(current);
const listeners = new Set<() => void>();

/** The tokens a physical key produces right now (empty when it is bound to nothing). */
export function translateKey(key: string): string[] {
  return lookup.get(normalizeKey(key)) ?? EMPTY;
}

export const bindingsOf = (id: BindId): string[] => current[id];
export const allBindings = (): Bindings => current;
/** bumped on every change, so React can re-read the keycaps anywhere in the UI */
export const keybindVersion = (): number => version;
export const actionIsDefault = (id: BindId): boolean => isDefault(current, id);

export function subscribeKeybinds(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function commit(next: Bindings) {
  current = next;
  version++;
  lookup = makeLookup(current);
  storage.setItem(KEY, JSON.stringify(current));
  for (const listener of [...listeners]) listener();
}

/** Put a key on an action (see keybinds.reassign for the rules). */
export function assignKey(id: BindId, slot: number, key: string): AssignResult {
  const result = reassign(current, id, slot, key);
  if (result.ok && result.bindings) commit(result.bindings);
  return result.ok ? { ok: true } : result;
}

/** Take one of an action's alternative keys away. */
export function clearKey(id: BindId, slot: number): AssignResult {
  const result = clearSlot(current, id, slot);
  if (result.ok && result.bindings) commit(result.bindings);
  return result.ok ? { ok: true } : result;
}

/** Restore every key to the shipped defaults. */
export function resetBindings(): void {
  commit(defaultBindings());
}

/** Restore one action. */
export function resetBinding(id: BindId): void {
  commit(restoreOne(current, id));
}

/** The first key of an action, for the one-key hints in the HUD. */
export const primaryKey = (id: BindId): string => current[id][0];

/** Its label, e.g. "Spc" or "Esc". */
export const bindLabel = (id: BindId, short = false): string => keyLabel(primaryKey(id), short);

/** Every label of an action, e.g. ['W', '↑'] — for the controls sheet. */
export const bindLabels = (id: BindId, short = false): string[] => current[id].map((k) => keyLabel(k, short));

/** The first key's label of an action — the one-key hints in the HUD. */
export const bindHint = (id: BindId, short = false): string => keyLabel(primaryKey(id), short);

/** One line naming an action's keys, e.g. "W / ↑". */
export const bindSummary = (id: BindId, short = false): string => bindLabels(id, short).join(' / ');

export { bindDef };
