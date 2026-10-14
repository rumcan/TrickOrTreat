import { useEffect, useRef, useState } from 'react';
import type { Game, GameState } from '../game/engine';
import { WALKIE_LINES, WALKIE_SPEAKER, STEP_GOAL, LINE_STEP, TUTORIAL_TRACK, NIGHT_TRACK, HERE_THEY_COME } from '../game/tutorial';
import { radio } from '../game/sound/radio';
import type { WalkieLine } from '../game/tutorial';
import { speak, stopSpeaking, preloadVoice } from '../game/sound/voice';
import { ART } from './art';

/** how long a line stays up when there is no recording to time it by: reading speed, with a floor */
const readTime = (text: string) => Math.max(2.5, text.split(/\s+/).length / 2.6);

/**
 * The tutorial's walkie-talkie: it shakes while Professor Fizz talks, with his words in a speech bubble (and his
 * voice, when sound is on). Between lines the bubble shows what to do next. Two buttons end it: for this run, or
 * for good. It sits above every menu and lets clicks through everywhere but on those buttons.
 */
export function Walkie({ game, state, onChange }: { game: Game; state: GameState; onChange: () => void }) {
  const tutorial = game.tutorial;
  const [at, setAt] = useState(0); // how many lines have been played
  const [talking, setTalking] = useState<WalkieLine | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const said = tutorial?.said.length ?? 0;
  // the lesson moves on inside the game loop, also while a menu is up: look in on it a few times a second
  const [, look] = useState(0);
  useEffect(() => { const id = setInterval(() => look((n) => n + 1), 200); return () => clearInterval(id); }, []);

  useEffect(() => { preloadVoice(Object.keys(WALKIE_LINES).map((id) => `tutorial-${id}`)); }, []);
  // the lesson has its own song; the night's first song comes in on "Here they come" (or at once, if the lesson is skipped)
  useEffect(() => { radio.cue(TUTORIAL_TRACK); }, []);
  const song = useRef<ReturnType<typeof setTimeout> | null>(null);
  // the next line starts when the last one is over; the opening waits for the hide-and-seek intro to finish
  const busy = useRef(false), call = useRef(0);
  const waiting = state === 'intro' || state === 'pause';
  useEffect(() => {
    if (!tutorial || busy.current || at >= said || waiting) return;
    const line = tutorial.said[at];
    const mine = ++call.current;
    busy.current = true;
    setTalking(line);
    void speak(`tutorial-${line}`).then((seconds) => {
      if (mine !== call.current) return; // the walkie was put away (or React re-ran this in development)
      if (line === 'bye') song.current = setTimeout(() => radio.cue(NIGHT_TRACK), (seconds || readTime(WALKIE_LINES[line])) * HERE_THEY_COME * 1000);
      // a player who is ahead of the voice does not get old news: skip to the newest line that is waiting
      timer.current = setTimeout(() => { busy.current = false; setTalking(null); setAt((n) => Math.max(n + 1, tutorial.said.length - 1)); }, ((seconds || readTime(WALKIE_LINES[line])) + 0.5) * 1000);
    });
  }, [tutorial, at, said, waiting]);
  // the kid is already at the next stop: drop what is being said about the last one and say the newest thing
  useEffect(() => {
    if (!tutorial || !talking || said - 1 <= at || LINE_STEP[tutorial.said[said - 1]] === LINE_STEP[talking]) return;
    call.current++; busy.current = false;
    if (timer.current) clearTimeout(timer.current);
    stopSpeaking(); setTalking(null); setAt(said - 1);
  }, [tutorial, talking, said, at]);
  useEffect(() => () => { call.current++; busy.current = false; if (timer.current) clearTimeout(timer.current); stopSpeaking(); }, []);
  // once the goodbye has been said the walkie goes away by itself
  const over = !!tutorial && !tutorial.holding && !talking && at >= said;
  useEffect(() => { if (over) { game.skipTutorial(); onChange(); } }, [over, game, onChange]);

  if (!tutorial || over || state === 'intro' || state === 'dead' || state === 'victory') return null;
  const end = (never: boolean) => { if (timer.current) clearTimeout(timer.current); if (song.current) clearTimeout(song.current); stopSpeaking(); radio.cue(NIGHT_TRACK); game.skipTutorial(never); onChange(); };
  const text = talking ? WALKIE_LINES[talking] : state === 'play' ? STEP_GOAL[tutorial.step] : '';
  return (
    <div className={`walkie ${talking ? 'is-talking' : ''} ${state === 'play' ? '' : 'is-over-menu'}`} data-testid="walkie" data-step={tutorial.step} data-line={talking ?? ''}>
      <img className="walkie-radio" src={ART.walkie} alt="" draggable={false} />
      <div className="walkie-side">
        {text && (
          <div className="walkie-bubble" role="status" aria-live="polite">
            <div className="walkie-name">{WALKIE_SPEAKER}{talking ? '' : ' · next'}</div>
            <p>{text}</p>
          </div>
        )}
        <div className="walkie-actions">
          <button type="button" onClick={() => end(false)}>Skip tutorial</button>
          <button type="button" onClick={() => end(true)}>Never show again</button>
        </div>
      </div>
    </div>
  );
}
