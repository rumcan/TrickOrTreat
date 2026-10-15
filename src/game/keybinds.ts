// ===== Rebindable keys: the model =====
// Every gameplay key can be changed in Settings › Controls. Nothing in the game looks at a raw press: each action has
// a CANONICAL token (its `token`, which is also its first default key) and this file describes which physical keys
// produce it. That way rebinding can never reach into gameplay code, and a key bound to nothing never reaches the
// game at all. This module is deliberately dependency-free, so it can be unit tested outside the browser
// (see scripts/keybinds.test.mjs); the live, saved copy lives in keybind-store.ts.

export type BindId =
  | 'moveUp' | 'moveDown' | 'moveLeft' | 'moveRight'
  | 'dash' | 'interact' | 'reload' | 'cycleGun' | 'gun1' | 'gun2'
  | 'skill' | 'inventory' | 'map' | 'pause' | 'confirm';

export interface BindDef {
  id: BindId;
  /** what the key does, as shown in Settings › Controls */
  label: string;
  /** one line of detail under the label */
  desc: string;
  /** the token the engine reads; rebinding only changes which presses produce it */
  token: string;
  group: 'Move' | 'Fight' | 'Night';
  defaults: string[];
}

/** Ordered as the controls screen lists them: moving, fighting, then the night's own screens. */
export const BINDS: BindDef[] = [
  { id: 'moveUp', label: 'Move up', desc: 'Walk toward the top of the street', token: 'w', group: 'Move', defaults: ['w', 'arrowup'] },
  { id: 'moveDown', label: 'Move down', desc: 'Walk toward the bottom of the street', token: 's', group: 'Move', defaults: ['s', 'arrowdown'] },
  { id: 'moveLeft', label: 'Move left', desc: 'Walk left along the street', token: 'a', group: 'Move', defaults: ['a', 'arrowleft'] },
  { id: 'moveRight', label: 'Move right', desc: 'Walk right along the street', token: 'd', group: 'Move', defaults: ['d', 'arrowright'] },
  { id: 'dash', label: 'Dash', desc: 'Short burst with invincibility frames · flee a doorstep', token: ' ', group: 'Move', defaults: [' ', 'shift'] },
  { id: 'interact', label: 'Interact', desc: 'Ring doorbells, pick up loot, hold to revive a friend', token: 'e', group: 'Fight', defaults: ['e'] },
  { id: 'reload', label: 'Reload', desc: 'Fill the magazine of the gun in hand', token: 'r', group: 'Fight', defaults: ['r'] },
  { id: 'cycleGun', label: 'Swap gun', desc: 'Switch between the two carried guns', token: 'q', group: 'Fight', defaults: ['q'] },
  { id: 'gun1', label: 'Gun slot 1', desc: 'Equip the first gun', token: '1', group: 'Fight', defaults: ['1'] },
  { id: 'gun2', label: 'Gun slot 2', desc: 'Equip the second gun', token: '2', group: 'Fight', defaults: ['2'] },
  { id: 'skill', label: 'Hero skill', desc: "The kid's own power (mouse right button does this too)", token: 'f', group: 'Fight', defaults: ['f'] },
  { id: 'inventory', label: 'Your run build', desc: 'Open the treats and synergies of this run', token: 'i', group: 'Night', defaults: ['i'] },
  { id: 'map', label: 'Map', desc: 'Show the neighbourhood map', token: 'm', group: 'Night', defaults: ['m', 'tab'] },
  { id: 'pause', label: 'Pause', desc: 'Take a breather and open the menu', token: 'escape', group: 'Night', defaults: ['escape', 'p'] },
  { id: 'confirm', label: 'Skip / confirm', desc: 'Skips the opening scene and confirms prompts', token: 'enter', group: 'Night', defaults: ['enter'] },
];

export const bindDef = (id: BindId): BindDef => BINDS.find((b) => b.id === id)!;

/**
 * Keys that always belong to one action: Escape must always leave a menu, Tab must always move focus on.
 * Every other key is the player's.
 */
export const RESERVED: Record<string, BindId> = { escape: 'pause', tab: 'map' };

export type Bindings = Record<BindId, string[]>;
export type AssignResult = { ok: true } | { ok: false; reason: string };

/** lowercase, and stable for anything the browser reports (`Escape`, `ArrowUp`, …) */
export const normalizeKey = (key: string): string => key.toLowerCase();

/** What a press is called on screen. `short` is for the small keycaps inside the HUD. */
export function keyLabel(key: string, short = false): string {
  if (key === ' ') return short ? 'Spc' : 'Space';
  const names: Record<string, [string, string]> = {
    shift: ['Shift', 'Shft'], control: ['Ctrl', 'Ctrl'], alt: ['Alt', 'Alt'], meta: ['Cmd', 'Cmd'],
    escape: ['Esc', 'Esc'], tab: ['Tab', 'Tab'], enter: ['Enter', 'Ent'], backspace: ['Backspace', 'Bksp'],
    capslock: ['Caps', 'Caps'], delete: ['Del', 'Del'], insert: ['Ins', 'Ins'], home: ['Home', 'Home'],
    end: ['End', 'End'], pageup: ['PgUp', 'PgUp'], pagedown: ['PgDn', 'PgDn'],
    arrowup: ['↑', '↑'], arrowdown: ['↓', '↓'], arrowleft: ['←', '←'], arrowright: ['→', '→'],
  };
  const named = names[key];
  if (named) return short ? named[1] : named[0];
  return key.length === 1 ? key.toUpperCase() : key.charAt(0).toUpperCase() + key.slice(1);
}

export function defaultBindings(): Bindings {
  const map = {} as Bindings;
  for (const def of BINDS) map[def.id] = [...def.defaults];
  return map;
}

export function cloneBindings(source: Bindings): Bindings {
  const copy = {} as Bindings;
  for (const def of BINDS) copy[def.id] = [...(source[def.id] ?? def.defaults)];
  return copy;
}

/** the first of an action's own defaults that nobody holds yet */
const freeDefault = (def: BindDef, taken: Set<string>): string | undefined => def.defaults.find((k) => !taken.has(k));

/**
 * Give every action that has no key left one of its own defaults: a free one when there is one, otherwise one that
 * an action with keys to spare can give up, and only as a last resort the action's first default — which pushes the
 * action holding it onto its own default. A save can therefore never leave an action unplayable. Used by both
 * sanitize() and restoreOne().
 */
function fillEmpty(map: Bindings, taken: Set<string>) {
  for (const def of BINDS) {
    if (map[def.id].length) continue;
    const free = freeDefault(def, taken);
    if (free) { map[def.id] = [free]; taken.add(free); continue; }
    const donors = BINDS.filter((other) => other.id !== def.id && map[other.id].length > 1 && def.defaults.some((k) => map[other.id].includes(k)))
      .sort((a, b) => map[b.id].length - map[a.id].length);
    const donor = donors[0];
    const given = donor && def.defaults.find((k) => map[donor.id].includes(k));
    if (donor && given) {
      map[donor.id] = map[donor.id].filter((k) => k !== given);
      map[def.id] = [given];
      taken.add(given);
      continue;
    }
    const own = def.defaults[0];
    for (const other of BINDS) if (other.id !== def.id) map[other.id] = map[other.id].filter((k) => k !== own);
    map[def.id] = [own];
    taken.add(own);
  }
}

/** Read back what was saved, dropping anything unreadable, reserved or duplicated. Empty actions get a free default. */
export function sanitize(stored: unknown): Bindings {
  const map = {} as Bindings;
  for (const def of BINDS) map[def.id] = [];
  if (!stored || typeof stored !== 'object') return defaultBindings();
  const taken = new Set<string>();
  // first pass: whatever the player actually chose
  for (const def of BINDS) {
    const value = (stored as Record<string, unknown>)[def.id];
    if (!Array.isArray(value)) continue;
    for (const raw of value) {
      if (typeof raw !== 'string' || !raw) continue;
      const key = normalizeKey(raw);
      const reserved = RESERVED[key];
      if (reserved && reserved !== def.id) continue;
      if (taken.has(key) || map[def.id].includes(key)) continue;
      map[def.id].push(key); taken.add(key);
    }
  }
  // second pass: nothing is left without a key (an action that lost one in the first pass gets a default back)
  fillEmpty(map, taken);
  return map;
}

/**
 * Put `key` in `slot` of `id`, returning the new bindings. A key belongs to one action only, so it is taken away
 * from whatever else had it — unless that action would be left with no key at all.
 */
export function reassign(bindings: Bindings, id: BindId, slot: number, rawKey: string): AssignResult & { bindings?: Bindings } {
  const key = normalizeKey(rawKey);
  if (!key || key === 'process' || key === 'unidentified') return { ok: false, reason: 'That key cannot be used.' };
  const reserved = RESERVED[key];
  if (reserved && reserved !== id) return { ok: false, reason: `${keyLabel(key)} always ${key === 'escape' ? 'closes a menu' : 'moves focus'}. Choose another key.` };
  const next = cloneBindings(bindings);
  if (next[id][slot] === key) return { ok: true, bindings: next };
  for (const def of BINDS) {
    if (def.id === id) continue;
    if (!next[def.id].includes(key)) continue;
    if (next[def.id].length <= 1) return { ok: false, reason: `${def.label} needs a key: give it another one first.` };
    next[def.id] = next[def.id].filter((k) => k !== key);
  }
  next[id] = next[id].map((k, i) => (i === slot ? key : k)).filter((k, i, all) => all.indexOf(k) === i);
  return { ok: true, bindings: next };
}

/** Drop one of an action's keys. Refused when it is the action's only key. */
export function clearSlot(bindings: Bindings, id: BindId, slot: number): AssignResult & { bindings?: Bindings } {
  if (bindings[id].length <= 1) return { ok: false, reason: `${bindDef(id).label} needs at least one key.` };
  const next = cloneBindings(bindings);
  next[id] = next[id].filter((_, i) => i !== slot);
  return { ok: true, bindings: next };
}

/** Restore one action to the keys it shipped with; another action's hold on them is released. */
export function restoreOne(bindings: Bindings, id: BindId): Bindings {
  const wants = [...bindDef(id).defaults];
  const next = cloneBindings(bindings);
  next[id] = [];
  for (const def of BINDS) if (def.id !== id) next[def.id] = next[def.id].filter((k) => !wants.includes(k));
  // releasing a key must never leave that action with nothing: it takes its own default back
  fillEmpty(next, new Set(Object.values(next).flat()));
  next[id] = wants;
  return next;
}

/** `true` while an action still has the keys it shipped with (so the UI can hide its reset arrow). */
export function isDefault(bindings: Bindings, id: BindId): boolean {
  const shipped = bindDef(id).defaults;
  const now = bindings[id];
  return shipped.length === now.length && shipped.every((k) => now.includes(k));
}

/**
 * The token a physical key produces for a set of bindings. `pressed[key]` is what the engine reads.
 * Built once per change and reused, because every keydown goes through it.
 */
export function makeLookup(bindings: Bindings): Map<string, string[]> {
  const lookup = new Map<string, string[]>();
  for (const def of BINDS) {
    for (const key of bindings[def.id]) {
      const tokens = lookup.get(key) ?? [];
      if (!tokens.includes(def.token)) tokens.push(def.token);
      lookup.set(key, tokens);
    }
  }
  return lookup;
}
