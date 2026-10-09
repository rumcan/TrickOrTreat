// ===== Animated PNG (APNG) unpacker =====
// Splits an APNG into fully composited frames so animated sprites can be dropped into /assets as-is.
// Every frame is rebuilt as a standalone PNG (IHDR + palette chunks + its image data) and decoded by the
// browser, then composited with the APNG dispose/blend rules. Plain PNGs return null.

const SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
function crc32(b: Uint8Array, start: number, end: number) {
  let c = ~0;
  for (let i = start; i < end; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8);
  return ~c >>> 0;
}
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out, 4, 8 + data.length));
  return out;
}

interface Frame { w: number; h: number; x: number; y: number; dispose: number; blend: number; data: Uint8Array[] }
// ancillary chunks that change how pixels decode and must travel with every frame
const COPY = new Set(['PLTE', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'iCCP', 'sBIT']);

export function isPng(b: Uint8Array) {
  if (b.length < 8) return false;
  for (let i = 0; i < 8; i++) if (b[i] !== SIG[i]) return false;
  return true;
}

export async function decodeApng(buf: ArrayBuffer): Promise<HTMLCanvasElement[] | null> {
  const b = new Uint8Array(buf);
  if (!isPng(b)) return null;
  const dv = new DataView(buf);
  let ihdr: Uint8Array | null = null;
  let animated = false;
  const extra: Uint8Array[] = [];
  const frames: Frame[] = [];
  let cur: Frame | null = null;
  let seenData = false;
  for (let off = 8; off + 12 <= b.length; ) {
    const len = dv.getUint32(off);
    const type = String.fromCharCode(b[off + 4], b[off + 5], b[off + 6], b[off + 7]);
    const p = off + 8;
    const data = b.subarray(p, p + len);
    off = p + len + 4;
    if (type === 'IHDR') ihdr = data;
    else if (type === 'acTL') animated = true;
    else if (type === 'fcTL') {
      cur = { w: dv.getUint32(p + 4), h: dv.getUint32(p + 8), x: dv.getUint32(p + 12), y: dv.getUint32(p + 16), dispose: b[p + 24], blend: b[p + 25], data: [] };
      frames.push(cur);
    } else if (type === 'IDAT') {
      seenData = true;
      if (cur) cur.data.push(data); // default image is frame 0 only when an fcTL precedes it
    } else if (type === 'fdAT') {
      if (cur) cur.data.push(data.subarray(4));
    } else if (COPY.has(type) && !seenData) extra.push(chunk(type, data));
    else if (type === 'IEND') break;
  }
  if (!animated || !ihdr || !frames.length) return null;
  const W = new DataView(ihdr.buffer, ihdr.byteOffset).getUint32(0);
  const H = new DataView(ihdr.buffer, ihdr.byteOffset).getUint32(4);
  const iend = chunk('IEND', new Uint8Array(0));
  const bitmaps = await Promise.all(
    frames.map((f) => {
      const ih = ihdr!.slice();
      const v = new DataView(ih.buffer);
      v.setUint32(0, f.w);
      v.setUint32(4, f.h);
      const parts: BlobPart[] = [SIG, chunk('IHDR', ih), ...extra, ...f.data.map((d) => chunk('IDAT', d)), iend] as BlobPart[];
      return createImageBitmap(new Blob(parts, { type: 'image/png' }));
    })
  );
  const work = document.createElement('canvas');
  work.width = W;
  work.height = H;
  const ctx = work.getContext('2d', { willReadFrequently: true })!;
  const out: HTMLCanvasElement[] = [];
  let saved: ImageData | null = null;
  frames.forEach((f, i) => {
    const dispose = i === 0 && f.dispose === 2 ? 1 : f.dispose;
    if (dispose === 2) saved = ctx.getImageData(f.x, f.y, f.w, f.h);
    if (f.blend === 0) ctx.clearRect(f.x, f.y, f.w, f.h);
    ctx.drawImage(bitmaps[i], f.x, f.y);
    const snap = document.createElement('canvas');
    snap.width = W;
    snap.height = H;
    snap.getContext('2d')!.drawImage(work, 0, 0);
    out.push(snap);
    if (dispose === 1) ctx.clearRect(f.x, f.y, f.w, f.h);
    else if (dispose === 2 && saved) ctx.putImageData(saved, f.x, f.y);
    bitmaps[i].close();
  });
  return out;
}
