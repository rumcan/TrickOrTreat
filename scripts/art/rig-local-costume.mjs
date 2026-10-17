import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

// Transfer the same kid's existing rig onto a new A-pose costume mesh.
// No external rigging service or runtime Three.js dependency is required.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const id = process.argv[2];
const owners = { maya_knight: 'maya', leo_moth: 'leo' };
if (!owners[id]) throw new Error('Usage: node scripts/art/rig-local-costume.mjs maya_knight|leo_moth');
const source = await fs.readFile(path.join(root, 'art/3d', owners[id], 'walk.glb'));
const selfTest = process.argv.includes('--self-test');
const model = selfTest ? source : await fs.readFile(path.join(root, 'art/3d', id, 'model.glb'));
const html = `<!doctype html><html><body>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
<script type="module">
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
window.rig = async (base, costume) => {
  const loader = new GLTFLoader(), draco = new DRACOLoader();
  draco.setDecoderPath('/three/examples/jsm/libs/draco/');
  loader.setDRACOLoader(draco); loader.setMeshoptDecoder(MeshoptDecoder);
  const parse = b64 => new Promise((resolve, reject) => loader.parse(Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer, '', resolve, reject));
  const original = await parse(base), generated = await parse(costume);
  original.scene.updateMatrixWorld(true); generated.scene.updateMatrixWorld(true);
  const oldMeshes = [], newMeshes = [];
  original.scene.traverse(n => { if (n.isSkinnedMesh) oldMeshes.push(n); });
  generated.scene.traverse(n => { if (n.isMesh) newMeshes.push(n); });
  if (!oldMeshes.length || !newMeshes.length) throw new Error('Missing rig or generated mesh');
  const sourceSkeleton = oldMeshes[0].skeleton;
  if (oldMeshes.some(m => m.skeleton.bones.some((b, i) => b !== sourceSkeleton.bones[i]))) throw new Error('Multiple incompatible skeletons');
  // New geometry is baked to world space, unlike the original mesh's bind
  // space. Reusing its inverse-bind matrices would deform the costume at rest.
  const skeleton = new T.Skeleton(sourceSkeleton.bones);
  skeleton.calculateInverses();
  const targetBox = new T.Box3().setFromObject(original.scene), sourceBox = new T.Box3().setFromObject(generated.scene);
  const height = targetBox.max.y - targetBox.min.y, ratio = height / (sourceBox.max.y - sourceBox.min.y);
  if (!Number.isFinite(ratio) || ratio <= 0) throw new Error('Invalid mesh bounds');
  const targetCenter = targetBox.getCenter(new T.Vector3()), sourceCenter = sourceBox.getCenter(new T.Vector3());
  const samples = [], point = new T.Vector3();
  const sampleStride = Math.max(1, Math.ceil(oldMeshes.reduce((n,m)=>n+m.geometry.attributes.position.count,0) / 40000));
  for (const mesh of oldMeshes) {
    const g = mesh.geometry;
    for (let i = 0; i < g.attributes.position.count; i += sampleStride) {
      mesh.getVertexPosition(i, point); point.applyMatrix4(mesh.matrixWorld);
      samples.push({ p: point.toArray(), indices: [0,1,2,3].map(k => g.attributes.skinIndex.getComponent(i,k)), weights: [0,1,2,3].map(k => g.attributes.skinWeight.getComponent(i,k)) });
    }
  }
  // Balanced k-d tree avoids a quadratic nearest-vertex scan on high-res meshes.
  const tree = (points, depth = 0) => {
    if (!points.length) return null;
    const axis = depth % 3; points.sort((a,b) => a.p[axis] - b.p[axis]);
    const mid = Math.floor(points.length / 2);
    const node = { sample: points[mid], axis, left: tree(points.slice(0,mid), depth+1), right: tree(points.slice(mid+1),depth+1), min: [...points[mid].p], max: [...points[mid].p] };
    for (const child of [node.left,node.right]) if (child) for (let k=0;k<3;k++) {
      node.min[k]=Math.min(node.min[k],child.min[k]); node.max[k]=Math.max(node.max[k],child.max[k]);
    }
    return node;
  };
  const index = tree(samples);
  const nearest = p => {
    const best = [];
    const visit = node => {
      if (!node) return;
      if (best.length === 4) {
        let lower = 0;
        for (let k=0;k<3;k++) { const gap = Math.max(node.min[k]-p[k],p[k]-node.max[k],0); lower += gap*gap; }
        if (lower >= best[3].d) return;
      }
      const q = node.sample.p, d = (p[0]-q[0])**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2;
      if (best.length < 4 || d < best[best.length-1].d) {
        best.push({ sample: node.sample, d }); best.sort((a,b) => a.d-b.d); if (best.length > 4) best.pop();
      }
      const delta = p[node.axis]-q[node.axis];
      visit(delta < 0 ? node.left : node.right);
      if (best.length < 4 || delta*delta <= best[best.length-1].d) visit(delta < 0 ? node.right : node.left);
    };
    visit(index); return best;
  };
  const rootInverse = original.scene.matrixWorld.clone().invert();
  let vertices = 0;
  for (const mesh of newMeshes) {
    let geometry = mesh.geometry.clone();
    // Remove tiny disconnected reconstruction islands, not whole costume parts.
    // Weld only for connectivity; retain the original UV seams in the output.
    const input = geometry.attributes.position, parents = new Int32Array(input.count), weld = new Map();
    const quantum = Math.max(sourceBox.max.y-sourceBox.min.y,1e-6)*1e-5;
    const find = i => { while (parents[i] !== i) { parents[i]=parents[parents[i]]; i=parents[i]; } return i; };
    for (let i=0;i<input.count;i++) {
      parents[i]=i;
      const key=[input.getX(i),input.getY(i),input.getZ(i)].map(v=>Math.round(v/quantum)).join(',');
      if (weld.has(key)) parents[i]=find(weld.get(key)); else weld.set(key,i);
    }
    const triangles = geometry.index ? Array.from(geometry.index.array) : Array.from({length:input.count},(_,i)=>i);
    for (let i=0;i<triangles.length;i+=3) {
      const root=find(triangles[i]); parents[find(triangles[i+1])]=root; parents[find(triangles[i+2])]=root;
    }
    const counts = new Map();
    for (let i=0;i<triangles.length;i+=3) { const r=find(triangles[i]); counts.set(r,(counts.get(r)||0)+1); }
    const largest = Math.max(...counts.values()), threshold=Math.max(12,largest*(window.costumeId === 'maya_knight' ? 0.05 : 0.025)), kept=[];
    for (let i=0;i<triangles.length;i+=3) if (counts.get(find(triangles[i])) >= threshold) kept.push(...triangles.slice(i,i+3));
    geometry.setIndex(kept); geometry=geometry.toNonIndexed();
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      // Local GLB exports omit metallicFactor, whose glTF default is 1.
      // These are cardboard/cloth, not metal: match the existing matte kid art.
      material.metalness=0; material.roughness=0.9; material.needsUpdate=true;
    }
    geometry.applyMatrix4(mesh.matrixWorld);
    const positions = geometry.attributes.position, skinIndex = new Uint16Array(positions.count * 4), skinWeight = new Float32Array(positions.count * 4);
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions,i).sub(sourceCenter).multiplyScalar(ratio).add(targetCenter);
      const weights = new Map();
      for (const { sample, d } of nearest(point.toArray())) {
        const proximity = 1 / Math.max(d, height*height*1e-8);
        for (let k=0;k<4;k++) weights.set(sample.indices[k], (weights.get(sample.indices[k]) || 0) + sample.weights[k]*proximity);
      }
      const ranked = [...weights].sort((a,b)=>b[1]-a[1]).slice(0,4), total = ranked.reduce((s,x)=>s+x[1],0);
      if (!total) throw new Error('Vertex has no skin influence');
      ranked.forEach(([bone,w],k)=>{ skinIndex[i*4+k]=bone; skinWeight[i*4+k]=w/total; });
      point.applyMatrix4(rootInverse); positions.setXYZ(i,point.x,point.y,point.z);
    }
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(skinIndex,4));
    geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(skinWeight,4));
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    const skinned = new T.SkinnedMesh(geometry,mesh.material); skinned.name = 'held_costume_' + vertices;
    original.scene.add(skinned); original.scene.updateMatrixWorld(true);
    skinned.bind(skeleton, skinned.matrixWorld.clone()); vertices += positions.count;
  }
  for (const mesh of oldMeshes) mesh.removeFromParent();
  const exporter = new GLTFExporter();
  const buffer = await exporter.parseAsync(original.scene, { binary:true, animations:original.animations, onlyVisible:false, maxTextureSize:2048 });
  let binary = ''; const bytes = new Uint8Array(buffer);
  for (let i=0;i<bytes.length;i+=32768) binary += String.fromCharCode(...bytes.subarray(i,i+32768));
  return { base64:btoa(binary), vertices, bones:skeleton.bones.length, animations:original.animations.length };
};
window.ready = true;
</script></body></html>`;
const browser = await chromium.launch({ channel:'msedge', args:['--use-angle=swiftshader','--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage();
  await page.route('http://local-rig/**', async route => {
    const url = new URL(route.request().url());
    if (url.pathname === '/') return route.fulfill({contentType:'text/html',body:html});
    if (!url.pathname.startsWith('/three/') || url.pathname.includes('..')) return route.fulfill({status:404,body:''});
    const file = path.join(root,'node_modules',url.pathname);
    return route.fulfill({contentType:file.endsWith('.wasm')?'application/wasm':'text/javascript',body:await fs.readFile(file)});
  });
  await page.goto('http://local-rig/'); await page.waitForFunction(()=>window.ready);
  const output = await page.evaluate(([s,m,id])=>{ window.costumeId=id; return window.rig(s,m); },[source.toString('base64'),model.toString('base64'),id]);
  if (!selfTest) await fs.writeFile(path.join(root,'art/3d',id,'walk.glb'),Buffer.from(output.base64,'base64'));
  console.log(JSON.stringify({id,selfTest,vertices:output.vertices,bones:output.bones,animations:output.animations}));
} finally { await browser.close(); }
