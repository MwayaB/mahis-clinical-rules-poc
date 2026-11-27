import { fields,nonempty,object } from '../schema.js';
import { triageFields,validateTriage } from '../triage-ir.js';
const includes=(b,value)=>(value>b.min||b.min_inclusive&&value===b.min)&&(value<b.max||b.max_inclusive&&value===b.max);
export const triageType={
 name:'scored_triage',version:'1.0.0',nodeKinds:['scored_triage'],fields:triageFields,
 validate:n=>{const errors=[];validateTriage(n,{fields,nonempty,object},errors);return errors;},
 serialise:n=>Object.fromEntries(triageFields.map(k=>[k,n[k]])),
 requiredInputs:n=>n.parameters.map(p=>({name:p.input,kind:p.kind==='numeric'?'numeric':'ordinal',domain:p.kind==='numeric'?{...p.coverage,min_inclusive:true,max_inclusive:false}:{values:p.levels.map(l=>l.value)}})),
 evaluate(n,ctx) {
  const components=n.parameters.map(p=>{const value=ctx[p.input],index=p.kind==='numeric'?p.bands.findIndex(b=>includes(b,value)):p.levels.findIndex(l=>l.value===value),band=(p.kind==='numeric'?p.bands:p.levels)[index];if(!band) throw new Error('Validated triage input has no band');return {name:p.name,value,points:band.points,band_id:`${p.name}:${p.kind}:${index}`};});
  const score=components.reduce((sum,c)=>sum+c.points,0),scoreBand=n.score_bands.find(b=>includes(b,score));if(!scoreBand) throw new Error('Validated triage score is not covered');
  const overrides=n.overrides.filter(o=>Object.entries(o.when).every(([k,v])=>ctx[k]===v)),candidates=[scoreBand.category,...overrides.map(o=>o.category)];
  const category=candidates.reduce((highest,candidate)=>n.categories_order.indexOf(candidate)>n.categories_order.indexOf(highest)?candidate:highest);
  return {status:'ok',outcome:{category},payload:{score,components,overrides_fired:overrides.map(o=>o.id)}};
 },
 legacyResult:(r,pkg)=>({node_id:r.node_id,package_version:r.package_version,engine_version:r.engine_version,contains_placeholders:pkg.manifest.contains_placeholders,inputs_hash:r.inputs_hash.slice('sha256:'.length),...(r.status==='incomplete'?{status:r.status,missing:r.missing}:r.status==='invalid'?{status:r.status,input:r.invalid[0].input,value:r.invalid[0].value}:{status:'scored',score:r.payload.score,category:r.outcome.category,components:r.payload.components,overrides_fired:r.payload.overrides_fired})}),
 eligibleFixtureKinds:r=>r.outcome?['scored','category:'+r.outcome.category]:[r.status],
 requiredFixtureKinds:['scored','incomplete','invalid'],fixtureVariants:n=>n.categories_order.map(c=>'category:'+c),scope:'encounter',renderer:'category',allowedActions:n=>n.categories_order
};
