// Examples use the same materials and renderer as the finished town.
export const surfaces = {
 asphalt: {name:'Car park',detail:'Worn asphalt',hint:'Parking areas and forecourts.'},
 slab: {name:'Plaza',detail:'Paving slabs',hint:'A paved square or building entrance.'},
 dirt: {name:'Dirt yard',detail:'Bare earth',hint:'Yards, empty plots and service areas.'},
 field: {name:'Sports field',detail:'Grass with markings',hint:'An open field for sports.'},
 paving: {name:'Footpath',detail:'Paving slabs',hint:'Widen a sidewalk or connect two places.'}
};
export const edges = {
 ring: {name:'Sidewalk + curb',hint:'A walkable strip around the outside.'},
 curb: {name:'Curb only',hint:'A narrow raised rim.'},
 none: {name:'No border',hint:'The surface meets the ground directly.'}
};
export function surfaceChoices(value,id,patch=false){
 const list=patch?['paving']:Object.keys(surfaces).filter(k=>id==='lotSurf'||k!=='paving');
 return `<div class="visual-choices surfaces" role="group" aria-label="${id==='lotSurf'?'New item surface':'Selected item surface'}">${list.map(k=>`<button type="button" data-surface="${k}" class="visual-choice ${k===value?'on':''}" aria-pressed="${k===value}" title="${surfaces[k].hint}"><img src="/app/examples/${k}.webp" alt="${surfaces[k].detail} example"><span>${surfaces[k].name}</span></button>`).join('')}</div>${patch?'':`<label class="field-label" for="${id}">Surface<select id="${id}">${list.map(k=>`<option value="${k}" ${k===value?'selected':''}>${surfaces[k].name} (${surfaces[k].detail.toLowerCase()})</option>`).join('')}</select></label>`}`;
}
export function edgeChoices(value,id,patch=false,surface='asphalt'){
 const list=Object.keys(edges).filter(k=>!patch||k!=='ring');
 return `<div class="visual-choices edges" role="group" aria-label="${id==='lotEdge'?'New item border':'Selected item border'}">${list.map(k=>`<button type="button" data-edge="${k}" class="visual-choice ${k===value?'on':''}" aria-pressed="${k===value}" title="${edges[k].hint}"><img src="/app/examples/${patch?'paving':'edge-'+surface}-${k}.webp" alt="${edges[k].name} example"><span>${edges[k].name}</span></button>`).join('')}</div><label class="field-label" for="${id}">Border<select id="${id}">${list.map(k=>`<option value="${k}" ${k===value?'selected':''}>${edges[k].name}</option>`).join('')}</select></label>`;
}
export function gesture(kind){
 const shape=kind==='brush'?'<path d="M40 70 Q50 22 80 48 T145 54" fill="none" stroke="#5fd1ff" stroke-width="28" stroke-linecap="round" opacity=".4"/><circle cx="145" cy="54" r="14" stroke="#5fd1ff" fill="none"/>':'<path d="M26 58 88 26 160 62 98 94Z" fill="#5fd1ff22" stroke="#5fd1ff" stroke-width="2"/>';
 const detail=kind==='select'?'<path d="m90 50 18 12-11 3-4 13Z" fill="#ffc66e"/><path d="M26 58h9m-5-5v10M155 62h10m-5-5v10" stroke="#ffc66e" stroke-width="3"/>':kind==='brush'?'':'<circle cx="26" cy="58" r="4" fill="#ffc66e"/><path d="M38 59 145 62m-8-6 8 6-8 6" stroke="#ffc66e" fill="none" stroke-width="2"/>';
 return `<svg class="gesture" viewBox="0 0 186 118" role="img" aria-label="${kind==='select'?'Click a shape, drag it to move, or drag a corner to resize':kind==='brush'?'Drag the round brush to grow a shape':'Press, drag diagonally, and release to draw a rectangle'}">${shape}${detail}<text x="93" y="113" text-anchor="middle" fill="#acb9c1" font-size="11">${kind==='select'?'Click · move · resize':kind==='brush'?'Drag to paint':'Press → drag → release'}</text></svg>`;
}
