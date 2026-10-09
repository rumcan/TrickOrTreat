import { SampleBank } from './sound/bank';
import manifest from './sound/manifest.json';
import { settings, saveSettings } from './settings';

// Preserve the original deep recordings; only the added details get a slight lift.
export const SFX_LOW_PASS_HZ = 700;
export const SFX_PLAYBACK_RATE = 1;
export const DETAIL_LOW_PASS_HZ = 1000;
export const DETAIL_PLAYBACK_RATE = 1.04;
const DETAIL_IDS = new Set(['click', 'tick', 'swoosh']);
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
  private mutedListeners = new Set<() => void>();
  private last = new Map<string, number>();
  bank = new SampleBank(() => this.context, id => DETAIL_IDS.has(id) ? this.detailMaster : this.master);
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
        this.syncVolume();
        this.bank.prewarm('sfx', manifest.sfx.map((sound) => sound.id));
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
  }
  play(id: string, volume = 0.65) {
    if (this.muted || !this.context || document.hidden) return;
    const now = performance.now(), interval = id === 'shot' || id === 'impact' ? 100 : 250;
    if (now - (this.last.get(id) ?? -Infinity) < interval) return;
    this.last.set(id, now);
    // Dash is a replacement, not a layer: never play the old explosive recording.
    const sound = id === 'dash' ? 'swoosh' : id;
    this.bank.play('sfx', sound, { vol: Math.min(1, Math.max(0, volume)) * (id === 'dash' ? 0.4 : 1), rate: DETAIL_IDS.has(sound) ? DETAIL_PLAYBACK_RATE : SFX_PLAYBACK_RATE });
    const detail = DETAILS[id];
    if (detail) this.play(detail.id, volume * detail.gain);
  }
}
export const raceAudio = new GameAudio();
export const gameAudio = raceAudio;
