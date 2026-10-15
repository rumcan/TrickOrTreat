// UI artwork cut from the concept sheets in art/concept (see scripts/crop-ui-kit.py).
const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || './';
const img = (p: string) => `${base}images/${p}`;

/** eight-frame effect strips (scripts/prepare-fx-art.mjs), shown as CSS animations in the full-game showcase */
export const FX_ART = { explosion: `${base}assets/fx/fx_explosion.webp`, fire: `${base}assets/fx/fx_fire.webp` };

export const ART = {
  keyart: img('redesign/street-background.webp?v=1'),
  keyartPortrait: img('redesign/street-background.webp?v=1'),
  logo: img('newlogo.webp?v=4'),
  logoSm: img('newlogo_sm.webp?v=4'),
  kitLogo: img('newlogo_sm.webp?v=4'),
  pause: img('ui/pause_art.webp'),
  headingPause: img('redesign/heading-pause.webp'),
  headingSettings: img('redesign/heading-settings.webp'),
  headingLevelUp: img('redesign/heading-levelup.webp'),
  youDied: img('ui/youdied.webp'),
  /** "Reach 15K Essence to unlock premium" (scripts/prepare-badge-art.mjs) */
  badge15k: img('ui/badge_15k.webp'),
  infoPumpkin: img('ui/info_pumpkin.webp'),
  skillPumpkin: img('ui/skill_pumpkin.webp'),
  /** the tutorial's walkie-talkie (scripts/prepare-walkie-art.mjs) */
  walkie: img('ui/walkie.webp'),
};

/** painted card art per gun id (scripts/prepare-gun-art.mjs); the small in-world sprites are separate (icon_<id>) */
export const GUN_ART_IDS = ['pea', 'nerf', 'shotgun', 'roman', 'soaker', 'balloon', 'rocket', 'laser', 'slingshot', 'gloom', 'marshmallow', 'bubblegum', 'acorn',
  'flamer', 'stream', 'disc', 'sabre', 'glaive', 'swarm', 'singularity', 'annihilator', 'incinerator', 'lance', 'cryo'];
export const gunArtUrl = (id: string) => img(`guns/${GUN_ART_IDS.includes(id) ? id : 'pea'}.webp`);

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
  const all = [...new Set([...Object.values(ART), ...PORTRAITS, ...FACES, ...Object.values(BANNER_ART), ...GUN_ART_IDS.map(gunArtUrl)])];
  return Promise.all(
    all.map((src) => decode(src, src === ART.logo ? 'high' : 'low'))
  ).then(() => undefined);
}
