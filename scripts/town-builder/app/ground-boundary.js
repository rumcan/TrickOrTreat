// World-aligned terrain bounds, shared by the editor and ground baker.
export function groundBounds(plan){
 if(plan.groundBounds)return plan.groundBounds;
 // Preserve the FULL original editor grid, including its negative-coordinate cells.
 const S=32,M=60,W=(plan.nx+plan.ny)*20*S+2*M,H=(plan.nx+plan.ny)*10*S+2*M+200,ox=plan.ny*20*S+M,oy=M+200;
 const corners=[[0,0],[W,0],[0,H],[W,H]].map(([x,y])=>{const a=(x-ox)/S,b=(y-oy)/(S/2);return [(a+b)/2,(b-a)/2];});
 return {x0:Math.floor(Math.min(...corners.map(p=>p[0]))/20)*20,y0:Math.floor(Math.min(...corners.map(p=>p[1]))/20)*20,
  x1:(Math.floor(Math.max(...corners.map(p=>p[0]))/20)+1)*20,y1:(Math.floor(Math.max(...corners.map(p=>p[1]))/20)+1)*20};
}
export function groundCorners(plan){if(plan.groundShape!=='isometric')return null;const b=groundBounds(plan);return [[b.x0,b.y0],[b.x1,b.y0],[b.x1,b.y1],[b.x0,b.y1]];}
export function groundContains(plan,x,y){if(plan.groundShape!=='isometric')return true;const b=groundBounds(plan);return x>=b.x0&&y>=b.y0&&x<b.x1&&y<b.y1;}
export function groundGrid(plan){const b=groundBounds(plan),cx0=Math.floor(b.x0/20),cy0=Math.floor(b.y0/20),cx1=Math.ceil(b.x1/20)-1,cy1=Math.ceil(b.y1/20)-1;return {cx0,cy0,cx1,cy1,has:(cx,cy)=>cx>=cx0&&cy>=cy0&&cx<=cx1&&cy<=cy1};}
export function groundFrame(plan,zoom=1){const scale=32*zoom,margin=Math.round(60*zoom),head=Math.round(200*zoom);
 if(plan.groundShape!=='isometric')return {W:Math.round((plan.nx+plan.ny)*20*scale)+2*margin,H:Math.round((plan.nx+plan.ny)*10*scale)+2*margin+head,OX:plan.ny*20*scale+margin,OY:margin+head};
 const b=groundBounds(plan),extent=b.x1-b.x0+b.y1-b.y0;return {W:Math.round(extent*scale)+2*margin,H:Math.round(extent*scale/2)+2*margin+head,
  OX:margin-(b.x0-b.y1)*scale,OY:margin+head-(b.x0+b.y0)*scale/2};
}
export function clipGround(ctx,plan,project){const corners=groundCorners(plan);if(!corners)return;ctx.beginPath();corners.forEach(([x,y],i)=>{const p=project(x,y);if(i)ctx.lineTo(...p);else ctx.moveTo(...p);});ctx.closePath();ctx.clip();}
