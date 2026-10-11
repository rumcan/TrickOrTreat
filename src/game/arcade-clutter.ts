import {ARCADE_LEFT_ROWS,ARCADE_LEFT_BANKS,ARCADE_BOOTH_ROWS} from './arcade-layout';
export const CLUTTER_KINDS = ['bigfoot','robot','poster','jukebox','gumball','vhs','chair','plant','popcorn','soda','pizza_box','tickets','snack_pile','party_pile','paper_pile','arcade_junk'] as const;
export type ClutterKind=typeof CLUTTER_KINDS[number];
export const CLUTTER_SIZES:Record<ClutterKind,[number,number]>={
 bigfoot:[.85,.8],robot:[.85,.8],poster:[1,.15],jukebox:[.7,.5],gumball:[.3,.3],vhs:[1,.4],chair:[.5,.4],plant:[.4,.4],
 popcorn:[1,1],soda:[1,1],pizza_box:[1,1],tickets:[1,1],snack_pile:[1,1],party_pile:[1,1],paper_pile:[1,1],arcade_junk:[1,1],
};
export const SMALL_FLOOR_CLUTTER=['popcorn','soda','pizza_box','tickets'] as const;
export const PILE_CLUTTER=['snack_pile','party_pile','paper_pile','arcade_junk'] as const;
export const FLOOR_CLUTTER=[...SMALL_FLOOR_CLUTTER,...PILE_CLUTTER] as const;
// Shallow floor overlays, never furniture or collision. Old chair art stays archived, not placed.
export const ARCADE_PILES=[
 {x:6,y:8},{x:15,y:8},{x:26,y:7},{x:30,y:11},
 {x:5,y:10},{x:13,y:10},{x:22,y:10},{x:21,y:15},
 {x:6,y:16},{x:14,y:16},{x:24,y:17},{x:30,y:17},
 {x:5,y:19},{x:12,y:19},{x:15,y:25},{x:22,y:23},
 {x:5,y:25},{x:14,y:27},{x:22,y:30},{x:30,y:23},
 {x:5,y:28},{x:12,y:30},{x:25,y:31},{x:30,y:31},
];
export const ARCADE_DECOR:{kind:ClutterKind;x:number;y:number;solid?:boolean}[]=[
 {kind:'bigfoot',x:20,y:8,solid:true},{kind:'robot',x:21.5,y:8,solid:true},
 {kind:'jukebox',x:24,y:18,solid:true},{kind:'vhs',x:23,y:8,solid:true},
 {kind:'gumball',x:19,y:16.5},{kind:'gumball',x:11,y:8},
];
for(const x of [4,10,16,24,31])ARCADE_DECOR.push({kind:'poster',x,y:3.1});
for(const y of [8,16,24,30])for(const x of [3.3,31.8])ARCADE_DECOR.push({kind:'plant',x,y});
for(const y of ARCADE_LEFT_ROWS)for(const x of ARCADE_LEFT_BANKS)ARCADE_DECOR.push({kind:'plant',x:x+6.15,y:y+.05});
for(const y of ARCADE_BOOTH_ROWS)ARCADE_DECOR.push({kind:'plant',x:26,y:y+.4});
for(const y of ARCADE_LEFT_ROWS)for(const x of ARCADE_LEFT_BANKS)ARCADE_DECOR.push({kind:'plant',x:x-.55,y:y+.05});
for(const y of [11,11.75,26,27.15])for(const x of [19.4,26.15])ARCADE_DECOR.push({kind:'plant',x,y:y+.05});
for(const x of [15,19])ARCADE_DECOR.push({kind:'plant',x,y:30.7});
for(const y of [12,23,29])ARCADE_DECOR.push({kind:'vhs',x:24,y},{kind:'poster',x:31,y});
