import { randomUUID } from 'node:crypto';
import { assess,evaluate } from './evaluator.js';
import { buildContext,buildEncounterContext } from './context.js';
import { getType } from './types/registry.js';
import { canonicalStringify,inputsHash } from './canonical.js';
import { legacyEnvelope } from './upcast.js';
export function assessmentContext(events,pkg,{today,encounterId,population}) {
 const ctx={...buildContext(events.filter(e=>e.type!=='observation-recorded'||!e.payload.encounter_id),{today,terminologyVersion:pkg.manifest.terminology_version})};
 if(!encounterId) return ctx;
 const encounter=buildEncounterContext(events,encounterId,population),scoped=events.filter(e=>e.payload.encounter_id===encounterId),retired=new Set(scoped.map(e=>e.payload.supersedes).filter(Boolean));
 Object.assign(ctx,encounter);
 for(const e of scoped) if(e.type==='observation-recorded'&&!retired.has(e.event_id)) ctx[e.payload.field]=e.payload.value;
 return ctx;
}
export function recordAssessments({db,patientId,pkg,ctx,today,occurredAt,encounterId=null,population=null,scope='all',eventId}) {
 const results=assess(pkg,ctx,{scope}),cutoff=db.listForPatient(patientId).at(-1)?.seq;
 const events=results.map((result,index)=>db.append({event_id:eventId?.(index)??randomUUID(),patient_id:patientId,type:'assessment-recorded',occurred_at:occurredAt,payload:{encounter_id:encounterId,population,scope,today,result,package_version:pkg.manifest.package_version,engine_version:pkg.engine_version,inputs_hash:result.inputs_hash,context_up_to_seq:cutoff,rules_sha256:pkg.manifest.rules_sha256,manifest_sha256:inputsHash(pkg.manifest)}}));
 return {results,events};
}
function verifyRecord(db,patientId,event,pkg) {
 const p=event.payload,stored=db.listForPatient(patientId,{upToSeq:event.seq}).find(e=>e.event_id===event.event_id);
 if(event.patient_id!==patientId||!stored||canonicalStringify(stored)!==canonicalStringify(event)||p.context_up_to_seq>=event.seq) throw new Error('Assessment event or cutoff mismatch');
 if(p.package_version!==pkg.manifest.package_version||p.engine_version!==pkg.engine_version||p.rules_sha256!==pkg.manifest.rules_sha256||p.manifest_sha256!==inputsHash(pkg.manifest)) throw new Error('Exact recorded package required');
}
export function replayAssessment({db,patientId,adviceEvent:event,loadedPackage:pkg}) {
 verifyRecord(db,patientId,event,pkg);const p=event.payload,history=db.listForPatient(patientId,{upToSeq:p.context_up_to_seq});
 if(p.legacy_type) {
  const ctx=buildEncounterContext(history,p.encounter_id,p.population),actual=assess(pkg,ctx,{scope:'encounter'}).map(r=>legacyEnvelope(getType(r.node_type).legacyResult(r,pkg)));
  if('sha256:'+inputsHash(ctx)!==p.inputs_hash||canonicalStringify(actual)!==canonicalStringify(p.results)) throw new Error('Legacy assessment replay differs');return actual;
 }
 const ctx=assessmentContext(history,pkg,{today:p.today,encounterId:p.encounter_id,population:p.population});
 if(event.type==='advice-shown') {const result=evaluate(pkg,ctx);if(result.inputs_hash!==p.inputs_hash||canonicalStringify(result.advice)!==canonicalStringify(p.advice)) throw new Error('Replay differs from recorded advice');return result;}
 if(event.type!=='assessment-recorded') throw new Error('Not a recorded assessment');
 const result=assess(pkg,ctx,{scope:p.scope,nodeIds:[p.result.node_id]})[0];
 if(!result||result.inputs_hash!==p.inputs_hash||canonicalStringify(result)!==canonicalStringify(p.result)) throw new Error('Assessment replay differs');return result;
}
