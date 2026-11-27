import { defaultTerminology } from './terminology.js';
import { evaluate,triage } from './evaluator.js';
import { mkdirSync, writeFileSync, renameSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash, sign, createPrivateKey } from 'node:crypto';
import { canonicalStringify } from './canonical.js';
import { validateIR, tableFields, predicateFields,triageFields } from './ir.js';
export const ENGINE_VERSION='0.1.0';
export const sha256 = bytes=>createHash('sha256').update(bytes).digest('hex');
export function projectRules(ir) {
 return ir.nodes.map(n=>Object.fromEntries(['id','type',...(n.type==='table'?tableFields:n.type==='scored_triage'?triageFields:predicateFields)].map(k=>[k,n[k]]).concat([['source_ref',`${ir.document.id}:p${n.source.page}:${n.id}`]])));
}
function fixtureAdvice(rules,ctx,terminology) {
 return evaluate({rules,manifest:{package_version:'fixture',contains_placeholders:true,terminology_version:terminology.terminology_version},engine_version:ENGINE_VERSION},Object.freeze(ctx)).advice.map(n=>n.rule_id).sort();
}
export function fixtureGate(rules,fixtures,terminology=defaultTerminology) {
 if(!Array.isArray(fixtures)) throw new Error('Fixtures must be an array');
 const scored=rules.filter(n=>n.type==='scored_triage'),ordinary=rules.filter(n=>n.type!=='scored_triage');
 const triageFixtures=fixtures.filter(f=>f?.ctx?.population!==undefined||f?.expect?.some(e=>typeof e==='object'));
 if(scored.length) triageFixtureGate(scored,triageFixtures);else if(triageFixtures.length) throw new Error('Triage fixtures without triage rules');
 rules=ordinary;fixtures=fixtures.filter(f=>!triageFixtures.includes(f));
 const counts=new Map(rules.map(n=>[n.id,{positive:0,negative:0}]));
 for(const f of fixtures) {
  if(!f||Object.keys(f).some(k=>!['name','ctx','expect'].includes(k))||typeof f.name!=='string'||!Array.isArray(f.expect)||new Set(f.expect).size!==f.expect.length||f.expect.some(id=>!counts.has(id))) throw new Error('Invalid fixture '+f?.name);
  const actual=fixtureAdvice(rules,f.ctx,terminology);
  if(canonicalStringify(actual)!==canonicalStringify([...f.expect].sort())) throw new Error('Fixture mismatch '+f.name+': '+rules.map(n=>n.id).join(', '));
  for(const n of rules) if(f.ctx.proposed_atc===n.applies_to.atc) {
   const a=n.applies_to;
   if(a.sex&&f.ctx.sex!==a.sex||a.age_years&&(f.ctx.age_years==null||f.ctx.age_years<a.age_years.min||f.ctx.age_years>a.age_years.max)||a.icd10&&!(f.ctx.active_diagnoses??[]).some(d=>['confirmed','presumptive'].includes(d.certainty)&&d.terminology_version===terminology.terminology_version&&d.icd10.startsWith(a.icd10))) continue;
   if(f.ctx.terminology_changed) continue;
   // Missing inputs and unrelated ATCs do not establish a clinical positive or negative.
   const required=n.type==='table'?[n.input,'proposed_tablets']:Object.keys(n.when);
   if(required.every(k=>f.ctx[k]!==null&&f.ctx[k]!==undefined)) counts.get(n.id)[f.expect.includes(n.id)?'positive':'negative']++;
  }
 }
 for(const [id,c] of counts) if(!c.positive||!c.negative) throw new Error(`${id}: positive and negative applicable fixtures required`);
}
export function compile(ir,{dir,privateKey,fixtures,packageVersion='poc-0.1.0',terminology=defaultTerminology}) {
 const errors=validateIR(ir,terminology);
 for(const n of ir?.nodes??[]) if(n.status==='draft') errors.push(`${n.id}: draft refused`);
 if(errors.length) throw new Error(errors.join('\n'));
 if(!/^poc-(?:demo-)?\d+\.\d+\.\d+$/.test(packageVersion)) throw new Error('Invalid package version');
 const rules=projectRules(ir); fixtureGate(rules,fixtures,terminology);
 const rulesBytes=Buffer.from(canonicalStringify(rules));
 const manifest={package_version:packageVersion,terminology_version:terminology.terminology_version,ir_version:'0.1',engine_min_version:ENGINE_VERSION,contains_placeholders:ir.nodes.some(n=>n.placeholder),source_documents:[ir.document],rules_sha256:sha256(rulesBytes),node_count:rules.length,triage_nodes:rules.filter(n=>n.type==='scored_triage').length};
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

export function triageFixtureGate(rules,fixtures) {
 const counts=new Map(rules.map(n=>[n.id,new Set()]));
 const pkg={rules,manifest:{package_version:'fixture',contains_placeholders:true},engine_version:ENGINE_VERSION};
 const keys=['node_id','status','score','category','missing','input','value','components','overrides_fired'];
 for(const f of fixtures) {
  if(!f||typeof f.name!=='string'||!f.ctx||!Array.isArray(f.expect)||Object.keys(f).some(k=>!['name','ctx','expect'].includes(k))||f.expect.some(e=>!e||!counts.has(e.node_id)||Object.keys(e).some(k=>!keys.includes(k)))) throw new Error('Invalid triage fixture '+f?.name);
  const result=triage(pkg,f.ctx),projected=result.map((r,i)=>Object.fromEntries(Object.keys(f.expect[i]??{}).map(k=>[k,r[k]])));
  if(result.length!==f.expect.length||canonicalStringify(projected)!==canonicalStringify(f.expect)) throw new Error('Triage fixture mismatch '+f.name);
  for(const r of result) {counts.get(r.node_id).add(r.status);if(r.status==='scored') counts.get(r.node_id).add('category:'+r.category);}
 }
 for(const n of rules) for(const required of ['scored','incomplete','invalid',...n.categories_order.map(c=>'category:'+c)]) if(!counts.get(n.id).has(required)) throw new Error(`${n.id}: triage fixture coverage missing ${required}`);
}
