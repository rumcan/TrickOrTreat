import headings from './generated-art.json';

export type HeadingId = keyof typeof headings;
export const generatedArtUrl = (file: string) => `${import.meta.env.BASE_URL}images/generated-v2/${file}`;
const labels: Record<string, HeadingId> = {
  'choose your kid':'choose-kid', 'talent constellations':'talents', 'trick or treat':'trick-or-treat',
  'your run build':'run-build', 'treats & trades':'shop', 'how to play':'how-to-play',
  'friends & shared guns':'friends', 'controls':'controls', 'pick a treat':'pick-treat',
  'boss down':'boss-down', 'checkpoint kit':'checkpoint', 'you survived':'survived',
  'pinball wizard':'pinball-wizard', 'mixtape side a':'mixtape', 'eye of the tiger':'eye-tiger',
};
export function headingIdForText(text: string): HeadingId | undefined {
  return labels[text.toLowerCase().replace(/[!?,]/g,'').replace(/\s+/g,' ').trim()];
}
export function HeadingArt({ name, text }: { name: HeadingId; text: string }) {
  const art = headings[name];
  const mobile = 'mobile' in art ? art.mobile : undefined;
  return <span className={`illustrated-heading illustrated-heading--${name}`} data-heading={name}>
    <picture>
      {mobile && <source media="(max-width: 700px)" srcSet={generatedArtUrl(mobile.file)} />}
      <img src={generatedArtUrl(art.file)} alt="" aria-hidden="true" width={art.width} height={art.height} decoding="async" draggable={false} />
    </picture>
    <span className="sr-only">{text}</span>
  </span>;
}
export function TreatName({ name }: { name: string }) {
  return <>{name}</>;
}
export const generatedHeadingUrls = Object.values(headings).flatMap(art => [generatedArtUrl(art.file), ...('mobile' in art ? [generatedArtUrl(art.mobile.file)] : [])]);
