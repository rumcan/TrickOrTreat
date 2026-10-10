/** Fullscreen requires a user gesture and may be denied by the host/browser. */
export function requestGameFullscreen(toggle = false): void {
  try {
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
