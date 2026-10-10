import { useCallback, useEffect, useRef, useState } from 'react';
import { Game, Input, HudSnap } from './game/engine';
import { Renderer } from './game/render';
import { preloadAll } from './game/preload';
import { loadSave, storeSave, Save } from './game/data';
import { Hud } from './ui/Hud';
import { LogoImg } from './ui/kit';
import { preloadUiArt } from './ui/art';
import { Title, CharSelect, LevelUp, Shop, Pause, EndScreen } from './ui/Menus';
import { TalentTree } from './ui/TalentTree';
import { Atlas } from './ui/Atlas';
import { WeaponInspect } from './ui/Inspect';
import { RunInventory } from './ui/RunInventory';
import RadioPill from './ui/RadioPill';
import { radio } from './game/sound/radio';
import { gameAudio } from './game/audio';
import { expansion, hasFullGame } from './game/expansion';
import { HERO_INFO } from './game/data';
import { SplashArt } from './ui/SplashArt';
import { TouchControls, useTouchMode } from './ui/TouchControls';
import { VendingMachine } from './ui/VendingMachine';
import { requestMobileFullscreen, requestGameFullscreen } from './ui/fullscreen';
import { Maximize } from 'lucide-react';

type Screen = 'loading' | 'title' | 'chars' | 'talents' | 'atlas' | 'game';

function GameView({ save, campaign, onExit, onTalents }: { save: Save; campaign: boolean; onExit: () => void; onTalents: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [snap, setSnap] = useState<HudSnap | null>(null);
  const [runId, setRunId] = useState(0);
  const [, setTick] = useState(0);
  const touchMode = useTouchMode();
  useEffect(() => { radio.setScene(snap?.state === 'intro' ? 'story' : snap?.state === 'dead' || snap?.state === 'victory' ? 'results' : 'race'); }, [snap?.state]);

  useEffect(() => {
    const cv = canvasRef.current!;
    const input = new Input(cv);
    const game = new Game(save.hero, save, input, campaign);
    const renderer = new Renderer(cv, game.hero);
    gameRef.current = game;
    if ((import.meta as unknown as { env: { DEV: boolean } }).env.DEV) (window as unknown as { __tot: unknown }).__tot = { game, renderer };
    let raf = 0, last = performance.now(), hudT = 0;
    // while a menu covers the game, the scene is frozen: draw it once, then stop (resizes still redraw)
    let frozen = false, lastState = game.state, cw = 0, ch = 0;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - last) / 1000);
      last = t;
      game.update(dt);
      const playing = ['play', 'intro', 'downed'].includes(game.state);
      if (!playing) input.clearTouch();
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
  }, [runId, save, campaign]);

  const g = gameRef.current;
  const refresh = useCallback(() => setTick((n) => n + 1), []);
  const closeShop = useCallback(() => {
    const gg = gameRef.current;
    if (gg && gg.state === 'shop') gg.closeShop();
    refresh();
  }, [refresh]);
  const restart = useCallback(() => { requestMobileFullscreen(); setRunId((n) => n + 1); }, []);

  return (
    <div className={`ingame absolute inset-0 cursor-none bg-black ${touchMode ? 'touch-game' : ''}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full game-canvas" onPointerDown={event => { if (event.pointerType === 'touch') event.preventDefault(); }} />
      {g && snap && <Hud s={snap} game={g} />}
      {touchMode && g && snap && <TouchControls key={runId} game={g} s={snap} />}
      {g && snap?.state === 'intro' && <div className="absolute inset-0 flex items-end justify-center p-6 pb-36"><div className="kit-panel max-w-xl rounded-xl p-5 text-center text-[#f2e6c9]"><div className="font-cond text-xl text-[#ffc453]">{HERO_INFO[g.introText.hero].name}</div><p className="mt-2 text-xl">{g.introText.text}</p><button className="mt-4 min-h-11 text-sm text-white cursor-auto" onClick={() => { g.introTime = 18; }}>{touchMode ? 'Skip intro' : 'Space / Enter · skip intro'}</button></div></div>}
      {g && snap?.state === 'levelup' && <div className="cursor-auto"><LevelUp game={g} onDone={refresh} /></div>}
      {g && snap?.state === 'inspect' && <div className="cursor-auto"><WeaponInspect game={g} onDone={refresh} /></div>}
      {g && snap?.state === 'shop' && <div className="cursor-auto"><Shop game={g} onClose={closeShop} /></div>}
      {g && snap?.state === 'vending' && <div className="cursor-auto"><VendingMachine game={g} onDone={refresh} /></div>}
      {g && snap?.state === 'pause' && (
        <div className="cursor-auto">
          <Pause game={g} onResume={() => { g.state = 'play'; refresh(); }} onRestart={restart} onQuit={() => { g.endRun(false); refresh(); }} />
        </div>
      )}
      {g && snap?.state === 'inventory' && <div className="cursor-auto"><RunInventory game={g} onClose={() => { g.state = 'play'; refresh(); }} /></div>}
      {g && (snap?.state === 'dead' || snap?.state === 'victory') && (
        <div className="absolute inset-0 z-40 cursor-auto">
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
  const [campaign, setCampaign] = useState(false);
  useEffect(() => { void expansion.restore(); }, []);
  const start = (rescue: boolean) => { if (rescue && !hasFullGame()) return; requestMobileFullscreen(); if (save.hero >= 3 && !hasFullGame()) setSave({ ...save, hero: 0 }); setCampaign(rescue); setScreen('game'); };

  useEffect(() => {
    const unlock = (event: Event) => {
      gameAudio.unlock(); radio.unlock();
      if (event.type === 'pointerdown' && event.target instanceof Element && event.target.closest('button')) gameAudio.play('click', 0.25);
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => { window.removeEventListener('pointerdown', unlock); window.removeEventListener('keydown', unlock); };
  }, []);

  useEffect(() => { radio.setScene(screen === 'game' ? 'race' : 'menu'); }, [screen]);

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
      <div className="game-shell relative flex w-screen flex-col items-center justify-center overflow-hidden bg-[#0e0f13] text-[#f2e6c9]">
        <SplashArt className="opacity-35" />
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
    <div className="game-shell relative w-screen overflow-hidden bg-[#0e0f13]">
      {screen !== 'game' && <header className="absolute left-3 top-3 z-50 sm:left-5 sm:top-4"><RadioPill compact /></header>}
      {screen !== 'game' && <button className="menu-fullscreen" aria-label="Fullscreen" title="Fullscreen" onClick={() => requestGameFullscreen(true)}><Maximize size={18} /></button>}
      {screen === 'title' && <Title save={save} setHero={setHero} onPlay={() => start(hasFullGame())} onCampaign={() => start(true)} onTalents={() => setScreen('talents')} onAtlas={() => setScreen('atlas')} onChars={() => setScreen('chars')} />}
      {screen === 'chars' && <CharSelect save={save} setHero={setHero} onBack={toTitle} onPlay={() => start(hasFullGame())} />}
      {screen === 'talents' && <TalentTree save={save} onBack={toTitle} />}
      {screen === 'atlas' && <Atlas onBack={toTitle} />}
      {screen === 'game' && <GameView save={save} campaign={campaign} onExit={toTitle} onTalents={() => { reloadSave(); setScreen('talents'); }} />}
    </div>
  );
}
