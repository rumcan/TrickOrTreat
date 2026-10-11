// Spoken lines (the walkie-talkie tutorial). The recordings are clean; the walkie sound is made here: a narrow
// telephone band, a little grit, and its own level, so a line stays clear over the low-passed game sounds.
// Like the sample bank, a missing file or a browser without sound is not an error: speak() answers 0 seconds and the
// caller shows the words for a time of its own.
import { gameAudio } from '../audio';
import { settings } from '../settings';
import { audioUrl } from './bank';
import { radio } from './radio';

const buffers = new Map<string, Promise<AudioBuffer | null>>();
let playing: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
let turn = 0, ducking = false;

function load(id: string): Promise<AudioBuffer | null> {
  const ctx = gameAudio.context;
  if (!ctx || typeof fetch === 'undefined') return Promise.resolve(null);
  let hit = buffers.get(id);
  if (!hit) {
    hit = fetch(audioUrl('voice', id))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null);
    buffers.set(id, hit);
  }
  return hit;
}
/** fetch lines ahead of time, so the first word is not late */
export function preloadVoice(ids: readonly string[]) { for (const id of ids) void load(id); }

function duck(on: boolean) { if (ducking !== on) { ducking = on; radio.duck(on); } }
/** the gentle clip that makes a small speaker */
function grit(ctx: AudioContext) {
  const shaper = ctx.createWaveShaper(), curve = new Float32Array(257);
  for (let i = 0; i < 257; i++) { const x = (i - 128) / 128; curve[i] = Math.tanh(x * 2.2) / Math.tanh(2.2); }
  shaper.curve = curve;
  return shaper;
}

/** Say a line over the walkie. Resolves with its length in seconds, or 0 when there is no sound to play. */
export async function speak(id: string): Promise<number> {
  stopSpeaking();
  const mine = ++turn, ctx = gameAudio.context;
  if (!ctx || settings.muted || settings.sfxVolume <= 0) return 0;
  const buffer = await load(id);
  if (!buffer || mine !== turn) return 0; // another line (or a skip) came in while this one loaded
  try {
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const high = ctx.createBiquadFilter(); high.type = 'highpass'; high.frequency.value = 380;
    const low = ctx.createBiquadFilter(); low.type = 'lowpass'; low.frequency.value = 3300;
    const gain = ctx.createGain(); gain.gain.value = Math.min(1, 0.25 + settings.sfxVolume * 1.1);
    src.connect(high).connect(low).connect(grit(ctx)).connect(gain).connect(ctx.destination);
    src.onended = () => { if (playing?.src === src) { playing = null; duck(false); } };
    playing = { src, gain };
    duck(true);
    gameAudio.play('click', 0.5); // the push-to-talk
    src.start();
    return buffer.duration;
  } catch { return 0; }
}
export function stopSpeaking() {
  turn++;
  const was = playing; playing = null;
  duck(false);
  if (was) { try { was.src.onended = null; was.src.stop(); } catch { /* already over */ } }
}
