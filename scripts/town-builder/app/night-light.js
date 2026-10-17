/** Night lighting shared by the town builder (preview + settings), the game export and the game.
 *  The town is washed in blue moonlight (desaturated, tinted, darkened); every light a sprite gives off is a round,
 *  feathered mask that puts the painted colour back. Settings live in the ground plan (plan.night), so both builders
 *  see the same night and the export carries it into the game. A sprite may carry its own `light` radius in metres
 *  (0 = no light) that overrides its type. */
export const NIGHT_DEFAULT=Object.freeze({
 tint:'#4656c8',strength:.7,desat:.6,dark:.3,feather:.65,warmth:.35,torch:7,glowSize:2.2,glowStrength:.95,
 types:{lamp:{r:8,i:1},porch:{r:5,i:.9},window:{r:7,i:.85},neon:{r:9,i:1},pumpkin:{r:2.6,i:.9},lantern:{r:3.2,i:.95},stand:{r:3.6,i:.85},fire:{r:4.5,i:1}},
});
export const LIGHT_TYPES=[
 {key:'lamp',label:'Street lamps',test:/^world:streetlamp$/},
 {key:'neon',label:'Neon (arcade, diner)',test:/^world:(arcade|diner)$/},
 {key:'window',label:'Shop and venue windows',test:/^(town:(bakery|barber|fish_tackle|grocery|hardware|laundromat|pharmacy|postoffice|firestation)|ref:building-(corner-shop|corner-store|grocery|church|school)|world:(video_rental|video|church|school|primary_school|snack_bar))$/},
 {key:'porch',label:'House porch lights',test:/^(world:house_\d|gen:house-|gen:back-|expansion:(cottage|dormer|duplex|victorian|ranch)-)/},
 {key:'pumpkin',label:'Jack-o-lanterns',test:/(pumpkin|ref:halloween-pumpkin-cluster)/},
 {key:'lantern',label:'Lanterns',test:/^ref:halloween-lantern$/},
 {key:'stand',label:'Stands, vending, phone booths',test:/^(world:(candy_stand|vending)|town:(phone_booth|bus_stop))$/},
 {key:'fire',label:'Fire pits',test:/^expansion:firepit$/},
];
const typeCache=new Map();
export function lightType(id){if(!typeCache.has(id))typeCache.set(id,LIGHT_TYPES.find(t=>t.test.test(id))?.key??null);return typeCache.get(id);}
export function nightSettings(plan){const n=plan?.night||{};return {...NIGHT_DEFAULT,...n,types:Object.fromEntries(Object.entries(NIGHT_DEFAULT.types).map(([k,v])=>[k,{...v,...(n.types?.[k]||{})}]))};}
/** the lights of one placed sprite, in world metres: [{x,y,r,i,type}] */
export function spriteLights(s,it,night){
 const type=s.light!=null?(lightType(s.id)??'lamp'):lightType(s.id);if(!type)return [];
 const t=night.types[type]||{r:4,i:.9},r=s.light!=null?+s.light:t.r;if(!(r>0))return [];
 const k=s.scale||1,b=it.base||{hx:it.fw||1,hy:it.fh||1,dx:0,dy:0};let hx=b.hx*k,hy=b.hy*k,dx=(b.dx||0)*k,dy=(b.dy||0)*k;if(s.flip){[hx,hy]=[hy,hx];[dx,dy]=[dy,dx];}
 // buildings shine out of their front (+Y, or +X when mirrored); everything else lights the ground it stands on
 if(type==='porch'||type==='window'||type==='neon'){const out=type==='porch'?1:1.6;
  return [s.flip?{x:s.x+dx+hx+out,y:s.y+dy,r,i:t.i,type}:{x:s.x+dx,y:s.y+dy+hy+out,r,i:t.i,type}];}
 return [{x:s.x+dx,y:s.y+dy,r,i:t.i,type}];
}
/** a white feathered disc (soft edge = feather share of the radius), cached per feather */
const discs=new Map();
export function featherDisc(feather,make){const key=Math.round(feather*100);if(discs.has(key))return discs.get(key);
 const N=256,c=make(N,N),g=c.getContext('2d'),gr=g.createRadialGradient(N/2,N/2,0,N/2,N/2,N/2),f=Math.min(.98,Math.max(.02,feather));
 gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(1-f,'rgba(255,255,255,1)');
 for(let k=1;k<=8;k++){const t=k/8;gr.addColorStop(1-f+f*t,`rgba(255,255,255,${(1-t*t*(3-2*t)).toFixed(3)})`);}// smooth fall-off
 g.fillStyle=gr;g.fillRect(0,0,N,N);discs.set(key,c);return c;}
/** Apply the night to a finished frame on `ctx` (identity transform): moonlight everywhere, painted colour back inside
 *  each light. lights: [{sx,sy,rx,ry,i}] in canvas pixels; a square light instead has `quad` (its 4 corners) and `blur`
 *  (its soft edge, px); `tint` (a colour) washes a light in that colour instead of the usual warmth; `feather` (0 hard to
 *  1 soft) gives a round light its own edge instead of the night's.
 *  scratch: {orig,mask} canvases reused between frames. The game's copy is applyNight in src/game/town-built.ts. */
export function applyNight(ctx,night,lights,scratch,make){
 const W=ctx.canvas.width,H=ctx.canvas.height;
 for(const k of ['orig','mask']){if(!scratch[k])scratch[k]=make(W,H);if(scratch[k].width!==W||scratch[k].height!==H){scratch[k].width=W;scratch[k].height=H;}}
 const o=scratch.orig.getContext('2d');o.globalCompositeOperation='copy';o.drawImage(ctx.canvas,0,0);o.globalCompositeOperation='source-over';
 ctx.save();
 ctx.globalCompositeOperation='saturation';ctx.globalAlpha=night.desat;ctx.fillStyle='#808080';ctx.fillRect(0,0,W,H);
 ctx.globalCompositeOperation='multiply';ctx.globalAlpha=night.strength;ctx.fillStyle=night.tint;ctx.fillRect(0,0,W,H);
 ctx.globalCompositeOperation='source-over';ctx.globalAlpha=night.dark;ctx.fillStyle='#03030c';ctx.fillRect(0,0,W,H);
 // the lit areas: the untouched frame through the feathered masks
 const m=scratch.mask.getContext('2d'),disc=featherDisc(night.feather,make);
 m.globalCompositeOperation='source-over';m.globalAlpha=1;m.clearRect(0,0,W,H);m.globalCompositeOperation='lighter';
 for(const l of lights){if(l.quad){if(quadOff(l.quad,W,H))continue;m.globalAlpha=Math.min(1,l.i);m.filter=`blur(${Math.max(.5,l.blur||0).toFixed(1)}px)`;m.fillStyle='#fff';quadPath(m,l.quad);m.fill();m.filter='none';continue;}
  if(l.sx+l.rx<0||l.sy+l.ry<0||l.sx-l.rx>W||l.sy-l.ry>H)continue;m.globalAlpha=Math.min(1,l.i);m.drawImage(l.feather!=null?featherDisc(l.feather,make):disc,l.sx-l.rx,l.sy-l.ry,l.rx*2,l.ry*2);}
 m.globalAlpha=1;m.globalCompositeOperation='source-in';m.drawImage(scratch.orig,0,0);
 ctx.globalAlpha=1;ctx.drawImage(scratch.mask,0,0);
 // a little warmth in the pools
 // a little warmth in the pools, or the light's own colour
 for(const op of ['soft-light','screen']){ctx.globalCompositeOperation=op;
  for(const l of lights){if(l.torch||(!l.tint&&(op==='screen'||!(night.warmth>0))))continue;
   const a=l.tint?(op==='screen'?.22:.4+night.warmth*.5)*l.i:night.warmth*l.i;ctx.globalAlpha=Math.min(1,a);
   if(l.quad){if(quadOff(l.quad,W,H))continue;ctx.filter=`blur(${Math.max(.5,l.blur||0).toFixed(1)}px)`;ctx.fillStyle=l.tint||'#ff9a40';quadPath(ctx,l.quad);ctx.fill();ctx.filter='none';continue;}
   if(l.sx+l.rx<0||l.sy+l.ry<0||l.sx-l.rx>W||l.sy-l.ry>H)continue;ctx.drawImage(l.tint?tintDisc(l.tint,make):warmDisc(make),l.sx-l.rx,l.sy-l.ry,l.rx*2,l.ry*2);}}
 ctx.restore();
}
function quadPath(g,q){g.beginPath();g.moveTo(q[0][0],q[0][1]);for(let k=1;k<q.length;k++)g.lineTo(q[k][0],q[k][1]);g.closePath();}
function quadOff(q,W,H){return q.every(p=>p[0]<0)||q.every(p=>p[1]<0)||q.every(p=>p[0]>W)||q.every(p=>p[1]>H);}
const tints=new Map();
function tintDisc(color,make){let c=tints.get(color);if(c)return c;const N=128;c=make(N,N);const g=c.getContext('2d'),gr=g.createRadialGradient(N/2,N/2,0,N/2,N/2,N/2);
 gr.addColorStop(0,color);gr.addColorStop(.6,color+'80');gr.addColorStop(1,color+'00');g.fillStyle=gr;g.fillRect(0,0,N,N);tints.set(color,c);return c;}
/** A placed object's own lights, edited in the builder (Edit its lights), in world metres; null when it still uses its
 *  type's default lights. Stored on the sprite (s.lights) relative to it, unscaled and unmirrored, so they move, scale
 *  and mirror with it: {dx,dy,r,i,type,color?,shape?,pts?} with pts as relative corners too. */
export function ownLights(s){if(!Array.isArray(s.lights))return null;const k=s.scale||1,w=([u,v])=>{const [U,V]=s.flip?[v,u]:[u,v];return [s.x+U*k,s.y+V*k];};
 return s.lights.map(l=>{const [x,y]=w([l.dx,l.dy]),o={x,y,r:l.r,i:l.i,type:l.type||'warm'};if(l.color)o.color=l.color;if(l.soft!=null)o.soft=l.soft;if(l.shape==='rect'&&l.pts){o.shape='rect';o.pts=l.pts.map(w);}return o;});}
/** the opposite of ownLights: world light spots to the relative list a sprite keeps */
export function toOwnLights(s,list){const k=s.scale||1,loc=([X,Y])=>{const U=(X-s.x)/k,V=(Y-s.y)/k;return (s.flip?[V,U]:[U,V]).map(v=>+v.toFixed(3));};
 return list.map(o=>{const [dx,dy]=loc([o.x,o.y]),l={dx,dy,r:o.r,i:o.i,type:o.type||'warm'};if(o.color)l.color=o.color;if(o.soft!=null)l.soft=o.soft;if(o.shape==='rect'){l.shape='rect';l.pts=(o.pts||spotCorners(o)).map(loc);}return l;});}
/** the four corners (world metres) of a square light spot: centre x,y, width w along X, depth h along Y, turned rot degrees */
export function spotCorners(o){const a=(o.rot||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),w=(o.w||4)/2,h=(o.h||4)/2;
 return [[-w,-h],[w,-h],[w,h],[-w,h]].map(([u,v])=>[o.x+u*c-v*s,o.y+u*s+v*c]);}
let warm=null;
function warmDisc(make){if(warm)return warm;const N=128;warm=make(N,N);const g=warm.getContext('2d'),gr=g.createRadialGradient(N/2,N/2,0,N/2,N/2,N/2);
 gr.addColorStop(0,'rgba(255,170,70,1)');gr.addColorStop(.6,'rgba(255,150,60,.5)');gr.addColorStop(1,'rgba(255,140,50,0)');g.fillStyle=gr;g.fillRect(0,0,N,N);return warm;}
/** the lit spots painted into a placed sprite (windows, lamp heads, neon, headlights), as screen circles in map pixels:
 *  left/top/scale/flip/w = how the sprite is drawn (rect() in the builder). [{x,y,r}] */
export function spriteGlows(s,it,night,left,top,w,all=false){if(!it.glows||(!all&&(s.light===0||s.glow===false||!(night.glowStrength>0))))return [];const k=s.scale||1,off=new Set(all?[]:s.glowsOff||[]);
 return it.glows.map((g,n)=>({n,x:left+(s.flip?w-g.x*k:g.x*k),y:top+g.y*k,r:g.r*k*night.glowSize})).filter(g=>!off.has(g.n));}
/** an object's painted glows switched off one by one in the builder (s.glowsOff = their numbers), or all of them */
export function glowOff(s,n){return s.light===0||s.glow===false||!!s.glowsOff?.includes(n);}
