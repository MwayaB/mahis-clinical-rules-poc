import { randomUUID } from 'node:crypto';
import { exact,text,ApiError,timestamp } from './prototype/store.js';
import { getPatient } from './emr.js';
import { loadRelease } from './release.js';
import { assessmentContext,recordAssessments,replayAssessment } from './assessment.js';
import { inputCatalog,checkObservation } from './inputs.js';
import { invalidInput } from './domains.js';
import { checkPregnancy } from './plausibility.js';
import { getType } from './types/registry.js';
function encounter(db,id) {text(id,'encounter_id');const e=db.findEncounter(id);if(!e) throw new ApiError('Encounter not found',404);return e;}
const append=(db,e,type,payload,now)=>db.append({event_id:randomUUID(),patient_id:e.patient_id,type,payload,occurred_at:timestamp(now)});
export function startEncounter(store,db,body,{now}) {exact(body,['patient_id','population']);getPatient(store,body.patient_id);text(body.population,'population');const encounter_id=randomUUID();append(db,{patient_id:body.patient_id},'encounter-opened',{encounter_id,population:body.population},now);return {encounter_id,patient_id:body.patient_id,population:body.population};}
export function recordEncounterObservation(store,db,id,body,{now,keyDir}) {
 const e=encounter(db,id);exact(body,['field','value','supersedes','release_version'],['field','value']);const {release_version,...observation}=body;
 const pkg=release_version?loadRelease(store,release_version,{keyDir}):null;
 const declarations=pkg?pkg.rules.flatMap(n=>getType(n.type).requiredInputs(n)).filter(d=>d.name===body.field):[];
 const declaration=declarations.find(d=>!invalidInput(d,body.value))??declarations[0];
 checkObservation(body.field,body.value,declaration);
 if(declarations.length&&declarations.every(d=>invalidInput(d,body.value))) throw new ApiError(`${body.field}: outside declared input domains for selected release`,422);
 if(body.field==='pregnant') {const ctx=assessmentContext(db.listForPatient(e.patient_id),pkg??{manifest:{}},{today:timestamp(now).slice(0,10),encounterId:id,population:e.payload.population});checkPregnancy(body.value,ctx,pkg?.rules??[]);}
 const definition=!inputCatalog.some(d=>d.name===body.field)?declaration:null;
 return append(db,e,'observation-recorded',{encounter_id:id,...observation,...(definition?{input_definition:definition}:{})},now);
}
export function assessmentConfiguration(store,version,options) {
 const pkg=version?loadRelease(store,version,options):null,rules=pkg?.rules??[],fields=new Map(inputCatalog.map(d=>[d.name,{...d}]));
 for(const node of rules) for(const input of getType(node.type).requiredInputs(node)) if(!fields.has(input.name)) fields.set(input.name,{...input,label:input.name});
 return {fields:[...fields.values()],populations:[...new Set(rules.map(n=>n.scope?.population).filter(Boolean))],nodes:rules.map(n=>({node_id:n.id,node_type:n.type,scope:getType(n.type).scope,renderer:getType(n.type).renderer,actions:getType(n.type).allowedActions?.(n)??[]})),contains_placeholders:pkg?.manifest.contains_placeholders??true};
}
export function assessEncounter(store,db,id,body,{now,keyDir}) {
 const e=encounter(db,id);exact(body,['release_version']);const pkg=loadRelease(store,body.release_version,{keyDir}),today=timestamp(now).slice(0,10);
 return db.transaction(()=>{const ctx=assessmentContext(db.listForPatient(e.patient_id),pkg,{today,encounterId:id,population:e.payload.population});return {encounter_id:id,...recordAssessments({db,patientId:e.patient_id,pkg,ctx,today,occurredAt:now,encounterId:id,population:e.payload.population})};});
}
export function overrideAssessment(store,db,id,seq,body,{now,keyDir}) {
 const e=encounter(db,id);exact(body,['node_id','action','reason']);if(typeof body.reason!=='string'||!body.reason.trim()) throw new ApiError('Override reason is required',422);
 if(!Number.isSafeInteger(seq)||seq<1) throw new ApiError('Invalid assessment seq',422);
 const history=db.listForPatient(e.patient_id),prior=history.find(event=>event.seq===seq);
 if(!prior||prior.type!=='assessment-recorded'||prior.payload.encounter_id!==id) throw new ApiError('Assessment not found for this encounter',404);
 const result=prior.payload.result??prior.payload.results?.find(r=>r.node_id===body.node_id);if(!result||result.node_id!==body.node_id) throw new ApiError('Assessment node mismatch',422);
 if(!['ok','advice'].includes(result.status)) throw new ApiError('Cannot override an incomplete or invalid assessment',422);
 if(history.some(x=>x.type==='observation-recorded'&&x.payload.encounter_id===id&&x.seq>seq)) throw new ApiError('Observations changed; assess again before overriding',409);
 const pkg=loadRelease(store,prior.payload.package_version,{keyDir}),node=pkg.rules.find(n=>n.id===body.node_id),actions=getType(node.type).allowedActions?.(node,result)??[];
 if(!actions.includes(body.action)) throw new ApiError('Unknown assessment action for this release',422);
 return append(db,e,'assessment-overridden',{encounter_id:id,assessment_seq:seq,node_id:body.node_id,action:body.action,reason:body.reason.trim()},now);
}
export function readEncounter(store,db,id,{keyDir}) {
 const e=encounter(db,id),history=db.listForPatient(e.patient_id),events=history.filter(x=>x.payload.encounter_id===id),lastObservation=events.filter(x=>x.type==='observation-recorded').at(-1)?.seq??e.seq;
 const latest=new Map();for(const event of events) if(event.type==='assessment-recorded'&&event.seq>lastObservation) {for(const result of event.payload.result?[event.payload.result]:event.payload.results??[]) latest.set(result.node_id,{result,event});}
 const current=[...latest.values()].sort((a,b)=>a.result.node_id<b.result.node_id?-1:1),version=current[0]?.result.package_version,pkg=version?loadRelease(store,version,{keyDir}):{manifest:{}};
 for(const item of current) {const loaded=loadRelease(store,item.result.package_version,{keyDir}),node=loaded.rules.find(n=>n.id===item.result.node_id);item.actions=getType(node.type).allowedActions?.(node,item.result)??[];}
 return {encounter_id:id,patient_id:e.patient_id,population:e.payload.population,ctx:assessmentContext(history,pkg,{today:e.occurred_at.slice(0,10),encounterId:id,population:e.payload.population}),events,current,overrides:events.filter(x=>x.type==='assessment-overridden')};
}
export const replayRecordedAssessment=replayAssessment;
