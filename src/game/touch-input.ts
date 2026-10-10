/** Stick values are screen-space vectors with a small central dead zone. */
export function stickVector(dx: number, dy: number, radius: number, deadZone = 0.14) {
  if (!Number.isFinite(dx) || !Number.isFinite(dy) || !Number.isFinite(radius) || radius <= 0) return { x: 0, y: 0 };
  const distance = Math.hypot(dx, dy);
  const fraction = Math.min(1, distance / radius);
  if (fraction <= deadZone) return { x: 0, y: 0 };
  const strength = (fraction - deadZone) / (1 - deadZone);
  return { x: dx / distance * strength, y: dy / distance * strength };
}
