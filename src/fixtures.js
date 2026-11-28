import { getType } from './types/registry.js';
import { inputCatalog } from './inputs.js';
import { canonicalStringify } from './canonical.js';
import { readFileSync } from 'node:fs';
const fixtureDefaults=JSON.parse(readFileSync(new URL('../samples/fixture-defaults.json',import.meta.url)));
import { defaultTerminology,isKnownCode } from './terminology.js';
import { exact,ApiError } from './prototype/store.js';
import { getNode } from './review.js';
import { projectRules,fixtureGate } from './compiler.js';
import { listDrafts } from './draft.js';
function validateEntries(entries,node) {
 if(!Array.isArray(entries)||entries.length>1000) throw new ApiError('Fixtures must be an array with at most 1000 entries');
 const allowed=[...new Set([...inputCatalog.map(d=>d.name),...getType(node.type).requiredInputs(node).map(d=>d.name),'population','encounter_id','active_diagnoses','terminology_version','terminology_changed'])];
 for(const f of entries) {
  exact(f,['name','ctx','expect','kinds','scope','node_id'],['name','ctx','expect','kinds']);exact(f.ctx,allowed,[]);
  if(typeof f.name!=='string'||!f.name.trim()||!Array.isArray(f.expect)||!Array.isArray(f.kinds)||!f.kinds.length||f.kinds.some(k=>typeof k!=='string'||!k)) throw new ApiError('Invalid fixture metadata or kinds');
  if(f.ctx.active_diagnoses!==undefined&&(!Array.isArray(f.ctx.active_diagnoses)||f.ctx.active_diagnoses.some(d=>!d||!isKnownCode(defaultTerminology,d.icd10)||typeof d.terminology_version!=='string'||!['confirmed','presumptive','suspected','ruled-out'].includes(d.certainty)))) throw new ApiError('Invalid fixture diagnoses');
  try{canonicalStringify(f);}catch(e){throw new ApiError('Invalid fixture JSON: '+e.message);}
 }
}
export function saveFixtures(store,body) {
 exact(body,['node_id','entries']);const r=getNode(store,body.node_id);validateEntries(body.entries,r.node);
 const doc=listDrafts(store,r.document_sha256);const ids=new Set(doc.nodes.map(x=>x.node.id));
 if(body.entries.some(f=>f.expect.some(id=>!ids.has(typeof id==='string'?id:id.node_id)))) throw new ApiError('Fixture expects unknown rule ID');
 store.db.prepare('INSERT INTO fixtures VALUES(?,?,?) ON CONFLICT(node_id) DO UPDATE SET content_hash=excluded.content_hash,entries=excluded.entries').run(body.node_id,r.content_hash,store.encode(body.entries));
 return getFixtures(store,body.node_id);
}
export function getFixtures(store,id) {
 const node=getNode(store,id),row=store.db.prepare('SELECT * FROM fixtures WHERE node_id=?').get(id);
 return {node_id:id,content_hash:row?.content_hash??null,stale:!!row&&row.content_hash!==node.content_hash,entries:row?JSON.parse(row.entries):[],generated:generateBoundaries([node.node])};
}
// Only the unchanged checksum-matched sample can receive its pre-authored checks automatically.
// Never create expectations from evaluator output or silently bless a changed rule.
export function prepareSampleFixtures(store,id) {
 const r=getNode(store,id);
 if(store.db.prepare('SELECT 1 FROM fixtures WHERE node_id=?').get(id)) return;
 const sample=JSON.parse(readFileSync(new URL('../samples/dose-guide/bundle.json',import.meta.url)));
 if(r.document_sha256!==sample.document_sha256||!sample.fixtures[r.block_id]) return;
 const original=store.db.prepare("SELECT after_hash FROM review_events WHERE node_id=? AND kind='draft-created' ORDER BY seq LIMIT 1").get(id);
 if(original?.after_hash!==r.content_hash) return;
 const entries=sample.fixtures[r.block_id];
 fixtureGate(projectRules({document:{id:'fixture'},nodes:[r.node]}),entries);
 saveFixtures(store,{node_id:id,entries});
}
export function runChecks(store,id) {
 const r=getNode(store,id);
 let details={content_hash:r.content_hash};
 try {
  prepareSampleFixtures(store,id);
  const f=getFixtures(store,id),rules=projectRules({document:{id:'fixture'},nodes:[r.node]});
  details={...details,authored:f.entries,generated:f.generated};
  if(f.stale||!f.entries.length) return {status:'needs_attention',message:f.stale?'This rule has changed. The rule author or technical team needs to review its automated checks.':'Automated checks have not been supplied. The rule author or technical team needs to add them before release.',details};
  const entries=f.entries.map(x=>({...x,expect:x.expect.filter(e=>(typeof e==='string'?e:e.node_id)===id)}));
  fixtureGate(rules,entries);fixtureGate(rules,[...entries,...f.generated]);
  return {status:'passed',message:'Automated examples and boundary checks passed. Review the guideline interpretation and use the EMR demo to explore patient examples.',details};
 } catch(e) {return {status:'needs_attention',message:'An automated check could not pass. The rule author or technical team needs to investigate before release.',details:{...details,error:e.message}};}
}
// Independent interval/equality oracle for generated boundary expectations, not clinical content generation.
function expectedIds(nodes,ctx) {
 return nodes.filter(n=>n.type!=='scored_triage'&&n.applies_to.atc===ctx.proposed_atc).filter(n=>{
  const a=n.applies_to;
  if(a.sex&&ctx.sex!=null&&ctx.sex!==a.sex||a.age_years&&ctx.age_years!=null&&(ctx.age_years<a.age_years.min||ctx.age_years>a.age_years.max)) return false;
  if(a.icd10) {
   const ds=(ctx.active_diagnoses??[]).filter(d=>['confirmed','presumptive'].includes(d.certainty));
   if(!ds.length) return true;
   if(!ds.some(d=>d.icd10.startsWith(a.icd10))) return false;
  }
  if(a.sex&&ctx.sex==null||a.age_years&&ctx.age_years==null) return true;
  if(n.type==='predicate') return Object.entries(n.when).some(([k])=>ctx[k]==null)||Object.entries(n.when).every(([k,v])=>ctx[k]===v);
  const v=ctx[n.input],b=n.bands.find(b=>(b.min_inclusive?v>=b.min:v>b.min)&&(b.max_inclusive?v<=b.max:v<b.max));
  return !b||v<n.coverage.min||v>=n.coverage.max||b.value!==ctx.proposed_tablets;
 }).map(n=>n.id).sort();
}
export function generateBoundaries(nodes) {
 const fixtures=[];
 for(const n of nodes.filter(n=>n.type==='table')) for(const [index,b] of n.bands.entries()) for(const x of [b.min,b.min-0.01,b.max-0.01,b.max]) {
  if(!Number.isFinite(x)||!Number.isSafeInteger(b.value)) continue;
  for(const tablets of [b.value,b.value+1]) {
   const ctx={sex:n.applies_to.sex??fixtureDefaults.sex,age_years:n.applies_to.age_years?.min??fixtureDefaults.age_years,active_diagnoses:n.applies_to.icd10?[{icd10:defaultTerminology.codes.find(c=>c.code.startsWith(n.applies_to.icd10))?.code??n.applies_to.icd10,certainty:'confirmed',terminology_version:defaultTerminology.terminology_version}]:[],today:fixtureDefaults.today,weight_kg:x,pregnant:false,proposed_atc:n.applies_to.atc,proposed_tablets:tablets};
   fixtures.push({scope:'patient',kinds:[x<n.coverage.min||x>=n.coverage.max?'invalid':tablets===b.value?'negative':'positive'],name:`PLACEHOLDER boundary ${n.id} band ${index} weight ${x} tablets ${tablets}`,ctx,expect:expectedIds(nodes,ctx)});
  }
 }
 return fixtures;
}
export function releaseFixtures(store,sha) {
 const nodes=listDrafts(store,sha).nodes.map(x=>x.node),errors=[],entries=[];
 for(const n of nodes) {
  prepareSampleFixtures(store,n.id);
  const f=getFixtures(store,n.id);
  if(f.stale||!f.entries.length) {errors.push(`${n.id}: missing or stale authored fixtures`);continue;}
  try {
   // Author coverage cannot be satisfied by generated boundaries or other nodes.
   fixtureGate(projectRules({document:{id:'fixture'},nodes:[n]}),f.entries.map(x=>({...x,expect:x.expect.filter(id=>(typeof id==='string'?id:id.node_id)===n.id)})));
  } catch(e) {errors.push(`${n.id}: ${e.message}`);}
  entries.push(...f.entries);
 }
 if(errors.length) throw new ApiError(errors.join('\n'),409);
 const all=[...entries,...generateBoundaries(nodes)];
 fixtureGate(projectRules({document:{id:'fixture'},nodes}),all);
 return all;
}
