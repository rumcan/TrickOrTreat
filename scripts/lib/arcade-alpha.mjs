import sharp from 'sharp';
/** Find actual transparent islands: the generator's grid is not a crop contract. */
export async function arcadeIslands(file){
 const {data,info}=await sharp(file).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const visited=new Int32Array(info.width*info.height),queue=new Int32Array(visited.length),components=[];
 let id=0;
 for(let start=0;start<visited.length;start++){
  if(visited[start]||data[start*4+3]<8)continue;
  id++;
  let head=0,tail=1,count=0,x0=info.width,y0=info.height,x1=0,y1=0;queue[0]=start;visited[start]=id;
  while(head<tail){
   const p=queue[head++],x=p%info.width,y=Math.floor(p/info.width);count++;x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);
   for(const n of [x>0?p-1:-1,x<info.width-1?p+1:-1,y>0?p-info.width:-1,y<info.height-1?p+info.width:-1])if(n>=0&&!visited[n]&&data[n*4+3]>=8){visited[n]=id;queue[tail++]=n;}
  }
  if(count>2000)components.push({x0,y0,x1,y1,count,id});
 }
 return {info,components,labels:visited,data};
}
if(process.argv.includes('--inspect')){const {info,components}=await arcadeIslands('art/arcade/furniture-atlas.png');console.log({info,components});}
