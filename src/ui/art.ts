// UI artwork cut from the concept sheets in art/concept (see scripts/crop-ui-kit.py).
const base = (import.meta as unknown as { env: { BASE_URL: string } }).env.BASE_URL || './';
const img = (p: string) => `${base}images/${p}`;

export const ART = {
  keyart: img('splash.webp'),
  keyartPortrait: img('splash_portrait.webp'),
  logo: img('logo.webp'),
  logoSm: img('logo_sm.webp'),
  kitLogo: img('ui/kit_logo.webp'),
  pause: img('ui/pause_art.webp'),
  infoPumpkin: img('ui/info_pumpkin.webp'),
  skillPumpkin: img('ui/skill_pumpkin.webp'),
};

/** per hero (HERO_INFO order): tall card portrait and round HUD face */
export const PORTRAITS = ['tommy', 'sam', 'jess', 'maya', 'leo'].map(k => img(`ui/portrait_${k}.webp`));
export const FACES = [...['tommy', 'sam', 'jess'].map((k) => img(`ui/face_${k}.webp`)), ...['maya', 'leo'].map(k => img(`ui/portrait_${k}.webp`))];
/** frame colour per hero (matches the portrait backgrounds) */
export const HERO_COLORS = ['#e8432f', '#2fb6c4', '#8a4fd8', '#d49a39', '#368e8b'];

export type BannerKind = 'mission' | 'died' | 'level' | 'weapon' | 'tot';
export const BANNER_ART: Record<BannerKind, string> = {
  mission: img('ui/banner_mission.webp'),
  died: img('ui/banner_died.webp'),
  level: img('ui/banner_level.webp'),
  weapon: img('ui/banner_weapon.webp'),
  tot: img('ui/banner_tot.webp'),
};

/** Decode every UI image up front so plates and portraits never pop in mid-game. */
export function preloadUiArt() {
  const all = [...Object.values(ART), ...PORTRAITS, ...FACES, ...Object.values(BANNER_ART)];
  return Promise.all(
    all.map((src) => {
      const im = new Image();
      im.src = src;
      return im.decode().catch(() => undefined);
    })
  ).then(() => undefined);
}
