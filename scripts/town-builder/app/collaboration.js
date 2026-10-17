import {mergeTown,diffTown,applyDelta,emptyDelta} from './town-merge.js';
const clone=v=>structuredClone(v),$=s=>document.querySelector(s);
async function api(url,method='GET',body){const r=await fetch(url,{method,cache:'no-store',headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});const j=await r.json().catch(()=>({error:'Connection lost. Your edits are still in this browser.'}));if(!r.ok){const e=Error(j.error||'Connection lost');e.status=r.status;e.result=j;throw e;}return j;}
/** Each save sends its confirmed starting point. Independent changes merge on the host. */
export class SharedTown{
 constructor({get,apply,rebase,busy,lease,peers,notify}){Object.assign(this,{get,apply,rebase,busy,lease,peers,notify});this.base={};this.pending={};this.inbox={layout:[],plan:[]};this.revisions={};this.queue=Promise.resolve();this.users=[];this.lastCursor=0;}
 async start(documents){this.base=clone(documents);await this.newSession();this.connect();this.wireShare();this.timer=setInterval(()=>this.drain(),200);window.__townSharing=this;}
 serial(fn){const p=this.queue.then(fn);this.queue=p.catch(()=>{});return p;}
 async newSession(){let name='';try{name=localStorage.getItem('mf-builder-name')||'';}catch{}this.session=await api('/api/session','POST',{name});this.lease(this.session.start);this.sharing=this.session.sharing;this.revisions={};}
 connect(){this.events?.close();this.events=new EventSource('/api/events?session='+this.session.id);
  this.events.onopen=()=>{this.connected=true;this.updateStatus();this.serial(()=>Promise.all(['layout','plan'].map(kind=>this.fetchFull(kind)))).catch(e=>this.notify(e.message));};
  this.events.onerror=()=>{this.connected=false;this.updateStatus();if(!this.recovering)this.recoverSession().catch(e=>this.notify(e.message));};
  this.events.onmessage=e=>{const event=JSON.parse(e.data);
   if(event.type==='delta'&&event.session!==this.session.id)this.inbox[event.kind].push(event);
   if(event.type==='presence'){this.users=event.users;this.peers(this.users.filter(p=>p.id!==this.session.id));this.updateStatus();}
   if(event.type==='sharing'){this.sharing={...this.sharing,enabled:event.sharing.enabled};this.updateStatus();}
  };
 }
 async recoverSession(){this.recovering=true;try{await api('/api/presence','POST',{session:this.session.id});}catch(e){if(e.status===409){await this.newSession();this.connect();}else this.notify('Disconnected. Your edits remain here; keep this tab open.');}finally{this.recovering=false;}}
 async idle(){while(this.busy())await new Promise(r=>setTimeout(r,100));}
 /** the whole document and its revision (on connect, or when a delta arrives for a revision this browser never saw) */
 async fetchFull(kind){const r=await api('/api/'+kind+'?rev=1');this.pending[kind]={document:r.document,revision:r.revision};}
 drain(){if(this.busy()||this.draining)return;if(!this.inbox.layout.length&&!this.inbox.plan.length&&!this.pending.layout&&!this.pending.plan)return;this.draining=true;this.serial(async()=>{for(const kind of ['layout','plan']){
   const full=this.pending[kind];if(full){delete this.pending[kind];if(!(full.revision<=(this.revisions[kind]??-1))){await this.receive(kind,full.document);this.revisions[kind]=full.revision;}}
   while(this.inbox[kind].length){const ev=this.inbox[kind][0],at=this.revisions[kind]??-1;if(ev.revision<=at){this.inbox[kind].shift();continue;}
    if(ev.prev!==at){await this.fetchFull(kind);break;}// missed one: catch up from the whole document, then continue with later deltas
    this.inbox[kind].shift();await this.receive(kind,applyDelta(kind,this.base[kind],ev.delta),ev.delta);this.revisions[kind]=ev.revision;}
  }}).catch(e=>this.notify(e.message)).finally(()=>this.draining=false);}
 async receive(kind,remote,delta){await this.idle();const before=this.base[kind],local=this.get(kind),merged=mergeTown(kind,before,local,remote);
  const prefer=merged.conflicts.length?await this.choose(merged.conflicts):false;delta??=diffTown(kind,before,remote);
  if(!emptyDelta(kind,delta))this.rebase(kind,delta.before,delta.after);this.base[kind]=clone(remote);this.apply(kind,prefer?mergeTown(kind,before,this.get(kind),remote,true).value:merged.value);
 }
 save(kind){return this.serial(async()=>{for(let attempt=0;attempt<10;attempt++){
  // send only the objects that changed since the last confirmed version, not the whole town
  await this.idle();const sent=clone(this.get(kind)),change=diffTown(kind,this.base[kind],sent);if(emptyDelta(kind,change))return {ok:true,unchanged:true};let result;
  try{result=await api('/api/'+kind,'PUT',{...change.after,collaboration:{session:this.session.id,base:change.before,rev:this.revisions[kind]??-1}});}catch(e){
   if(e.status===409&&e.result.document&&e.result.conflicts){await this.receive(kind,e.result.document);continue;}
   if(e.status===409&&e.result.document){await this.newSession();this.connect();await this.receive(kind,e.result.document);continue;}
   throw e;
  }
  await this.idle();const remote=result.delta?applyDelta(kind,this.base[kind],result.delta):result.document,others=diffTown(kind,sent,remote);
  this.base[kind]=remote;this.revisions[kind]=result.revision;if(this.pending[kind]?.revision<=result.revision)delete this.pending[kind];
  if(emptyDelta(kind,others))return result;// nobody else changed anything: the town on screen is already right
  const local=this.get(kind),merged=mergeTown(kind,sent,local,remote);const prefer=merged.conflicts.length?await this.choose(merged.conflicts):false;
  this.rebase(kind,others.before,others.after);this.apply(kind,prefer?mergeTown(kind,sent,this.get(kind),remote,true).value:merged.value);return result;
 }throw Error('This item is changing frequently. Try saving again.');});}
 choose(conflicts){const dialog=$('#conflictDialog');$('#conflictDetails').textContent=conflicts.slice(0,5).map(c=>c.item+' · '+c.field).join('\n');dialog.showModal();return new Promise(resolve=>{const finish=prefer=>{dialog.close();resolve(prefer);};$('#keepMine').onclick=()=>finish(true);$('#useTheirs').onclick=()=>finish(false);dialog.oncancel=e=>e.preventDefault();});}
 cursor(x,y,tool){if(Date.now()-this.lastCursor<250||!this.connected||!this.users||this.users.length<2)return;if(this.lastXY&&Math.abs(this.lastXY[0]-x)<2&&Math.abs(this.lastXY[1]-y)<2&&this.lastXY[2]===tool)return;this.lastXY=[x,y,tool];this.lastCursor=Date.now();api('/api/presence','POST',{session:this.session.id,x,y,tool}).catch(()=>{});}
 updateStatus(){const count=this.users.length;$('#onlineState').textContent=!this.connected?'Reconnecting…':this.sharing?.enabled?`${Math.max(1,count)} building together`:'Local town';$('#onlineState').classList.toggle('err',!this.connected);}
 wireShare(){const dialog=$('#shareDialog');$('#shareBtn').onclick=async()=>{try{this.sharing=await api('/api/share');this.renderShare();dialog.showModal();}catch(e){this.notify(e.message);}};$('#shareClose').onclick=()=>dialog.close();
  $('#sharingToggle').onclick=async()=>{const b=$('#sharingToggle');b.disabled=true;try{this.sharing=await api('/api/share','POST',{enabled:!this.sharing.enabled});this.renderShare();this.updateStatus();}catch(e){this.notify(e.message);}finally{b.disabled=false;}};
  $('#builderName').onchange=async e=>{const name=e.target.value.trim().slice(0,32);try{localStorage.setItem('mf-builder-name',name);}catch{}try{await api('/api/presence','POST',{session:this.session.id,name});this.session.name=name;}catch(e){this.notify(e.message);}};
 }
 renderShare(){const s=this.sharing;$('#builderName').value=this.session.name;$('#sharingToggle').hidden=!s.owner;$('#sharingToggle').textContent=s.enabled?'Stop sharing':'Start sharing on this network';
  $('#shareExplanation').textContent=s.enabled?'Send an invitation to someone on the same Wi-Fi or wired network. Keep this computer and the builder running. Both of you can build, move and delete items. Changes save automatically.':'Start sharing, then send the invitation link to another person on your network.';
  const links=$('#shareLinks');links.replaceChildren();let more;for(const [i,url] of (s.links||[]).entries()){const row=document.createElement('div'),input=document.createElement('input'),button=document.createElement('button');input.value=url;input.readOnly=true;input.setAttribute('aria-label','Invitation link');button.textContent='Copy link';button.onclick=async()=>{input.select();try{await navigator.clipboard.writeText(url);button.textContent='Copied';}catch{document.execCommand('copy');button.textContent='Copied';}};row.className='share-link';row.append(input,button);if(i===0)links.append(row);else{if(!more){more=document.createElement('details');const label=document.createElement('summary');label.textContent='Other network addresses';more.append(label);links.append(more);}more.append(row);}}
  if(s.enabled&&s.owner&&!s.links.length)links.textContent='No network address found. Connect this computer to your Wi-Fi or wired network.';
 }
}
