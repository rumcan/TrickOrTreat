import { MAP_W, MAP_H, CR, CW, CH, screenDirToWorld, screenToWorld, isoX, isoY, rand, clamp, Elem, ELEM } from './config';
import { buildMap, GameMap, cellAt, lineOfSight, PropInst, HouseInst } from './map';
import { settings } from './settings';
import {
  Stats, baseStats, applyTalents, Save, Weapon, makeWeapon, weaponStats, rollRarity, Scroll, rollScrolls, SCROLL_BY_ID, HERO_INFO, upgradeCost, BulletKind, storeSave,
  COSTUMES, COSTUME_BY_ID, GIVE_LINES,
} from './data';

export interface Bubble { x: number; y: number; lift: number; text: string; life: number; max: number; who: 'kid' | 'door' | 'trick'; follow?: boolean }
export interface Toast { id: number; text: string; t: number }
export type BannerKind = 'info' | 'danger' | 'loot' | 'win';
export interface TotState { house: HouseInst; t: number; dur: number; stage: number; lines: { at: number; who: 'kid' | 'door' | 'trick'; text: string }[] }
export type ChoiceMode = 'level' | 'shop' | 'house';

// ================= INPUT =================
export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  mx = 0; my = 0; mdown = false; rdown = false; rpressed = false; wheel = 0; mouseActive = false;
  private el: HTMLElement;
  constructor(el: HTMLElement) {
    this.el = el;
    window.addEventListener('keydown', this.kd);
    window.addEventListener('keyup', this.ku);
    el.addEventListener('mousemove', this.mm);
    el.addEventListener('mousedown', this.md);
    window.addEventListener('mouseup', this.mu);
    el.addEventListener('wheel', this.wh, { passive: true });
    el.addEventListener('contextmenu', this.cm);
  }
  kd = (e: KeyboardEvent) => {
    const k = e.key.toLowerCase();
    if (!this.keys.has(k)) this.pressed.add(k);
    this.keys.add(k);
    if ([' ', 'tab'].includes(k)) e.preventDefault();
  };
  ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
  mm = (e: MouseEvent) => {
    const r = this.el.getBoundingClientRect();
    this.mx = e.clientX - r.left;
    this.my = e.clientY - r.top;
    this.mouseActive = true;
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
  endFrame() {
    this.pressed.clear();
    this.rpressed = false;
    this.wheel = 0;
  }
  destroy() {
    window.removeEventListener('keydown', this.kd);
    window.removeEventListener('keyup', this.ku);
    this.el.removeEventListener('mousemove', this.mm);
    this.el.removeEventListener('mousedown', this.md);
    window.removeEventListener('mouseup', this.mu);
    this.el.removeEventListener('wheel', this.wh);
    this.el.removeEventListener('contextmenu', this.cm);
  }
}

// ================= ENTITY TYPES =================
export interface EnemyDef { hp: number; speed: number; dmg: number; r: number; xp: number; coin: number; fly?: boolean; phase?: boolean; ranged?: boolean; bomber?: boolean; elite?: boolean; boss?: boolean; color: string; mass: number; anim: number }
export const EDEF: Record<string, EnemyDef> = {
  zombie: { hp: 32, speed: 1.25, dmg: 8, r: 0.28, xp: 1, coin: 0.3, color: '#7aa35a', mass: 1, anim: 6 },
  bat: { hp: 12, speed: 2.7, dmg: 5, r: 0.2, xp: 1, coin: 0.2, fly: true, color: '#3a2446', mass: 0.5, anim: 12 },
  skeleton: { hp: 55, speed: 1.75, dmg: 10, r: 0.28, xp: 2, coin: 0.4, color: '#e8e2d0', mass: 1, anim: 8 },
  ghost: { hp: 42, speed: 1.5, dmg: 10, r: 0.28, xp: 2, coin: 0.4, phase: true, color: '#cfe0ff', mass: 0.7, anim: 6 },
  pumpkin: { hp: 26, speed: 2.3, dmg: 22, r: 0.26, xp: 2, coin: 0.5, bomber: true, color: '#ee7a22', mass: 0.8, anim: 10 },
  witch: { hp: 75, speed: 1.2, dmg: 8, r: 0.3, xp: 4, coin: 0.8, ranged: true, color: '#8ac46a', mass: 1, anim: 6 },
  werewolf: { hp: 420, speed: 2.0, dmg: 20, r: 0.45, xp: 25, coin: 1, elite: true, color: '#5a4030', mass: 4, anim: 8 },
  king: { hp: 7000, speed: 1.0, dmg: 25, r: 1.0, xp: 250, coin: 1, boss: true, color: '#ff8a1e', mass: 50, anim: 6 },
};

export interface Enemy {
  id: number; type: string; def: EnemyDef; x: number; y: number; hp: number; maxHp: number; r: number; anim: number; flip: boolean;
  hit: number; burnT: number; burnDps: number; burnAcc: number; ectoT: number; stunT: number; atkCd: number; kx: number; ky: number;
  shootT: number; lungeT: number; lungeX: number; lungeY: number; p1: number; p2: number; p3: number; orbitT: number; dead: boolean; elite: boolean; spawnT: number;
}
export interface Bullet {
  x: number; y: number; vx: number; vy: number; dmg: number; r: number; life: number; pierce: number; bounce: number; kind: BulletKind; color: string;
  crit: number; fire: number; shock: number; ecto: number; explode: number; hit: number[]; vamp: boolean; dead: boolean; spin: number; home?: boolean;
}
export interface EBullet { x: number; y: number; vx: number; vy: number; r: number; dmg: number; life: number; color: string; kind: 'orb' | 'seed'; dead: boolean }
export interface Pickup { x: number; y: number; z: number; vz: number; vx: number; vy: number; kind: 'xp1' | 'xp2' | 'xp3' | 'coin' | 'heal' | 'chest' | 'weapon' | 'costume'; value: number; weapon?: Weapon; costume?: string; mag: boolean; t: number; dead: boolean }
export interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: string; size: number; kind: 'sq' | 'glow' | 'leaf' }
export interface FText { x: number; y: number; z: number; text: string; color: string; life: number; size: number; vx: number; kind: 'ui' | 'dmg' }
export interface Beam { x0: number; y0: number; x1: number; y1: number; color: string; life: number; max: number; zig: boolean; w: number }
export interface Zone { kind: 'fire' | 'tornado' | 'boom' | 'flash' | 'warn'; x: number; y: number; r: number; t: number; life: number; dmg: number; tick: number; ang?: number; color?: string }
export interface Lob { x0: number; y0: number; x1: number; y1: number; t: number; dur: number }
export interface Decal { x: number; y: number; r: number; color: string; life: number; rot: number }

export type GameState = 'play' | 'levelup' | 'shop' | 'dead' | 'victory' | 'pause';

export interface Player {
  x: number; y: number; r: number; hp: number; shield: number; shieldT: number; invuln: number; dashT: number; dashRecharge: number; dashCharges: number;
  dashX: number; dashY: number; back: boolean; flip: boolean; anim: number; moving: boolean; weapons: (Weapon | null)[]; cur: number;
  aimX: number; aimY: number; aiming: boolean; skillCd: number; level: number; xp: number; xpNext: number; coins: number; revives: number; recoil: number; hurtT: number;
  costume: string | null; novaCd: number; stompT: number; hexT: number;
}

const xpFor = (l: number) => Math.floor(6 + l * 5 + l * l * 0.7);

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
  choices: Scroll[] = [];
  choiceMode: ChoiceMode = 'level';
  choiceGiver = '';
  tot: TotState | null = null;
  bubbles: Bubble[] = [];
  housesVisited = 0;
  costumesFound = 0;
  private costumesWorn = new Set<string>();
  private dashHit = new Set<number>();
  rerolls = 0;
  shopHealBuys = 0;
  shopTreatBuys = 0;
  boss: Enemy | null = null;
  bossSpawned = false;
  bossKilled = false;
  endless = false;
  banner: { text: string; sub: string; t: number; kind: BannerKind } | null = null;
  /** walkie-talkie heads-ups shown under the minimap */
  toasts: Toast[] = [];
  private toastId = 1;
  private warned = new Set<number>();
  /** M / Tab: big map overlay */
  bigMap = false;
  interact: { label: string; kind: 'weapon' | 'chest' | 'shop' | 'costume' | 'house'; ref: Pickup | PropInst | HouseInst } | null = null;
  nearbyWeapon: Weapon | null = null;
  nearbyCostume: string | null = null;
  // camera (written by renderer)
  camX = 0; camY = 0; zoom = 1; vw = 1; vh = 1; shake = 0; viewR = 11;
  input: Input;
  private eid = 1;
  private grid: Enemy[][] = [];
  private flow = new Int32Array(CW * CH);
  private flowT = 0;
  private flowCell = -1;
  private spawnAcc = 0;
  private nextChest = 18;
  private nextElite = 150;
  private hordes = new Set<number>();
  private familiarT = 0;
  orbitAng = 0;
  familiar = { x: 0, y: 0 };
  soulEarned = 0;
  hitStop = 0;

  constructor(hero: number, save: Save, input: Input) {
    this.hero = hero;
    this.save = save;
    this.input = input;
    this.map = buildMap((Math.random() * 1e9) | 0);
    for (let i = 0; i < MAP_W * MAP_H; i++) this.grid.push([]);
    this.recalcStats();
    const s = this.stats;
    this.p = {
      x: this.map.start.x, y: this.map.start.y, r: 0.24, hp: s.maxHp, shield: s.maxShield, shieldT: 99, invuln: 0, dashT: 0, dashRecharge: 0, dashCharges: s.dashCharges,
      dashX: 0, dashY: 0, back: false, flip: false, anim: 0, moving: false, weapons: [makeWeapon('pea', Math.min(4, s.startRarity)), null], cur: 0,
      aimX: 1, aimY: 0, aiming: false, skillCd: 0, level: 1, xp: 0, xpNext: xpFor(1), coins: s.startCoins, revives: s.revive, recoil: 0, hurtT: 0,
      costume: null, novaCd: 0, stompT: 4, hexT: 1,
    };
    if (s.startCostume > 0) this.wearCostume(COSTUMES[Math.floor(Math.random() * COSTUMES.length)].id, false);
    this.rerolls = s.rerolls;
    // a costume lying in the street to teach the mechanic
    this.dropCostume(this.p.x - 1.4, this.p.y + 1.4, this.randomCostume());
    this.familiar = { x: this.p.x, y: this.p.y };
    // a free weapon near the start to teach pickup
    this.dropWeapon(this.p.x + 1.6, this.p.y - 1.2, makeWeapon(['nerf', 'shotgun', 'roman', 'soaker'][Math.floor(Math.random() * 4)], 1));
    this.setBanner('Trick or Treat... or FIGHT!', 'Survive the night. Boss arrives at 5:00');
    this.computeFlow(true);
  }

  // ---------- stats ----------
  recalcStats() {
    const s = baseStats();
    HERO_INFO[this.hero].apply(s);
    applyTalents(s, this.save.talents);
    if (this.p?.costume) COSTUME_BY_ID[this.p.costume].apply(s);
    for (const id of this.scrollOrder) SCROLL_BY_ID[id].apply(s);
    const prev = this.stats;
    this.stats = s;
    if (this.p) {
      if (s.maxHp > prev.maxHp) this.p.hp += s.maxHp - prev.maxHp;
      this.p.hp = Math.min(this.p.hp, s.maxHp);
      this.p.shield = Math.min(this.p.shield, s.maxShield);
    }
  }

  // ---------- costumes ----------
  randomCostume(exclude: string | null = null) {
    const pool = COSTUMES.filter((c) => c.id !== exclude && c.id !== this.p?.costume);
    return pool[Math.floor(Math.random() * pool.length)].id;
  }
  dropCostume(x: number, y: number, id: string) {
    this.pickups.push({ x, y, z: 0.6, vz: 3, vx: 0, vy: 0, kind: 'costume', value: 0, costume: id, mag: false, t: 0, dead: false });
  }
  wearCostume(id: string, fx = true) {
    const p = this.p;
    const old = p.costume;
    p.costume = id;
    if (!this.costumesWorn.has(id)) {
      this.costumesWorn.add(id);
      this.costumesFound++;
    }
    const before = this.stats.maxHp;
    this.recalcStats();
    if (this.stats.maxHp > before) p.hp = Math.min(this.stats.maxHp, p.hp);
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
  update(dtRaw: number) {
    const inp = this.input;
    if (inp.pressed.has('escape') || inp.pressed.has('p')) {
      if (this.state === 'play') this.state = 'pause';
      else if (this.state === 'pause') this.state = 'play';
    }
    if (this.state !== 'play') {
      inp.endFrame();
      return;
    }
    if (this.hitStop > 0) {
      this.hitStop -= dtRaw;
      inp.endFrame();
      return;
    }
    const dt = Math.min(dtRaw, 1 / 30);
    this.time += dt;
    if (inp.pressed.has('m') || inp.pressed.has('tab')) this.bigMap = !this.bigMap;
    this.updatePlayer(dt);
    this.rebuildGrid();
    this.updateWeapon(dt);
    this.updateSkill(dt);
    this.updateCompanions(dt);
    this.computeFlow(false, dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateEBullets(dt);
    this.updateZones(dt);
    this.updatePickups(dt);
    this.updateFx(dt);
    this.director(dt);
    this.updateTot(dt);
    this.updateInteract();
    if (this.banner) {
      this.banner.t -= dt;
      if (this.banner.t <= 0) this.banner = null;
    }
    if (this.toasts.length) {
      for (const q of this.toasts) q.t -= dt;
      if (this.toasts[0].t <= 0) this.toasts = this.toasts.filter((q) => q.t > 0);
    }
    if (this.pendingLevels > 0 && this.state === 'play') this.openLevelUp('level');
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
      if (cellAt(this.map, nx, ny) < 2 && nx > 0.7 && ny > 0.7 && nx < MAP_W - 0.7 && ny < MAP_H - 0.7) { o.x = nx; o.y = ny; }
      return;
    }
    if (dx && !blocked(o.x + dx, o.y)) o.x += dx;
    if (dy && !blocked(o.x, o.y + dy)) o.y += dy;
  }

  private updatePlayer(dt: number) {
    const p = this.p, inp = this.input, s = this.stats;
    let sx = 0, sy = 0;
    if (inp.keys.has('w') || inp.keys.has('arrowup')) sy -= 1;
    if (inp.keys.has('s') || inp.keys.has('arrowdown')) sy += 1;
    if (inp.keys.has('a') || inp.keys.has('arrowleft')) sx -= 1;
    if (inp.keys.has('d') || inp.keys.has('arrowright')) sx += 1;
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
      if (inp.pressed.has(' ') || inp.pressed.has('shift')) this.cancelTot(true);
      return;
    }
    p.moving = !!(sx || sy);
    let mx = 0, my = 0;
    if (p.moving) {
      const d = screenDirToWorld(sx, sy);
      mx = d.x; my = d.y;
    }
    // dash
    p.dashRecharge += dt;
    if (p.dashCharges < s.dashCharges && p.dashRecharge >= 2.2) {
      p.dashCharges++;
      p.dashRecharge = 0;
    }
    if ((inp.pressed.has(' ') || inp.pressed.has('shift')) && p.dashCharges > 0 && p.dashT <= 0) {
      p.dashCharges--;
      p.dashRecharge = 0;
      p.dashT = 0.2;
      p.invuln = Math.max(p.invuln, 0.3);
      const dx = p.moving ? mx : p.aimX, dy = p.moving ? my : p.aimY;
      p.dashX = dx; p.dashY = dy;
      this.dashHit.clear();
      for (let i = 0; i < 12; i++) this.particle(p.x, p.y, 0.1, rand(-1, 1), rand(-1, 1), rand(0.5, 1.5), 0.4, '#e8f0ff', 3, 'sq');
    }
    let speed = 3.4 * s.move;
    if (p.dashT > 0) {
      p.dashT -= dt;
      mx = p.dashX; my = p.dashY;
      speed = 13;
      if (s.dashFire && Math.random() < 0.6) this.zones.push({ kind: 'fire', x: p.x, y: p.y, r: 0.6, t: 0, life: 2.5, dmg: 12 * s.dmg, tick: 0 });
      this.particle(p.x, p.y, 0.4, 0, 0, 0, 0.25, p.costume === 'hero' ? '#ff4a3a' : '#bcd4ff', 6, 'glow');
      if (p.costume === 'hero') {
        this.query(p.x, p.y, 1.2, (e) => {
          if (this.dashHit.has(e.id) || Math.hypot(e.x - p.x, e.y - p.y) > e.r + 0.6) return;
          this.dashHit.add(e.id);
          const dx = e.x - p.x, dy = e.y - p.y, l = Math.hypot(dx, dy) || 1;
          this.applyHit(e, 35 * s.dmg, Math.random() < s.crit, 0, 0, 0, (dx / l) * 4 + p.dashX * 2, (dy / l) * 4 + p.dashY * 2);
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
    if (inp.pressed.has('q') || inp.wheel !== 0 || inp.pressed.has('1') || inp.pressed.has('2')) {
      let n = p.cur;
      if (inp.pressed.has('1')) n = 0;
      else if (inp.pressed.has('2')) n = 1;
      else n = 1 - p.cur;
      if (p.weapons[n]) p.cur = n;
    }
    if (inp.pressed.has('r')) {
      const w = this.weapon;
      if (w && w.reloadT <= 0 && w.ammo < weaponStats(w, s).mag) w.reloadT = weaponStats(w, s).reload;
    }
  }

  takeDamage(dmg: number, fromX: number, fromY: number) {
    const p = this.p;
    if (p.invuln > 0 || this.state !== 'play') return;
    if (Math.random() < this.stats.dodge) {
      this.text(p.x, p.y, 'DODGE', '#dfe8ff', 14);
      p.invuln = 0.25;
      return;
    }
    if (p.costume === 'pumpkin' && p.novaCd <= 0) {
      p.novaCd = 3;
      this.explode(p.x, p.y, 2.4, 45 * this.stats.dmg, 'fire', true);
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
    p.invuln = 0.45;
    p.hurtT = 0.25;
    this.shake = Math.max(this.shake, 6);
    const dx = p.x - fromX, dy = p.y - fromY, l = Math.hypot(dx, dy) || 1;
    this.moveCircle(p, (dx / l) * 0.15, (dy / l) * 0.15, p.r);
    if (p.hp <= 0) {
      if (p.revives > 0) {
        p.revives--;
        p.hp = this.stats.maxHp * 0.5;
        p.invuln = 2;
        this.setBanner('SECOND WIND!', 'Back on your feet');
        this.explode(p.x, p.y, 3.5, 200, 'fire', true);
      } else {
        p.hp = 0;
        this.endRun(false);
      }
    }
  }

  endRun(victory: boolean) {
    this.state = victory ? 'victory' : 'dead';
    if (!victory || !this.soulEarned) {
      this.soulEarned = Math.floor(this.kills / 8 + this.time / 6 + (this.bossKilled ? 120 : 0));
    }
    if (!victory) {
      this.save.soul += this.soulEarned;
      this.save.best = Math.max(this.save.best, Math.floor(this.time));
      storeSave(this.save);
    }
  }

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

  private updateWeapon(dt: number) {
    const p = this.p, w = this.weapon, s = this.stats;
    if (!w) return;
    const st = weaponStats(w, s);
    w.cd -= dt;
    // aim
    const manual = this.input.mdown;
    let target: Enemy | null = null;
    if (manual) {
      const m = this.mouseWorld();
      const dx = m.x - p.x, dy = m.y - p.y, l = Math.hypot(dx, dy) || 1;
      p.aimX = dx / l; p.aimY = dy / l;
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
      if (w.reloadT <= 0) w.ammo = st.mag;
      return;
    }
    if (this.tot) return; // hands are full of candy bag - can't shoot while trick-or-treating
    if (w.ammo <= 0) {
      w.reloadT = st.reload;
      return;
    }
    if (w.cd <= 0 && (manual || target)) {
      w.cd = 1 / st.rate;
      w.ammo--;
      this.fire(w, st);
      if (w.ammo <= 0) w.reloadT = st.reload;
    }
  }

  private fire(w: Weapon, st: ReturnType<typeof weaponStats>) {
    const p = this.p, d = w.def;
    const base = Math.atan2(p.aimY, p.aimX);
    const n = st.pellets;
    p.recoil = 1;
    this.shake = Math.max(this.shake, d.shake);
    const mx = p.x + p.aimX * 0.45, my = p.y + p.aimY * 0.45;
    // muzzle flash
    this.particle(mx, my, 0.45, 0, 0, 0, 0.08, d.color, 22, 'glow');
    if (d.kind === 'beam') {
      for (let i = 0; i < n; i++) {
        const a = base + (n > 1 ? (i - (n - 1) / 2) * 0.12 : 0);
        this.hitscan(mx, my, Math.cos(a), Math.sin(a), st, d.color);
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      let a = base;
      if (d.pellets > 1 || n > 1) {
        const spreadTot = d.pellets > 1 ? d.spread : 0.12 * (n - 1);
        a += n > 1 ? (i / (n - 1) - 0.5) * spreadTot : 0;
        a += rand(-0.04, 0.04);
      } else a += rand(-d.spread, d.spread) * 0.5;
      const sp = d.speed * rand(0.92, 1.08);
      const crit = Math.random() < st.crit;
      this.bullets.push({
        x: mx, y: my, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, dmg: st.dmg * (crit ? this.stats.critDmg : 1), r: d.kind === 'rocket' || d.kind === 'balloon' ? 0.2 : 0.12,
        life: st.range / sp + 0.05, pierce: st.pierce, bounce: st.bounce, kind: d.kind, color: d.color, crit: crit ? 1 : 0, fire: st.fire, shock: st.shock, ecto: st.ecto,
        explode: d.explode * this.stats.skillPow ** 0.3, hit: [], vamp: st.vamp, dead: false, spin: rand(0, 6),
      });
    }
  }

  private hitscan(x: number, y: number, dx: number, dy: number, st: ReturnType<typeof weaponStats>, color: string) {
    let len = st.range;
    // walls
    for (let t = 0; t < st.range; t += 1 / CR) {
      if (cellAt(this.map, x + dx * t, y + dy * t) === 2) { len = t; break; }
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
      const crit = Math.random() < st.crit;
      this.applyHit(e, st.dmg * (crit ? this.stats.critDmg : 1), crit, st.fire, st.shock, st.ecto, dx, dy, st.vamp);
    }
    this.beams.push({ x0: x, y0: y, x1: x + dx * len, y1: y + dy * len, color, life: 0.12, max: 0.12, zig: false, w: 5 });
  }

  /** core hit routine for all player damage sources */
  applyHit(e: Enemy, dmg: number, crit: boolean, fire: number, shock: number, ecto: number, kx: number, ky: number, vamp = false, quiet = false) {
    if (e.dead) return;
    const s = this.stats;
    if (Math.random() < ecto) {
      if (e.ectoT <= 0) this.text(e.x, e.y, 'ECTO', ELEM.ecto.color, 11);
      e.ectoT = 4;
    }
    if (e.ectoT > 0) dmg *= 1 + s.ectoAmp;
    this.damageEnemy(e, dmg, crit ? '#ffe14a' : '#ffffff', crit, quiet);
    if (crit && vamp) this.p.hp = Math.min(s.maxHp, this.p.hp + 1);
    if (crit && this.p.costume === 'skeleton') {
      for (let i = 0; i < 2; i++) {
        const a = rand(0, Math.PI * 2);
        this.bullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 11, vy: Math.sin(a) * 11, dmg: dmg * 0.4, r: 0.12, life: 0.6, pierce: 1, bounce: 0, kind: 'bone', color: '#eee8d8', crit: 0, fire: 0, shock: 0, ecto: 0, explode: 0, hit: [e.id], vamp: false, dead: false, spin: 0 });
      }
    }
    const kb = (crit ? 0.6 : 0.35) / e.def.mass;
    e.kx += kx * kb * 6;
    e.ky += ky * kb * 6;
    if (Math.random() < fire) {
      if (e.burnT <= 0) this.text(e.x, e.y, 'BURN', ELEM.fire.color, 11);
      e.burnT = 3;
      e.burnDps = Math.max(e.burnDps, dmg * 0.45 * s.burnDmg);
    }
    if (Math.random() < shock) this.chain(e, dmg * 0.55);
  }

  damageEnemy(e: Enemy, dmg: number, color: string, big = false, quiet = false) {
    if (e.dead) return;
    e.hp -= dmg;
    e.hit = 0.1;
    if (!quiet) this.text(e.x + rand(-0.2, 0.2), e.y + rand(-0.2, 0.2), Math.round(dmg).toString(), color, big ? 20 : 13, 'dmg');
    if (e.hp <= 0) this.killEnemy(e);
  }

  private chain(src: Enemy, dmg: number) {
    const hit = new Set<number>([src.id]);
    let cur = src;
    for (let i = 0; i < this.stats.chain; i++) {
      let best: Enemy | null = null, bd = 3.5 * 3.5;
      this.query(cur.x, cur.y, 3.5, (e) => {
        if (hit.has(e.id) || e.dead) return;
        const d = (e.x - cur.x) ** 2 + (e.y - cur.y) ** 2;
        if (d < bd) { bd = d; best = e; }
      });
      if (!best) break;
      const b = best as Enemy;
      hit.add(b.id);
      this.beams.push({ x0: cur.x, y0: cur.y, x1: b.x, y1: b.y, color: ELEM.shock.color, life: 0.18, max: 0.18, zig: true, w: 2.5 });
      this.damageEnemy(b, dmg, ELEM.shock.color);
      b.stunT = Math.max(b.stunT, 0.25);
      cur = b;
    }
  }

  explode(x: number, y: number, r: number, dmg: number, elem: Elem | null, fromPlayer = true, crit = false) {
    this.zones.push({ kind: 'boom', x, y, r, t: 0, life: 0.45, dmg: 0, tick: 0, color: elem ? ELEM[elem].color : '#ffb347' });
    this.shake = Math.max(this.shake, 4 + r * 2);
    for (let i = 0; i < 22; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(1, 4) * r;
      this.particle(x, y, 0.2, Math.cos(a) * sp, Math.sin(a) * sp, rand(1, 4), rand(0.3, 0.7), i % 3 ? '#ffb347' : '#ff5a1a', rand(3, 6), i % 2 ? 'glow' : 'sq');
    }
    if (fromPlayer) {
      this.query(x, y, r + 1, (e) => {
        const d = Math.hypot(e.x - x, e.y - y);
        if (d < r + e.r) {
          const f = 1 - 0.4 * (d / r);
          const dx = (e.x - x) / (d || 1), dy = (e.y - y) / (d || 1);
          this.applyHit(e, dmg * f, crit, elem === 'fire' ? 0.5 : 0, elem === 'shock' ? 0.6 : 0, elem === 'ecto' ? 0.6 : 0, dx * 2, dy * 2);
        }
      });
    }
    this.decals.push({ x, y, r: r * 0.6, color: 'rgba(20,10,5,0.5)', life: 20, rot: rand(0, 6) });
  }

  // ---------- skills ----------
  private updateSkill(dt: number) {
    const p = this.p, s = this.stats, info = HERO_INFO[this.hero];
    p.skillCd -= dt;
    if (this.tot || !(this.input.rpressed || this.input.pressed.has('f')) || p.skillCd > 0) return;
    p.skillCd = info.cd * s.skillCd;
    const m = this.mouseWorld();
    let dx = m.x - p.x, dy = m.y - p.y;
    let l = Math.hypot(dx, dy) || 1;
    if (!this.input.mouseActive) { dx = p.aimX; dy = p.aimY; l = 1; }
    const range = Math.min(l, 7);
    const tx = p.x + (dx / l) * range, ty = p.y + (dy / l) * range;
    if (this.hero === 0) {
      this.lobs.push({ x0: p.x, y0: p.y, x1: tx, y1: ty, t: 0, dur: 0.55 });
    } else if (this.hero === 1) {
      this.zones.push({ kind: 'tornado', x: tx, y: ty, r: 1.8 * s.skillPow, t: 0, life: 4.5, dmg: 9 * s.dmg * s.skillPow, tick: 0 });
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
          this.applyHit(e, 65 * s.dmg * s.skillPow, false, 0, 0, 0, ex / (d || 1) * 3, ey / (d || 1) * 3);
        }
      }
    }
  }

  private updateCompanions(dt: number) {
    const p = this.p, s = this.stats;
    // ---- costume powers ----
    p.novaCd -= dt;
    if (p.costume === 'witch') {
      p.hexT -= dt;
      if (p.hexT <= 0) {
        const t = this.findTarget(8);
        if (t) {
          p.hexT = 1.2;
          const a = Math.atan2(t.y - p.y, t.x - p.x) + rand(-0.8, 0.8);
          this.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 7, vy: Math.sin(a) * 7, dmg: 26 * s.dmg * s.skillPow, r: 0.16, life: 2.2, pierce: 0, bounce: 0, kind: 'hex', color: '#c46bff', crit: Math.random() < s.crit ? 1 : 0, fire: 0, shock: 0, ecto: 0.25, explode: 0, hit: [], vamp: false, dead: false, spin: 0, home: true });
          this.particle(p.x, p.y, 1.6, 0, 0, 0, 0.2, '#c46bff', 14, 'glow');
        }
      }
    }
    if (p.costume === 'dino') {
      p.stompT -= dt;
      if (p.stompT <= 0) {
        let near = false;
        this.query(p.x, p.y, 2.6, (e) => { if (Math.hypot(e.x - p.x, e.y - p.y) < 2.6) near = true; });
        if (near) {
          p.stompT = 4;
          this.zones.push({ kind: 'boom', x: p.x, y: p.y, r: 2.6, t: 0, life: 0.45, dmg: 0, tick: 0, color: '#8dff5a' });
          this.shake = Math.max(this.shake, 7);
          this.text(p.x, p.y, 'STOMP!', '#8dff5a', 16);
          this.query(p.x, p.y, 3, (e) => {
            const d = Math.hypot(e.x - p.x, e.y - p.y);
            if (d < 2.6 + e.r) {
              e.stunT = Math.max(e.stunT, 1.2);
              this.applyHit(e, 40 * s.dmg, false, 0, 0, 0, ((e.x - p.x) / (d || 1)) * 3, ((e.y - p.y) / (d || 1)) * 3);
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
            this.applyHit(e, 14 * s.dmg, Math.random() < s.crit, 0, 0, 0, Math.cos(a + 1.57), Math.sin(a + 1.57));
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
          this.bullets.push({ x: this.familiar.x, y: this.familiar.y, vx: (dx / l) * 10, vy: (dy / l) * 10, dmg: 16 * s.dmg, r: 0.14, life: 1, pierce: 1, bounce: 0, kind: 'water', color: '#cfe0ff', crit: 0, fire: 0, shock: 0.15, ecto: 0.15, explode: 0, hit: [], vamp: false, dead: false, spin: 0 });
        }
      }
    }
  }

  // ---------- spatial grid ----------
  private rebuildGrid() {
    for (const g of this.grid) g.length = 0;
    for (const e of this.enemies) {
      const gx = clamp(Math.floor(e.x), 0, MAP_W - 1), gy = clamp(Math.floor(e.y), 0, MAP_H - 1);
      this.grid[gy * MAP_W + gx].push(e);
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
    const f = this.flow, coll = this.map.coll;
    f.fill(1 << 30);
    const q = new Int32Array(CW * CH);
    let h = 0, t = 0;
    f[pc] = 0;
    q[t++] = pc;
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
        if (dx && dy && (this.map.coll[c + dx] || this.map.coll[c + dy * CW])) continue;
        const v = this.flow[n] + (dx && dy ? 0.4 : 0);
        if (v < best) { best = v; bx = dx; by = dy; }
      }
    if (!bx && !by) return null;
    const tx = (cx + bx + 0.5) / CR, ty = (cy + by + 0.5) / CR;
    const l = Math.hypot(tx - x, ty - y) || 1;
    return { x: (tx - x) / l, y: (ty - y) / l };
  }
  reachable(x: number, y: number) {
    const c = Math.floor(y * CR) * CW + Math.floor(x * CR);
    return this.flow[c] < 1 << 29;
  }

  // ---------- enemies ----------
  spawnEnemy(type: string, x: number, y: number, elite = false) {
    const def = EDEF[type];
    const scale = 1 + this.time / 60 * 0.38 + (this.endless ? 1.5 : 0);
    const hp = def.hp * (def.boss ? 1 : scale) * (elite ? 3 : 1);
    const e: Enemy = {
      id: this.eid++, type, def, x, y, hp, maxHp: hp, r: def.r * (elite ? 1.25 : 1), anim: rand(0, 6), flip: false, hit: 0, burnT: 0, burnDps: 0, burnAcc: 0, ectoT: 0, stunT: 0,
      atkCd: 0, kx: 0, ky: 0, shootT: rand(1, 2.5), lungeT: 0, lungeX: 0, lungeY: 0, p1: 3, p2: 6, p3: 9, orbitT: 0, dead: false, elite: elite || !!def.elite, spawnT: 0.4,
    };
    this.enemies.push(e);
    for (let i = 0; i < 6; i++) this.particle(x, y, 0, rand(-1, 1), rand(-1, 1), rand(1, 2), 0.5, '#2a1a12', 4, 'sq');
    return e;
  }

  private killEnemy(e: Enemy) {
    if (e.dead) return;
    e.dead = true;
    this.kills++;
    const s = this.stats;
    // drops
    const xp = e.def.xp * (e.elite && !e.def.elite ? 3 : 1);
    if (xp >= 20) for (let i = 0; i < Math.min(15, xp / 5); i++) this.dropPickup(e.x, e.y, 'xp3', 5);
    else this.dropPickup(e.x, e.y, xp >= 4 ? 'xp3' : xp >= 2 ? 'xp2' : 'xp1', xp);
    if (Math.random() < e.def.coin) this.dropPickup(e.x, e.y, 'coin', Math.ceil(rand(1, 3) * (e.elite ? 5 : 1)));
    if (Math.random() < s.healDrop) this.dropPickup(e.x, e.y, 'heal', 25);
    if (e.elite && !e.def.boss) this.dropPickup(e.x, e.y, 'chest', 0);
    if (Math.random() < s.vamp) { this.p.hp = Math.min(s.maxHp, this.p.hp + 2); }
    if (this.p.costume === 'vampire' && this.p.hp < s.maxHp) {
      this.p.hp = Math.min(s.maxHp, this.p.hp + 1);
      if (Math.random() < 0.3) this.particle(e.x, e.y, 0.5, (this.p.x - e.x) * 2, (this.p.y - e.y) * 2, 0.5, 0.5, '#e0304a', 6, 'glow');
    }
    if (e.elite && !e.def.boss && Math.random() < 0.35) this.dropCostume(e.x, e.y, this.randomCostume());
    // fx
    const n = e.def.boss ? 60 : 10;
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2), sp = rand(1, 3.5);
      this.particle(e.x, e.y, 0.4, Math.cos(a) * sp, Math.sin(a) * sp, rand(1.5, 4), rand(0.4, 0.9), e.def.color, rand(3, 6), 'sq');
    }
    this.decals.push({ x: e.x, y: e.y, r: e.r * 1.4, color: e.type === 'ghost' ? 'rgba(160,200,255,0.3)' : e.type === 'pumpkin' || e.type === 'king' ? 'rgba(200,90,20,0.45)' : 'rgba(60,110,40,0.45)', life: 25, rot: rand(0, 6) });
    if (e.def.bomber) this.explode(e.x, e.y, 1.5, 40 * s.dmg, 'fire', true);
    if (e.def.boss) {
      this.boss = null;
      this.bossKilled = true;
      this.hitStop = 0.25;
      for (let i = 0; i < 3; i++) this.dropPickup(e.x + rand(-1, 1), e.y + rand(-1, 1), 'chest', 0);
      for (let i = 0; i < 30; i++) this.dropPickup(e.x, e.y, 'coin', 3);
      this.setBanner('THE PUMPKIN KING IS SMASHED!', 'You saved Halloween... for now', 'win');
      setTimeout(() => {
        if (this.state === 'play' && !this.endless) {
          this.soulEarned = Math.floor(this.kills / 8 + this.time / 6 + 120);
          this.save.soul += this.soulEarned;
          this.save.best = Math.max(this.save.best, Math.floor(this.time));
          storeSave(this.save);
          this.state = 'victory';
        }
      }, 3500);
    }
  }

  private updateEnemies(dt: number) {
    const p = this.p;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const d = e.def;
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
          this.damageEnemy(e, e.burnDps * 0.5, ELEM.fire.color);
          this.particle(e.x, e.y, 0.5, rand(-0.3, 0.3), rand(-0.3, 0.3), 1.5, 0.5, '#ff7a1a', 5, 'glow');
          if (e.dead) continue;
        }
      } else e.burnDps = 0;
      const dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 0.001;
      let mx = 0, my = 0;
      let speed = d.speed * (e.ectoT > 0 ? 0.6 : 1) * (e.elite && !d.elite ? 1.1 : 1);
      if (e.stunT > 0) {
        e.stunT -= dt;
        speed = 0;
      } else if (e.spawnT > 0) speed = 0;
      else if (d.fly || d.phase || d.boss) {
        mx = dx / dist; my = dy / dist;
      } else if (dist < 3 && lineOfSight(this.map, e.x, e.y, p.x, p.y)) {
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
      if (d.ranged && speed > 0) {
        e.shootT -= dt;
        if (dist < 5.5 && lineOfSight(this.map, e.x, e.y, p.x, p.y)) {
          mx = -dx / dist * 0.4 + (-dy / dist) * 0.6; my = -dy / dist * 0.4 + (dx / dist) * 0.6;
          if (e.shootT <= 0) {
            e.shootT = 2.4;
            for (let k = -1; k <= 1; k++) {
              const a = Math.atan2(dy, dx) + k * 0.25;
              this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 4.2, vy: Math.sin(a) * 4.2, r: 0.18, dmg: 9, life: 3, color: '#b2ff6a', kind: 'orb', dead: false });
            }
          }
        }
      }
      if (d.bomber && dist < 0.85 && e.spawnT <= 0) {
        e.hp = 0;
        this.zones.push({ kind: 'boom', x: e.x, y: e.y, r: 1.5, t: 0, life: 0.45, dmg: 0, tick: 0, color: '#ff7a1a' });
        if (dist < 1.5) this.takeDamage(d.dmg, e.x, e.y);
        this.killEnemy(e);
        continue;
      }
      if (d.elite && !d.boss) {
        e.lungeT -= dt;
        if (e.lungeT < -3.5 && dist < 5 && dist > 1.2) {
          e.lungeT = 0.4;
          e.lungeX = dx / dist; e.lungeY = dy / dist;
          this.zones.push({ kind: 'warn', x: e.x + e.lungeX * 1.6, y: e.y + e.lungeY * 1.6, r: 0.8, t: 0, life: 0.35, dmg: 0, tick: 0 });
        }
        if (e.lungeT > 0) { mx = e.lungeX; my = e.lungeY; speed = 8.5; }
      }
      if (d.boss) this.bossAI(e, dt, dx, dy, dist);
      // movement
      e.kx *= Math.pow(0.002, dt); e.ky *= Math.pow(0.002, dt);
      const vx = mx * speed + e.kx, vy = my * speed + e.ky;
      if (d.fly || d.phase || d.boss) {
        e.x = clamp(e.x + vx * dt, 0.7, MAP_W - 0.7);
        e.y = clamp(e.y + vy * dt, 0.7, MAP_H - 0.7);
      } else this.moveCircle(e, vx * dt, vy * dt, e.r * 0.85);
      if (Math.abs(isoX(vx, vy)) > 0.05) e.flip = isoX(vx, vy) < 0;
      // contact
      if (dist < e.r + p.r + 0.05 && e.atkCd <= 0 && e.spawnT <= 0 && e.stunT <= 0) {
        e.atkCd = 0.8;
        this.takeDamage(d.dmg * (e.elite && !d.elite ? 1.5 : 1) * (1 + this.time / 600), e.x, e.y);
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
    const rage = e.hp < e.maxHp * 0.5;
    e.p1 -= dt; e.p2 -= dt; e.p3 -= dt;
    if (e.p1 <= 0) {
      e.p1 = rage ? 2.2 : 3.2;
      const n = rage ? 22 : 16, off = rand(0, 1);
      for (let i = 0; i < n; i++) {
        const a = ((i + off) / n) * Math.PI * 2;
        this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 3.6, vy: Math.sin(a) * 3.6, r: 0.2, dmg: 12, life: 5, color: '#ffcf3a', kind: 'seed', dead: false });
      }
      this.shake = 5;
    }
    if (e.p2 <= 0) {
      e.p2 = rage ? 6 : 8;
      for (let i = 0; i < (rage ? 6 : 4); i++) {
        const a = rand(0, Math.PI * 2);
        this.spawnEnemy('pumpkin', e.x + Math.cos(a) * 1.6, e.y + Math.sin(a) * 1.6);
      }
    }
    if (e.p3 <= 0) {
      e.p3 = rage ? 5 : 7;
      // aimed seed spray
      const base = Math.atan2(dy, dx);
      for (let i = 0; i < 9; i++) {
        const a = base + (i - 4) * 0.14;
        this.ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 6, vy: Math.sin(a) * 6, r: 0.16, dmg: 10, life: 3, color: '#ff8a1e', kind: 'seed', dead: false });
      }
    }
    void dist;
  }

  // ---------- bullets ----------
  private updateBullets(dt: number) {
    for (const b of this.bullets) {
      if (b.dead) continue;
      const px = b.x, py = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
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
          const k = Math.min(1, dt * 7);
          b.vx += ((dx / l) * sp - b.vx) * k;
          b.vy += ((dy / l) * sp - b.vy) * k;
          const nl = Math.hypot(b.vx, b.vy) || 1;
          b.vx = (b.vx / nl) * sp; b.vy = (b.vy / nl) * sp;
        }
        if (Math.random() < 0.5) this.particle(b.x, b.y, 0.5, 0, 0, 0.3, 0.3, '#c46bff', 5, 'glow');
      }
      if (b.kind === 'water' || b.kind === 'fire') if (Math.random() < 0.3) this.particle(b.x, b.y, 0.4, 0, 0, -0.5, 0.25, b.color, 4, 'glow');
      if (b.kind === 'rocket') this.particle(px, py, 0.45, rand(-0.3, 0.3), rand(-0.3, 0.3), 0.5, 0.4, '#bbb', 5, 'sq');
      if (cellAt(this.map, b.x, b.y) === 2) {
        if (b.bounce > 0) {
          b.bounce--;
          if (cellAt(this.map, px, b.y) !== 2) b.vx = -b.vx;
          else if (cellAt(this.map, b.x, py) !== 2) b.vy = -b.vy;
          else { b.vx = -b.vx; b.vy = -b.vy; }
          b.x = px; b.y = py;
        } else {
          this.bulletDie(b);
          continue;
        }
      }
      if (b.life <= 0) {
        this.bulletDie(b);
        continue;
      }
      this.query(b.x, b.y, 1.2, (e) => {
        if (b.dead || e.spawnT > 0 || b.hit.includes(e.id)) return;
        const rr = e.r + b.r;
        if ((e.x - b.x) ** 2 + (e.y - b.y) ** 2 > rr * rr) return;
        b.hit.push(e.id);
        const l = Math.hypot(b.vx, b.vy) || 1;
        if (b.explode > 0) {
          this.explode(b.x, b.y, b.explode, b.dmg, b.shock > 0.5 ? 'shock' : b.fire > 0 ? 'fire' : null, true, !!b.crit);
          if (b.shock > 0 && Math.random() < b.shock) this.chain(e, b.dmg * 0.5);
          b.dead = true;
          return;
        }
        this.applyHit(e, b.dmg, !!b.crit, b.fire, b.shock, b.ecto, b.vx / l, b.vy / l, b.vamp);
        for (let i = 0; i < 3; i++) this.particle(b.x, b.y, 0.4, rand(-2, 2), rand(-2, 2), rand(0.5, 2), 0.25, b.color, 3, 'sq');
        if (b.pierce > 0) b.pierce--;
        else if (b.bounce > 0) {
          b.bounce--;
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
        } else b.dead = true;
      });
    }
    this.bullets = this.bullets.filter((b) => !b.dead);
  }

  private bulletDie(b: Bullet) {
    b.dead = true;
    if (b.explode > 0) this.explode(b.x, b.y, b.explode, b.dmg, b.shock > 0.5 ? 'shock' : b.fire > 0 ? 'fire' : null, true, !!b.crit);
    else for (let i = 0; i < 3; i++) this.particle(b.x, b.y, 0.4, rand(-1, 1), rand(-1, 1), rand(0.5, 1.5), 0.2, b.color, 2, 'sq');
  }

  private updateEBullets(dt: number) {
    const p = this.p;
    for (const b of this.ebullets) {
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
        this.explode(l.x1, l.y1, 2.2 * Math.sqrt(s.skillPow), 85 * s.dmg * s.skillPow, 'fire', true);
        this.zones.push({ kind: 'fire', x: l.x1, y: l.y1, r: 1.6 * Math.sqrt(s.skillPow), t: 0, life: 3.5, dmg: 14 * s.dmg, tick: 0 });
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
            if (Math.hypot(e.x - z.x, e.y - z.y) < z.r + e.r) this.applyHit(e, z.dmg, false, 0.35, 0, 0, 0, 0, false, true);
          });
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

  // ---------- pickups ----------
  dropPickup(x: number, y: number, kind: Pickup['kind'], value: number) {
    const a = rand(0, Math.PI * 2), sp = rand(0.5, 2);
    this.pickups.push({ x, y, z: 0.2, vz: rand(2, 4), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, kind, value, mag: false, t: 0, dead: false });
  }
  dropWeapon(x: number, y: number, w: Weapon) {
    this.pickups.push({ x, y, z: 0.5, vz: 3, vx: 0, vy: 0, kind: 'weapon', value: 0, weapon: w, mag: false, t: 0, dead: false });
  }

  private updatePickups(dt: number) {
    const p = this.p, s = this.stats;
    const magR = 1.7 * s.magnet;
    for (const k of this.pickups) {
      k.t += dt;
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
      if (d < magR || k.mag) {
        k.mag = true;
        const sp = 9 + k.t;
        k.x += (dx / (d || 1)) * sp * dt;
        k.y += (dy / (d || 1)) * sp * dt;
      }
      if (d < 0.35) {
        k.dead = true;
        if (k.kind === 'coin') {
          const v = Math.ceil(k.value * s.coinGain);
          p.coins += v;
          this.text(p.x, p.y, `+${v}¢`, '#ffd23a', 11);
        } else if (k.kind === 'heal') {
          const v = s.maxHp * 0.2;
          p.hp = Math.min(s.maxHp, p.hp + v);
          this.text(p.x, p.y, `+${Math.round(v)} HP`, '#7dff5a', 14);
        } else {
          p.xp += k.value * s.xpGain;
          while (p.xp >= p.xpNext) {
            p.xp -= p.xpNext;
            p.level++;
            p.xpNext = xpFor(p.level);
            this.pendingLevels++;
          }
        }
      }
    }
    if (this.pickups.length > 500) {
      // vacuum the oldest xp
      let n = this.pickups.length - 450;
      for (const k of this.pickups) if (n > 0 && k.kind.startsWith('xp')) { k.mag = true; n--; }
    }
    this.pickups = this.pickups.filter((k) => !k.dead);
  }

  private updateInteract() {
    const p = this.p;
    this.nearbyWeapon = null;
    this.nearbyCostume = null;
    if (this.tot) { this.interact = null; return; }
    let best: Game['interact'] = null, bd = 1.5 * 1.5;
    for (const k of this.pickups) {
      if (k.kind !== 'weapon' && k.kind !== 'chest' && k.kind !== 'costume') continue;
      const d = (k.x - p.x) ** 2 + (k.y - p.y) ** 2;
      if (d < bd) {
        bd = d;
        best = k.kind === 'weapon' ? { kind: 'weapon', label: `Pick up ${k.weapon!.def.name}`, ref: k }
          : k.kind === 'costume' ? { kind: 'costume', label: `Put on ${COSTUME_BY_ID[k.costume!].name} costume`, ref: k }
          : { kind: 'chest', label: 'Open Treat Bag', ref: k };
      }
    }
    for (const sh of this.map.shops) {
      const d = (sh.x - p.x) ** 2 + (sh.y - p.y) ** 2;
      if (d < bd * 1.4) { bd = d; best = { kind: 'shop', label: "Shop: Candy Lady's Treats", ref: sh.prop }; }
    }
    for (const h of this.map.houses) {
      if (h.visited) continue;
      const d = (h.door.x - p.x) ** 2 + (h.door.y - p.y) ** 2;
      if (d < Math.min(bd, 1.1 * 1.1)) {
        bd = d;
        best = { kind: 'house', label: `Trick or Treat at ${h.owner}'s (you'll be stuck for ${(3.4 * this.stats.totSpeed).toFixed(1)}s!)`, ref: h };
      }
    }
    this.interact = best;
    if (best && best.kind === 'weapon') this.nearbyWeapon = (best.ref as Pickup).weapon!;
    if (best && best.kind === 'costume') this.nearbyCostume = (best.ref as Pickup).costume!;
    if (best && this.input.pressed.has('e')) {
      if (best.kind === 'house') {
        this.startTot(best.ref as HouseInst);
      } else if (best.kind === 'costume') {
        const k = best.ref as Pickup;
        k.dead = true;
        const old = this.wearCostume(k.costume!);
        if (old) this.dropCostume(p.x, p.y, old);
        this.pickups = this.pickups.filter((x) => !x.dead);
      } else if (best.kind === 'weapon') {
        const k = best.ref as Pickup;
        k.dead = true;
        const empty = p.weapons.findIndex((w) => !w);
        if (empty >= 0) { p.weapons[empty] = k.weapon!; p.cur = empty; }
        else {
          const old = p.weapons[p.cur]!;
          old.reloadT = 0;
          this.dropWeapon(p.x, p.y, old);
          p.weapons[p.cur] = k.weapon!;
        }
        this.text(p.x, p.y, k.weapon!.def.name, '#fff', 14);
        if (k.weapon!.rarity >= 2) this.setBanner('NEW WEAPON!', `${k.weapon!.def.name} · ${['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary'][k.weapon!.rarity]}`, 'loot');
        this.pickups = this.pickups.filter((x) => !x.dead);
      } else if (best.kind === 'chest') {
        const k = best.ref as Pickup;
        k.dead = true;
        const r = rollRarity(this.stats.luck + 1, 1);
        this.dropWeapon(k.x, k.y, makeWeapon(null, r));
        for (let i = 0; i < 8; i++) this.dropPickup(k.x, k.y, 'coin', 2);
        for (let i = 0; i < 6; i++) this.dropPickup(k.x, k.y, 'xp2', 2);
        if (Math.random() < 0.2) this.dropCostume(k.x + 0.5, k.y, this.randomCostume());
        for (let i = 0; i < 20; i++) this.particle(k.x, k.y, 0.3, rand(-2, 2), rand(-2, 2), rand(2, 5), 0.8, ['#ff4d6d', '#ffd23a', '#7dff5a', '#b44dff'][i % 4], 4, 'sq');
        this.pickups = this.pickups.filter((x) => !x.dead);
      } else {
        this.state = 'shop';
      }
    }
  }

  // ---------- level up / shop ----------
  // ---------- trick or treat ----------
  private startTot(h: HouseInst) {
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
    const n = 5 + Math.floor(this.time / 25);
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
    let made = 0;
    for (let i = 0; i < n * 4 && made < n; i++) {
      const a = rand(0, Math.PI * 2), d = rand(r0, r1);
      const ex = x + Math.cos(a) * d, ey = y + Math.sin(a) * d;
      const type = types[Math.floor(Math.random() * types.length)];
      const fly = type === 'bat' || type === 'ghost';
      if (ex < 1 || ey < 1 || ex > MAP_W - 1 || ey > MAP_H - 1) continue;
      if (!fly && (cellAt(this.map, ex, ey) !== 0 || !this.reachable(ex, ey))) continue;
      this.spawnEnemy(type, ex, ey);
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
    h.visited = true;
    this.housesVisited++;
    if (h.light) h.light.i = 0.12;
    const dx = h.door.x, dy = h.door.y;
    if (h.trick) {
      this.shake = 10;
      this.explode(dx, dy, 1.2, 0, null, false);
      this.spawnAround(dx, dy, 6, 1, 2.5, ['pumpkin']);
      this.spawnAround(dx, dy, 6, 0.5, 2, ['bat']);
      for (let i = 0; i < 6; i++) this.dropPickup(dx, dy, 'coin', 2);
        this.setBanner("IT'S A TRICK!", `${h.owner} was a monster all along!`, 'danger');
      this.bubble(this.p.x, this.p.y, 115, 'NOT COOL!', 'kid', 1.5, true);
      return;
    }
    const costumed = !!this.p.costume;
    // candy fountain from the door
    for (let i = 0; i < (costumed ? 10 : 5); i++) this.dropPickup(dx, dy, 'coin', 2);
    for (let i = 0; i < (costumed ? 8 : 4); i++) this.dropPickup(dx, dy, 'xp2', 2);
    if (Math.random() < 0.25) this.dropPickup(dx, dy, 'heal', 25);
    if (Math.random() < (costumed ? 0.3 : 0.15)) this.dropWeapon(dx + 0.4, dy + 0.4, makeWeapon(null, rollRarity(this.stats.luck + 2, 1)));
    if (Math.random() < (costumed ? 0.2 : 0.65)) this.dropCostume(dx - 0.4, dy + 0.5, this.randomCostume());
    for (let i = 0; i < 24; i++) this.particle(dx, dy, 0.6, rand(-2, 2), rand(-2, 2), rand(2, 5), 0.9, ['#ff4d6d', '#ffd23a', '#7dff5a', '#b44dff'][i % 4], 4, 'sq');
    this.bubble(this.p.x, this.p.y, 115, costumed ? 'Thank you!!' : 'Aww… thanks.', 'kid', 1.4, true);
    this.choiceGiver = h.owner;
    const n = (costumed ? 3 : 2) + this.stats.totChoices;
    this.openLevelUp('house', n, this.stats.luck + (costumed ? 3 : 0));
  }

  private choiceN = 3;
  private choiceLuck = 0;
  openLevelUp(mode: ChoiceMode, n = 3, luck = this.stats.luck) {
    this.choiceMode = mode;
    this.choiceN = n;
    this.choiceLuck = luck;
    this.choices = rollScrolls(n, this.scrolls, luck);
    this.state = 'levelup';
  }
  reroll() {
    if (this.rerolls <= 0) return;
    this.rerolls--;
    this.choices = rollScrolls(this.choiceN, this.scrolls, this.choiceLuck);
  }
  choose(id: string) {
    this.input.pressed.clear(); // the key that picked the card must not also swap weapons
    this.scrolls[id] = (this.scrolls[id] || 0) + 1;
    this.scrollOrder.push(id);
    this.recalcStats();
    if (this.choiceMode === 'shop') {
      this.choiceMode = 'level';
      this.state = 'shop';
      return;
    }
    if (this.choiceMode === 'house') {
      this.choiceMode = 'level';
      this.state = 'play';
      this.p.invuln = 1;
      return;
    }
    this.pendingLevels--;
    if (this.pendingLevels > 0) this.choices = rollScrolls(3, this.scrolls, this.stats.luck);
    else {
      this.state = 'play';
      this.p.invuln = 1;
    }
  }
  shopUpgrade(slot: number) {
    const w = this.p.weapons[slot];
    if (!w) return;
    const c = upgradeCost(w);
    if (this.p.coins < c) return;
    this.p.coins -= c;
    w.level++;
  }
  healCost() { return 30 + this.shopHealBuys * 15; }
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
    this.state = 'play';
    this.p.invuln = 0.8;
  }
  continueEndless() {
    this.endless = true;
    this.state = 'play';
    this.setBanner('ENDLESS NIGHT', 'Monsters grow stronger...');
  }

  // ---------- director ----------
  private spawnPos(fly: boolean) {
    const p = this.p;
    for (let i = 0; i < 14; i++) {
      const a = rand(0, Math.PI * 2), d = this.viewR + rand(0.5, 3);
      const x = p.x + Math.cos(a) * d, y = p.y + Math.sin(a) * d;
      if (x < 1 || y < 1 || x > MAP_W - 1 || y > MAP_H - 1) continue;
      if (cellAt(this.map, x, y) !== 0) continue;
      if (!fly && (cellAt(this.map, x - 0.3, y - 0.3) || cellAt(this.map, x + 0.3, y + 0.3) || cellAt(this.map, x - 0.3, y + 0.3) || cellAt(this.map, x + 0.3, y - 0.3))) continue;
      if (!fly && !this.reachable(x, y)) continue;
      return { x, y };
    }
    return null;
  }

  private director(dt: number) {
    const t = this.time;
    const cap = 280;
    const alive = this.enemies.length;
    if (!this.boss || this.endless) {
      const rate = 0.9 + t / 22 + (this.endless ? 4 : 0);
      this.spawnAcc += dt * rate;
    } else this.spawnAcc += dt * 1.2;
    while (this.spawnAcc >= 1) {
      this.spawnAcc--;
      if (alive >= cap) break;
      const w: [string, number][] = [['zombie', 10]];
      if (t > 35) w.push(['bat', 6]);
      if (t > 70) w.push(['skeleton', 7]);
      if (t > 100) w.push(['ghost', 4]);
      if (t > 130) w.push(['pumpkin', 4]);
      if (t > 160) w.push(['witch', 3]);
      let tot = w.reduce((a, b) => a + b[1], 0), r = Math.random() * tot, type = 'zombie';
      for (const [k, v] of w) { r -= v; if (r <= 0) { type = k; break; } }
      const pos = this.spawnPos(type === 'bat' || type === 'ghost');
      if (pos) this.spawnEnemy(type, pos.x, pos.y, Math.random() < Math.min(0.06, t / 3000));
    }
    // hordes
    for (const ht of [60, 120, 180, 240, 360, 420]) {
      if (this.soon(ht, ht, 5)) this.toast('A new wave is coming!');
      if (t >= ht && !this.hordes.has(ht)) {
        this.hordes.add(ht);
        this.setBanner('HORDE INCOMING!', 'They are surrounding you', 'danger');
        const type = ht === 60 ? 'zombie' : ht === 120 ? 'bat' : ht === 180 ? 'skeleton' : 'ghost';
        const n = 22 + ht / 10;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2, d = this.viewR - 1;
          const x = this.p.x + Math.cos(a) * d, y = this.p.y + Math.sin(a) * d;
          if (x > 1 && y > 1 && x < MAP_W - 1 && y < MAP_H - 1 && (cellAt(this.map, x, y) === 0 || type === 'bat' || type === 'ghost')) this.spawnEnemy(type, x, y);
        }
      }
    }
    // elites
    if (t >= this.nextElite) {
      this.nextElite += 70;
      const pos = this.spawnPos(false);
      if (pos) {
        this.spawnEnemy('werewolf', pos.x, pos.y);
        this.setBanner('A WEREWOLF HOWLS', 'Elite monster - drops a Treat Bag', 'danger');
      }
    }
    // chests
    if (t >= this.nextChest) {
      this.nextChest += 42;
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
      for (const [cx, cy] of gate.cells) this.map.coll[cy * CW + cx] = 0;
      for (const pr of this.map.props) if (gate.propIds.includes(pr.id)) pr.removed = true;
      this.pickups.push({ x: gate.x, y: gate.y, z: 3, vz: 0, vx: 0, vy: 0, kind: 'chest', value: 0, mag: false, t: 0, dead: false });
      this.setBanner(`${gate.name} IS OPEN!`, 'New streets to explore — a Treat Bag waits at the gate', 'loot');
      for (let i = 0; i < 30; i++) this.particle(gate.x, gate.y, 0.3, rand(-3, 3), rand(-3, 3), rand(2, 6), 1, ['#7CFF64', '#FFC453', '#F9781B'][i % 3], 5, i % 2 ? 'glow' : 'sq');
    }
    // boss
    if (!this.bossSpawned && this.soon(-1, 300, 10)) this.toast('Something huge is stirring in the pumpkin patch…');
    if (t >= 300 && !this.bossSpawned) {
      this.bossSpawned = true;
      const pos = this.spawnPos(true) || { x: this.p.x + 6, y: this.p.y };
      this.boss = this.spawnEnemy('king', pos.x, pos.y);
      this.setBanner('THE PUMPKIN KING RISES', 'Smash him to save Halloween!', 'danger');
      this.shake = 15;
    }
  }

  // ---------- fx ----------
  particle(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, color: string, size: number, kind: Particle['kind']) {
    if (this.particles.length > (settings.lowFx ? 300 : 900)) return;
    if (settings.lowFx && kind === 'glow' && Math.random() < 0.5) return;
    this.particles.push({ x, y, z, vx, vy, vz, life, max: life, color, size, kind });
  }
  text(x: number, y: number, text: string, color: string, size: number, kind: 'ui' | 'dmg' = 'ui') {
    if (this.texts.length > 120) this.texts.shift();
    this.texts.push({ x, y, z: 0.9, text, color, life: 0.8, size, vx: rand(-0.4, 0.4), kind });
  }
  private updateFx(dt: number) {
    for (const q of this.particles) {
      q.life -= dt;
      q.x += q.vx * dt; q.y += q.vy * dt;
      q.z += q.vz * dt;
      if (q.kind === 'sq') {
        q.vz -= 9 * dt;
        if (q.z < 0) { q.z = 0; q.vz *= -0.3; q.vx *= 0.6; q.vy *= 0.6; }
      }
    }
    this.particles = this.particles.filter((q) => q.life > 0);
    for (const t of this.texts) { t.life -= dt; t.z += dt * 1.4; t.x += t.vx * dt; }
    this.texts = this.texts.filter((t) => t.life > 0);
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
    return {
      hp: p.hp, maxHp: s.maxHp, shield: p.shield, maxShield: s.maxShield, level: p.level, xp: p.xp, xpNext: p.xpNext, coins: p.coins, kills: this.kills, time: this.time,
      weapons: p.weapons.map((w) => (w ? { w, st: weaponStats(w, s) } : null)), cur: p.cur, skillCd: Math.max(0, p.skillCd), skillMax: HERO_INFO[this.hero].cd * s.skillCd,
      dashCharges: p.dashCharges, dashMax: s.dashCharges, dashRecharge: p.dashRecharge, interact: this.interact ? this.interact.label : null, nearbyWeapon: this.nearbyWeapon,
      costume: p.costume, nearbyCostume: this.nearbyCostume, interactKind: this.interact ? this.interact.kind : null,
      costumesFound: this.costumesFound, doorsRung: this.housesVisited,
      tot: this.tot ? { t: this.tot.t, dur: this.tot.dur, owner: this.tot.house.owner } : null,
      housesLeft: this.map.houses.filter((h) => !h.visited).length, housesTotal: this.map.houses.length,
      banner: this.banner ? { ...this.banner } : null, boss: this.boss ? { hp: this.boss.hp, max: this.boss.maxHp } : null, scrolls: { ...this.scrolls }, state: this.state, enemies: this.enemies.length,
      bossIn: this.bossSpawned || this.endless ? null : Math.max(0, 300 - this.time), toasts: this.toasts.map((q) => ({ id: q.id, text: q.text })), bigMap: this.bigMap,
    };
  }
}
export type HudSnap = ReturnType<Game['snapshot']>;
