import fs from 'node:fs/promises';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const DEFAULT_OUT = path.join(ROOT, 'output/imagegen/town-variations/2026-10-17');
export const hash = data => createHash('sha256').update(data).digest('hex');
export const slug = id => id.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() + '-' + hash(id).slice(0, 8);
export const readJson = async file => JSON.parse(await fs.readFile(file, 'utf8'));
export async function writeJson(file, value) {
  await fs.mkdir(path.dirname(file), {recursive:true});
  const temp = `${file}.${process.pid}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(temp, JSON.stringify(value, null, 2) + '\n');
  await fs.rename(temp, file);
}

export function classify(item) {
  const text = `${item.id} ${item.name}`.toLowerCase();
  if (item.category === 'Shadows') return 'shadow';
  if (item.flat) return 'decal';
  if (/shopping.cart/.test(text)) return 'cart';
  // Wrecked piles remain props. A whole vehicle, including a tractor/forklift, needs four headings.
  if (!/crushed|scrapped|scrap.*pile|carseat|car-seat|bicycle.frame/.test(text) &&
      (item.category === 'Vehicles' || /motorcycle|stationwagon|station.wagon|scrap-pickup|forklift|farm-tractor|rideon-mower|homemade-gokart|soapbox-racer|junkyard-crane|boat-trailer|pop-up-caravan|expansion:camper|kiddie-car/.test(text))) return 'vehicle';
  if (/Houses|House backs|House rear|Derelict town|Shops & services/.test(item.category) ||
      /(?:^|[:_ -])(building|house|garage|cottage|dormer|duplex|victorian|ranch|workshop|warehouse|church|school|barn|mausoleum|crypt|shed|glasshouse|greenhouse|mobile-home|outhouse|treehouse|chicken-coop|wooden-well|ivy-arbor|backyard-tent|boxcar)(?:[-_: ]|$)/.test(item.id.toLowerCase()) ||
      ['world:arcade','world:diner','world:video','world:video_rental','world:snack_bar'].includes(item.id)) return 'building';
  return 'prop';
}

export function slotsFor(kind, item) {
  if (kind === 'building') return ['One new building with a meaningfully different footprint, roofline, facade and height from the old building. Keep its role and period. Preserve any requested rear/side viewing direction.'];
  if (kind === 'vehicle') return [
    'HORIZONTAL BROADSIDE PROFILE. The vehicle length runs exactly LEFT TO RIGHT across the image, nose toward the right edge. See the full side and roof from the elevated game camera. The two visible wheels are horizontally aligned. No diagonal vehicle centreline; do not use a three-quarter corner view.',
    'VERTICAL FRONT VIEW. The vehicle length runs exactly UP AND DOWN the image, nose toward the bottom edge. Look straight at its FRONT bumper, grille, headlights and windscreen from the elevated game camera. Left and right headlights are symmetric across the vertical centreline. Roof and hood remain visible; no side or corner view.',
    'VERTICAL REAR VIEW. The vehicle length runs exactly UP AND DOWN the image, nose toward the top edge. Look straight at its REAR bumper, taillights and rear window from the elevated game camera. Left and right taillights are symmetric across the vertical centreline. Roof remains visible; no side or corner view.',
    'DIAGONAL THREE-QUARTER VIEW, nose toward lower-right, showing front and side together. This is the only diagonal corner view on the sheet. Match the original game camera.'
  ];
  if (kind === 'cart') return [
    'One upright EMPTY wire shopping cart, three-quarter front view.',
    'One empty cart fallen on its side, wheels visible; a different basket shape.',
    'THREE empty shopping carts nested together, one coherent arrangement, period wire baskets.',
    'One loaded cart with paper grocery bags and cardboard boxes, different handle colour and opposite diagonal heading.'
  ];
  if (kind === 'shadow') return ['Small irregular soft silhouette.','Longer narrower soft silhouette.','Broad asymmetrical soft silhouette.','Broken, uneven soft silhouette.'];
  const litter = /trash|rubbish|litter|junk|rubble|scrap|paper|cardboard/.test(`${item.id} ${item.name}`.toLowerCase());
  return litter ? [
    'Small compact pile, sparse contents and irregular outline.', 'Long narrow scattered pile with a different arrangement and different contents.',
    'Broader loosely spread pile, torn or tipped contents, asymmetrical silhouette.', 'Larger compact heap, visibly different contents, shape and arrangement.'
  ] : [
    'A smaller compact variation with a visibly different silhouette.', 'A taller or longer narrow variation, different proportions and details.',
    'A broader asymmetrical variation, different construction or arrangement.', 'A fourth distinct variation, different size, outline, wear and orientation.'
  ];
}

export function makePrompt(asset, withWorld) {
  const slots = asset.slots;
  return [
    'Use case: stylized-concept. Production sprite sheet for the existing Maple Falls town builder.',
    `Subject: ${asset.name}. ${asset.description || ''}`,
    'Input image 1 is the OLD ASSET: use it to identify the object, materials, period and proportions; create a new variation, not a pasted copy. Input image 2 is our ORIGINAL STYLE reference: match the fine hand-painted textured game art, rich tiny details, muted navy shading and warm amber highlights. Ignore all UI, lettering, characters and scenery in the style reference.',
    withWorld ? 'Input image 3 is the BUILT TOWN screenshot, for camera, palette, material and world-fit context ONLY. Do not reproduce the town, its background, streets, trees, ground or UI. The output is still isolated sprites with alpha transparency.' : '',
    'Era: American small town in the late 1980s / early 1990s, circa 1988-1992, autumn Halloween. Authentic worn period materials. No modern vehicles, LEDs, solar panels, smartphones, modern branding or contemporary architecture.',
    'CAMERA: exact orthographic 2:1 DIMETRIC game projection. Ground X and Y axes project at slopes +0.5 and -0.5 (26.565 degrees to horizontal). Equal axis scale; vertical edges remain vertical; parallel lines remain parallel. No perspective convergence, wide-angle lens or top-down view. The projected slopes are the governing specification; do not substitute 30-degree true isometric ground edges. Rotate objects for alternate headings, never the camera.',
    `Source footprint in builder units: ${asset.fw ?? 'unknown'} x ${asset.fh ?? 'unknown'} (one unit is 2 metres; 32 pixels per metre at game zoom 1; runtime sprite artwork stored at 2x). Vary actual shape and proportions as described, not merely canvas scale. Native high detail; do not print dimensions or scale bars.`,
    asset.kind === 'decal' ? 'GROUND DECAL: lie flat on the ground plane. Keep a low profile like the original, with tiny relief only for debris that has physical thickness. Organic irregular edges and alpha falloff for dirt, stains and paint. No rectangular ground tile, raised slab, plinth, rim walls, thick extrusion, shadow underneath or surrounding grass/road.' :
      asset.kind === 'shadow' ? 'SHADOW ONLY: semi-transparent dark navy/black alpha shapes, soft feathered edges, no visible object, no background.' :
      'Upright standalone object. Preserve visible roof/top surfaces and correct dimetric ground contact. Subtle local contact occlusion only; no long cast shadow, ground patch, floor, pedestal or surrounding scene. Keep detail readable under the builder\'s separate night-light overlay.',
    asset.kind === 'decal' && /rubbish|trash|litter|junk|cardboard|paper/.test(`${asset.id} ${asset.name}`.toLowerCase()) ?
      'DEBRIS CUTOUT: show only the rubbish itself. Alpha must remain transparent BETWEEN separate wrappers/cans and beneath the pile silhouette; do not put the debris on an opaque dirt island, soil mat, pavement patch, circular base or painted ground surface.' : '',
    slots.length === 1 ? 'LAYOUT: exactly ONE building, centred and fully visible on one square 2048 x 2048 PNG sheet. Use about 85% of the canvas; leave clear alpha margin on every side. No extra detached props or alternate buildings.' :
      'LAYOUT: exactly FOUR separate assets in a strict 2 by 2 grid on one square 2048 x 2048 PNG. Equal 1024 x 1024 cells. Reading order: top-left, top-right, bottom-left, bottom-right. Centre each asset inside its own cell; keep the whole silhouette at least 80 pixels from every cell boundary. Wide EMPTY transparent gutters. No object touching another cell; no grid lines, borders, captions or labels. Each cell should use similar pixels per metre; real size differences should remain visible.',
    asset.kind === 'vehicle' ? 'All FOUR cells show the SAME newly designed period vehicle: identical paint, model, trim, wear, load and wheelbase. Keep the CAMERA fixed at the elevated orthographic game view; rotate the vehicle on the ground plane. The vehicle does NOT have to follow the diagonal road axes: rotate it an additional 45 degrees for the required horizontal and vertical views. The four required views are BROADSIDE, FRONT-ON, REAR-ON, and ONE diagonal. Do not generate a pair of mirrored diagonal front views or a pair of mirrored diagonal rear views. Do not substitute four corner views. No cells should be simple mirrors of one another.' : '',
    ...slots.map((slot, i) => `${slots.length === 1 ? 'Building' : ['Top-left','Top-right','Bottom-left','Bottom-right'][i]}: ${slot}`),
    'DELIVERABLE: PNG with a genuinely TRANSPARENT alpha background, including all gutters. No opaque white/grey backdrop, painted checkerboard, text, watermark or scenery. Do not slice, upscale, add frames or assemble a contact sheet from existing images. Generate the requested original sheet.'
  ].filter(Boolean).join('\n\n');
}

const INDUSTRIAL = [
  ['brick-machine-shop','Brick machine shop','A squat red-brick 1980s machine shop, sawtooth roof, tall dusty steel-framed windows and one roller loading door.',10,7],
  ['corrugated-warehouse','Corrugated warehouse','A long faded blue corrugated-steel warehouse, shallow pitched roof, loading bay and small attached office.',14,8],
  ['textile-mill','Old textile mill','A narrow three-storey weathered brick textile mill, repeating sash windows, rooftop water tank and external fire escape.',10,7],
  ['cold-storage','Cold storage depot','A cream concrete-block cold-storage building, insulated loading door, roof compressors and weathered loading dock.',11,8],
  ['auto-body-shop','Auto body workshop','A wide low cinder-block auto body shop, two metal garage doors, patched corrugated roof and amber office window.',10,7],
  ['foundry','Small iron foundry','A soot-darkened brick foundry with stepped roofline, louvred vents and one brick smokestack attached to the building.',12,8],
  ['lumber-workshop','Lumber planing workshop','A timber-clad industrial planing workshop, long clerestory roof, sliding wooden loading doors and attached sawdust extraction ducts.',13,7],
  ['utility-substation','Utility control building','A compact weathered brick electrical utility control house, flat gravel roof, steel service door and ceramic wall insulators; no fenced yard.',7,5],
  ['freight-depot','Freight transfer depot','A long 1980s brick-and-metal freight depot, raised integrated loading dock, three loading doors and squat office at one end.',16,7],
  ['printing-works','Local printing works','A two-storey 1930s brick industrial building still used in 1988, tall factory windows, side delivery door and old roof ventilation cowls.',10,7],
  ['bottling-plant','Small bottling plant','A broad pale green painted concrete industrial plant with frosted high windows, stepped flat roofs and attached old pipework.',13,9],
  ['rail-repair-shed','Rail repair shed','A tall rusty corrugated-metal locomotive maintenance shed, large open-ended arched roof and side workshop wing; no tracks or yard.',15,9]
];

export async function prepare(out = DEFAULT_OUT) {
  if (existsSync(path.join(out,'manifest.json'))) throw Error('Campaign already exists. Resume it, or choose a fresh --out directory; never overwrite a running manifest.');
  const libraryFile = path.join(ROOT,'output/town-builder/library/library.json');
  const libraryBytes = await fs.readFile(libraryFile), lib = JSON.parse(libraryBytes);
  let layout = {sprites:[]};
  try { layout = await readJson(path.join(ROOT,'output/town-builder/layout.json')); } catch (e) { if(e.code !== 'ENOENT') throw e; }
  const placed = new Set(layout.sprites.map(s=>s.id));
  // Some layout versions use `item` for the library identifier.
  for (const s of layout.sprites) for (const key of ['item','type','assetId']) if (typeof s[key] === 'string') placed.add(s[key]);
  const refdir = path.join(out,'references'); await fs.mkdir(refdir,{recursive:true});
  async function snapshot(file) {
    const data = await fs.readFile(file), sha256 = hash(data);
    const rel = `references/${sha256.slice(0,20)}${path.extname(file).toLowerCase()}`;
    if(!existsSync(path.join(out,rel))) await fs.writeFile(path.join(out,rel),data);
    return {file:rel,sha256,original:path.relative(ROOT,file).replaceAll('\\','/')};
  }
  const style = await snapshot(path.join(ROOT,'art/reference/style-target.webp'));
  const world = await snapshot(path.join(ROOT,'output/town-builder/world-reference-2026-10-17.png'));
  const assets = [];
  for (const item of lib.items) {
    // Read the exact image the builder currently displays, including hand-edited versions.
    const old = await snapshot(path.join(ROOT,'output/town-builder/library',item.file));
    const kind = classify(item);
    const usefulTags = (item.tags || []).filter(t=>!['generated','RUN','Halloween','1988','2:1',item.category].includes(t));
    assets.push({id:item.id,key:slug(item.id),name:item.name,category:item.category,kind,
      fw:item.fw,fh:item.fh,old,description:usefulTags.join('; '),placed:placed.has(item.id),slots:slotsFor(kind,item)});
  }
  const industrialBase = assets.find(a=>a.id === 'expansion:abandoned-workshop') || assets.find(a=>a.kind === 'building');
  for (const [id,name,description,w,d] of INDUSTRIAL) {
    assets.push({id:`industrial:${id}`,key:slug(`industrial:${id}`),name,category:'New industrial buildings',kind:'building',
      fw:w/2,fh:d/2,old:industrialBase.old,description,placed:false,
      slots:[`Exactly one ${description} New industrial building; the old workshop is only a materials/camera reference, not a shape to duplicate.`]});
  }
  // More useful subjects first, with every library entry retained in the eventual queue.
  const rank = a => a.id.startsWith('industrial:') ? 1 : a.kind === 'cart' ? 0 :
    /rubbish|trash|litter/.test(a.id) ? 2 : a.kind === 'vehicle' ? 3 : a.placed ? 4 :
    a.category === 'Ground paint' ? 8 : a.kind === 'shadow' ? 9 : 5;
  assets.sort((a,b)=>rank(a)-rank(b)||a.id.localeCompare(b.id));
  const pilots = ['expansion:shopping-cart','gen:rubbish-bags','expansion:abandoned-workshop'];
  const jobs = [];
  for (const provider of ['codex','run']) {
    for (const id of pilots) {
      const asset = assets.find(a=>a.id===id); if(!asset) continue;
      for(const mode of ['without-world','with-world']) jobs.push({key:`pilot-${asset.key}-${mode}`,assetId:id,provider,phase:'pilot',mode});
    }
    for (const asset of assets) jobs.push({key:asset.key,assetId:asset.id,provider,phase:'production',mode:'auto'});
  }
  const manifest = {version:1,createdAt:new Date().toISOString(),librarySha256:hash(libraryBytes),
    gameId:'AFjPSjQH9kbcCl57sgO3',runModel:'gemini-3.1-flash-lite-image',runBackgroundModel:'bria',runMaxCredits:90,
    runModelsByKind:{building:'gemini-3.1-flash-image-preview',vehicle:'gemini-3.1-flash-image-preview'},
    runMaxCreditsByKind:{building:147,vehicle:147},
    codexModel:'gpt-6-luna',style,world,libraryEntries:lib.items.length,industrialExtras:INDUSTRIAL.length,assets,jobs};
  await writeJson(path.join(out,'manifest.json'),manifest);
  await writeJson(path.join(out,'reference-policy.json'),{includeWorld:false,reviewed:false,
    reason:'Conservative default until the paired screenshot experiment has been visually reviewed. Old asset and original style reference are always included.'});
  for (const dir of ['prompts','sheets','states','logs','receipts','attempts']) for (const p of ['codex','run']) await fs.mkdir(path.join(out,dir,p),{recursive:true});
  await writeJson(path.join(out,'codex-output.schema.json'),{type:'object',properties:{saved_path:{type:'string'},generated:{type:'boolean'},error:{type:'string'}},required:['saved_path','generated','error'],additionalProperties:false});
  return {libraryEntries:lib.items.length,industrialExtras:INDUSTRIAL.length,assets:assets.length,jobs:jobs.length,out};
}
