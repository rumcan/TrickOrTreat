/** Scale guide (owner's rule): a doorway is as tall as the Sheet Ghost's post at scale 0.98 = 158 game px (~2.1 m, so
 *  about 75 px per vertical metre). Each building's front door was measured on a ruler sheet; guideScale = 158 / door.
 *  Unmeasured buildings take their category's typical value. Props/cars already match the guide (car roof ~105 px).
 *  Trees, lamps and the bus get a modest lift so they read at real-world height next to the bigger buildings.
 *  Writes `guideScale` into library.json; the app uses it as the default brush size, presets place buildings at it. */
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ROOT} from '../lib/town-paths.mjs';
const LIB=path.join(ROOT,'output/town-builder/library/library.json');
export const DOOR_PX=158;
const MEASURED_DOOR={ // front door height in game px at scale 1 (ruler sheets in output/town-builder/review/door-*.png)
 'world:house_0':70,'world:house_1':70,'world:house_2':70,'world:house_3':70,'world:house_4':70,'world:house_5':70,
 'gen:house-l-shape':72,'gen:house-splitlevel':67,'gen:house-duplex':70,'gen:house-l-ranch':70,'gen:house-ranch-long':70,'gen:house-farmhouse-wrap':72,
 'gen:back-bbq-deck':85,'gen:back-patio-pool':78,'gen:back-screened-porch':72,'gen:back-swingset':72,'gen:back-shed-garden':72,
 'town:bakery':90,'town:grocery':75,'town:hardware':75,'town:fish_tackle':85,'town:postoffice':70,'town:pharmacy':80,'town:barber':80,'town:laundromat':80,'town:firestation':72,
 'world:church':82,'world:video_rental':95,'world:video':85,'world:school':65,'world:primary_school':70,'world:diner':57,'world:snack_bar':60,'world:arcade':80,'world:barn':72,
 'ref:building-corner-store':75,'ref:building-corner-shop':75,'ref:building-grocery':75,'ref:building-church':80,'ref:building-school':62,'ref:building-barn':72,'ref:building-barn-v2':72,
 'ref:building-farm-shed':75,'ref:building-mausoleum':80,'ref:building-gas-canopy':80,
 'static:garage_brick':80,'static:garage_brick-v2':80,'static:garage_timber':80,'static:garage_timber-v2':80,
 'static:shop_brick_rear':75,'static:shop_brick_rear-v2':75,'static:shop_market_rear':75,'static:shop_market_rear-v2':75};
const CATEGORY={'Houses':2.25,'House backs':2.1,'Shops & services':2.05,'Landmarks & venues':2.1,'House rear & side views':2.2,'Derelict town':2.2};
// expansion structures with people-sized doors (props in the same set stay at 1: they already match the guide)
const DOORED=/expansion:(mobile-home|boxcar|camper|lean-to-shed|chicken-coop|glasshouse|outhouse|treehouse|abandoned-workshop)$/;
const EXTRA=[[/^(world:tree_|ref:tree-)/,1.7],[/^world:streetlamp$/,1.25],[/^world:schoolbus$/,1.3],[/watertower|water-tower|silo|windmill/,1.6],[/drivein_screen|drive-in-screen/,1.8],[/gazebo/,1.8],[/drivein_marquee/,1.5]];
export function guideFor(it){if(MEASURED_DOOR[it.id])return +(DOOR_PX/MEASURED_DOOR[it.id]).toFixed(2);for(const [re,v] of EXTRA)if(re.test(it.id))return v;
 if(it.id.startsWith('arcade:'))return null;if(DOORED.test(it.id))return 2.2;if(CATEGORY[it.category]&&(it.fw+it.fh)>=3)return CATEGORY[it.category];return null;}
export async function applyScaleGuide(){const lib=JSON.parse(await fs.readFile(LIB,'utf8'));let n=0;for(const it of lib.items){const g=guideFor(it);if(g&&it.guideScale!==g){it.guideScale=g;n++;}else if(!g&&it.guideScale){delete it.guideScale;n++;}}
 if(n){await fs.writeFile(LIB+'.guide-pending',JSON.stringify(lib,null,1));await fs.rename(LIB+'.guide-pending',LIB);}return n;}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log('guide scales updated:',await applyScaleGuide());
