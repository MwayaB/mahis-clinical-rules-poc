import { inputsHash } from './canonical.js';
export function evaluate(loadedPackage, ctx) {
 const advice=[];
 const add=(n,severity,message)=>advice.push({rule_id:n.id,severity,message,source_ref:n.source_ref});
 const missing=(n,field,severity='warn')=>add(n,severity,`${field} not recorded; cannot check ${n.id}`);
 if(ctx.proposed_atc==null||ctx.proposed_atc==='') {
  advice.push({rule_id:'input-proposed_atc',severity:'warn',message:'proposed_atc not recorded; cannot select rules',source_ref:'context:proposed_atc'});
 } else for(const n of loadedPackage.rules) {
  if(n.applies_to.atc!==ctx.proposed_atc) continue;
  if(n.type==='table') {
   const x=ctx[n.input];
   if(x==null) {missing(n,n.input,n.on_missing_input);if(ctx.proposed_tablets==null) missing(n,'proposed_tablets');continue;}
   if(typeof x!=='number'||!Number.isFinite(x)) throw new TypeError('Invalid table input');
   if(ctx.proposed_tablets==null) {missing(n,'proposed_tablets');continue;}
   if(!Number.isInteger(ctx.proposed_tablets)||ctx.proposed_tablets<0) throw new TypeError('Invalid proposed_tablets');
   const b=x>=n.coverage.min&&x<n.coverage.max?n.bands.find(b=>(x>b.min||b.min_inclusive&&x===b.min)&&(x<b.max||b.max_inclusive&&x===b.max)):undefined;
   if(!b) {add(n,n.on_no_band,`${n.input} outside supported bands; cannot check ${n.id}`);continue;}
   if(ctx.proposed_tablets!==b.value) {
    const tokens={input_value:x,value:b.value,unit:b.unit,observed:ctx.proposed_tablets};
    add(n,'warn',n.message_template.replace(/\{(input_value|value|unit|observed)\}/g,(_,k)=>String(tokens[k])));
   }
  } else if(n.type==='predicate') {
   const absent=Object.keys(n.when).filter(k=>ctx[k]==null).sort();
   if(absent.length) {for(const field of absent) missing(n,field);continue;}
   if(Object.entries(n.when).every(([k,v])=>ctx[k]===v)) add(n,n.severity,n.message);
  } else throw new Error('Unknown node type');
 }
 const rank={block:0,warn:1,info:2};
 const cmp=(a,b)=>a<b?-1:a>b?1:0;
 advice.sort((a,b)=>rank[a.severity]-rank[b.severity]||cmp(a.rule_id,b.rule_id)||cmp(a.message,b.message));
 return {advice,package_version:loadedPackage.manifest.package_version,engine_version:loadedPackage.engine_version,contains_placeholders:loadedPackage.manifest.contains_placeholders,inputs_hash:inputsHash(ctx)};
}
