import { G, getTile, TILE_VARIANTS, getCurb, getFringe, getRoadLine, getCrosswalk } from './art/tiles';
import {
  getHouse, HOUSE_COUNT, getTree, getBush, getHedge, getFence, getGrave, getCrypt, getPumpkin, getLamp, getMailbox, getTrash, getHydrant, getCar, getShop, getVending, getHayScarecrow,
  getSchool, getArcade, getDiner, getVideoStore, getWaterTower, getGate, getBleachers, getGoalPosts, getScoreboard,
  getPrimarySchool, getDriveInScreen, getSpeakerPost, getSnackBar, getMarquee, getChurch, getVideoRental,
  getJungleGym, getSwings, getMerryGoRound, getSchoolBus, getBarn, getGazebo, getBench, getTurretSheet,
} from './art/props';
import { heroSheet, enemySheet, ENEMY_TYPES, HEROES, COSTUME_ART_IDS } from './art/characters';
import { weaponIcon, pickupIcon, treatIcon, TREAT_ICON_IDS, WEAPON_ICON_IDS, PICKUP_IDS } from './art/fx';
import { treatArt, TREAT_ART_IDS } from './art/treats';
import { loadOverrides } from './assets';

const nextFrame = () => new Promise<void>((r) => setTimeout(r, 0));

let booting: Promise<void> | null = null;
/** Loads PNG overrides then generates every procedural asset (so the atlas & first frame are ready). Runs once. */
export function preloadAll(progress: (p: number, label: string) => void) {
  return (booting ??= boot(progress));
}
async function boot(progress: (p: number, label: string) => void) {
  progress(0.02, 'Unpacking the candy…');
  await loadOverrides();
  const jobs: [string, () => void][] = [];
  for (const g of [G.GRASS, G.ROAD, G.SIDEWALK, G.DIRT, G.GRAVEL, G.DARKGRASS, G.DRIVEWAY, G.FLAGSTONE, G.FIELD])
    for (let v = 0; v < TILE_VARIANTS(g); v++) jobs.push(['Painting ground tiles', () => getTile(g, v)]);
  for (let e = 0; e < 4; e++) jobs.push(['Pouring curbs', () => { getCurb(e); getFringe(e); getRoadLine(e); }]);
  jobs.push(['Painting crosswalks', () => { getCrosswalk('x'); getCrosswalk('y'); }]);
  for (let v = 0; v < HOUSE_COUNT; v++) jobs.push(['Building houses', () => { getHouse(v, false); getHouse(v, true); }]);
  for (let v = 0; v < 3; v++) jobs.push(['Growing trees', () => { getTree('oak', v); getTree('dead', v); getTree('pine', v); getBush(v); getGrave(v); }]);
  jobs.push(['Raising fences', () => { getHedge(); getFence('picket', 'x'); getFence('picket', 'y'); getFence('iron', 'x'); getFence('iron', 'y'); }]);
  jobs.push(['Carving pumpkins', () => { getPumpkin(0); getPumpkin(1); getCrypt(); getLamp(); getMailbox(); getTrash(); getHydrant(); getShop(); getVending(); getHayScarecrow(); }]);
  for (let v = 0; v < 4; v++) jobs.push(['Parking cars', () => { getCar(v, false); getCar(v, true); }]);
  // district landmarks (built here rather than on the first map build, so starting a run doesn't hitch)
  for (const f of [getSchool, getArcade, getDiner, getVideoStore, getWaterTower]) jobs.push(['Opening the town', () => { f(); }]);
  for (const f of [getPrimarySchool, getDriveInScreen, getSpeakerPost, getSnackBar, getMarquee, getChurch, getVideoRental, getSwings, getMerryGoRound, getBarn, getGazebo, getBench, getTurretSheet]) jobs.push(['Preparing the expanded town', () => { f(); }]);
  jobs.push(['Opening the playground', () => { getJungleGym(0); getJungleGym(1); getSchoolBus(false); }]);
  jobs.push(['Closing the roads', () => { getGate(); getBleachers(); getGoalPosts(); getScoreboard(); }]);
  HEROES.forEach((_, i) => jobs.push(['Dressing kids', () => heroSheet(i)]));
  HEROES.forEach((_, i) => COSTUME_ART_IDS.forEach((c) => jobs.push(['Sewing costumes', () => heroSheet(i, c)])));
  for (const t of ENEMY_TYPES) jobs.push(['Summoning monsters', () => enemySheet(t)]);
  jobs.push(['Loading toy guns', () => { WEAPON_ICON_IDS.forEach(weaponIcon); PICKUP_IDS.forEach(pickupIcon); }]);
  jobs.push(['Packing friend treats', () => TREAT_ICON_IDS.forEach(treatIcon)]);
  for (let i = 0; i < TREAT_ART_IDS.length; i += 8) jobs.push(['Rewinding the VHS tapes', () => TREAT_ART_IDS.slice(i, i + 8).forEach(treatArt)]);
  for (let i = 0; i < jobs.length; i++) {
    progress(0.05 + (0.95 * i) / jobs.length, jobs[i][0] + '…');
    jobs[i][1]();
    if (i % 3 === 0) await nextFrame();
  }
  progress(1, 'Ready');
}
