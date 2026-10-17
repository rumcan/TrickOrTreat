import { MAP_W, MAP_H, CR, CW, CH, screenDirToWorld, screenToWorld, isoX, isoY, rand, clamp, Elem, ELEM, RARITY } from './config';
import { GameMap, cellAt, blockedCircle, lineOfSight, PropInst, HouseInst } from './map';
import { buildBuiltTown } from './town-built';
import { G } from './art/tiles';
import { buildArcadeMap } from './arcade-map';
import {ARCADE_STAFF} from './arcade-layout';
import {NEW_MONSTERS,FINAL_MONSTER,FINAL_BOSS,WAVE_BOSSES,ROSTER_NAMES,ROSTER_MINIONS,BOSS_ATTACKS,familyForWave} from './boss-roster';
import { settings } from './settings';
import { translateKey, subscribeKeybinds } from './keybind-store';
import { gameAudio } from './audio';
import { expansion, hasFullGame } from './expansion';
import * as storage from './storage';
import { Tutorial, rememberTutorial } from './tutorial';
import { leaderboard } from './leaderboard';
import type { RunRecord } from './leaderboard-service';
import { vendingCatalogue, createVendingSpin } from './vending';
import type { VendingSpin, VendingPrize } from './vending';
import { vendingCost } from './vending-odds';
import { Build, rollCrit, rateOverflow, overflow, STREAK_MAX, MOMENTUM_MAX, COMBO_MAX, HAUNT_MAX, INFERNO_STACKS } from './build';
import { xpFor, BAG_LOOT, rewardRangeFor, RewardRange, rollBossRarity } from './progression';
import { EnemyAffix, DamageProfile, rollAffix, damageDefense, enemyHealthScale } from './enemy-affixes';
import {
  Stats, baseStats, applyTalents, Save, Weapon, makeWeapon, weaponStats, rollRarity, Scroll, rollScrolls, LOCKED_SCROLLS, makeLockedWeapon, SCROLL_BY_ID, HERO_INFO, upgradeCost, rerollInscriptions, essenceEarned, GOLD_DMG, FAR_SHOT, BulletKind, storeSave,
  COSTUME_BY_ID, HERO_COSTUME, GIVE_LINES,
} from './data';

export interface Bubble { x: number; y: number; lift: number; text: string; life: number; max: number; who: 'kid' | 'door' | 'trick'; follow?: boolean }
export interface Toast { id: number; text: string; t: number }
export type BannerKind = 'info' | 'danger' | 'loot' | 'win';
export interface TotState { house: HouseInst; t: number; dur: number; stage: number; lines: { at: number; who: 'kid' | 'door' | 'trick'; text: string }[] }
export type ChoiceMode = 'level' | 'shop' | 'house' | 'boss';

// ================= INPUT =================
export class Input {
  /** canonical action tokens currently held (see game/keybinds.ts) — never raw key names */
  keys = new Set<string>();
  pressed = new Set<string>();
  mx = 0; my = 0; mdown = false; rdown = false; rpressed = false; wheel = 0; mouseActive = false;
  touchMoveX = 0; touchMoveY = 0; touchAimX = 0; touchAimY = 0; touchFiring = false; touchActive = false;
  private el: HTMLElement;
  /** the physical keys currently down; `keys` is derived from them through the player's bindings */
  private down = new Set<string>();
  constructor(el: HTMLElement) {
    this.el = el;
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    el.addEventListener('mousemove', this.mm);
    el.addEventListener('mousedown', this.md);
    window.addEventListener('mouseup', this.mu);
    window.addEventListener('blur', this.reset);
    document.addEventListener('visibilitychange', this.visibility);
    el.addEventListener('wheel', this.wh, { passive: true });
    el.addEventListener('contextmenu', this.cm);
    // rebinding mid-run (Settings › Controls, opened from the pause menu) must not leave a key stuck down
    this.unsubscribe = subscribeKeybinds(this.reset);
  }
  private unsubscribe: () => void;
  kd = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' && e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"]')) return;
    const k = e.key.toLowerCase();
    if (this.down.has(k)) return; // held: the browser's auto-repeat is not a new press
    this.down.add(k);
    const tokens = translateKey(k);
    for (const token of tokens) {
      if (!this.keys.has(token)) this.pressed.add(token);
      this.keys.add(token);
    }
    if (tokens.includes(' ') || tokens.includes('tab')) e.preventDefault();
  };
  ku = (e: KeyboardEvent) => { this.down.delete(e.key.toLowerCase()); this.rebuild(); };
  /** `keys` mirrors every held key, mapped through the current bindings */
  private rebuild() {
    const keys = new Set<string>();
    for (const k of this.down) for (const token of translateKey(k)) keys.add(token);
    this.keys = keys;
  }
  mm = (e: MouseEvent) => {
    const r = this.el.getBoundingClientRect();
    this.mx = e.clientX - r.left;
    this.my = e.clientY - r.top;
    this.mouseActive = true;
    this.touchActive = false;
  };
  md = (e: MouseEvent) => {
    if (e.button === 0) this.mdown = true;
    if (e.button === 2) { this.rdown = true; this.rpressed = true; }
  };
  mu = (e: MouseEvent) => {
    if (e.button === 0) this.mdown = false;
    if (e.button === 2) this.rdown = false;
  };
  wh = (e: WheelEvent) => (this.wheel += Math.sign(e.deltaY));
  cm = (e: Event) => e.preventDefault();
  tap(key: string) { this.pressed.add(key.toLowerCase()); }
  setTouchMove(x: number, y: number) {
    this.touchMoveX = x; this.touchMoveY = y;
    this.touchActive = true; this.mouseActive = false;
  }
  setTouchAim(x: number, y: number) {
    this.touchAimX = x; this.touchAimY = y; this.touchFiring = Math.hypot(x, y) > 0;
    this.touchActive = true; this.mouseActive = false;
  }
  clearTouch = () => {
    this.touchMoveX = this.touchMoveY = this.touchAimX = this.touchAimY = 0;
    this.touchFiring = false;
  };
  reset = () => {
    this.down.clear();
    this.keys.clear(); this.pressed.clear();
    this.mdown = false; this.rdown = false; this.rpressed = false; this.wheel = 0;
    this.clearTouch();
  };
  visibility = () => { if (document.hidden) this.reset(); };
  endFrame() {
    this.pressed.clear();
    this.rpressed = false;
    this.wheel = 0;
  }
  destroy() {
    this.unsubscribe();
    window.removeEventListener('keydown', this.kd);
    window.removeEventListener('keyup', this.ku);
    this.el.removeEventListener('mousemove', this.mm);
    this.el.removeEventListener('mousedown', this.md);
    window.removeEventListener('mouseup', this.mu);
    window.removeEventListener('blur', this.reset);
    document.removeEventListener('visibilitychange', this.visibility);
    this.el.removeEventListener('wheel', this.wh);
    this.el.removeEventListener('contextmenu', this.cm);
    this.reset();
  }
}

// ================= ENTITY TYPES =================
/**
 * Balance: player damage numbers start low (guns and skills deal 40% of their old values) while monsters keep
 * roughly their old health, so every monster takes ~2.7x as many shots. In exchange there are fewer of them
 * (SPAWN_SCALE) and each kill is worth more XP and coins (KILL_LOOT). Boss health is twice as high relative to the
 * player and, like everything else, climbs x1.65 a wave.
 */
export const SPAWN_SCALE = 0.6;
/** every hit a monster lands (on the kid or a friend) counts this many times: monsters hit twice as hard as they used to */
export const MOB_DAMAGE = 2;
export const KILL_LOOT = 1.6;
/** floating damage numbers: at most this many on screen, and never longer than four characters */
const DMG_TEXT_MAX = 40;
export function fmtDmg(n: number) {
  if (Number.isNaN(n)) return '0';
  if (n >= 1e3) {
    const units = ['K', 'M', 'B', 'T'];
    let u = -1;
    while (n >= 1e3 && u < units.length - 1) { n /= 1e3; u++; }
    return n >= 1e3 ? `999${units[u]}+` : `${n >= 100 ? Math.round(n) : n.toFixed(1)}${units[u]}`;
  }
  return Math.max(1, Math.round(n)).toString();
}

export interface EnemyDef { hp: number; speed: number; dmg: number; r: number; xp: number; coin: number; fly?: boolean; phase?: boolean; ranged?: boolean; bomber?: boolean; elite?: boolean; boss?: boolean; invulnerable?:boolean; /** shrugs off stuns, freezes and knockback */ unstoppable?: boolean; color: string; mass: number; anim: number }
export const EDEF: Record<string, EnemyDef> = {
  hex: { hp: 1500, speed: 0.8, dmg: 16, r: 0.8, xp: 90, coin: 1, boss: true, color: '#b580d5', mass: 35, anim: 6 },
  alpha: { hp: 2600, speed: 1.65, dmg: 22, r: 0.85, xp: 140, coin: 1, boss: true, color: '#9cacb8', mass: 40, anim: 8 },
  warden: { hp: 3800, speed: 0.9, dmg: 24, r: 0.9, xp: 190, coin: 1, boss: true, color: '#7cb9b0', mass: 45, anim: 6 },
  zombie: { hp: 34, speed: 1.25, dmg: 8, r: 0.28, xp: 1, coin: 0.3, color: '#7aa35a', mass: 1, anim: 6 },
  bat: { hp: 12, speed: 2.7, dmg: 5, r: 0.2, xp: 1, coin: 0.2, fly: true, color: '#3a2446', mass: 0.5, anim: 12 },
  skeleton: { hp: 60, speed: 1.75, dmg: 10, r: 0.28, xp: 2, coin: 0.4, color: '#e8e2d0', mass: 1, anim: 8 },
  ghost: { hp: 46, speed: 1.5, dmg: 10, r: 0.28, xp: 2, coin: 0.4, phase: true, color: '#cfe0ff', mass: 0.7, anim: 6 },
  pumpkin: { hp: 28, speed: 2.3, dmg: 22, r: 0.26, xp: 2, coin: 0.5, bomber: true, color: '#ee7a22', mass: 0.8, anim: 10 },
  witch: { hp: 84, speed: 1.2, dmg: 8, r: 0.3, xp: 4, coin: 0.8, ranged: true, color: '#8ac46a', mass: 1, anim: 6 },
  werewolf: { hp: 500, speed: 2.0, dmg: 20, r: 0.45, xp: 25, coin: 1, elite: true, color: '#5a4030', mass: 4, anim: 8 },
  king: { hp: 6000, speed: 1.0, dmg: 25, r: 1.0, xp: 250, coin: 1, boss: true, color: '#ff8a1e', mass: 50, anim: 6 },
  ...Object.fromEntries([...NEW_MONSTERS,FINAL_MONSTER].map(m=>[m.id,m])),
};

export interface Enemy {
  affix: EnemyAffix | null; fodder: boolean; defenseHintT: number;
  shield: number; maxShield: number; shieldT: number; lieutenant: boolean;
  /** monster rank (see RANKS): 0 a plain monster, 1 lieutenant, 2 captain and up cast spells · captain: rank 2 or more */
  rank?: number; captain?: boolean; spellT?: number; spellN?: number;
  id: number; type: string; def: EnemyDef; x: number; y: number; hp: number; maxHp: number; r: number; anim: number; flip: boolean;
  hit: number; burnT: number; burnDps: number; burnAcc: number; ectoT: number; stunT: number; atkCd: number; kx: number; ky: number;
  /** Ecto · Haunting: extra damage taken, grows with every hit while ecto'd (up to HAUNT_MAX) */
  vuln?: number;
  /** one of a boss's own crowd (see BOSS_MINIONS) */
  minion?: boolean;
  strikes?:{x:number;y:number;r:number;t:number;dmg:number}[];
  /** Hold a tractor saucer over its victim until the beam animation finishes. */
  tractorT?: number;
  /** Cryo Ray: chill builds toward 1 (slowing), then the monster is frozen solid for a while */
  chill?: number; frozenT?: number;
  shootT: number; lungeT: number; lungeX: number; lungeY: number; p1: number; p2: number; p3: number; orbitT: number; dead: boolean; elite: boolean; spawnT: number;
}
export interface Bullet {
  element?: Elem | null; initialPierce?: number; ricocheted?: boolean;
  /** has already put its hole in a parked car (one per bullet) */
  clipped?: boolean;
  x: number; y: number; vx: number; vy: number; dmg: number; r: number; life: number; pierce: number; bounce: number; kind: BulletKind; color: string;
  crit: number; fire: number; shock: number; ecto: number; explode: number; hit: number[]; vamp: boolean; dead: boolean; spin: number; home?: boolean;
  /** drawn height in px (shots fired from up on a jungle gym drop toward the ground as they fly) */
  z?: number;
  /** the gun that fired it (inscription triggers) · gentler homing strength · split-off child shot */
  src?: Weapon; homeK?: number; child?: boolean;
  /** special guns: where the last piece of trail was laid · a boomerang on its way back · already detonated */
  lx?: number; ly?: number; back?: boolean; spent?: boolean;
  /** the life it was fired with (flames grow as they age) */
  max?: number;
  /** fired by a friend: the gun's inscriptions are the kid's business, and a boomerang flies back to `by` */
  mate?: boolean; by?: { x: number; y: number };
}
export interface EBullet { x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number; color: string; kind: 'orb' | 'seed'; dead: boolean }
export interface Pickup { x: number; y: number; z: number; vz: number; vx: number; vy: number; kind: 'xp1' | 'xp2' | 'xp3' | 'coin' | 'heal' | 'chest' | 'weapon' | 'costume'; value: number; weapon?: Weapon; costume?: string; mag: boolean; t: number; dead: boolean; friendOnly?: boolean; /** flying to a boss magnet's pile */ pull?: { x: number; y: number } }
export interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: string; size: number; kind: 'sq' | 'glow' | 'leaf' | 'gore' }
export interface FText { x: number; y: number; z: number; text: string; color: string; life: number; size: number; vx: number; kind: 'ui' | 'dmg' | 'reason' }
export interface Beam { x0: number; y0: number; x1: number; y1: number; color: string; life: number; max: number; zig: boolean; w: number; /** a quiet beam (streams, the Phase Lance): thin, and faint at the gun end */ soft?: boolean }
export interface Zone {
  kind: 'fire' | 'tornado' | 'boom' | 'flash' | 'warn' | 'trail' | 'vortex' | 'tractor'; x: number; y: number; r: number; t: number; life: number; dmg: number; tick: number; ang?: number; color?: string;
  /** flash: half-angle of the cone · trail: the far end of the line · vortex: blast radius, crit flag and whether it wrecks scenery */
  arc?: number; x1?: number; y1?: number; blast?: number; crit?: boolean; demolish?: boolean; done?: boolean;
  /** boom: big enough to play the painted fireball */
  sprite?: boolean;
  /** trail: the wake of a beam. It thins out from the gun end toward the far end over its life, like smoke, and only the part still hanging in the air cuts */
  wake?: boolean;
}
export interface Lob { x0: number; y0: number; x1: number; y1: number; t: number; dur: number }
export interface Decal { x: number; y: number; r: number; color: string; life: number; rot: number; gore?: boolean }

export type GameState = 'play' | 'intro' | 'downed' | 'levelup' | 'shop' | 'vending' | 'dead' | 'victory' | 'pause' | 'inventory' | 'inspect' | 'discard' | 'hire';

export interface RescueFriend {
  hero: number; x: number; y: number; r: number; gate: number;
  status: 'locked' | 'waiting' | 'rescued'; guardian: Enemy | null;
  progress: number; hp: number; maxHp: number; weapon: Weapon;
  anim: number; flip: boolean; back: boolean; hurtCd: number; reviveCd: number; candy: number;
  /** revive started with a tap of E: keeps going while the player stays close; a hit only pauses it */
  channel?: boolean; pauseT?: number; burst?: boolean;
  /** facing (world direction) and whether they are walking: picks the aiming sprite */
  faceX?: number; faceY?: number; moving?: boolean;
  /** seconds spent well behind the player (they rejoin when it gets long) */
  farT?: number;
  /** seconds spent down (see FRIEND_DOWN_TIME) */
  downT?: number;
  /** found in hide and seek: fights at FOUND_FRIEND strength */
  found?: boolean;
  /** steady following: closing in on the kid · seconds the walk animation keeps playing · seconds the last shot holds the facing */
  chase?: boolean; moveT?: number; aimT?: number;
  /** Gameplay seconds in a saucer: never erased by killing it, switching rooms or opening a menu. */
  abductT?: number; abductImmuneT?: number; returnT?: number;
}

export interface Player {
  x: number; y: number; r: number; hp: number; shield: number; shieldT: number; invuln: number; dashT: number; dashRecharge: number; dashCharges: number;
  dashX: number; dashY: number; back: boolean; flip: boolean; anim: number; moving: boolean; weapons: (Weapon | null)[]; cur: number;
  aimX: number; aimY: number; aiming: boolean; skillCd: number; level: number; xp: number; xpNext: number; coins: number; revives: number; recoil: number; hurtT: number;
  costume: string | null; novaCd: number; stompT: number; hexT: number;
}

export interface Turret { x: number; y: number; gym: PropInst; aimX: number; aimY: number; cd: number; heat: number; over: number; barrel: number; recoil: number }
/** the Candy Cannon: heavy, fast, heats up; standing on the gym deck keeps most melee monsters at arm's length */
export const TURRET = { dmg: 9.6, rate: 11, speed: 21, range: 13, heatPerShot: 0.05, cool: 0.28, lockout: 2.2, armor: 0.4, reach: 1.65 };

/** free game: chance that a doorstep bowl also holds a friend who wants to tag along (one of the three cards) */
export const FRIEND_CARD_CHANCE = 0.2;
/**
 * A friend found in hide and seek (the rescue campaign) is worth the search: twice the damage and twice the health of
 * a kid who simply tags along from a doorstep, and a gun one rarity better.
 */
export const FOUND_FRIEND = { dmg: 2, hp: 2, gun: 1 };
/** a friend who goes down can be helped up for this long; after that they are out for the night */
/**
 * The vector-guided Starcade has a tested return portal and persistent scene state.
 * Keep this switch available to close entry without trapping a kid already inside.
 */
// Open everywhere, the published game included. Set to false to close the door again: the arcade then is an ordinary
// trick-or-treat building and Maya and Leo hide at the gazebos like the others.
export const ARCADE_OPEN: boolean = true;
/** the Starcade shuts after this wave: whoever is inside is shown the door, and it does not open again that night */
export const ARCADE_LAST_WAVE = 5;
/**
 * Hide & Shriek (the rescue campaign: friends hidden at the gazebos, the intro, their guardians) is shelved for now.
 * The app no longer starts it: every run is the same night, opening with the tutorial. The mode itself is still here
 * (and tested) for when it comes back; flip this to offer it again.
 */
export const CAMPAIGN_OPEN: boolean = false;
/** Is the rescue campaign on offer? Shelved for players; a development build still reaches it with ?campaign (its tests do). */
export function campaignOffered() {
  if (CAMPAIGN_OPEN) return true;
  try { return (import.meta as unknown as { env: { DEV?: boolean } }).env.DEV === true && new URLSearchParams(location.search).has('campaign'); } catch { return false; }
}
const ARCADE_SEEN_KEY = 'tot_arcade_seen_v1';
/** seconds a gun lies on the ground before it is gone (it blinks for the last ten) */
/** the trick-or-treat stands inside the Starcade (counted before the kid has ever been inside) */
export const ARCADE_VENUES = 3;
export const GUN_GROUND_TIME = 120;
/** coins, candy and treat bags left on the ground are gone after this long (first aid, guns and costumes are not) */
export const LOOT_GROUND_TIME = 60;
/** how long a fallen boss's magnet stays over the spot where it gathered the town's coins and candy */
export const BOSS_MAGNET_TIME = 6;
export const FRIEND_DOWN_TIME = 30;
/** hide and seek: a friend who goes down gets back up alone after this long (nobody found is lost again) */
export const SEEK_FRIEND_UP = 20;
/** seconds of calm after every boss (the clock only runs while the kid is free to move) */
export const BUY_WINDOW = 20;
/** a friend's max HP before the Buddy System talents · seconds between two pick-ups of the player by the same friend */
export const FRIEND_HP = 80, FRIEND_REVIVE_CD = 60;
/** special guns: ticks of ramp a stream can build · share of a shot's damage a lingering trail deals per tick · seconds frozen */
const STREAM_RAMP_MAX = 20, TRAIL_TICK = 0.35, FREEZE_TIME = 2.4;
/** structural damage a car and a house take before they go up (an Annihilator shell deals 60, a lick of flame 2.5) */
const CAR_HP = 50, HOUSE_HP = 170;
/** what an ordinary blast (a rocket, a balloon, a pumpkin bomb) takes off a car or a house it lands on */
export const BLAST_WRECK = 20;
/** what one bullet or beam takes off a parked car it passes through (cars only: a house needs a blast) */
export const BULLET_WRECK = 2;
/** seconds of helping a friend up (scaled by the reviveSpeed talent) */
const RESCUE_TIME = 1.8;
export const BOSS_NAMES: Record<string, string> = { hex: 'Headmistress Hex', alpha: 'Howler Alpha', warden: 'Graveyard Warden', king: 'The Pumpkin King',...ROSTER_NAMES };
const CAMPAIGN_BOSSES = WAVE_BOSSES;
/**
 * A boss fight is its own wave: while a boss lives the ordinary waves, hordes and elites wait, and the boss fights with
 * its own crowd instead (an escort when it arrives, then a small squad every few seconds, up to a cap).
 */
export const BOSS_MINIONS: Record<string, string[]> = { hex: ['witch', 'ghost'], alpha: ['bat', 'zombie'], warden: ['skeleton', 'zombie'], king: ['pumpkin', 'bat'],...ROSTER_MINIONS };
const MINION_WORDS: Record<string, string> = { witch: 'witches', ghost: 'ghosts', bat: 'bats', zombie: 'zombies', skeleton: 'skeletons', pumpkin: 'pumpkin heads' };

/**
 * The rank ladder. Every Hollow Beyond that falls promotes the street: the ordinary monster takes the rank the
 * special one had, and the special one is a rank higher again. Night 1: monsters and lieutenants; night 2:
 * lieutenants and captains; night 3: captains and mayors; up to night 6 (five giants down), where it stops climbing.
 * hp/shield/speed/hit multiply the monster's own; captains and up cast spells (`spell` hexes a cast, every `cd` s).
 */
export const RANKS = [
  { name: 'monster', plural: 'monsters', hp: 1, shield: 0, speed: 1, hit: 1, spell: 0, cd: 0, color: '#ff2a2a' },
  { name: 'lieutenant', plural: 'lieutenants', hp: 1.5, shield: 0.5, speed: 1.1, hit: 1.3, spell: 0, cd: 0, color: '#ff2a2a' },
  { name: 'captain', plural: 'captains', hp: 2.5, shield: 0.6, speed: 1.3, hit: 1.6, spell: 3, cd: 2.9, color: '#b44dff' },
  { name: 'mayor', plural: 'mayors', hp: 4, shield: 0.7, speed: 1.4, hit: 2, spell: 5, cd: 2.6, color: '#ffc453' },
  { name: 'governor', plural: 'governors', hp: 6, shield: 0.8, speed: 1.5, hit: 2.4, spell: 6, cd: 2.4, color: '#3fe0d0' },
  { name: 'president', plural: 'presidents', hp: 9, shield: 0.9, speed: 1.6, hit: 2.8, spell: 7, cd: 2.2, color: '#e8f0ff' },
  { name: 'overlord', plural: 'overlords', hp: 13, shield: 1, speed: 1.7, hit: 3.2, spell: 8, cd: 2, color: '#ff3b6b' },
] as const;
/** the ladder stops after the fifth giant: night 6 and every night after it field presidents and overlords */
export const RANK_CAP_NIGHT = 6;

// ================= GAME =================
export class Game {
  map: GameMap;
  save: Save;
  hero: number;
  stats: Stats = baseStats();
  p: Player;
  enemies: Enemy[] = [];
  bullets: Bullet[] = [];
  ebullets: EBullet[] = [];
  pickups: Pickup[] = [];
  particles: Particle[] = [];
  texts: FText[] = [];
  beams: Beam[] = [];
  zones: Zone[] = [];
  lobs: Lob[] = [];
  decals: Decal[] = [];
  scrolls: Record<string, number> = {};
  scrollOrder: string[] = [];
  state: GameState = 'play';
  time = 0;
  kills = 0;
  pendingLevels = 0;
  /** boss prizes waiting to be picked (one per boss kill; the final giant's has more cards and better luck) */
  bossPrizes: { n: number; luck: number }[] = [];
  /** which night of the run this is: killing the Hollow Beyond starts the 24 waves over, with lieutenants and captains */
  night = 1;
  choices: Scroll[] = [];
  /** trick-or-treat bowls can also hold guns (rare or better), shown after the treat cards */
  gunChoices: Weapon[] = [];
  /** free game only: a full-game treat or gun shown as a locked, read-only extra card, to tease the unlock */
  lockedChoice: { scroll: Scroll | null; weapon: Weapon | null } | null = null;
  /** free game: a kid offering to join as your companion, shown as one of the doorstep cards (hero index) */
  friendChoice: number | null = null;
  choiceMode: ChoiceMode = 'level';
  choiceGiver = '';
  tot: TotState | null = null;
  bubbles: Bubble[] = [];
  housesVisited = 0;
  /** One approachable, non-trick house for the opening guide, per run. */
  /** the starting tutorial (see tutorial.ts): null on every run that does not have one */
  tutorial: Tutorial | null = null;
  startTutorial() {
    if (this.tutorial) return;
    this.tutorial = new Tutorial();
    // the night's opening banner waits with the night
    this.heldBanner = this.banner; this.banner = null;
  }
  private heldBanner: Game['banner'] = null;
  /** the player skipped it (this time, or for good): the night starts and nothing is free any more */
  skipTutorial(never = false) {
    if (!this.tutorial) return;
    this.tutorial = null;
    if (never) rememberTutorial('never');
  }
  /** a machine or shop the kid can walk to, as a spot to stand on beside it (nearest by walking) */
  guideSpot(kind: 'machine' | 'shop'): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null, bd = Infinity;
    for (const sh of this.map.shops) {
      if ((sh.prop.kind === 'vending') !== (kind === 'machine')) continue;
      const spot = this.freeSpot(sh.x, sh.y, true);
      if (Math.hypot(spot.x - sh.x, spot.y - sh.y) > 1.2) continue; // nowhere to stand within reach of it
      const d = this.flow[Math.floor(spot.y * CR) * CW + Math.floor(spot.x * CR)];
      if (d < bd) { bd = d; best = spot; }
    }
    return best;
  }
  /** where the dots and the arrow lead right now: the first house on every run, then the tutorial's two stops */
  get guide(): { kind: 'house' | 'machine' | 'shop'; x: number; y: number } | null {
    if (this.map.kind === 'arcade') return null;
    const t = this.tutorial;
    if (t?.holding && t.step !== 'treat') return t.spot ? { kind: t.step as 'machine' | 'shop', ...t.spot } : null;
    const h = this.tutorialHouse;
    return h && !this.treatGuideComplete && !h.visited ? { kind: 'house', x: h.door.x, y: h.door.y } : null;
  }
  /** the way to walk to the guide's target (empty when there is no guide) */
  guideRoute() { const to = this.guide; return to ? this.routeTo(to.x, to.y) : []; }
  tutorialHouse: HouseInst | null = null;
  treatGuideComplete = false;
  treatGuideNotice = false;
  costumesFound = 0;
  private costumesWorn = new Set<string>();
  private dashHit = new Set<number>();
  rerolls = 0;
  shopHealBuys = 0;
  shopTreatBuys = 0;
  vendingPlays = 0;
  vendingSpin: VendingSpin | null = null;
  private vendingId = 0;
  private vendingActive = false;
  private recordRun: RunRecord | null = leaderboard.beginRun();
  recordUpload: Promise<string> | null = null;
  boss: Enemy | null = null;
  bossSpawned = false;
  bossKilled = false;
  bossWins = 0;
  bossRound = 0;
  /** true for the rest of the frame a boss died in: the fight's lists were just emptied, so the loops stop */
  bossBreak = false;
  /** seconds left of the calm after a boss: nothing spawns, the shops have moved, the kid has time to find one */
  calmT = 0;
  /** seconds the waves have stood still (a boss alive, or the quiet after one): the wave clock is the run time less this */
  wavePause = 0;
  private minionT = 0;
  private minionBoss: Enemy | null = null;
  nextBossAt = 60;
  xpCollected = 0;
  essence = { combat: 0, kills: 0, survival: 0, bosses: 0, waves: 0 };
  endless = false;
  banner: { text: string; sub: string; t: number; kind: BannerKind } | null = null;
  /** walkie-talkie heads-ups shown under the minimap */
  toasts: Toast[] = [];
  private toastId = 1;
  private dmgTexts = 0;
  private warned = new Set<number>();
  /** M / Tab: big map overlay */
  bigMap = false;
  interact: { label: string; kind: 'weapon' | 'chest' | 'shop' | 'vending' | 'costume' | 'house' | 'turret' | 'portal' | 'hire'; ref: Pickup | PropInst | HouseInst | NonNullable<GameMap['portals']>[number] | typeof ARCADE_STAFF[number] } | null = null;
  private townScene: {map:GameMap;enemies:Enemy[];pickups:Pickup[];decals:Decal[];turrets:Turret[]} | null = null;
  private arcadeScene: {map:GameMap;enemies:Enemy[];pickups:Pickup[];decals:Decal[];turrets:Turret[]} | null = null;
  private arcadeReturn: {x:number;y:number} | null = null;
  private townShopMovePending = false;
  get rescueMap() { return this.townScene?.map ?? this.map; }

  /** Keep run progress and per-scene loot; never reset or duplicate rewards on entry. */
  /** this player has been inside the Starcade before (kept between runs): until then an arrow points at its door */
  arcadeSeen = storage.getItem(ARCADE_SEEN_KEY) === '1';
  /** closed for the night (see ARCADE_LAST_WAVE) */
  get arcadeShut() { return this.night > 1 || this.wave > ARCADE_LAST_WAVE; }
  /** waves played this run over every night (night 1 ends with the Hollow Beyond as wave 25) */
  get totalWave() { return (this.night - 1) * 25 + this.wave; }
  /**
   * The wave whose health the monsters have. The second night starts about where the first one's late waves stood
   * and climbs from there; every night after that is three waves tougher again (on top of the rank ladder).
   */
  /** how much harder every monster hits on this night: a quarter more after each Hollow Beyond */
  get nightPower() { return 1 + 0.25 * (this.night - 1); }
  /** the rank of an ordinary monster tonight (the special ones are one higher) */
  get baseRank() { return Math.min(this.night, RANK_CAP_NIGHT) - 1; }
  hpWave(wave = this.wave) { return this.night > 1 ? wave + 14 + (this.night - 2) * 3 : wave; }
  private arcadeShutSaid = false;
  /** Closing time: anyone still inside is put out on the street, and the sign on the door changes. */
  private closeArcade() {
    if (!ARCADE_OPEN || !this.arcadeShut || this.state !== 'play') return;
    if (this.map.kind === 'arcade') {
      if (this.tot) this.cancelTot(false);
      this.travelArcade('town', true);
      if (this.map.kind === 'arcade') return; // could not leave this frame: try again
    }
    if (this.arcadeShutSaid) return;
    this.arcadeShutSaid = true;
    this.setBanner('THE STARCADE IS CLOSED', 'Closing time. It will not open again tonight.', 'info');
  }
  travelArcade(target:'town'|'arcade', force = false) {
    if(!ARCADE_OPEN&&target==='arcade') return; // emergency entry switch; leaving stays possible
    if(target==='arcade'&&this.arcadeShut) return;
    if(this.state!=='play'||this.mounted>=0||this.tot) return;
    const inside=this.map.kind==='arcade';
    if((target==='arcade')===inside) return;
    const arcade=this.map.houses.find(h=>h.prop.kind==='arcade'&&!h.gone);
    const portal=inside?this.map.portals?.[0]:arcade?.door;
    if(!portal||(!force&&Math.hypot(this.p.x-portal.x,this.p.y-portal.y)>2)) return;
    if(!force&&this.boss&&!this.boss.dead){this.toast('Finish the boss fight before changing rooms.');return;}
    const snapshot={map:this.map,enemies:this.enemies,pickups:this.pickups,decals:this.decals,turrets:this.turrets};
    if(inside)this.arcadeScene=snapshot;
    else {this.townScene=snapshot;this.arcadeReturn={...arcade!.door};if(!this.arcadeSeen){this.arcadeSeen=true;storage.setItem(ARCADE_SEEN_KEY,'1');}}
    const next=inside?this.townScene!:this.arcadeScene??{map:buildArcadeMap(),enemies:[],pickups:[],decals:[],turrets:[]};
    this.map=next.map;this.enemies=next.enemies;this.pickups=next.pickups;this.decals=next.decals;this.turrets=next.turrets;
    Object.assign(this.p,inside?this.arcadeReturn!:this.map.start);
    this.bullets=[];this.ebullets=[];this.zones=[];this.lobs=[];this.beams=[];this.particles=[];this.texts=[];this.bubbles=[];this.procQueue=[];
    this.interact=null;this.inspecting=null;this.nearbyWeapon=null;this.nearbyCostume=null;this.rescuePrompt='';this.rescueProgress=-1;this.tutorialHouse=null;
    this.spawnAcc=0;this.shake=0;this.vw=1;this.bigMap=false;this.computeFlow(true);
    if(inside&&this.townShopMovePending){this.relocateShops();this.townShopMovePending=false;}
    for(const f of this.friends)if(f.status==='rescued')Object.assign(f,this.freeSpot(this.p.x+.8,this.p.y+.8,true),{moving:false});
    if(inside)this.selectTutorialHouse();
    this.input.keys.clear();this.input.pressed.clear();this.input.mdown=false;
    this.setBanner(inside?'BACK TO MAPLE FALLS':'WELCOME TO THE STARCADE',inside?'Your run continues.':'Four blocks of games, pizza and monsters. E at the exit returns outside.');
    gameAudio.play('door',.4);
  }
  /** Candy Cannons on the playground jungle gyms; `mounted` is the index of the one the kid is manning (-1: on foot) */
  turrets: Turret[] = [];
  mounted = -1;
  /** the gun whose shot is landing right now, so on-hit / on-kill inscriptions know their source */
  private hitSrc: Weapon | null = null;
  /** seconds the kid has stood still (Freeze Tag) */
  private stillT = 0;
  // ---- buildcraft (see build.ts / BUILDCRAFT.md) ----
  build!: Build;
  private buildKey = '';
  /** Kill · Momentum stacks (+x% damage each), Crit · Lucky Streak stacks (+2% crit each) */
  momentum = 0; private momentumT = 0;
  streak = 0; private streakT = 0;
  /** chained procs (explosions from kills from explosions...) queue here; `gen` stops runaway recursion per event */
  private procQueue: { x: number; y: number; r: number; dmg: number; gen: number }[] = [];
  private procGen = 0;
  private blastKill = false;
  // ---- Endless Night ----
  wave = 1; victorious = false;
  premiumPowerT = 0;
  private boneBurstT = 0;
  nearbyWeapon: Weapon | null = null;
  /** a gun on the ground being inspected (game paused) before it goes into a slot */
  inspecting: Pickup | null = null;
  nearbyCostume: string | null = null;
  // camera (written by renderer)
  camX = 0; camY = 0; zoom = 1; vw = 1; vh = 1; shake = 0; viewR = 11;
  /** the player's own zoom from the mouse wheel, on top of the screen-fit zoom */
  userZoom = 1;
  input: Input;
  private eid = 1;
  private grid: Enemy[][] = [];
  private occupiedGrid: Enemy[][] = [];
  private flow = new Int32Array(CW * CH);
  private flowQueue = new Int32Array(CW * CH);
  private navigation = new Uint8Array(CW * CH);
  private flowT = 0;
  private flowCell = -1;
  private spawnAcc = 0;
  private nextChest = 30;
  private nextElite = 150;
  private familiarT = 0;
  orbitAng = 0;
  familiar = { x: 0, y: 0 };
  soulEarned = 0;
  private soulPaid = 0;
  hitStop = 0;
  campaign = false;
  friends: RescueFriend[] = [];
  activeFriend: number | null = null;
  hiredArcadeStaff = new Set<number>();
  hiringHero: number | null = null;
  get availableArcadeStaff() { return ARCADE_STAFF.filter(s=>s.hero!==this.hero&&!this.hiredArcadeStaff.has(s.hero)&&!this.friends.some(f=>f.hero===s.hero)); }
  get hiringStaff() { return this.availableArcadeStaff.find(s=>s.hero===this.hiringHero)??null; }
  closeHire() { if(this.state!=='hire')return;this.hiringHero=null;this.state='play';this.input.pressed.clear(); }
  hireStaff() {
    const staff=this.hiringStaff;
    if(!hasFullGame())return;
    if(this.state!=='hire'||this.map.kind!=='arcade'||!staff||this.p.coins<staff.cost||Math.hypot(staff.x-this.p.x,staff.y-this.p.y)>2)return;
    this.p.coins-=staff.cost;this.hiredArcadeStaff.add(staff.hero);this.addFriend(staff.hero);
    this.closeHire();this.p.invuln=Math.max(this.p.invuln,1);gameAudio.play('revive',.5);
    this.setBanner(`${HERO_INFO[staff.hero].name.toUpperCase()} CLOCKS OUT!`,'They fight beside you, share your gun upgrades and can revive you.','loot');
  }
  introTime = 0;
  introLine = -1;
  downedTime = 0;
  rescuePrompt = '';
  /** 0..1 while a revive is under way (drives the HUD bar), -1 when the prompt has no progress */
  rescueProgress = -1;
  private playerReviveProgress = 0;
  private winDelay = 0;

  constructor(hero: number, save: Save, input: Input, campaign = false) {
    this.hero = Number.isInteger(hero) && hero >= 0 && hero < HERO_INFO.length && (hero < 3 || hasFullGame()) ? hero : 0;
    this.campaign = campaign && hasFullGame();
    this.save = save;
    this.input = input;
    this.map = buildBuiltTown(); // Maple Falls as painted in the town builder: the same town on every run
    this.turrets = this.map.turrets.map((t) => ({ x: t.x, y: t.y, gym: t.gym, aimX: 0.7, aimY: 0.7, cd: 0, heat: 0, over: 0, barrel: 0, recoil: 0 }));
    for (let i = 0; i < MAP_W * MAP_H; i++) this.grid.push([]);
    this.recalcStats();
    const s = this.stats;
    this.p = {
      x: this.map.start.x, y: this.map.start.y, r: 0.24, hp: s.maxHp, shield: s.maxShield, shieldT: 99, invuln: 0, dashT: 0, dashRecharge: 0, dashCharges: s.dashCharges,
      dashX: 0, dashY: 0, back: false, flip: false, anim: 0, moving: false, weapons: [makeWeapon('pea', Math.min(4, s.startRarity)), null], cur: 0,
      aimX: 1, aimY: 0, aiming: false, skillCd: 0, level: 1, xp: 0, xpNext: xpFor(1), coins: s.startCoins, revives: s.revive, recoil: 0, hurtT: 0,
      costume: null, novaCd: 0, stompT: 4, hexT: 1,
    };
    this.rerolls = s.rerolls;
    this.familiar = { x: this.p.x, y: this.p.y };
    this.setBanner('Trick or Treat... or FIGHT!', 'Survive the night. Boss arrives at 5:00');
    this.computeFlow(true);
    if (!this.campaign && s.mateStart) {
      // Sleepover Plans: one of the three neighbourhood kids (never your own) comes along from the first minute
      const others = [0, 1, 2].filter(h => h !== this.hero);
      this.addFriend(others[Math.floor(Math.random() * others.length)]);
    }
    if (this.campaign) {
      // Friends hide at the gazebo of each gated district (north, east, south, west: the gate order).
      // Aim for the camera-facing corner so the roof never covers the kid, then take the nearest reachable clearing.
      const sites = this.map.hideouts.map(h => [h.x + 1.5, h.y + 1.5]);
      // Temporarily open only the gate cells, then restore the exact initial locks.
      const gateCells = this.map.gates.flatMap(gate => gate.cells.map(([x, y]) => ({ index: y * CW + x, value: this.map.coll[y * CW + x] })));
      for (const cell of gateCells) this.map.coll[cell.index] = 0;
      this.computeFlow(true);
      // Maya and Leo are the older arcade workers, not part of the hide-and-seek group.
      // (only while the Starcade is open: with its door closed they hide at the gazebos like the others)
      this.friends = (ARCADE_OPEN ? [0, 1, 2] : HERO_INFO.map((_, i) => i)).filter(i => i !== this.hero).map((id, i) => {
        const pos = this.rescueSpot(sites[i][0], sites[i][1]);
        return { hero: id, ...pos, r: 0.24, gate: i, status: 'locked', guardian: null, progress: 0,
          hp: this.friendMaxHp * FOUND_FRIEND.hp, maxHp: this.friendMaxHp * FOUND_FRIEND.hp, weapon: this.friendGun(FOUND_FRIEND.gun), anim: 0, flip: false, back: false, hurtCd: 0, reviveCd: 0, candy: 0, found: true };
      });
      for (const cell of gateCells) this.map.coll[cell.index] = cell.value;
      this.computeFlow(true);
      this.state = 'intro';
      this.banner = null;
    }
    this.selectTutorialHouse();
  }

  private selectTutorialHouse() {
    if (this.treatGuideComplete) return;
    // The first door has to be an easy one: the nearest by WALKING, not as the crow flies. A house whose door is round
    // the back looks close and sends a new player straight into its wall.
    const walk = (h: HouseInst) => this.flow[Math.floor(h.door.y * CR) * CW + Math.floor(h.door.x * CR)];
    this.tutorialHouse = this.map.houses.filter(h => h.prop.kind === 'house' && !h.trick && !h.visited && !blockedCircle(this.map, h.door.x, h.door.y, this.p.r) && this.reachable(h.door.x, h.door.y))
      .sort((a, b) => walk(a) - walk(b))[0] ?? null;
    this.routeKey = -1;
  }
  private routeKey = -1;
  private route: { x: number; y: number }[] = [];
  /**
   * The way to walk from the kid to the first house's door, a point per quarter tile (empty once the guide is done).
   * It follows the same flow field the monsters use, so it goes round buildings and fences exactly as the kid must.
   */
  treatRoute(): { x: number; y: number }[] {
    const h = this.tutorialHouse;
    if (!h || this.treatGuideComplete || h.visited) return [];
    return this.routeTo(h.door.x, h.door.y);
  }
  /** the walking route from the kid to a spot, cached until the kid steps into another cell */
  private routeTo(x: number, y: number): { x: number; y: number }[] {
    const door = Math.floor(y * CR) * CW + Math.floor(x * CR);
    const key = this.flowCell * 4 + door % 4 + door * 1e7; // the route only changes when the kid steps into another cell
    if (key === this.routeKey) return this.route;
    this.routeKey = key;
    const f = this.flow, out: { x: number; y: number }[] = [];
    let c = door;
    for (let guard = 0; guard < 1200 && f[c] < (1 << 29); guard++) {
      out.push({ x: (c % CW + 0.5) / CR, y: (((c / CW) | 0) + 0.5) / CR });
      if (f[c] <= 0) break;
      // one step closer to the kid; among equal steps keep going the way we were going, so the line is not a staircase
      const prev = out.length > 1 ? c - (Math.floor(out[out.length - 2].y * CR) * CW + Math.floor(out[out.length - 2].x * CR)) : 0;
      let next = -1;
      for (const n of [c + prev, c - 1, c + 1, c - CW, c + CW]) {
        if (n === c || n < 0 || n >= f.length || f[n] !== f[c] - 1) continue;
        if (Math.abs((n % CW) - (c % CW)) > 1) continue; // no wrapping round the edge of the map
        next = n; break;
      }
      if (next < 0) break;
      c = next;
    }
    return (this.route = out.reverse());
  }

  private freeSpot(x: number, y: number, reachable = false, clearance = .3) {
    for (let radius = 0; radius < 8; radius += 0.5) for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
      const nx = x + Math.cos(a) * radius, ny = y + Math.sin(a) * radius;
      if ((!reachable || this.reachable(nx, ny)) && !blockedCircle(this.map, nx, ny, clearance)) return { x: nx, y: ny };
    }
    // A large creature or a changed collision map can make the original start
    // unsafe too. Search reachable clearings instead of returning it unchecked.
    const start = this.map.start;
    if ((!reachable || this.reachable(start.x, start.y)) && !blockedCircle(this.map, start.x, start.y, clearance)) return { ...start };
    for (let ny = .5; ny < MAP_H; ny += .5) for (let nx = .5; nx < MAP_W; nx += .5) {
      if ((!reachable || this.reachable(nx, ny)) && !blockedCircle(this.map, nx, ny, clearance)) return { x: nx, y: ny };
    }
    throw new Error('No body-clear reachable position in the current map');
  }
  private rescueSpot(x: number, y: number) {
    let best: { x: number; y: number } | null = null, distance = Infinity;
    // Search every clearing, not just the eight tiles around a potentially occupied house.
    for (let ny = 2.5; ny < MAP_H - 2; ny++) for (let nx = 2.5; nx < MAP_W - 2; nx++) {
      const d = Math.hypot(nx - x, ny - y);
      if (d >= distance || !this.reachable(nx, ny)) continue;
      if (blockedCircle(this.map, nx, ny, .7)) continue;
      if (this.map.props.some(pr => !pr.removed && nx > pr.x0 - 0.8 && nx < pr.x0 + pr.fw + 0.8 && ny > pr.y0 - 0.8 && ny < pr.y0 + pr.fh + 0.8)) continue;
      best = { x: nx, y: ny }; distance = d;
    }
    if (!best) throw new Error('No reachable rescue clearing in this map');
    return best;
  }
  introPosition(hero: number) {
    const index = [this.hero, ...this.friends.map(f => f.hero)].indexOf(hero);
    return index === 0 ? { x: this.p.x, y: this.p.y } : this.freeSpot(this.p.x + (index % 2 ? -1 : 1) * 1.2, this.p.y + Math.ceil(index / 2) * 0.65);
  }
  get introText() {
    const kids = [this.hero, ...this.friends.map(f => f.hero)];
    const lines = ["Hide and seek! I'm the seeker tonight.", 'Count to twenty. No peeking!', "We'll hide around the neighbourhood.", 'Wait... did that pumpkin just move?', "Those aren't costumes! Run!", 'Stay calm. I will find every one of you.'];
    const line = Math.min(5, Math.floor(this.introTime / 2.8));
    const hero = line === 5 ? this.hero : kids[line % kids.length];
    return { hero, text: lines[line], position: this.introPosition(hero) };
  }
  private updateIntro(dt: number) {
    this.introTime += dt;
    const line = Math.min(5, Math.floor(this.introTime / 2.8));
    if (line !== this.introLine) {
      this.introLine = line;
      const dialogue = this.introText;
      this.bubble(dialogue.position.x, dialogue.position.y, 110, dialogue.text, 'kid', 2.8);
    }
    for (const bubble of this.bubbles) bubble.life = Math.max(0.1, bubble.life - dt);
    if (this.input.pressed.has(' ') || this.input.pressed.has('enter') || this.introTime >= 17) {
      this.state = 'play'; this.bubbles = [];
      this.setBanner('HIDE & SHRIEK', 'Find your friends at the gazebos. Everyone you rescue fights beside you.');
      this.toast(ARCADE_OPEN ? 'Follow the cyan arrows to your friends. Maya and Leo are working at the Starcade concessions.' : 'Each friend waits at a gazebo behind a district gate. Follow the cyan arrow.');
      gameAudio.play('guardian', 0.4);
    }
  }
  selectFriend(hero: number) {
    if (this.state !== 'pause') return;
    const friend = this.friends.find(f => f.hero === hero && f.status === 'rescued');
    if (!friend) return;
    this.activeFriend = hero;
    Object.assign(friend, this.freeSpot(this.p.x + 0.7, this.p.y + 0.7));
    this.syncTeamWeapons();
  }
  giveFriendWeapon(hero: number, slot: number) {
    if (this.state !== 'pause' || ![0, 1].includes(slot)) return;
    const friend = this.friends.find(f => f.hero === hero && f.status === 'rescued'), weapon = this.p.weapons[slot];
    if (!friend || !weapon || friend.hp <= 0) return;
    this.p.weapons[slot] = friend.weapon; friend.weapon = weapon; this.syncTeamWeapons();
  }
  syncTeamWeapons() {
    const level = Math.max(0, ...this.p.weapons.map(w => w?.level || 0), ...this.friends.map(f => f.weapon.level));
    for (const f of this.friends) f.weapon.level = Math.max(f.weapon.level, level);
  }
  /** a guardian's ward breaking: knocks back and stuns everything nearby (bosses only flinch) */
  private wardBurst(x: number, y: number) {
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy);
      if (d > 6) continue;
      const k = (1 - d / 6) * (e.def.boss ? 2 : 9) / Math.max(1, e.def.mass * 0.15);
      e.kx += (dx / (d || 1)) * k; e.ky += (dy / (d || 1)) * k;
      if (!e.def.boss) e.stunT = Math.max(e.stunT, 2.2);
    }
    for (const b of this.ebullets) if (Math.hypot(b.x - x, b.y - y) < 6) b.dead = true;
    this.zones.push({ kind: 'flash', x, y, r: 6, t: 0, life: 0.5, dmg: 0, tick: 0, color: '#c9a8ff' });
    for (let i = 0; i < 26; i++) { const a = (i / 26) * Math.PI * 2; this.particle(x, y, 0.4, Math.cos(a) * 5, Math.sin(a) * 5, rand(1, 3), 0.7, i % 2 ? '#b58bff' : '#e6d4ff', 5, 'glow'); }
    this.shake = Math.max(this.shake, 8);
    gameAudio.play('revive', 0.3);
  }
  private updateTeam(dt: number) {
    if (!this.friends.length || this.bossBreak) return; // the campaign's rescued kids, or a free-game friend from a doorstep
    this.rescuePrompt = ''; this.rescueProgress = -1;
    for(const f of this.friends){
      f.abductImmuneT=Math.max(0,(f.abductImmuneT??0)-dt);
      f.returnT=Math.max(0,(f.returnT??0)-dt);
      if((f.abductT??0)>0){
        f.abductT=Math.max(0,f.abductT!-dt);
        if(f.abductT===0){
          Object.assign(f,this.freeSpot(this.p.x+1,this.p.y+1,true));
          f.hurtCd=3;f.abductImmuneT=10;f.returnT=1.2;f.moving=false;
          this.zones.push({kind:'tractor',x:f.x,y:f.y,r:.8,t:0,life:1.4,dmg:0,tick:0});
          this.toast(`${HERO_INFO[f.hero].name} has been beamed back down!`);
        }
      }
    }
    for (const f of this.friends) {
      if (f.status === 'rescued') continue;
      if (this.map.kind === 'arcade') continue; // Hidden kids remain in their town hideouts.
      const gate = this.map.gates[f.gate], distance = Math.hypot(f.x - this.p.x, f.y - this.p.y);
      // a guardian that left the arena without dying (despawned, culled) no longer holds the ward
      if (f.guardian && !f.guardian.dead && !this.enemies.includes(f.guardian)) f.guardian.dead = true;
      // the player standing right there proves the friend is reachable, gate or no gate
      if (f.status === 'locked' && !this.endless && !this.boss && ((gate.opened && distance < 12 && this.reachable(f.x, f.y)) || distance < 5)) {
        const spot = this.freeSpot(f.x + 1, f.y + 1);
        f.guardian = this.spawnEnemy('werewolf', spot.x, spot.y);
        f.guardian.hp = f.guardian.maxHp = (220 + this.time * 0.3) * this.hpScale();
        f.guardian.shield = f.guardian.maxShield = f.guardian.maxHp * 0.6;
        f.status = 'waiting';
        gameAudio.play('guardian', 0.5); this.toast(`${HERO_INFO[f.hero].name} is at the gazebo! Defeat the guardian.`);
      }
      if (this.state !== 'play') continue;
      const safe = f.status === 'waiting' && !!f.guardian?.dead;
      if (safe && !f.burst) {
        // the ward shatters: shove the horde back so there is room to help
        f.burst = true;
        this.wardBurst(f.x, f.y);
      }
      if (distance < 2 || (f.channel && distance < 2.6)) {
        const name = HERO_INFO[f.hero].name;
        if (!safe) { this.rescuePrompt = `Defeat the guardian to free ${name}`; continue; }
        if (this.input.pressed.has('e') || this.input.keys.has('e')) f.channel = true;
        if (f.channel) {
          f.pauseT = Math.max(0, (f.pauseT ?? 0) - dt);
          if (this.p.hurtT > 0) f.pauseT = 0.35; // a hit stalls the revive for a moment, it never wipes it
          if (!f.pauseT) f.progress += dt * this.stats.reviveSpeed;
          this.rescuePrompt = `Helping ${name} up…`;
        } else this.rescuePrompt = `Revive ${name} · they'll join you`;
        this.rescueProgress = Math.min(1, f.progress / RESCUE_TIME);
        if (f.progress >= RESCUE_TIME) {
          f.status = 'rescued'; f.progress = 0; f.channel = false;
          if (this.activeFriend === null) this.activeFriend = f.hero;
          this.syncTeamWeapons(); gameAudio.play('revive');
          this.setBanner(`${HERO_INFO[f.hero].name.toUpperCase()} IS SAFE!`, 'Found friends fight at double strength. Pause to share weapons.', 'loot'); this.rescuePrompt = '';
        }
      } else { f.channel = false; f.progress = Math.max(0, f.progress - dt * 2); }
    }
    // ---- everyone already on the team fights beside the player, all at once ----
    const team = this.friends.filter(f => f.status === 'rescued' && !(f.abductT!>0));
    if (!team.length) { if (this.state === 'downed') this.endRun(false); return; }
    const gap = (f: RescueFriend) => Math.hypot(f.x - this.p.x, f.y - this.p.y);
    // A friend who is down can be helped up for FRIEND_DOWN_TIME seconds (sign above them, beacon on the map).
    let helping: RescueFriend | null = null;
    for (const f of team) {
      if (f.hp > 0) { f.downT = 0; continue; }
      if (this.state === 'play') f.downT = (f.downT ?? 0) + dt;
      if (this.friendUpTime && (f.downT ?? 0) >= this.friendUpTime) {
        // Best Friends Forever, and every friend in hide and seek: they shake it off on their own
        f.hp = f.maxHp * 0.5; f.progress = 0; f.channel = false; f.hurtCd = 3; f.downT = 0;
        gameAudio.play('revive', 0.5); this.text(f.x, f.y, 'BACK UP!', '#ff4fd8', 13);
        continue;
      }
      if ((f.downT ?? 0) >= this.friendDownTime) {
        this.friends = this.friends.filter(x => x !== f);
        this.lostFriends.push(f);
        if (this.activeFriend === f.hero) this.activeFriend = this.friends.find(x => x.status === 'rescued')?.hero ?? null;
        this.setBanner(`${HERO_INFO[f.hero].name.toUpperCase()} IS OUT FOR THE NIGHT`, 'Nobody reached them in time. The Candy Lady can bring them back.', 'danger');
        gameAudio.play('hurt', 0.5);
        continue;
      }
      const d = gap(f);
      if ((d < 2 || (f.channel && d < 2.6)) && (!helping || d < gap(helping))) helping = f;
    }
    for (const f of team) if (f.hp <= 0 && f !== helping) { f.channel = false; f.progress = Math.max(0, f.progress - dt * 2); }
    if (helping && this.state === 'play') {
      const f = helping, name = HERO_INFO[f.hero].name;
      if (this.input.pressed.has('e') || this.input.keys.has('e')) f.channel = true;
      if (f.channel) {
        f.pauseT = Math.max(0, (f.pauseT ?? 0) - dt);
        if (this.p.hurtT > 0) f.pauseT = 0.35; // a hit stalls the revive for a moment, it never wipes it
        if (!f.pauseT) f.progress += dt * this.stats.reviveSpeed;
      }
      this.rescuePrompt = f.channel ? `Helping ${name} up…` : `Revive ${name} · ${Math.ceil(this.friendCountdown - (f.downT ?? 0))}s ${this.friendUpTime ? 'until they get up' : 'left'}`;
      this.rescueProgress = Math.min(1, f.progress / RESCUE_TIME);
      if (f.progress >= RESCUE_TIME) { f.hp = f.maxHp * 0.5; f.progress = 0; f.channel = false; f.hurtCd = 3; f.downT = 0; gameAudio.play('revive'); }
    }
    const standing = this.friends.filter(f => f.status === 'rescued' && f.hp > 0 && !(f.abductT!>0));
    // if the player is down, the nearest friend who still has a revive in them comes to pick them up
    const reviver = this.state === 'downed' ? standing.filter(f => f.reviveCd <= 0).sort((x, y) => gap(x) - gap(y))[0] ?? null : null;
    if (this.state === 'downed' && !reviver) { this.endRun(false); return; }
    standing.forEach((friend, slot) => {
      friend.reviveCd = Math.max(0, friend.reviveCd - dt); friend.hurtCd = Math.max(0, friend.hurtCd - dt);
      if (this.stats.mateRegen && this.state === 'play') friend.hp = Math.min(friend.maxHp, friend.hp + this.stats.mateRegen * dt);
      const distance = gap(friend);
      // Following comes first. Each friend keeps their own spot in the group so they do not stand in one pile.
      const keep = friend === reviver ? 0.7 : 1.5 + (slot % 4) * 0.45;
      // Start walking a little later than they stop, or a friend standing right on their spot flips between walking
      // and standing every frame (it showed on whoever had the nearest spot once four were following).
      friend.chase = friend.chase ? distance > keep : distance > keep + 0.45;
      friend.moveT = Math.max(0, (friend.moveT ?? 0) - dt); friend.aimT = Math.max(0, (friend.aimT ?? 0) - dt);
      if (friend.chase) {
        const direction = this.flowDir(friend.x, friend.y);
        const dx = direction?.x ?? (this.p.x - friend.x) / (distance || 1), dy = direction?.y ?? (this.p.y - friend.y) / (distance || 1);
        // the player's own pace (same 3.4 tiles/s base and move bonuses), a little quicker so they close the gap, and a
        // sprint when they have fallen behind (a dash, a corner)
        const pace = 3.4 * this.stats.move * (distance > 4 ? 1.6 : 1.1);
        this.moveCircle(friend, dx * pace * dt, dy * pace * dt, friend.r);
        friend.moveT = 0.2;
        // While they are shooting they keep facing what they shoot at; otherwise they turn toward where they walk,
        // smoothly, so a step round a corner or a shove from another kid does not snap the sprite about.
        if (!friend.aimT) {
          const k = Math.min(1, dt * 10), fx = (friend.faceX ?? dx) + (dx - (friend.faceX ?? dx)) * k, fy = (friend.faceY ?? dy) + (dy - (friend.faceY ?? dy)) * k;
          friend.faceX = fx; friend.faceY = fy; friend.back = fy < 0; friend.flip = fx < 0;
        }
      }
      friend.moving = friend.moveT > 0;
      friend.anim += dt * (friend.moving ? 8 : 3);
      for (const other of standing) {
        if (other === friend) continue;
        const ox = friend.x - other.x, oy = friend.y - other.y, d = Math.hypot(ox, oy);
        if (d < 0.55) this.moveCircle(friend, (d ? ox / d : 1) * (0.55 - d) * 0.5, (d ? oy / d : 0) * (0.55 - d) * 0.5, friend.r);
      }
      // never left behind: far away, or stuck out of reach for a few seconds, they turn up beside the player
      friend.farT = distance > 5 ? (friend.farT ?? 0) + dt : 0;
      if ((distance > 12 || friend.farT > 3) && this.state !== 'downed') { Object.assign(friend, this.freeSpot(this.p.x + 1 + slot * 0.4, this.p.y + 1, true)); friend.farT = 0; }
      for (const e of this.enemies) if (!e.dead && friend.hurtCd <= 0 && Math.hypot(e.x - friend.x, e.y - friend.y) < e.r + 0.6) {
        friend.hp = Math.max(0, friend.hp - e.def.dmg * this.threat() * MOB_DAMAGE * (1 - this.stats.companionArmor)); friend.hurtCd = 0.8;
        if (friend === reviver) this.playerReviveProgress = 0;
      }
      for (const bullet of this.ebullets) if (!bullet.dead && Math.hypot(bullet.x - friend.x, bullet.y - friend.y) < bullet.r + friend.r && friend.hurtCd <= 0) {
        bullet.dead = true; friend.hp = Math.max(0, friend.hp - bullet.dmg * this.threat() * MOB_DAMAGE * (1 - this.stats.companionArmor)); friend.hurtCd = 0.8;
        if (friend === reviver) this.playerReviveProgress = 0;
      }
      if (friend.hp <= 0) { friend.downT = 0; this.toast(this.friendUpTime ? `${HERO_INFO[friend.hero].name} is down! Back up in ${this.friendUpTime} seconds, sooner with your help.` : `${HERO_INFO[friend.hero].name} is down! ${this.friendDownTime} seconds to help them up.`); gameAudio.play('hurt', 0.35); return; }
      if (this.state === 'downed') return; // everyone's attention is on the player
      for (const pickup of this.pickups) if (pickup.friendOnly && !pickup.dead && Math.hypot(pickup.x - friend.x, pickup.y - friend.y) < 6) {
        pickup.dead = true; friend.candy++; friend.hp = Math.min(friend.maxHp, friend.hp + 5); gameAudio.play('pickup', 0.25);
      }
      this.friendShoot(friend, dt);
    });
    if (this.state === 'downed' && reviver) {
      this.downedTime -= dt;
      if (reviver.hp > 0 && gap(reviver) < 1.1 && reviver.hurtCd <= 0) this.playerReviveProgress += dt * this.stats.reviveSpeed; else this.playerReviveProgress = 0;
      this.rescuePrompt = `${HERO_INFO[reviver.hero].name} is reviving you · ${Math.ceil(this.downedTime)}s left`;
      this.rescueProgress = Math.min(1, this.playerReviveProgress / 3);
      if (this.playerReviveProgress >= 3) {
        this.p.hp = this.stats.maxHp * 0.4; this.p.shield = 0; this.p.invuln = 3; this.state = 'play'; reviver.reviveCd = this.friendReviveCd; this.playerReviveProgress = 0;
        gameAudio.play('revive'); this.setBanner('BACK TOGETHER!', `${HERO_INFO[reviver.hero].name} saved you. Their revive recharges in ${this.friendReviveCd} seconds.`);
      } else if (this.downedTime <= 0) this.endRun(false);
    }
  }
  /** one friend's gun: reload, pick the nearest monster in range and sight, fire */
  private friendShoot(friend: RescueFriend, dt: number) {
    const mate = this.stats, weapon = friend.weapon, base = weaponStats(weapon, mate);
    // Buddy System: their own rate of fire, reach and extra projectile
    const st = { ...base, rate: base.rate * mate.mateRate, range: base.range * mate.mateRange, pellets: base.pellets + (weapon.def.kind === 'slash' ? 0 : mate.matePellets) };
    weapon.cd -= dt;
    if (weapon.reloadT > 0) { weapon.reloadT -= dt; if (weapon.reloadT <= 0) weapon.ammo = st.mag; return; }
    if (weapon.ammo <= 0) { weapon.reloadT = st.reload; return; }
    let target: Enemy | null = null, nearest = st.range;
    for (const enemy of this.enemies) if (!enemy.dead) {
      const d = Math.hypot(enemy.x - friend.x, enemy.y - friend.y);
      if (d < nearest && lineOfSight(this.map, friend.x, friend.y, enemy.x, enemy.y)) { nearest = d; target = enemy; }
    }
    if (!target || weapon.cd > 0) return;
    weapon.cd = 1 / st.rate; weapon.ammo--;
    const angle = Math.atan2(target.y - friend.y, target.x - friend.x);
    friend.faceX = Math.cos(angle); friend.faceY = Math.sin(angle); friend.back = friend.faceY < 0; friend.flip = friend.faceX < 0;
    friend.aimT = 0.45; // hold this facing for a moment: walking must not turn them away between shots
    // Eagle-Eyed Pals: a friend's crit is double damage (their own roll; it does not feed the kid's crit talents)
    const lucky = mate.mateCrit > 0 && Math.random() < mate.mateCrit;
    const damage = st.dmg * 0.65 * mate.companionDmg * (1 + Math.min(friend.candy, 20) * 0.02) * (lucky ? 2 : 1) * (friend.found ? FOUND_FRIEND.dmg : 1);
    if (lucky && !weapon.def.stream) this.text(friend.x, friend.y, 'CRIT!', '#ff4fd8', 11);
    gameAudio.shot(weapon.def.id, 0.2);
    const def = weapon.def;
    if (def.kind === 'beam') {
      // the special beams keep their trick in a friend's hands: the Cryo Ray chills, the Phase Lance leaves its wake
      const beams = def.stream ? 1 : st.pellets;
      for (let i = 0; i < beams; i++) {
        const a = angle + (beams > 1 ? (i - (beams - 1) / 2) * 0.12 : 0);
        if (def.chill || def.stream) this.hitSrc = weapon;
        const len = this.hitscan(friend.x, friend.y, Math.cos(a), Math.sin(a), { ...st, dmg: damage }, def.color, def.elem ?? null, def.stream ? 7 : 5, !!(def.stream || def.trail));
        this.hitSrc = null;
        if (def.trail) this.zones.push({ kind: 'trail', x: friend.x, y: friend.y, x1: friend.x + Math.cos(a) * len, y1: friend.y + Math.sin(a) * len, r: 0.42, t: 0, life: def.trail, dmg: damage * TRAIL_TICK, tick: 0, color: def.color, wake: true });
      }
    } else if (def.kind === 'slash') this.swing(weapon, friend.x, friend.y, angle, { ...st, dmg: damage }, false);
    else for (let i = 0; i < st.pellets; i++) {
      const a = angle + rand(-def.spread, def.spread) + (st.pellets > base.pellets ? (i - (st.pellets - 1) / 2) * 0.1 : 0), life = st.range / Math.max(def.speed, 1);
      // a shot leaves from the gun, not from the middle of the friend: its glow is drawn over the kids and sat on them as a white ball
      const out = cellAt(this.map, friend.x + Math.cos(angle) * 0.45, friend.y + Math.sin(angle) * 0.45) === 2 ? 0 : 0.45;
      this.bullets.push({ x: friend.x + Math.cos(angle) * out, y: friend.y + Math.sin(angle) * out, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, dmg: damage, r: 0.1,
        life, max: life, pierce: st.pierce, bounce: st.bounce, kind: def.kind, color: def.color,
        crit: 0, fire: st.fire, shock: st.shock, ecto: st.ecto, explode: def.explode, hit: [], vamp: false, dead: false, spin: 0, element: def.elem ?? null,
        // only the special guns carry their gun along (trail, boomerang, seeker, singularity, demolition); it flies back to the friend
        ...(def.trail || def.boomerang || def.homing || def.vortex || def.demolish || def.scorch ? { src: weapon, mate: true, by: friend, lx: friend.x, ly: friend.y, home: !!def.homing || undefined, homeK: def.homing } : {}) });
    }
  }

  // ---------- stats ----------
  recalcStats() {
    const s = baseStats();
    HERO_INFO[this.hero].apply(s);
    applyTalents(s, this.save.talents);
    if (this.p?.costume) { COSTUME_BY_ID[this.p.costume].apply(s); s.skillPow *= s.costumePower; }
    for (const id of this.scrollOrder) SCROLL_BY_ID[id].apply(s);
    // resonance: tags across kid, talents, costume, treats and the gun in hand
    this.build = new Build({ hero: this.hero, talents: this.save.talents, costume: this.p?.costume ?? null, scrolls: this.scrolls ?? {}, weapon: this.p ? this.weapon : null });
    const b = this.build;
    s.maxHp *= b.hpMore();
    // friends grow with the Buddy System: more max HP is also that much more HP right now
    for (const f of this.friends ?? []) {
      const max = (FRIEND_HP + s.mateHp) * (f.found ? FOUND_FRIEND.hp : 1);
      if (f.maxHp !== max) { if (f.hp > 0) f.hp = Math.max(1, f.hp + max - f.maxHp); f.maxHp = max; }
    }
    // extreme treats have the last word, whatever else is stacked
    if (s.frail) s.maxHp = 1;
    if (s.bare) s.maxShield = 0;
    s.rate *= b.rateMore();
    s.critDmg *= b.critMore();
    if (b.ks('summon', 3)) { s.orbit += 2; s.familiar *= 2; }
    const prev = this.stats;
    this.stats = s;
    if (this.p) {
      // Preserve health fraction: swapping HP-granting gear is not a healing source.
      this.p.hp = clamp(this.p.hp / prev.maxHp, 0, 1) * s.maxHp;
      this.p.shield = Math.min(this.p.shield, s.maxShield);
    }
  }

  // ---------- costumes ----------
  /** the costume that may drop right now: this kid's own, unless it is already worn or lying somewhere */
  randomCostume(): string | null {
    const id = HERO_COSTUME[this.hero];
    return !id || this.p?.costume === id || this.pickups.some((k) => k.kind === 'costume' && !k.dead) ? null : id;
  }
  dropCostume(x: number, y: number, id: string | null) {
    if (!id || id !== HERO_COSTUME[this.hero]) return;
    this.pickups.push({ x, y, z: 0.6, vz: 3, vx: 0, vy: 0, kind: 'costume', value: 0, costume: id, mag: false, t: 0, dead: false });
  }
  wearCostume(id: string, fx = true) {
    const p = this.p;
    const old = p.costume;
    if (id !== HERO_COSTUME[this.hero]) return old;
    p.costume = id;
    if (!this.costumesWorn.has(id)) {
      this.costumesWorn.add(id);
      this.costumesFound++;
    }
    this.recalcStats();
    p.dashCharges = Math.min(p.dashCharges, this.stats.dashCharges);
    if (fx) {
      const c = COSTUME_BY_ID[id];
      this.text(p.x, p.y, `${c.icon} ${c.name}!`, c.color, 18);
      for (let i = 0; i < 26; i++) {
        const a = rand(0, Math.PI * 2);
        this.particle(p.x, p.y, rand(0.2, 1.4), Math.cos(a) * 2, Math.sin(a) * 2, rand(1, 3), 0.7, i % 2 ? c.color : '#ffffff', 4, i % 3 ? 'sq' : 'glow');
      }
      this.bubble(p.x, p.y, 120, ['Perfect fit!', 'Trick or treat time!', 'Ooh, spooky!', 'Now I look the part!'][Math.floor(Math.random() * 4)], 'kid', 1.6, true);
    }
    return old;
  }
  bubble(x: number, y: number, lift: number, text: string, who: Bubble['who'], life = 1.8, follow = false) {
    if (who === 'kid') this.bubbles = this.bubbles.filter((b) => b.who !== 'kid');
    else this.bubbles = this.bubbles.filter((b) => b.who === 'kid' || Math.hypot(b.x - x, b.y - y) > 0.5);
    this.bubbles.push({ x, y, lift, text, life, max: life, who, follow });
  }

  setBanner(text: string, sub = '', kind: BannerKind = 'info') {
    this.banner = { text, sub, t: 3.5, kind };
  }
  toast(text: string) {
    this.toasts.push({ id: this.toastId++, text, t: 4.5 });
    if (this.toasts.length > 3) this.toasts.shift();
  }
  /** true exactly once, `lead` seconds before `at` (allocation-free on every other frame) */
  private soon(key: number, at: number, lead: number) {
    if (this.time < at - lead || this.time >= at || this.warned.has(key)) return false;
    this.warned.add(key);
    return true;
  }

  get weapon() {
    return this.p.weapons[this.p.cur];
  }

  mouseWorld() {
    const sx = (this.input.mx - this.vw / 2) / this.zoom + this.camX;
    const sy = (this.input.my - this.vh / 2) / this.zoom + this.camY;
    const w = screenToWorld(sx, sy + 20);
    return w;
  }

  // ---------- main update ----------
  private combatActive() { return this.state === 'play' || this.state === 'downed'; }
  update(dtRaw: number) {
    const inp = this.input;
    this.tutorial?.update(this);
    this.closeArcade();
    if (this.heldBanner && !this.tutorial?.holding) { this.banner = { ...this.heldBanner, t: 3.5 }; this.heldBanner = null; } // the night begins
    if (this.state === 'intro') {
      this.updateIntro(Math.min(dtRaw, 0.05));
      inp.endFrame();
      return;
    }
    if (inp.pressed.has('i') && (this.state === 'play' || this.state === 'inventory')) this.state = this.state === 'inventory' ? 'play' : 'inventory';
    if (inp.pressed.has('escape')) {
      if (this.bigMap) this.bigMap = false;
      else if (this.state === 'play') this.state = 'pause';
      else if (this.state === 'pause' || this.state === 'inventory') this.state = 'play';
      else if (this.state === 'hire') this.closeHire();
    }
    if (this.state !== 'play' && this.state !== 'downed') {
      inp.endFrame();
      return;
    }
    if (this.hitStop > 0) {
      this.hitStop -= dtRaw;
      inp.endFrame();
      return;
    }
    const dt = Math.min(dtRaw, 1 / 30);
    if (!this.tutorial?.holding) this.time += dt; // the night waits for the tutorial
    this.premiumPowerT = Math.max(0, this.premiumPowerT - dt);
    if (inp.pressed.has('m')) this.bigMap = !this.bigMap;
    const downed = this.state === 'downed';
    const bk = `${this.weapon?.uid ?? 0}|${this.scrollOrder.length}|${this.p.costume}`;
    if (bk !== this.buildKey) { this.buildKey = bk; this.recalcStats(); }
    if ((this.momentumT -= dt) <= 0) this.momentum = 0;
    if ((this.streakT -= dt) <= 0) this.streak = 0;
    const manning = this.mounted >= 0;
    if (!downed) { if (manning) this.updateMounted(dt); else this.updatePlayer(dt); }
    if (!this.combatActive()) { inp.endFrame(); return; }
    for (const t of this.turrets) { t.heat = Math.max(0, t.heat - TURRET.cool * dt * (t.over > 0 ? 1.6 : 1)); t.over = Math.max(0, t.over - dt); t.recoil = Math.max(0, t.recoil - dt * 10); }
    this.rebuildGrid();
    if (!downed) { if (!manning) this.updateWeapon(dt); this.updateSkill(dt); this.updateCompanions(dt); }
    if (!this.combatActive()) { inp.endFrame(); return; }
    this.computeFlow(false, dt);
    this.updateEnemies(dt);
    if (!this.combatActive()) { inp.endFrame(); return; }
    this.updateBullets(dt);
    if (!this.combatActive()) { inp.endFrame(); return; }
    this.updateEBullets(dt);
    if (!this.combatActive()) { inp.endFrame(); return; }
    this.updateZones(dt);
    if (!this.combatActive()) { inp.endFrame(); return; }
    if (this.state === 'play') this.updatePickups(dt);
    this.updateFx(dt);
    this.updateWrecks(dt);
    this.director(dt);
    this.updateTeam(dt);
    if (!this.combatActive()) { inp.endFrame(); return; }
    this.runProcs();
    if (!this.combatActive()) { inp.endFrame(); return; }
    if (this.endless) this.updateEndless(dt);
    // A boss death empties the fight inside a bullet/zone update: the frame ends here and the calm begins.
    if (this.bossBreak) { this.bossBreak = false; inp.endFrame(); return; }
    if (this.calmT > 0 && this.state === 'play') {
      this.calmT -= dt;
      if (this.calmT <= 0) { this.calmT = 0; this.spawnAcc = 0; this.toast('The quiet is over. The monsters are back!'); gameAudio.play('guardian', 0.4); }
    }
    if (this.state === 'play') { this.updateTot(dt); if (this.state === 'play') this.updateInteract(); }
    if (this.bossKilled && !this.endless && this.calmT <= 0) {
      this.winDelay += dt;
      if (this.winDelay >= 3.5 && this.state === 'play') this.startEndless();
    }
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    if (this.toasts.length) {
      for (const q of this.toasts) q.t -= dt;
      if (this.toasts[0].t <= 0) this.toasts = this.toasts.filter((q) => q.t > 0);
    }
    // a boss prize waits for a doorbell in progress: the bowl comes first, then the prize, never one in the middle of the other
    if (this.bossPrizes.length && this.state === 'play' && !this.tot) {
      const prize = this.bossPrizes.shift()!;
      this.openLevelUp('boss', prize.n, prize.luck, rewardRangeFor('boss'));
    }
    inp.endFrame();
  }

  // ---------- player ----------
  private moveCircle(o: { x: number; y: number }, dx: number, dy: number, r: number, solidLevel = 1) {
    const blocked = (x: number, y: number) => {
      const cx0 = Math.floor((x - r) * CR), cx1 = Math.floor((x + r) * CR);
      const cy0 = Math.floor((y - r) * CR), cy1 = Math.floor((y + r) * CR);
      for (let cy = cy0; cy <= cy1; cy++)
        for (let cx = cx0; cx <= cx1; cx++) {
          if (cx < 0 || cy < 0 || cx >= CW || cy >= CH) return true;
          if (this.map.coll[cy * CW + cx] >= solidLevel) return true;
        }
      return false;
    };
    if (blocked(o.x, o.y)) {
      // already overlapping a wall (spawned/pushed in) -> let it slide out freely
      const nx = o.x + dx, ny = o.y + dy;
      if (!blocked(nx, ny)) { o.x = nx; o.y = ny; }
      return;
    }
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / (0.5 / CR)));
    for (let i = 0; i < steps; i++) {
      if (dx && !blocked(o.x + dx / steps, o.y)) o.x += dx / steps;
      if (dy && !blocked(o.x, o.y + dy / steps)) o.y += dy / steps;
    }
  }

  private updatePlayer(dt: number) {
    const p = this.p, inp = this.input, s = this.stats;
    let sx = inp.touchMoveX ?? 0, sy = inp.touchMoveY ?? 0;
    if (inp.keys.has('w')) sy -= 1;
    if (inp.keys.has('s')) sy += 1;
    if (inp.keys.has('a')) sx -= 1;
    if (inp.keys.has('d')) sx += 1;
    if (this.tot) {
      // frozen at the door: no moving, no dashing (Space = flee & cancel)
      p.moving = false;
      p.back = true;
      p.anim += dt * 4;
      p.invuln -= dt;
      p.hurtT -= dt;
      p.recoil = Math.max(0, p.recoil - dt * 8);
      p.shieldT += dt;
      if (p.shieldT > s.shieldDelay && p.shield < s.maxShield) p.shield = Math.min(s.maxShield, p.shield + s.maxShield * (p.costume === 'astronaut' ? 0.8 : 0.4) * dt);
      if (inp.pressed.has(' ')) this.cancelTot(true);
      return;
    }
    p.moving = !!(sx || sy);
    this.stillT = p.moving ? 0 : this.stillT + dt;
    let mx = 0, my = 0;
    if (p.moving) {
      const d = screenDirToWorld(sx, sy);
      const strength = Math.min(1, Math.hypot(sx, sy));
      mx = d.x * strength; my = d.y * strength;
    }
    // dash
    p.dashRecharge += dt;
    if (p.dashCharges < s.dashCharges && p.dashRecharge >= 2.2) {
      p.dashCharges++;
      p.dashRecharge = 0;
    }
    if (inp.pressed.has(' ') && p.dashCharges > 0 && p.dashT <= 0) {
      p.dashCharges--;
      p.dashRecharge = 0;
      p.dashT = 0.2;
      if (s.skate && this.weapon) { const ww = this.weapon; ww.reloadT = 0; ww.ammo = weaponStats(ww, s).mag; }
      gameAudio.play('dash', 0.5);
      p.invuln = Math.max(p.invuln, 0.3);
      const dx = p.moving ? mx : p.aimX, dy = p.moving ? my : p.aimY;
      const dashLength = Math.hypot(dx, dy) || 1;
      p.dashX = dx / dashLength; p.dashY = dy / dashLength;
      this.dashHit.clear();
      for (let i = 0; i < 12; i++) this.particle(p.x, p.y, 0.1, rand(-1, 1), rand(-1, 1), rand(0.5, 1.5), 0.4, '#e8f0ff', 3, 'sq');
    }
    let speed = 3.4 * s.move * (this.ins(this.weapon, 'tummy') ? 0.85 : 1);
    if (p.dashT > 0) {
      p.dashT -= dt;
      mx = p.dashX; my = p.dashY;
      speed = 13;
      if (s.dashFire && Math.random() < 0.6) this.zones.push({ kind: 'fire', x: p.x, y: p.y, r: 0.6, t: 0, life: 2.5, dmg: 5 * s.dmg, tick: 0 });
      this.particle(p.x, p.y, 0.4, 0, 0, 0, 0.25, p.costume === 'hero' ? '#ff4a3a' : '#bcd4ff', 6, 'glow');
      if (p.costume === 'hero') {
        this.query(p.x, p.y, 1.2, (e) => {
          if (this.dashHit.has(e.id) || Math.hypot(e.x - p.x, e.y - p.y) > e.r + 0.6) return;
          this.dashHit.add(e.id);
          const dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1;
          this.applyHit(e, 48 * s.dmg * s.skillPow, Math.random() < s.crit, 0, 0, 0, (dx / l) * 4 + p.dashX * 2, (dy / l) * 4 + p.dashY * 2);
          e.stunT = Math.max(e.stunT, 0.5);
        });
      }
    }
    // ghosts phase through low obstacles (fences, hedges, graves)
    this.moveCircle(p, mx * speed * dt, my * speed * dt, p.r, p.costume === 'ghost' ? 2 : 1);
    p.anim += dt * (p.moving ? 10 : 4);
    p.invuln -= dt;
    p.hurtT -= dt;
    p.recoil = Math.max(0, p.recoil - dt * 8);
    p.shieldT += dt;
    if (p.shieldT > s.shieldDelay && p.shield < s.maxShield) p.shield = Math.min(s.maxShield, p.shield + s.maxShield * (p.costume === 'astronaut' ? 0.8 : 0.4) * dt);
    // facing
    const fx = p.aiming ? p.aimX : mx, fy = p.aiming ? p.aimY : my;
    if (fx || fy) {
      const scx = isoX(fx, fy), scy = isoY(fx, fy);
      p.back = scy < -2;
      p.flip = scx < 0;
    }
    // weapon swap
    // mouse wheel: zoom in (up to 1.6x) or back out a little; Q, 1 and 2 swap guns
    if (inp.wheel !== 0) this.userZoom = clamp(this.userZoom * (inp.wheel < 0 ? 1.1 : 1 / 1.1), 0.85, 1.6);
    if (inp.pressed.has('q') || inp.pressed.has('1') || inp.pressed.has('2')) {
      let n = p.cur;
      if (inp.pressed.has('1')) n = 0;
      else if (inp.pressed.has('2')) n = 1;
      else n = 1 - p.cur;
      if (p.weapons[n] && n !== p.cur) { p.cur = n; gameAudio.play('click', 0.3); }
    }
    if (inp.pressed.has('r')) {
      const w = this.weapon;
      if (w && w.reloadT <= 0 && w.ammo < weaponStats(w, s).mag) { w.reloadT = weaponStats(w, s).reload; gameAudio.play('reload', 0.4); }
    }
  }

  // ---------- Candy Cannon ----------
  mountTurret(i: number) {
    const t = this.turrets[i];
    if (!t || this.mounted >= 0) return;
    this.mounted = i;
    this.p.x = t.x; this.p.y = t.y; this.p.dashT = 0; this.p.moving = false;
    gameAudio.play('click', 0.5);
    this.text(t.x, t.y, 'CANDY CANNON!', '#ff8a1e', 16);
    this.computeFlow(true);
  }
  dismount() {
    const t = this.turrets[this.mounted];
    this.mounted = -1;
    if (!t) return;
    // hop off on the side the cannon faces away from (back toward safety), else anywhere clear
    const spot = this.freeSpot(t.x - t.aimX * 2.1, t.y - t.aimY * 2.1);
    this.p.x = spot.x; this.p.y = spot.y;
    this.p.invuln = Math.max(this.p.invuln, 0.4);
    this.computeFlow(true);
  }
  private updateMounted(dt: number) {
    const p = this.p, inp = this.input, s = this.stats, t = this.turrets[this.mounted];
    p.x = t.x; p.y = t.y; p.moving = false;
    p.anim += dt * 4; p.invuln -= dt; p.hurtT -= dt; p.recoil = Math.max(0, p.recoil - dt * 8);
    p.shieldT += dt;
    if (p.shieldT > s.shieldDelay && p.shield < s.maxShield) p.shield = Math.min(s.maxShield, p.shield + s.maxShield * 0.4 * dt);
    p.dashRecharge += dt;
    if (p.dashCharges < s.dashCharges && p.dashRecharge >= 2.2) { p.dashCharges++; p.dashRecharge = 0; }
    if (inp.pressed.has(' ')) { this.dismount(); return; }
    // aim: mouse while held, otherwise the nearest monster in range
    const manual = inp.mdown || inp.touchFiring;
    let target: Enemy | null = null;
    if (manual) {
      if (inp.touchFiring) {
        const aim = screenDirToWorld(inp.touchAimX, inp.touchAimY);
        t.aimX = aim.x; t.aimY = aim.y;
      } else {
        const m = this.mouseWorld(), dx = m.x - t.x, dy = m.y - t.y, l = Math.hypot(dx, dy) || 1;
        t.aimX = dx / l; t.aimY = dy / l;
      }
    } else {
      target = this.findTarget(TURRET.range);
      if (target) { const dx = target.x - t.x, dy = target.y - t.y, l = Math.hypot(dx, dy) || 1; t.aimX = dx / l; t.aimY = dy / l; }
    }
    p.aimX = t.aimX; p.aimY = t.aimY; p.aiming = true;
    const sx = isoX(t.aimX, t.aimY), sy = isoY(t.aimX, t.aimY);
    p.back = sy < -2; p.flip = sx < 0;
    t.cd -= dt;
    if (t.over > 0 || t.cd > 0 || !(manual || target)) return;
    t.cd = 1 / TURRET.rate;
    t.barrel ^= 1; t.recoil = 1;
    t.heat += TURRET.heatPerShot;
    if (t.heat >= 1) { t.heat = 1; t.over = TURRET.lockout; this.text(t.x, t.y, 'OVERHEATED!', '#ff5a3a', 15); gameAudio.play('reload', 0.5); }
    gameAudio.play('shot', 0.55);
    this.shake = Math.max(this.shake, 2.5);
    const a = Math.atan2(t.aimY, t.aimX) + rand(-0.03, 0.03), side = t.barrel ? 0.16 : -0.16;
    const mx = t.x + t.aimX * 0.7 - t.aimY * side, my = t.y + t.aimY * 0.7 + t.aimX * side;
    this.particle(mx, my, 1.8, 0, 0, 0, 0.07, '#ffb43c', 22, 'glow');
    const cr = this.crit(s.crit, s.critDmg);
    const dmg = TURRET.dmg * s.dmg * (1 + this.time / 240) * cr.mul * this.build.summonMore() * this.globalMore();
    const crit = cr.layers > 0;
    this.bullets.push({
      x: mx, y: my, vx: Math.cos(a) * TURRET.speed, vy: Math.sin(a) * TURRET.speed, dmg, r: 0.16, life: TURRET.range / TURRET.speed, pierce: 1, bounce: 0, kind: 'candy', color: ['#ff4d6d', '#ffd23a', '#7dff5a', '#21d0ff'][(Math.random() * 4) | 0],
      crit: crit ? 1 : 0, fire: 0, shock: 0, ecto: 0, explode: 0, hit: [], vamp: false, dead: false, spin: rand(0, 6), z: 58,
    });
  }

  takeDamage(dmg: number, fromX: number, fromY: number) {
    const p = this.p;
    if (p.invuln > 0 || this.state !== 'play' || this.bossBreak) return; // nothing lands in the frame the boss fell
    dmg *= this.threat() * MOB_DAMAGE;
    if (this.mounted >= 0) dmg *= 1 - TURRET.armor; // high ground
    if (this.ins(this.weapon, 'glasspump')) dmg *= 1.15;
    if (Math.random() < this.stats.dodge) {
      this.text(p.x, p.y, 'DODGE', '#dfe8ff', 14);
      p.invuln = 0.25;
      return;
    }
    if (p.costume === 'pumpkin' && p.novaCd <= 0) {
      p.novaCd = 2;
      this.explode(p.x, p.y, 3.8, 64 * this.stats.dmg * this.stats.skillPow * this.globalMore(), 'fire', true);
      if (this.state !== 'play' || this.bossBreak) return; // the nova felled the boss: the hit that set it off is void
    }
    dmg *= 1 - this.stats.armor;
    p.shieldT = 0;
    if (p.shield > 0) {
      const a = Math.min(p.shield, dmg);
      p.shield -= a;
      dmg -= a;
      if (p.shield <= 0) this.text(p.x, p.y, 'SHIELD BROKEN', '#7fd8ff', 14);
    }
    p.hp -= dmg;
    gameAudio.play('hurt');
    p.invuln = 0.45;
    p.hurtT = 0.25;
    this.shake = Math.max(this.shake, 6);
    const dx = p.x - fromX, dy = p.y - fromY, l = Math.hypot(dx, dy) || 1;
    if (this.mounted < 0) this.moveCircle(p, (dx / l) * 0.15, (dy / l) * 0.15, p.r);
    if (p.hp <= 0 && this.mounted >= 0) this.dismount();
    if (p.hp <= 0) {
      if (p.revives > 0) {
        p.revives--;
        p.hp = this.stats.maxHp * 0.5;
        p.invuln = 2;
        this.setBanner('SECOND WIND!', 'Back on your feet');
        this.explode(p.x, p.y, 3.5, 80, 'fire', true);
      } else {
        p.hp = 0;
        const friend = this.friends.find(f => f.status === 'rescued' && f.hp > 0 && f.reviveCd <= 0 && !(f.abductT!>0));
        if (friend) {
          this.state = 'downed'; this.downedTime = 15; this.playerReviveProgress = 0;
          this.setBanner('HANG ON!', `${HERO_INFO[friend.hero].name} is coming to revive you`, 'danger');
        } else this.endRun(false);
      }
    }
  }

  endRun(victory: boolean) {
    gameAudio.play(victory ? 'victory' : 'hurt');
    this.state = victory ? 'victory' : 'dead';
    this.bankRewards();
    this.recordUpload = leaderboard.finish(this.recordRun, this.campaign ? 'rescue' : 'survival', this.time,
      { hero: HERO_INFO[this.hero].name, wave: this.totalWave, bosses: this.bossWins, victory }, expansion.snapshot().preview);
  }
  /** tally essence and bank only what hasn't been paid yet (safe to call at victory and again at the very end) */
  private bankRewards() {
    // Essence is for what the run did: nothing for walking in and out (a wave pays once it is behind you)
    this.essence = { combat: Math.floor(this.xpCollected / 8), kills: Math.floor(this.kills / 10), survival: Math.floor(this.time / 8), bosses: this.bossWins * 100, waves: Math.max(0, this.totalWave - 1) * 20 };
    this.soulEarned = Object.values(this.essence).reduce((sum, value) => sum + value, 0);
    const additional = Math.max(0, this.soulEarned - this.soulPaid);
    const had = hasFullGame();
    this.save.earned = essenceEarned(this.save) + additional; // counted before the new Essence lands in the balance
    this.save.soul += additional;
    this.soulPaid += additional;
    this.save.best = Math.max(this.save.best, Math.floor(this.time));
    this.save.bestWave = Math.max(this.save.bestWave ?? 0, this.totalWave);
    storeSave(this.save);
    if (!had && hasFullGame()) this.fullGameEarned = true; // this run took the save past ESSENCE_UNLOCK
  }
  /** this run's Essence unlocked the full game (the end screen says so) */
  fullGameEarned = false;

  // ---------- weapons ----------
  private findTarget(range: number) {
    const p = this.p;
    let best: Enemy | null = null, bd = range * range;
    const cands: [number, Enemy][] = [];
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const d = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
      if (d < bd) cands.push([d, e]);
    }
    cands.sort((a, b) => a[0] - b[0]);
    for (let i = 0; i < Math.min(6, cands.length); i++) {
      const e = cands[i][1];
      if (e.def.fly || lineOfSight(this.map, p.x, p.y, e.x, e.y)) {
        best = e;
        bd = cands[i][0];
        break;
      }
    }
    return best;
  }

  // ---------- buildcraft ----------
  /** run-wide "more" multiplier on everything you shoot: momentum, Juggernaut, Bulwark, Sugar High */
  globalMore() {
    const b = this.build, s = this.stats;
    let m = 1 + this.momentum * b.momentumPer();
    // each of these tops out at +100%: stacking HP, shield or speed is strong, never a runaway damage engine
    if (b.ks('tank', 1)) m *= 1 + Math.min(1, Math.max(0, s.maxHp - 100) / 500);
    if (b.ks('tank', 3)) m *= 1 + Math.min(1, s.maxShield / 500);
    if (b.ks('sugar', 2)) m *= clamp(s.move, 1, 2);
    if (this.premiumPowerT > 0) m *= this.hero === 4 ? 3 : 2;
    if (s.goldDmg) m *= 1 + Math.min(GOLD_DMG.max, this.p.coins * GOLD_DMG.perCoin); // Temple Idol: rich kids hit harder
    return m;
  }
  /** crit roll with Lucky Streak stacks (capped); past 100% it becomes overcrit layers, which add rather than multiply */
  crit(chance: number, critMul: number) { return rollCrit(chance + this.streak * 0.02, critMul); }
  /** Endless Night threat: monster damage multiplier (grows forever) */
  threat() { return Math.pow(1.12, this.wave - 1); }
  private queueBlast(x: number, y: number, r: number, dmg: number) {
    if (this.procGen >= 5 || this.procQueue.length > 60) return;
    this.procQueue.push({ x, y, r, dmg, gen: this.procGen + 1 });
  }
  private runProcs() {
    // a few per frame keeps chain reactions readable and cheap; the rest pop next frame
    for (let n = 0; n < 12 && this.procQueue.length && this.combatActive(); n++) {
      const q = this.procQueue.shift()!;
      this.procGen = q.gen;
      this.explode(q.x, q.y, q.r, q.dmg, null, true);
      this.procGen = 0;
    }
  }

  // ---------- inscriptions ----------
  private ins(w: Weapon | null | undefined, id: string) { return !!w && w.traits.includes(id); }
  private fxOf(w: Weapon) { return (w.fx ??= { shots: 0, combo: 0, comboT: 0, fresh: 0, hasty: 0, ramp: 0, rampT: 0 }); }
  /** trigger-inscription damage multiplier for the shot about to leave the barrel */
  private shotMul(w: Weapon) {
    const fx = this.fxOf(w);
    let m = 1;
    if (this.ins(w, 'opener') && fx.shots === 0) m *= 2;
    if (this.ins(w, 'fresh') && fx.fresh > 0) m *= 1.4;
    if (this.ins(w, 'combo')) m *= 1 + 0.03 * Math.min(COMBO_MAX, fx.combo);
    if (this.ins(w, 'freeze') && this.stillT >= 1) m *= 1.3;
    if (this.ins(w, 'sixth') && (fx.shots + 1) % 6 === 0) m *= 1.8;
    // run-wide treats
    const s = this.stats;
    if (s.sixth && (fx.shots + 1) % 6 === 0) m *= 1.6;
    if (s.fullBag && w.ammo >= weaponStats(w, s).mag * 0.8) m *= 1.4;
    if (s.statue && this.stillT >= 1) m *= 1.35;
    if (s.bluff && this.p.hp >= s.maxHp - 0.5) m *= 1.25;
    return m * this.globalMore();
  }
  private rateMul(w: Weapon) {
    const fx = this.fxOf(w);
    let m = 1;
    if (this.ins(w, 'trot') && this.p.moving) m *= 1.15;
    if (this.ins(w, 'scaredy') && this.p.hp < this.stats.maxHp * 0.35) m *= 1.35;
    if (this.ins(w, 'seconds') && fx.hasty > 0) m *= 1.3;
    return m;
  }
  private updateWeapon(dt: number) {
    const p = this.p, w = this.weapon, s = this.stats;
    for (const ww of p.weapons) if (ww?.fx) {
      const fx = ww.fx;
      fx.fresh -= dt; fx.hasty -= dt; fx.comboT -= dt;
      if (fx.comboT <= 0) fx.combo = 0;
      if ((fx.rampT = (fx.rampT ?? 0) - dt) <= 0) fx.ramp = 0; // a stream cools off the moment it is let go
    }
    if (!w) return;
    const st = weaponStats(w, s);
    w.cd -= dt;
    // aim
    const manual = this.input.mdown || this.input.touchFiring;
    let target: Enemy | null = null;
    if (manual) {
      if (this.input.touchFiring) {
        const aim = screenDirToWorld(this.input.touchAimX, this.input.touchAimY);
        p.aimX = aim.x; p.aimY = aim.y;
      } else {
        const m = this.mouseWorld();
        const dx = m.x - p.x, dy = m.y - p.y, l = Math.hypot(dx, dy) || 1;
        p.aimX = dx / l; p.aimY = dy / l;
      }
      p.aiming = true;
    } else {
      target = this.findTarget(st.range);
      if (target) {
        const dx = target.x - p.x, dy = target.y - p.y, l = Math.hypot(dx, dy) || 1;
        p.aimX = dx / l; p.aimY = dy / l;
        p.aiming = true;
      } else p.aiming = false;
    }
    if (w.reloadT > 0) {
      w.reloadT -= dt;
      if (w.reloadT <= 0) {
        const fx = this.fxOf(w);
        if (w.ammo <= 0 && this.ins(w, 'fresh')) { fx.fresh = 4; this.text(p.x, p.y, 'FRESH BATCH!', '#3fd0e0', 12); }
        w.ammo = st.mag; fx.shots = 0;
      }
      return;
    }
    if (this.tot) return; // hands are full of candy bag - can't shoot while trick-or-treating
    if (w.ammo <= 0) {
      w.reloadT = st.reload;
      gameAudio.play('reload', 0.4);
      return;
    }
    if (w.cd <= 0 && (manual || target)) {
      // rate past what a gun can shoot overflows into projectiles (Sugar · Overclock) or damage — never wasted
      const ov = rateOverflow(st.rate * this.rateMul(w), st.pellets, this.build.ks('sugar', 1));
      w.cd = 1 / ov.shots;
      w.ammo--;
      this.fire(w, ov.pellets === st.pellets && ov.dmgMul === 1 ? st : { ...st, pellets: ov.pellets, dmg: st.dmg * ov.dmgMul });
      if (w.ammo <= 0) w.reloadT = st.reload;
    }
  }

  private fire(w: Weapon, st0: ReturnType<typeof weaponStats>) {
    gameAudio.shot(w.def.id);
    const p = this.p, d = w.def;
    const mul = this.shotMul(w);
    this.fxOf(w).shots++;
    const st = mul === 1 ? st0 : { ...st0, dmg: st0.dmg * mul };
    if (mul >= 1.75) this.particle(p.x + p.aimX * 0.5, p.y + p.aimY * 0.5, 0.5, 0, 0, 0, 0.18, '#3fd0e0', 30, 'glow');
    const base = Math.atan2(p.aimY, p.aimX);
    const n = Math.floor(st.pellets) + (Math.random() < st.pellets % 1 ? 1 : 0);
    if (this.build.ks('sugar', 3) && this.fxOf(w).shots % 20 === 0) {
      // Hyperactive: a free ring of 8
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * st.speed, vy: Math.sin(a) * st.speed, dmg: st.dmg, r: 0.12, life: st.range / Math.max(1, st.speed), pierce: st.pierce, bounce: st.bounce, kind: d.kind === 'beam' ? 'pea' : d.kind, color: d.color, crit: 0, fire: st.fire, shock: st.shock, ecto: st.ecto, explode: 0, hit: [], vamp: false, dead: false, spin: 0, src: w, child: true });
      }
    }
    p.recoil = 1;
    this.shake = Math.max(this.shake, d.shake);
    const mx = p.x + p.aimX * 0.45, my = p.y + p.aimY * 0.45;
    // muzzle flash
    this.particle(mx, my, 0.45, 0, 0, 0, 0.08, d.color, 22, 'glow');
    if (d.kind === 'beam') {
      let beam = st;
      if (d.stream) {
        // held on target the stream ramps: +6% a tick, up to +120%
        const fx = this.fxOf(w);
        fx.ramp = Math.min(STREAM_RAMP_MAX, (fx.ramp ?? 0) + 1); fx.rampT = 0.4;
        beam = { ...st, dmg: st.dmg * (1 + fx.ramp * 0.06) };
      }
      for (let i = 0; i < n; i++) {
        const a = base + (n > 1 ? (i - (n - 1) / 2) * 0.12 : 0);
        this.hitSrc = w;
        const len = this.hitscan(mx, my, Math.cos(a), Math.sin(a), beam, d.color, d.elem ?? null, d.stream ? 7 + (this.fxOf(w).ramp ?? 0) * 0.25 : 5, !!(d.stream || d.trail));
        this.hitSrc = null;
        // Phase Lance: the bolt's wake hangs in the air and keeps cutting
        if (d.trail) this.zones.push({ kind: 'trail', x: mx, y: my, x1: mx + Math.cos(a) * len, y1: my + Math.sin(a) * len, r: 0.42, t: 0, life: d.trail, dmg: st.dmg * TRAIL_TICK, tick: 0, color: d.color, wake: true });
      }
      return;
    }
    if (d.kind === 'slash') {
      // Thunder Sabre: one swing hits everything in the arc, whatever stands in front of whatever
      this.swing(w, p.x, p.y, base, st, true);
      return;
    }
    for (let i = 0; i < n; i++) {
      let a = base;
      if (d.pellets > 1 || n > 1) {
        const spreadTot = d.pellets > 1 ? d.spread : 0.12 * (n - 1);
        a += n > 1 ? (i / (n - 1) - 0.5) * spreadTot : 0;
        a += rand(-0.04, 0.04);
      } else a += rand(-d.spread, d.spread) * 0.5;
      const sp = st.speed * rand(0.92, 1.08);
      const cr = this.crit(st.crit, st.critMul);
      const haunted = this.ins(w, 'haunted');
      this.bullets.push({
        x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: st.dmg * (cr.layers ? cr.mul : this.stats.owl ? 0.75 : 1), r: d.kind === 'rocket' || d.kind === 'balloon' || d.kind === 'shell' || d.kind === 'void' || d.kind === 'flame' || d.kind === 'glaive' ? 0.22 : 0.12,
        life: st.range / sp + 0.05, pierce: st.pierce, bounce: st.bounce, kind: d.kind, color: d.color, crit: cr.layers, fire: st.fire, shock: st.shock, ecto: st.ecto,
        explode: d.explode * this.stats.skillPow ** 0.3, hit: [], vamp: st.vamp, dead: false, spin: rand(0, 6), src: w, home: haunted || !!d.homing || undefined, homeK: haunted ? 2.4 : d.homing,
        lx: mx, ly: my, max: st.range / sp + 0.05,
      });
    }
  }

  /** a blade swung from (x, y) toward `base`: everything in the arc is cut (the kid's swings can crit, a friend's do not) */
  private swing(w: Weapon, x: number, y: number, base: number, st: ReturnType<typeof weaponStats>, crits: boolean) {
    const d = w.def, R = st.range, half = d.arc ?? 0.9;
    this.zones.push({ kind: 'flash', x, y, r: R, t: 0, life: 0.2, dmg: 0, tick: 0, ang: base, arc: half, color: d.color });
    this.hitSrc = w;
    for (const e of this.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      const ex = e.x - x, ey = e.y - y, dist = Math.hypot(ex, ey);
      if (dist > R + e.r) continue;
      let da = Math.atan2(ey, ex) - base;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > half && dist > 0.9) continue;
      if (!e.def.fly && !lineOfSight(this.map, x, y, e.x, e.y)) continue;
      const cr = crits ? this.crit(st.crit, st.critMul) : { layers: 0, mul: 1 };
      this.applyHit(e, st.dmg * (cr.layers ? cr.mul : crits && this.stats.owl ? 0.75 : 1), cr.layers, st.fire, st.shock, st.ecto, ex / (dist || 1), ey / (dist || 1), crits && st.vamp, false, { element: d.elem ?? null, pierce: 99 });
      if (this.bossBreak) break;
    }
    this.hitSrc = null;
  }
  private hitscan(x: number, y: number, dx: number, dy: number, st: ReturnType<typeof weaponStats>, color: string, element: Elem | null = this.hitSrc?.def.elem ?? null, width = 5, soft = false) {
    let len = st.range;
    // walls
    for (let t = 0; t < st.range; t += 1 / CR) {
      if (cellAt(this.map, x + dx * t, y + dy * t) === 2) {
        len = t;
        if (this.carAt(x + dx * t, y + dy * t)) this.demolish(x + dx * t, y + dy * t, 0.5, BULLET_WRECK, st.dmg); // a beam that ends on a parked car burns it
        break;
      }
    }
    const hits: [number, Enemy][] = [];
    for (const e of this.enemies) {
      if (e.dead) continue;
      const ex = e.x - x, ey = e.y - y;
      const t = ex * dx + ey * dy;
      if (t < 0 || t > len) continue;
      const px = ex - dx * t, py = ey - dy * t;
      if (px * px + py * py < (e.r + 0.15) ** 2) hits.push([t, e]);
    }
    hits.sort((a, b) => a[0] - b[0]);
    let pierce = st.pierce + 1;
    for (const [, e] of hits) {
      if (pierce-- <= 0) break;
      const cr = this.crit(st.crit, st.critMul);
      const chill = this.hitSrc?.def.chill, stream = !!this.hitSrc?.def.stream;
      // a stream stops at the first monster it touches, so the beam is drawn that far
      if (stream && st.pierce === 0) len = Math.max(0.3, (e.x - x) * dx + (e.y - y) * dy);
      this.applyHit(e, st.dmg * (cr.layers ? cr.mul : this.stats.owl ? 0.75 : 1), cr.layers, st.fire, st.shock, st.ecto, stream ? dx * 0.15 : dx, stream ? dy * 0.15 : dy, st.vamp, stream && this.streamTick++ % 4 !== 0, { element, pierce: stream ? 99 : st.pierce });
      if (chill && !e.dead) this.chillEnemy(e, chill);
    }
    this.beams.push({ x0: x, y0: y, x1: x + dx * len, y1: y + dy * len, color, life: 0.12, max: 0.12, zig: false, w: width, soft });
    return len;
  }
  private streamTick = 0;
  /** Cryo Ray: chill slows; at full chill the monster locks solid (bosses only slow) */
  private chillEnemy(e: Enemy, amount: number) {
    if ((e.frozenT ?? 0) > 0) return;
    e.chill = Math.min(1, (e.chill ?? 0) + amount);
    if (e.chill >= 1 && !e.def.boss) {
      e.chill = 0; e.frozenT = FREEZE_TIME; e.stunT = Math.max(e.stunT, FREEZE_TIME);
      this.text(e.x, e.y, 'FROZEN', '#9fe8ff', 12);
      for (let i = 0; i < 8; i++) this.particle(e.x, e.y, rand(0.2, 1.2), rand(-1, 1), rand(-1, 1), rand(0.5, 2), 0.5, '#d8f6ff', 4, 'sq');
    }
  }

  /** core hit routine for all player damage sources */
  applyHit(e: Enemy, dmg: number, critIn: boolean | number, fire: number, shock: number, ecto: number, kx: number, ky: number, vamp = false, quiet = false, profile: DamageProfile = {}) {
    if (e.dead) return;
    const defense = damageDefense(e.affix, profile);
    if (defense.multiplier === 0) { this.defenseHint(e, defense.reason); return; }
    if (e.affix === 'fireproof' && fire > 0) { this.defenseHint(e, 'Fire immune'); fire = 0; }
    if (e.affix === 'stormproof' && shock > 0) { this.defenseHint(e, 'Lightning immune'); shock = 0; }
    if (e.affix === 'ectoproof' && ecto > 0) { this.defenseHint(e, 'Ecto immune'); ecto = 0; }
    const s = this.stats, bd = this.build;
    if (s.farShot) dmg *= Math.hypot(e.x - this.p.x, e.y - this.p.y) >= FAR_SHOT.dist ? FAR_SHOT.far : FAR_SHOT.near;
    const layers = typeof critIn === 'number' ? critIn : critIn ? 1 : 0, crit = layers > 0;
    const src = this.hitSrc;
    if (src) {
      if (this.ins(src, 'bigkid') && (e.def.boss || e.elite)) dmg *= 1.4;
      if (this.ins(src, 'combo')) { const fx = this.fxOf(src); fx.combo = Math.min(COMBO_MAX, fx.combo + 1); fx.comboT = 2; }
      if (this.ins(src, 'socks') && Math.random() < 0.25) {
        let best: Enemy | null = null, bd = 9;
        for (const o of this.enemies) { if (o === e || o.dead) continue; const d = (o.x - e.x) ** 2 + (o.y - e.y) ** 2; if (d < bd) { bd = d; best = o; } }
        if (best) {
          const o = best as Enemy;
          this.beams.push({ x0: e.x, y0: e.y, x1: o.x, y1: o.y, color: '#bfe8ff', life: 0.15, max: 0.15, zig: true, w: 3 });
          this.hitSrc = null; // no chains of chains
          this.damageEnemy(o, dmg * 0.5, '#bfe8ff', false, quiet, { ...profile, ricochet: true });
          this.hitSrc = src;
        }
      }
    }
    if (Math.random() < ecto) {
      if (e.ectoT <= 0) this.text(e.x, e.y, 'ECTO', ELEM.ecto.color, 11);
      e.ectoT = 4;
    }
    const amp = s.ectoAmp * bd.ectoMore() * overflow(ecto);
    if (e.ectoT > 0) {
      dmg *= 1 + amp;
      if (bd.ks('ecto', 1)) e.vuln = Math.min(HAUNT_MAX, (e.vuln ?? 0) + 0.04); // Haunting
    }
    if (e.vuln) dmg *= 1 + e.vuln;
    if ((e.frozenT ?? 0) > 0) dmg *= 1.6; // brittle
    // crit keystones
    if (crit) {
      if (bd.ks('crit', 1)) { this.streak = Math.min(STREAK_MAX, this.streak + 1); this.streakT = 3; }
      if (bd.ks('crit', 2)) this.queueBlast(e.x, e.y, 0.9, dmg * 0.3);
      if (bd.ks('crit', 3)) this.p.skillCd -= 0.15;
    }
    this.damageEnemy(e, dmg, layers >= 3 ? '#c08cff' : layers === 2 ? '#ff7ad9' : crit ? '#ffe14a' : '#ffffff', crit, quiet, profile);
    if (layers >= 2 && !quiet) this.text(e.x, e.y, layers >= 3 ? `OVERCRIT ×${layers}` : 'OVERCRIT', layers >= 3 ? '#c08cff' : '#ff7ad9', 12);
    if (s.execute && !e.dead && !e.def.boss && !e.elite && e.hp < e.maxHp * 0.12) { this.text(e.x, e.y, 'BEDTIME!', '#c08cff', 11); this.damageEnemy(e, e.hp + 1, '#c08cff', false, true, profile); }
    if (crit && vamp) this.p.hp = Math.min(s.maxHp, this.p.hp + 1);
    if (crit && this.p.costume === 'skeleton' && this.boneBurstT <= 0 && this.bullets.length < 320) {
      this.boneBurstT = 0.15;
      for (let i = 0; i < 4; i++) {
        const a = rand(0, Math.PI * 2);
        this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 11, vy: Math.sin(a) * 11, dmg: dmg * 0.65, r: 0.12, life: 0.6, pierce: 2, bounce: 0, kind: 'bone', color: '#eee8d8', crit: 0, fire: 0, shock: 0, ecto: 0, explode: 0, hit: [e.id], vamp: false, dead: false, spin: 0 });
      }
    }
    const kb = (crit ? 0.6 : 0.35) / e.def.mass;
    e.kx += kx * kb * 6;
    e.ky += ky * kb * 6;
    if (Math.random() < fire) {
      if (e.burnT <= 0) this.text(e.x, e.y, 'BURN', ELEM.fire.color, 11);
      e.burnT = 3;
      // past 100% chance the burn itself gets stronger; Inferno stacks burns instead of keeping the strongest
      const burn = dmg * 0.45 * s.burnDmg * bd.burnMore() * overflow(fire) * (bd.ks('ecto', 3) && e.ectoT > 0 ? 1 + amp : 1);
      e.burnDps = Math.max(e.burnDps, bd.ks('fire', 3) ? Math.min(e.burnDps + burn, burn * INFERNO_STACKS) : burn);
    }
    if (Math.random() < shock) this.chain(e, dmg * 0.55 * bd.chainMore() * (bd.ks('ecto', 3) && e.ectoT > 0 ? 1 + amp : 1), Math.floor(Math.max(0, shock - 1) * 2), fire, ecto);
  }

  private defenseHint(e: Enemy, reason: string) {
    if (e.defenseHintT > 0 || !reason) return;
    e.defenseHintT = 0.9;
    if (this.texts.filter(t => t.kind === 'reason').length >= 8) return;
    if (this.texts.length >= 120) this.texts.shift();
    this.texts.push({ x: e.x, y: e.y, z: e.def.boss ? 4.8 : e.type === 'werewolf' ? 3.2 : 2.6, text: reason, color: '#c0cddd', life: 0.75, size: 10, vx: 0, kind: 'reason' });
  }
  damageEnemy(e: Enemy, dmg: number, color: string, big = false, quiet = false, profile: DamageProfile = {}) {
    if (e.dead || dmg <= 0) return;
    if(e.def.invulnerable){this.defenseHint(e,'Unstoppable · survive');return;}
    const defense = damageDefense(e.affix, profile);
    if (defense.reason) this.defenseHint(e, defense.reason);
    if (defense.multiplier === 0) return;
    dmg *= defense.multiplier;
    const absorbed = Math.min(e.shield, dmg);
    if (absorbed > 0) this.defenseHint(e, 'Shield absorbed');
    e.shield -= absorbed;
    e.shieldT = e.def.boss ? 6 : 4;
    e.hp -= dmg - absorbed;
    if (absorbed === dmg) color = '#80e4ff';
    // every bullet that lands: the deep thud, and a soft tick over it
    if (!quiet) { gameAudio.play('impact', 0.4); gameAudio.play('hit', big ? 0.55 : 0.4); }
    e.hit = 0.1;
    if (!quiet) this.text(e.x + rand(-0.2, 0.2), e.y + rand(-0.2, 0.2), fmtDmg(dmg), color, big ? 17 : 13, 'dmg');
    if (e.hp <= 0) this.killEnemy(e);
  }

  private chain(src: Enemy, dmg: number, extraJumps = 0, fire = 0, ecto = 0) {
    const bd = this.build;
    const hit = new Set<number>([src.id]);
    let frontier: Enemy[] = [src];
    const jumps = this.stats.chain + bd.chainJumps() + extraJumps;
    const fork = bd.ks('shock', 3) ? 2 : 1;
    const conductive = bd.ks('shock', 1) && this.procGen < 3;
    for (let i = 0; i < jumps && frontier.length; i++) {
      const next: Enemy[] = [];
      for (const cur of frontier) {
        for (let f = 0; f < fork; f++) {
          let best: Enemy | null = null, bdist = 3.5 * 3.5;
          this.query(cur.x, cur.y, 3.5, (e) => {
            if (hit.has(e.id) || e.dead) return;
            const d = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
            if (d < bdist) { bdist = d; best = e; }
          });
          if (!best) break;
          const b = best as Enemy;
          hit.add(b.id);
          this.beams.push({ x0: cur.x, y0: cur.y, x1: b.x, y1: b.y, color: ELEM.shock.color, life: 0.18, max: 0.18, zig: true, w: 2.5 });
          if (bd.ks('shock', 2) && b.burnT > 0) { this.damageEnemy(b, b.burnDps * b.burnT, ELEM.fire.color, true, false, { element: 'fire' }); b.burnT = 0; } // Overload
          if (conductive) {
            // Conductive: a jump is a real hit (elements at half chance, gun inscriptions) — no recursive chains
            this.procGen++;
            this.applyHit(b, dmg, false, fire * 0.5, 0, ecto * 0.5, 0, 0, false, false, { element: 'shock' });
            this.procGen--;
          } else this.damageEnemy(b, dmg, ELEM.shock.color, false, false, { element: 'shock' });
          b.stunT = Math.max(b.stunT, 0.25);
          if (next.length < 8) next.push(b);
        }
      }
      frontier = next;
    }
  }

  explode(x: number, y: number, r0: number, dmg0: number, elem: Elem | null, fromPlayer = true, crit = false, profile: DamageProfile = { element: elem }) {
    const bd = this.build;
    const r = fromPlayer ? r0 * bd.blastRadius() : r0, dmg = fromPlayer ? dmg0 * bd.blastMore() : dmg0;
    gameAudio.play('boom', Math.min(0.9, 0.3 + r * 0.16)); // the bigger the blast, the louder
    // A busy night sets off dozens of blasts a second. Only a heavy one (a rocket, a shell, a wreck: 2 tiles or more
    // before any blast-radius bonus) plays the painted fireball, three at a time at most; the chain blasts of a build
    // stay light rings. The more that are going off, the fewer sparks each one throws.
    let booms = 0, painted = 0;
    for (const z of this.zones) if (z.kind === 'boom') { booms++; if (z.sprite) painted++; }
    const big = fromPlayer && !settings.lowFx && (!elem || elem === 'fire') && r0 >= 2 && painted < 3;
    this.zones.push({ kind: 'boom', x, y, r, t: 0, life: big ? 0.8 : 0.45, dmg: 0, tick: 0, color: elem ? ELEM[elem].color : '#ffb347', sprite: big });
    // the screen shakes for a heavy blast near the kid; a string of small ones must not rattle it without end
    if (Math.hypot(x - this.p.x, y - this.p.y) < this.viewR + 2) this.shake = Math.max(this.shake, r0 >= 2 ? Math.min(9, 4 + r * 2) : booms > 3 ? 0 : 2.5);
    for (let i = 0, n = booms > 8 ? 4 : booms > 3 ? 10 : 22; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(1, 4) * r;
      this.particle(x, y, 0.2, Math.cos(a) * sp, Math.sin(a) * sp, rand(1, 4), rand(0.3, 0.7), i % 3 ? '#ffb347' : '#ff5a1a', rand(3, 6), i % 2 ? 'glow' : 'sq');
    }
    if (fromPlayer) {
      this.query(x, y, r + 1, (e) => {
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < r + e.r) {
          const f = 1 - 0.4 * (d / r);
          const dx = (e.x - x) / (d || 1), dy = (e.y - y) / (d || 1);
          // Elemental Payload: explosions carry the gun's own element chances
          const ws = bd.ks('blast', 2) && this.weapon ? weaponStats(this.weapon, this.stats) : null;
          const was = this.blastKill;
          this.blastKill = true;
          this.applyHit(e, dmg * f, crit, Math.max(elem === 'fire' ? 0.5 : 0, ws?.fire ?? 0), Math.max(elem === 'shock' ? 0.6 : 0, ws?.shock ?? 0), Math.max(elem === 'ecto' ? 0.6 : 0, ws?.ecto ?? 0), dx * 2, dy * 2, false, false, profile);
          this.blastKill = was;
        }
      });
    }
    if (booms <= 8) this.decals.push({ x, y, r: r * 0.6, color: 'rgba(20,10,5,0.5)', life: 20, rot: rand(0, 6) });
    if (this.decals.length > 160) this.decals.splice(0, this.decals.length - 160);
    // Every blast of the kid's wrecks the street a little; the full game's heavy guns do it in one hit.
    // (a wreck's own explosion does not pass it on: no chain of wrecks down the street)
    if (fromPlayer && !profile.noWreck) this.demolish(x, y, r, profile.demolish ? 60 : BLAST_WRECK, dmg);
  }

  // ---------- skills ----------
  private updateSkill(dt: number) {
    const p = this.p, s = this.stats, info = HERO_INFO[this.hero];
    p.skillCd -= dt;
    if (this.tot || !(this.input.rpressed || this.input.pressed.has('f')) || p.skillCd > 0) return;
    p.skillCd = info.cd * s.skillCd;
    gameAudio.play('skill', 0.5);
    const m = this.mouseWorld();
    let dx = m.x - p.x, dy = m.y - p.y;
    let l = Math.hypot(dx, dy) || 1;
    if (!this.input.mouseActive) { dx = p.aimX; dy = p.aimY; l = 1; }
    if (this.input.touchActive) { dx = p.aimX * 7; dy = p.aimY * 7; l = 7; }
    const range = Math.min(l, 7);
    const tx = p.x + (dx / l) * range, ty = p.y + (dy / l) * range;
    if (this.hero === 0) {
      this.lobs.push({ x0: p.x, y0: p.y, x1: tx, y1: ty, t: 0, dur: 0.55 });
    } else if (this.hero === 1) {
      this.zones.push({ kind: 'tornado', x: tx, y: ty, r: 1.8 * s.skillPow, t: 0, life: 4.5, dmg: 3.6 * s.dmg * s.skillPow, tick: 0 });
    } else if (this.hero === 3) {
      p.hp = s.maxHp; p.shield = s.maxShield; p.invuln = Math.max(p.invuln, 2);
      this.premiumPowerT = 6;
      for (const weapon of p.weapons) if (weapon) { weapon.ammo = weaponStats(weapon, s).mag; weapon.reloadT = 0; }
      for (const friend of this.friends) if (friend.status === 'rescued') { friend.hp = friend.maxHp; friend.downT = 0; friend.weapon.ammo = weaponStats(friend.weapon, s).mag; friend.weapon.reloadT = 0; }
      for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 7) {
        e.shield = 0; e.shieldT = 8; e.stunT = Math.max(e.stunT, e.def.boss ? 0.6 : 2);
        this.damageEnemy(e, 56 * s.dmg * s.skillPow, '#ffd580', true, false, { element: 'shock' });
        e.shieldT = 8;
      }
      this.zones.push({ kind: 'flash', x: p.x, y: p.y, r: 7, t: 0, life: 0.5, dmg: 0, tick: 0, color: '#ffd580' });
    } else if (this.hero === 4) {
      this.premiumPowerT = 7; p.dashCharges = s.dashCharges; p.dashRecharge = 0;
      p.invuln = Math.max(p.invuln, 1.5);
      for (const e of this.enemies) if (!e.dead && Math.hypot(e.x - p.x, e.y - p.y) < 9) {
        if (e.affix !== 'ectoproof') e.ectoT = Math.max(e.ectoT, 8 * s.skillPow);
        e.stunT = Math.max(e.stunT, e.def.boss ? 1 : 3);
        this.damageEnemy(e, 88 * s.dmg * s.skillPow, '#80d9ce', true, false, { element: 'ecto' });
      }
      this.zones.push({ kind: 'flash', x: p.x, y: p.y, r: 9, t: 0, life: 0.5, dmg: 0, tick: 0, color: '#80d9ce' });
    } else {
      const ang = Math.atan2(dy, dx);
      const R = 6 * Math.sqrt(s.skillPow);
      this.zones.push({ kind: 'flash', x: p.x, y: p.y, r: R, t: 0, life: 0.4, dmg: 0, tick: 0, ang });
      this.shake = 8;
      for (const e of this.enemies) {
        const ex = e.x - p.x, ey = e.y - p.y, d = Math.hypot(ex, ey);
        if (d > R + e.r) continue;
        let da = Math.atan2(ey, ex) - ang;
        while (da > Math.PI) da -= Math.PI * 2;
        while (da < -Math.PI) da += Math.PI * 2;
        if (Math.abs(da) < 0.65 || d < 1) {
          e.stunT = 2;
          this.applyHit(e, 26 * s.dmg * s.skillPow, false, 0, 0, 0, ex / (d || 1) * 3, ey / (d || 1) * 3);
        }
      }
    }
  }

  private updateCompanions(dt: number) {
    const p = this.p, s = this.stats;
    // ---- costume powers ----
    this.boneBurstT = Math.max(0, this.boneBurstT - dt);
    p.novaCd -= dt;
    if (p.costume === 'witch') {
      p.hexT -= dt;
      if (p.hexT <= 0) {
        const t = this.findTarget(8);
        if (t) {
          p.hexT = 0.9;
          for (let i = -1; i <= 1; i++) {
            const a = Math.atan2(t.y - p.y, t.x - p.x) + i * 0.3;
            this.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 9, vy: Math.sin(a) * 9, dmg: 26 * s.dmg * s.skillPow * this.globalMore(), r: 0.16, life: 2.2, pierce: 2, bounce: 0, kind: 'hex', color: '#c46bff', crit: Math.random() < s.crit ? 1 : 0, fire: 0, shock: 0, ecto: 0.5, explode: 0, hit: [], vamp: false, dead: false, spin: 0, home: true, element: 'ecto' });
          }
          this.particle(p.x, p.y, 1.6, 0, 0, 0, 0.2, '#c46bff', 14, 'glow');
        }
      }
    }
    if (p.costume === 'dino') {
      p.stompT -= dt;
      if (p.stompT <= 0) {
        let near = false;
        this.query(p.x, p.y, 3.8, (e) => { if (Math.hypot(e.x - p.x, e.y - p.y) < 3.8) near = true; });
        if (near) {
          p.stompT = 2.5;
          this.zones.push({ kind: 'boom', x: p.x, y: p.y, r: 3.8, t: 0, life: 0.45, dmg: 0, tick: 0, color: '#8dff5a' });
          this.shake = Math.max(this.shake, 7);
          this.text(p.x, p.y, 'STOMP!', '#8dff5a', 16);
          this.query(p.x, p.y, 4.2, (e) => {
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d < 3.8 + e.r) {
              e.stunT = Math.max(e.stunT, e.def.boss ? 0.5 : 2);
              this.applyHit(e, 60 * s.dmg * s.skillPow * this.globalMore(), false, 0, 0, 0, ((e.x - p.x) / (d || 1)) * 3, ((e.y - p.y) / (d || 1)) * 3);
            }
          });
        } else p.stompT = 0.3;
      }
    }
    // orbit blades
    this.orbitAng += dt * 2.6;
    if (s.orbit > 0) {
      for (let i = 0; i < s.orbit; i++) {
        const a = this.orbitAng + (i / s.orbit) * Math.PI * 2;
        const ox = p.x + Math.cos(a) * 1.5, oy = p.y + Math.sin(a) * 1.5;
        this.query(ox, oy, 0.8, (e) => {
          if (e.orbitT > 0) return;
          if (Math.hypot(e.x - ox, e.y - oy) < e.r + 0.35) {
            e.orbitT = 0.35;
            const cr = this.crit(s.crit, s.critDmg), ws = this.build.ks('summon', 2) && this.weapon ? weaponStats(this.weapon, s) : null;
            this.applyHit(e, 5.6 * s.dmg * cr.mul * this.build.summonMore() * this.globalMore(), cr.layers, ws?.fire ?? 0, ws?.shock ?? 0, ws?.ecto ?? 0, Math.cos(a + 1.57), Math.sin(a + 1.57));
          }
        });
      }
    }
    // ghost buddy
    if (s.familiar > 0) {
      const tx = p.x - 0.8, ty = p.y - 0.8;
      this.familiar.x += (tx - this.familiar.x) * Math.min(1, dt * 3);
      this.familiar.y += (ty - this.familiar.y) * Math.min(1, dt * 3);
      this.familiarT -= dt;
      if (this.familiarT <= 0) {
        this.familiarT = 0.9 / s.familiar;
        let best: Enemy | null = null, bd = 49;
        for (const e of this.enemies) {
          const d = (e.x - this.familiar.x) ** 2 + (e.y - this.familiar.y) ** 2;
          if (d < bd && !e.dead) { bd = d; best = e; }
        }
        if (best) {
          const b = best as Enemy;
          const dx = b.x - this.familiar.x, dy = b.y - this.familiar.y, l = Math.hypot(dx, dy) || 1;
          const ws = this.build.ks('summon', 2) && this.weapon ? weaponStats(this.weapon, s) : null;
          this.bullets.push({ x: this.familiar.x, y: this.familiar.y, vx: (dx / l) * 10, vy: (dy / l) * 10, dmg: 6.4 * s.dmg * this.build.summonMore() * this.globalMore(), r: 0.14, life: 1, pierce: 1, bounce: 0, kind: 'water', color: '#cfe0ff', crit: 0, fire: ws?.fire ?? 0, shock: Math.max(0.15, ws?.shock ?? 0), ecto: Math.max(0.15, ws?.ecto ?? 0), explode: 0, hit: [], vamp: false, dead: false, spin: 0 });
        }
      }
    }
  }

  // ---------- spatial grid ----------
  private rebuildGrid() {
    // The painted town has 71,824 cells; only cells holding enemies need clearing.
    for (const cell of this.occupiedGrid) cell.length = 0;
    this.occupiedGrid.length = 0;
    for (const e of this.enemies) {
      const gx = clamp(Math.floor(e.x), 0, MAP_W - 1), gy = clamp(Math.floor(e.y), 0, MAP_H - 1);
      const cell = this.grid[gy * MAP_W + gx];
      if (!cell.length) this.occupiedGrid.push(cell);
      cell.push(e);
    }
  }
  query(x: number, y: number, r: number, fn: (e: Enemy) => void) {
    const x0 = Math.max(0, Math.floor(x - r)), x1 = Math.min(MAP_W - 1, Math.floor(x + r));
    const y0 = Math.max(0, Math.floor(y - r)), y1 = Math.min(MAP_H - 1, Math.floor(y + r));
    for (let gy = y0; gy <= y1; gy++) for (let gx = x0; gx <= x1; gx++) for (const e of this.grid[gy * MAP_W + gx]) if (!e.dead) fn(e);
  }

  // ---------- flow field ----------
  private computeFlow(force: boolean, dt = 0) {
    this.flowT -= dt;
    const pc = Math.floor(this.p.y * CR) * CW + Math.floor(this.p.x * CR);
    if (!force && (this.flowT > 0 || pc === this.flowCell)) return;
    this.flowT = 0.2;
    this.flowCell = pc;
    const f = this.flow, coll = this.navigation;
    if (force) for (let cy = 0; cy < CH; cy++) for (let cx = 0; cx < CW; cx++) {
      coll[cy * CW + cx] = Number(blockedCircle(this.map, (cx + .5) / CR, (cy + .5) / CR, .3));
    }
    f.fill(1 << 30);
    const q = this.flowQueue; // reused: the town is large, a fresh 4 MB queue every 0.2 s would churn memory
    let h = 0, t = 0;
    const tur = this.turrets[this.mounted];
    if (tur) {
      // the kid is up on a jungle gym (solid): monsters path to the ring of open cells around it
      const g = tur.gym, x0 = Math.floor(g.x0 * CR) - 1, y0 = Math.floor(g.y0 * CR) - 1, x1 = Math.ceil((g.x0 + g.fw) * CR), y1 = Math.ceil((g.y0 + g.fh) * CR);
      for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cy < 0 || cx >= CW || cy >= CH || (cx > x0 && cx < x1 && cy > y0 && cy < y1)) continue;
        const c = cy * CW + cx;
        if (!coll[c]) { f[c] = 0; q[t++] = c; }
      }
    } else {
      f[pc] = 0;
      q[t++] = pc;
    }
    while (h < t) {
      const c = q[h++];
      const cx = c % CW, cy = (c / CW) | 0, d = f[c] + 1;
      if (cx > 0 && !coll[c - 1] && f[c - 1] > d) { f[c - 1] = d; q[t++] = c - 1; }
      if (cx < CW - 1 && !coll[c + 1] && f[c + 1] > d) { f[c + 1] = d; q[t++] = c + 1; }
      if (cy > 0 && !coll[c - CW] && f[c - CW] > d) { f[c - CW] = d; q[t++] = c - CW; }
      if (cy < CH - 1 && !coll[c + CW] && f[c + CW] > d) { f[c + CW] = d; q[t++] = c + CW; }
    }
  }
  private flowDir(x: number, y: number) {
    const cx = Math.floor(x * CR), cy = Math.floor(y * CR);
    const c = cy * CW + cx;
    if (cx < 1 || cy < 1 || cx >= CW - 1 || cy >= CH - 1) return null;
    let best = this.flow[c], bx = 0, by = 0;
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const n = c + dy * CW + dx;
        if (dx && dy && (this.navigation[c + dx] || this.navigation[c + dy * CW])) continue;
        const v = this.flow[n] + (dx && dy ? 0.4 : 0);
        if (v < best) { best = v; bx = dx; by = dy; }
      }
    if (!bx && !by) return null;
    const tx = (cx + bx + 0.5) / CR, ty = (cy + by + 0.5) / CR;
    const l = Math.hypot(tx - x, ty - y) || 1;
    return { x: (tx - x) / l, y: (ty - y) / l };
  }
  reachable(x: number, y: number) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return false;
    const c = Math.floor(y * CR) * CW + Math.floor(x * CR);
    return c >= 0 && c < this.flow.length && this.flow[c] < (1 << 29);
  }

  // ---------- enemies ----------
  spawnEnemy(type: string, x: number, y: number, elite = false, forcedAffix?: EnemyAffix | null) {
    const def = EDEF[type];
    if (!def.fly && !def.phase && !def.boss && (blockedCircle(this.map, x, y, def.r * (elite ? 1.25 : 1) * .85) || !this.reachable(x, y))) {
      const clearance = def.r * (elite ? 1.25 : 1) * .85;
      let spot = this.freeSpot(x, y, true, clearance);
      if (Math.hypot(spot.x - this.p.x, spot.y - this.p.y) < 2) spot = this.freeSpot(this.p.x + 4, this.p.y, true, clearance);
      x = spot.x; y = spot.y;
    }
    const hw = this.hpWave();
    const affix = def.boss ? null : forcedAffix === undefined ? rollAffix(hw) : forcedAffix;
    // The rank ladder (RANKS): from the second night every monster on the street is promoted, and the specials a rank above.
    const later = this.night > 1 && !def.boss;
    const rank = def.boss ? 0 : this.baseRank + (elite || def.elite ? 1 : 0);
    const R = RANKS[rank];
    const captain = rank >= 2;
    const lieutenant = rank >= 1;
    const fodder = hw > 10 && !def.boss && !def.elite && !elite && !affix && !later;
    const scale = 1 + this.time / 60 * 0.38 + (this.endless ? 1.5 : 0);
    const rankHp = later ? R.hp : elite ? 3 : 1; // night 1 keeps its old elites (x3, 60% shield)
    const hp = def.invulnerable?def.hp:def.hp * (def.boss ? 1 : scale) * rankHp * enemyHealthScale(hw, fodder);
    const maxShield = def.invulnerable?0:hp * (def.boss ? (type === FINAL_BOSS ? 0.6 : 0.4) : later ? R.shield : lieutenant ? 0.6 : 0);
    const e: Enemy = {
      affix, fodder, defenseHintT: 0,
      shield: maxShield, maxShield, shieldT: 0, lieutenant, rank, captain, spellT: rand(1, 2.5), spellN: 0,
      id: this.eid++, type, def, x, y, hp, maxHp: hp, r: def.r * (elite ? 1.25 : 1), anim: rand(0, 6), flip: false, hit: 0, burnT: 0, burnDps: 0, burnAcc: 0, ectoT: 0, stunT: 0,
      atkCd: 0, kx: 0, ky: 0, shootT: rand(1, 2.5), lungeT: 0, lungeX: 0, lungeY: 0, p1: 3, p2: 6, p3: 9, orbitT: 0, dead: false, elite: elite || !!def.elite, spawnT: 0.4,
    };
    this.enemies.push(e);
    for (let i = 0; i < 6; i++) this.particle(x, y, 0, rand(-1, 1), rand(-1, 1), rand(1, 2), 0.5, '#2a1a12', 4, 'sq');
    return e;
  }

  private killEnemy(e: Enemy) {
    if (e.dead||e.def.invulnerable) return;
    e.dead = true;
    this.kills++;
    const s = this.stats;
    const bd = this.build;
    if (bd.ks('kill', 1)) { this.momentum = Math.min(MOMENTUM_MAX, this.momentum + 1); this.momentumT = 4; }
    if (bd.ks('kill', 2) && this.weapon) { const ww = this.weapon; ww.ammo = Math.min(weaponStats(ww, s).mag, ww.ammo + 1); }
    if (bd.ks('kill', 3)) { this.p.skillCd -= 0.2; this.p.dashRecharge += 0.2; }
    if ((bd.ks('fire', 2) && e.burnT > 0) || (bd.ks('ecto', 2) && e.ectoT > 0)) {
      // Wildfire / Plague: pass it on
      let n = 0;
      this.query(e.x, e.y, 2.5, (o) => {
        if (o === e || o.dead || n >= 4 || Math.hypot(o.x - e.x, o.y - e.y) > 2.5) return;
        const spreadFire = bd.ks('fire', 2) && e.burnT > 0 && o.affix !== 'fireproof';
        const spreadEcto = bd.ks('ecto', 2) && e.ectoT > 0 && o.affix !== 'ectoproof';
        if (!spreadFire && !spreadEcto) return;
        n++;
        if (spreadFire) { o.burnT = 3; o.burnDps = Math.max(o.burnDps, e.burnDps * 0.8); }
        if (spreadEcto) o.ectoT = Math.max(o.ectoT, 4);
      });
    }
    if ((e.frozenT ?? 0) > 0) {
      // frozen solid: it shatters, and the shards hurt what stands close
      this.queueBlast(e.x, e.y, 1.4, Math.max(6, e.maxHp * 0.25));
      for (let i = 0; i < 14; i++) { const a = rand(0, Math.PI * 2); this.particle(e.x, e.y, 0.5, Math.cos(a) * 4, Math.sin(a) * 4, rand(1, 4), 0.6, i % 2 ? '#d8f6ff' : '#9fe8ff', 5, 'sq'); }
    }
    if (this.blastKill && bd.ks('blast', 3)) this.queueBlast(e.x, e.y, 1.1, Math.max(8, e.maxHp * 0.15) * Math.min(3, this.stats.dmg) * 0.5);
    const src = this.hitSrc;
    if (src) {
      if (this.ins(src, 'seconds') && Math.random() < 0.3) {
        const fx = this.fxOf(src);
        src.ammo = Math.min(weaponStats(src, s).mag, src.ammo + 2); fx.hasty = 3;
      }
      if (this.ins(src, 'pinata')) {
        this.hitSrc = null; // a piñata's kills don't pop more piñatas
        for (let i = 0; i < 10; i++) this.particle(e.x, e.y, 0.4, rand(-3, 3), rand(-3, 3), rand(2, 4), 0.6, ['#ff4d6d', '#ffd23a', '#7dff5a', '#21d0ff', '#b44dff'][i % 5], 4, 'sq');
        this.explode(e.x, e.y, 1.4, weaponStats(src, s).dmg * 0.6, null, true);
        this.hitSrc = src;
      }
    }
    // drops
    // fewer monsters, so each one is worth more (KILL_LOOT)
    const xp = e.def.xp * (e.elite && !e.def.elite ? 3 : 1);
    if (xp >= 20) for (let i = 0; i < Math.min(15, xp / 5); i++) this.dropPickup(e.x, e.y, 'xp3', 5 * KILL_LOOT);
    else this.dropPickup(e.x, e.y, xp >= 4 ? 'xp3' : xp >= 2 ? 'xp2' : 'xp1', xp * KILL_LOOT);
    if (Math.random() < e.def.coin) this.dropPickup(e.x, e.y, 'coin', Math.ceil(rand(1, 3) * (e.elite ? 5 : 1) * KILL_LOOT));
    if (Math.random() < s.healDrop) this.dropPickup(e.x, e.y, 'heal', 25);
    if (this.friends.some(f => f.status === 'rescued') && Math.random() < 0.12) {
      this.dropPickup(e.x, e.y, 'xp2', 0);
      this.pickups[this.pickups.length - 1].friendOnly = true;
    }
    // werewolves (real elites) always carry a bag; buffed "elite" variants of normal monsters only sometimes
    if (e.elite && !e.def.boss && (e.def.elite || Math.random() < 0.1)) this.dropPickup(e.x, e.y, 'chest', 0);
    if (Math.random() < s.vamp) { this.p.hp = Math.min(s.maxHp, this.p.hp + 2); }
    if (this.p.costume === 'vampire') {
      this.p.hp = Math.min(s.maxHp, this.p.hp + 4); this.p.shield = Math.min(s.maxShield, this.p.shield + 3);
      if (Math.random() < 0.3) this.particle(e.x, e.y, 0.5, (this.p.x - e.x) * 2, (this.p.y - e.y) * 2, 0.5, 0.5, '#e0304a', 6, 'glow');
    }
    if ((e.elite || e.affix) && !e.def.boss && Math.random() < Math.min(0.06, 0.025 * s.costumeLuck)) this.dropCostume(e.x, e.y, this.randomCostume());
    // fx
    const n = settings.gore === 'off' ? 0 : settings.lowFx ? 4 : e.def.boss ? 24 : 8;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(1, 3.5);
      this.particle(e.x, e.y, 0.4, Math.cos(a) * sp, Math.sin(a) * sp, rand(1.5, 4), rand(0.4, 0.9), settings.gore === 'red' ? '#ab2134' : '#5baf42', rand(3, 7), 'gore');
    }
    if (settings.gore !== 'off') {
      this.decals.push({ x: e.x, y: e.y, r: e.r * 0.75, color: '#5baf42', life: 25, rot: rand(0, 6), gore: true });
      const max = settings.lowFx ? 60 : 160;
      if (this.decals.length > max) this.decals.splice(0, this.decals.length - max);
    }
    if (e.def.bomber) this.explode(e.x, e.y, 1.5, 16 * s.dmg, 'fire', true);
    if (e.def.boss && e.type === FINAL_BOSS) { this.nextNight(e); return; }
    if (e.def.boss) {
      if(this.map.kind==='arcade')this.townShopMovePending=true;
      if(this.townScene)this.townScene.enemies=[];
      if(this.arcadeScene)this.arcadeScene.enemies=[];
      this.boss = null;
      this.bossWins++;
      this.bossRound++;
      this.bossKilled = this.bossRound >= CAMPAIGN_BOSSES.length;
      this.bossBreak = true;
      this.relocateShops();
      // Despawn, don't kill: no duplicate XP/loot from clearing the encounter.
      for (const creature of this.enemies) creature.dead = true;
      this.enemies = []; this.ebullets = []; this.bullets = []; this.zones = []; this.lobs = [];
      this.procQueue = [];
      this.spawnAcc = 0; this.tot = null; this.interact = null;
      this.p.coins += 150 + this.bossRound * 50;
      this.p.hp = Math.min(this.stats.maxHp, this.p.hp + this.stats.maxHp * 0.25);
      this.nextBossAt = this.time + 45 + BUY_WINDOW;
      // No shop pops up: the stand has just moved, and the kid gets a quiet stretch to walk there (or ring a few doors).
      this.calmT = BUY_WINDOW;
      this.p.invuln = Math.max(this.p.invuln, 1);
      this.hitStop = 0.25;
      this.dropLootMagnet(e.x, e.y);
      for (let i = 0; i < 2; i++) this.dropPickup(e.x + rand(-1, 1), e.y + rand(-1, 1), 'chest', 0);
      for (let i = 0; i < 30; i++) this.dropPickup(e.x, e.y, 'coin', 3);
      // the reward picker belongs to the boss now (a level-up only heals): Rare or better, Epic far more often
      this.bossPrizes.push({ n: 3 + this.stats.totChoices, luck: this.stats.luck + 4 });
      this.setBanner(`${BOSS_NAMES[e.type].toUpperCase()} DEFEATED!`, `Pick your prize, then ${BUY_WINDOW} quiet seconds: follow the arrow to the shop`, 'win');
      gameAudio.play('victory', 0.45);
    }
  }

  /**
   * The Hollow Beyond is down: the night starts over at wave 1 and boss 1. Every monster is a lieutenant from now on,
   * the old elites are spell-casting captains, and health picks up close to where the late waves left it.
   */
  private nextNight(e: Enemy) {
    if(this.map.kind==='arcade')this.townShopMovePending=true;
    if(this.townScene)this.townScene.enemies=[];
    if(this.arcadeScene)this.arcadeScene.enemies=[];
    this.boss = null; this.minionBoss = null;
    this.bossWins++;
    this.bankRewards(); // the waves count is about to start over: pay what this night earned first
    this.night++;
    this.save.checkpoint = Math.max(this.save.checkpoint ?? 0, this.night);
    storeSave(this.save);
    this.wave = 1; this.bossRound = 0; this.bossKilled = false; this.bossSpawned = false;
    this.endless = false; this.winDelay = 0;
    this.bossBreak = true;
    this.relocateShops();
    for (const creature of this.enemies) creature.dead = true;
    this.enemies = []; this.ebullets = []; this.bullets = []; this.zones = []; this.lobs = [];
    this.procQueue = [];
    this.spawnAcc = 0; this.tot = null; this.interact = null;
    this.p.coins += 1000;
    this.p.hp = this.stats.maxHp; this.p.shield = this.stats.maxShield;
    this.calmT = BUY_WINDOW * 2;
    this.nextBossAt = this.time + 60 + this.calmT;
    this.nextElite = this.time + 30 + this.calmT;
    this.p.invuln = Math.max(this.p.invuln, 2);
    this.hitStop = 0.4; this.shake = 20;
    this.dropLootMagnet(e.x, e.y);
    for (let i = 0; i < 4; i++) this.dropPickup(e.x + rand(-1.5, 1.5), e.y + rand(-1.5, 1.5), 'chest', 0);
    for (let i = 0; i < 60; i++) this.dropPickup(e.x, e.y, 'coin', 4);
    this.bossPrizes.push({ n: 5 + this.stats.totChoices, luck: this.stats.luck + 8 });
    this.setBanner('THE HOLLOW BEYOND HAS FALLEN!', `Night ${this.night} begins at wave 1: ${this.rankLine}`, 'win');
    this.toast(`Checkpoint saved: a new run can start here, at wave ${this.totalWave}.`);
    gameAudio.play('victory');
  }

  /**
   * Start a run at a checkpoint (see Save.checkpoint): night `night`, wave 1, with that night's monsters. The kid gets a
   * head start so the first lieutenants are a fight, not a wall: two guns off the boss table, levels, coins, and one
   * boss prize to pick on the first frame.
   */
  startAtNight(night: number) {
    if (this.campaign || night < 2 || night > (this.save.checkpoint ?? 0)) return;
    this.night = night;
    this.victorious = true;
    this.treatGuideComplete = true; this.tutorialHouse = null;
    const p = this.p, s = this.stats;
    p.level = 10 * (night - 1); p.xp = 0; p.xpNext = xpFor(p.level);
    p.weapons = [makeWeapon(null, rollBossRarity(s.luck + 4, 3), this.lootLevel()), makeWeapon(null, rollBossRarity(s.luck + 4), this.lootLevel())];
    p.cur = 0;
    this.syncTeamWeapons();
    p.coins += 600 * (night - 1);
    this.bossPrizes.push({ n: 5 + s.totChoices, luck: s.luck + 8 });
    this.setBanner(`CHECKPOINT · NIGHT ${night}`, `Wave ${this.totalWave}: ${this.rankLine}`, 'danger');
  }
  /** who walks the streets tonight, for the banners */
  get rankLine() {
    const base = RANKS[this.baseRank], top = RANKS[this.baseRank + 1];
    return `${base.plural} on every street, ${top.plural} leading them`;
  }

  private updateEnemies(dt: number) {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = e.def;
      if(d.invulnerable||d.unstoppable){e.stunT=0;e.chill=0;e.frozenT=0;e.ectoT=0;e.kx=0;e.ky=0;}
      e.defenseHintT = Math.max(0, e.defenseHintT - dt);
      e.shieldT = Math.max(0, e.shieldT - dt);
      if (e.shieldT === 0 && e.maxShield > 0) e.shield = Math.min(e.maxShield, e.shield + e.maxShield * (d.boss ? 0.08 : 0.2) * dt);
      e.anim += dt * d.anim;
      e.hit -= dt;
      e.atkCd -= dt;
      e.orbitT -= dt;
      e.ectoT -= dt;
      e.spawnT -= dt;
      if (e.burnT > 0) {
        e.burnT -= dt;
        e.burnAcc += dt;
        if (e.burnAcc >= 0.5) {
          e.burnAcc = 0;
          const cr = this.build.ks('fire', 1) ? this.crit(this.stats.crit, this.stats.critDmg) : null; // Searing
          this.damageEnemy(e, e.burnDps * 0.5 * (cr?.mul ?? 1) * (1 + (e.vuln ?? 0)), cr?.layers ? '#ffe14a' : ELEM.fire.color, !!cr?.layers, false, { element: 'fire' });
          this.particle(e.x, e.y, 0.5, rand(-0.3, 0.3), rand(-0.3, 0.3), 1.5, 0.5, '#ff7a1a', 5, 'glow');
          if (e.dead) continue;
        }
      } else e.burnDps = 0;
      const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 0.001;
      let mx = 0, my = 0;
      if (e.chill) e.chill = Math.max(0, e.chill - dt * 0.2);
      if (e.frozenT) e.frozenT = Math.max(0, e.frozenT - dt);
      let speed = d.speed * (e.ectoT > 0 ? 0.6 : 1) * ((e.rank ?? 0) > 0 ? RANKS[e.rank!].speed : 1) * (1 - 0.55 * (e.chill ?? 0));
      if (e.stunT > 0) {
        e.stunT -= dt;
        speed = 0;
      } else if (e.spawnT > 0) speed = 0;
      else if (d.fly || d.phase || d.boss) {
        mx = dx / dist; my = dy / dist;
      } else if (dist < 3 && lineOfSight(this.map, e.x, e.y, p.x, p.y, 1)) {
        mx = dx / dist; my = dy / dist;
      } else {
        const f = this.flowDir(e.x, e.y);
        if (f) { mx = f.x; my = f.y; } else { mx = dx / dist; my = dy / dist; }
      }
      if (d.fly) {
        // bats weave
        const a = Math.sin(this.time * 4 + e.id) * 0.8;
        const c = Math.cos(a), s2 = Math.sin(a);
        const nx = mx * c - my * s2, ny = mx * s2 + my * c;
        mx = nx; my = ny;
      }
      // behaviours
      if(e.type==='saucer_matron_b'){
        e.tractorT=Math.max(0,(e.tractorT??0)-dt);
        e.p3-=dt;
        if(e.p3<=0){
          e.p3=3;
          const friend=this.friends.filter(f=>f.status==='rescued'&&f.hp>0&&!(f.abductT!>0)&&!(f.abductImmuneT!>0))
            .sort((a,b)=>Math.hypot(a.x-e.x,a.y-e.y)-Math.hypot(b.x-e.x,b.y-e.y))[0];
          if(friend&&!this.friends.some(f=>f.abductT!>0)&&Math.hypot(friend.x-e.x,friend.y-e.y)<6){
            e.x=friend.x;e.y=friend.y;e.tractorT=2;
            friend.abductT=30;friend.moving=false;friend.channel=false;friend.progress=0;
            this.bullets=this.bullets.filter(b=>b.by!==friend);
            this.zones.push({kind:'tractor',x:friend.x,y:friend.y,r:.9,t:0,life:2,dmg:0,tick:0});
            this.toast(`${HERO_INFO[friend.hero].name} was abducted! Back in 30 seconds.`);
            e.p3=15;
          }
        }
      }
      if (d.ranged && speed > 0 && !(e.tractorT!>0)) {
        e.shootT -= dt;
        if (dist < 5.5 && lineOfSight(this.map, e.x, e.y, p.x, p.y)) {
          mx = -dx / dist * 0.4 + (-dy / dist) * 0.6; my = -dy / dist * 0.4 + (dx / dist) * 0.6;
          if (e.shootT <= 0) {
            e.shootT = 2.4;
            for (let k = -1; k <= 1; k++) {
              const a = Math.atan2(dy, dx) + k * 0.25;
              this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 4.2, r: 0.18, dmg: 9 * this.nightPower, life: 3, color: '#b2ff6a', kind: 'orb', dead: false });
            }
          }
        }
      }
      // Captains and up cast: a fan of hexes at the kid (wider each rank), and the rank's leaders every third spell a
      // ring of them all around. The rank and file cast less often and smaller, or a night of mayors is a bullet wall.
      if (e.captain && speed > 0 && !(e.tractorT!>0)) {
        const R = RANKS[e.rank!], leader = e.elite;
        e.spellT = (e.spellT ?? 0) - dt;
        if (e.spellT <= 0 && dist < 9 && (d.fly || d.phase || lineOfSight(this.map, e.x, e.y, p.x, p.y))) {
          e.spellT = R.cd * (leader ? 1 : 1.6) * rand(0.85, 1.15);
          const ring = leader && (e.spellN = (e.spellN ?? 0) + 1) % 3 === 0, aim = Math.atan2(dy, dx);
          const dmg = 14 * (1 + this.time / 900) * this.nightPower * (0.8 + 0.1 * e.rank!);
          const count = ring ? R.spell * 2 : leader ? R.spell : Math.max(3, R.spell - 2);
          for (let k = 0; k < count; k++) {
            const a = ring ? aim + k / count * Math.PI * 2 : aim + (k - (count - 1) / 2) * 0.2;
            const v = ring ? 3.6 : 5.2;
            this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 0.2, dmg, life: 3, color: R.color, kind: 'orb', dead: false });
          }
          for (let i = 0; i < 8; i++) this.particle(e.x, e.y, 0.9, rand(-1.5, 1.5), rand(-1.5, 1.5), rand(1, 2.5), 0.5, R.color, 5, 'glow');
        }
      }
      if (d.bomber && dist < 0.85 && e.spawnT <= 0) {
        e.hp = 0;
        this.zones.push({ kind: 'boom', x: e.x, y: e.y, r: 1.5, t: 0, life: 0.45, dmg: 0, tick: 0, color: '#ff7a1a' });
        if (dist < 1.5) this.takeDamage(d.dmg, e.x, e.y);
        this.killEnemy(e);
        continue;
      }
      if ((d.elite || e.type === 'cruiser_bully_b') && !d.boss) {
        e.lungeT -= dt;
        if (e.lungeT < -3.5 && dist < 7 && dist > 1.2) {
          e.lungeT = e.type === 'cruiser_bully_b' ? 1.2 : 0.4;
          e.lungeX = dx / dist; e.lungeY = dy / dist;
          this.zones.push({ kind: 'warn', x: e.x + e.lungeX * 1.6, y: e.y + e.lungeY * 1.6, r: 0.8, t: 0, life: 0.35, dmg: 0, tick: 0 });
        }
        // A driver's first 0.45s is a readable brake/headlight warning; then the car commits.
        if (e.lungeT > 0) { mx = e.lungeX; my = e.lungeY; speed = e.type === 'cruiser_bully_b' && e.lungeT > 0.75 ? 0 : 8.5; }
      }
      if (d.boss) this.bossAI(e, dt, dx, dy, dist);
      if(e.tractorT!>0){mx=0;my=0;speed=0;e.kx=0;e.ky=0;}
      // movement
      e.kx *= Math.pow(0.002, dt); e.ky *= Math.pow(0.002, dt);
      const vx = mx * speed + e.kx, vy = my * speed + e.ky;
      if (d.fly || d.phase || d.boss) {
        e.x = clamp(e.x + vx * dt, 0.7, MAP_W - 0.7);
        e.y = clamp(e.y + vy * dt, 0.7, MAP_H - 0.7);
      } else this.moveCircle(e, vx * dt, vy * dt, e.r * 0.85);
      if(this.map.bounds){const b=this.map.bounds;e.x=clamp(e.x,b.x0+e.r,b.x1-e.r);e.y=clamp(e.y,b.y0+e.r,b.y1-e.r);}
      if (Math.abs(isoX(vx, vy)) > 0.05) e.flip = isoX(vx, vy) < 0;
      // contact
      if (dist < e.r + p.r + 0.05 + (this.mounted >= 0 && !d.fly ? TURRET.reach : 0) && e.atkCd <= 0 && e.spawnT <= 0 && e.stunT <= 0) {
        e.atkCd = 0.8;
        this.takeDamage(d.dmg * (this.night > 1 && !d.boss ? RANKS[e.rank ?? 0].hit : e.elite && !d.elite ? 1.5 : 1) * (1 + this.time / 600) * this.nightPower, e.x, e.y);
        if (this.build.ks('tank', 2)) this.damageEnemy(e, this.stats.maxHp * 0.2 * this.globalMore(), '#9fb4ff', true); // Spiky Costume
      }
    }
    // separation
    for (const e of this.enemies) {
      if (e.dead || e.def.boss) continue;
      this.query(e.x, e.y, 1, (o) => {
        if (o === e || o.id < e.id) return;
        const dx = o.x - e.x, dy = o.y - e.y, rr = e.r + o.r;
        const d2 = dx * dx + dy * dy;
        if (d2 < rr * rr && d2 > 1e-6) {
          const d = Math.sqrt(d2), push = (rr - d) * 0.5;
          const nx = dx / d, ny = dy / d;
          const me = e.def.mass, mo = o.def.mass, tot = me + mo;
          if (e.def.fly || e.def.phase) { e.x -= nx * push * (mo / tot); e.y -= ny * push * (mo / tot); }
          else this.moveCircle(e, -nx * push * (mo / tot), -ny * push * (mo / tot), e.r * 0.85);
          if (o.def.fly || o.def.phase || o.def.boss) { o.x += nx * push * (me / tot); o.y += ny * push * (me / tot); }
          else this.moveCircle(o, nx * push * (me / tot), ny * push * (me / tot), o.r * 0.85);
        }
      });
    }
    // player pushes out of enemies slightly
    if (this.enemies.length > 400) this.enemies = this.enemies.filter((e) => !e.dead);
    else if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
  }

  private bossAI(e: Enemy, dt: number, dx: number, dy: number, dist: number) {
    const rage = !e.def.invulnerable && e.hp < e.maxHp * 0.5;
    e.p1 -= dt; e.p2 -= dt; e.p3 -= dt;
    // Delayed ground strikes remain attached to their boss and disappear with it.
    for (const strike of e.strikes ?? []) {
      strike.t -= dt;
      if (strike.t <= 0) {
        this.zones.push({kind:'boom',x:strike.x,y:strike.y,r:strike.r,t:0,life:.3,dmg:0,tick:0,color:e.def.color});
        if (Math.hypot(this.p.x-strike.x,this.p.y-strike.y) < strike.r+this.p.r) this.takeDamage(strike.dmg,strike.x,strike.y);
      }
    }
    e.strikes = (e.strikes ?? []).filter(s=>s.t>0);
    const aim = Math.atan2(dy,dx);
    const shot = (angle:number,speed=4,dmg=12) => this.ebullets.push({x:e.x,y:e.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,r:.16,dmg:dmg*this.nightPower,life:4,color:e.def.color,kind:'orb',dead:false});
    const warn = (x:number,y:number,r:number,delay=.8,dmg=18) => {
      this.zones.push({kind:'warn',x,y,r,t:0,life:delay,dmg:0,tick:0});
      (e.strikes ??= []).push({x,y,r,t:delay,dmg:dmg*this.nightPower});
    };
    if (e.type === FINAL_BOSS) {
      // No escorts. Tentacle slams on the kid, rings of hexes, and below half health a raking volley as well.
      // Every hit grows with the length of the run, so it stays the hardest thing in town however strong the kid is.
      const hurt = 1 + this.time / 1200;
      if (e.p1 <= 0) {
        e.p1 = rage ? 2.2 : 3;
        const n = rage ? 2 : 1;
        for(let i=-n;i<=n;i++) warn(this.p.x+Math.cos(aim+Math.PI/2)*i*2,this.p.y+Math.sin(aim+Math.PI/2)*i*2,1.35,1.1,30*hurt);
      }
      if (e.p2 <= 0) {
        e.p2 = rage ? 3.6 : 5;
        const count = 18, turn = this.time * 0.37;
        for (let i = 0; i < count; i++) shot(turn + i / count * Math.PI * 2, 3.4, 16 * hurt);
        if (rage) for (let i = 0; i < count; i++) shot(turn + (i + 0.5) / count * Math.PI * 2, 2.4, 16 * hurt);
      }
      if (rage && e.p3 <= 0) {
        e.p3 = 4;
        for (let i = -3; i <= 3; i++) shot(aim + i * 0.12, 6.2, 20 * hurt);
      }
      return;
    }
    const pattern = BOSS_ATTACKS[e.type];
    if (pattern) {
      if(e.p1<=0){
        e.p1=rage?2.6:4;
        if(pattern==='fan') for(let i=-2;i<=2;i++) shot(aim+i*.22);
        if(pattern==='ring') for(let i=0;i<12;i++) shot(i*Math.PI/6+this.time*.1,3.3);
        if(pattern==='mortar') for(let i=-1;i<=1;i++) warn(this.p.x+i*1.6,this.p.y-i*.8,1.1,1,16);
        if(pattern==='pulse') {
          warn(e.x,e.y,3.2,1,20);
          if(e.maxShield>0) e.shield=Math.min(e.maxShield,e.shield+e.maxShield*.12);
        }
        if(pattern==='charge'){
          e.lungeX=dx/(dist||1);e.lungeY=dy/(dist||1);e.lungeT=1.2;
          for(let i=1;i<=4;i++)this.zones.push({kind:'warn',x:e.x+e.lungeX*i,y:e.y+e.lungeY*i,r:.7,t:0,life:.5,dmg:0,tick:0});
        }
        if(pattern==='beam'){
          e.lungeX=dx/(dist||1);e.lungeY=dy/(dist||1);e.lungeT=.9;
          for(let i=1;i<=6;i++)this.zones.push({kind:'warn',x:e.x+e.lungeX*i,y:e.y+e.lungeY*i,r:.45,t:0,life:.9,dmg:0,tick:0});
        }
      }
      if(e.lungeT>0){
        const before=e.lungeT;e.lungeT=Math.max(0,e.lungeT-dt);
        if(pattern==='charge'&&e.lungeT<.7) this.moveCircle(e,e.lungeX*dt*7,e.lungeY*dt*7,e.r);
        if(pattern==='beam'&&before>0&&e.lungeT===0)for(let i=-1;i<=1;i++)shot(Math.atan2(e.lungeY,e.lungeX)+i*.035,9,18);
      }
      return;
    }
    // Original four bosses keep their attacks, but all reinforcements now use the capped family escort.
    if(e.p1<=0){
      e.p1=rage?2.2:3.8;
      const ring=e.type==='warden'||e.type==='king',count=ring?(e.type==='king'?16:12):5;
      for(let i=0;i<count;i++)shot(ring?i/count*Math.PI*2:aim+(i-2)*.18);
    }
    if(e.p2<=0){
      e.p2=rage?6:9;
      if(e.type==='alpha'){
        e.lungeT=.5;e.lungeX=dx/(dist||1);e.lungeY=dy/(dist||1);
        this.zones.push({kind:'warn',x:this.p.x,y:this.p.y,r:1.4,t:0,life:.6,dmg:0,tick:0});
      }else this.minionT=Math.min(this.minionT,0);
    }
    if(e.type==='alpha'&&e.lungeT>0){e.lungeT-=dt;this.moveCircle(e,e.lungeX*dt*7,e.lungeY*dt*7,e.r);}
    if(e.type==='king'&&e.p3<=0){e.p3=rage?5:7;for(let i=-4;i<=4;i++)shot(aim+i*.14,6,10);}
  }

  // ---------- bullets ----------
  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (b.dead) continue;
      b.initialPierce ??= b.pierce;
      const def = b.src?.def;
      if (def?.boomerang && !b.child) {
        if (!b.back && b.life <= dt) this.turnBack(b); // far point reached
        if (b.back) {
          const to = b.by ?? this.p, hx = to.x - b.x, hy = to.y - b.y, hl = Math.hypot(hx, hy), sp = Math.hypot(b.vx, b.vy) || 1;
          if (hl < 0.55) { b.dead = true; continue; } // caught
          b.vx = (hx / hl) * sp; b.vy = (hy / hl) * sp;
        }
      }
      const px = b.x, py = b.y;
      const travelDt = Math.min(dt, Math.max(0, b.life));
      const moveX = b.vx * travelDt, moveY = b.vy * travelDt;
      // Sample the whole swept path: fast shots must not skip thin wall cells.
      const steps = Math.max(1, Math.ceil(Math.hypot(moveX, moveY) * CR * 2));
      let wall = false;
      if (b.back) { b.x = px + moveX; b.y = py + moveY; } // a returning glaive comes home over the rooftops
      else for (let i = 1; i <= steps; i++) {
        b.x = px + moveX * i / steps; b.y = py + moveY * i / steps;
        if (cellAt(this.map, b.x, b.y) === 2) { wall = true; break; }
      }
      // what stopped it was a parked car: every bullet leaves its mark (a rocket's blast does that by itself)
      if (wall && !b.explode && !b.clipped && this.carAt(b.x, b.y)) { b.clipped = true; this.demolish(b.x, b.y, 0.5, BULLET_WRECK, b.dmg); }
      if (wall && def?.boomerang && !b.child) { wall = false; b.x = px; b.y = py; this.turnBack(b); } // it turns at a wall instead of stopping
      if (wall && def?.demolish && def.kind === 'flame') this.demolish(b.x, b.y, 0.5, 2.5, b.dmg);
      // Grid Disc: lay the neon line behind it, a piece at a time
      if (def?.trail && !b.child && b.lx !== undefined && (Math.hypot(b.x - b.lx, b.y - b.ly!) > 0.9 || wall || b.life - dt <= 0)) {
        this.zones.push({ kind: 'trail', x: b.lx, y: b.ly!, x1: b.x, y1: b.y, r: 0.38, t: 0, life: def.trail, dmg: b.dmg * TRAIL_TICK, tick: 0, color: b.color });
        b.lx = b.x; b.ly = b.y;
      }
      b.life -= dt;
      if (b.z) b.z = Math.max(0, b.z - dt * 130);
      b.spin += dt * 12;
      if (b.home) {
        let best: Enemy | null = null, bd = 36;
        this.query(b.x, b.y, 6, (e) => {
          if (b.hit.includes(e.id)) return;
          const d = (e.x - b.x) ** 2 + (e.y - b.y) ** 2;
          if (d < bd) { bd = d; best = e; }
        });
        if (best) {
          const t = best as Enemy;
          const sp = Math.hypot(b.vx, b.vy);
          const dx = t.x - b.x, dy = t.y - b.y, l = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, dt * (b.homeK ?? 7));
          b.vx += ((dx / l) * sp - b.vx) * k;
          b.vy += ((dy / l) * sp - b.vy) * k;
          const nl = Math.hypot(b.vx, b.vy) || 1;
          b.vx = (b.vx / nl) * sp; b.vy = (b.vy / nl) * sp;
        }
        if (!b.homeK && Math.random() < 0.5) this.particle(b.x, b.y, 0.5, 0, 0, 0.3, 0.3, '#c46bff', 5, 'glow');
      }
      if (b.kind === 'water' || b.kind === 'fire') if (Math.random() < 0.3) this.particle(b.x, b.y, 0.4, 0, 0, -0.5, 0.25, b.color, 4, 'glow');
      if (b.kind === 'rocket' || b.kind === 'shell') this.particle(px, py, 0.45, rand(-0.3, 0.3), rand(-0.3, 0.3), 0.5, 0.4, '#bbb', 5, 'sq');
      else if (b.kind === 'missile') { if (Math.random() < 0.6) this.particle(px, py, 0.45, rand(-0.2, 0.2), rand(-0.2, 0.2), 0.4, 0.3, '#cfc8c0', 3, 'sq'); }
      else if (b.kind === 'glaive' || b.kind === 'disc') { if (Math.random() < 0.5) this.particle(px, py, 0.45, 0, 0, 0, 0.25, b.color, 5, 'glow'); }
      else if (b.kind === 'flame') { if (Math.random() < 0.35) this.particle(b.x, b.y, 0.5, rand(-0.6, 0.6), rand(-0.6, 0.6), rand(0.5, 1.6), 0.3, Math.random() < 0.5 ? '#ffb347' : '#ff5a1a', rand(4, 8), 'glow'); }
      const pathX = b.x - px, pathY = b.y - py, pathSq = pathX * pathX + pathY * pathY;
      const hits: [number, Enemy][] = [];
      this.query((px + b.x) / 2, (py + b.y) / 2, Math.sqrt(pathSq) / 2 + 1.5, (e) => {
        if (e.spawnT > 0 || b.hit.includes(e.id)) return;
        if (wall && !lineOfSight(this.map, px, py, e.x, e.y)) return;
        const at = pathSq ? clamp(((e.x - px) * pathX + (e.y - py) * pathY) / pathSq, 0, 1) : 0;
        const rr = e.r + b.r;
        if ((e.x - px - pathX * at) ** 2 + (e.y - py - pathY * at) ** 2 <= rr * rr) hits.push([at, e]);
      });
      hits.sort((a, b) => a[0] - b[0]);
      for (const [at, e] of hits) {
        if (b.dead) break;
        if (e.dead) continue;
        b.hit.push(e.id);
        const l = Math.hypot(b.vx, b.vy) || 1;
        this.hitSrc = b.mate ? null : b.src ?? null;
        if (b.explode > 0) {
          b.x = px + pathX * at; b.y = py + pathY * at;
          this.detonate(b);
          if (b.shock > 0 && Math.random() < b.shock) this.chain(e, b.dmg * 0.5);
          this.hitSrc = null;
          if (this.bossBreak) return;
          break;
        }
        this.applyHit(e, b.dmg, b.crit, b.fire, b.shock, b.ecto, b.vx / l, b.vy / l, b.vamp, false, this.projectileProfile(b));
        this.hitSrc = null;
        if (this.bossBreak) return;
        if (b.src && !b.mate && !b.child && b.hit.length === 1 && this.ins(b.src, 'split')) {
          // Two-for-One: the shot splits into two smaller ones on its first hit
          const a0 = Math.atan2(b.vy, b.vx);
          for (const da of [-0.55, 0.55]) this.bullets.push({ ...b, x: px + pathX * at, y: py + pathY * at, vx: Math.cos(a0 + da) * l, vy: Math.sin(a0 + da) * l, dmg: b.dmg * 0.45, hit: [...b.hit], child: true, pierce: 0, initialPierce: 0, life: Math.max(0.3, b.life * 0.7) });
        }
        for (let i = 0; i < 3; i++) this.particle(b.x, b.y, 0.4, rand(-2, 2), rand(-2, 2), rand(0.5, 2), 0.25, b.color, 3, 'sq');
        if (b.pierce > 0) b.pierce--;
        else if (b.bounce > 0) {
          b.bounce--;
          b.ricocheted = true;
          b.x = px + pathX * at; b.y = py + pathY * at; wall = false;
          let best: Enemy | null = null, bd = 25;
          for (const o of this.enemies) {
            if (o.dead || b.hit.includes(o.id)) continue;
            const d = (o.x - b.x) ** 2 + (o.y - b.y) ** 2;
            if (d < bd) { bd = d; best = o; }
          }
          if (best) {
            const o = best as Enemy;
            const dx = o.x - b.x, dy = o.y - b.y, dl = Math.hypot(dx, dy) || 1;
            b.vx = (dx / dl) * l; b.vy = (dy / dl) * l;
            b.life = Math.max(b.life, 0.6);
          } else b.dead = true;
          break; // A ricochet changes the trajectory; don't hit old-path targets.
        } else if (def?.scorch) this.bulletDie(b); // a flame that ends on a monster can still set the ground alight
        else b.dead = true;
      }
      // Creature impacts before a wall resolve first; surviving shots then hit it.
      if (!b.dead && wall) {
        if (b.bounce > 0) {
          b.bounce--; b.ricocheted = true;
          if (cellAt(this.map, px, b.y) !== 2) b.vx = -b.vx;
          else if (cellAt(this.map, b.x, py) !== 2) b.vy = -b.vy;
          else { b.vx = -b.vx; b.vy = -b.vy; }
          b.x = px; b.y = py;
        } else this.bulletDie(b);
      }
      if (!b.dead && b.life <= 0) this.bulletDie(b);
      if (this.bossBreak) return;
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  /** Star Glaive: turn for home, a little faster, free to hit everything a second time */
  private turnBack(b: Bullet) {
    b.back = true; b.life = 4; b.hit = [];
    b.vx *= -1.2; b.vy *= -1.2;
  }
  private projectileProfile(b: Bullet): DamageProfile {
    return { element: b.element !== undefined ? b.element : b.src?.def.elem ?? (b.kind === 'fire' || b.kind === 'rocket' ? 'fire' : b.kind === 'hex' ? 'ecto' : null), pierce: b.initialPierce ?? b.pierce, ricochet: !!b.ricocheted, demolish: !!b.src?.def.demolish && !b.child };
  }
  private bulletDie(b: Bullet) {
    if (b.explode > 0) { this.detonate(b); return; }
    b.dead = true;
    const def = b.src?.def;
    // Dragon's Breath: some of the fire sticks to the ground
    if (def?.scorch && !b.child && Math.random() < 0.3 && this.zones.length < 90 && cellAt(this.map, b.x, b.y) === 0) this.zones.push({ kind: 'fire', x: b.x, y: b.y, r: 0.75, t: 0, life: 2.6, dmg: b.dmg * 1.2, tick: 0 });
    for (let i = 0; i < 3; i++) this.particle(b.x, b.y, 0.4, rand(-1, 1), rand(-1, 1), rand(0.5, 1.5), 0.2, b.color, 2, 'sq');
  }
  /** an explosive shot going off where it is: a blast, or for the Event Horizon a singularity that blasts later */
  private detonate(b: Bullet) {
    if (b.spent) return;
    b.spent = true; b.dead = true;
    const profile = this.projectileProfile(b), def = b.src?.def;
    if (def?.vortex && !b.child) {
      this.zones.push({ kind: 'vortex', x: b.x, y: b.y, r: 3.4, t: 0, life: def.vortex, dmg: b.dmg, tick: 0, color: b.color, blast: b.explode, crit: !!b.crit, demolish: profile.demolish });
      gameAudio.play('skill', 0.35);
      return;
    }
    this.explode(b.x, b.y, b.explode, b.dmg, profile.element ?? null, true, !!b.crit, profile);
  }

  private updateEBullets(dt: number) {
    const p = this.p;
    for (const b of this.ebullets) {
      if (b.dead) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || cellAt(this.map, b.x, b.y) === 2) b.dead = true;
      else if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (b.r + p.r) ** 2) {
        b.dead = true;
        this.takeDamage(b.dmg, b.x, b.y);
      }
    }
    this.ebullets = this.ebullets.filter((b) => !b.dead);
  }

  // ---------- zones & lobs ----------
  private updateZones(dt: number) {
    const s = this.stats;
    for (const l of this.lobs) {
      l.t += dt;
      if (l.t >= l.dur) {
        this.explode(l.x1, l.y1, 2.2 * Math.sqrt(s.skillPow), 34 * s.dmg * s.skillPow, 'fire', true);
        this.zones.push({ kind: 'fire', x: l.x1, y: l.y1, r: 1.6 * Math.sqrt(s.skillPow), t: 0, life: 3.5, dmg: 5.6 * s.dmg, tick: 0 });
      }
    }
    this.lobs = this.lobs.filter((l) => l.t < l.dur);
    for (const z of this.zones) {
      z.t += dt;
      if (z.kind === 'fire') {
        z.tick -= dt;
        if (Math.random() < 0.5) this.particle(z.x + rand(-z.r, z.r) * 0.7, z.y + rand(-z.r, z.r) * 0.7, 0, 0, 0, rand(1, 2.5), 0.5, Math.random() < 0.5 ? '#ff7a1a' : '#ffcf3a', 5, 'glow');
        if (z.tick <= 0) {
          z.tick = 0.4;
          this.query(z.x, z.y, z.r + 0.5, (e) => {
            if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) this.applyHit(e, z.dmg, false, 0.35, 0, 0, 0, 0, false, true, { element: 'fire' });
          });
        }
      } else if (z.kind === 'trail') {
        // a lingering line: whatever stands on it is cut every tick
        z.tick -= dt;
        if (z.tick <= 0) {
          z.tick = 0.3;
          const x1 = z.x1 ?? z.x, y1 = z.y1 ?? z.y, lx = x1 - z.x, ly = y1 - z.y, l2 = lx * lx + ly * ly || 1e-6;
          const from = z.wake ? Math.min(1, z.t / z.life) : 0; // a wake has already dissolved up to here
          this.query((z.x + x1) / 2, (z.y + y1) / 2, Math.sqrt(l2) / 2 + z.r + 0.6, (e) => {
            const at = clamp(((e.x - z.x) * lx + (e.y - z.y) * ly) / l2, from, 1);
            if (Math.hypot(e.x - z.x - lx * at, e.y - z.y - ly * at) < z.r + e.r) this.applyHit(e, z.dmg, false, 0, 0, 0, 0, 0, false, true, { pierce: 99 });
          });
        }
      } else if (z.kind === 'vortex') {
        // Event Horizon: everything nearby is dragged to the middle, then it goes off
        this.query(z.x, z.y, z.r + 0.5, (e) => {
          const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy) || 1;
          if (d > z.r) return;
          const f = (e.def.boss ? 1.2 : 7) / Math.max(1, e.def.mass * 0.5) * Math.min(1, d);
          const nx = e.x + (dx / d) * f * dt, ny = e.y + (dy / d) * f * dt;
          if (e.def.fly || e.def.phase || e.def.boss || cellAt(this.map, nx, ny) === 0) { e.x = nx; e.y = ny; }
        });
        if (Math.random() < 0.7) { const a = rand(0, Math.PI * 2); this.particle(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r, 0.6, -Math.cos(a) * 5, -Math.sin(a) * 5, 0, 0.45, '#d59bff', 5, 'glow'); }
        if (!z.done && z.t >= z.life) {
          z.done = true;
          this.explode(z.x, z.y, z.blast ?? 2.2, z.dmg, 'ecto', true, !!z.crit, { element: 'ecto', demolish: z.demolish });
          if (this.bossBreak) return;
        }
      } else if (z.kind === 'tornado') {
        z.tick -= dt;
        const pullR = z.r * 1.8;
        this.query(z.x, z.y, pullR + 0.5, (e) => {
          if (e.def.boss) return;
          const dx = z.x - e.x, dy = z.y - e.y, d = Math.hypot(dx, dy) || 1;
          if (d < pullR) {
            const f = 4 / e.def.mass;
            e.x += (dx / d) * f * dt + (-dy / d) * f * 0.6 * dt;
            e.y += (dy / d) * f * dt + (dx / d) * f * 0.6 * dt;
          }
        });
        if (z.tick <= 0) {
          z.tick = 0.25;
          this.query(z.x, z.y, z.r + 0.5, (e) => {
            if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) this.applyHit(e, z.dmg, Math.random() < s.crit, 0, 0.1, 0, 0, 0, false, false);
          });
        }
        if (Math.random() < 0.8) {
          const a = rand(0, Math.PI * 2);
          this.particle(z.x + Math.cos(a) * z.r, z.y + Math.sin(a) * z.r, rand(0, 1.5), -Math.sin(a) * 4, Math.cos(a) * 4, 1, 0.5, '#f4f4f0', 4, 'sq');
        }
      }
    }
    this.zones = this.zones.filter((z) => z.t < z.life);
  }

  // ---------- demolition (cars and houses) ----------
  /**
   * Heavy weapons wreck the street: a car caught in the blast at (x, y), or a house hit directly, takes `points` of structural damage. A car
   * goes up like a bomb; a house burns down and never answers its door again, but it spills what was inside.
   */
  private carsOf = new WeakMap<GameMap, PropInst[]>();
  /** the parked car (not yet a wreck) standing on this spot, if any */
  private carAt(x: number, y: number): PropInst | null {
    let cars = this.carsOf.get(this.map);
    if (!cars) this.carsOf.set(this.map, cars = this.map.props.filter(pr => pr.kind === 'car' && !pr.removed));
    for (const pr of cars) if (!pr.wreck && x >= pr.x0 && x <= pr.x0 + pr.fw && y >= pr.y0 && y <= pr.y0 + pr.fh) return pr;
    return null;
  }
  private demolish(x: number, y: number, r: number, points: number, dmg: number) {
    for (const pr of this.map.props) {
      if (pr.removed || pr.wreck || (pr.kind !== 'car' && pr.kind !== 'house')) continue;
      const nx = clamp(x, pr.x0, pr.x0 + pr.fw), ny = clamp(y, pr.y0, pr.y0 + pr.fh);
      // a house only suffers from a hit on the house itself: a fight on its lawn does not burn it down by accident
      if (Math.hypot(nx - x, ny - y) > (pr.kind === 'house' ? Math.min(r, 0.7) : r * 0.6)) continue;
      pr.hp = (pr.hp ?? (pr.kind === 'car' ? CAR_HP : HOUSE_HP)) - points;
      pr.burnT = Math.max(pr.burnT ?? 0, 2.5); // it catches for a moment even when it survives
      if (pr.hp > 0) continue;
      const cx = pr.x0 + pr.fw / 2, cy = pr.y0 + pr.fh / 2, house = pr.kind === 'house';
      pr.wreck = true; pr.boomT = 0; pr.burnT = house ? 40 : 16;
      this.hitStop = Math.max(this.hitStop, 0.05);
      gameAudio.play('boom', 0.95);
      this.explode(cx, cy, house ? 3.4 : 2.6, Math.max(20, dmg * 2), 'fire', true, false, { element: 'fire', noWreck: true }); // no chain of wrecks from one blast
      this.shake = Math.max(this.shake, house ? 16 : 11);
      for (let i = 0; i < (house ? 3 : 1); i++) this.zones.push({ kind: 'fire', x: cx + rand(-pr.fw, pr.fw) * 0.45, y: pr.y0 + pr.fh + 0.5 + rand(0, 0.6), r: 0.9, t: 0, life: 5, dmg: Math.max(3, dmg * 0.3), tick: 0 });
      if (house) {
        const h = this.map.houses.find(q => q.prop === pr);
        if (h) {
          h.gone = true; h.visited = true; h.trick = false;
          if (h.light) h.light.i = 0;
          if (this.tutorialHouse === h) this.selectTutorialHouse();
          if (this.tot?.house === h) this.cancelTot(false);
          this.relightWhenAllVisited(); // a house that burnt down no longer has to be visited
          // what was inside lands on the lawn
          for (let i = 0; i < 10; i++) this.dropPickup(h.door.x, h.door.y, 'coin', 3);
          for (let i = 0; i < 6; i++) this.dropPickup(h.door.x, h.door.y, 'xp3', 4);
          if (Math.random() < 0.35) this.dropWeapon(h.door.x + 0.4, h.door.y + 0.4, makeWeapon(null, rollRarity(this.stats.luck + 1, 1), this.lootLevel()));
        }
        this.text(cx, cy, 'HOUSE DOWN!', '#ff8a1e', 18);
      } else {
        for (let i = 0; i < 4; i++) this.dropPickup(cx, cy, 'coin', 2);
        this.text(cx, cy, 'KABOOM!', '#ffcf3a', 16);
      }
    }
  }
  /** burning wrecks: their timers, their smoke, and the heat that hurts monsters standing against them */
  private updateWrecks(dt: number) {
    for (const pr of this.map.props) {
      if (!pr.burnT && pr.boomT === undefined) continue;
      if (pr.boomT !== undefined && (pr.boomT += dt) > 1.2) pr.boomT = undefined;
      if (pr.burnT) {
        pr.burnT = Math.max(0, pr.burnT - dt);
        if (Math.random() < 0.25) this.particle(pr.x0 + rand(0, pr.fw), pr.y0 + rand(0, pr.fh), rand(1, 2.5), rand(-0.3, 0.3), rand(-0.3, 0.3), rand(1, 2), rand(0.6, 1.2), '#3a3230', rand(5, 9), 'sq');
      }
    }
  }

  // ---------- pickups ----------
  dropPickup(x: number, y: number, kind: Pickup['kind'], value: number) {
    const a = rand(0, Math.PI * 2), sp = rand(0.5, 2);
    this.pickups.push({ x, y, z: 0.2, vz: rand(2, 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind, value, mag: false, t: 0, dead: false });
  }
  /**
   * A treat bag rolls ONE kind of haul (plus a little candy), so bags stay surprising and guns stay special:
   * a gun · a free treat · a level for the gun in hand · a candy hoard · first aid · a costume.
   */
  private openBag(x: number, y: number) {
    const table = BAG_LOOT.map(([kind, weight]) => [kind, weight * (kind === 'costume' ? this.stats.costumeLuck : 1)] as const);
    let r = Math.random() * table.reduce((a, b) => a + b[1], 0), kind = 'gun';
    for (const [k, w] of table) { r -= w; if (r <= 0) { kind = k; break; } }
    const w = this.weapon;
    if (kind === 'upgrade' && !w) kind = 'gun';
    if (kind === 'costume' && !this.randomCostume()) kind = 'hoard'; // already in costume: candy instead
    for (let i = 0; i < 3; i++) this.dropPickup(x, y, 'coin', 2);
    for (let i = 0; i < 3; i++) this.dropPickup(x, y, 'xp2', 2);
    if (kind === 'gun') this.dropWeapon(x, y, makeWeapon(null, rollRarity(this.stats.luck + 1, 1), this.lootLevel()));
    else if (kind === 'treat') {
      const sc = rollScrolls(1, this.scrolls, this.stats.luck + 1, 2)[0];
      if (sc) {
        this.scrolls[sc.id] = (this.scrolls[sc.id] || 0) + 1; this.scrollOrder.push(sc.id); this.recalcStats();
        this.setBanner(`TREAT BAG: ${sc.name.toUpperCase()}`, sc.desc, 'loot');
        gameAudio.play('unlock', 0.5);
      }
    } else if (kind === 'upgrade' && w) {
      w.level++;
      this.syncTeamWeapons();
      this.text(this.p.x, this.p.y, `${w.def.name} +1 LEVEL`, '#ffc453', 16);
      this.setBanner('GUN UPGRADE!', `${w.def.name} is now level ${w.level}`, 'loot');
    } else if (kind === 'hoard') {
      for (let i = 0; i < 14; i++) this.dropPickup(x, y, 'coin', 3);
      for (let i = 0; i < 8; i++) this.dropPickup(x, y, 'xp3', 4);
    } else if (kind === 'aid') {
      for (let i = 0; i < 2; i++) this.dropPickup(x, y, 'heal', 25);
      this.p.shield = this.stats.maxShield;
      this.text(this.p.x, this.p.y, 'SHIELD FULL', '#7fd8ff', 14);
    } else this.dropCostume(x, y, this.randomCostume());
  }
  /** fan everything dropped since `first` out in a ring so a treat bag's haul is easy to read */
  private scatterLoot(x: number, y: number, first: number) {
    const loot = this.pickups.slice(first), n = loot.length;
    const big = loot.filter((it) => it.kind === 'weapon' || it.kind === 'costume');
    const off = rand(0, Math.PI * 2);
    loot.forEach((it, i) => {
      const special = it.kind === 'weapon' || it.kind === 'costume';
      // guns and costumes land well apart (opposite sides); candy and coins fill the ring between them
      const a = special ? off + (big.indexOf(it) / Math.max(1, big.length)) * Math.PI * 2 : off + ((i + 0.5) / n) * Math.PI * 2 + rand(-0.25, 0.25);
      const d = special ? 2.2 : rand(1.2, 2.8);
      it.x = x; it.y = y; it.vx = Math.cos(a) * d * 3; it.vy = Math.sin(a) * d * 3; it.z = 0.3; it.vz = special ? 5 : rand(3, 5.5);
      it.t = 0;
    });
  }
  /** the magnet a boss leaves where it fell (drawn for BOSS_MAGNET_TIME) */
  lootMagnet: { x: number; y: number; t: number; map: GameMap } | null = null;
  /** A boss drops a magnet: every coin and candy on the map flies to the spot where it fell and waits there in a pile. */
  private dropLootMagnet(x: number, y: number) {
    this.lootMagnet = { x, y, t: 0, map: this.map };
    let pulled = 0;
    for (const k of this.pickups) {
      if (k.dead || k.friendOnly || k.kind === 'weapon' || k.kind === 'chest' || k.kind === 'costume') continue;
      const a = rand(0, Math.PI * 2), d = Math.sqrt(Math.random()) * 0.85, tx = x + Math.cos(a) * d, ty = y + Math.sin(a) * d;
      k.pull = cellAt(this.map, tx, ty) === 0 ? { x: tx, y: ty } : { x, y };
      k.mag = false; k.vx = 0; k.vy = 0; pulled++;
    }
    this.text(x, y, 'LOOT MAGNET', '#ff8a8a', 14);
    if (pulled) this.toast('The boss dropped a magnet: every coin and candy in town is piled up where it fell.');
  }
  dropWeapon(x: number, y: number, w: Weapon) {
    this.pickups.push({ x, y, z: 0.5, vz: 3, vx: 0, vy: 0, kind: 'weapon', value: 0, weapon: w, mag: false, t: 0, dead: false });
  }

  private updatePickups(dt: number) {
    const p = this.p, s = this.stats;
    const magR = 1.0 * s.magnet;
    if (this.lootMagnet && (this.lootMagnet.t += dt) > BOSS_MAGNET_TIME) this.lootMagnet = null;
    for (const k of this.pickups) {
      k.t += dt;
      if (k.friendOnly) { if (k.t > 45) k.dead = true; continue; }
      if (k.kind === 'weapon' && k.t > GUN_GROUND_TIME && k !== this.inspecting) {
        // nobody wanted it: the street is not a gun rack
        k.dead = true;
        for (let i = 0; i < 8; i++) this.particle(k.x, k.y, 0.3, rand(-1, 1), rand(-1, 1), rand(1, 3), 0.5, '#c9bda6', 3, 'sq');
        continue;
      }
      if (k.pull) {
        // the boss magnet: over the rooftops, fast from far away and gentle at the end; it lands with a fresh minute
        const tx = k.pull.x - k.x, ty = k.pull.y - k.y, td = Math.hypot(tx, ty), step = Math.max(6, td * 2.5) * dt;
        k.z = Math.min(0.9, k.z + dt * 3); k.vz = 0;
        if (td <= step) { k.x = k.pull.x; k.y = k.pull.y; k.pull = undefined; k.t = 0.61; }
        else { k.x += (tx / td) * step; k.y += (ty / td) * step; }
        continue;
      }
      if (k.t > LOOT_GROUND_TIME && !k.mag && (k.kind === 'coin' || k.kind === 'chest' || k.kind.startsWith('xp'))) { // swept up
        k.dead = true;
        if (k.kind === 'chest') for (let i = 0; i < 8; i++) this.particle(k.x, k.y, 0.3, rand(-1, 1), rand(-1, 1), rand(1, 3), 0.5, '#ffcf3a', 3, 'sq');
        continue;
      }
      if (k.z > 0 || k.vz > 0) {
        k.vz -= 12 * dt;
        k.z += k.vz * dt;
        if (k.z <= 0) { k.z = 0; k.vz = Math.abs(k.vz) > 2 ? -k.vz * 0.35 : 0; }
      }
      k.vx *= Math.pow(0.05, dt); k.vy *= Math.pow(0.05, dt);
      const nx = k.x + k.vx * dt, ny = k.y + k.vy * dt;
      if (cellAt(this.map, nx, ny) === 0) { k.x = nx; k.y = ny; }
      if (k.kind === 'weapon' || k.kind === 'chest' || k.kind === 'costume') continue;
      const dx = p.x - k.x, dy = p.y - k.y, d = Math.hypot(dx, dy);
      if ((d < magR && k.t > 0.6) || k.mag) { // freshly dropped loot rests a moment so you can see it
        k.mag = true;
        const sp = 9 + k.t;
        k.x += (dx / (d || 1)) * sp * dt;
        k.y += (dy / (d || 1)) * sp * dt;
      }
      if (d < 0.35) {
        k.dead = true;
        gameAudio.play('pickup', 0.4);
        if (k.kind === 'coin') {
          const v = Math.ceil(k.value * s.coinGain);
          p.coins += v;
          this.text(p.x, p.y, `+${v}¢`, '#ffd23a', 11);
        } else if (k.kind === 'heal') {
          const v = s.maxHp * 0.2;
          p.hp = Math.min(s.maxHp, p.hp + v);
          this.text(p.x, p.y, `+${Math.round(v)} HP`, '#7dff5a', 14);
        } else {
          const gained = k.value * s.xpGain;
          p.xp += gained; this.xpCollected += gained;
          while (p.xp >= p.xpNext) {
            p.xp -= p.xpNext;
            p.level++;
            p.xpNext = xpFor(p.level);
            // A level-up no longer opens the picker (boss kills do): it puts the kid back on their feet instead.
            p.hp = s.maxHp; p.shield = s.maxShield;
            this.text(p.x, p.y, `LEVEL ${p.level}! HEALED`, '#7dff5a', 15);
            gameAudio.play('revive', 0.35);
          }
        }
      }
    }
    if (this.pickups.length > 500) {
      // Compact nearby settled XP into piles, never vacuum distant loot past the pickup radius.
      const piles = new Map<string, Pickup>();
      for (const k of this.pickups) {
        if (k.dead || k.friendOnly || k.mag || !k.kind.startsWith('xp') || k.z > 0 || k.vz > 0 || k.t <= 0.6) continue;
        const key = `${Math.floor(k.x)}:${Math.floor(k.y)}:${k.kind}`;
        const pile = piles.get(key);
        if (pile) { pile.value += k.value; k.dead = true; }
        else piles.set(key, k);
      }
    }
    this.pickups = this.pickups.filter((k) => !k.dead);
  }

  private updateInteract() {
    const p = this.p;
    if (this.mounted >= 0) {
      const t = this.turrets[this.mounted];
      this.nearbyWeapon = null; this.nearbyCostume = null;
      this.interact = { kind: 'turret', label: 'Climb down', ref: t.gym };
      if (this.input.pressed.has('e')) this.dismount();
      return;
    }
    if (this.rescuePrompt) { this.interact = null; this.nearbyWeapon = null; this.nearbyCostume = null; return; }
    this.nearbyWeapon = null;
    this.nearbyCostume = null;
    if (this.tot) { this.interact = null; return; }
    let best: Game['interact'] = null, bd = 1.5 * 1.5;
    for (const k of this.pickups) {
      if (k.kind !== 'weapon' && k.kind !== 'chest' && k.kind !== 'costume') continue;
      const d = (k.x - p.x) ** 2 + (k.y - p.y) ** 2;
      if (d < bd) {
        bd = d;
        best = k.kind === 'weapon' ? { kind: 'weapon', label: `Inspect ${k.weapon!.def.name}`, ref: k }
          : k.kind === 'costume' ? { kind: 'costume', label: `Put on ${COSTUME_BY_ID[k.costume!].name} costume`, ref: k }
          : { kind: 'chest', label: 'Open Treat Bag', ref: k };
      }
    }
    for (let i = 0; i < this.turrets.length; i++) {
      const t = this.turrets[i], d = (t.x - p.x) ** 2 + (t.y - p.y) ** 2;
      if (d < 2.7 * 2.7 && (!best || best.kind === 'turret' || d < bd + 2)) { bd = Math.min(bd, d); best = { kind: 'turret', label: 'Climb up · man the Candy Cannon', ref: t.gym }; }
    }
    for (const sh of this.map.shops) {
      const d = (sh.x - p.x) ** 2 + (sh.y - p.y) ** 2;
      if (d < bd * 1.4) { bd = d; best = sh.prop.kind === 'vending'
        ? { kind: 'vending', label: 'Play the Midnight Candy Machine · earned coins only', ref: sh.prop }
        : { kind: 'shop', label: "Shop: Candy Lady's Treats", ref: sh.prop }; }
    }
    for (const h of this.map.houses) {
      if(ARCADE_OPEN&&h.prop.kind==='arcade'&&!h.gone){
        if(this.arcadeShut)continue; // closed for the night
        const d=(h.door.x-p.x)**2+(h.door.y-p.y)**2;
        if(d<Math.min(bd,1.5**2)){bd=d;best={kind:'portal',label:'Enter the Starcade',ref:{...h.door,label:'Enter the Starcade',target:'arcade'}};}
        continue;
      }
      if (h.visited) continue;
      const d = (h.door.x - p.x) ** 2 + (h.door.y - p.y) ** 2;
      if (d < Math.min(bd, 1.1 * 1.1)) {
        bd = d;
        best = { kind: 'house', label: `Trick or Treat at ${h.owner}'s (you'll be stuck for ${(3.4 * this.stats.totSpeed).toFixed(1)}s!)`, ref: h };
      }
    }
    for(const portal of this.map.portals??[]){
      const d=(portal.x-p.x)**2+(portal.y-p.y)**2;
      if(d<Math.min(bd,1.8**2)){bd=d;best={kind:'portal',label:portal.label,ref:portal};}
    }
    if(this.map.kind==='arcade')for(const staff of this.availableArcadeStaff){
      const d=(staff.x-p.x)**2+(staff.y-p.y)**2;
      if(d<Math.min(bd,1.6**2)){bd=d;best={kind:'hire',label:hasFullGame()?`Recruit ${HERO_INFO[staff.hero].name} · ${staff.cost} coins`:`${HERO_INFO[staff.hero].name} · joins you in the full game`,ref:staff};}
    }
    this.interact = best;
    if (best && best.kind === 'weapon') this.nearbyWeapon = (best.ref as Pickup).weapon!;
    if (best && best.kind === 'costume') this.nearbyCostume = (best.ref as Pickup).costume!;
    if (best && this.input.pressed.has('e')) {
      if (best.kind === 'hire' && !hasFullGame()) {
        // Maya and Leo are full-game kids: free players meet them here, and that is all
        this.input.pressed.clear(); this.toast(`${HERO_INFO[(best.ref as typeof ARCADE_STAFF[number]).hero].name} can be recruited in the full game.`);
      } else if (best.kind === 'hire') {
        this.hiringHero=(best.ref as typeof ARCADE_STAFF[number]).hero;this.state='hire';this.input.pressed.clear();gameAudio.play('click',.35);
      } else if (best.kind === 'portal') {
        this.travelArcade((best.ref as NonNullable<GameMap['portals']>[number]).target);
      } else if (best.kind === 'turret') {
        this.mountTurret(this.turrets.findIndex((t) => t.gym === best!.ref));
      } else if (best.kind === 'house') {
        this.startTot(best.ref as HouseInst);
      } else if (best.kind === 'costume') {
        const k = best.ref as Pickup;
        k.dead = true;
        const old = this.wearCostume(k.costume!);
        if (old) this.dropCostume(p.x, p.y, old);
        this.pickups = this.pickups.filter((x) => !x.dead);
      } else if (best.kind === 'weapon') {
        // inspect first (the world pauses), then the player picks the slot
        gameAudio.play('click', 0.35);
        this.inspecting = best.ref as Pickup;
        this.state = 'inspect';
      } else if (best.kind === 'chest') {
        const k = best.ref as Pickup;
        k.dead = true;
        const first = this.pickups.length;
        this.openBag(k.x, k.y);
        this.scatterLoot(k.x, k.y, first);
        for (let i = 0; i < 20; i++) this.particle(k.x, k.y, 0.3, rand(-2, 2), rand(-2, 2), rand(2, 5), 0.8, ['#ff4d6d', '#ffd23a', '#7dff5a', '#b44dff'][i % 4], 4, 'sq');
        this.pickups = this.pickups.filter((x) => !x.dead);
      } else if (best.kind === 'vending') {
        this.openVending(best.ref as PropInst);
      } else {
        this.state = 'shop';
      }
    }
  }

  // ---------- discarding a treat ----------
  /** the treat the player is being asked about (the world is paused while the question is up) */
  discarding: string | null = null;
  private discardReturn: GameState = 'play';
  /** ask "discard this treat?": from the left rail while playing, or from the run build screen */
  askDiscard(id: string) {
    if (!['play', 'inventory', 'pause'].includes(this.state) || !(this.scrolls[id] > 0) || !SCROLL_BY_ID[id]) return;
    this.discardReturn = this.state; this.discarding = id; this.state = 'discard';
    this.input.pressed.clear();
  }
  /** yes: one copy of the treat is gone for good and the build is recalculated. Either way, back to where we were. */
  answerDiscard(yes: boolean) {
    if (this.state !== 'discard') return;
    const id = this.discarding;
    if (yes && id && this.scrolls[id] > 0) {
      if (--this.scrolls[id] <= 0) delete this.scrolls[id];
      const at = this.scrollOrder.lastIndexOf(id);
      if (at >= 0) this.scrollOrder.splice(at, 1);
      this.recalcStats();
      this.p.dashCharges = Math.min(this.p.dashCharges, this.stats.dashCharges);
      for (const w of this.p.weapons) if (w) w.ammo = Math.min(w.ammo, weaponStats(w, this.stats).mag);
      gameAudio.play('click', 0.4);
    }
    this.discarding = null;
    this.state = this.discardReturn;
    this.input.pressed.clear();
  }

  // ---------- weapon inspect ----------
  takeInspected(slot: number) {
    const k = this.inspecting, p = this.p;
    if (!k || k.dead || !k.weapon || slot < 0 || slot > 1) { this.closeInspect(); return; }
    k.dead = true;
    const old = p.weapons[slot];
    if (old) { old.reloadT = 0; this.dropWeapon(p.x, p.y, old); this.toast(`Your ${old.def.name} is on the ground next to you.`); }
    p.weapons[slot] = k.weapon;
    p.cur = slot;
    this.syncTeamWeapons();
    gameAudio.play('pickup', 0.5);
    this.text(p.x, p.y, k.weapon.def.name, '#fff', 14);
    if (k.weapon.rarity >= 2) this.setBanner('NEW WEAPON!', `${k.weapon.def.name} · ${['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'][k.weapon.rarity]}`, 'loot');
    this.pickups = this.pickups.filter((x) => !x.dead);
    if (this.prizeGun) {
      // the doorstep prize is taken now: the bowl is done
      this.prizeGun = false; this.treatGuideNotice = false;
      this.gunChoices = []; this.choices = []; this.friendChoice = null;
      this.choiceMode = 'level';
      p.invuln = 1;
    }
    this.closeInspect();
  }
  closeInspect() {
    if (this.prizeGun) { this.backToPrizes(); return; } // leaving a prize unpicked never loses the bowl
    this.inspecting = null;
    if (this.state === 'inspect') this.state = 'play';
    this.input.pressed.clear();
  }

  // ---------- earned-coin vending reel ----------
  openVending(prop: PropInst) {
    if (this.state !== 'play' || prop.kind !== 'vending' || !this.map.shops.some(shop => shop.prop === prop)) return;
    this.vendingActive = true;
    this.vendingSpin = null;
    this.input.pressed.clear();
    this.state = 'vending';
  }
  vendingPrice() { return this.tutorial?.freeSpin ? 0 : vendingCost(this.vendingPlays); }
  vendingPool(): VendingPrize[] { return vendingCatalogue(this.scrolls); }
  spinVending(): VendingSpin | null {
    if (this.state !== 'vending' || !this.vendingActive || (this.vendingSpin && !['claimed', 'rejected'].includes(this.vendingSpin.status))) return null;
    const cost = this.vendingPrice(), free = !!this.tutorial?.freeSpin;
    if (this.p.coins < cost) return null;
    // the tutorial's free spin always wins something real
    const spin = createVendingSpin(free ? this.vendingPool().filter(prize => prize.kind !== 'dud') : this.vendingPool(), ++this.vendingId, cost);
    if (!spin) return null;
    if (free) this.tutorial!.freeSpin = false;
    else { this.p.coins -= cost; this.vendingPlays++; }
    this.vendingSpin = spin;
    gameAudio.play('click', .25);
    return spin;
  }
  settleVending(id: number) {
    if (this.state !== 'vending' || !this.vendingActive || this.vendingSpin?.id !== id || this.vendingSpin.status !== 'spinning') return;
    this.vendingSpin.status = 'won';
    gameAudio.play('unlock', .35);
  }
  claimVending(slot = -1): boolean {
    const spin = this.vendingSpin;
    if (this.state !== 'vending' || !this.vendingActive || spin?.status !== 'won') return false;
    const prize = spin.winner;
    if (prize.kind === 'weapon' && (!Number.isInteger(slot) || slot < 0 || slot > 1)) return false;
    spin.status = 'claimed'; // Mark before applying: double clicks cannot grant twice.
    if (prize.kind === 'dud') { this.input.pressed.clear(); return true; } // nothing to hand over
    if (prize.kind === 'treat') {
      this.scrolls[prize.scroll.id] = (this.scrolls[prize.scroll.id] || 0) + 1;
      this.scrollOrder.push(prize.scroll.id);
      this.recalcStats();
    } else {
      const old = this.p.weapons[slot];
      if (old) { old.reloadT = 0; this.dropWeapon(this.p.x, this.p.y, old); }
      prize.weapon.level = Math.max(prize.weapon.level, this.lootLevel()); // the machine's guns keep up too
      this.p.weapons[slot] = prize.weapon;
      this.p.cur = slot; this.syncTeamWeapons();
    }
    this.input.pressed.clear();
    gameAudio.play('pickup', .35);
    return true;
  }
  rejectVending(): boolean {
    const spin = this.vendingSpin;
    if (this.state !== 'vending' || !this.vendingActive || spin?.status !== 'won' || spin.winner.kind !== 'weapon') return false;
    spin.status = 'rejected';
    this.input.pressed.clear();
    return true;
  }
  closeVending() {
    if (this.state !== 'vending' || !this.vendingActive) return;
    const spin = this.vendingSpin;
    if (spin?.status === 'spinning') return;
    if (spin?.status === 'won') {
      if (spin.winner.kind === 'weapon') this.rejectVending(); // Leaving explicitly rejects an unwanted gun; no refund or duplicate drop.
      else this.claimVending();
    }
    this.vendingActive = false; this.input.pressed.clear(); this.state = 'play'; this.p.invuln = .8;
  }

  // ---------- level up / shop ----------
  // ---------- trick or treat ----------
  private startTot(h: HouseInst) {
    gameAudio.play('door', 0.45);
    const dur = 3.4 * this.stats.totSpeed;
    const c = this.p.costume ? COSTUME_BY_ID[this.p.costume] : null;
    const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
    const lines: TotState['lines'] = [
      { at: 0, who: 'kid', text: pick(['Trick or treat!', 'TRICK OR TREAT!', 'Trick or treat! Smell my feet!']) },
      { at: dur * 0.3, who: 'door', text: pick(['*creeeak*…', '*ding-dong*', 'Coming, coming!']) },
    ];
    if (h.trick) {
      lines.push({ at: dur * 0.55, who: 'trick', text: 'Ooh… what a TASTY little kid…' });
      lines.push({ at: dur * 0.82, who: 'trick', text: 'TRICK!!! Hehehe!' });
    } else {
      lines.push({ at: dur * 0.55, who: 'door', text: c ? c.line : 'No costume? Hmm… where is your costume, kiddo?' });
      lines.push({ at: dur * 0.82, who: 'door', text: c ? pick(GIVE_LINES) : 'Well… here, have a raisin box.' });
    }
    this.tot = { house: h, t: 0, dur, stage: 0, lines };
    this.p.aiming = false;
    // the doorbell attracts the horde!
    const n = 3 + Math.floor(this.time / 40);
    this.spawnAround(this.p.x, this.p.y, n, 5.5, 8, this.time > 120 ? ['zombie', 'skeleton', 'bat', 'ghost'] : ['zombie', 'zombie', 'bat']);
    this.text(this.p.x, this.p.y - 0.5, 'The doorbell draws monsters!', '#ff6a6a', 13);
  }
  cancelTot(fled: boolean) {
    if (!this.tot) return;
    if (this.tot.house.light) this.tot.house.light.i = 0.9;
    this.tot = null;
    this.bubbles = this.bubbles.filter((b) => b.who === 'kid');
    if (fled) {
      this.bubble(this.p.x, this.p.y, 115, 'AAAH! Nope!', 'kid', 1.2, true);
      this.p.dashCharges = Math.max(this.p.dashCharges, 1);
    }
  }
  private spawnAround(x: number, y: number, n: number, r0: number, r1: number, types: string[]) {
    const boss=this.boss&&!this.boss.dead?this.boss:null;
    if(boss){
      types=BOSS_MINIONS[boss.type]??[];
      n=Math.min(n,24-this.enemies.filter(e=>e.minion&&!e.dead).length);
    }
    if(!types.length||n<=0)return;
    let made = 0;
    for (let i = 0; i < n * 4 && made < n; i++) {
      const a = rand(0, Math.PI * 2), d = rand(r0, r1);
      const ex = x + Math.cos(a) * d, ey = y + Math.sin(a) * d;
      const type = types[Math.floor(Math.random() * types.length)];
      const fly = !!EDEF[type].fly || !!EDEF[type].phase;
      if (ex < 1 || ey < 1 || ex > MAP_W - 1 || ey > MAP_H - 1) continue;
      if ((!fly || this.map.kind==='arcade') && (cellAt(this.map, ex, ey) !== 0 || !this.reachable(ex, ey))) continue;
      const e=this.spawnEnemy(type, ex, ey);
      if(boss)e.minion=true;
      made++;
    }
  }
  private updateTot(dt: number) {
    for (const b of this.bubbles) {
      b.life -= dt;
      if (b.follow) { b.x = this.p.x; b.y = this.p.y; }
    }
    this.bubbles = this.bubbles.filter((b) => b.life > 0);
    const T = this.tot;
    if (!T) return;
    T.t += dt;
    const h = T.house;
    if (h.light) h.light.i = 1.3 + Math.sin(this.time * 10) * 0.1;
    while (T.stage < T.lines.length && T.t >= T.lines[T.stage].at) {
      const L = T.lines[T.stage];
      if (L.who === 'kid') this.bubble(this.p.x, this.p.y, 115, L.text, 'kid', Math.max(1.2, T.dur * 0.5), true);
      else this.bubble(h.door.x - 0.15, h.door.y - 0.15, 135, L.text, L.who, Math.max(1.2, T.dur * 0.45));
      T.stage++;
    }
    if (T.t >= T.dur) this.finishTot();
  }
  private finishTot() {
    const T = this.tot!;
    const h = T.house;
    this.tot = null;
    const trick = h.trick;
    h.visited = true;
    this.housesVisited++;
    if (h.light) h.light.i = 0.12;
    this.relightWhenAllVisited();
    const dx = h.door.x, dy = h.door.y;
    if (trick) {
      this.shake = 10;
      this.explode(dx, dy, 1.2, 0, null, false);
      this.spawnAround(dx, dy, 4, 1, 2.5, ['pumpkin']);
      this.spawnAround(dx, dy, 4, 0.5, 2, ['bat']);
      for (let i = 0; i < 6; i++) this.dropPickup(dx, dy, 'coin', 2);
        this.setBanner("IT'S A TRICK!", `${h.owner} was a monster all along!`, 'danger');
      this.bubble(this.p.x, this.p.y, 115, 'NOT COOL!', 'kid', 1.5, true);
      return;
    }
    const costumed = !!this.p.costume;
    const rewards = rewardRangeFor(h.prop.kind);
    // candy fountain from the door
    for (let i = 0; i < (costumed ? 10 : 5); i++) this.dropPickup(dx, dy, 'coin', 2);
    for (let i = 0; i < (costumed ? 8 : 4); i++) this.dropPickup(dx, dy, 'xp2', 2);
    if (Math.random() < 0.25) this.dropPickup(dx, dy, 'heal', 25);
    // now and then the neighbour leaves something extra on the porch: say so, or it looks like a stray drop once the bowl closes
    if (Math.random() < (costumed ? 0.15 : 0.07)) {
      const extra = makeWeapon(null, rollRarity(this.stats.luck + 2, rewards.min, rewards.max), this.lootLevel());
      this.dropWeapon(dx + 0.4, dy + 0.4, extra);
      this.toast(`Bonus: ${h.owner} also left a ${extra.def.name} on the porch.`);
    }
    if (Math.random() < Math.min(0.06, 0.025 * this.stats.costumeLuck)) {
      this.dropCostume(dx - 0.4, dy + 0.5, this.randomCostume());
      this.toast(`Bonus: ${h.owner} also left a costume on the porch.`);
    }
    for (let i = 0; i < 24; i++) this.particle(dx, dy, 0.6, rand(-2, 2), rand(-2, 2), rand(2, 5), 0.9, ['#ff4d6d', '#ffd23a', '#7dff5a', '#b44dff'][i % 4], 4, 'sq');
    this.bubble(this.p.x, this.p.y, 115, costumed ? 'Thank you!!' : 'Aww… thanks.', 'kid', 1.4, true);
    this.choiceGiver = h.owner;
    if (!this.treatGuideComplete) {
      this.treatGuideComplete = true;
      this.tutorialHouse = null;
      this.treatGuideNotice = true;
    }
    const n = 3 + this.stats.totChoices;
    this.openLevelUp('house', n, this.stats.luck + (costumed ? 3 : 0), rewards);
  }

  private choiceN = 3;
  private choiceLuck = 0;
  choiceRewardRange = rewardRangeFor('house');
  openLevelUp(mode: ChoiceMode, n = 3, luck = this.stats.luck, rewards: RewardRange = rewardRangeFor(mode)) {
    this.choiceMode = mode;
    this.choiceN = n;
    this.choiceLuck = luck;
    this.choiceRewardRange = rewards;
    this.rollChoices();
    this.state = 'levelup';
  }
  /** Reward quality depends on the visited building; each card can be a treat or a gun. */
  private rollChoices() {
    this.rollLocked();
    const n = this.choiceN, luck = this.choiceLuck;
    if (this.choiceMode === 'boss') {
      // A boss pays in the rarer loot: always a gun, the first one Epic or better, and never a friend card.
      this.friendChoice = null;
      const { min, max } = this.choiceRewardRange;
      const guns = n <= 1 ? n : Math.max(1, Math.min(n - 1, 1 + [0, 1].filter(() => Math.random() < 0.45).length));
      this.choices = rollScrolls(n - guns, this.scrolls, luck, min, max);
      this.gunChoices = Array.from({ length: n - this.choices.length }, (_, i) => makeWeapon(null, rollBossRarity(luck, i === 0 ? 3 : 2), this.lootLevel()));
      return;
    }
    if (this.choiceMode !== 'house') {
      this.gunChoices = []; this.friendChoice = null;
      this.choices = rollScrolls(n, this.scrolls, luck);
      return;
    }
    // Free game: now and then one of the cards is a kid who wants to come along (the rescue campaign finds its friends
    // at the gazebos instead). Only the free kids, and never one who is already with you.
    // While the rescue campaign is open, full-game players do not get them at doors: their friends are the ones they
    // find in hide and seek (far stronger) and the Starcade crew. With it shelved, everyone meets friends at doors.
    const recruits = this.campaign || (campaignOffered() && hasFullGame()) ? [] : [0, 1, 2].filter(h => h !== this.hero && !this.friends.some(f => f.hero === h));
    this.friendChoice = recruits.length && n >= 2 && Math.random() < FRIEND_CARD_CHANCE ? recruits[Math.floor(Math.random() * recruits.length)] : null;
    const loot = n - (this.friendChoice === null ? 0 : 1);
    let guns = 0;
    for (let i = 0; i < loot; i++) if (Math.random() < 0.4) guns++;
    guns = Math.min(guns, loot - 1); // always at least one treat on offer
    const { min, max } = this.choiceRewardRange;
    this.choices = rollScrolls(loot - guns, this.scrolls, luck, min, max);
    this.gunChoices = Array.from({ length: loot - this.choices.length }, () => makeWeapon(null, rollRarity(luck + 2, min, max), this.lootLevel()));
  }
  private rollLocked() {
    this.lockedChoice = null;
    if (hasFullGame()) return;
    const { min, max } = this.choiceMode === 'house' || this.choiceMode === 'boss' ? this.choiceRewardRange : { min: 0, max: 4 };
    const scrolls = LOCKED_SCROLLS().filter(s => s.rarity >= min && s.rarity <= max);
    const gun = Math.random() < 0.5 ? makeLockedWeapon(rollRarity(this.choiceLuck + 2, Math.max(min, 2), max)) : null;
    if (gun) gun.level = this.lootLevel(); // the teaser shows what the kid would really find
    if (gun) this.lockedChoice = { scroll: null, weapon: gun };
    else if (scrolls.length) this.lockedChoice = { scroll: scrolls[Math.floor(Math.random() * scrolls.length)], weapon: null };
  }
  /**
   * The locked full-game prize in a bowl, earned by watching an ad (the UI calls this only after the reward): it is
   * this bowl's pick, for this run. A treat is applied; a gun goes into a free hand, or lands at the kid's feet to be
   * looked at and swapped like any gun on the ground.
   */
  takeLocked(): boolean {
    const lock = this.lockedChoice;
    if (this.state !== 'levelup' || !lock) return false;
    this.lockedChoice = null;
    this.treatGuideNotice = false;
    this.input.pressed.clear();
    gameAudio.play('unlock');
    if (lock.weapon) {
      const free = this.p.weapons.findIndex((w) => !w);
      if (free >= 0 && free < 2) { this.p.weapons[free] = lock.weapon; this.p.cur = free; this.syncTeamWeapons(); }
      else this.dropWeapon(this.p.x + 0.5, this.p.y + 0.4, lock.weapon);
      this.setBanner('NEW WEAPON!', `${lock.weapon.def.name} · ${RARITY[lock.weapon.rarity].name}`, 'loot');
    } else if (lock.scroll) {
      this.scrolls[lock.scroll.id] = (this.scrolls[lock.scroll.id] || 0) + 1;
      this.scrollOrder.push(lock.scroll.id);
      this.recalcStats();
    }
    // it was this window's pick: close the window the way any pick does
    const mode = this.choiceMode;
    this.gunChoices = []; this.choices = []; this.friendChoice = null;
    this.choiceMode = 'level';
    if (mode === 'shop') { this.state = 'shop'; return true; }
    if (mode === 'level') {
      this.pendingLevels = Math.max(0, this.pendingLevels - 1);
      if (this.pendingLevels > 0) { this.choiceN = 3; this.choiceLuck = this.stats.luck; this.rollChoices(); return true; }
    }
    this.state = 'play';
    this.p.invuln = 1;
    return true;
  }
  reroll() {
    if (this.rerolls <= 0) return;
    this.rerolls--;
    this.rollChoices();
  }
  /** take a gun from a trick-or-treat bowl: straight into a free slot, else inspect it and pick the slot */
  chooseGun(i: number) {
    const w = this.gunChoices[i];
    if (this.state !== 'levelup' || !w || (this.choiceMode !== 'house' && this.choiceMode !== 'boss')) return;
    gameAudio.play('unlock');
    this.input.pressed.clear();
    const p = this.p;
    const free = p.weapons.findIndex((x) => !x);
    if (free >= 0 && free < 2) {
      this.treatGuideNotice = false;
      this.gunChoices = []; this.choices = []; this.friendChoice = null;
      this.choiceMode = 'level';
      p.invuln = 1;
      p.weapons[free] = w;
      p.cur = free;
      this.syncTeamWeapons();
      this.setBanner('NEW WEAPON!', `${w.def.name} · ${RARITY[w.rarity].name}`, 'loot');
      this.state = 'play';
      return;
    }
    // Both hands are full: the prize is only looked at for now. The bowl stays as it is, so the kid can compare the gun
    // with the two carried and still go back for another prize (see backToPrizes). It is taken when a slot is chosen.
    this.inspecting = { x: p.x, y: p.y, z: 0, vz: 0, vx: 0, vy: 0, kind: 'weapon', value: 0, mag: false, t: 0, dead: false, weapon: w };
    this.prizeGun = true;
    this.state = 'inspect';
  }
  /** the gun on the inspect screen is a doorstep prize that has not been taken yet */
  prizeGun = false;
  /** not this one after all: back to the bowl, every prize still there */
  backToPrizes() {
    if (this.state !== 'inspect' || !this.prizeGun) return;
    this.inspecting = null; this.prizeGun = false;
    this.input.pressed.clear();
    this.state = 'levelup';
  }
  /** take the friend card: they join the team, and become your helper if you have none */
  chooseFriend() {
    const hero = this.friendChoice;
    if (this.state !== 'levelup' || hero === null || this.campaign || hero < 0 || hero > 2 || hero === this.hero || this.choiceMode !== 'house' || this.friends.some(f => f.hero === hero)) return;
    this.treatGuideNotice = false;
    gameAudio.play('revive', 0.5);
    this.input.pressed.clear();
    this.gunChoices = []; this.choices = []; this.friendChoice = null;
    this.choiceMode = 'level';
    this.addFriend(hero);
    this.setBanner(`${HERO_INFO[hero].name.toUpperCase()} JOINS YOU!`, `They fight beside you and can pick you up every ${this.friendReviveCd} seconds.`, 'loot');
    this.state = 'play';
    this.p.invuln = 1;
  }
  /** a friend joins the team next to the player (survival game), and becomes the helper if there is none */
  private addFriend(hero: number) {
    const spot = this.freeSpot(this.p.x + 0.7, this.p.y + 0.7, true);
    this.friends.push({ hero, ...spot, r: 0.24, gate: 0, status: 'rescued', guardian: null, progress: 0,
      hp: this.friendMaxHp, maxHp: this.friendMaxHp, weapon: this.friendGun(), anim: 0, flip: false, back: false, hurtCd: 0, reviveCd: 0, candy: 0 });
    if (this.activeFriend === null) this.activeFriend = hero;
    this.syncTeamWeapons();
  }
  // ---- what the Buddy System talents change about a friend ----
  get friendMaxHp() { return FRIEND_HP + (this.stats?.mateHp ?? 0); }
  /** seconds a friend who is down can still be helped up */
  get friendDownTime() { return FRIEND_DOWN_TIME + (this.stats?.mateDown ?? 0); }
  /** seconds after which a friend who is down gets up alone: Best Friends Forever, and always in hide and seek (0 = never) */
  get friendUpTime() { const seek = this.campaign ? SEEK_FRIEND_UP : 0, bff = this.stats?.mateUp ?? 0; return seek && bff ? Math.min(seek, bff) : seek || bff; }
  /** what the countdown over a downed friend runs to: getting up alone, or being out for the night */
  get friendCountdown() { return this.friendUpTime || this.friendDownTime; }
  /** seconds before the same friend can pick the player up again */
  get friendReviveCd() { return Math.round(FRIEND_REVIVE_CD * (this.stats?.mateReviveCd ?? 1)); }
  /**
   * The level of a gun the night hands out (doorsteps, bags, the candy machine): about the kid's own level, and never
   * far behind the best gun they carry, so a find is a real choice and not a level-1 toy next to an upgraded gun.
   */
  lootLevel() {
    const best = Math.max(1, ...this.p.weapons.map(w => w?.level ?? 1));
    return Math.max(1, Math.max(this.p.level, best - 1) - (Math.random() < 0.4 ? 1 : 0));
  }
  private friendGun(better = 0) { return makeWeapon('nerf', Math.min(4, 1 + better + (this.stats?.mateGun ?? 0))); }
  /** the porch lights come back on once every house has been trick-or-treated (see relightWhenAllVisited) */
  /** game time of the last shop move (the screen-edge arrows for the candy machines show for a while after it) */
  shopsMovedAt = -999;
  /**
   * After every boss the Candy Lady's stand and the candy machines set up somewhere else in the open part of town, so
   * the night keeps the player moving. Their arrow at the screen edge and their minimap markers follow them.
   */
  relocateShops() {
    if(this.map.kind==='arcade'){this.shopsMovedAt=this.time;this.toast('Pizza counter and token machine are open for the shopping break.');return;}
    const m = this.map, taken: { x: number; y: number }[] = [];
    this.computeFlow(true);
    for (const shop of m.shops) {
      const pr = shop.prop, spot = this.shopSpot(pr.fw, pr.fh, shop, taken);
      if (!spot) { taken.push({ x: shop.x, y: shop.y }); continue; }
      const cells = (x0: number, y0: number, x1: number, y1: number, v: number) => {
        for (let cy = Math.max(0, Math.floor(y0 * CR)); cy < Math.min(CH, Math.ceil(y1 * CR)); cy++)
          for (let cx = Math.max(0, Math.floor(x0 * CR)); cx < Math.min(CW, Math.ceil(x1 * CR)); cx++) m.coll[cy * CW + cx] = v;
      };
      cells(pr.x0, pr.y0, pr.x0 + pr.fw, pr.y0 + pr.fh, 0); // the old pitch is open ground again
      for (const l of pr.sp.lights) {
        const lamp = m.lights.find(q => Math.abs(q.x - (pr.x0 + l.x)) < 1e-6 && Math.abs(q.y - (pr.y0 + l.y)) < 1e-6);
        if (lamp) { lamp.x = spot.x + l.x; lamp.y = spot.y + l.y; }
      }
      pr.x0 = spot.x; pr.y0 = spot.y;
      if (pr.big) { cells(pr.x0 + 0.02, pr.y0 + 0.02, pr.x0 + pr.fw - 0.02, pr.y0 + pr.fh - 0.02, 2); shop.x = pr.x0 + pr.fw / 2; shop.y = pr.y0 + pr.fh + 0.4; }
      else { cells(pr.x0 + 0.2, pr.y0 + 0.3, pr.x0 + 0.8, pr.y0 + 0.75, 2); shop.x = pr.x0 + 0.5; shop.y = pr.y0 + 1.2; }
      taken.push({ x: shop.x, y: shop.y });
    }
    this.shopsMovedAt = this.time;
    this.computeFlow(true);
    this.toast('The Candy Lady packed up and moved. Follow the orange arrow to her new spot.');
  }
  /** a clear, reachable pitch for a shop: away from where it was, from the player, from doors and from the other shops */
  private shopSpot(fw: number, fh: number, old: { x: number; y: number }, taken: { x: number; y: number }[]) {
    const m = this.map, p = this.p;
    const clear = (x: number, y: number) => {
      // the footprint plus a tile all round, and two tiles in front where the customer stands
      for (let ty = y - 1; ty <= y + fh + 1; ty++) for (let tx = x - 1; tx <= x + fw; tx++) {
        if (tx < 2 || ty < 2 || tx >= MAP_W - 2 || ty >= MAP_H - 2 || m.ground[ty * MAP_W + tx] === G.ROAD) return false;
        for (let cy = ty * CR; cy < (ty + 1) * CR; cy++) for (let cx = tx * CR; cx < (tx + 1) * CR; cx++) if (m.coll[cy * CW + cx]) return false;
      }
      return true;
    };
    for (const [far, apart] of [[20, 14], [14, 10], [9, 7], [5, 4]]) {
      for (let i = 0; i < 300; i++) {
        const x = 2 + Math.floor(Math.random() * (MAP_W - 4 - fw)), y = 2 + Math.floor(Math.random() * (MAP_H - 5 - fh));
        const cx = x + fw / 2, cy = y + fh + 0.4;
        if (Math.hypot(cx - old.x, cy - old.y) < far || Math.hypot(cx - p.x, cy - p.y) < 8) continue;
        if (taken.some(t => Math.hypot(cx - t.x, cy - t.y) < apart)) continue;
        if (!this.reachable(cx, cy) || !clear(x, y)) continue;
        if (m.houses.some(h => Math.hypot(h.door.x - cx, h.door.y - cy) < 3.5) || m.gates.some(g => Math.hypot(g.x - cx, g.y - cy) < 4)) continue;
        if (m.hideouts.some(h => Math.hypot(h.x - cx, h.y - cy) < 4) || m.turrets.some(t => Math.hypot(t.x - cx, t.y - cy) < 4)) continue;
        if (m.props.some(pr => !pr.removed && pr.x0 < x + fw + 1 && pr.x0 + pr.fw > x - 1 && pr.y0 < y + fh + 2 && pr.y0 + pr.fh > y - 1)) continue;
        return { x, y };
      }
    }
    return null;
  }
  private relightHouses() {
    // the streets and the Starcade together: whichever of the two the kid is not in right now is relit as well
    const elsewhere = this.map.kind === 'arcade' ? this.townScene?.map : this.arcadeScene?.map;
    for (const m of [this.map, elsewhere]) {
      if (!m) continue;
      const hs = m.houses;
      for (const h of hs) {
        if (h.gone) continue; // burnt down
        h.visited = false;
        h.trick = false;
        if (h.light) h.light.i = h.lightI;
      }
      for (let i = 0; i < Math.max(1, Math.floor(hs.length / 6)); i++) hs[Math.floor(Math.random() * hs.length)].trick = true;
    }
    this.selectTutorialHouse();
    this.toast('You have been to every house: the porch lights are back on with fresh treats');
  }
  /** doors still to ring before the porch lights come back on: every house in town, and the Starcade's stands while it is open */
  get housesToGo() {
    const open = (hs: HouseInst[]) => hs.filter(h => !h.gone && !h.visited && !(ARCADE_OPEN && h.prop.kind === 'arcade')).length;
    const town = this.map.kind === 'arcade' ? this.townScene?.map.houses ?? [] : this.map.houses;
    const arcade = this.map.kind === 'arcade' ? this.map.houses : this.arcadeScene?.map.houses;
    return open(town) + (!ARCADE_OPEN || this.arcadeShut ? 0 : arcade ? open(arcade) : ARCADE_VENUES); // a closed Starcade's stands no longer count
  }
  /** Houses do not come back with time or with a boss: the kid has to trick-or-treat at every single one first. */
  private relightWhenAllVisited() {
    const left = this.housesToGo;
    if (left === 0) this.relightHouses();
    else if (left <= 3 || left === 10) this.toast(`${left} more ${left === 1 ? 'house' : 'houses'} to visit, then every porch light comes back on.`);
  }
  choose(id: string) {
    if (this.state !== 'levelup' || !this.choices.some(c => c.id === id)) return;
    this.treatGuideNotice = false;
    gameAudio.play('unlock');
    this.input.pressed.clear(); // the key that picked the card must not also swap weapons
    this.gunChoices = []; this.friendChoice = null;
    this.scrolls[id] = (this.scrolls[id] || 0) + 1;
    this.scrollOrder.push(id);
    this.recalcStats();
    if (this.choiceMode === 'shop') {
      this.choiceMode = 'level';
      this.state = 'shop';
      return;
    }
    if (this.choiceMode === 'house' || this.choiceMode === 'boss') {
      this.choiceMode = 'level';
      this.state = 'play';
      this.p.invuln = 1;
      return;
    }
    this.pendingLevels--;
    if (this.pendingLevels > 0) { this.choiceN = 3; this.choiceLuck = this.stats.luck; this.rollChoices(); }
    else {
      this.state = 'play';
      this.p.invuln = 1;
    }
  }
  shopUpgrade(slot: number) {
    const w = this.p.weapons[slot];
    if (!w) return;
    const c = this.upgradePrice(w);
    if (this.p.coins < c) return;
    this.p.coins -= c;
    if (this.tutorial?.freeUpgrade) this.tutorial.freeUpgrade = false;
    w.level++;
    this.syncTeamWeapons();
  }
  /** what the shop asks for the next level of a gun (the tutorial's first upgrade is free) */
  upgradePrice(w: Weapon) { return this.tutorial?.freeUpgrade ? 0 : upgradeCost(w); }
  shopRerolls = 0;
  /** rolling a gun's inscriptions again: each go costs 60% more than the last */
  rerollCost() { return Math.round(40 * Math.pow(1.6, this.shopRerolls)); }
  /** The Candy Lady scratches the lines off a gun and writes new ones: a gamble (see rerollInscriptions). */
  shopReroll(slot: number) {
    const w = this.p.weapons[slot], c = this.rerollCost();
    if (!w || this.p.coins < c) return;
    this.p.coins -= c;
    this.shopRerolls++;
    rerollInscriptions(w);
    w.fx = undefined; // trigger lines start counting from nothing
    this.recalcStats();
    w.ammo = Math.min(w.ammo, weaponStats(w, this.stats).mag);
    gameAudio.play('unlock', 0.3);
  }
  healCost() { return 30 + this.shopHealBuys * 15; }
  /** friends who went down and were not reached in time: the shop can bring them back */
  lostFriends: RescueFriend[] = [];
  private shopReviveBuys = 0;
  /** everyone the shop could help right now: friends out for the night, and friends lying down at this moment */
  get revivable(): RescueFriend[] { return [...this.lostFriends, ...this.friends.filter(f => f.status === 'rescued' && f.hp <= 0)]; }
  reviveCost() { return 120 + this.shopReviveBuys * 60; }
  /** The Candy Lady brings a friend back at full health, beside the kid, with the gun they had. */
  shopRevive(hero: number) {
    const f = this.revivable.find(x => x.hero === hero), c = this.reviveCost();
    if (!f || this.p.coins < c) return;
    this.p.coins -= c;
    this.shopReviveBuys++;
    this.lostFriends = this.lostFriends.filter(x => x !== f);
    Object.assign(f, this.freeSpot(this.p.x + 0.7, this.p.y + 0.7, true), { hp: f.maxHp, downT: 0, progress: 0, channel: false, hurtCd: 3, moving: false });
    if (!this.friends.includes(f)) this.friends.push(f);
    if (this.activeFriend === null) this.activeFriend = f.hero;
    this.syncTeamWeapons();
    gameAudio.play('revive');
  }
  treatCost() { return Math.round(70 * Math.pow(1.35, this.shopTreatBuys)); }
  shopHeal() {
    const c = this.healCost();
    if (this.p.coins < c || this.p.hp >= this.stats.maxHp) return;
    this.p.coins -= c;
    this.shopHealBuys++;
    this.p.hp = Math.min(this.stats.maxHp, this.p.hp + this.stats.maxHp * 0.5);
  }
  shopTreat() {
    const c = this.treatCost();
    if (this.p.coins < c) return;
    this.p.coins -= c;
    this.shopTreatBuys++;
    this.openLevelUp('shop');
  }
  closeShop() {
    this.input.pressed.clear(); // Esc/E closed the shop: don't also pause or re-open it
    this.bossBreak = false;
    this.state = 'play';
    this.p.invuln = 0.8;
  }
  skipBuyWindow() {
    if(this.state!=='play'||this.calmT<=0)return;
    this.nextBossAt-=this.calmT;
    this.calmT=0;this.spawnAcc=0;this.bossBreak=false;
    this.toast('Back to the streets. The next crew is coming.');
  }
  continueEndless() {
    this.state = 'play';
    this.startEndless();
  }
  /** After all 24 bosses comes the final encounter: an escort-free giant, far tougher than any boss but killable (see nextNight). */
  startEndless() {
    if (this.endless || this.bossRound < CAMPAIGN_BOSSES.length || this.calmT > 0) return;
    this.victorious = true;
    this.bankRewards();
    this.endless = true;
    while(this.wave<25)this.advanceWave();
    this.winDelay=0;
    this.nextBossAt=this.time+10;
    this.enemies=[];this.ebullets=[];this.spawnAcc=0;
    gameAudio.play('victory');
    this.setBanner('24 BOSSES DEFEATED', 'Something enormous is coming. Bring it down and the night starts over, harder.', 'win');
  }
  hpScale() { return enemyHealthScale(this.hpWave()); }
  private advanceWave() {
    const previous = this.hpWave();
    this.wave++;
    for (const e of this.enemies) if (!e.dead && !e.def.invulnerable) {
      const oldScale = enemyHealthScale(previous, e.fodder);
      e.fodder = this.hpWave() > 10 && !e.def.boss && !e.elite && !e.affix && this.night === 1;
      const growth = enemyHealthScale(this.hpWave(), e.fodder) / oldScale;
      e.hp *= growth; e.maxHp *= growth; e.shield *= growth; e.maxShield *= growth;
    }
  }
  private updateEndless(_dt: number) {
    if (this.bossBreak || this.calmT > 0 || this.boss) return;
    if(this.time<this.nextBossAt)return;
    const pos=this.spawnPos(true) ?? this.freeSpot(this.p.x+6,this.p.y,true);
    this.boss=this.spawnEnemy(FINAL_BOSS,pos.x,pos.y);
    this.bossMinions(0); // clears any stray enemies; this family has no minions
    this.setBanner('THE HOLLOW BEYOND', 'Incredibly strong, but it can fall. Dodge the tentacles and keep shooting.', 'danger');
  }

  /** An opened district takes its hedge blockade with it: every wall tile whose surrounding areas are all open goes. */
  private clearBarriers() {
    const open = this.map.gates.map(g => g.opened);
    for (const b of this.map.barriers) {
      if (b.cleared || !b.needs.every(i => open[i])) continue;
      b.cleared = true;
      let k = 0;
      for (let cy = b.y * CR; cy < (b.y + 1) * CR; cy++) for (let cx = b.x * CR; cx < (b.x + 1) * CR; cx++) this.map.coll[cy * CW + cx] = b.under[k++];
      if (!b.prop) continue;
      b.prop.removed = true;
      if (Math.hypot(b.x - this.p.x, b.y - this.p.y) < this.viewR + 2) this.particle(b.x + 0.5, b.y + 0.5, 0.6, rand(-1.5, 1.5), rand(-1.5, 1.5), rand(1, 3), 0.9, '#3f7a3a', 4, 'sq');
    }
  }

  // ---------- director ----------
  private spawnPos(fly: boolean) {
    const p = this.p;
    // A compact room may fit entirely on a large screen. Keep its spawn ring
    // inside the room instead of silently stopping waves on high-res displays.
    const b=this.map.bounds,ring=b?Math.min(this.viewR,Math.min(b.x1-b.x0,b.y1-b.y0)*.4):this.viewR;
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2), d = ring + rand(0.5, 3);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (x < 1 || y < 1 || x > MAP_W - 1 || y > MAP_H - 1) continue;
      if (cellAt(this.map, x, y) !== 0) continue;
      if (!fly && blockedCircle(this.map, x, y, .3)) continue;
      if (!fly && !this.reachable(x, y)) continue;
      return { x, y };
    }
    return null;
  }

  /** the boss's own crowd: an escort the moment it arrives, then squads while it lives */
  private bossMinions(dt: number) {
    const boss = this.boss!, first = this.minionBoss !== boss;
    if (first) {
      this.minionBoss = boss; this.minionT = 0;
      // The monsters already on the street are this boss's own crew: they stay and fight on as its escort.
      // Only strays of another kind (a quest guardian, a trick house's pumpkins) slip away; the final giant has no crew at all.
      const crew = BOSS_MINIONS[boss.type] ?? [];
      for (const e of this.enemies) {
        if (e === boss) continue;
        if (crew.includes(e.type)) { e.minion = true; continue; }
        e.dead = true; // slipping away, not killed: no loot
        for (let i = 0; i < 4; i++) this.particle(e.x, e.y, rand(0.2, 0.9), rand(-1, 1), rand(-1, 1), rand(1, 2.5), 0.5, '#8d8aa8', 4, 'sq');
      }
      this.enemies = this.enemies.filter(e => !e.dead);
    }
    this.minionT -= dt;
    if (this.minionT > 0) return;
    this.minionT = 6;
    const types = BOSS_MINIONS[boss.type] ?? [];
    if (!types.length) return; // The final tentacle giant must never summon escorts.
    let alive = 0;
    for (const e of this.enemies) if (e.minion && !e.dead) alive++;
    const cap = Math.min(24, 12 + this.bossRound * 3 + (this.endless ? 4 : 0));
    // it always arrives with a few at its side, however full the street already is; after that the cap holds
    const n = first ? Math.max(4, Math.min(cap - alive, 8 + Math.min(6, this.bossRound * 2))) : Math.min(cap - alive, 4 + Math.min(4, this.bossRound));
    if (n <= 0) return;
    const from = this.enemies.length;
    this.spawnAround(boss.x, boss.y, n, 1.5, 3.8, types);
    for (let i = from; i < this.enemies.length; i++) this.enemies[i].minion = true;
    if (first) this.toast(`${BOSS_NAMES[boss.type]} did not come alone: ${types.map(k => ROSTER_NAMES[k] ?? MINION_WORDS[k] ?? k).join(' and ')}.`);
  }

  private director(dt: number) {
    if (this.tutorial?.holding) return; // no monsters until Professor Fizz is done
    if (this.calmT > 0) this.wavePause += dt;
    if (this.bossBreak || this.calmT > 0 || (this.bossKilled && !this.endless)) return;
    const t=this.time, fight=!!this.boss&&!this.boss.dead;
    if(fight)this.wavePause+=dt;
    if(!this.endless&&!fight&&this.wave<this.bossRound+1){
      while(this.wave<this.bossRound+1)this.advanceWave();
      if(ARCADE_OPEN&&this.wave===ARCADE_LAST_WAVE)this.toast('Last call at the Starcade: it closes for the night when this wave is over.');
      this.setBanner(`${this.night>1?`NIGHT ${this.night} · `:''}WAVE ${this.wave} · ${BOSS_NAMES[familyForWave(this.wave)]}`, this.wave>10?'Counter their special defenses; switch weapons when needed.':'A new crew is taking over the streets.', 'danger');
    }
    const family=familyForWave(this.wave),types=BOSS_MINIONS[family];
    if(fight){this.bossMinions(dt);this.spawnAcc=0;}
    else if(!this.endless)this.spawnAcc+=dt*(.9+Math.min(t/22,10))*SPAWN_SCALE*(this.night>1?.8:1); // later nights: fewer, all lieutenants
    while(this.spawnAcc>=1){
      this.spawnAcc--;
      if(this.enemies.filter(e=>!e.dead).length>=170)break;
      const type=types[Math.random()<.6?0:1],pos=this.spawnPos(!!EDEF[type].fly||!!EDEF[type].phase);
      const eliteOdds=this.night>1?Math.min(.06,.015+this.wave*.002):Math.min(.12,.02+this.wave*.004); // later nights: these are captains
      if(pos)this.spawnEnemy(type,pos.x,pos.y,Math.random()<eliteOdds);
    }
    // Wave lieutenants stay in this boss's family rather than introducing unrelated werewolves.
    if(!fight&&!this.endless&&t>=this.nextElite){
      this.nextElite=t+(this.night>1?45:70);
      const type=types[0],pos=this.spawnPos(!!EDEF[type].fly);
      if(pos){this.spawnEnemy(type,pos.x,pos.y,true);this.toast(this.night>1?`${BOSS_NAMES[family]} has sent a ${RANKS[this.baseRank+1].name}: fast, and it casts spells.`:`${BOSS_NAMES[family]} has sent a shielded lieutenant.`);}
    }
    // chests
    if (t >= this.nextChest) {
      this.nextChest += 84; // a treat bag every ~1.5 min (was 42s)
      for (let i = 0; i < 20; i++) {
        const a = rand(0, Math.PI * 2), d = rand(4, 8);
        const x = this.p.x + Math.cos(a) * d, y = this.p.y + Math.sin(a) * d;
        if (cellAt(this.map, x, y) === 0 && this.reachable(x, y)) {
          this.pickups.push({ x, y, z: 3, vz: 0, vx: 0, vy: 0, kind: 'chest', value: 0, mag: false, t: 0, dead: false });
          this.text(x, y, 'TREAT BAG!', '#ffcf3a', 16);
          break;
        }
      }
    }
    // district gates
    for (const gate of this.map.gates) {
      if (!gate.opened && this.soon(1000 + gate.id, gate.openAt, 10)) this.toast(`The road to ${gate.name} opens in 10 seconds!`);
      if (gate.opened || t < gate.openAt) continue;
      gate.opened = true;
      gameAudio.play('unlock', 0.5);
      for (const [cx, cy] of gate.cells) this.map.coll[cy * CW + cx] = 0;
      for (const pr of this.map.props) if (gate.propIds.includes(pr.id)) pr.removed = true;
      this.clearBarriers();
      this.computeFlow(true);
      this.pickups.push({ x: gate.x, y: gate.y, z: 3, vz: 0, vx: 0, vy: 0, kind: 'chest', value: 0, mag: false, t: 0, dead: false });
      this.setBanner(`${gate.name} IS OPEN!`, 'New streets to explore — a Treat Bag waits at the gate', 'loot');
      for (let i = 0; i < 30; i++) this.particle(gate.x, gate.y, 0.3, rand(-3, 3), rand(-3, 3), rand(2, 6), 1, ['#7CFF64', '#FFC453', '#F9781B'][i % 3], 5, i % 2 ? 'glow' : 'sq');
    }
    // boss
    const at = this.nextBossAt;
    if (!this.endless && !this.boss && this.soon(-100 - this.bossRound, at, 10)) this.toast('A boss is coming. Get your weapons ready!');
    if (!this.endless && t >= at && !this.boss && this.bossRound < CAMPAIGN_BOSSES.length) {
      this.bossSpawned = true;
      const pos = this.spawnPos(true) ?? this.freeSpot(this.p.x + 6, this.p.y, true);
      const type = CAMPAIGN_BOSSES[this.bossRound];
      this.boss = this.spawnEnemy(type, pos.x, pos.y);
      this.bossMinions(0);
      this.setBanner(`${BOSS_NAMES[type].toUpperCase()} RISES`, `Boss ${this.bossRound + 1}/24 - defeat it for a Rare-or-better prize and ${BUY_WINDOW} quiet seconds to shop`, 'danger');
      if (this.turrets.length && this.mounted < 0) this.toast('Get up on a jungle gym at Hollow Creek Primary — the Candy Cannon shreds bosses!');
      this.shake = 15;
    }
  }

  // ---------- fx ----------
  particle(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, color: string, size: number, kind: Particle['kind']) {
    if (this.particles.length >= (settings.lowFx ? 300 : 900)) return;
    if (settings.lowFx && kind === 'glow' && Math.random() < 0.5) return;
    this.particles.push({ x, y, z, vx, vy, vz, life, max: life, color, size, kind });
  }
  text(x: number, y: number, text: string, color: string, size: number, kind: 'ui' | 'dmg' = 'ui') {
    if (kind === 'dmg' && this.dmgTexts++ >= DMG_TEXT_MAX) return; // a busy fight shows a readable sample, not a wall of numbers
    if (this.texts.length > 120) this.texts.shift();
    this.texts.push({ x, y, z: 0.9, text, color, life: 0.8, size, vx: rand(-0.4, 0.4), kind });
  }
  private updateFx(dt: number) {
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.z += q.vz * dt;
      if (q.kind === 'sq' || q.kind === 'gore') {
        q.vz -= 9 * dt;
        if (q.z < 0) { q.z = 0; q.vz *= -0.3; q.vx *= 0.6; q.vy *= 0.6; }
      }
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const t of this.texts) { t.life -= dt; t.z += dt * 1.4; t.x += t.vx * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
    this.dmgTexts = 0;
    for (const t of this.texts) if (t.kind === 'dmg') this.dmgTexts++;
    for (const b of this.beams) b.life -= dt;
    this.beams = this.beams.filter((b) => b.life > 0);
    for (const d of this.decals) d.life -= dt;
    if (this.decals.length > 160) this.decals.splice(0, this.decals.length - 160);
    this.decals = this.decals.filter((d) => d.life > 0);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  // ---------- HUD snapshot ----------
  snapshot() {
    const p = this.p, s = this.stats;
    const townHouses=this.rescueMap.houses.filter(h=>!ARCADE_OPEN||h.prop.kind!=='arcade');
    const arcadeHouses=this.map.kind==='arcade'?this.map.houses:this.arcadeScene?.map.houses;
    return {
      hp: p.hp, maxHp: s.maxHp, shield: p.shield, maxShield: s.maxShield, level: p.level, xp: p.xp, xpNext: p.xpNext, coins: p.coins, kills: this.kills, time: this.time,
      weapons: p.weapons.map((w) => (w ? { w, st: weaponStats(w, s) } : null)), cur: p.cur, skillCd: Math.max(0, p.skillCd), skillMax: HERO_INFO[this.hero].cd * s.skillCd,
      dashCharges: p.dashCharges, dashMax: s.dashCharges, dashRecharge: p.dashRecharge, interact: this.interact ? this.interact.label : null, nearbyWeapon: this.nearbyWeapon,
      costume: p.costume, nearbyCostume: this.nearbyCostume, interactKind: this.interact ? this.interact.kind : null,
      calm: this.calmT,
      wave: this.wave, night: this.night, waveIn: Math.max(0,this.nextBossAt-this.time), bossFight: !!this.boss && !this.boss.dead,
      momentum: this.momentum, streak: this.streak, premiumPower: this.premiumPowerT,
      turret: this.mounted >= 0 ? { heat: this.turrets[this.mounted].heat, over: this.turrets[this.mounted].over } : null,
      rescue: this.rescuePrompt ? { label: this.rescuePrompt, progress: this.rescueProgress, downed: this.state === 'downed' } : null,
      costumesFound: this.costumesFound, doorsRung: this.housesVisited,
      tot: this.tot ? { t: this.tot.t, dur: this.tot.dur, owner: this.tot.house.owner } : null,
      housesLeft:townHouses.filter(h=>!h.visited).length+(!ARCADE_OPEN?0:arcadeHouses?arcadeHouses.filter(h=>!h.visited).length:3), housesTotal:townHouses.length+(ARCADE_OPEN?3:0),
      banner: this.banner ? { ...this.banner } : null, boss: this.boss ? { hp: this.boss.hp, max: this.boss.maxHp, shield: this.boss.shield, maxShield: this.boss.maxShield, shieldT: this.boss.shieldT, name: BOSS_NAMES[this.boss.type], invulnerable:!!this.boss.def.invulnerable } : null, scrolls: { ...this.scrolls }, state: this.state, enemies: this.enemies.length,
      bossIn: this.boss || (this.bossKilled && !this.endless) ? null : Math.max(0, this.nextBossAt - this.time), toasts: this.toasts.map((q) => ({ id: q.id, text: q.text })), bigMap: this.bigMap,
    };
  }
}
export type HudSnap = ReturnType<Game['snapshot']>;
