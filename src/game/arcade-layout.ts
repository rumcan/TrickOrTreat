/** Compact 32x32 Starcade: shared geometry for art, navigation and tests. */
export const ARCADE_SIZE = 32;
export const ARCADE_ORIGIN = 2;
export type ArcadeKind = 'cabinet' | 'cabinet_retro' | 'cabinet_racer' | 'cabinet_back' | 'cabinet_back_alt' | 'pinball' | 'pinball_back' | 'skeeball' | 'airhockey' | 'foosball' | 'prizes' | 'pizza' | 'booth' | 'stage' | 'photo' | 'tokens' | 'party' | 'wall';
export interface ArcadeFixture { kind: ArcadeKind; x: number; y: number; w: number; h: number; label: string }
export const ARCADE_FIXTURES: ArcadeFixture[] = [
 {kind:'stage',x:4,y:4,w:5,h:2.4,label:'Midnight Matinee'},
 {kind:'skeeball',x:14,y:4,w:2.1,h:2.7,label:'Skee-ball'},
 {kind:'skeeball',x:17,y:4,w:2.1,h:2.7,label:'Skee-ball'},
 {kind:'prizes',x:24,y:4,w:5,h:1.2,label:'Prize counter'},
 {kind:'party',x:25,y:9,w:3,h:1.8,label:'Birthday clubhouse'},
 {kind:'pizza',x:25,y:14,w:6,h:1.4,label:'Pizza counter'},
 {kind:'photo',x:4,y:29,w:.8,h:.7,label:'Photo booth'},
 {kind:'tokens',x:8,y:29,w:.55,h:.6,label:'Token exchange'},
 {kind:'airhockey',x:19,y:18,w:2.1,h:1.2,label:'Air hockey'},
 {kind:'airhockey',x:19,y:20.5,w:2.1,h:1.2,label:'Air hockey'},
 {kind:'foosball',x:22.7,y:18,w:1.5,h:1,label:'Foosball finals'},
];
// Cabinets stand back to back: a row seen from behind (it faces north) with a row seen from the front right against
// it, so both sides of a block of machines can be played and the aisles between blocks stay wide.
export const ARCADE_LEFT_ROWS=[11,11.75,20,20.75,22.5];
export const ARCADE_LEFT_BANKS=[4,11];
export const ARCADE_BOOTH_ROWS=[18,20.6,23.2,25.8,28.4];
for(const y of ARCADE_LEFT_ROWS)for(const x of ARCADE_LEFT_BANKS)for(let i=0;i<8;i++){
 const pin=y===22.5,back=y===11||y===20;
 const designs:ArcadeKind[]=back?['cabinet_back','cabinet_back_alt']:['cabinet','cabinet_retro','cabinet_racer'];
 ARCADE_FIXTURES.push({kind:pin?'pinball':designs[(i+(x===11?1:0))%designs.length],x:x+i*.75,y,w:pin?.65:.55,h:pin?1.15:.75,label:pin?'Pinball alley':'CRT classics'});
}
for(const y of [11,11.75,26,27.15])for(let i=0;i<8;i++){
 const pin=y>=26,back=y===11||y===26;
 const designs:ArcadeKind[]=back?['cabinet_back_alt','cabinet_back']:['cabinet_racer','cabinet','cabinet_retro'];
 ARCADE_FIXTURES.push({kind:pin?(back?'pinball_back':'pinball'):designs[i%designs.length],x:20+i*.75,y,w:pin?.65:.55,h:pin?1.15:.75,label:'Retro game bay'});
}
for(const y of ARCADE_BOOTH_ROWS)ARCADE_FIXTURES.push({kind:'booth',x:27,y,w:2.4,h:1.3,label:'Restaurant booths'});
for(let i=0;i<4;i++){
 ARCADE_FIXTURES.push({kind:'wall',x:2+i*8,y:2,w:8,h:.15,label:'Neon wall'});
 ARCADE_FIXTURES.push({kind:'wall',x:2,y:3+i*7.5,w:.15,h:7.5,label:'Neon wall'});
}
export const ARCADE_ENTRY={x:17,y:31};
export const ARCADE_STAFF=[
 {hero:3,x:26,y:16.6,cost:1000,activity:'Repairing a walkie-talkie'},
 {hero:4,x:29,y:16.6,cost:1000,activity:'Reading a monster comic'},
] as const;
export const ARCADE_POIS=[
 {x:6.5,y:7.2,name:'Stage'},{x:16,y:8,name:'Skee-ball'},
 {x:26.5,y:6,name:'Prizes'},{x:26.5,y:11.6,name:'Party room'},
 {x:28,y:16.2,name:'Concessions'},{x:17.5,y:18,name:'Game floor'},
 {x:4.4,y:30.5,name:'Photo booth'},{x:17,y:30,name:'Exit'},
];
