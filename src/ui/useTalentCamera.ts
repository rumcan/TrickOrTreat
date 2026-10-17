import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';

type View = { x: number; y: number; zoom: number };
type Point = { x: number; y: number };
const OVERVIEW: View = { x: 700, y: 375, zoom: 1 };
const limit = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const bounded = (v: View): View => {
  const zoom = limit(v.zoom, 1, 6), halfW = 860 / zoom, halfH = 625 / zoom;
  return { zoom, x: limit(v.x, -160 + halfW, 1560 - halfW), y: limit(v.y, -250 + halfH, 1000 - halfH) };
};
const initial = (): View => window.matchMedia('(max-width:1023px)').matches ? { x: 430, y: 410, zoom: 3.5 } : OVERVIEW;
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/** SVG camera: only the constellation handles gestures; the talent panel still scrolls normally. */
export function useTalentCamera() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [view, setView] = useState<View>(initial);
  const current = useRef(view);
  const pointers = useRef(new Map<number, Point>());
  const moved = useRef(false);
  const gesture = useRef<{ view: View; points: Point[]; inverse: DOMMatrix } | null>(null);
  const commit = (v: View) => { const next = bounded(v); current.current = next; setView(next); };
  const rebase = () => {
    const matrix = svgRef.current?.getScreenCTM();
    gesture.current = matrix && pointers.current.size ? { view: current.current, points: [...pointers.current.values()], inverse: matrix.inverse() } : null;
  };
  const world = (p: Point, inverse: DOMMatrix) => new DOMPoint(p.x, p.y).matrixTransform(inverse);
  const zoomAt = (factor: number, anchor?: Point) => {
    const old = current.current, zoom = limit(old.zoom * factor, 1, 6), point = anchor || old;
    commit({ zoom, x: point.x + (old.x - point.x) * old.zoom / zoom, y: point.y + (old.y - point.y) * old.zoom / zoom });
  };
  useEffect(() => {
    const query = window.matchMedia('(max-width:1023px)');
    const resize = () => { pointers.current.clear(); gesture.current = null; commit(initial()); };
    query.addEventListener('change', resize);
    const svg = svgRef.current;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const matrix = svg?.getScreenCTM();
      if (matrix) zoomAt(Math.exp(-event.deltaY * .0015), world({ x: event.clientX, y: event.clientY }, matrix.inverse()));
    };
    svg?.addEventListener('wheel', wheel, { passive: false });
    return () => { query.removeEventListener('change', resize); svg?.removeEventListener('wheel', wheel); };
  }, []);

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (!pointers.current.size) moved.current = false;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size > 1) moved.current = true;
    rebase();
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const start = gesture.current, now = [...pointers.current.values()];
    if (now.length >= 2 && start.points.length >= 2) {
      moved.current = true;
      const anchor = world(midpoint(start.points[0], start.points[1]), start.inverse);
      const mid = world(midpoint(now[0], now[1]), start.inverse);
      const zoom = limit(start.view.zoom * distance(now[0], now[1]) / Math.max(1, distance(start.points[0], start.points[1])), 1, 6);
      commit({ zoom, x: anchor.x + (start.view.x - mid.x) * start.view.zoom / zoom, y: anchor.y + (start.view.y - mid.y) * start.view.zoom / zoom });
    } else if (now.length === 1 && start.points.length === 1) {
      if (!moved.current && distance(now[0], start.points[0]) < 6) return;
      moved.current = true;
      const before = world(start.points[0], start.inverse), after = world(now[0], start.inverse);
      commit({ ...start.view, x: start.view.x + before.x - after.x, y: start.view.y + before.y - after.y });
    }
    if (moved.current) event.currentTarget.setPointerCapture(event.pointerId);
  };
  const finish = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    rebase();
  };
  return {
    svgRef, zoom: view.zoom,
    viewBox: `${view.x - 860 / view.zoom} ${view.y - 625 / view.zoom} ${1720 / view.zoom} ${1250 / view.zoom}`,
    zoomBy: (factor: number) => zoomAt(factor),
    fit: () => commit(OVERVIEW),
    focus: (point: Point) => commit({ ...point, zoom: Math.max(3.5, current.current.zoom) }),
    handlers: {
      onPointerDown, onPointerMove, onPointerUp: finish, onPointerCancel: finish,
      onClickCapture: (event: React.MouseEvent<SVGSVGElement>) => { if (moved.current) { event.preventDefault(); event.stopPropagation(); } },
    },
  };
}
