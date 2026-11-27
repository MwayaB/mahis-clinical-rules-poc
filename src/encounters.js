import { randomUUID } from 'node:crypto';
import { exact,text,ApiError,timestamp } from './prototype/store.js';
import { getPatient } from './emr.js';
import { loadRelease } from './release.js';
import { buildEncounterContext } from './context.js';
import { triage } from './evaluator.js';
import { triageEntry,checkTriageObservation } from './plausibility.js';
import { canonicalStringify,inputsHash } from './canonical.js';
function encounter(db,id) {text(id,'encounter_id');const e=db.findEncounter(id);if(!e) throw new ApiError('Encounter not found',404);return e;}
const append=(db,e,type,payload,now)=>db.append({event_id:randomUUID(),patient_id:e.patient_id,type,payload,occurred_at:timestamp(now)});
export function startEncounter(store,db,body,{now}) {
 exact(body,['patient_id','population']);getPatient(store,body.patient_id);text(body.population,'population');
 const encounter_id=randomUUID();append(db,{patient_id:body.patient_id},'encounter-opened',{encounter_id,population:body.population},now);return {encounter_id,patient_id:body.patient_id,population:body.population};
}
export function recordEncounterObservation(store,db,id,body,{now}) {
 const e=encounter(db,id);exact(body,['field','value','supersedes'],['field','value']);checkTriageObservation(body.field,body.value);
 return append(db,e,'observation-recorded',{encounter_id:id,...body},now);
}
export function triageConfiguration(store,version,options) {
 const pkg=loadRelease(store,version,options),nodes=pkg.rules.filter(n=>n.type==='scored_triage');
 return {fields:triageEntry.fields,populations:[...new Set(nodes.map(n=>n.scope.population))],nodes:nodes.map(n=>({node_id:n.id,population:n.scope.population,categories_order:n.categories_order})),contains_placeholders:pkg.manifest.contains_placeholders};
}
function display(results,pkg) {
 if(!results.length||results.some(r=>r.status!=='scored')) return null;
 const orders=results.map(r=>pkg.rules.find(n=>n.id===r.node_id).categories_order);
 // Do not imply a single highest category for incomparable scoring systems.
 if(orders.some(o=>canonicalStringify(o)!==canonicalStringify(orders[0]))) return null;
 return results.reduce((highest,r)=>orders[0].indexOf(r.category)>orders[0].indexOf(highest.category)?r:highest);
}
export function scoreEncounter(store,db,id,body,{now,keyDir}) {
 const e=encounter(db,id);exact(body,['release_version']);const pkg=loadRelease(store,body.release_version,{keyDir});
 return db.transaction(()=>{
  const history=db.listForPatient(e.patient_id),ctx=buildEncounterContext(history,id,e.payload.population),results=triage(pkg,ctx);
  if(!results.length) throw new ApiError('No triage rule matches this encounter population',422);
  const event=append(db,e,'triage-recorded',{encounter_id:id,population:e.payload.population,results,package_version:pkg.manifest.package_version,engine_version:pkg.engine_version,inputs_hash:inputsHash(ctx),context_up_to_seq:history.at(-1).seq,rules_sha256:pkg.manifest.rules_sha256,manifest_sha256:inputsHash(pkg.manifest)},now);
  return {encounter_id:id,results,display:display(results,pkg),event};
 });
}
export function overrideEncounter(store,db,id,body,{now,keyDir}) {
 const e=encounter(db,id);exact(body,['triage_ref','category','reason'],['category','reason']);
 if(typeof body.reason!=='string'||!body.reason.trim()) throw new ApiError('Override reason is required',422);
 const history=db.listForPatient(e.patient_id),scoped=history.filter(x=>x.payload.encounter_id===id);
 const prior=body.triage_ref?scoped.find(x=>x.event_id===body.triage_ref):scoped.filter(x=>x.type==='triage-recorded').at(-1);
 if(!prior||prior.type!=='triage-recorded'||!prior.payload.results.every(r=>r.status==='scored')) throw new ApiError('A scored triage result is required before overriding category',422);
 if(scoped.some(x=>x.type==='observation-recorded'&&x.seq>prior.seq)) throw new ApiError('Observations changed; score triage again before overriding',409);
 const pkg=loadRelease(store,prior.payload.package_version,{keyDir});
 if(!prior.payload.results.every(r=>pkg.rules.find(n=>n.id===r.node_id).categories_order.includes(body.category))) throw new ApiError('Unknown override category for this release',422);
 return append(db,e,'triage-overridden',{encounter_id:id,triage_ref:prior.event_id,category:body.category,reason:body.reason.trim()},now);
}
export function readEncounter(store,db,id,{keyDir}) {
 const e=encounter(db,id),events=db.listForPatient(e.patient_id).filter(x=>x.payload.encounter_id===id),latest=events.filter(x=>x.type==='triage-recorded').at(-1);
 const current=latest&&!events.some(x=>x.type==='observation-recorded'&&x.seq>latest.seq)?latest:null;
 const override=current?events.filter(x=>x.type==='triage-overridden'&&x.payload.triage_ref===current.event_id).at(-1):null;
 const pkg=current?loadRelease(store,current.payload.package_version,{keyDir}):null;
 return {encounter_id:id,patient_id:e.patient_id,population:e.payload.population,ctx:buildEncounterContext(db.listForPatient(e.patient_id),id,e.payload.population),events,current,display:current?display(current.payload.results,pkg):null,override};
}
export function replayTriage({db,patientId,adviceEvent:e,loadedPackage:pkg}) {
 const p=e.payload,stored=db.listForPatient(patientId,{upToSeq:e.seq}).find(x=>x.event_id===e.event_id);
 if(e.patient_id!==patientId||e.type!=='triage-recorded'||!stored||canonicalStringify(stored)!==canonicalStringify(e)||p.context_up_to_seq>=e.seq) throw new Error('Triage event or cutoff mismatch');
 if(p.package_version!==pkg.manifest.package_version||p.engine_version!==pkg.engine_version||p.rules_sha256!==pkg.manifest.rules_sha256||p.manifest_sha256!==inputsHash(pkg.manifest)) throw new Error('Exact recorded package required');
 const ctx=buildEncounterContext(db.listForPatient(patientId,{upToSeq:p.context_up_to_seq}),p.encounter_id,p.population),results=triage(pkg,ctx);
 if(inputsHash(ctx)!==p.inputs_hash||canonicalStringify(results)!==canonicalStringify(p.results)) throw new Error('Triage replay differs');return results;
}
