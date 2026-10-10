import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

// Inside RUN the host owns fullscreen: phones and the native apps report it unavailable, so a button there can only
// do nothing. Outside the host (local development) the browser's own Fullscreen API decides.
type FullscreenDocument = Document & { webkitFullscreenEnabled?: boolean };
const hosted = () => { try { return !RundotGameAPI.isMock(); } catch { return false; } };
let hostActive = false, watching = false;
function watchHost() {
  if (watching) return;
  watching = true;
  try { RundotGameAPI.system.onFullscreenStateChange(state => { hostActive = state.active; }); } catch { /* older host */ }
}

/** True only where a fullscreen request can actually succeed. Show fullscreen controls on this, never unconditionally. */
export function canFullscreen(): boolean {
  if (hosted()) {
    try { return RundotGameAPI.system.canFullscreen(); } catch { return false; }
  }
  const doc = document as FullscreenDocument;
  return !!(doc.fullscreenEnabled || doc.webkitFullscreenEnabled);
}

/** Fullscreen requires a user gesture and may still be denied by the host/browser. */
export function requestGameFullscreen(toggle = false): void {
  if (!canFullscreen()) return;
  try {
    if (hosted()) {
      watchHost();
      // must be the first awaited call in the gesture, so the state comes from the listener, not a query
      if (hostActive) { if (toggle) void RundotGameAPI.system.exitFullscreen().then(state => { hostActive = state.active; }).catch(() => undefined); }
      else void RundotGameAPI.system.requestFullscreen().then(state => { hostActive = state.active; }).catch(() => undefined);
      return;
    }
    if (document.fullscreenElement) {
      if (toggle) void document.exitFullscreen().catch(() => undefined);
      return;
    }
    const target = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
    if (target.requestFullscreen) void target.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
    else target.webkitRequestFullscreen?.();
  } catch { /* A host policy or unsupported mobile browser must not block starting. */ }
}
export function requestMobileFullscreen() {
  if (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) requestGameFullscreen();
}
