import { test } from 'node:test';
import assert from 'node:assert/strict';
import { httpEnvironment } from '../../prototype/support.js';
import { releasedTriageHTTP,ir } from './support.js';
test('assessment API records incomplete scored invalid and reasoned override envelopes',async t=>{
 const s=await httpEnvironment(t);await releasedTriageHTTP(s);
 const p=await s.ok('/api/patients',{name:'PLACEHOLDER adult',sex:'F',age_years:30});
 const e=await s.ok('/api/encounters',{patient_id:p.patient_id,population:'adult'}),base='/api/encounters/'+e.encounter_id,request={release_version:'poc-demo-0.3.0'};
 const config=await s.ok('/api/assessment/config?release_version='+request.release_version);assert.ok(config.fields.some(f=>f.name==='resp_rate_per_min'));assert.deepEqual(config.nodes[0].actions,ir.nodes[0].categories_order);
 await s.ok(base+'/observations',{field:'avpu',value:'unresponsive'});
 const missing=await s.ok(base+'/assess',request);assert.equal(missing.results[0].status,'incomplete');assert.deepEqual(missing.results[0].missing,['resp_rate_per_min']);assert.equal(missing.results[0].outcome,undefined);
 await s.ok(base+'/observations',{field:'resp_rate_per_min',value:12});const scored=await s.ok(base+'/assess',request);assert.equal(scored.results[0].outcome.category,'emergency');assert.equal(scored.results[0].payload.score,3);assert.deepEqual(scored.results[0].payload.overrides_fired,['unresponsive-override']);
 const overridePath=base+'/assess/'+scored.events[0].seq+'/override';
 assert.equal((await s.request(overridePath,{node_id:scored.results[0].node_id,action:'urgent',reason:''})).status,422);assert.equal((await s.request(overridePath,{node_id:scored.results[0].node_id,action:'other',reason:'Clinical judgement'})).status,422);
 const override=await s.ok(overridePath,{node_id:scored.results[0].node_id,action:'urgent',reason:'Clinical judgement after assessment'});assert.equal(override.type,'assessment-overridden');assert.equal(override.payload.assessment_seq,scored.events[0].seq);assert.ok(override.payload.reason);
 for(const [field,value] of [['resp_rate_per_min',101],['pulse_per_min',301],['temp_c',24],['spo2_pct',101],['avpu',2],['avpu','unknown'],['other',2]]) {const bad=await s.request(base+'/observations',{field,value});assert.equal(bad.status,422);assert.match(bad.data.error,new RegExp(field));}
 await s.ok(base+'/observations',{field:'resp_rate_per_min',value:100});assert.deepEqual((await s.ok(base)).current,[]);const invalid=await s.ok(base+'/assess',request);assert.equal(invalid.results[0].status,'invalid');assert.equal(invalid.results[0].outcome,undefined);assert.equal(invalid.results[0].payload.score,undefined);
 const events=(await s.ok('/api/patients/'+p.patient_id+'/events'));assert.equal(events.filter(e=>e.type==='assessment-recorded').length,3);assert.equal(events.filter(e=>e.type==='assessment-overridden').length,1);for(const event of events.filter(e=>e.type==='assessment-recorded')) {assert.ok(event.payload.package_version);assert.match(event.payload.inputs_hash,/^sha256:[a-f0-9]{64}$/);}
});
test('imported rule requires ledger review and fixture coverage before release',async t=>{const s=await httpEnvironment(t);const source=await s.ok('/api/guidelines?filename=triage.pdf&document_id=PLACEHOLDER',Buffer.from('%PDF-PLACEHOLDER triage import'));await s.ok(`/api/guidelines/${source.sha256}/metadata`,{edition:'placeholder'});const n=await s.ok('/api/rules/import',{document_sha256:source.sha256,node:ir.nodes[0]});assert.equal(n.node.status,'draft');assert.deepEqual(n.approvals,[]);const r=await s.request('/api/releases',{document_sha256:source.sha256,version:'poc-demo-0.3.0'});assert.equal(r.status,409);assert.match(r.data.error,/two distinct/);});
