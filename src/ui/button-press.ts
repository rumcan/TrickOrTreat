import type { MouseEvent, PointerEvent } from 'react';

/** Secondary touch fingers do not reliably produce mouse-compatible clicks. */
export function buttonPress(action: () => void) {
  return {
    onPointerDown(event: PointerEvent<HTMLButtonElement>) {
      if (event.button !== 0 || event.currentTarget.disabled) return;
      event.preventDefault();
      action();
    },
    onClick(event: MouseEvent<HTMLButtonElement>) {
      // Pointer activation was handled on press; keep keyboard/assistive clicks.
      if (event.detail === 0 && !event.currentTarget.disabled) action();
    },
  };
}
