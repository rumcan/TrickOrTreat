/** Four 24x24 town blocks, with shared geometry for art, navigation and tests. */
export const ARCADE_SIZE = 48;
export const ARCADE_ORIGIN = 2;
export type ArcadeKind = 'cabinet' | 'pinball' | 'skeeball' | 'airhockey' | 'foosball' | 'prizes' | 'pizza' | 'booth' | 'stage' | 'photo' | 'tokens' | 'party' | 'wall';
export interface ArcadeFixture { kind: ArcadeKind; x: number; y: number; w: number; h: number; label: string }
export const ARCADE_FIXTURES: ArcadeFixture[] = [
  { kind:'stage', x:5, y:5, w:5, h:2.4, label:'Midnight Matinee' },
  { kind:'skeeball', x:16, y:5, w:2.1, h:2.7, label:'Skee-ball' },
  { kind:'skeeball', x:20, y:5, w:2.1, h:2.7, label:'Skee-ball' },
  { kind:'prizes', x:30, y:5, w:5, h:1.2, label:'Prize counter' },
  { kind:'party', x:39, y:9, w:3, h:1.8, label:'Birthday clubhouse' },
  { kind:'pizza', x:40, y:23, w:6, h:1.4, label:'Pizza counter' },
  { kind:'photo', x:5, y:43, w:.8, h:.7, label:'Photo booth' },
  { kind:'tokens', x:11, y:43, w:.55, h:.6, label:'Token exchange' },
  { kind:'airhockey', x:29, y:28, w:2.1, h:1.2, label:'Air hockey' },
  { kind:'airhockey', x:29, y:30.5, w:2.1, h:1.2, label:'Air hockey' },
  { kind:'foosball', x:32.7, y:28, w:1.5, h:1, label:'Foosball finals' },
];
export const ARCADE_LEFT_ROWS=[16,18.5,27,29.5,37];
export const ARCADE_LEFT_BANKS=[5,12.25];
export const ARCADE_BOOTH_ROWS=[29,31.8,34.6,37.4,40.2,43];
for (const y of ARCADE_LEFT_ROWS) for (const x of ARCADE_LEFT_BANKS) {
  for (let i=0;i<8;i++) ARCADE_FIXTURES.push({kind:y===37?'pinball':'cabinet',x:x+i*.75,y,w:y===37?.65:.55,h:y===37?1.15:.75,label:y===37?'Pinball alley':'CRT classics'});
}
for(const y of [16,18.5,35,37.5])for(let i=0;i<8;i++)ARCADE_FIXTURES.push({kind:y>=35?'pinball':'cabinet',x:29+i*.75,y,w:y>=35?.65:.55,h:y>=35?1.15:.75,label:'Retro game bay'});
for (const y of ARCADE_BOOTH_ROWS) ARCADE_FIXTURES.push({kind:'booth',x:41,y,w:2.4,h:1.3,label:'Restaurant booths'});
for (let i=0;i<6;i++) {
  ARCADE_FIXTURES.push({kind:'wall',x:2+i*8,y:2,w:8,h:0.15,label:'Neon wall'});
  ARCADE_FIXTURES.push({kind:'wall',x:2,y:3+i*7.5,w:0.15,h:7.5,label:'Neon wall'});
}
export const ARCADE_ENTRY = { x:25, y:47 };
export const ARCADE_POIS = [
  {x:7.5,y:8.2,name:'Stage'}, {x:19,y:9,name:'Skee-ball'},
  {x:32.5,y:7,name:'Prizes'}, {x:40.5,y:11.6,name:'Party room'},
  {x:43,y:25.2,name:'Restaurant'}, {x:24,y:32,name:'Game floor'},
  {x:5.4,y:44.5,name:'Photo booth'}, {x:25,y:46,name:'Exit'},
];
