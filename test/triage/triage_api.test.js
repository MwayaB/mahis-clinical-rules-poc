import { test } from 'node:test';
import assert from 'node:assert/strict';
import { httpEnvironment } from '../prototype/support.js';
import { releasedTriageHTTP,ir } from './support.js';
test('triage API records incomplete scored invalid and reasoned override events',async t=>{
 const s=await httpEnvironment(t);await releasedTriageHTTP(s);
 const p=await s.ok('/api/patients',{name:'PLACEHOLDER adult',sex:'F',age_years:30});
 const e=await s.ok('/api/encounters',{patient_id:p.patient_id,population:'adult'}),base='/api/encounters/'+e.encounter_id,request={release_version:'poc-demo-0.3.0'};
 const config=await s.ok('/api/triage/config?release_version='+request.release_version);assert.equal(config.fields.length,5);assert.deepEqual(config.nodes[0].categories_order,ir.nodes[0].categories_order);
 await s.ok(base+'/observations',{field:'avpu',value:'unresponsive'});
 const missing=await s.ok(base+'/triage',request);assert.equal(missing.results[0].status,'incomplete');assert.deepEqual(missing.results[0].missing,['resp_rate_per_min']);assert.equal(missing.results[0].category,undefined);assert.equal(missing.display,null);assert.equal((await s.request(base+'/triage/override',{category:'emergency',reason:'Clinical judgement'})).status,422);
 await s.ok(base+'/observations',{field:'resp_rate_per_min',value:12});const scored=await s.ok(base+'/triage',request);assert.equal(scored.results[0].category,'emergency');assert.equal(scored.results[0].score,3);assert.deepEqual(scored.results[0].overrides_fired,['unresponsive-override']);
 assert.equal((await s.request(base+'/triage/override',{category:'urgent',reason:''})).status,422);assert.equal((await s.request(base+'/triage/override',{category:'other',reason:'Clinical judgement'})).status,422);
 const override=await s.ok(base+'/triage/override',{category:'urgent',reason:'Clinical judgement after assessment'});assert.equal(override.type,'triage-overridden');assert.equal(override.payload.triage_ref,scored.event.event_id);assert.ok(override.payload.reason);
 for(const [field,value] of [['resp_rate_per_min',101],['pulse_per_min',301],['temp_c',24],['spo2_pct',101],['avpu',2],['avpu','unknown'],['other',2]]) {const bad=await s.request(base+'/observations',{field,value});assert.equal(bad.status,422);assert.match(bad.data.error,new RegExp(field));}
 await s.ok(base+'/observations',{field:'resp_rate_per_min',value:100});assert.equal((await s.ok(base)).display,null);const invalid=await s.ok(base+'/triage',request);assert.equal(invalid.results[0].status,'invalid');assert.equal(invalid.results[0].category,undefined);assert.equal(invalid.results[0].score,undefined);
 const events=(await s.ok('/api/patients/'+p.patient_id+'/events'));assert.equal(events.filter(e=>e.type==='triage-recorded').length,3);assert.equal(events.filter(e=>e.type==='triage-overridden').length,1);for(const event of events.filter(e=>e.type==='triage-recorded')) {assert.ok(event.payload.package_version);assert.match(event.payload.inputs_hash,/^[a-f0-9]{64}$/);}
});
test('imported triage requires independent review and fixture coverage before release',async t=>{const s=await httpEnvironment(t);const source=await s.ok('/api/guidelines?filename=triage.pdf&document_id=PLACEHOLDER',Buffer.from('%PDF-PLACEHOLDER triage import'));await s.ok(`/api/guidelines/${source.sha256}/metadata`,{edition:'placeholder'});const n=await s.ok('/api/triage/drafts',{document_sha256:source.sha256,node:ir.nodes[0]});assert.equal(n.node.status,'draft');assert.deepEqual(n.approvals,[]);const r=await s.request('/api/releases',{document_sha256:source.sha256,version:'poc-demo-0.3.0'});assert.equal(r.status,409);assert.match(r.data.error,/two distinct/);});
