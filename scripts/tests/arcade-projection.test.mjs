import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge'});
try{
 const page=await browser.newPage();await page.goto(process.env.TOT_ARCADE_URL||'http://127.0.0.1:5190/');
 const checked=await page.evaluate(async()=>{
  const {getArcadeFixture,ARCADE_ART_SIZES}=await import('/src/game/art/arcade.ts');
  const {projector}=await import('/src/game/art/draw.ts');
  const {isoX,isoY}=await import('/src/game/config.ts');
  let points=0;
  for(const [kind,[fw,fh]]of Object.entries(ARCADE_ART_SIZES)){
   const sp=getArcadeFixture(kind),top=sp.ay-(fw+fh)*16,P=projector(fh*64+16,top);
   const origin={x:9.3,y:17.8};
   for(const [x,y,z]of [[0,0,0],[fw,0,0],[fw,fh,0],[0,fh,0],[fw/2,fh/2,38]]){
    const local=P(x,y,z),sx=isoX(origin.x+fw/2,origin.y+fh/2)-sp.ax+local[0],sy=isoY(origin.x+fw/2,origin.y+fh/2)-sp.ay+local[1];
    if(Math.abs(sx-isoX(origin.x+x,origin.y+y))>1e-7||Math.abs(sy-(isoY(origin.x+x,origin.y+y)-z))>1e-7)throw Error(`${kind}: sprite and world projection disagree`);
    points++;
   }
  }
  const cabinet=getArcadeFixture('cabinet'),table=getArcadeFixture('airhockey');
  if(cabinet.fw>.75||cabinet.fh>1||table.fw>2.5||table.fh>1.5)throw Error('Furniture drifted back to giant scale');
  return points;
 });
 assert.equal(checked,90);console.log(`PASS ${checked} ground/raised vertices coincide with gameplay projection; kid-relative scale is bounded.`);
}finally{await browser.close();}
