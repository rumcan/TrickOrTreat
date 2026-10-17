import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

// Renders a rigged 3D kid (GLB with a walk clip, from scripts/art/make-hero-3d.mjs) into the game's "aiming" sprite
// sheet: 8 screen directions, both arms stretched forward, so the gun the engine draws at the hands looks held.
// Same 2:1 dimetric camera as the world (30 degrees down).
//
//   node scripts/art/render-hero-3d.mjs <hero id>
//
// in:  art/3d/<id>/walk.glb
// out: public/assets/hero3d/hero3d_<id>.webp  8 rows (direction 0 = right, clockwise, 45 degrees apart) x 14 columns
//                                             of 112x112 px frames at 2x: the kid (1 idle + 6 walk frames), then the
//                                             same frames with ONLY the forearms and hands (drawn over the gun)
//      src/game/art/hero3d.json               where the hands meet per direction and frame, in pixels from the feet
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const id = process.argv[2];
if (!id) throw new Error('Usage: node scripts/art/render-hero-3d.mjs <hero id>');
if (!/^(tommy|sam|jess|maya|leo)(_[a-z]+)?$/.test(id)) throw new Error('Invalid character asset id');
const FRAME = 112, AX = 56, AY = 90, SCALE = 2, KID_PX = 75, DIRS = 8, WALK = 6, PER = 1 + WALK;
const SS = 3; // supersample, then downscale for clean edges
const modelDir = path.join(root, 'art/3d', id);
const glb = (await fs.readFile(path.join(modelDir, 'walk.glb')).catch(() => fs.readFile(path.join(modelDir, 'rigged.glb')))).toString('base64');

const html = `<!doctype html><html><body style="margin:0;background:transparent">
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
window.render = async (b64, o) => {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const loader = new GLTFLoader();
  const draco = new DRACOLoader(); draco.setDecoderPath('/three/examples/jsm/libs/draco/'); loader.setDRACOLoader(draco);
  loader.setMeshoptDecoder(MeshoptDecoder);
  const gltf = await new Promise((res, rej) => loader.parse(bytes.buffer, '', res, rej));
  const px = o.FRAME * o.SCALE * o.SS;
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = px;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const scene = new THREE.Scene();
  // bright and fairly flat, like the painted sprites: the game adds its own night, shadows and light pools
  scene.add(new THREE.AmbientLight(0xffffff, 2.1));
  const key = new THREE.DirectionalLight(0xfff1dd, 1.5); key.position.set(-2, 4, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc4ff, 0.7); rim.position.set(3, 2, -3); scene.add(rim);
  const pivot = new THREE.Group(); scene.add(pivot); pivot.add(gltf.scene);
  const bones = {}, meshes = [];
  gltf.scene.traverse(n => { if (n.isBone) bones[n.name] = n; if (n.isMesh) { n.frustumCulled = false; meshes.push(n); } });
  const need = ['Hips', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftToeBase', 'RightToeBase'];
  for (const n of need) if (!bones[n]) throw new Error('Rig is missing bone ' + n + ' (have: ' + Object.keys(bones).join(',') + ')');
  // forearm + hand mask: white where a vertex follows those bones, black elsewhere, with the real depth order
  const flat = new THREE.MeshBasicMaterial({ vertexColors: true }), lit = new Map();
  for (const mesh of meshes) {
    lit.set(mesh, mesh.material);
    const g = mesh.geometry, n = g.attributes.position.count, colour = new Float32Array(n * 3);
    if (mesh.isSkinnedMesh) {
      const arm = mesh.skeleton.bones.map(b => /ForeArm|Hand/.test(b.name));
      for (let v = 0; v < n; v++) {
        let w = 0;
        for (let k = 0; k < 4; k++) if (arm[g.attributes.skinIndex.getComponent(v, k)]) w += g.attributes.skinWeight.getComponent(v, k);
        colour[v * 3] = colour[v * 3 + 1] = colour[v * 3 + 2] = w > 0.5 ? 1 : 0;
      }
    }
    g.setAttribute('color', new THREE.BufferAttribute(colour, 3));
  }
  const rest = Object.values(bones).map(b => ({ b, p: b.position.clone(), q: b.quaternion.clone() }));
  const restore = () => { for (const r of rest) { r.b.position.copy(r.p); r.b.quaternion.copy(r.q); } };
  const world = b => b.getWorldPosition(new THREE.Vector3());
  pivot.updateMatrixWorld(true);
  // measure the kid in rest pose: feet on the ground, hips over the anchor
  const top = bones.head_end ? world(bones.head_end) : world(bones.Head);
  const floor = Math.min(world(bones.LeftToeBase).y, world(bones.RightToeBase).y);
  const meshBox = new THREE.Box3().setFromObject(gltf.scene);
  const ground = Math.min(floor, meshBox.min.y), height = Math.max(top.y, meshBox.max.y) - ground;
  const hips0 = world(bones.Hips);
  gltf.scene.position.sub(new THREE.Vector3(hips0.x, ground, hips0.z)); // feet at the origin
  pivot.updateMatrixWorld(true);
  const hipsRest = bones.Hips.position.clone();
  // Keep broad outfits (especially moth wings) inside every rotated frame.
  const span = meshBox.getSize(new THREE.Vector3());
  const fitted = Math.min(o.KID_PX / height, (o.FRAME - 8) / Math.hypot(span.x, span.z));
  const ppu = fitted * o.SCALE * o.SS; // pixels per world unit
  const half = px / 2 / ppu, pitch = Math.PI / 6;
  const cam = new THREE.OrthographicCamera(-half, half, half, -half, 0.01, 100);
  const up = new THREE.Vector3(0, Math.cos(pitch), -Math.sin(pitch)), back = new THREE.Vector3(0, Math.sin(pitch), Math.cos(pitch));
  // the feet (origin) sit at the frame's anchor, which is below the frame centre
  const target = up.clone().multiplyScalar((o.AY - o.FRAME / 2) * o.SCALE * o.SS / ppu);
  cam.position.copy(target).addScaledVector(back, 20); cam.up.copy(up); cam.lookAt(target); cam.updateMatrixWorld(true);
  // Rig exports sometimes contain a one-frame bind-pose clip, not a real walk.
  const mixer = new THREE.AnimationMixer(gltf.scene), clip = gltf.animations.find(c => c.duration > 0.1);
  if (clip) mixer.clipAction(clip).play();
  const aim = (bone, child, dir) => {
    const from = world(child).sub(world(bone)).normalize();
    const turn = new THREE.Quaternion().setFromUnitVectors(from, dir);
    const now = bone.getWorldQuaternion(new THREE.Quaternion()), parent = bone.parent.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(parent.invert().multiply(turn.multiply(now)));
    bone.updateMatrixWorld(true);
  };
  /** both arms straight out in front, hands together at chest height: a two-handed grip on whatever the engine draws there */
  const holdGun = (yaw) => {
    pivot.updateMatrixWorld(true);
    const fwd = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)), side = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
    const l = world(bones.LeftArm), r = world(bones.RightArm), mid = l.clone().add(r).multiplyScalar(0.5);
    const reach = (world(bones.LeftForeArm).distanceTo(l) + world(bones.LeftHand).distanceTo(world(bones.LeftForeArm))) * 0.96;
    const grip = mid.clone().addScaledVector(fwd, reach * 0.93).add(new THREE.Vector3(0, -height * 0.07, 0));
    for (const [arm, fore, hand, s] of [[bones.LeftArm, bones.LeftForeArm, bones.LeftHand, 1], [bones.RightArm, bones.RightForeArm, bones.RightHand, -1]]) {
      const to = grip.clone().addScaledVector(side, s * height * 0.035);
      aim(arm, fore, to.clone().sub(world(arm)).normalize());
      aim(fore, hand, to.clone().sub(world(fore)).normalize());
    }
    pivot.updateMatrixWorld(true);
    return world(bones.LeftHand).add(world(bones.RightHand)).multiplyScalar(0.5);
  };
  const project = v => { const p = v.clone().project(cam); return [(p.x * 0.5 + 0.5) * o.FRAME - o.AX, (1 - (p.y * 0.5 + 0.5)) * o.FRAME - o.AY]; };
  const frames = [], masks = [], hands = [];
  for (let d = 0; d < o.DIRS; d++) {
    // screen direction d*45 degrees (0 = right, 90 = down); on the ground that is twice as far along the depth axis
    const phi = d * Math.PI / 4, yaw = Math.atan2(Math.cos(phi), 2 * Math.sin(phi));
    pivot.rotation.y = yaw;
    const row = [];
    for (let f = 0; f <= o.WALK; f++) { // 0 = standing, 1..WALK = the walk cycle
      restore();
      if (f > 0 && clip) { mixer.setTime(((f - 1) / o.WALK) * clip.duration); bones.Hips.position.x = hipsRest.x; bones.Hips.position.z = hipsRest.z; }
      else if (f > 0) {
        // A deterministic in-place walk when RUN supplied a rig but no animation.
        // Restoring first prevents rotations accumulating across frames/directions.
        const phase = (f - 1) / o.WALK * Math.PI * 2;
        for (const [side, offset] of [['Left', 0], ['Right', Math.PI]]) {
          const thigh = bones[side + 'UpLeg'], shin = bones[side + 'Leg'];
          const foot = bones[side + 'Foot'];
          if (!thigh || !shin || !foot) throw new Error('Walk rig is missing ' + side + ' leg');
          thigh.rotation.x += Math.sin(phase + offset) * 0.32;
          shin.rotation.x += Math.max(0, -Math.sin(phase + offset)) * 0.45;
        }
        bones.Hips.position.y += height * 0.012 * Math.cos(phase * 2);
      }
      const grip = holdGun(yaw);
      for (const mesh of meshes) mesh.material = lit.get(mesh);
      renderer.render(scene, cam);
      frames.push(canvas.toDataURL('image/png'));
      for (const mesh of meshes) mesh.material = flat;
      renderer.render(scene, cam);
      masks.push(canvas.toDataURL('image/png'));
      row.push(project(grip));
    }
    hands.push(row);
  }
  return { frames, masks, hands, bones: Object.keys(bones).length, clip: clip ? clip.name + ' ' + clip.duration.toFixed(2) + 's' : 'local six-keyframe walk' };
};
window.ready = true;
</script></body></html>`;

const browser = await chromium.launch({ channel: 'msedge', args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const problems = [];
  page.on('pageerror', e => problems.push(e.message));
  // three.js straight from node_modules: no CDN, no dev server
  await page.route('http://hero3d.local/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({ contentType: 'text/html', body: html });
    if (!url.pathname.startsWith('/three/')) return route.fulfill({ status: 404, body: '' });
    const file = path.join(root, 'node_modules', url.pathname);
    return route.fulfill({ contentType: file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript', body: await fs.readFile(file) });
  });
  await page.goto('http://hero3d.local/');
  await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
  const out = await page.evaluate(([b, o]) => window.render(b, o), [glb, { FRAME, AX, AY, SCALE, KID_PX, DIRS, WALK, SS }]);
  if (problems.length) throw new Error(problems.join('\n'));
  const cell = FRAME * SCALE, composites = [], clear = { r: 0, g: 0, b: 0, alpha: 0 };
  const png = url => Buffer.from(url.split(',')[1], 'base64');
  for (let i = 0; i < out.frames.length; i++) {
    const d = Math.floor(i / PER), f = i % PER;
    const frame = await sharp(png(out.frames[i])).resize(cell, cell, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const mask = await sharp(png(out.masks[i])).resize(cell, cell, { kernel: 'lanczos3' }).ensureAlpha().raw().toBuffer();
    // a dark 2px rim around the whole kid, like the hand-painted sprites it stands next to
    const ink = Buffer.alloc(frame.data.length), armsOnly = Buffer.from(frame.data);
    for (let p = 0; p < frame.data.length; p += 4) {
      ink[p] = 20; ink[p + 1] = 12; ink[p + 2] = 18; ink[p + 3] = frame.data[p + 3] > 90 ? 255 : 0;
      armsOnly[p + 3] = Math.round(frame.data[p + 3] * Math.min(1, Math.max(0, (mask[p] - 96) / 64))); // white in the mask = forearm or hand
    }
    const rim = await sharp(ink, { raw: frame.info }).blur(1.6).linear([1, 1, 1, 3.2], [0, 0, 0, 0]).png().toBuffer();
    const body = await sharp({ create: { width: cell, height: cell, channels: 4, background: clear } }).composite([{ input: rim }, { input: await sharp(frame.data, { raw: frame.info }).png().toBuffer() }]).png().toBuffer();
    composites.push({ input: body, left: f * cell, top: d * cell });
    composites.push({ input: await sharp(armsOnly, { raw: frame.info }).png().toBuffer(), left: (PER + f) * cell, top: d * cell });
  }
  const target = path.join(root, 'public/assets/hero3d');
  await fs.mkdir(target, { recursive: true });
  await sharp({ create: { width: PER * 2 * cell, height: DIRS * cell, channels: 4, background: clear } }).composite(composites)
    .webp({ quality: 90, alphaQuality: 100, effort: 6 }).toFile(path.join(target, `hero3d_${id}.webp`));
  const anchors = out.hands.map(row => row.map(p => p.map(v => Math.round(v * 10) / 10)));
  await fs.writeFile(path.join(modelDir,'hands.json'), JSON.stringify(anchors) + '\n');
  if (!process.argv.includes('--defer-metadata')) {
    const handsFile = path.join(root, 'src/game/art/hero3d.json');
    const all = JSON.parse(await fs.readFile(handsFile, 'utf8').catch(() => '{}'));
    all[id] = anchors;
    await fs.writeFile(handsFile, JSON.stringify(Object.fromEntries(Object.entries(all).sort(([a], [b]) => a.localeCompare(b)))) + '\n');
  }
  console.log(`${id}: ${out.frames.length} frames (${out.bones} bones, clip ${out.clip}) -> public/assets/hero3d/hero3d_${id}.webp`);
} finally { await browser.close(); }
