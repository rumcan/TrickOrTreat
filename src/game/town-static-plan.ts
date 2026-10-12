/**
 * Maple Falls, laid out from the reference town (art/town/static/ground/trace/town-reference.png).
 * Every number here is a TILE coordinate read off that picture by scripts/town-trace.mjs (see src/game/town-trace.json
 * for the raw trace): world +X runs to the lower right of the screen, +Y to the lower left, the map is 94 x 94.
 * Streets are centre lines through traced points; they are drawn and rasterised as smooth curves (smoothStreet).
 */
export interface TownDistrict {id:string;name:string;x:number;y:number;w:number;h:number}
export const STATIC_DISTRICTS:TownDistrict[]=[
 {id:'farm',name:'Pumpkin farm',x:4,y:2,w:25,h:17},
 {id:'campus',name:'Maple Falls school',x:3,y:23,w:20,h:14},
 {id:'church-cemetery',name:"St. Hallow's & old cemetery",x:3,y:40,w:14,h:20},
 {id:'main-street',name:'Main Street, plaza & Starcade',x:20,y:23,w:30,h:34},
 {id:'park',name:'Moonlight pond & Pond Circle',x:45,y:7,w:33,h:21},
 {id:'leisure',name:'Gas station & diner',x:62,y:1,w:30,h:21},
 {id:'north-homes',name:'Orchard Lane & Hollow Street homes',x:31,y:1,w:30,h:18},
 {id:'south-homes',name:'Lantern Lane & Willow Link homes',x:50,y:29,w:42,h:49},
 {id:'drive-in',name:'Moonlite Drive-In',x:20,y:58,w:36,h:28},
];
export type Point=readonly[number,number];
export interface TownStreet {name:string;width:number;points:Point[];closed?:boolean}
export const STATIC_STREETS:TownStreet[]=[
 {name:'Farm Road',width:3,points:[[0,20.6],[8.5,20.3],[13.6,20],[18.4,19.3],[22.3,21],[25.7,20.8],[28.5,18.4],[29.2,12],[29.3,0]]},
 {name:'Orchard Lane',width:3,points:[[29.3,7.8],[36.9,7.7],[43.4,8.1],[46.7,9.7]]},
 {name:'Hollow Street',width:3,points:[[28.5,18.4],[32,20.2],[36.7,20.1],[41.5,20.2],[48.8,23.1]]},
 {name:'School Road',width:3,points:[[25.7,20.8],[24.3,28.6],[22.6,34.4],[18.6,39.3],[18.3,43],[17.7,47.3],[17.6,54],[19.8,57.3]]},
 {name:'West Road',width:3,points:[[11.4,94],[12.7,79],[13.7,72.4],[15,63.6],[17.9,60.1],[19.8,57.3],[21.8,56.6],[27.1,56.6],[33.3,56.4],[41.2,56.4],[46.2,57.3]]},
 {name:'Main Street',width:3,points:[[18.2,45.3],[21.7,47.1],[30.6,46.5],[39.6,45.9],[49.5,44.7],[54.2,44.6],[60.5,44.4],[66.7,44.2],[73.1,44],[79.2,44.1],[94,43.7]]},
 {name:'Park Road',width:3,points:[[49.5,44.7],[49.7,38.7],[49.3,30.6],[49.4,24.7],[48.8,23.1]]},
 {name:'Pond Circle',width:3,closed:true,points:[[48.8,23.1],[47.3,19],[46.1,15.5],[46,11.4],[46.7,9.7],[51.3,9],[55.5,8.5],[59.9,8.1],[64.4,7.8],[68.3,8.7],[71.7,10.6],[75,14.6],[76.9,18.8],[77,22.4],[73.4,25.2],[68.5,26.5],[62.8,27.4],[57.1,26.5],[52.5,25.1]]},
 {name:'Diner Road',width:3,points:[[77,22.5],[83.2,22.6],[94,22.4]]},
 {name:'Lantern Lane',width:3,points:[[49.5,44.7],[49.5,49.3],[48.1,54.3],[46.2,57.3],[46.1,59.5],[48.5,63.1],[52,66],[55.6,67.3],[62.6,65.1],[68.4,64.5],[73.8,61.8],[78.5,61.5],[84.6,61.7],[94,61.4]]},
 {name:'Willow Link',width:3,points:[[73.8,61.8],[73.1,54.9],[72.3,47.6],[71.2,44.1]]},
 {name:'Drive-In Road',width:3,points:[[53.5,94],[54.6,84],[55.4,76.7],[56.2,69.5],[55.6,67.3]]},
];
/** Zebra crossings: a point on a street and the direction that street runs there. */
export const STATIC_CROSSINGS:{at:Point;along:Point}[]=[
 {at:[21.6,47],along:[1,0]},{at:[47,45],along:[1,0]},{at:[52.2,44.6],along:[1,0]},{at:[49.6,42],along:[0,1]},
 {at:[49.5,47.3],along:[0,1]},{at:[49.4,25.4],along:[0,1]},{at:[46.1,59.2],along:[0,1]},{at:[76,44],along:[1,0]},
 {at:[21.3,56.8],along:[1,0]},{at:[78.5,22.5],along:[1,0]},
];

/** A street's centre line as a dense, smooth polyline (centripetal Catmull-Rom through its traced points). */
export function smoothStreet(street:{points:readonly Point[];closed?:boolean},step=.2):[number,number][]{
 const p=street.points,n=p.length,closed=!!street.closed,out:[number,number][]=[];
 const at=(i:number):Point=>closed?p[(i%n+n)%n]:p[Math.max(0,Math.min(n-1,i))];
 const knot=(t:number,a:Point,b:Point)=>t+Math.max(1e-4,Math.hypot(b[0]-a[0],b[1]-a[1]))**.5;
 for(let i=0;i<(closed?n:n-1);i++){
  const p0=at(i-1),p1=at(i),p2=at(i+1),p3=at(i+2);
  const t0=0,t1=knot(t0,p0,p1),t2=knot(t1,p1,p2),t3=knot(t2,p2,p3);
  const steps=Math.max(1,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/step));
  for(let k=0;k<steps;k++){
   const t=t1+(t2-t1)*k/steps,point=[0,0] as [number,number];
   for(const c of [0,1]){
    const a1=(t1-t)/(t1-t0)*p0[c]+(t-t0)/(t1-t0)*p1[c],a2=(t2-t)/(t2-t1)*p1[c]+(t-t1)/(t2-t1)*p2[c],a3=(t3-t)/(t3-t2)*p2[c]+(t-t2)/(t3-t2)*p3[c];
    const b1=(t2-t)/(t2-t0)*a1+(t-t0)/(t2-t0)*a2,b2=(t3-t)/(t3-t1)*a2+(t-t1)/(t3-t1)*a3;
    point[c]=(t2-t)/(t2-t1)*b1+(t-t1)/(t2-t1)*b2;
   }
   out.push(point);
  }
 }
 out.push(closed?[out[0][0],out[0][1]]:[p[n-1][0],p[n-1][1]]);
 return out;
}
