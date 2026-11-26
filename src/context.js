import { validDay } from './events.js';
import { deepFreeze } from './package.js';
export function buildContext(events,{today}) {
 if(!validDay(today)) throw new Error('Valid today required');
 const sorted=[...events].sort((a,b)=>a.seq-b.seq);
 if(new Set(sorted.map(e=>e.patient_id)).size>1) throw new Error('Mixed patients');
 const retired=new Set(sorted.map(e=>e.payload.supersedes).filter(Boolean));
 const ctx={today,weight_kg:null,pregnant:null,proposed_atc:null,proposed_tablets:null,recorded_at:{weight_kg:null,pregnant:null,proposed_atc:null,proposed_tablets:null}};
 const set=(field,value,e)=>{ctx[field]=value;ctx.recorded_at[field]=e.occurred_at;};
 for(const e of sorted) {
  if(retired.has(e.event_id)) continue;
  const p=e.payload;
  if(e.type==='observation-recorded'&&p.field==='weight_kg') set('weight_kg',p.value,e);
  if(e.type==='status-recorded'&&p.field==='pregnant') set('pregnant',p.value,e);
  if(e.type==='prescription-drafted') {set('proposed_atc',p.atc,e);set('proposed_tablets',p.tablets,e);}
 }
 return deepFreeze(ctx);
}
