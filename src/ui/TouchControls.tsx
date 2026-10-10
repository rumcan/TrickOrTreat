import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { DoorOpen, RotateCw, Wind, Zap } from 'lucide-react';
import type { Game, HudSnap } from '../game/engine';
import { stickVector } from '../game/touch-input';
import { buttonPress } from './button-press';

export function useTouchMode() {
  const detect = () => window.matchMedia('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && window.innerWidth <= 900);
  const [touch, setTouch] = useState(detect);
  useEffect(() => {
    const media = window.matchMedia('(pointer: coarse)');
    const update = () => setTouch(detect());
    const touched = (event: PointerEvent) => {
      if (event.pointerType === 'touch' && event.target instanceof Element && event.target.closest('.ingame')) setTouch(true);
    };
    media.addEventListener('change', update);
    window.addEventListener('resize', update);
    window.addEventListener('pointerdown', touched, true);
    return () => {
      media.removeEventListener('change', update);
      window.removeEventListener('resize', update);
      window.removeEventListener('pointerdown', touched, true);
    };
  }, []);
  return touch;
}

/** how far (px) the finger travels from where it landed for full speed */
const DRAG_RADIUS = 56;

/**
 * Movement on a phone: put a finger down anywhere on the play area and drag. Where it lands is the centre of an
 * invisible stick; the kid aims and fires on their own. Sits under the HUD, so buttons keep working.
 */
export function TouchMoveSurface({ game, enabled }: { game: Game; enabled: boolean }) {
  const input = game.input;
  const pointer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  const reset = () => { pointer.current = null; input.setTouchMove(0, 0); setStick(null); };
  useEffect(() => {
    const hidden = () => { if (document.hidden) reset(); };
    window.addEventListener('blur', reset);
    window.addEventListener('orientationchange', reset);
    window.addEventListener('resize', reset);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('blur', reset);
      window.removeEventListener('orientationchange', reset);
      window.removeEventListener('resize', reset);
      document.removeEventListener('visibilitychange', hidden);
      // Do not let an unmounted menu/run leave a held movement vector.
      input.setTouchMove(0, 0);
    };
  }, [input]);
  useEffect(() => { if (!enabled) reset(); }, [enabled]);
  if (!enabled) return null;
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId) return;
    event.preventDefault();
    let dx = event.clientX - origin.current.x, dy = event.clientY - origin.current.y;
    const length = Math.hypot(dx, dy);
    // a long drag pulls the centre along, so turning around never needs the finger to travel all the way back
    if (length > DRAG_RADIUS * 1.5) {
      const pull = (length - DRAG_RADIUS * 1.5) / length;
      origin.current = { x: origin.current.x + dx * pull, y: origin.current.y + dy * pull };
      dx = event.clientX - origin.current.x; dy = event.clientY - origin.current.y;
    }
    const vector = stickVector(dx, dy, DRAG_RADIUS);
    input.setTouchMove(vector.x, vector.y);
    const scale = Math.min(1, DRAG_RADIUS / (Math.hypot(dx, dy) || 1));
    setStick({ ...origin.current, dx: dx * scale, dy: dy * scale });
  };
  const end = (event: ReactPointerEvent<HTMLDivElement>) => { if (pointer.current === event.pointerId) reset(); };
  return <div className="touch-surface" role="group" aria-label="Drag anywhere to move" data-testid="touch-move"
    onPointerDown={event => {
      if (pointer.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      if (game.bigMap) { game.bigMap = false; return; } // a tap on the open map puts it away
      pointer.current = event.pointerId;
      origin.current = { x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
      input.setTouchMove(0, 0);
      setStick({ ...origin.current, dx: 0, dy: 0 });
    }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
    {stick && <span className="touch-drag" style={{ left: stick.x, top: stick.y }} aria-hidden="true"><i style={{ transform: `translate(${stick.dx}px, ${stick.dy}px)` }} /></span>}
  </div>;
}

export function TouchControls({ game, s }: { game: Game; s: HudSnap }) {
  const input = game.input;
  const enabled = s.state === 'play';
  useEffect(() => {
    input.touchActive = true; input.mouseActive = false;
    if (!enabled) input.clearTouch();
    return () => input.clearTouch();
  }, [input, enabled]);
  if (!enabled) return null;
  const interact = !!s.interact || !!s.turret || (!!s.rescue && !s.rescue.downed && !/Defeat/.test(s.rescue.label));
  const action = (key: string) => { input.touchActive = true; input.mouseActive = false; input.tap(key); };
  return <div className="touch-controls" aria-label="Touch game controls">
    <div className="touch-actions">
      <button type="button" className="touch-action touch-action--interact" aria-label="Interact" disabled={!interact || !!s.tot} {...buttonPress(() => action('e'))}><DoorOpen size={20} /><span>{s.turret ? 'Climb down' : s.rescue ? 'Revive' : 'Interact'}</span></button>
      <button type="button" className="touch-action" aria-label="Reload weapon" disabled={!s.weapons[s.cur] || !!s.tot} {...buttonPress(() => action('r'))}><RotateCw size={20} /><span>Reload</span></button>
      <button type="button" className="touch-action touch-action--skill" aria-label="Use hero skill" disabled={s.skillCd > 0 || !!s.tot} {...buttonPress(() => action('f'))}><Zap size={20} /><span>{s.skillCd > 0 ? `${Math.ceil(s.skillCd)}s` : 'Skill'}</span></button>
      <button type="button" className="touch-action touch-action--dash" aria-label={s.tot ? 'Flee doorstep' : 'Dash'} disabled={!s.tot && !s.turret && s.dashCharges <= 0} {...buttonPress(() => action(' '))}><Wind size={20} /><span>{s.tot ? 'Flee' : 'Dash'}</span></button>
    </div>
    {(s.interact || s.rescue || s.tot) && <div className="touch-context" role="status">{s.tot ? 'Waiting for treats. Tap Flee to escape.' : s.rescue?.label || s.interact}</div>}
    {s.time < 12 && !s.interact && !s.rescue && !s.tot && <div className="touch-context touch-help">Drag anywhere to move. Your kid aims and fires automatically.</div>}
  </div>;
}
