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

function Stick({ label, kind, onVector }: { label: string; kind: 'move' | 'aim'; onVector: (x: number, y: number) => void }) {
  const surface = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const vectorCallback = useRef(onVector);
  vectorCallback.current = onVector;
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const reset = () => {
    const id = pointer.current;
    pointer.current = null;
    vectorCallback.current(0, 0);
    setKnob({ x: 0, y: 0 });
    if (id !== null && surface.current?.hasPointerCapture(id)) surface.current.releasePointerCapture(id);
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
      // Do not let an unmounted menu/run leave a held movement or fire vector.
      vectorCallback.current(0, 0);
    };
  }, []);
  const move = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (pointer.current !== event.pointerId) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const radius = bounds.width * 0.34;
    const dx = event.clientX - (bounds.left + bounds.width / 2);
    const dy = event.clientY - (bounds.top + bounds.height / 2);
    const length = Math.hypot(dx, dy) || 1;
    const scale = Math.min(1, radius / length);
    setKnob({ x: dx * scale, y: dy * scale });
    const vector = stickVector(dx, dy, radius);
    vectorCallback.current(vector.x, vector.y);
  };
  const end = (event: ReactPointerEvent<HTMLDivElement>) => { if (pointer.current === event.pointerId) reset(); };
  return <div className={`touch-stick touch-stick--${kind}`} ref={surface} role="group" aria-label={label} data-testid={`touch-${kind}`}
    onPointerDown={event => {
      if (pointer.current !== null || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault(); pointer.current = event.pointerId;
      event.currentTarget.setPointerCapture(event.pointerId);
      move(event);
    }} onPointerMove={move} onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
    <span className="touch-stick-label">{kind === 'move' ? 'MOVE' : 'AIM / FIRE'}</span>
    <span className="touch-stick-cross" />
    <span className="touch-stick-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
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
    <Stick kind="move" label="Move joystick" onVector={(x, y) => input.setTouchMove(x, y)} />
    <Stick kind="aim" label="Aim and fire joystick" onVector={(x, y) => input.setTouchAim(x, y)} />
    <div className="touch-actions">
      <button type="button" className="touch-action touch-action--interact" aria-label="Interact" disabled={!interact || !!s.tot} {...buttonPress(() => action('e'))}><DoorOpen size={20} /><span>{s.turret ? 'Climb down' : s.rescue ? 'Revive' : 'Interact'}</span></button>
      <button type="button" className="touch-action" aria-label="Reload weapon" disabled={!s.weapons[s.cur] || !!s.tot} {...buttonPress(() => action('r'))}><RotateCw size={20} /><span>Reload</span></button>
      <button type="button" className="touch-action touch-action--skill" aria-label="Use hero skill" disabled={s.skillCd > 0 || !!s.tot} {...buttonPress(() => action('f'))}><Zap size={20} /><span>{s.skillCd > 0 ? `${Math.ceil(s.skillCd)}s` : 'Skill'}</span></button>
      <button type="button" className="touch-action touch-action--dash" aria-label={s.tot ? 'Flee doorstep' : 'Dash'} disabled={!s.tot && !s.turret && s.dashCharges <= 0} {...buttonPress(() => action(' '))}><Wind size={20} /><span>{s.tot ? 'Flee' : 'Dash'}</span></button>
    </div>
    {(s.interact || s.rescue || s.tot) && <div className="touch-context" role="status">{s.tot ? 'Waiting for treats. Tap Flee to escape.' : s.rescue?.label || s.interact}</div>}
    {s.time < 12 && !s.interact && !s.rescue && !s.tot && <div className="touch-context touch-help">Move with your left thumb. Aim with your right. Auto-fire is on.</div>}
  </div>;
}
