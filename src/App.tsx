import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, Input, HudSnap } from './game/engine';
import { Renderer } from './game/render';
import { preloadAll } from './game/preload';
import { loadSave, storeSave, Save } from './game/data';
import { Hud } from './ui/Hud';
import { LogoImg } from './ui/kit';
import { ART, preloadUiArt } from './ui/art';
import { Title, CharSelect, LevelUp, Shop, Pause, EndScreen } from './ui/Menus';
import { TalentTree } from './ui/TalentTree';
import { Atlas } from './ui/Atlas';

type Screen = 'loading' | 'title' | 'chars' | 'talents' | 'atlas' | 'game';

function GameView({ save, onExit, onTalents }: { save: Save; onExit: () => void; onTalents: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<HudSnap | null>(null);
  const [runId, setRunId] = useState(0);
  const [, setTick] = useState(0);

  useEffect(() => {
    const cv = canvasRef.current!;
    const input = new Input(cv);
    const game = new Game(save.hero, save, input);
    const renderer = new Renderer(cv, save.hero);
    gameRef.current = game;
    if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) (window as unknown as { __tot: unknown }).__tot = { game, renderer };
    let raf = 0, last = performance.now(), hudT = 0;
    // while a menu covers the game, the scene is frozen: draw it once, then stop (resizes still redraw)
    let frozen = false, lastState = game.state, cw = 0, ch = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      game.update(dt);
      const playing = game.state === 'play';
      if (playing || !frozen || cv.clientWidth !== cw || cv.clientHeight !== ch) {
        renderer.render(game, playing ? dt : 0.0001);
        frozen = !playing;
        cw = cv.clientWidth;
        ch = cv.clientHeight;
      }
      hudT += dt;
      if ((playing && hudT > 0.08) || game.state !== lastState) {
        hudT = 0;
        lastState = game.state;
        setSnap(game.snapshot());
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      input.destroy();
    };
  }, [runId, save]);

  const g = gameRef.current;
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const closeShop = useCallback(() => {
    const gg = gameRef.current;
    if (gg && gg.state === 'shop') gg.closeShop();
    refresh();
  }, [refresh]);
  const restart = useCallback(() => setRunId((n) => n + 1), []);

  return (
    <div className="absolute inset-0 cursor-none bg-black">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {g && snap && <Hud s={snap} game={g} />}
      {g && snap?.state === 'levelup' && <div className="cursor-auto"><LevelUp game={g} onDone={refresh} /></div>}
      {g && snap?.state === 'shop' && <div className="cursor-auto"><Shop game={g} onClose={closeShop} /></div>}
      {g && snap?.state === 'pause' && (
        <div className="cursor-auto">
          <Pause game={g} onResume={() => { g.state = 'play'; refresh(); }} onRestart={restart} onQuit={() => { g.endRun(false); refresh(); }} />
        </div>
      )}
      {g && (snap?.state === 'dead' || snap?.state === 'victory') && (
        <div className="cursor-auto">
          <EndScreen game={g} onAgain={restart} onTitle={onExit} onTalents={onTalents} onContinue={() => { g.continueEndless(); refresh(); }} />
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('loading');
  const [prog, setProg] = useState({ p: 0, label: 'Waking up the dead…' });
  const [save, setSave] = useState<Save>(() => loadSave());

  useEffect(() => {
    Promise.all([preloadAll((p, label) => setProg({ p, label })), preloadUiArt()]).then(() => {
      setScreen('title');
      // ?export: lets scripts/export-art.mjs pull PNGs of the procedural art
      if (new URLSearchParams(location.search).has('export')) import('./game/exportArt').then((m) => Object.assign(window, { __totExport: m.exportArt, __totRegen: m.exportRegen }));
    });
  }, []);

  const setHero = (h: number) => {
    const s = { ...save, hero: h };
    storeSave(s);
    setSave(s);
  };
  const reloadSave = () => setSave(loadSave());
  const toTitle = () => { reloadSave(); setScreen('title'); };

  if (screen === 'loading') {
    return (
      <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#0e0f13] text-[#f2e6c9]">
        <img src={ART.keyart} alt="" className="absolute inset-0 h-full w-full object-cover object-bottom opacity-35" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0f13] via-[#0e0f13]/50 to-[#0e0f13]/80" />
        <div className="relative flex flex-col items-center px-6">
          <LogoImg className="kit-bob w-[min(620px,86vw)]" />
          <div className="mt-8 h-4 w-[min(380px,80vw)] border-[1.5px] border-black bg-[#1c1e24] shadow-[0_0_0_1px_rgba(255,255,255,0.1),inset_0_2px_4px_rgba(0,0,0,0.7)]">
            <div className="h-full origin-left bg-[#fb8016] shadow-[inset_0_-3px_0_rgba(0,0,0,0.25),inset_0_2px_0_rgba(255,255,255,0.25)]" style={{ transform: `scaleX(${prog.p})` }} />
          </div>
          <div className="mt-2.5 font-cond2 text-xs font-bold uppercase tracking-[0.2em] text-[#9aa0a6]">{prog.label}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0e0f13]">
      {screen === 'title' && <Title save={save} onPlay={() => setScreen('game')} onTalents={() => setScreen('talents')} onAtlas={() => setScreen('atlas')} onChars={() => setScreen('chars')} />}
      {screen === 'chars' && <CharSelect save={save} setHero={setHero} onBack={toTitle} onPlay={() => setScreen('game')} />}
      {screen === 'talents' && <TalentTree save={save} onBack={toTitle} />}
      {screen === 'atlas' && <Atlas onBack={toTitle} />}
      {screen === 'game' && <GameView save={save} onExit={toTitle} onTalents={() => { reloadSave(); setScreen('talents'); }} />}
    </div>
  );
}
