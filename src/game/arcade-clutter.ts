import {ARCADE_LEFT_ROWS,ARCADE_LEFT_BANKS,ARCADE_BOOTH_ROWS} from './arcade-layout';
export const CLUTTER_KINDS = ['bigfoot','robot','poster','jukebox','gumball','vhs','chair','plant','popcorn','soda','pizza_box','tickets','snack_pile','party_pile','paper_pile','arcade_junk'] as const;
export type ClutterKind = typeof CLUTTER_KINDS[number];
export const CLUTTER_SIZES: Record<ClutterKind,[number,number]> = {
 bigfoot:[.85,.8],robot:[.85,.8],poster:[1,.15],jukebox:[.7,.5],gumball:[.3,.3],vhs:[1,.4],chair:[.5,.4],plant:[.4,.4],
 popcorn:[1,1],soda:[1,1],pizza_box:[1,1],tickets:[1,1],
 snack_pile:[1,1],party_pile:[1,1],paper_pile:[1,1],arcade_junk:[1,1],
};
export const SMALL_FLOOR_CLUTTER = ['popcorn','soda','pizza_box','tickets'] as const;
export const PILE_CLUTTER = ['snack_pile','party_pile','paper_pile','arcade_junk'] as const;
export const FLOOR_CLUTTER = [...SMALL_FLOOR_CLUTTER,...PILE_CLUTTER] as const;
// Large walk-over piles: no props, walls or collision. Leave main cross aisles open.
export const ARCADE_PILES = [
 {x:8,y:10},{x:17,y:10},{x:31,y:9},{x:41,y:13},
 {x:6,y:15},{x:15,y:15},{x:31,y:15},{x:33,y:21},
 {x:7,y:22},{x:16,y:23},{x:35,y:25},{x:43,y:26},
 {x:6,y:26},{x:14,y:26},{x:16,y:32},{x:33,y:33},
 {x:7,y:36},{x:16,y:36},{x:32,y:40},{x:44,y:39},
 {x:7,y:42},{x:17,y:43},{x:33,y:43},{x:43,y:46},
];
export const ARCADE_DECOR: {kind:ClutterKind;x:number;y:number;solid?:boolean}[] = [
 {kind:'bigfoot',x:35,y:11,solid:true},{kind:'robot',x:36.5,y:11,solid:true},
 {kind:'jukebox',x:38,y:27,solid:true},{kind:'vhs',x:38,y:12,solid:true},
 {kind:'gumball',x:35,y:22},{kind:'gumball',x:14,y:12},
 {kind:'chair',x:36,y:18},{kind:'chair',x:42,y:17},
];
for(const x of [5,10,15,31,45])ARCADE_DECOR.push({kind:'poster',x,y:3.1});
for(const y of [11,19,27,35,43])for(const x of [3.3,47])ARCADE_DECOR.push({kind:'plant',x,y});
for(const y of ARCADE_LEFT_ROWS)for(const x of ARCADE_LEFT_BANKS){
 ARCADE_DECOR.push({kind:'chair',x:x+6.15,y:y+.8});
 ARCADE_DECOR.push({kind:'plant',x:x+6.15,y:y+.05});
}
for(const y of ARCADE_BOOTH_ROWS)ARCADE_DECOR.push({kind:'chair',x:43.8,y:y+.6},{kind:'plant',x:40,y:y+.4});
for(const y of [14,26,34,42])ARCADE_DECOR.push({kind:'vhs',x:37,y},{kind:'poster',x:46,y});
