import { readFileSync } from 'node:fs';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../../src/prototype/store.js';
import { uploadGuideline,setMetadata } from '../../src/registry.js';
export const NOW='2026-01-01T10:00:00.000Z';
export function setup(t) {const root=mkdtempSync(join(tmpdir(),'prototype-'));const store=openStore(root);t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});return store;}
export function source(store) {const s=uploadGuideline(store,{bytes:Buffer.from('%PDF-PLACEHOLDER test bytes'),contentType:'application/pdf',filename:'placeholder.pdf',documentId:'PLACEHOLDER-GUIDE',now:NOW});return setMetadata(store,s.sha256,{edition:'placeholder-2026'});}
export const doseBlock={page:1,id:'b1',kind:'table',bbox:[40,120,560,380],text:'PLACEHOLDER weight table',cells:[['Weight (kg)','Tablets'],['5 to <15','1'],['15 to <25','2'],['25 to <35','3']]};
export async function httpEnvironment(t,{shipped=false}={}) {
 const { startServer }=await import('../../src/server.js');const {mkdirSync,writeFileSync}=await import('node:fs');const {sha256}=await import('../../src/compiler.js');
 const root=mkdtempSync(join(tmpdir(),'prototype-http-')),fixtureDir=join(root,'digitised');mkdirSync(fixtureDir);
 const bytes=shipped?(await import('node:fs')).readFileSync(new URL('../../samples/dose-guide/placeholder.pdf',import.meta.url)):Buffer.from('%PDF-PLACEHOLDER end to end fixture bytes'),hash=sha256(bytes);
 const {page,...b}=doseBlock;
 writeFileSync(join(fixtureDir,hash+'.json'),JSON.stringify({digitiser:'mock-fixture',document_sha256:hash,pages:[{page,blocks:[b,{id:'b2',kind:'paragraph',bbox:[40,60,560,110],text:'Pregnancy: not recommended (PLACEHOLDER text).'}]}]}));
 const app=await startServer({port:0,dataDir:join(root,'data'),keyDir:join(root,'keys'),fixtureDir:shipped?undefined:fixtureDir,clock:()=>NOW});
 t.after(async()=>{await app.close();rmSync(root,{recursive:true,force:true});});
 const request=async(path,body,options={})=>{
  const response=await fetch(app.url+path,{method:body===undefined?'GET':'POST',headers:body===undefined?{}:{'Content-Type':Buffer.isBuffer(body)?'application/pdf':'application/json'},...(body===undefined?{}:{body:Buffer.isBuffer(body)?body:JSON.stringify(body)}),...options});
  const data=await response.json();return {status:response.status,data};
 };
 const ok=async(path,body)=>{const r=await request(path,body);if(r.status>=400) throw Error(JSON.stringify(r));return r.data;};
 return {root,app,bytes,hash,request,ok};
}
export async function releasedHTTP(s) {
 const upload=await s.ok('/api/guidelines?filename=placeholder.pdf&document_id=PLACEHOLDER-GUIDE',s.bytes);
 await s.ok(`/api/guidelines/${upload.sha256}/metadata`,{edition:'placeholder-2026'});
 const digitisation=await s.ok(`/api/guidelines/${upload.sha256}/digitise`,{});
 const drafts=await s.ok(`/api/guidelines/${upload.sha256}/draft`,{atc_by_block:{b1:'P01BF01',b2:'J01XX01'}});
 for(const entry of drafts.nodes) {
  const n=entry.node;
  // Generic HTTP test fixture text has no indication; add explicit synthetic scope for these tests only.
  if(!n.applies_to.icd10&&n.type==='table') entry.node=(await s.ok(`/api/ir/${n.id}/edit`,{applies_to:{...n.applies_to,icd10:'B50'}})).node;
  if(n.type==='predicate'&&!n.applies_to.age_years) entry.node=(await s.ok(`/api/ir/${n.id}/edit`,{applies_to:{...n.applies_to,sex:'F',age_years:{min:12,max:50}}})).node;
  await s.ok(`/api/ir/${n.id}/approve`,{reviewer:'placeholder-reviewer-a'});await s.ok(`/api/ir/${n.id}/approve`,{reviewer:'placeholder-reviewer-b'});
  const scoped=entry.node,term=(await import('../../src/terminology.js')).defaultTerminology,code=term.codes.find(c=>c.code.startsWith(scoped.applies_to.icd10??''))?.code;
  const correct=n.type==='table'?n.bands.find(b=>b.min<=12&&b.max>12).value:1;
  const ctx={active_diagnoses:[{icd10:code,certainty:'confirmed',terminology_version:term.terminology_version}],sex:'F',age_years:30,today:'2026-01-01',weight_kg:12,pregnant:n.type==='predicate',proposed_atc:n.applies_to.atc,proposed_tablets:n.type==='table'?correct+1:2};
  await s.ok('/api/fixtures',{node_id:n.id,entries:[{name:'PLACEHOLDER positive',ctx,expect:[n.id]},{name:'PLACEHOLDER negative',ctx:{...ctx,...(n.type==='table'?{proposed_tablets:correct}:{pregnant:false})},expect:[]}]});
 }
 const release=await s.ok('/api/releases',{document_sha256:upload.sha256,version:'poc-demo-0.1.0'});return {upload,digitisation,drafts,release};
}
