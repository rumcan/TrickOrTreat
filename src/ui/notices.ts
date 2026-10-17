export type NoticeArt = 'weapon' | 'died' | 'level' | 'tot' | 'mission' | 'boss' | 'survived' | 'map';
export const noticeArtUrl = (name: NoticeArt, emblem = false) => `${import.meta.env.BASE_URL}images/generated-v3/${emblem ? 'emblem' : 'notice'}-${name}.png`;
export const noticeArtUrls = (['weapon','died','level','tot','mission','boss','survived','map'] as const).flatMap(name => [noticeArtUrl(name),noticeArtUrl(name,true)]);
export function noticeForTitle(title: string): NoticeArt | undefined {
  if (/^new weapon!?$/i.test(title)) return 'weapon';
  if (/^you died[!.]?$/i.test(title)) return 'died';
  if (/^level up!?$/i.test(title)) return 'level';
  if (/^trick or treat/i.test(title)) return 'tot';
  if (/^mission complete!?$/i.test(title)) return 'mission';
  if (/^boss down!?$/i.test(title)) return 'boss';
  if (/^you survived!?$/i.test(title)) return 'survived';
}
