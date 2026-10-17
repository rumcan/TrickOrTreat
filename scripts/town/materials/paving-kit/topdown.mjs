/** Top-down (plan view) render of the paved layer in ground metres with a labelled grid, for picking lot rectangles.
 *  node scripts/town/materials/paving-kit/topdown.mjs [x0 y0 x1 y1 pxPerM out.png] */
import path from 'node:path';
import sharp from 'sharp';
import {pavedSource,ROOT} from './source.mjs';
const src=await pavedSource();const a=process.argv.slice(2).map(Number);
const [x0,y0,x1,y1,ppm]=a.length>=5?a:[0,0,188,188,10],out=process.argv[7]||path.join(ROOT,'output/paving-kit/review/topdown.png');
const W=Math.round((x1-x0)*ppm),H=Math.round((y1-y0)*ppm),buf=Buffer.alloc(W*H*4),o=[0,0,0,0];
for(let y=0;y<H;y++)for(let x=0;x<W;x++){src.sample(x0+(x+.5)/ppm,y0+(y+.5)/ppm,o);const i=(y*W+x)*4,al=o[3]/255;
 buf[i]=o[0]*al+32*(1-al);buf[i+1]=o[1]*al+48*(1-al);buf[i+2]=o[2]*al+24*(1-al);buf[i+3]=255;}
const step=ppm>=20?2:ppm>=8?5:10;let svg=`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;
for(let m=Math.ceil(x0/step)*step;m<=x1;m+=step){const px=(m-x0)*ppm,maj=m%(step*2)===0;svg+=`<line x1="${px}" y1="0" x2="${px}" y2="${H}" stroke="${maj?'#ff3dd2aa':'#ff3dd244'}"/>`;if(maj)svg+=`<text x="${px+2}" y="11" fill="#ff9be9" font-size="11" font-family="monospace">${m}</text>`;}
for(let m=Math.ceil(y0/step)*step;m<=y1;m+=step){const py=(m-y0)*ppm,maj=m%(step*2)===0;svg+=`<line x1="0" y1="${py}" x2="${W}" y2="${py}" stroke="${maj?'#3df2ffaa':'#3df2ff44'}"/>`;if(maj)svg+=`<text x="2" y="${py-2}" fill="#9ff6ff" font-size="11" font-family="monospace">${m}</text>`;}
svg+='</svg>';
await sharp(buf,{raw:{width:W,height:H,channels:4}}).composite([{input:Buffer.from(svg)}]).png().toFile(out);
console.log(JSON.stringify({out,W,H,sourcePxPerM:+src.pxPerM.toFixed(2)}));
