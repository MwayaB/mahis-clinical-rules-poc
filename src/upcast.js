// Historical names and shapes are confined to this read-time compatibility module.
export const legacyNames={recorded:'triage-recorded',overridden:'triage-overridden'};
export const removedRoutes=['/api/triage/drafts','/api/triage/sample','/api/triage/config','/api/encounters/:id/triage','/api/encounters/:id/triage/override'];
export function legacyEnvelope(result) {
 const base={node_id:result.node_id,node_type:'scored_triage',status:result.status==='scored'?'ok':result.status,missing:[],invalid:[],payload:{renderer:'category'},package_version:result.package_version,engine_version:result.engine_version,inputs_hash:result.inputs_hash.startsWith('sha256:')?result.inputs_hash:'sha256:'+result.inputs_hash};
 if(result.status==='scored') return {...base,outcome:{category:result.category},payload:{...base.payload,score:result.score,components:result.components,overrides_fired:result.overrides_fired}};
 if(result.status==='incomplete') return {...base,missing:result.missing};
 return {...base,invalid:[{input:result.input,value:result.value}]};
}
export function upcastEvent(event,lookup) {
 if(event.type===legacyNames.recorded) return {...event,type:'assessment-recorded',payload:{...event.payload,results:event.payload.results.map(legacyEnvelope),legacy_type:event.type,inputs_hash:'sha256:'+event.payload.inputs_hash.replace(/^sha256:/,'')}};
 if(event.type===legacyNames.overridden) {const ref=lookup(event.payload.triage_ref);return {...event,type:'assessment-overridden',payload:{encounter_id:event.payload.encounter_id,assessment_seq:ref?.seq??null,node_id:ref?.payload.results?.[0]?.node_id??null,action:event.payload.category,reason:event.payload.reason,legacy_type:event.type}};}
 return event;
}
