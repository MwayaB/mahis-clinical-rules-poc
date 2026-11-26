import { exact,ApiError } from './prototype/store.js';
import { getNode } from './review.js';
import { projectRules,fixtureGate } from './compiler.js';
import { listDrafts } from './draft.js';
import { validDay } from './events.js';
const contextKeys=['today','weight_kg','pregnant','proposed_atc','proposed_tablets'];
function validateEntries(entries) {
 if(!Array.isArray(entries)||entries.length>1000) throw new ApiError('Fixtures must be an array with at most 1000 entries');
 for(const f of entries) {
  exact(f,['name','ctx','expect']);if(typeof f.name!=='string'||!f.name.trim()||!Array.isArray(f.expect)||new Set(f.expect).size!==f.expect.length||f.expect.some(id=>typeof id!=='string')) throw new ApiError('Invalid fixture name or expectations');
  exact(f.ctx,contextKeys);
  if(!validDay(f.ctx.today)||f.ctx.weight_kg!==null&&(typeof f.ctx.weight_kg!=='number'||!Number.isFinite(f.ctx.weight_kg))||f.ctx.pregnant!==null&&typeof f.ctx.pregnant!=='boolean'||f.ctx.proposed_atc!==null&&typeof f.ctx.proposed_atc!=='string'||f.ctx.proposed_tablets!==null&&(!Number.isInteger(f.ctx.proposed_tablets)||f.ctx.proposed_tablets<0)) throw new ApiError('Invalid fixture context');
 }
}
export function saveFixtures(store,body) {
 exact(body,['node_id','entries']);const r=getNode(store,body.node_id);validateEntries(body.entries);
 const doc=listDrafts(store,r.document_sha256);const ids=new Set(doc.nodes.map(x=>x.node.id));
 if(body.entries.some(f=>f.expect.some(id=>!ids.has(id)))) throw new ApiError('Fixture expects unknown rule ID');
 store.db.prepare('INSERT INTO fixtures VALUES(?,?,?) ON CONFLICT(node_id) DO UPDATE SET content_hash=excluded.content_hash,entries=excluded.entries').run(body.node_id,r.content_hash,store.encode(body.entries));
 return getFixtures(store,body.node_id);
}
export function getFixtures(store,id) {
 const node=getNode(store,id),row=store.db.prepare('SELECT * FROM fixtures WHERE node_id=?').get(id);
 return {node_id:id,content_hash:row?.content_hash??null,stale:!!row&&row.content_hash!==node.content_hash,entries:row?JSON.parse(row.entries):[],generated:generateBoundaries([node.node])};
}
// Independent interval/equality oracle for generated boundary expectations, not clinical content generation.
function expectedIds(nodes,ctx) {
 return nodes.filter(n=>n.applies_to.atc===ctx.proposed_atc).filter(n=>{
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
   const ctx={today:'2026-01-01',weight_kg:x,pregnant:false,proposed_atc:n.applies_to.atc,proposed_tablets:tablets};
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
   fixtureGate(projectRules({document:{id:'fixture'},nodes:[n]}),f.entries.map(x=>({...x,expect:x.expect.filter(id=>id===n.id)})));
  } catch(e) {errors.push(`${n.id}: ${e.message}`);}
  entries.push(...f.entries);
 }
 if(errors.length) throw new ApiError(errors.join('\n'),409);
 const all=[...entries,...generateBoundaries(nodes)];
 fixtureGate(projectRules({document:{id:'fixture'},nodes}),all);
 return all;
}
