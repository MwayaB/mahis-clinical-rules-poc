import { test } from 'node:test';
import assert from 'node:assert/strict';
import { httpEnvironment,releasedHTTP } from './support.js';
test('HTTP upload through mock digitisation, draft, review, fixtures, release and EMR',async t=>{
 const s=await httpEnvironment(t);const uploaded=await s.ok('/api/guidelines?filename=placeholder.pdf&document_id=PLACEHOLDER-GUIDE',s.bytes);
 assert.equal(uploaded.status,'uploaded');assert.equal((await s.request(`/api/guidelines/${uploaded.sha256}/digitise`,{})).status,409);
 const full=await releasedHTTP(s);assert.equal(full.digitisation.digitiser,'mock-fixture');assert.equal(full.drafts.nodes.length,2);assert.equal(full.release.kind,'release-created');assert.equal((await s.ok('/api/releases')).length,1);
 assert.equal((await s.request('/api/releases',{document_sha256:uploaded.sha256,version:'poc-demo-0.1.0'})).status,409);
 const patient=await s.ok('/api/patients',{name:'PLACEHOLDER e2e',sex:'U'}),path='/api/patients/'+patient.patient_id;
 await s.ok(path+'/observations',{field:'weight_kg',value:12});const checked=await s.ok(path+'/prescriptions/check',{atc:'P01BF01',tablets:2,release_version:full.release.version});assert.equal(checked.result.advice[0].severity,'warn');assert.equal((await s.ok(`/api/events/${checked.shown.seq}/replay`,{})).matches,true);
});
