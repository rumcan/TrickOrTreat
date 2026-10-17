/** Where the town builder and the town art tools read and write.
 *  ROOT is the repo root (the main checkout when the owner runs the builder), so output/town-builder is the owner's town.
 *  TOWN_ART is the town's working art (raw generations, guides, cut sprites and their sources). It is not committed:
 *  it defaults to output/town-art/; set TOWN_ART to use another folder. */
import path from 'node:path';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const TOWN_ART=path.resolve(ROOT,process.env.TOWN_ART||'output/town-art');
/** The builder's library still records sprite sources under the old Codex worktree; map them to TOWN_ART.
 *  Until the art has been moved there, the old location is used if it still exists. */
const LEGACY_ART='.codex-session/town-worktree/art/town/';
export function artSource(source){
 const s=String(source).replace(/\\/g,'/');
 if(!s.startsWith(LEGACY_ART))return path.resolve(ROOT,s);
 const moved=path.join(TOWN_ART,s.slice(LEGACY_ART.length)),legacy=path.resolve(ROOT,s);
 return existsSync(moved)||!existsSync(legacy)?moved:legacy;
}
/** A folder of TOWN_ART, with the same fallback to the old worktree. */
export const artDir=sub=>artSource(LEGACY_ART+sub);
