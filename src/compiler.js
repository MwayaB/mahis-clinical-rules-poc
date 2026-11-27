import { getType } from './types/registry.js';
import { requireApprovals } from './approval.js';
import { defaultTerminology } from './terminology.js';
import { evaluate,assess,adviceFromAssessments } from './evaluator.js';
import { mkdirSync, writeFileSync, renameSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash, sign, createPrivateKey } from 'node:crypto';
import { canonicalStringify } from './canonical.js';
import { validateIR } from './ir.js';
export const ENGINE_VERSION='0.1.0';
export const sha256 = bytes=>createHash('sha256').update(bytes).digest('hex');
export function projectRules(ir) {
 return ir.nodes.map(n=>({id:n.id,type:n.type,...getType(n.type).serialise(n),source_ref:`${ir.document.id}:p${n.source.page}:${n.id}`}));
}
export function fixtureGate(rules,fixtures,terminology=defaultTerminology) {
 if(!Array.isArray(fixtures)) throw new Error('Fixtures must be an array');
 const evidence=new Map(rules.map(n=>[n.id,new Set()]));
 const pkg={rules,manifest:{package_version:'fixture',contains_placeholders:true,terminology_version:terminology.terminology_version},engine_version:ENGINE_VERSION};
 for(const f of fixtures) {
  if(!f||typeof f.name!=='string'||!f.ctx||!Array.isArray(f.expect)||!Array.isArray(f.kinds)||!f.kinds.length||f.kinds.some(k=>typeof k!=='string')||Object.keys(f).some(k=>!['name','ctx','expect','kinds','scope','node_id'].includes(k))) throw new Error('Invalid fixture '+f?.name+'; explicit kinds required');
  const scope=f.scope??(f.ctx.population!==undefined?'encounter':'patient'),actual=assess(pkg,f.ctx,{scope});
  let expectedView;
  if(scope==='patient'&&f.expect.every(e=>typeof e==='string')) expectedView=adviceFromAssessments(pkg,f.ctx,actual).map(a=>a.rule_id).sort();
  else {
   if(f.expect.some(e=>!e||!e.node_id||!e.status)) throw new Error('Incomplete triage fixture expectation '+f.name);
   expectedView=actual.map((r,i)=>{const expected=f.expect[i];if(!expected) return {};const view=Object.hasOwn(expected,'outcome')||Object.hasOwn(expected,'node_type')?r:getType(r.node_type).legacyResult?.(r,pkg)??r;return Object.fromEntries(Object.keys(expected).map(k=>[k,view[k]]));});
   for(const expected of f.expect) if(expected.status==='scored'&&(!Number.isSafeInteger(expected.score)||typeof expected.category!=='string')) throw new Error('Incomplete triage fixture expectation '+f.name);
  }
  const expected=f.expect.every(e=>typeof e==='string')?[...f.expect].sort():f.expect;
  if(canonicalStringify(expectedView)!==canonicalStringify(expected)) throw new Error('Fixture mismatch '+f.name+': '+rules.map(n=>n.id).join(', '));
  for(const result of actual) {
   if(f.node_id&&f.node_id!==result.node_id) continue;
   const type=getType(result.node_type),eligible=type.eligibleFixtureKinds?.(result)??[result.status];
   for(const kind of f.kinds) if(eligible.includes(kind)&&!f.ctx.terminology_changed) evidence.get(result.node_id).add(kind);
  }
 }
 for(const node of rules) {const type=getType(node.type),required=[...type.requiredFixtureKinds,...(type.fixtureVariants?.(node)??[])],missing=required.filter(k=>!evidence.get(node.id).has(k));if(missing.length) throw new Error(`${node.id}: positive and negative applicable fixtures required; fixture kinds missing ${missing.join(', ')}`);}
}
export function compile(ir,{dir,privateKey,fixtures,packageVersion='poc-0.1.0',terminology=defaultTerminology,reviewEvents=[]}) {
 const errors=validateIR(ir,terminology);
 if(errors.length) throw new Error(errors.join('\n'));
 requireApprovals(ir.nodes,reviewEvents);
 if(!/^poc-(?:demo-)?\d+\.\d+\.\d+$/.test(packageVersion)) throw new Error('Invalid package version');
 const rules=projectRules(ir); fixtureGate(rules,fixtures,terminology);
 const rulesBytes=Buffer.from(canonicalStringify(rules));
 const types=[...new Map(rules.map(n=>{const t=getType(n.type);return [t.name,{name:t.name,version:t.version}];})).values()].sort((a,b)=>a.name<b.name?-1:1);
 const manifest={types,package_version:packageVersion,terminology_version:terminology.terminology_version,ir_version:'0.1',engine_min_version:ENGINE_VERSION,contains_placeholders:ir.nodes.some(n=>n.placeholder),source_documents:[ir.document],rules_sha256:sha256(rulesBytes),node_count:rules.length,triage_nodes:rules.filter(n=>n.type==='scored_triage').length};
 const manifestBytes=Buffer.from(canonicalStringify(manifest));
 const key=privateKey?.type==='private'?privateKey:createPrivateKey(privateKey);
 if(key.asymmetricKeyType!=='ed25519') throw new Error('Ed25519 private key required');
 const signature=sign(null,manifestBytes,key);
 if(existsSync(dir)) throw new Error('Output already exists');
 mkdirSync(dirname(dir),{recursive:true});
 const staging=dir+'.staging';
 mkdirSync(staging);
 try {
  writeFileSync(join(staging,'rules.json'),rulesBytes);writeFileSync(join(staging,'manifest.json'),manifestBytes);writeFileSync(join(staging,'manifest.sig'),signature);
  renameSync(staging,dir);
 } catch(e) {rmSync(staging,{recursive:true,force:true});throw e;}
 return manifest;
}

