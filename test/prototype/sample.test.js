import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setup,NOW } from './support.js';
import { uploadGuideline,setMetadata } from '../../src/registry.js';
import { digitise } from '../../src/digitiser.js';
import { generateDrafts } from '../../src/draft.js';
import { approveNode } from '../../src/review.js';
import { saveFixtures } from '../../src/fixtures.js';
import { createRelease } from '../../src/release.js';
import { openEventLog } from '../../src/events.js';
import * as emr from '../../src/emr.js';
test('shipped bundle is exact and entire service flow works without HTTP',t=>{
 const s=setup(t),bundle=JSON.parse(readFileSync(new URL('../../samples/dose-guide/bundle.json',import.meta.url))),bytes=readFileSync(new URL('../../samples/dose-guide/placeholder.pdf',import.meta.url));
 assert.equal(readdirSync(new URL('../../fixtures/digitised/',import.meta.url)).filter(f=>f.endsWith('.json')).length,1);
 const source=uploadGuideline(s,{bytes,filename:'placeholder.pdf',documentId:bundle.document_id,contentType:'application/pdf',now:NOW});assert.equal(source.sha256,bundle.document_sha256);setMetadata(s,source.sha256,{edition:bundle.edition});assert.equal(digitise(s,source.sha256).digitiser,'mock-fixture');
 const drafts=generateDrafts(s,source.sha256,{atc_by_block:bundle.atc_by_block},{actor:'placeholder-editor',now:NOW});
 for(const {node,block} of drafts.nodes){assert.equal(node.placeholder,true);for(const reviewer of ['a','b']) approveNode(s,node.id,{reviewer},{now:NOW});saveFixtures(s,{node_id:node.id,entries:bundle.fixtures[block.id]});}
 const keyDir=join(s.root,'keys');createRelease(s,{document_sha256:source.sha256,version:'poc-demo-0.1.0'},{keyDir,actor:'placeholder-releaser',now:NOW});
 const db=openEventLog(':memory:');t.after(()=>db.close());const opts={now:NOW,keyDir};const p=emr.createPatient(s,db,{name:'PLACEHOLDER direct service',sex:'U'},opts);assert.equal(emr.getPatient(s,p.patient_id).name,p.name);assert.equal(emr.patientContext(s,db,p.patient_id,opts).weight_kg,null);
 emr.recordObservation(s,db,p.patient_id,{field:'weight_kg',value:12},opts);emr.recordStatus(s,db,p.patient_id,{field:'pregnant',value:false},opts);emr.recordDiagnosis(s,db,p.patient_id,{icd10:'B50.9',label:'PLACEHOLDER coded diagnosis'},opts);
 assert.equal(emr.patientDiagnoses(s,db,p.patient_id).length,1);
 const r=emr.checkPrescription(s,db,p.patient_id,{atc:'P01BF01',tablets:2,release_version:'poc-demo-0.1.0'},opts);assert.equal(r.result.advice[0].severity,'warn');assert.equal(emr.replayAdvice(s,db,r.shown.seq,opts).matches,true);assert.equal(emr.listPatients(s).length,1);assert.ok(emr.patientEvents(s,db,p.patient_id).length>=6);
});
