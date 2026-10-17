/** pruneMaps keeps the current and previous bake, removes older ones, and never touches newer or unrelated folders.
 *  node --test scripts/town-builder/map-storage.test.mjs */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {pruneMaps} from './map-storage.mjs';

test('rebuild cleanup keeps current + previous bake only',async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'town-maps-'));
 const dirs=['map','map-before-2026-10-13T16-02-08-755Z','map-staging-2026-10-14T07-57-56-158Z','map-version-2026-10-14T09-43-51-722Z',
  'map-version-2026-10-14T21-24-13-217Z','map-version-2026-10-15T19-11-06-356Z','map-version-2026-10-16T08-00-00-000Z','maps','plans','library'];
 for(const d of dirs){await fs.mkdir(path.join(data,d,'tiles'),{recursive:true});await fs.writeFile(path.join(data,d,'tiles','a'),'x');}
 await fs.writeFile(path.join(data,'map-current.json'),JSON.stringify({directory:'map-version-2026-10-15T19-11-06-356Z',previous:'map-version-2026-10-14T21-24-13-217Z'}));
 try{
  assert.deepEqual((await pruneMaps(data)).sort(),['map','map-before-2026-10-13T16-02-08-755Z','map-staging-2026-10-14T07-57-56-158Z','map-version-2026-10-14T09-43-51-722Z']);
  assert.deepEqual((await fs.readdir(data)).sort(),['library','map-current.json','map-version-2026-10-14T21-24-13-217Z','map-version-2026-10-15T19-11-06-356Z',
   'map-version-2026-10-16T08-00-00-000Z','maps','plans']);
  assert.deepEqual(await pruneMaps(data),[],'a second run removes nothing');
 }finally{await fs.rm(data,{recursive:true,force:true});}
});
