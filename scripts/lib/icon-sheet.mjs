import sharp from 'sharp';

/**
 * Cut the hand-placed icons out of a transparent sheet. Icons are found by their own outline (connected opaque pixels),
 * not by an even grid, and each cut keeps only its own pixels, so a neighbour's edge never leaks in.
 * Returns PNG buffers as [row][column], rows top to bottom and columns left to right.
 */
export async function cutIconSheet(sheet, rows, cols) {
  const { data, info } = await sharp(sheet).ensureAlpha().extractChannel(3).raw().toBuffer({ resolveWithObject: true });
  const S = 2, w = Math.floor(info.width / S), h = Math.floor(info.height / S);
  // Glows of neighbouring icons can touch: raise the opacity cut-off until the sheet falls apart into the expected count.
  let label, blobs;
  for (const cutoff of [40, 90, 140, 190, 230]) {
    const solid = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (data[y * S * info.width + x * S] > cutoff) solid[y * w + x] = 1;
    const seen = new Uint8Array(w * h);
    label = new Uint8Array(w * h); blobs = [];
    for (let start = 0; start < w * h; start++) {
      if (!solid[start] || seen[start]) continue;
      const queue = [start]; seen[start] = 1;
      let x0 = w, y0 = h, x1 = 0, y1 = 0;
      for (let i = 0; i < queue.length; i++) {
        const c = queue[i], x = c % w, y = (c / w) | 0;
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (const n of [c - 1, c + 1, c - w, c + w]) if (n >= 0 && n < w * h && solid[n] && !seen[n] && Math.abs((n % w) - x) <= 1) { seen[n] = 1; queue.push(n); }
      }
      if (queue.length <= 400) continue; // specks
      blobs.push({ id: blobs.length + 1, x0: x0 * S, y0: y0 * S, x1: (x1 + 1) * S, y1: (y1 + 1) * S, cx: (x0 + x1) * S / 2, cy: (y0 + y1) * S / 2 });
      for (const c of queue) label[c] = blobs.length;
    }
    if (blobs.length === rows * cols) break;
  }
  if (blobs.length !== rows * cols) throw new Error(`Expected ${rows * cols} icons on ${sheet}, found ${blobs.length}`);
  blobs.sort((p, q) => p.cy - q.cy);
  const out = [];
  for (let r = 0; r < rows; r++) {
    const row = blobs.slice(r * cols, r * cols + cols).sort((p, q) => p.cx - q.cx), cuts = [];
    for (const b of row) {
      const pad = 2, left = Math.max(0, b.x0 - pad), top = Math.max(0, b.y0 - pad);
      const cw = Math.min(info.width, b.x1 + pad) - left, ch = Math.min(info.height, b.y1 + pad) - top;
      const rgba = await sharp(sheet).extract({ left, top, width: cw, height: ch }).ensureAlpha().raw().toBuffer();
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
        const mx = Math.min(w - 1, ((left + x) / S) | 0), my = Math.min(h - 1, ((top + y) / S) | 0);
        let own = label[my * w + mx] === b.id, other = label[my * w + mx] !== 0 && !own;
        for (let d = 1; d <= 4 && !own && !other; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
          const nx = mx + dx, ny = my + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          const l = label[ny * w + nx];
          if (l === b.id) own = true; else if (l) other = true;
        }
        if (!own) rgba[(y * cw + x) * 4 + 3] = 0;
      }
      cuts.push(await sharp(rgba, { raw: { width: cw, height: ch, channels: 4 } }).png().toBuffer());
    }
    out.push(cuts);
  }
  return out;
}

/**
 * The same result for a sheet laid out on an even grid, each icon inside its own cell (generated sheets): icons made of
 * several loose pieces (two hands, a snapped chocolate bar) stay whole, which blob detection would split.
 */
export async function cutIconGrid(sheet, rows, cols) {
  const { width, height } = await sharp(sheet).metadata(), out = [];
  for (let r = 0; r < rows; r++) {
    const cuts = [];
    for (let c = 0; c < cols; c++) {
      const left = Math.round(c * width / cols), top = Math.round(r * height / rows);
      const cell = await sharp(sheet).extract({ left, top, width: Math.round((c + 1) * width / cols) - left, height: Math.round((r + 1) * height / rows) - top }).png().toBuffer();
      cuts.push(await sharp(cell).trim({ threshold: 1 }).png().toBuffer());
    }
    out.push(cuts);
  }
  return out;
}
