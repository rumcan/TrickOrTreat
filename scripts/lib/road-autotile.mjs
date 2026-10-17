/** Ground-coordinate geometry only. All visible paving is sampled painted PNG art. */
export const ROAD = Object.freeze({cellM:16,asphaltM:6.5,sidewalkM:1.8,slabM:1,pxPerAxisM:32,width:1024,height:512,sourceCanvas:1254,sourceLeft:115,sourceTop:371,socketDepthM:2});
export const PORTS = Object.freeze([
 {name:'N',bit:1,dx:0,dy:-1,opposite:4,x:8,y:0},
 {name:'E',bit:2,dx:1,dy:0,opposite:8,x:16,y:8},
 {name:'S',bit:4,dx:0,dy:1,opposite:1,x:8,y:16},
 {name:'W',bit:8,dx:-1,dy:0,opposite:2,x:0,y:8},
]);
export const mod=(n,d)=>((n%d)+d)%d;
export function project(x,y){return {x:512+(x-y)*32,y:(x+y)*16};}
export function unproject(x,y){const a=(x-512)/32,b=y/16;return {x:(a+b)/2,y:(b-a)/2};}
export function maskFor(cells,x,y){return PORTS.reduce((m,p)=>m|(cells.has(`${x+p.dx},${y+p.dy}`)?p.bit:0),0);}
export function kind(mask){const n=PORTS.filter(p=>mask&p.bit).length;if(!n)return 'isolated';if(n===1)return 'end';if(n===2)return mask===5||mask===10?'straight':'curve';return n===3?'tee':'cross';}
function segment(x,y,a,b){const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy),t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(len*len))),px=a.x+t*dx,py=a.y+t*dy,tx=dx/len,ty=dy/len;return {distance:Math.hypot(x-px,y-py),signed:(x-px)*-ty+(y-py)*tx,s:t*len,tx,ty};}
function turnPoint(x,y,turns){for(let i=0;i<turns;i++){[x,y]=[16-y,x];}return {x,y};}
function quarter(x,y,turns){
 // Canonical N -> E, then turn in the GROUND plane, never rotate an isometric PNG.
 const p=turnPoint(x,y,mod(-turns,4));
 const angle=Math.max(Math.PI/2,Math.min(Math.PI,Math.atan2(Math.max(0,p.y-1),p.x-15)));
 const q={x:15+7*Math.cos(angle),y:1+7*Math.sin(angle)},tx=Math.sin(angle),ty=-Math.cos(angle);
 const a=turnPoint(q.x,q.y,turns),b=turnPoint(q.x+tx,q.y+ty,turns);
 const arc={distance:Math.hypot(x-a.x,y-a.y),signed:(x-a.x)*-(b.y-a.y)+(y-a.y)*(b.x-a.x),s:1+7*(Math.PI-angle),tx:b.x-a.x,ty:b.y-a.y};
 const n0=turnPoint(8,0,turns),n1=turnPoint(8,1,turns),e0=turnPoint(15,8,turns),e1=turnPoint(16,8,turns);
 const stemN=segment(x,y,n0,n1),stemE=segment(x,y,e0,e1);stemE.s+=1+7*Math.PI/2;
 return [arc,stemN,stemE].reduce((a,b)=>a.distance<b.distance?a:b);
}
export function closest(mask,x,y){
 if(kind(mask)==='curve')return quarter(x,y,({3:0,6:1,12:2,9:3})[mask]);
 if(mask===10)return segment(x,y,{x:0,y:8},{x:16,y:8});
 if(mask===5)return segment(x,y,{x:8,y:0},{x:8,y:16});
 const arms=PORTS.filter(p=>mask&p.bit).map(p=>segment(x,y,{x:8,y:8},p));
 if(!arms.length)return {distance:Math.hypot(x-8,y-8),signed:0,s:0,tx:1,ty:0};
 return arms.reduce((a,b)=>a.distance<b.distance?a:b);
}
export function socket(mask,x,y){
 const half=ROAD.asphaltM/2+ROAD.sidewalkM;
 for(const p of PORTS){if(!(mask&p.bit))continue;const edge=p.name==='N'?y:p.name==='S'?16-y:p.name==='W'?x:16-x,cross=p.name==='N'||p.name==='S'?x-8:y-8;
  if(edge>=0&&edge<ROAD.socketDepthM&&Math.abs(cross)<=half)return {port:p.name,edge,cross,along:p.name==='N'||p.name==='S'?y:x,signed:p.name==='N'||p.name==='S'?8-x:y-8};
 }
 return null;
}
export function surface(mask,x,y){
 const c=closest(mask,x,y),half=ROAD.asphaltM/2,outer=half+ROAD.sidewalkM;
 return {...c,type:c.distance<half?'asphalt':c.distance<outer?'sidewalk':'grass'};
}
export function tilesFor(cells){return [...cells].map(k=>{const [x,y]=k.split(',').map(Number);return {x,y,mask:maskFor(cells,x,y)};}).sort((a,b)=>(a.x+a.y)-(b.x+b.y)||a.x-b.x);}
