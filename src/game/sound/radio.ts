// The game's radio: our own generated music (src/game/sound/manifest.json), in four stations, ported from HexMatch's
// MUSIC-1 / RADIO-2 player (the pill with ‹ ▶ › and a volume slider, the station dial, the duck under voice lines).
//
// The difference from HexMatch: the music follows the game. Each part of the game asks for a scene (`setScene`), and
// on "Auto" (the default) the radio tunes the station that fits: Pit Lane in the menus and the Workshop, Grid Metal in
// a race, Moonlit Streets on an Infinity run (day or night tracks with the sky), Storybook in a story scene. Picking a
// station on the pill holds it everywhere until you go back to Auto.
//
// Rules kept from HexMatch:
//   1. Nothing plays before the player touches the page (`unlock`, from the first gesture): browsers refuse it anyway.
//   2. Garnish never breaks the game: no window, no Audio element, a missing file, a refused play() all end in silence.
//   3. Its volume is its own knob; it ducks under voice lines and stingers; the game's one mute silences it too.
//   4. Nothing here goes on the wire or into a save; settings live in storage.ts (RUN blocks localStorage).
import manifest from './manifest.json';
import { audioUrl } from './bank';
import { raceAudio } from '../audio';
import * as storage from '../storage';

export type StationId = 'grid' | 'infinity' | 'pit' | 'story';
export type MusicScene = 'menu' | 'workshop' | 'race' | 'infinity' | 'story' | 'results';

export interface Track { id: string; title: string; station: StationId; mood?: 'day' | 'night'; /** Infinity: the biomes it fits (infinity-look.ts BIOMES ids). */ biomes?: string[]; url: string }
export interface Station { id: StationId; name: string; genre: string; tracks: Track[] }

const NAMES: Record<StationId, { name: string; genre: string }> = {
  grid: { name: 'Midnight Mischief', genre: 'Heavy metal for monster hunting' },
  infinity: { name: 'Moonlit Streets', genre: 'Cinematic travel music' },
  pit: { name: 'Porchlight Radio', genre: 'Garage grooves and tavern rock' },
  story: { name: 'Hide & Shriek', genre: 'The story score' },
};

export const STATIONS: readonly Station[] = (['grid', 'infinity', 'pit', 'story'] as const).map((id) => ({
  id, ...NAMES[id],
  tracks: (manifest.music as { id: string; title: string; station: string; mood?: string }[])
    .filter((t) => t.station === id)
    .map((t) => ({ id: t.id, title: t.title, station: id, ...(t.mood ? { mood: t.mood as 'day' | 'night' } : {}), ...((t as { biomes?: string[] }).biomes ? { biomes: (t as { biomes?: string[] }).biomes } : {}), url: audioUrl('music', t.id) })),
}));

/** Which station a scene tunes on Auto. */
export const SCENE_STATION: Record<MusicScene, StationId> = {
  menu: 'pit', workshop: 'pit', results: 'pit', race: 'grid', infinity: 'infinity', story: 'story',
};

export type Stinger = 'win-fanfare' | 'podium-jingle' | 'finish-jingle' | 'ko-jingle' | 'level-up' | 'chapter-complete' | 'trophy';

export interface RadioSettings {
  /** The radio is on (the play key turns it off and on; remembered). */
  enabled: boolean;
  /** 0..1, its own knob. */
  volume: number;
  /** 'auto' follows the game; a station id holds that station everywhere. */
  station: 'auto' | StationId;
}
export const RADIO_DEFAULTS: RadioSettings = { enabled: true, volume: 0.45, station: 'auto' };
const KEY = 'tot_radio_v1';
/** Voice lines and stingers pull the music down to this share of its volume. */
export const DUCK_RATIO = 0.25;
const FADE_MS = 1400;

export function readRadioSettings(raw: string | null): RadioSettings {
  try {
    const v = raw ? JSON.parse(raw) as Partial<RadioSettings> : {};
    const station = v.station === 'auto' || STATIONS.some((s) => s.id === v.station) ? v.station! : 'auto';
    const volume = typeof v.volume === 'number' && Number.isFinite(v.volume) ? Math.min(1, Math.max(0, v.volume)) : RADIO_DEFAULTS.volume;
    return { enabled: v.enabled !== false, volume, station };
  } catch { return { ...RADIO_DEFAULTS }; }
}

/** The dial the ‹ › keys step through: Auto first, then every station. */
export const DIAL: readonly ('auto' | StationId)[] = ['auto', ...STATIONS.map((s) => s.id)];
export function stepDial(current: 'auto' | StationId, dir: 1 | -1): 'auto' | StationId {
  const i = DIAL.indexOf(current);
  return DIAL[(i + dir + DIAL.length) % DIAL.length];
}

/** The station that plays: the held one, else the scene's. */
export function stationFor(settings: RadioSettings, scene: MusicScene): StationId {
  return settings.station === 'auto' ? SCENE_STATION[scene] : settings.station;
}

/**
 * The tracks a station plays now. Infinity follows the world: its night tracks in the dark, and by day the tracks made
 * for the biome you are rolling through (any day track when none is tagged for it).
 */
export function playlistFor(station: StationId, night: boolean, biome: string | null = null): Track[] {
  const all = STATIONS.find((s) => s.id === station)?.tracks ?? [];
  if (station !== 'infinity') return all;
  const mood = all.filter((t) => t.mood === (night ? 'night' : 'day'));
  const here = !night && biome ? mood.filter((t) => t.biomes?.includes(biome)) : [];
  return here.length ? here : mood.length ? mood : all;
}

export interface RadioView {
  settings: RadioSettings;
  playing: boolean;
  station: Station;
  track: Track | null;
  /** The pill's line: the station and what is playing. */
  text: string;
}

type Listener = (v: RadioView) => void;

class Radio {
  settings: RadioSettings = { ...RADIO_DEFAULTS };
  private loaded = false;
  private unlocked = false;
  private scene: MusicScene = 'menu';
  private night = false;
  private biome: string | null = null;
  private decks: [HTMLAudioElement | null, HTMLAudioElement | null] = [null, null];
  private live = 0;
  private track: Track | null = null;
  private station: StationId = 'pit';
  private order = new Map<StationId, string[]>();
  private ducks = 0;
  private stingUntil = 0;
  private listeners = new Set<Listener>();
  private fadeTimer: number | null = null;
  private failures = 0;
  private view: RadioView | null = null;

  private load(): void {
    if (this.loaded) return;
    this.loaded = true;
    this.settings = readRadioSettings(storage.getItem(KEY));
    raceAudio.onMute(() => this.applyVolume());
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => this.applyVolume());
  }

  private save(): void {
    storage.setItem(KEY, JSON.stringify(this.settings));
  }

  /** The first gesture: from now on the radio may play. */
  unlock(): void {
    this.load();
    if (this.unlocked) return;
    this.unlocked = true;
    this.retune(true);
  }

  /**
   * Where the player is: the radio tunes the station that fits (on Auto). On Infinity `night` and `biome` choose the
   * next track (the night tracks, or the ones made for that part of the world); the playing one is never cut off.
   */
  setScene(scene: MusicScene, night = false, biome: string | null = null): void {
    this.load();
    if (scene === this.scene && night === this.night && biome === this.biome) return;
    this.scene = scene;
    this.night = night;
    this.biome = biome;
    this.retune(false);
  }

  /** The play key: off and on (remembered). */
  toggle(): void {
    this.load();
    this.settings = { ...this.settings, enabled: !this.settings.enabled };
    this.save();
    if (this.settings.enabled) { this.unlocked = true; this.retune(true); } else this.pauseAll();
    this.emit();
  }

  /** ‹ › : step the dial (Auto, then every station). */
  stepStation(dir: 1 | -1): void {
    this.load();
    this.settings = { ...this.settings, station: stepDial(this.settings.station, dir) };
    this.save();
    this.retune(true);
  }

  /** Skip to the next track of the station that is playing. */
  skip(): void {
    if (!this.settings.enabled) return;
    this.playNext(true);
  }

  setVolume(v: number): void {
    this.load();
    this.settings = { ...this.settings, volume: Math.min(1, Math.max(0, v)) };
    this.save();
    this.applyVolume();
    this.emit();
  }

  /** A voice line starts (true) or ends (false): the music dips under it. */
  duck(on: boolean): void {
    this.ducks = Math.max(0, this.ducks + (on ? 1 : -1));
    this.applyVolume();
  }

  /** The game's mute changed (M): follow it. */
  syncMute(): void { this.applyVolume(); }

  /** A short piece of music over the radio (a win, a level-up): the radio dips while it plays. */
  stinger(id: Stinger): void {
    const ctx = raceAudio.context;
    if (!ctx || raceAudio.muted) return;
    const bank = raceAudio.bank;
    const vol = Math.max(0.15, this.settings.volume) * 1.4;
    if (bank.play('stingers', id, { vol })) {
      this.stingUntil = Date.now() + 6000;
      this.applyVolume();
      window.setTimeout(() => this.applyVolume(), 6100);
    } else bank.request('stingers', id);
  }

  /** Warm the stingers a screen will need (a race's results). */
  prewarmStingers(ids: readonly Stinger[]): void { raceAudio.bank.prewarm('stingers', ids); }

  subscribe(fn: Listener): () => void {
    this.load();
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  snapshot(): RadioView {
    this.load();
    if (!this.view) this.view = this.makeView();
    return this.view;
  }

  // ── the player ──

  private makeView(): RadioView {
    const station = STATIONS.find((s) => s.id === (this.track?.station ?? stationFor(this.settings, this.scene)))!;
    const playing = this.settings.enabled && this.unlocked && !!this.track;
    const auto = this.settings.station === 'auto' ? 'Auto: ' : '';
    return {
      settings: this.settings, playing, station, track: this.track,
      text: !this.settings.enabled ? 'Radio off' : this.track ? `${auto}${station.name} · ${this.track.title}` : `${auto}${station.name}`,
    };
  }

  private emit(): void {
    this.view = this.makeView();
    for (const fn of this.listeners) { try { fn(this.view); } catch { /* a dead listener */ } }
  }

  private deck(i: 0 | 1): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') return null;
    if (!this.decks[i]) {
      const a = new Audio();
      a.preload = 'auto';
      a.addEventListener('ended', () => { if (this.decks[this.live] === a) this.playNext(false); });
      a.addEventListener('error', () => { if (this.decks[this.live] === a) this.onError(); });
      this.decks[i] = a;
    }
    return this.decks[i];
  }

  private target(): number {
    if (raceAudio.muted || (typeof document !== 'undefined' && document.hidden)) return 0;
    const duck = this.ducks > 0 || Date.now() < this.stingUntil ? DUCK_RATIO : 1;
    return this.settings.volume * duck;
  }

  private applyVolume(): void {
    const a = this.decks[this.live];
    if (a && this.fadeTimer === null) a.volume = this.target();
  }

  private pauseAll(): void {
    for (const a of this.decks) a?.pause();
    this.track = null;
  }

  /** Make the radio play what it should now (a different station crossfades; the same one carries on). */
  private retune(force: boolean): void {
    if (!this.unlocked || !this.settings.enabled) { this.emit(); return; }
    const station = stationFor(this.settings, this.scene);
    const list = playlistFor(station, this.night, this.biome);
    // Infinity's biomes (about 40 s each at speed) and nights change faster than a track lasts: they choose the NEXT
    // track, they never cut one off. Elsewhere a track that no longer fits crossfades out.
    const fits = this.track && this.track.station === station && (station === 'infinity' || list.some((t) => t.id === this.track!.id));
    if (fits && !force) { this.emit(); return; }
    if (fits && force && this.decks[this.live] && !this.decks[this.live]!.paused) { this.emit(); return; }
    this.station = station;
    this.playNext(true);
  }

  /** The next track of the station, in a shuffled order that never repeats the last one straight away. */
  private nextTrack(): Track | null {
    const list = playlistFor(this.station, this.night, this.biome);
    if (!list.length) return null;
    let order = this.order.get(this.station)?.filter((id) => list.some((t) => t.id === id)) ?? [];
    if (!order.length) {
      order = list.map((t) => t.id).sort(() => Math.random() - 0.5);
      if (order.length > 1 && order[0] === this.track?.id) order.push(order.shift()!);
    }
    const id = order.shift()!;
    this.order.set(this.station, order);
    return list.find((t) => t.id === id) ?? null;
  }

  private playNext(fade: boolean): void {
    const next = this.nextTrack();
    if (!next) { this.track = null; this.emit(); return; }
    const old = this.decks[this.live];
    this.live = this.live === 0 ? 1 : 0;
    const a = this.deck(this.live as 0 | 1);
    if (!a) return;
    this.track = next;
    a.src = next.url;
    a.volume = fade ? 0 : this.target();
    a.play().then(() => { this.failures = 0; }).catch(() => { /* refused before a gesture, or a missing file: 'error' handles that */ });
    this.crossfade(old && !old.paused ? old : null, a, fade);
    this.emit();
  }

  private crossfade(out: HTMLAudioElement | null, into: HTMLAudioElement, fade: boolean): void {
    if (this.fadeTimer !== null) { window.clearInterval(this.fadeTimer); this.fadeTimer = null; }
    if (!fade) { out?.pause(); return; }
    const start = Date.now(), from = out?.volume ?? 0;
    this.fadeTimer = window.setInterval(() => {
      const k = Math.min(1, (Date.now() - start) / FADE_MS);
      into.volume = this.target() * k;
      if (out) out.volume = from * (1 - k);
      if (k >= 1) {
        out?.pause();
        if (this.fadeTimer !== null) window.clearInterval(this.fadeTimer);
        this.fadeTimer = null;
      }
    }, 50);
  }

  /** A track that will not load (not generated yet, or a network hiccup): try the next one, then rest. */
  private onError(): void {
    this.failures++;
    if (this.failures <= 4) { this.playNext(false); return; }
    this.track = null;
    this.emit();
    window.setTimeout(() => { this.failures = 0; if (this.settings.enabled && this.unlocked && !this.track) this.retune(true); }, 20000);
  }
}

export const radio = new Radio();
