/** Four 24x24 town blocks, with shared geometry for art, navigation and tests. */
export const ARCADE_SIZE = 48;
export const ARCADE_ORIGIN = 2;
export type ArcadeKind = 'cabinet' | 'pinball' | 'skeeball' | 'airhockey' | 'foosball' | 'prizes' | 'pizza' | 'booth' | 'stage' | 'photo' | 'tokens' | 'party' | 'wall';
export interface ArcadeFixture { kind: ArcadeKind; x: number; y: number; w: number; h: number; label: string }
export const ARCADE_FIXTURES: ArcadeFixture[] = [
  { kind:'stage', x:5, y:5, w:9, h:4, label:'Midnight Matinee' },
  { kind:'skeeball', x:18, y:5, w:5, h:6, label:'Skee-ball' },
  { kind:'skeeball', x:25, y:5, w:5, h:6, label:'Skee-ball' },
  { kind:'prizes', x:34, y:5, w:10, h:3, label:'Prize counter' },
  { kind:'party', x:35, y:12, w:8, h:4, label:'Birthday clubhouse' },
  { kind:'pizza', x:39, y:23, w:7, h:3, label:'Pizza Planet' },
  { kind:'photo', x:5, y:34, w:2, h:3, label:'Photo booth' },
  { kind:'tokens', x:10, y:39, w:2, h:2, label:'Token exchange' },
  { kind:'airhockey', x:22, y:28, w:5, h:3, label:'Air hockey' },
  { kind:'foosball', x:29, y:34, w:3, h:3, label:'Foosball finals' },
];
for (const y of [16,23,35]) for (const x of [7,16,25]) {
  // Short rows have generous end gaps and four-tile cross aisles.
  for (let i=0;i<3;i++) ARCADE_FIXTURES.push({kind:y===35?'pinball':'cabinet',x:x+i*2,y,w:1.5,h:2,label:y===35?'Pinball alley':'CRT classics'});
}
for (const y of [30,37,44]) ARCADE_FIXTURES.push({kind:'booth',x:39,y,w:6,h:3,label:'Restaurant booths'});
for (let i=0;i<6;i++) {
  ARCADE_FIXTURES.push({kind:'wall',x:2+i*8,y:2,w:8,h:0.75,label:'Neon wall'});
  ARCADE_FIXTURES.push({kind:'wall',x:2,y:3+i*7.5,w:0.75,h:7.5,label:'Neon wall'});
}
export const ARCADE_ENTRY = { x:25, y:47 };
export const ARCADE_POIS = [
  {x:9,y:11,name:'Stage'}, {x:24,y:13,name:'Skee-ball'},
  {x:39,y:10,name:'Prizes'}, {x:37,y:18,name:'Party room'},
  {x:39,y:28,name:'Restaurant'}, {x:18,y:32,name:'Game floor'},
  {x:8,y:39,name:'Photo booth'}, {x:25,y:46,name:'Exit'},
];
