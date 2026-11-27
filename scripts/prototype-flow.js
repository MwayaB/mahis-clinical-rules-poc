// Every network step deliberately uses curl; Node only orchestrates and checks JSON results.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const base=process.env.PROTOTYPE_BASE_URL??'http://127.0.0.1:8080';
const triageIR=JSON.parse(readFileSync(new URL('../ir/triage_example.ir.json',import.meta.url)));
const triageFixtures=JSON.parse(readFileSync(new URL('../fixtures/triage_example.fixtures.json',import.meta.url)));
const triageDemo=JSON.parse(readFileSync(new URL('../samples/triage/demo.json',import.meta.url)));
const sample=JSON.parse(readFileSync(new URL('../samples/dose-guide/bundle.json',import.meta.url)));
function call(path,body,{file}={}) {
 const argv=['--silent','--show-error','--fail-with-body',base+path];
 if(file) argv.push('-X','POST','-H','Content-Type: application/pdf','--data-binary','@'+file);
 else if(body!==undefined) argv.push('-X','POST','-H','Content-Type: application/json','--data-binary','@-');
 const r=spawnSync('curl',argv,{input:body===undefined?undefined:JSON.stringify(body),encoding:'utf8',maxBuffer:4*1024*1024});
 console.log(path+'\n'+r.stdout);if(r.status!==0) throw Error('API step failed: '+r.stderr+' '+r.stdout);return JSON.parse(r.stdout);
}
call('/api/guidelines?filename=placeholder.pdf&document_id='+sample.document_id,undefined,{file:fileURLToPath(new URL('../samples/dose-guide/placeholder.pdf',import.meta.url))});
call(`/api/guidelines/${sample.document_sha256}/metadata`,{edition:sample.edition});
assert.equal(call(`/api/guidelines/${sample.document_sha256}/digitise`,{}).digitiser,'mock-fixture');
const draft=call(`/api/guidelines/${sample.document_sha256}/draft`,{atc_by_block:sample.atc_by_block});
for(const entry of draft.nodes) {
 for(const reviewer of ['placeholder-reviewer-a','placeholder-reviewer-b']) call(`/api/ir/${entry.node.id}/approve`,{reviewer});
 call('/api/fixtures',{node_id:entry.node.id,entries:sample.fixtures[entry.block.id]});
}
const version=sample.release_version,existing=call('/api/releases').find(r=>r.version===version);
if(existing) {assert.equal(existing.document_sha256,sample.document_sha256);console.log('Keeping existing append-only sample release '+version);} else call('/api/releases',{document_sha256:sample.document_sha256,version});
const p=call('/api/patients',{name:'PLACEHOLDER child',sex:'M',age_years:4}),patient='/api/patients/'+p.patient_id;
call(patient+'/observations',{field:'weight_kg',value:15});
const missing=call(patient+'/prescriptions/check',{atc:sample.atc_by_block.b1,tablets:1,release_version:version});assert.match(missing.result.advice[0].message,/no indication recorded/);
call(patient+'/diagnoses',sample.demo_diagnoses.child);
const first=call(patient+'/prescriptions/check',{atc:sample.atc_by_block.b1,tablets:1,release_version:version});assert.equal(first.result.advice.length,1);assert.equal(first.result.advice[0].severity,'warn');
call(patient+'/observations',{field:'weight_kg',value:15});
const second=call(patient+'/prescriptions/check',{atc:sample.atc_by_block.b1,tablets:2,release_version:version});assert.deepEqual(second.result.advice,[]);
assert.equal(call(`/api/events/${first.shown.seq}/replay`,{}).matches,true);
const adult=call('/api/patients',{name:'PLACEHOLDER adult pregnancy example',sex:'F',age_years:30}),adultPath='/api/patients/'+adult.patient_id;
call(adultPath+'/diagnoses',sample.demo_diagnoses.adult);
call(adultPath+'/status',{field:'pregnant',value:true,release_version:version});const blocked=call(adultPath+'/prescriptions/check',{atc:sample.atc_by_block.b2,tablets:1,release_version:version});assert.equal(blocked.result.advice[0].severity,'block');assert.equal(blocked.exitCode,2);
// The supplied rule is adult-only. Keep triage on the separate adult, never the demo child.
const triageUpload=call('/api/guidelines?filename=triage.pdf&document_id='+triageIR.document.id,undefined,{file:fileURLToPath(new URL('../samples/triage/placeholder.pdf',import.meta.url))});
call(`/api/guidelines/${triageUpload.sha256}/metadata`,{edition:triageIR.document.edition});
const triageDraft=call('/api/triage/drafts',{document_sha256:triageUpload.sha256,node:triageIR.nodes[0]});
for(const reviewer of ['reviewer-a','reviewer-b']) call(`/api/ir/${triageDraft.node.id}/approve`,{reviewer});
call('/api/fixtures',{node_id:triageDraft.node.id,entries:triageFixtures});
if(!call('/api/releases').some(r=>r.version===triageDemo.release_version)) call('/api/releases',{document_sha256:triageUpload.sha256,version:triageDemo.release_version});
const encounter=call('/api/encounters',{patient_id:adult.patient_id,population:triageIR.nodes[0].scope.population}),encounterPath='/api/encounters/'+encounter.encounter_id;
for(const observation of triageDemo.observations.slice(0,-1)) call(encounterPath+'/observations',observation);
const triageRequest={release_version:triageDemo.release_version};
const incomplete=call(encounterPath+'/triage',triageRequest);assert.equal(incomplete.results[0].status,'incomplete');assert.deepEqual(incomplete.results[0].missing,[triageDemo.observations.at(-1).field]);assert.equal(incomplete.results[0].category,undefined);console.log('Adult triage: incomplete');
call(encounterPath+'/observations',triageDemo.observations.at(-1));
const scored=call(encounterPath+'/triage',triageRequest);assert.equal(scored.results[0].status,'scored');assert.equal(scored.results[0].category,triageIR.nodes[0].categories_order[0]);console.log('Adult triage: scored');
const overridden=call(encounterPath+'/triage/override',{triage_ref:scored.event.event_id,category:triageIR.nodes[0].categories_order.at(-1),reason:triageDemo.override_reason});assert.equal(overridden.type,'triage-overridden');console.log('Adult triage: overridden');
assert.equal(call(`/api/events/${incomplete.event.seq}/replay`,{}).matches,true);assert.equal(call(`/api/events/${scored.event.seq}/replay`,{}).matches,true);
const triageTrail=call(adultPath+'/events');assert.equal(triageTrail.filter(e=>e.type==='triage-recorded').length,2);assert.equal(triageTrail.filter(e=>e.type==='triage-overridden').length,1);
const events=call(patient+'/events');assert.equal(events.filter(e=>e.type==='prescription-drafted').length,3);
assert.ok(!events.some(e=>e.type==='status-recorded'&&e.payload.field==='pregnant'));
assert.equal(call(adultPath+'/events').filter(e=>e.type==='prescription-drafted').length,1);
console.log('Full prototype flow passed: upload → mock → review → release → warning → no advice → replay → recorded block. ALL CLINICAL VALUES ARE PLACEHOLDERS.');
