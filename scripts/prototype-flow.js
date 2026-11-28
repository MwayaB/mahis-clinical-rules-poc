// Every network step deliberately uses curl; Node only orchestrates and checks JSON results.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const base=process.env.PROTOTYPE_BASE_URL??'http://127.0.0.1:8080';
const triageIR=JSON.parse(readFileSync(new URL('../ir/triage_example.ir.json',import.meta.url)));
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
let draft=call(`/api/guidelines/${sample.document_sha256}/draft`,{atc_by_block:sample.atc_by_block});
call('/api/rules/import',{document_sha256:sample.document_sha256,block_id:sample.triage_block_id,node:triageIR.nodes[0]});
draft=call('/api/ir?document='+sample.document_sha256);
for(const entry of draft.nodes) {
 for(const reviewer of ['placeholder-reviewer-a','placeholder-reviewer-b']) call(`/api/ir/${entry.node.id}/approve`,{reviewer});
 assert.equal(call(`/api/ir/${entry.node.id}/checks`,{}).status,'passed');
}
const version=sample.release_version,existing=call('/api/releases').find(r=>r.version===version);
if(existing) {assert.equal(existing.document_sha256,sample.document_sha256);console.log('Keeping existing append-only sample release '+version);} else call('/api/releases',{document_sha256:sample.document_sha256,version});
const p=call('/api/patients',{name:'PLACEHOLDER child',sex:'M',age_years:4}),patient='/api/patients/'+p.patient_id;
const childEncounter=call('/api/encounters',{patient_id:p.patient_id,population:'child'}),childPath='/api/encounters/'+childEncounter.encounter_id;
for(const observation of [{field:'weight_kg',value:15},{field:'proposed_atc',value:sample.atc_by_block.b1},{field:'proposed_tablets',value:1}]) call(childPath+'/observations',{...observation,release_version:version});
const missing=call(childPath+'/assess',{release_version:version});assert.ok(missing.results.some(r=>r.status==='incomplete'&&r.missing.includes('active_diagnoses')));console.log('no indication recorded; assessment incomplete');
call(patient+'/diagnoses',sample.demo_diagnoses.child);
const first=call(childPath+'/assess',{release_version:version});assert.equal(first.results[0].status,'advice');assert.equal(first.results[0].outcome.items[0].severity,'warn');
call(childPath+'/observations',{field:'proposed_tablets',value:2,release_version:version});
const second=call(childPath+'/assess',{release_version:version});assert.ok(second.results.every(r=>r.status==='ok'));assert.deepEqual(second.results[0].outcome.items,[]);
assert.equal(call(`/api/events/${first.events[0].seq}/replay`,{}).matches,true);
const adult=call('/api/patients',{name:'PLACEHOLDER adult pregnancy example',sex:'F',age_years:30}),adultPath='/api/patients/'+adult.patient_id;
call(adultPath+'/diagnoses',sample.demo_diagnoses.adult);
call(adultPath+'/status',{field:'pregnant',value:true,release_version:version});
// The supplied rule is adult-only. Keep triage on the separate adult, never the demo child.
const encounter=call('/api/encounters',{patient_id:adult.patient_id,population:triageIR.nodes[0].scope.population}),encounterPath='/api/encounters/'+encounter.encounter_id;
call(encounterPath+'/observations',{field:'proposed_atc',value:sample.atc_by_block.b2,release_version:version});
for(const observation of triageDemo.observations.slice(0,-1)) call(encounterPath+'/observations',observation);
const triageRequest={release_version:version};
const categoryResult=response=>response.results.find(r=>r.payload.renderer==='category');
const incomplete=call(encounterPath+'/assess',triageRequest);assert.equal(categoryResult(incomplete).status,'incomplete');assert.deepEqual(categoryResult(incomplete).missing,[triageDemo.observations.at(-1).field]);assert.equal(categoryResult(incomplete).outcome,undefined);console.log('Adult triage: incomplete');
assert.ok(incomplete.results.some(r=>r.status==='advice'&&r.outcome.items.some(i=>i.severity==='block')));
call(encounterPath+'/observations',triageDemo.observations.at(-1));
const scored=call(encounterPath+'/assess',triageRequest);assert.equal(categoryResult(scored).status,'ok');assert.equal(categoryResult(scored).outcome.category,triageIR.nodes[0].categories_order[0]);console.log('Adult triage: scored');
const original=scored.events.find(e=>e.payload.result.node_id===categoryResult(scored).node_id);
const overridden=call(encounterPath+'/assess/'+original.seq+'/override',{node_id:categoryResult(scored).node_id,action:triageIR.nodes[0].categories_order.at(-1),reason:triageDemo.override_reason});assert.equal(overridden.type,'assessment-overridden');console.log('Adult triage: overridden');
for(const record of [...incomplete.events,...scored.events]) assert.equal(call(`/api/events/${record.seq}/replay`,{}).matches,true);
const triageTrail=call(adultPath+'/events');assert.equal(triageTrail.filter(e=>e.type==='assessment-recorded'&&e.payload.result.node_type===triageIR.nodes[0].type).length,2);assert.equal(triageTrail.filter(e=>e.type==='assessment-overridden').length,1);
console.log('Full prototype flow passed: upload → mock → review → release → warning → no advice → replay → recorded block. ALL CLINICAL VALUES ARE PLACEHOLDERS.');
