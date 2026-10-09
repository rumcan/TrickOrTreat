import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, Input, HudSnap } from './game/engine';
import { Renderer } from './game/render';
import { preloadAll } from './game/preload';
import { loadSave, storeSave, Save } from './game/data';
import { Hud } from './ui/Hud';
import { LogoImg } from './ui/common';
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
    let raf = 0, last = performance.now(), hudT = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      game.update(dt);
      renderer.render(game, game.state === 'play' ? dt : 0.0001);
      hudT += dt;
      if (hudT > 0.08) {
        hudT = 0;
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
    preloadAll((p, label) => setProg({ p, label })).then(() => setScreen('title'));
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
      <div className="relative flex h-screen w-screen flex-col items-center justify-center overflow-hidden bg-[#0E1117] text-[#F4E8D5]">
        <div className="absolute inset-0 bg-cover bg-center opacity-40" style={{ backgroundImage: 'url(./images/title_hero.jpg)' }} />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E1117] via-[#0E1117]/60 to-[#0E1117]/80" />
        <div className="relative flex flex-col items-center px-6">
          <LogoImg className="kit-bob w-[min(520px,80vw)]" />
          <div className="mt-8 h-2.5 w-[min(340px,80vw)] overflow-hidden rounded-[3px] border border-black bg-[#171b24]">
            <div className="h-full bg-gradient-to-r from-[#7A45F2] to-[#F9781B]" style={{ width: `${prog.p * 100}%` }} />
          </div>
          <div className="mt-2 font-cond2 text-xs font-semibold uppercase tracking-widest text-[#9aa3b8]">{prog.label}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0E1117]">
      {screen === 'title' && <Title save={save} onPlay={() => setScreen('game')} onTalents={() => setScreen('talents')} onAtlas={() => setScreen('atlas')} onChars={() => setScreen('chars')} />}
      {screen === 'chars' && <CharSelect save={save} setHero={setHero} onBack={toTitle} onPlay={() => setScreen('game')} />}
      {screen === 'talents' && <TalentTree save={save} onBack={toTitle} />}
      {screen === 'atlas' && <Atlas onBack={toTitle} />}
      {screen === 'game' && <GameView save={save} onExit={toTitle} onTalents={() => { reloadSave(); setScreen('talents'); }} />}
    </div>
  );
}
