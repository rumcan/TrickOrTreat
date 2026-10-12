import {HW,HH} from '../config';
import type {PropSprite} from './props';
import {makeCanvas,projector,isoBox,poly,faceQuad,ellipse} from './draw';

export const STATIC_ART=[
 {id:'compact_e',fw:2,fh:1,height:64,kind:'car',look:'A burgundy boxy 1987 compact hatchback. Nose points along world +X, screen LOWER RIGHT. Visible nose has two rectangular headlamps; opposite end has a vertical hatch with red tail lamps.'},
 {id:'compact_w',fw:2,fh:1,height:64,kind:'car',look:'A faded sky-blue boxy 1987 compact hatchback. Nose points along world -X, screen UPPER LEFT. Camera sees the REAR HATCH at lower-right, with red tail lamps, licence plate and rear wiper, never headlamps on that visible rear.'},
 {id:'compact_s',fw:1,fh:2,height:64,kind:'car',look:'A cream boxy 1987 compact hatchback. Nose points along world +Y, screen LOWER LEFT. Visible nose has two rectangular headlamps, black bumper and grille.'},
 {id:'compact_n',fw:1,fh:2,height:64,kind:'car',look:'A dark teal boxy 1987 compact hatchback. Nose points along world -Y, screen UPPER RIGHT. Camera sees the REAR HATCH at lower-left, red tail lamps, licence plate and rear wiper. No headlamps on the visible rear.'},
 {id:'pickup_n',fw:1,fh:2.5,height:75,kind:'car',look:'A faded mustard late-1980s single-cab compact pickup truck, open empty truck bed, worn black tyres. Nose points along world -Y, screen UPPER RIGHT. Visible rear at lower-left has closed tailgate and red tail lamps. Wheels and long axis obey the guide.'},
 {id:'van_e',fw:2.5,fh:1,height:90,kind:'car',look:'A faded cream-and-blue 1980s compact delivery van, sliding side door, boxy cab, simple black bumpers, no brand logos. Nose points world +X, screen LOWER RIGHT; windshield and front headlamps visible on that end.'},
 {id:'shop_brick_rear',fw:4,fh:3,height:205,kind:'building',look:'REAR VIEW of a two-storey small-town brick Main Street shop. The storefront is on the FAR -Y side and is NOT visible. The visible +Y rear wall has a plain steel service door, small upper sash windows, boarded lower window, rain downpipe, weathered electrical meter and small vent. Flat parapet roof with air conditioner. No awning or shop sign on this rear wall. Upper-left cold moonlight; faint warm upper window only.'},
 {id:'shop_market_rear',fw:4,fh:3,height:135,kind:'building',look:'REAR VIEW of a one-storey 1980s corner grocery, pale worn brick with teal trim. Storefront is on the FAR -Y side and is NOT visible. Visible +Y rear has a wide double loading door, a small grated window, pipes and vent. Low dark flat roof. No rear awning or shop sign. No separate crates or dumpster baked into the sprite.'},
 {id:'garage_timber',fw:2,fh:2,height:88,kind:'building',look:'A small detached single-car residential garage, weathered blue-grey timber siding, dark navy pitched roof, white sectional garage door on +Y front face with four small windows, a side window, old practical porch bulb. No house attached, no car, no driveway or ground.'},
 {id:'garage_brick',fw:2,fh:2,height:88,kind:'building',look:'A small detached single-car residential garage, weathered red brick, low dark shingle pitched roof, sage green sectional garage door on +Y front face, small side window and downpipe. No house attached, no car, no driveway or ground.'},
] as const;
export type StaticArtId=typeof STATIC_ART[number]['id'];
export function staticGeometry(id:StaticArtId){
 const a=STATIC_ART.find(a=>a.id===id)!;
 const w=Math.ceil((a.fw+a.fh)*HW+64),h=Math.ceil((a.fw+a.fh)*HH+a.height+48);
 const ax=w/2,ay=h-(a.fw+a.fh)*HH/2-16;
 return {a,w,h,ax,ay,ox:ax-(a.fw-a.fh)*HW/2,oy:ay-(a.fw+a.fh)*HH/2};
}
export function staticGuide(id:StaticArtId){
 const {a,w,h,ox,oy}=staticGeometry(id),{c,ctx}=makeCanvas(w,h),P=projector(ox,oy);
 if(a.kind==='car'){
  isoBox(ctx,P,.05,.05,a.fw-.05,a.fh-.05,10,34,'#669098','#466b7a','#2f475b');
  const alongX=a.fw>a.fh;
  isoBox(ctx,P,alongX?a.fw*.28:.16,alongX?.16:a.fh*.28,alongX?a.fw*.72:a.fw-.16,alongX?a.fh-.16:a.fh*.72,34,a.height,'#446078','#21384f','#15263c');
  for(const t of [.25,.78]){const [x,y]=alongX?P(a.fw*t,a.fh,10):P(a.fw,a.fh*t,10);ellipse(ctx,x,y,9,11,'#101923');}
 }else{
  isoBox(ctx,P,0,0,a.fw,a.fh,0,a.height-18,'#293e58','#a36f51','#644f50');
  isoBox(ctx,P,0,0,a.fw,a.fh,a.height-18,a.height,'#2b3b50','#49565d','#26394b');
  poly(ctx,faceQuad(P,'L',a.fh,a.fw/2-.5,a.fw/2+.5,0,Math.min(a.height-30,68)),'#607986','#dfd4ba',2);
  if(a.height>160)for(const x of [.6,2.4])poly(ctx,faceQuad(P,'L',a.fh,x,x+.65,114,158),'#d2a168','#dfd4ba',2);
 }
 return c;
}
const loaded=new Map<StaticArtId,PropSprite>();
let loading:Promise<void>|undefined;
/** Review-only additions: do not alter the production manifest while layout is under critique. */
export function loadStaticTownArt(){
 return loading??=Promise.all(STATIC_ART.map(async a=>{
  const response=await fetch('/assets/town-static/'+a.id+'.png');
  if(!response.ok)throw Error('Missing generated static-town sprite '+a.id);
  const image=await createImageBitmap(await response.blob()),g=staticGeometry(a.id);
  if(image.width!==g.w*2||image.height!==g.h*2)throw Error('Unexpected static-town sprite dimensions '+a.id);
  loaded.set(a.id,{img:image,w:g.w,h:g.h,ax:g.ax,ay:g.ay,fw:a.fw,fh:a.fh,lights:[]});
 })).then(()=>{});
}
export function staticProp(id:StaticArtId):PropSprite{
 const p=loaded.get(id);if(!p)throw Error('Call loadStaticTownArt before building the static town');return p;
}
