import { openStore } from '../src/prototype/store.js';
import { uploadGuideline,setMetadata } from '../src/registry.js';
import { importRuleDraft,approveNode } from '../src/review.js';
import { readReviewEvents } from '../src/approval.js';
import assert from 'node:assert/strict';
import { readFileSync,writeFileSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { compile } from '../src/compiler.js';
import { openEventLog } from '../src/events.js';
import { register,observe,diagnose,status,prescribe } from '../src/workflow.js';
const read=path=>JSON.parse(readFileSync(new URL(path,import.meta.url)));
const sample=read('../samples/dose-guide/bundle.json');
const dose=read('../ir/dose_band_example.ir.json'),pregnancy=read('../ir/contraindication_example.ir.json');
const root=mkdtempSync(join(tmpdir(),'placeholder-demo-')),keys=generateKeyPairSync('ed25519');
const publicPath=join(root,'public.pem');writeFileSync(publicPath,keys.publicKey.export({type:'spki',format:'pem'}));
const dir=join(root,'package'),db=openEventLog(join(root,'events.db'));
let id=0;const args=patientId=>({db,patientId,today:'2026-01-01',occurredAt:'2026-01-01T10:00:00.000Z',eventId:'demo-'+(++id)});
try {
 const store=openStore(join(root,'review'));
 const source=uploadGuideline(store,{bytes:readFileSync(new URL('../samples/dose-guide/placeholder.pdf',import.meta.url)),contentType:'application/pdf',filename:'placeholder.pdf',documentId:dose.document.id,now:args('child').occurredAt});setMetadata(store,source.sha256,{edition:dose.document.edition});
 for(const node of [...dose.nodes,...pregnancy.nodes]) {importRuleDraft(store,{document_sha256:source.sha256,node},{actor:'placeholder-editor',now:args('child').occurredAt});for(const reviewer of ['placeholder-reviewer-a','placeholder-reviewer-b']) approveNode(store,node.id,{reviewer},{now:args('child').occurredAt});}
 const reviewEvents=readReviewEvents(store);store.close();
 compile({...dose,nodes:[...dose.nodes,...pregnancy.nodes]},{dir,privateKey:keys.privateKey,reviewEvents,fixtures:[...read('../fixtures/dose_band_example.fixtures.json'),...read('../fixtures/contraindication_example.fixtures.json')]});
 const check=(patientId,atc,tablets,label)=>{const r=prescribe({...args(patientId),atc,tablets,packageDir:dir,trustedPublicKeys:[publicPath],eventIds:{prescription:'rx-'+(++id),advice:'advice-'+(++id)}});console.log(label+'\n'+JSON.stringify(r.result,null,2));return r;};
 register({...args('child'),name:'PLACEHOLDER child',sex:'M',age_years:4});
 observe({...args('child'),field:'weight_kg',value:15});
 const atc=dose.nodes[0].applies_to.atc;
 assert.match(check('child',atc,1,'Child age 4, weight 15 kg, no diagnosis').result.advice[0].message,/no indication recorded/);
 diagnose({...args('child'),...sample.demo_diagnoses.child});
 assert.equal(check('child',atc,1,'Child with confirmed malaria: wrong dose').result.advice[0].severity,'warn');
 assert.deepEqual(check('child',atc,2,'Child with confirmed malaria: correct placeholder dose').result.advice,[]);
 register({...args('adult'),name:'PLACEHOLDER adult pregnancy example',sex:'F',age_years:30});
 observe({...args('adult'),field:'weight_kg',value:60});status({...args('adult'),field:'pregnant',value:true});
 assert.equal(check('adult',pregnancy.nodes[0].applies_to.atc,1,'Adult age 30: pregnancy advice').result.advice[0].severity,'block');
 console.log('Demo assertions passed. All clinical values are placeholders.');
} finally {db.close();rmSync(root,{recursive:true,force:true});}
