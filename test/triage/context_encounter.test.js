import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openEventLog } from '../../src/events.js';
import { buildEncounterContext } from '../../src/context.js';
test('encounter projection isolates encounters uses seq and permanent supersession',t=>{
 const db=openEventLog(':memory:');t.after(()=>db.close());let id=0;
 const add=(type,payload)=>db.append({event_id:'event-'+(++id),patient_id:'p',type,payload,occurred_at:'2026-01-01T00:00:00Z'});
 add('patient-registered',{name:'PLACEHOLDER',sex:'F',age_years:30});for(const encounter_id of ['a','b']) add('encounter-opened',{encounter_id,population:'adult'});
 const first=add('observation-recorded',{encounter_id:'a',field:'resp_rate_per_min',value:12});
 add('observation-recorded',{encounter_id:'b',field:'resp_rate_per_min',value:30});add('observation-recorded',{encounter_id:'b',field:'avpu',value:'unresponsive'});
 const correction=add('observation-recorded',{encounter_id:'a',field:'resp_rate_per_min',value:15,supersedes:first.event_id});
 add('observation-recorded',{encounter_id:'a',field:'resp_rate_per_min',value:16,supersedes:correction.event_id});
 const ctx=buildEncounterContext(db.listForPatient('p'),'a','adult');assert.equal(ctx.resp_rate_per_min,16);assert.equal(ctx.avpu,null);assert.ok(Object.isFrozen(ctx));
 assert.equal(buildEncounterContext(db.listForPatient('p',{upToSeq:first.seq}),'a','adult').resp_rate_per_min,12);
 assert.throws(()=>add('observation-recorded',{encounter_id:'b',field:'resp_rate_per_min',value:20,supersedes:first.event_id}),/supersedes/);
});
