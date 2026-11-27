import { inputsHash } from './canonical.js';
import { getType } from './types/registry.js';
import { invalidInput } from './domains.js';
function applicability(node,ctx) {
 const a=node.applies_to??{},missing=[];
 if(node.scope?.population!==undefined&&node.scope.population!==ctx.population) return {skip:true};
 if(a.atc&&ctx.proposed_atc!=null&&a.atc!==ctx.proposed_atc||a.sex&&ctx.sex!=null&&a.sex!==ctx.sex||a.age_years&&ctx.age_years!=null&&(ctx.age_years<a.age_years.min||ctx.age_years>a.age_years.max)) return {skip:true};
 if(a.atc&&ctx.proposed_atc==null) missing.push('proposed_atc');if(a.sex&&ctx.sex==null) missing.push('sex');if(a.age_years&&ctx.age_years==null) missing.push('age_years');
 if(a.icd10) {const active=(ctx.active_diagnoses??[]).filter(d=>['confirmed','presumptive'].includes(d.certainty));if(active.length&&!active.some(d=>d.icd10.startsWith(a.icd10))) return {skip:true};if(!active.length) missing.push('active_diagnoses');if(active.length&&(ctx.terminology_changed||active.some(d=>d.terminology_version!==ctx.terminology_version))) return {invalid:[{input:'terminology_version',value:ctx.terminology_version??null,reason:'terminology changed'}]};}
 return {missing};
}
export function assess(loadedPackage,inputs,{scope='all',nodeIds}={}) {
 const ctx={...inputs,terminology_version:inputs.terminology_version??loadedPackage.manifest.terminology_version};
 const hash='sha256:'+inputsHash(inputs),results=[];
 for(const node of [...loadedPackage.rules].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)) {
  const type=getType(node.type);if(scope!=='all'&&type.scope!==scope||nodeIds&&!nodeIds.includes(node.id)) continue;
  const applicable=applicability(node,ctx);if(applicable.skip) continue;
  const required=type.requiredInputs(node),missing=[...new Set([...(applicable.missing??[]),...required.filter(d=>ctx[d.name]==null).map(d=>d.name)])].sort();
  const base={node_id:node.id,node_type:node.type,missing:[],invalid:[],payload:{renderer:type.renderer},package_version:loadedPackage.manifest.package_version,engine_version:loadedPackage.engine_version,inputs_hash:hash};
  if(missing.length) {results.push({...base,status:'incomplete',missing});continue;}
  const invalid=applicable.invalid??required.flatMap(d=>{const reason=invalidInput(d,ctx[d.name]);return reason?[{input:d.name,value:ctx[d.name],reason}]:[];});
  if(invalid.length) {results.push({...base,status:'invalid',invalid});continue;}
  const result=type.evaluate(node,ctx,{package:loadedPackage});
  if(!['ok','advice'].includes(result.status)||!result.outcome||typeof result.outcome!=='object') throw new Error('Type violated complete-input result contract: '+type.name);
  results.push({...base,status:result.status,outcome:result.outcome,payload:{...result.payload,renderer:type.renderer,actions:type.allowedActions?.(node,result)??[]}});
 }
 return results;
}
export function adviceFromAssessments(pkg,ctx,results) {
 if(ctx.proposed_atc==null||ctx.proposed_atc==='') return [{rule_id:'input-proposed_atc',severity:'warn',message:'proposed_atc not recorded; cannot select rules',source_ref:'context:proposed_atc'}];
 const advice=[];
 for(const result of results) {
  const node=pkg.rules.find(n=>n.id===result.node_id);if(getType(node.type).renderer!=='advice') continue;
  const add=(severity,message)=>advice.push({rule_id:node.id,severity,message,source_ref:node.source_ref});
  if(result.outcome) advice.push(...result.outcome.items);
  else if(result.status==='incomplete') {
   const applicability=result.missing.filter(k=>['sex','age_years'].includes(k));
   if(result.missing.includes('active_diagnoses')) add('warn',`no indication recorded; cannot check ${node.id}`);
   else for(const input of applicability.length?applicability:result.missing) add(input===node.input?node.on_missing_input??'warn':'warn',`${input} not recorded; cannot check ${node.id}`);
  } else if(result.invalid.some(v=>v.input==='terminology_version')) add('warn',`terminology changed; cannot check ${node.id}`);
  else if(node.input&&result.invalid.some(v=>v.input===node.input&&v.reason==='outside declared domain')) add(node.on_no_band,`${node.input} outside supported bands; cannot check ${node.id}`);
  else throw new TypeError('Invalid '+(node.input?'table':'predicate')+' input');
 }
 const rank={block:0,warn:1,info:2};return advice.sort((a,b)=>rank[a.severity]-rank[b.severity]||(a.rule_id<b.rule_id?-1:a.rule_id>b.rule_id?1:0)||(a.message<b.message?-1:a.message>b.message?1:0));
}
export function evaluate(pkg,ctx) {return {advice:adviceFromAssessments(pkg,ctx,assess(pkg,ctx,{scope:'patient'})),package_version:pkg.manifest.package_version,engine_version:pkg.engine_version,contains_placeholders:pkg.manifest.contains_placeholders,inputs_hash:inputsHash(ctx)};}
export function triage(pkg,ctx) {return assess(pkg,ctx,{scope:'encounter'}).map(r=>getType(r.node_type).legacyResult?.(r,pkg)??r);}
