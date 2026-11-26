import { test } from 'node:test';
import assert from 'node:assert/strict';
import { httpEnvironment,releasedHTTP } from './support.js';
import * as emr from '../../src/emr.js';
test('EMR API records prescriptions, visible advice, dated observations and exact replay',async t=>{
 const s=await httpEnvironment(t);await releasedHTTP(s);const p=await s.ok('/api/patients',{name:'PLACEHOLDER dose example (age unspecified)',sex:'U'}),base='/api/patients/'+p.patient_id;
 const missing=await s.ok(base+'/context');assert.equal(missing.weight_kg,null);assert.equal(missing.recorded_at.weight_kg,null);
 const rx={atc:'P01BF01',tablets:2,release_version:'poc-demo-0.1.0'};
 assert.equal((await s.request(base+'/prescriptions/check',rx)).status,409);assert.equal((await s.ok(base+'/events')).filter(e=>e.type==='prescription-drafted').length,0);await s.ok(base+'/diagnoses',{icd10:'B50.9',label:'PLACEHOLDER coded dose-demo diagnosis'});assert.equal((await s.ok(base+'/diagnoses')).length,1);
 assert.match((await s.ok(base+'/prescriptions/check',rx)).result.advice[0].message,/not recorded/);
 await s.ok(base+'/observations',{field:'weight_kg',value:12});const first=await s.ok(base+'/prescriptions/check',rx);assert.equal(first.result.advice[0].severity,'warn');
 await s.ok(base+'/observations',{field:'weight_kg',value:10});const second=await s.ok(base+'/prescriptions/check',{...rx,tablets:1});assert.deepEqual(second.result.advice,[]);
 const events=await s.ok(base+'/events');assert.equal(events.filter(e=>e.type==='prescription-drafted').length,3);assert.equal(events.filter(e=>e.type==='advice-shown').length,3);assert.equal((await s.ok(base+'/context')).recorded_at.weight_kg,'2026-01-01T10:00:00.000Z');
 const replay=await s.ok(`/api/events/${first.shown.seq}/replay`,{});assert.equal(replay.matches,true);assert.deepEqual(replay.result,first.result);
 const adult=await s.ok('/api/patients',{name:'PLACEHOLDER adult pregnancy example',sex:'F'}),adultBase='/api/patients/'+adult.patient_id;await s.ok(adultBase+'/diagnoses',{icd10:'Z00.0',label:'PLACEHOLDER coded adult-demo diagnosis'});await s.ok(adultBase+'/status',{field:'pregnant',value:true});const blocked=await s.ok(adultBase+'/prescriptions/check',{...rx,atc:'J01XX01'});assert.equal(blocked.result.advice[0].severity,'block');assert.equal(blocked.exitCode,2);assert.ok((await s.ok(adultBase+'/events')).some(e=>e.event_id===blocked.draft.event_id));
 assert.equal((await s.request(base+'/observations',{field:'weight_kg',value:10,unknown:true})).status,400);
 // Exercise module APIs directly as well as HTTP wrappers.
 const meta={now:'2026-01-02T00:00:00.000Z'};emr.recordDiagnosis(s.app.store,s.app.events,p.patient_id,{icd10:'PLACEHOLDER',label:'PLACEHOLDER diagnosis'},meta);assert.ok(emr.listPatients(s.app.store).length);assert.equal(emr.patientEvents(s.app.store,s.app.events,p.patient_id).at(-1).type,'diagnosis-recorded');
});
