import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LogoImg } from './kit';

export function LoadingIntro({ progress, label, ready, artProblem, onReady, onPlayAnyway }: {
  progress: number; label: string; ready: boolean; artProblem: boolean;
  onReady: () => void; onPlayAnyway: () => void;
}) {
  const overlay = document.getElementById('loading-overlay');
  const host = document.getElementById('boot-ui');
  const [holding, setHolding] = useState(() => overlay?.dataset.phase !== 'playing');

  useLayoutEffect(() => { document.getElementById('boot-static')?.remove(); document.getElementById('boot-static-skip')?.remove(); }, []);
  useEffect(() => {
    const sync = () => setHolding(overlay?.dataset.phase !== 'playing');
    window.addEventListener('tot:intro-held', sync);
    sync();
    return () => window.removeEventListener('tot:intro-held', sync);
  }, [overlay]);
  useEffect(() => {
    if (artProblem) overlay?.dispatchEvent(new Event('tot:skip-intro'));
  }, [artProblem, overlay]);
  useEffect(() => {
    if (!holding || !ready || artProblem) return;
    const heldAt = Number(overlay?.dataset.heldAt || performance.now());
    const delay = overlay?.dataset.skipped === 'true' ? 0 : Math.max(0, 950 - (performance.now() - heldAt));
    const timer = window.setTimeout(onReady, delay);
    return () => window.clearTimeout(timer);
  }, [holding, ready, artProblem, overlay, onReady]);

  if (!host) return null;
  const percent = Math.round(Math.max(0, Math.min(1, progress)) * 100);
  return createPortal(<>
    <div className="boot-body">
      <LogoImg className="boot-logo" />
      {artProblem ? <div className="boot-problem" role="alert">
        <div className="boot-label">The game's artwork did not finish loading. Check your connection and try again.</div>
        <div className="boot-problem-actions">
          <button className="boot-btn" onClick={() => location.reload()}>Try again</button>
          <button className="boot-btn boot-btn--quiet" onClick={onPlayAnyway}>Play anyway</button>
        </div>
      </div> : <>
        <div className="boot-progress" role="progressbar" aria-label="Loading Maple Falls" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
          <i style={{ transform: `scaleX(${progress})` }} />
        </div>
        <div className="boot-status"><span className="boot-label">{ready ? 'The night is ready' : label}</span><b>{percent}%</b></div>
      </>}
    </div>
    <button type="button" className="boot-skip" data-skip-intro>Skip intro <span aria-hidden="true">›</span></button>
  </>, host);
}
