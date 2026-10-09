// ===== PNG exporter =====
// Renders the procedural ("vector") art of the buildings, kids and monsters straight from the generators,
// ignoring any PNG overrides, so it can be written to the repo by scripts/export-art.mjs:
//   public/assets/<file>            game-ready 1× files (exact spec size, wired up in manifest.json)
//   art/reference/<group>/<key>.png hi-res renders to feed an image generator
import { allAssets, Entry } from './assets';
import { withArtScale, rawCanvas } from './art/draw';

export type Group = 'characters' | 'monsters' | 'buildings';
/** data is base64 */
export interface ExportFile { path: string; data: string }

function groupOf(e: Entry): Group | null {
  const dir = e.spec.file.split('/')[0];
  return dir === 'characters' || dir === 'monsters' || dir === 'buildings' ? dir : null;
}
const b64 = (c: HTMLCanvasElement) => c.toDataURL('image/png').split(',')[1];
const text64 = (s: string) => {
  let bin = '';
  for (const x of new TextEncoder().encode(s)) bin += String.fromCharCode(x);
  return btoa(bin);
};

/**
 * refScale: hi-res reference scale. sheets: 'base' = full reference sheets for the base kids and monsters only
 * (costume sheets are ~1 MB each at 4×), 'all' = every sheet. buildingScale: 0 = no separate building renders.
 */
export function exportArt(refScale = 4, sheets: 'base' | 'all' = 'base', buildingScale = 0) {
  const files: ExportFile[] = [];
  const specs: Record<string, unknown> = {};
  for (const e of allAssets()) {
    const group = groupOf(e);
    if (!group) continue;
    const { key } = e.spec;
    files.push({ path: `public/assets/${e.spec.file}`, data: b64(withArtScale(1, e.gen)) });
    if (e.spec.category === 'sheet') {
      // one clean pose (first frame, facing the camera) + the whole sheet, both at refScale
      const sheet = withArtScale(refScale, e.gen);
      const fw = e.spec.frameW! * refScale, fh = e.spec.frameH! * refScale;
      const pose = rawCanvas(fw, fh);
      pose.getContext('2d')!.drawImage(sheet, 0, 0, fw, fh, 0, 0, fw, fh);
      files.push({ path: `art/reference/${group}/${key}.png`, data: b64(pose) });
      const costume = group === 'characters' && key.split('_').length > 2;
      if (sheets === 'all' || !costume) files.push({ path: `art/reference/${group}/${key}_sheet@${refScale}x.png`, data: b64(sheet) });
    } else if (buildingScale > 0) files.push({ path: `art/reference/${group}/${key}@${buildingScale}x.png`, data: b64(withArtScale(buildingScale, e.gen)) });
    const { desc, prompt, w, h, frameW, frameH, rows, rowFrames, anchor, footprint, file } = e.spec;
    specs[key] = { file, group, desc, size: [w, h], frame: frameW ? [frameW, frameH] : undefined, rows, rowFrames, anchor, footprint, prompt };
  }
  files.push({ path: 'art/reference/specs.json', data: text64(JSON.stringify(specs, null, 2) + '\n') });
  return files;
}
