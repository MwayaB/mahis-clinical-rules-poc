import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { setup,NOW } from './support.js';
import { uploadGuideline,setMetadata } from '../../src/registry.js';
import { digitise } from '../../src/digitiser.js';
import { generateDrafts,listDrafts,draftBlocks as generateSourceDrafts } from '../../src/draft.js';
import { approveNode,editNode,importTriageDraft } from '../../src/review.js';
import { saveFixtures } from '../../src/fixtures.js';
import { createRelease } from '../../src/release.js';
import { openEventLog } from '../../src/events.js';
import * as emr from '../../src/emr.js';
test('shipped bundle is exact and entire service flow works without HTTP',t=>{
 const s=setup(t),bundle=JSON.parse(readFileSync(new URL('../../samples/dose-guide/bundle.json',import.meta.url))),bytes=readFileSync(new URL('../../samples/dose-guide/placeholder.pdf',import.meta.url));
 assert.equal(readdirSync(new URL('../../fixtures/digitised/',import.meta.url)).filter(f=>f.endsWith('.json')).length,1);
 const source=uploadGuideline(s,{bytes,filename:'placeholder.pdf',documentId:bundle.document_id,contentType:'application/pdf',now:NOW});assert.equal(source.sha256,bundle.document_sha256);setMetadata(s,source.sha256,{edition:bundle.edition});assert.equal(digitise(s,source.sha256).digitiser,'mock-fixture');
 let drafts=generateDrafts(s,source.sha256,{atc_by_block:bundle.atc_by_block},{actor:'placeholder-editor',now:NOW});
 const triage=JSON.parse(readFileSync(new URL('../../ir/triage_example.ir.json',import.meta.url)));
 importTriageDraft(s,{document_sha256:source.sha256,block_id:bundle.triage_block_id,node:triage.nodes[0]},{actor:'placeholder-editor',now:NOW});drafts=listDrafts(s,source.sha256);assert.equal(drafts.nodes.length,4);assert.deepEqual(drafts.unconverted,[]);
 for(const {node,block} of drafts.nodes){assert.equal(node.placeholder,true);for(const reviewer of ['a','b']) approveNode(s,node.id,{reviewer},{now:NOW});saveFixtures(s,{node_id:node.id,entries:bundle.fixtures[block.id]});}
 const keyDir=join(s.root,'keys');createRelease(s,{document_sha256:source.sha256,version:'poc-demo-0.1.0'},{keyDir,actor:'placeholder-releaser',now:NOW});
 const db=openEventLog(':memory:');t.after(()=>db.close());const opts={now:NOW,keyDir};const p=emr.createPatient(s,db,{name:'PLACEHOLDER direct service',sex:'U'},opts);assert.equal(emr.getPatient(s,p.patient_id).name,p.name);assert.equal(emr.patientContext(s,db,p.patient_id,opts).weight_kg,null);
 emr.recordObservation(s,db,p.patient_id,{field:'weight_kg',value:12},opts);emr.recordStatus(s,db,p.patient_id,{field:'pregnant',value:false},opts);emr.recordDiagnosis(s,db,p.patient_id,{icd10:'B50.9',label:'PLACEHOLDER coded diagnosis'},opts);
 assert.equal(emr.patientDiagnoses(s,db,p.patient_id).length,1);
 const r=emr.checkPrescription(s,db,p.patient_id,{atc:'P01BF01',tablets:2,release_version:'poc-demo-0.1.0'},opts);assert.equal(r.result.advice[0].severity,'warn');assert.equal(emr.replayAdvice(s,db,r.shown.seq,opts).matches,true);assert.equal(emr.listPatients(s).length,1);assert.ok(emr.patientEvents(s,db,p.patient_id).length>=6);
});
test('PDF source and digitised fixture carry the same explicit applicability with no template invention',()=>{
 const bundle=JSON.parse(readFileSync(new URL('../../samples/dose-guide/bundle.json',import.meta.url))),source=JSON.parse(readFileSync(new URL('../../samples/dose-guide/source.json',import.meta.url))),fixture=JSON.parse(readFileSync(new URL('../../fixtures/digitised/'+bundle.document_sha256+'.json',import.meta.url)));
 assert.equal(source.scenarios,undefined);assert.equal(source.guards,undefined);
 assert.deepEqual(fixture.pages.flatMap(p=>p.blocks.map(b=>({page:p.page,...b}))),source.blocks);assert.equal(fixture.pages.length,2);
 const triage=JSON.parse(readFileSync(new URL('../../ir/triage_example.ir.json',import.meta.url)));assert.deepEqual(triage.nodes[0].source,{page:source.blocks[3].page,bbox:source.blocks[3].bbox,text:source.blocks[3].text});
 const drafts=generateSourceDrafts(source.blocks,{documentSha:bundle.document_sha256,atcByBlock:{}});
 assert.deepEqual(drafts.nodes.map(x=>x.node.applies_to),[{atc:'P01BF01',icd10:'B50'},{atc:'J01XX01',sex:'F',age_years:{min:12,max:50}},{atc:'P01BF01',icd10:'J18'}]);
 assert.ok(drafts.nodes.every(x=>!x.node.parse_errors));
});
test('combined source attaches triage to the existing chart block without weakening provenance',t=>{
 const s=setup(t),bundle=JSON.parse(readFileSync(new URL('../../samples/dose-guide/bundle.json',import.meta.url))),bytes=readFileSync(new URL('../../samples/dose-guide/placeholder.pdf',import.meta.url)),triage=JSON.parse(readFileSync(new URL('../../ir/triage_example.ir.json',import.meta.url)));
 const src=uploadGuideline(s,{bytes,filename:'placeholder.pdf',documentId:bundle.document_id,contentType:'application/pdf',now:NOW});setMetadata(s,src.sha256,{edition:bundle.edition});digitise(s,src.sha256);
 const bad=structuredClone(triage.nodes[0]);bad.source.text='Not the chart source';assert.throws(()=>importTriageDraft(s,{document_sha256:src.sha256,block_id:bundle.triage_block_id,node:bad},{actor:'a',now:NOW}),/provenance/);
 const r=importTriageDraft(s,{document_sha256:src.sha256,node:triage.nodes[0]},{actor:'a',now:NOW});assert.equal(r.block_id,bundle.triage_block_id);assert.equal(r.node.id,src.sha256+'-'+bundle.triage_block_id);assert.equal(r.node.source.page,2);assert.deepEqual(r.approvals,[]);
 assert.equal(s.db.prepare('SELECT count(*) AS n FROM digitisations WHERE document_sha256=?').get(src.sha256).n,4);
 const mirrored=readFileSync(new URL('../../samples/triage/placeholder.pdf',import.meta.url));assert.deepEqual(mirrored,bytes);
});
test('Create drafts includes source-matched authored triage on the verification page',t=>{
 const s=setup(t),bundle=JSON.parse(readFileSync(new URL('../../samples/dose-guide/bundle.json',import.meta.url))),bytes=readFileSync(new URL('../../samples/dose-guide/placeholder.pdf',import.meta.url));
 const src=uploadGuideline(s,{bytes,filename:'placeholder.pdf',documentId:bundle.document_id,contentType:'application/pdf',now:NOW});setMetadata(s,src.sha256,{edition:bundle.edition});digitise(s,src.sha256);
 const drafts=generateDrafts(s,src.sha256,{atc_by_block:bundle.atc_by_block},{actor:'a',now:NOW});assert.equal(drafts.nodes.length,4);assert.deepEqual(drafts.unconverted,[]);
 const triage=drafts.nodes.find(x=>x.node.type==='scored_triage');assert.equal(triage.block.id,'b4');assert.equal(triage.node.source.page,2);assert.equal(triage.node.status,'draft');assert.deepEqual(triage.approvals,[]);assert.deepEqual(triage.node.parameters,bundle.authored_rules_by_block.b4.parameters);
 assert.deepEqual(generateDrafts(s,src.sha256,{atc_by_block:bundle.atc_by_block},{actor:'a',now:NOW}),drafts);
});
