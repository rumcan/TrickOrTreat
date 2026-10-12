/** Review layout: reserve the places first; connect their approaches afterwards. */
export interface TownDistrict {id:string;name:string;x:number;y:number;w:number;h:number}
export const STATIC_DISTRICTS:TownDistrict[]=[
 {id:'farm',name:'Pumpkin farm',x:5,y:5,w:23,h:20},
 {id:'campus',name:'Schools & civic campus',x:31,y:5,w:24,h:24},
 {id:'church-cemetery',name:"St. Hallow's & old cemetery",x:5,y:29,w:23,h:25},
 {id:'main-street',name:'Main Street & service alleys',x:30,y:32,w:35,h:27},
 {id:'park',name:'Moonlight pond & park',x:69,y:35,w:21,h:21},
 {id:'leisure',name:'Starcade & diner',x:75,y:57,w:16,h:10},
 {id:'north-homes',name:'Hollow Pines terraces',x:58,y:6,w:32,h:29},
 {id:'south-homes',name:'Lantern Lane & Willow Court',x:35,y:63,w:55,h:28},
 {id:'drive-in',name:'Moonlite Drive-In',x:5,y:62,w:25,h:26},
];
export type Point=readonly[number,number];
export const STATIC_STREETS:{name:string;width:number;points:Point[]}[]=[
 {name:'Farm approach',width:2,points:[[16,23],[28,23],[28,42]]},
 {name:'School arrival',width:2,points:[[28,27],[30,27],[30,12],[56,12]]},
 {name:'Hollow Pines rise',width:2,points:[[56,12],[56,19],[88,19]]},
 {name:'Hollow Pines return',width:2,points:[[56,19],[56,33],[89,33]]},
 {name:'Main Street',width:3,points:[[27,42],[65,42]]},
 {name:'Parkway',width:3,points:[[65,33],[65,60],[71,63],[73,68],[90,68]]},
 {name:'Chapel approach',width:2,points:[[14,54],[28,54],[28,42]]},
 {name:'Cinema approach',width:2,points:[[28,54],[32,58],[32,87]]},
 {name:'Lantern Lane',width:2,points:[[32,74],[71,74],[73,68]]},
 {name:'Willow Court',width:2,points:[[32,87],[73,87],[73,74],[75,76],[89,76]]},
 {name:'Willow Court spur',width:2,points:[[73,87],[78,89],[89,89]]},
];
