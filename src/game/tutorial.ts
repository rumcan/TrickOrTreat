// The starting tutorial: Professor Fizz talks the kid through the first night on a walkie-talkie. Three stops, each
// reached along the same dotted route as the first door: a house (trick or treat), the candy machine (a free spin)
// and the shop (a free gun upgrade). The night waits meanwhile: no clock, no monsters.
//
// This file is the lesson plan only. The engine asks it what is free and where the guide should lead; the walkie
// (src/ui/Walkie.tsx) plays what it says. Nothing here waits for sound: a silent player still gets every step.
import * as storage from './storage';
import script from './tutorial-lines.json';
import type { Game } from './engine';

export const TUTORIAL_KEY = 'tot_tutorial_v1';
export const WALKIE_SPEAKER = script.speaker;
export type WalkieLine = keyof typeof script.lines;
export const WALKIE_LINES: Record<WalkieLine, string> = script.lines;
export type TutorialStep = 'treat' | 'machine' | 'shop' | 'done';
/** the stop each line belongs to: a line about an earlier stop is cut short when the kid has moved on */
export const LINE_STEP: Record<WalkieLine, TutorialStep> = { hello: 'treat', treat: 'treat', bowl: 'treat', machine: 'machine', spin: 'machine', shop: 'shop', upgrade: 'shop', bye: 'done' };
/** what the walkie shows between lines: the thing to do right now */
export const STEP_GOAL: Record<TutorialStep, string> = {
  treat: 'Follow the green dots to the house and ring the doorbell.',
  machine: 'Follow the dots to the candy machine. Your first spin is free.',
  shop: 'Follow the dots to the shop. One gun upgrade is free.',
  done: '',
};

/** has this player finished the tutorial, or asked never to see it? */
export function tutorialSeen() { return !!storage.getItem(TUTORIAL_KEY); }
export function rememberTutorial(how: 'done' | 'never') { storage.setItem(TUTORIAL_KEY, how); }
/** Settings: show it again on the next run */
export function forgetTutorial() { storage.setItem(TUTORIAL_KEY, ''); }
/**
 * Should a new run start with the tutorial? Not for a player who has done it or switched it off, and not under
 * browser automation (the test suites play real runs and expect the night to start at once) unless the page was
 * opened with ?tutorial.
 */
export function tutorialWanted() {
  let forced = false, automated = false;
  try { forced = new URLSearchParams(location.search).has('tutorial'); automated = navigator.webdriver === true; } catch { /* no page */ }
  return forced || (!automated && !tutorialSeen());
}

export class Tutorial {
  step: TutorialStep = 'treat';
  /** everything said so far, in order: the walkie plays them one after another */
  said: WalkieLine[] = ['hello', 'treat'];
  /** the first spin of the candy machine costs nothing (and is never a dud) */
  freeSpin = true;
  /** the first gun upgrade at the shop costs nothing */
  freeUpgrade = true;
  /** where the guide leads for the machine and shop steps: a spot the kid can stand on, next to it */
  spot: { x: number; y: number } | null = null;
  /** the night waits (no clock, no monsters) until the last step is done */
  get holding() { return this.step !== 'done'; }

  private say(line: WalkieLine) { if (!this.said.includes(line)) this.said.push(line); }
  private go(g: Game, step: TutorialStep) {
    this.step = step;
    this.spot = step === 'machine' || step === 'shop' ? g.guideSpot(step) : null;
    if (step === 'done') { this.freeSpin = this.freeUpgrade = false; this.say('bye'); rememberTutorial('done'); }
    else if (!this.spot) this.go(g, step === 'machine' ? 'shop' : 'done'); // nothing of the kind in reach on this map
    else this.say(step as 'machine' | 'shop');
  }
  /** called every frame, whatever screen is up */
  update(g: Game) {
    const s = g.state;
    if (this.step === 'treat') {
      if (s === 'levelup' && g.choiceMode === 'house') this.say('bowl');
      if (g.treatGuideComplete && s === 'play') this.go(g, 'machine');
    } else if (this.step === 'machine') {
      if (s === 'vending') this.say('spin');
      if (!this.freeSpin && s === 'play') this.go(g, 'shop');
    } else if (this.step === 'shop') {
      if (s === 'shop') this.say('upgrade');
      if (!this.freeUpgrade && s === 'play') this.go(g, 'done');
    }
  }
}
