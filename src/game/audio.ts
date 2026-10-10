import { SampleBank } from './sound/bank';
import manifest from './sound/manifest.json';
import { settings, saveSettings } from './settings';

// Preserve the original deep recordings; only the added details get a slight lift.
export const SFX_LOW_PASS_HZ = 700;
export const SFX_PLAYBACK_RATE = 1;
export const DETAIL_LOW_PASS_HZ = 1000;
export const DETAIL_PLAYBACK_RATE = 1.04;
const DETAIL_IDS = new Set(['click', 'tick', 'swoosh']);
export const NORMAL_SFX_LOW_PASS_HZ = 6500;
const SYNTH_IDS = new Set(['slotStart', 'slotTick', 'slotWin', 'slotExit']);
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
  private normalMaster: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private normalVoices = 0;
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
        this.normalMaster = ctx.createGain();
        const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = SFX_LOW_PASS_HZ; low.Q.value = 0.5;
        const detailLow = ctx.createBiquadFilter(); detailLow.type = 'lowpass'; detailLow.frequency.value = DETAIL_LOW_PASS_HZ; detailLow.Q.value = 0.5;
        const high = ctx.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 35; high.Q.value = 0.5;
        const limiter = ctx.createDynamicsCompressor(); limiter.threshold.value = -16; limiter.ratio.value = 8; limiter.attack.value = 0.025; limiter.release.value = 0.18;
        this.master.connect(low).connect(high).connect(limiter).connect(ctx.destination);
        this.detailMaster.connect(detailLow).connect(high);
        const normalLow = ctx.createBiquadFilter(); normalLow.type = 'lowpass'; normalLow.frequency.value = NORMAL_SFX_LOW_PASS_HZ; normalLow.Q.value = .5;
        this.normalMaster.connect(normalLow).connect(high);
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
    for (const bus of [this.master, this.detailMaster, this.normalMaster]) bus?.gain.setTargetAtTime(this.muted ? 0 : settings.sfxVolume * 0.35, this.context.currentTime, 0.04);
  }
  /** Short conventional details above the preserved deep samples; bounded voices and soft attacks. */
  private detail(id: string, volume: number) {
    const ctx = this.context, bus = this.normalMaster;
    if (!ctx || !bus) return;
    const note = (frequency: number, end: number, duration: number, gain: number, delay = 0, noisy = false) => {
      if (this.normalVoices >= 12) return;
      const start = ctx.currentTime + delay, envelope = ctx.createGain();
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(Math.min(1, volume) * gain, start + .008);
      envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
      envelope.connect(bus);
      let source: OscillatorNode | AudioBufferSourceNode;
      let filter: BiquadFilterNode | null = null;
      if (noisy) {
        if (!this.noise) {
          this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .25), ctx.sampleRate);
          const data = this.noise.getChannelData(0);
          for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        }
        const noise = ctx.createBufferSource(); noise.buffer = this.noise; source = noise;
        filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = .6;
        filter.frequency.setValueAtTime(frequency, start); filter.frequency.exponentialRampToValueAtTime(end, start + duration);
        source.connect(filter).connect(envelope);
      } else {
        const tone = ctx.createOscillator(); tone.type = 'triangle'; source = tone;
        tone.frequency.setValueAtTime(frequency, start); tone.frequency.exponentialRampToValueAtTime(end, start + duration);
        source.connect(envelope);
      }
      this.normalVoices++;
      source.onended = () => { source.disconnect(); filter?.disconnect(); envelope.disconnect(); this.normalVoices--; };
      source.start(start); source.stop(start + duration + .015);
    };
    switch (id) {
      case 'shot': note(1900, 850, .085, .34, 0, true); note(340, 170, .075, .16); break;
      case 'impact': note(1100, 500, .07, .2, 0, true); break;
      case 'reload': note(1500, 1000, .07, .25, 0, true); note(850, 520, .08, .2, .12, true); break;
      case 'pickup': note(520, 660, .12, .16); break;
      case 'door': note(560, 560, .18, .2); note(440, 440, .22, .2, .2); break;
      case 'slotStart': note(600, 1500, .2, .24, 0, true); note(440, 880, .22, .12); break;
      case 'slotTick': note(1400, 900, .035, .27, 0, true); break;
      case 'slotWin': [520, 650, 780].forEach((f, i) => note(f, f, .26, .18, i * .11)); break;
      case 'slotExit': note(650, 400, .09, .15); break;
    }
  }
  play(id: string, volume = 0.65) {
    if (this.muted || !this.context || document.hidden) return;
    const now = performance.now(), interval = id === 'slotTick' ? 65 : id === 'shot' || id === 'impact' ? 100 : 250;
    if (now - (this.last.get(id) ?? -Infinity) < interval) return;
    this.last.set(id, now);
    volume = Number.isFinite(volume) ? Math.max(0, Math.min(1, volume)) : 0;
    if (!volume) return;
    this.detail(id, volume);
    if (SYNTH_IDS.has(id)) return;
    // Dash is a replacement, not a layer: never play the old explosive recording.
    const sound = id === 'dash' ? 'swoosh' : id;
    this.bank.play('sfx', sound, { vol: Math.min(1, Math.max(0, volume)) * (id === 'dash' ? 0.4 : 1), rate: DETAIL_IDS.has(sound) ? DETAIL_PLAYBACK_RATE : SFX_PLAYBACK_RATE });
    const detail = DETAILS[id];
    if (detail) this.play(detail.id, volume * detail.gain);
  }
}
export const raceAudio = new GameAudio();
export const gameAudio = raceAudio;
