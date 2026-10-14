import { ART } from './art';

/** Choose the supplied composition by aspect ratio, not just screen width. */
export function SplashArt({ className = '', style, boot }: { className?: string; style?: React.CSSProperties; boot?: boolean }) {
  return <picture>
    <source media="(orientation: portrait)" srcSet={ART.keyartPortrait} />
    <img src={ART.keyart} alt="" draggable={false} fetchPriority={boot ? 'high' : 'low'} decoding="async" data-testid="splash-art" className={boot ? `boot-bg is-ready ${className}` : `absolute inset-0 h-full w-full object-cover object-bottom ${className}`} style={style} />
  </picture>;
}
