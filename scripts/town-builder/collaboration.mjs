import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {mergeTown,normalizeTown,diffTown} from './app/town-merge.js';
export const isLocal=req=>['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
export class TownCollaboration{
 static async open(options){const c=new TownCollaboration(options);try{Object.assign(c.settings,JSON.parse(await fs.readFile(c.settingsFile,'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}return c;}
 constructor({data,port,read,write}){
  this.data=data;this.port=port;this.readFile=read;this.writeFile=write;this.settingsFile=path.join(data,'sharing.json');
  this.settings={enabled:false,key:crypto.randomBytes(16).toString('base64url'),nextUid:1_000_000};
  this.sessions=new Map();this.streams=new Map();this.revision=0;this.kindRevision={};this.queue=Promise.resolve();
 }
 serial(fn){const p=this.queue.then(fn);this.queue=p.catch(()=>{});return p;}
 async persist(){await fs.mkdir(this.data,{recursive:true});const temp=this.settingsFile+'.saving';await fs.writeFile(temp,JSON.stringify(this.settings));await fs.rename(temp,this.settingsFile);}
 host(){return this.settings.enabled?'0.0.0.0':'127.0.0.1';}
 authorized(req){if(isLocal(req))return true;const cookie=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('town-join='));return this.settings.enabled&&cookie?.slice(10)===this.settings.key;}
 status(local=true){const links=[],networks=Object.entries(os.networkInterfaces()).sort(([a],[b])=>Number(/vethernet|virtual|vmware|docker|wsl/i.test(a))-Number(/vethernet|virtual|vmware|docker|wsl/i.test(b)));if(local&&this.settings.enabled)for(const [,addresses] of networks)for(const a of addresses||[])if(!a.internal&&a.family==='IPv4')links.push(`http://${a.address}:${this.port}/join/${this.settings.key}`);
  return {enabled:this.settings.enabled,owner:local,links};}
 async enable(enabled){return this.serial(async()=>{this.settings.enabled=!!enabled;if(!enabled)this.settings.key=crypto.randomBytes(16).toString('base64url');await this.persist();this.broadcast({type:'sharing',sharing:this.status(false)});return this.status();});}
 async read(kind){return normalizeTown(kind,await this.readFile(kind));}
 async session(name){return this.serial(async()=>{
  const layout=await this.read('layout'),maximum=(layout.sprites||[]).reduce((n,o)=>Math.max(n,Number(o.uid)||0),0);
  const start=Math.max(this.settings.nextUid,maximum+1);this.settings.nextUid=start+1_000_000;await this.persist();
  const id=crypto.randomBytes(8).toString('hex'),user={id,name:String(name||'').trim().slice(0,32)||'Builder '+(this.sessions.size+1),start,end:start+1_000_000,lastSeen:Date.now(),cursor:null};this.sessions.set(id,user);
  return {id,name:user.name,start,end:user.end,sharing:this.status()};
 });}
 users(){return [...this.sessions.values()].filter(s=>this.streams.has(s.id)).map(({id,name,cursor})=>({id,name,cursor}));}
 broadcast(event,except){const message='data: '+JSON.stringify(event)+'\n\n';for(const [id,res] of this.streams)if(id!==except)res.write(message);}
 /** a document together with the revision it is at, so a client can follow later deltas */
 async readWithRevision(kind){return this.serial(async()=>({document:await this.read(kind),revision:this.kindRevision[kind]||0}));}
 presence(id,change){const user=this.sessions.get(id);if(!user)return false;user.lastSeen=Date.now();if(typeof change.name==='string')user.name=change.name.trim().slice(0,32)||user.name;
  if(Number.isFinite(change.x)&&Number.isFinite(change.y))user.cursor={x:change.x,y:change.y,tool:String(change.tool||'').slice(0,20)};
  this.broadcast({type:'presence',users:this.users()});return true;
 }
 stream(id,req,res){if(!this.sessions.has(id)){res.writeHead(409);res.end('Session expired; reload the builder');return;}
  this.streams.get(id)?.end();res.writeHead(200,{'content-type':'text/event-stream','cache-control':'no-cache','connection':'keep-alive'});res.write(': connected\n\n');this.streams.set(id,res);
  this.broadcast({type:'presence',users:this.users()});const timer=setInterval(()=>res.write(': heartbeat\n\n'),15000);
  res.on('close',()=>{clearInterval(timer);if(this.streams.get(id)===res)this.streams.delete(id);this.broadcast({type:'presence',users:this.users()});});
 }
 async save(kind,payload){return this.serial(async()=>{
  const valid=doc=>doc&&typeof doc==='object'&&Array.isArray(doc[kind==='layout'?'sprites':'roads'])&&['lots','paving','reflections'].every(k=>doc[k]===undefined||Array.isArray(doc[k]));
  if(!valid(payload)||payload.collaboration&&!valid(payload.collaboration.base))return {status:400,error:'Invalid town document'};
  const entries=kind==='layout'?payload.sprites:['lots','paving','reflections'].flatMap(k=>payload[k]||[]);
  if(entries.some(o=>!o||typeof o!=='object')||kind==='layout'&&entries.some(o=>!Number.isSafeInteger(o.uid)||o.uid<1))return {status:400,error:'Invalid object identity'};
  for(const list of kind==='layout'?[payload.sprites]:['lots','paving','reflections'].map(k=>payload[k]||[])){const ids=list.map(o=>kind==='layout'?o.uid:o.id).filter(v=>v!=null);if(new Set(ids).size!==ids.length)return {status:400,error:'Duplicate object identity'};}
  const {collaboration,...desired}=payload,current=await this.read(kind);
  if(this.settings.enabled&&!collaboration)return {status:409,error:'This town is shared. Reload the builder before editing.',document:current};
  let document=desired,actor='Local builder';
  if(collaboration){const user=this.sessions.get(collaboration.session);if(!user)return {status:409,error:'Your editing session expired. Reload the builder.',document:current};
   const merged=mergeTown(kind,normalizeTown(kind,collaboration.base),normalizeTown(kind,desired),current);
   if(merged.conflicts.length)return {status:409,error:'Another builder changed the same item.',conflicts:merged.conflicts,document:current};
   document=merged.value;actor=user.name;
  }
  if(kind==='layout'){if(!Array.isArray(document.sprites))throw Error('layout.sprites missing');document.savedAt=new Date().toISOString();}
  else if(!Array.isArray(document.roads))throw Error('plan.roads missing');
  document=normalizeTown(kind,document);await this.writeFile(kind,document);
  // send only what changed: every client applies it to the document at `prev`; a client that is not there fetches the whole document
  const prev=this.kindRevision[kind]||0,delta=diffTown(kind,current,document);this.revision++;this.kindRevision[kind]=this.revision;
  this.broadcast({type:'delta',kind,delta,prev,revision:this.revision,actor,session:collaboration?.session},collaboration?.session);
  const result={status:200,ok:true,revision:this.revision,prev,savedAt:document.savedAt,count:document.sprites?.length};
  return collaboration&&collaboration.rev===prev?{...result,delta}:{...result,document};
 });}
}
