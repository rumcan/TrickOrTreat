const base = import.meta.env.BASE_URL || './';
const guns = new Set(['pea', 'nerf', 'shotgun', 'roman', 'soaker', 'balloon', 'rocket', 'laser', 'slingshot', 'gloom', 'marshmallow', 'bubblegum', 'acorn']);

/** Card-only artwork. Gameplay and HUD continue to use the lightweight sprite atlas. */
export function WeaponCardArt({ id, alt = '', className = '', small = false }: { id: string; alt?: string; className?: string; small?: boolean }) {
  if (!guns.has(id)) return null;
  const url = (width: number) => `${base}images/weapon-cards/${id}-v1-${width}.webp`;
  return <img src={url(480)} srcSet={`${url(480)} 480w, ${url(960)} 960w`} sizes={small ? '180px' : '(max-width: 640px) 90vw, 340px'}
    width={1536} height={1024} alt={alt} draggable={false} loading="lazy" decoding="async" fetchPriority="low"
    data-weapon-card-art={id} className={`weapon-card-art ${className}`} />;
}
