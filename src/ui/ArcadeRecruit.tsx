import {Game} from '../game/engine';
import {HERO_INFO} from '../game/data';
import {PORTRAITS} from './art';
export function ArcadeRecruit({game,onDone}:{game:Game;onDone:()=>void}){
 const staff=game.hiringStaff;if(!staff)return null;
 const kid=HERO_INFO[staff.hero],afford=game.p.coins>=staff.cost;
 const close=()=>{game.closeHire();onDone();};
 return <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/65 p-3 cursor-auto" role="dialog" aria-modal="true" aria-label={`Recruit ${kid.name}`}>
  <section className="w-full max-w-lg max-h-[90dvh] overflow-y-auto border border-[#ffad45]/60 bg-[#111e25] p-5 sm:p-7 text-white shadow-2xl">
   <p className="text-xs tracking-[.16em] text-[#ffb958] uppercase">Starcade · after-hours crew · game paused</p>
   <div className="my-5 flex gap-5 items-center"><img src={PORTRAITS[staff.hero]} alt={kid.name} className="w-24 h-32 object-cover border border-[#ffad45]/40"/><div><h2 className="text-3xl font-cond text-[#ffb958]">{kid.name}</h2><p className="mt-2 text-sm text-[#e0e8e8]">{staff.activity}</p></div></div>
   <blockquote className="text-lg leading-relaxed">{staff.hero===3?'“Trick-or-treating? We’re a little old for that. Cover my shift and I’ll bring my tools.”':'“I don’t do hide-and-seek anymore. But for a few coins, I’ll help you find the others.”'}</blockquote>
   <p className="mt-4 text-sm leading-relaxed text-[#d5e7e5]">Fights alongside your whole team, follows you between the arcade and streets, shares weapon upgrades and can revive you. For this run only.</p>
   <div className="mt-5 border-t border-white/15 pt-4 flex flex-wrap gap-3 items-center justify-between"><span>{game.p.coins} coins in your pocket</span><strong className="text-[#ffcf74]">Cost: {staff.cost} coins</strong></div>
   {!afford&&<p className="mt-3 text-[#ffd597]" role="status">Earn {staff.cost-game.p.coins} more coins, then come back.</p>}
   <button type="button" className="hm-btn mt-5 w-full min-h-12" disabled={!afford} onClick={()=>{game.hireStaff();onDone();}}>Recruit {kid.name} · {staff.cost} coins</button>
   <button type="button" className="mt-3 w-full min-h-11 border border-white/30 text-white hover:bg-white/10" onClick={close}>Not now · back to the arcade</button>
  </section>
 </div>;
}
