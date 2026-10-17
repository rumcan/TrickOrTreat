// Aiming sprites: a kid rendered from a rigged 3D model with both arms stretched out toward one of 8 screen
// directions, so the gun the engine draws at the hands looks held (scripts/art/make-hero-3d.mjs, scripts/art/render-hero-3d.mjs).
//
// One image per kid, 8 rows (direction 0 = right, then clockwise in 45 degree steps; 2 = toward the camera) and 14
// columns: the whole kid (1 idle frame + 6 walk frames), then the same 7 frames with only the forearms and hands.
// Drawing the kid, then the gun, then the hands puts the hands ON the gun instead of under it.
//
// Sheets load on demand (only the kids on screen), so they add nothing to boot time or to memory for kids not in play.
import HANDS from './hero3d.json';

export const AIM = { frame: 112, ax: 56, ay: 90, scale: 2, dirs: 8, walk: 6, cols: 7 } as const;
export interface HeroAim {
  img: HTMLImageElement;
  /** [direction][frame: 0 idle, 1..6 walk] -> where the hands meet, in pixels from the feet */
  hands: number[][][];
}
const hands = HANDS as unknown as Record<string, number[][][]>;
const ready = new Map<string, HeroAim>(), asked = new Set<string>();
const failures = new Map<string, { count: number; at: number }>();
const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || './';

/** The kid's aiming sheet, or null while it is still loading or when none has been rendered for them. */
export function heroAim(id: string): HeroAim | null {
  const hit = ready.get(id);
  if (hit) { ready.delete(id); ready.set(id, hit); return hit; }
  if (hit || asked.has(id) || !hands[id] || typeof Image === 'undefined') return hit ?? null;
  const failed = failures.get(id);
  if (failed && (failed.count >= 3 || Date.now() - failed.at < 5000)) return null;
  if (hands[id].length !== AIM.dirs || hands[id].some(row => row.length !== AIM.cols || row.some(p => p.length !== 2 || !p.every(Number.isFinite)))) return null;
  asked.add(id);
  const img = new Image();
  img.src = `${base}assets/hero3d/hero3d_${id}.webp`;
  void img.decode().then(() => {
    if (img.naturalWidth !== AIM.cols * 2 * AIM.frame * AIM.scale || img.naturalHeight !== AIM.dirs * AIM.frame * AIM.scale) throw new Error('Invalid aiming sprite dimensions');
    ready.set(id, { img, hands: hands[id] });
    // A decoded atlas is ~22 MB. Keep the player, helper and recent looks, not
    // all ten sheets across repeated runs on a phone.
    while (ready.size > 4) {
      const oldest = ready.keys().next().value!;
      ready.delete(oldest); asked.delete(oldest);
    }
    failures.delete(id);
  }).catch(() => {
    // Keep painted art during an interrupted mobile download, with bounded retries.
    asked.delete(id);
    failures.set(id, { count: (failed?.count ?? 0) + 1, at: Date.now() });
  });
  return null;
}
/** nearest sheet direction for a screen-space angle */
export const aimDir = (screenAngle: number) => ((Math.round(screenAngle / (Math.PI / 4)) % AIM.dirs) + AIM.dirs) % AIM.dirs;
