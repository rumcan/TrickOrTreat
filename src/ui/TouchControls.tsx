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
 * invisible stick; the kid aims and fires on their own. A SECOND finger anywhere on the play area takes over the aim:
 * the kid shoots toward that finger for as long as it is held, exactly like holding the mouse button there. There is
 * nothing to see for it. Two fingers spreading apart or pinching together right after the second one lands zoom the view
 * instead (the kid stops while you zoom). Sits under the HUD, so buttons keep working.
 */
export function TouchMoveSurface({ game, enabled }: { game: Game; enabled: boolean }) {
  const input = game.input;
  const pointer = useRef<number | null>(null);
  const aimer = useRef<number | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  // a quick touch that never became a drag is a tap: it does what the Interact button does
  const press = useRef({ x: 0, y: 0, at: 0, moved: 0 });
  const [stick, setStick] = useState<{ x: number; y: number; dx: number; dy: number } | null>(null);
  /** where each finger is, and the pinch in progress (null = none; 'maybe' = second finger just landed) */
  const fingers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<null | { state: 'maybe' | 'zoom'; d0: number; z0: number; at: number }>(null);
  const spread = () => { const [a, b] = [...fingers.current.values()]; return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0; };
  const stopAim = () => { if (aimer.current !== null) { aimer.current = null; input.mdown = false; } };
  const reset = () => { pointer.current = null; input.setTouchMove(0, 0); setStick(null); stopAim(); };
  /** the second finger is the mouse: where it is, is where the kid shoots */
  const aimAt = (event: ReactPointerEvent<HTMLDivElement>) => {
    const box = (document.querySelector('canvas.game-canvas') ?? event.currentTarget).getBoundingClientRect();
    input.mx = event.clientX - box.left; input.my = event.clientY - box.top;
    input.mdown = true; input.touchActive = true; input.mouseActive = false;
  };
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
    if (fingers.current.has(event.pointerId)) fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const p = pinch.current;
    if (p && fingers.current.size >= 2) {
      const d = spread();
      // the fingers moving apart or together soon after the second one lands is a pinch, not aiming
      if (p.state === 'maybe' && Math.abs(d - p.d0) > 28 && performance.now() - p.at < 450) {
        p.state = 'zoom'; p.d0 = d; p.z0 = game.userZoom; stopAim(); input.setTouchMove(0, 0); setStick(null);
      }
      if (p.state === 'zoom') { event.preventDefault(); game.userZoom = Math.max(0.85, Math.min(1.6, p.z0 * d / (p.d0 || 1))); return; }
    }
    if (aimer.current === event.pointerId) { event.preventDefault(); aimAt(event); return; }
    if (pointer.current !== event.pointerId) return;
    event.preventDefault();
    press.current.moved = Math.max(press.current.moved, Math.hypot(event.clientX - press.current.x, event.clientY - press.current.y));
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
    setStick({ ...origin.current, dx: dx * scale * 0.5, dy: dy * scale * 0.5 }); // the knob stays inside its small ring
  };
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    fingers.current.delete(event.pointerId);
    if (pinch.current?.state === 'zoom') {
      // a finished pinch never turns into a tap, a drag or a shot: start fresh once the fingers are off
      if (fingers.current.size === 0) pinch.current = null;
      if (pointer.current === event.pointerId) pointer.current = null;
      if (aimer.current === event.pointerId) aimer.current = null;
      input.setTouchMove(0, 0); setStick(null); return;
    }
    if (fingers.current.size < 2) pinch.current = null;
    if (aimer.current === event.pointerId) { stopAim(); return; }
    if (pointer.current !== event.pointerId) return;
    // New players tap the door, the bag or the gun itself, not a button at the bottom of the screen. When something
    // is in reach (the prompt is showing), a tap anywhere on the play area is "interact".
    const tap = event.type === 'pointerup' && performance.now() - press.current.at < 350 && press.current.moved < 14;
    reset();
    if (tap && (game.interact || game.mounted >= 0 || (game.rescuePrompt && !/Defeat/.test(game.rescuePrompt))) && !game.tot) { input.touchActive = true; input.mouseActive = false; input.tap('e'); }
  };
  return <div className="touch-surface" role="group" aria-label="Drag anywhere to move" data-testid="touch-move"
    onPointerDown={event => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (pointer.current !== null) {
        // a second finger while the first one steers: aim and fire toward it
        if (aimer.current !== null || event.pointerType === 'mouse') return;
        event.preventDefault();
        fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        pinch.current = { state: 'maybe', d0: spread(), z0: game.userZoom, at: performance.now() };
        aimer.current = event.pointerId;
        event.currentTarget.setPointerCapture(event.pointerId);
        press.current.moved = 99; // two fingers down is never a tap
        aimAt(event);
        return;
      }
      event.preventDefault();
      if (game.bigMap) { game.bigMap = false; return; } // a tap on the open map puts it away
      pointer.current = event.pointerId;
      fingers.current.clear(); fingers.current.set(event.pointerId, { x: event.clientX, y: event.clientY }); pinch.current = null;
      press.current = { x: event.clientX, y: event.clientY, at: performance.now(), moved: 0 };
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
      <button type="button" className={`touch-action touch-action--interact${interact && !s.tot ? ' touch-action--ready' : ''}`} aria-label="Interact" disabled={!interact || !!s.tot} {...buttonPress(() => action('e'))}><DoorOpen size={20} /><span>{s.turret ? 'Climb down' : s.rescue ? 'Revive' : 'Interact'}</span></button>
      <button type="button" className="touch-action" aria-label="Reload weapon" disabled={!s.weapons[s.cur] || !!s.tot} {...buttonPress(() => action('r'))}><RotateCw size={20} /><span>Reload</span></button>
      <button type="button" className="touch-action touch-action--skill" aria-label="Use hero skill" disabled={s.skillCd > 0 || !!s.tot} {...buttonPress(() => action('f'))}><Zap size={20} /><span>{s.skillCd > 0 ? `${Math.ceil(s.skillCd)}s` : 'Skill'}</span></button>
      <button type="button" className="touch-action touch-action--dash" aria-label={s.tot ? 'Flee doorstep' : 'Dash'} disabled={!s.tot && !s.turret && s.dashCharges <= 0} {...buttonPress(() => action(' '))}><Wind size={20} /><span>{s.tot ? 'Flee' : 'Dash'}</span></button>
    </div>
    {(s.interact || s.rescue || s.tot) && <div className="touch-context" role="status">{s.tot ? 'Waiting for treats. Tap Flee to escape.' : `Tap the screen: ${s.rescue?.label || s.interact}`}</div>}
    {s.time < 12 && !s.interact && !s.rescue && !s.tot && <div className="touch-context touch-help">Drag anywhere to move. Your kid aims and fires automatically.</div>}
  </div>;
}
