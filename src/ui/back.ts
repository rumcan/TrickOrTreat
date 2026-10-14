import { useEffect, useRef } from 'react';

// On a phone the browser's Back gesture is how people dismiss a full-screen popup. Without help it leaves the site
// (and the run). While anything is open, one spare history entry absorbs Back and hands it to the topmost handler.
type BackHandler = () => boolean | void;
const handlers: BackHandler[] = [];
let armed = false, listening = false;

function arm() {
  if (armed || typeof history === 'undefined') return;
  try { history.pushState({ ...(history.state ?? {}), totBack: true }, ''); armed = true; } catch { /* sandboxed host: Back keeps its default */ }
}
function onPop() {
  armed = false; // the browser just consumed the spare entry
  for (let i = handlers.length - 1; i >= 0; i--) {
    // a handler returns false to pass ("nothing of mine to close")
    if (handlers[i]() !== false) { arm(); return; }
  }
}
/** Register a Back handler; the most recent one is asked first. Returns its remover. */
export function pushBack(handler: BackHandler) {
  if (!listening && typeof window !== 'undefined') { window.addEventListener('popstate', onPop); listening = true; }
  handlers.push(handler);
  arm();
  return () => { const i = handlers.lastIndexOf(handler); if (i >= 0) handlers.splice(i, 1); };
}
/** While mounted (and `active`), browser Back calls `handler` instead of leaving the page. */
export function useBack(handler: BackHandler, active = true) {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => (active ? pushBack(() => latest.current()) : undefined), [active]);
}
