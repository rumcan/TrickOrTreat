import type {TownAssetId} from './town-assets';
/** Reserved sites. Retile/relocate old scenery before placing; never stack this over the old map. */
export const TOWN_SITES:{asset:TownAssetId;x:number;y:number;role:string}[]=[
 {asset:'bakery',x:26,y:40,role:'Main Street north frontage'},
 {asset:'hardware',x:30,y:40,role:'Main Street north frontage'},
 {asset:'pharmacy',x:35,y:40,role:'Main Street north frontage'},
 {asset:'grocery',x:39,y:40,role:'Main Street north frontage'},
 {asset:'laundromat',x:51,y:40,role:'Main Street east frontage'},
 {asset:'barber',x:56,y:40,role:'Main Street east frontage'},
 {asset:'fish_tackle',x:60,y:40,role:'Main Street east frontage'},
 {asset:'firestation',x:39,y:4,role:'School/civic quarter; connect bay apron to east access lane'},
 {asset:'postoffice',x:15,y:41,role:'Historic civic edge east of the water tower'},
];
export const TOWN_CORRIDORS=[
 {name:'Main Street',x:24,y:44,w:44,h:5,type:'public'},
 {name:'North retail service lane',x:25,y:38,w:20,h:2,type:'service'},
 {name:'East retail service lane',x:50,y:38,w:17,h:2,type:'service'},
 {name:'School/civic access',x:44,y:3,w:2,h:18,type:'public'},
 {name:'Historic civic forecourt',x:14,y:44,w:6,h:2,type:'public'},
 {name:'Starcade entrance',x:49,y:30,w:7,h:3,type:'public'},
];
