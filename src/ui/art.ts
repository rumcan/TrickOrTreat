// UI artwork cut from the concept sheets in art/concept (see scripts/crop-ui-kit.py).
const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || './';
const img = (p: string) => `${base}images/${p}`;

export const ART = {
  keyart: img('splash.webp?v=2'),
  keyartPortrait: img('splash_portrait.webp?v=2'),
  logo: img('newlogo.webp?v=4'),
  logoSm: img('newlogo_sm.webp?v=4'),
  kitLogo: img('newlogo_sm.webp?v=4'),
  pause: img('ui/pause_art.webp'),
  infoPumpkin: img('ui/info_pumpkin.webp'),
  skillPumpkin: img('ui/skill_pumpkin.webp'),
};

/** per hero (HERO_INFO order): tall card portrait and round HUD face */
export const PORTRAITS = ['tommy', 'sam', 'jess', 'maya', 'leo'].map(k => img(`ui/portrait_${k}.webp?v=3`));
export const FACES = ['tommy', 'sam', 'jess', 'maya', 'leo'].map(k => img(`ui/face_${k}.webp?v=3`));
/** frame colour per hero (matches the portrait backgrounds) */
export const HERO_COLORS = ['#e8432f', '#e68c26', '#8a4fd8', '#d49a39', '#368e8b'];

export type BannerKind = 'mission' | 'died' | 'level' | 'weapon' | 'tot';
export const BANNER_ART: Record<BannerKind, string> = {
  mission: img('ui/banner_mission.webp'),
  died: img('ui/banner_died.webp'),
  level: img('ui/banner_level.webp'),
  weapon: img('ui/banner_weapon.webp'),
  tot: img('ui/banner_tot.webp'),
};

const decode = (src: string, priority: 'high' | 'low') => {
  const im = new Image();
  im.fetchPriority = priority;
  im.src = src;
  return im.decode().catch(() => undefined);
};

/**
 * The loading screen's own artwork: the logo and the splash for this orientation. Boot waits for it (briefly) before
 * requesting the sprite manifest, so hundreds of sprite downloads never queue ahead of what the player is looking at.
 */
export function preloadSplash(timeoutMs = 4000) {
  const portrait = typeof matchMedia === 'function' && matchMedia('(orientation: portrait)').matches;
  const art = Promise.all([decode(ART.logo, 'high'), decode(portrait ? ART.keyartPortrait : ART.keyart, 'high')]);
  return Promise.race([art, new Promise((resolve) => setTimeout(resolve, timeoutMs))]).then(() => undefined);
}

/** Decode every UI image up front so plates and portraits never pop in mid-game. */
export function preloadUiArt() {
  const all = [...new Set([...Object.values(ART), ...PORTRAITS, ...FACES, ...Object.values(BANNER_ART)])];
  return Promise.all(
    all.map((src) => decode(src, src === ART.logo ? 'high' : 'low'))
  ).then(() => undefined);
}
