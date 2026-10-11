import { SampleBank } from './sound/bank';
import manifest from './sound/manifest.json';
import topLayer from './sound/top-layer.json';
import { settings, saveSettings } from './settings';

// Preserve the original deep recordings; only the added details get a slight lift.
export const SFX_LOW_PASS_HZ = 700;
export const SFX_PLAYBACK_RATE = 1;
export const DETAIL_LOW_PASS_HZ = 1000;
export const DETAIL_PLAYBACK_RATE = 1.04;
const DETAIL_IDS = new Set(['click', 'tick', 'swoosh']);
/**
 * The bright layer (sound/top-layer.json): a second recording per effect, played together with the deep original.
 * The original stays under its low-pass and gives the weight; this one is what the ear picks out. It has a bus of
 * its own with the lows taken off, so the two do not pile up in the bass.
 */
export const TOP_HIGH_PASS_HZ = 180;
export const TOP_LEVEL = 0.6;
const TOP = new Map(topLayer.sounds.map((s) => [s.id, s]));
/** effects that have no deep recording of their own borrow one: an explosion sits on the monster thud, a bullet landing on the wooden tick */
const BASE: Record<string, string> = { boom: 'impact', hit: 'tick' };
const topId = (id: string) => `top-${id}`;
/** one quiet shot per gun (public/audio/sfx/gun-<id>.mp3), over the deep original 'shot' */
const GUN_SOUNDS: { id: string; gain: number; max: number; every: number; skip?: boolean }[] = topLayer.guns;
const GUNS = new Map(GUN_SOUNDS.filter((s) => !s.skip).map((s) => [s.id, s]));
const gunId = (id: string) => `gun-${id}`;
const DETAILS: Record<string, { id: string; gain: number }> = {
  shot: { id: 'tick', gain: 0.16 }, pickup: { id: 'tick', gain: 0.45 },
  reload: { id: 'click', gain: 0.6 }, unlock: { id: 'click', gain: 0.5 },
  skill: { id: 'swoosh', gain: 0.45 },
};

/** Radio-compatible audio bus. Music retains the sibling game's exact recording. */
class GameAudio {
  context: AudioContext | null = null;
  private master: GainNode | null = null;
  private detailMaster: GainNode | null = null;
  private topMaster: GainNode | null = null;
  private mutedListeners = new Set<() => void>();
  private last = new Map<string, number>();
  bank = new SampleBank(() => this.context, id => id.startsWith('top-') || id.startsWith('gun-') ? this.topMaster : DETAIL_IDS.has(id) ? this.detailMaster : this.master);
  get muted() { return settings.muted; }
  unlock = () => {
    if (!this.context) {
      try {
        const ctx = new AudioContext();
        this.context = ctx;
        this.master = ctx.createGain();
        this.detailMaster = ctx.createGain();
        const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = SFX_LOW_PASS_HZ; low.Q.value = 0.5;
        const detailLow = ctx.createBiquadFilter(); detailLow.type = 'lowpass'; detailLow.frequency.value = DETAIL_LOW_PASS_HZ; detailLow.Q.value = 0.5;
        const high = ctx.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 35; high.Q.value = 0.5;
        const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -16; limiter.ratio.value = 8; limiter.attack.value = 0.025; limiter.release.value = 0.18;
        this.master.connect(low).connect(high).connect(limiter).connect(ctx.destination);
        this.detailMaster.connect(detailLow).connect(high);
        this.topMaster = ctx.createGain();
        const topHigh = ctx.createBiquadFilter(); topHigh.type = 'highpass'; topHigh.frequency.value = TOP_HIGH_PASS_HZ; topHigh.Q.value = 0.5;
        this.topMaster.connect(topHigh).connect(limiter);
        this.syncVolume();
        this.bank.prewarm('sfx', manifest.sfx.map((sound) => sound.id));
        this.bank.prewarm('sfx', topLayer.sounds.map((sound) => topId(sound.id)));
        this.bank.prewarm('sfx', [...GUNS.keys()].map(gunId));
      } catch { return; }
    }
    void this.context.resume().catch(() => undefined);
  };
  onMute(fn: () => void) { this.mutedListeners.add(fn); return () => this.mutedListeners.delete(fn); }
  setMuted(value: boolean) { settings.muted = value; saveSettings(); this.syncVolume(); for (const fn of this.mutedListeners) fn(); }
  setVolume(value: number) { settings.sfxVolume = Math.max(0, Math.min(1, value)); saveSettings(); this.syncVolume(); }
  private syncVolume() {
    if (!this.context) return;
    for (const bus of [this.master, this.detailMaster]) bus?.gain.setTargetAtTime(this.muted ? 0 : settings.sfxVolume * 0.35, this.context.currentTime, 0.04);
    this.topMaster?.gain.setTargetAtTime(this.muted ? 0 : settings.sfxVolume * TOP_LEVEL, this.context.currentTime, 0.04);
  }
  /**
   * A gun goes off: the deep original shot, and that gun's own quiet sound over it. A fast gun does not restart its
   * sound on every bullet: each gun has a shortest gap between two of them and uses only the first instant of the
   * recording, so a stream ticks gently instead of buzzing.
   */
  shot(gun: string, volume = 0.65) {
    this.play('shot', volume);
    const own = GUNS.get(gun);
    if (!own || this.muted || !this.context || document.hidden) return;
    const now = performance.now(), key = gunId(gun);
    if (now - (this.last.get(key) ?? -Infinity) < own.every * 1000) return;
    this.last.set(key, now);
    this.bank.play('sfx', key, { vol: Math.min(1, Math.max(0, volume) * own.gain / 0.65), max: own.max });
  }
  play(id: string, volume = 0.65, layered = true) {
    if (this.muted || !this.context || document.hidden) return;
    const now = performance.now(), interval = id === 'hit' ? 55 : id === 'shot' || id === 'impact' ? 100 : id === 'boom' ? 130 : 250;
    if (now - (this.last.get(id) ?? -Infinity) < interval) return;
    this.last.set(id, now);
    // Dash is a replacement, not a layer: never play the old explosive recording.
    const name = id === 'dash' ? 'swoosh' : id, sound = BASE[name] ?? name;
    this.bank.play('sfx', sound, { vol: Math.min(1, Math.max(0, volume)) * (id === 'dash' ? 0.4 : 1), rate: DETAIL_IDS.has(sound) ? DETAIL_PLAYBACK_RATE : SFX_PLAYBACK_RATE });
    // the bright layer of this effect, together with the original (not for the small detail sounds tucked under another effect)
    const top: { gain: number; duration: number; max?: number; every?: number } | undefined = layered ? TOP.get(name) : undefined;
    if (top && (!top.every || now - (this.last.get(topId(name)) ?? -Infinity) >= top.every * 1000)) {
      this.last.set(topId(name), now);
      this.bank.play('sfx', topId(name), { vol: Math.min(1, Math.max(0, volume) * top.gain * (id === 'dash' ? 0.7 : 1) / 0.65), max: top.max ?? top.duration + 0.15 });
    }
    const detail = DETAILS[id];
    if (detail) this.play(detail.id, volume * detail.gain, false);
  }
}
export const raceAudio = new GameAudio();
export const gameAudio = raceAudio;
