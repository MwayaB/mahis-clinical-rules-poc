import { triageEntry } from './plausibility.js';
import { defaultTerminology,isKnownCode } from './terminology.js';
import { exact,ApiError } from './prototype/store.js';
import { getNode } from './review.js';
import { projectRules,fixtureGate } from './compiler.js';
import { listDrafts } from './draft.js';
import { validDay } from './events.js';
const contextKeys=['today','weight_kg','pregnant','proposed_atc','proposed_tablets','sex','age_years','active_diagnoses'];
function validateEntries(entries,triageMode=false) {
 if(!Array.isArray(entries)||entries.length>1000) throw new ApiError('Fixtures must be an array with at most 1000 entries');
 for(const f of entries) {
  if(triageMode) {
   exact(f,['name','ctx','expect']);exact(f.ctx,['population','encounter_id',...triageEntry.fields.map(x=>x.input)],['population']);
   if(typeof f.name!=='string'||!f.name.trim()||typeof f.ctx.population!=='string'||!Array.isArray(f.expect)||f.expect.some(e=>!e||typeof e.node_id!=='string')) throw new ApiError('Invalid triage fixture');
   continue;
  }
  exact(f,['name','ctx','expect']);if(typeof f.name!=='string'||!f.name.trim()||!Array.isArray(f.expect)||new Set(f.expect).size!==f.expect.length||f.expect.some(id=>typeof id!=='string')) throw new ApiError('Invalid fixture name or expectations');
  exact(f.ctx,contextKeys,['today','weight_kg','pregnant','proposed_atc','proposed_tablets']);
  if(f.ctx.active_diagnoses!==undefined&&(!Array.isArray(f.ctx.active_diagnoses)||f.ctx.active_diagnoses.some(d=>!d||!isKnownCode(defaultTerminology,d.icd10)||typeof d.terminology_version!=='string'||!d.terminology_version||!['confirmed','presumptive','suspected','ruled-out'].includes(d.certainty)))) throw new ApiError('Invalid fixture diagnoses');
  if(!validDay(f.ctx.today)||f.ctx.weight_kg!==null&&(typeof f.ctx.weight_kg!=='number'||!Number.isFinite(f.ctx.weight_kg))||f.ctx.pregnant!==null&&typeof f.ctx.pregnant!=='boolean'||f.ctx.proposed_atc!==null&&typeof f.ctx.proposed_atc!=='string'||f.ctx.proposed_tablets!==null&&(!Number.isInteger(f.ctx.proposed_tablets)||f.ctx.proposed_tablets<0)) throw new ApiError('Invalid fixture context');
 }
}
export function saveFixtures(store,body) {
 exact(body,['node_id','entries']);const r=getNode(store,body.node_id);validateEntries(body.entries,r.node.type==='scored_triage');
 const doc=listDrafts(store,r.document_sha256);const ids=new Set(doc.nodes.map(x=>x.node.id));
 if(body.entries.some(f=>f.expect.some(id=>!ids.has(typeof id==='string'?id:id.node_id)))) throw new ApiError('Fixture expects unknown rule ID');
 store.db.prepare('INSERT INTO fixtures VALUES(?,?,?) ON CONFLICT(node_id) DO UPDATE SET content_hash=excluded.content_hash,entries=excluded.entries').run(body.node_id,r.content_hash,store.encode(body.entries));
 return getFixtures(store,body.node_id);
}
export function getFixtures(store,id) {
 const node=getNode(store,id),row=store.db.prepare('SELECT * FROM fixtures WHERE node_id=?').get(id);
 return {node_id:id,content_hash:row?.content_hash??null,stale:!!row&&row.content_hash!==node.content_hash,entries:row?JSON.parse(row.entries):[],generated:generateBoundaries([node.node])};
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
   const ctx={sex:n.applies_to.sex??'F',age_years:n.applies_to.age_years?.min??30,active_diagnoses:n.applies_to.icd10?[{icd10:defaultTerminology.codes.find(c=>c.code.startsWith(n.applies_to.icd10))?.code??n.applies_to.icd10,certainty:'confirmed',terminology_version:defaultTerminology.terminology_version}]:[],today:'2026-01-01',weight_kg:x,pregnant:false,proposed_atc:n.applies_to.atc,proposed_tablets:tablets};
   fixtures.push({name:`PLACEHOLDER boundary ${n.id} band ${index} weight ${x} tablets ${tablets}`,ctx,expect:expectedIds(nodes,ctx)});
  }
 }
 return fixtures;
}
export function releaseFixtures(store,sha) {
 const nodes=listDrafts(store,sha).nodes.map(x=>x.node),errors=[],entries=[];
 for(const n of nodes) {
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
