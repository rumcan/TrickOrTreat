import { ART } from './art';

/** Choose the supplied composition by aspect ratio, not just screen width. */
export function SplashArt({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return <picture>
    <source media="(orientation: portrait)" srcSet={ART.keyartPortrait} />
    <img src={ART.keyart} alt="" draggable={false} data-testid="splash-art" className={`absolute inset-0 h-full w-full object-cover object-bottom ${className}`} style={style} />
  </picture>;
}
