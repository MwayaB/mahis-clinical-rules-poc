import { triageEntry } from './plausibility.js';
import { defaultTerminology } from './terminology.js';
import { validDay } from './events.js';
import { deepFreeze } from './package.js';
export function buildContext(events,{today,terminologyVersion=defaultTerminology.terminology_version}) {
 if(!validDay(today)) throw new Error('Valid today required');
 const sorted=[...events].sort((a,b)=>a.seq-b.seq);
 if(new Set(sorted.map(e=>e.patient_id)).size>1) throw new Error('Mixed patients');
 const retired=new Set(sorted.map(e=>e.payload.supersedes).filter(Boolean));
 const ctx={today,terminology_version:terminologyVersion,terminology_changed:false,sex:null,age_years:null,active_diagnoses:[],weight_kg:null,pregnant:null,proposed_atc:null,proposed_tablets:null,recorded_at:{weight_kg:null,pregnant:null,proposed_atc:null,proposed_tablets:null}};
 const set=(field,value,e)=>{ctx[field]=value;ctx.recorded_at[field]=e.occurred_at;};
 for(const e of sorted) {
  if(retired.has(e.event_id)) continue;
  const p=e.payload;
  if(e.type==='diagnosis-recorded'&&['confirmed','presumptive'].includes(p.certainty)) ctx.active_diagnoses.push({icd10:p.icd10,certainty:p.certainty,terminology_version:p.terminology_version??null});
  if(e.type==='patient-registered') {ctx.sex=p.sex;ctx.age_years=p.age_years??null;}
  if(e.type==='observation-recorded'&&p.field==='weight_kg') set('weight_kg',p.value,e);
  if(e.type==='status-recorded'&&p.field==='pregnant') set('pregnant',p.value,e);
  if(e.type==='prescription-drafted') {set('proposed_atc',p.atc,e);set('proposed_tablets',p.tablets,e);}
 }
 ctx.terminology_changed=ctx.active_diagnoses.some(d=>d.terminology_version!==terminologyVersion);
 return deepFreeze(ctx);
}

export function buildEncounterContext(events,encounterId,population) {
 if(typeof encounterId!=='string'||!encounterId||typeof population!=='string'||!population) throw new Error('Encounter ID and population required');
 const sorted=[...events].sort((a,b)=>a.seq-b.seq);
 if(new Set(sorted.map(e=>e.patient_id)).size>1) throw new Error('Mixed patients');
 const scoped=sorted.filter(e=>e.payload.encounter_id===encounterId),retired=new Set(scoped.map(e=>e.payload.supersedes).filter(Boolean));
 const inputs=triageEntry.fields.map(f=>f.input),ctx={encounter_id:encounterId,population,...Object.fromEntries(inputs.map(k=>[k,null]))};
 for(const e of scoped) if(e.type==='observation-recorded'&&!retired.has(e.event_id)&&inputs.includes(e.payload.field)) ctx[e.payload.field]=e.payload.value;
 return deepFreeze(ctx);
}
