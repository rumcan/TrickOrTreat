// The recorded sounds (generated with `node scripts/audio/generate.mjs`, see src/game/sound/manifest.json). They ship
// as files next to index.html (public/audio/...), never inlined into the single-file build, and load on demand.
//
// Three rules (the same as HexMatch's SFX-1 sample bank):
//   1. NOTHING IS EVER AWAITED. The first play of a sound kicks its load and returns false (the caller plays its synth
//      recipe instead); every play after the decode lands is the recording.
//   2. FAILURE IS A SYNTH, NOT AN ERROR. A missing file, a refused fetch or a failed decode leave the buffer absent.
//   3. NOTHING LOADS BEFORE THE PLAYER TOUCHES THE PAGE: the bank needs the AudioContext, which only exists after the
//      first gesture (raceAudio.unlock). Headless tests have no context, so they stay silent and fetchless.

/** Where a shipped sound lives, relative to the page (Vite copies public/ beside index.html; base is './'). */
export function audioUrl(dir: 'sfx' | 'music' | 'stingers' | 'voice', id: string): string {
  let base = './';
  try { base = (import.meta as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './'; } catch { /* node */ }
  return `${base.endsWith('/') ? base : `${base}/`}audio/${dir}/${id}.mp3`;
}

export interface PlayOpts {
  /** Linear gain (before the master). */
  vol?: number;
  /** Stereo pan -1..1. */
  pan?: number;
  /** Playback rate (pitch): 1 = as recorded. */
  rate?: number;
  /** AudioContext time to start at (default now). */
  when?: number;
}

/** A looping recording whose level and rate follow the game (rolling, wind, the engine, a crowd). */
export interface LoopVoice {
  set(gain: number, rate?: number): void;
  stop(): void;
}

export class SampleBank {
  private buffers = new Map<string, AudioBuffer>();
  private loading = new Set<string>();
  private failed = new Set<string>();
  private voices = 0;

  constructor(private readonly ctx: () => AudioContext | null, private readonly dest: (id: string) => AudioNode | null) {}

  /** Is this sound decoded and ready? */
  ready(key: string): boolean {
    return this.buffers.has(key);
  }

  /** Start loading (no-op when loaded, loading, failed, or there is no context yet). */
  request(dir: 'sfx' | 'stingers' | 'voice', id: string): void {
    const key = `${dir}/${id}`;
    const ctx = this.ctx();
    if (!ctx || this.buffers.has(key) || this.loading.has(key) || this.failed.has(key) || typeof fetch === 'undefined') return;
    this.loading.add(key);
    fetch(audioUrl(dir, id))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .then((buf) => { this.buffers.set(key, buf); })
      .catch(() => { this.failed.add(key); })
      .finally(() => { this.loading.delete(key); });
  }

  /** Warm a list of sounds (after the first gesture), so the first time they are needed they are already there. */
  prewarm(dir: 'sfx' | 'stingers' | 'voice', ids: readonly string[]): void {
    for (const id of ids) this.request(dir, id);
  }

  /** Play a one-shot. False when it is not decoded yet (the load is started; play the synth instead). */
  play(dir: 'sfx' | 'stingers' | 'voice', id: string, opts: PlayOpts = {}): boolean {
    const ctx = this.ctx(), dest = this.dest(id);
    const buf = this.buffers.get(`${dir}/${id}`);
    if (!ctx || !dest || !buf) { this.request(dir, id); return false; }
    if (this.voices >= 8) return false;
    this.voices++;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    const g = ctx.createGain();
    const start = opts.when ?? ctx.currentTime;
    const duration = buf.duration / src.playbackRate.value;
    const attack = id === 'click' || id === 'tick' ? 0.012 : 0.03;
    const volume = opts.vol ?? 1;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(volume, start + Math.min(attack, duration / 4));
    g.gain.setValueAtTime(volume, start + Math.max(attack, duration - 0.06));
    g.gain.linearRampToValueAtTime(0, start + duration);
    let node: AudioNode = g;
    if (opts.pan && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      g.connect(p);
      node = p;
    }
    node.connect(dest);
    src.connect(g);
    src.onended = () => { this.voices = Math.max(0, this.voices - 1); src.disconnect(); g.disconnect(); if (node !== g) node.disconnect(); };
    src.start(opts.when ?? ctx.currentTime);
    return true;
  }

  /**
   * A loop that starts silent and follows `set(gain, rate)`. It waits for its buffer: until the decode lands it is
   * quiet. Level changes glide (no zipper noise).
   */
  loop(id: string): LoopVoice {
    let src: AudioBufferSourceNode | null = null;
    let gain: GainNode | null = null;
    let stopped = false;
    const ensure = (): boolean => {
      if (src || stopped) return !!src;
      const ctx = this.ctx(), dest = this.dest(id);
      const buf = this.buffers.get(`sfx/${id}`);
      if (!ctx || !dest || !buf) { this.request('sfx', id); return false; }
      src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      // generated "seamless" loops still have a soft edge: loop inside it
      if (buf.duration > 0.6) { src.loopStart = 0.08; src.loopEnd = buf.duration - 0.08; }
      gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(gain).connect(dest);
      src.start(ctx.currentTime, 0.08);
      return true;
    };
    return {
      set: (g: number, rate = 1) => {
        if (!ensure() || !gain || !src) return;
        const ctx = this.ctx()!;
        gain.gain.setTargetAtTime(Math.max(0, g), ctx.currentTime, 0.08);
        src.playbackRate.setTargetAtTime(Math.max(0.25, rate), ctx.currentTime, 0.1);
      },
      stop: () => {
        stopped = true;
        try { src?.stop(); } catch { /* already stopped */ }
        src?.disconnect();
        gain?.disconnect();
        src = null;
        gain = null;
      },
    };
  }
}
