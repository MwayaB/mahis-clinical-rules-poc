import { mkdirSync, writeFileSync, renameSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash, sign } from 'node:crypto';
import { canonicalStringify } from './canonical.js';
import { validateIR, tableFields, predicateFields } from './ir.js';
export const ENGINE_VERSION='0.1.0';
export const sha256 = bytes=>createHash('sha256').update(bytes).digest('hex');
export function projectRules(ir) {
 return ir.nodes.map(n=>Object.fromEntries(['id','type',...(n.type==='table'?tableFields:predicateFields)].map(k=>[k,n[k]]).concat([['source_ref',`${ir.document.id}:p${n.source.page}:${n.id}`]])));
}
// Replaced by the production evaluator once Part 5 is implemented.
function fixtureAdvice(rules,ctx) {
 if(ctx.proposed_atc==null) throw new Error('fixture proposed_atc required');
 return rules.filter(n=>n.applies_to.atc===ctx.proposed_atc).filter(n=>{
  if(n.type==='predicate') return Object.entries(n.when).some(([k])=>ctx[k]==null)||Object.entries(n.when).every(([k,v])=>ctx[k]===v);
  if(ctx[n.input]==null||ctx.proposed_tablets==null) return true;
  const b=n.bands.find(b=>(ctx[n.input]>b.min||b.min_inclusive&&ctx[n.input]===b.min)&&(ctx[n.input]<b.max||b.max_inclusive&&ctx[n.input]===b.max));
  return !b||b.value!==ctx.proposed_tablets;
 }).map(n=>n.id).sort();
}
export function fixtureGate(rules,fixtures) {
 if(!Array.isArray(fixtures)) throw new Error('Fixtures must be an array');
 const counts=new Map(rules.map(n=>[n.id,{positive:0,negative:0}]));
 for(const f of fixtures) {
  if(!f||Object.keys(f).some(k=>!['name','ctx','expect'].includes(k))||typeof f.name!=='string'||!Array.isArray(f.expect)||new Set(f.expect).size!==f.expect.length||f.expect.some(id=>!counts.has(id))) throw new Error('Invalid fixture '+f?.name);
  const actual=fixtureAdvice(rules,f.ctx);
  if(canonicalStringify(actual)!==canonicalStringify([...f.expect].sort())) throw new Error('Fixture mismatch '+f.name+': '+rules.map(n=>n.id).join(', '));
  for(const n of rules) if(f.ctx.proposed_atc===n.applies_to.atc) {
   // Missing inputs and unrelated ATCs do not establish a clinical positive or negative.
   const required=n.type==='table'?[n.input,'proposed_tablets']:Object.keys(n.when);
   if(required.every(k=>f.ctx[k]!==null&&f.ctx[k]!==undefined)) counts.get(n.id)[f.expect.includes(n.id)?'positive':'negative']++;
  }
 }
 for(const [id,c] of counts) if(!c.positive||!c.negative) throw new Error(`${id}: positive and negative applicable fixtures required`);
}
export function compile(ir,{dir,privateKey,fixtures,packageVersion='poc-0.1.0'}) {
 const errors=validateIR(ir);
 for(const n of ir?.nodes??[]) if(n.status==='draft') errors.push(`${n.id}: draft refused`);
 if(errors.length) throw new Error(errors.join('\n'));
 if(!/^poc-\d+\.\d+\.\d+$/.test(packageVersion)) throw new Error('Invalid package version');
 const rules=projectRules(ir); fixtureGate(rules,fixtures);
 const rulesBytes=Buffer.from(canonicalStringify(rules));
 const manifest={package_version:packageVersion,ir_version:'0.1',engine_min_version:ENGINE_VERSION,contains_placeholders:ir.nodes.some(n=>n.placeholder),source_documents:[ir.document],rules_sha256:sha256(rulesBytes),node_count:rules.length};
 const manifestBytes=Buffer.from(canonicalStringify(manifest));
 const signature=sign(null,manifestBytes,privateKey);
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
