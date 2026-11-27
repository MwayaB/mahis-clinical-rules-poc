export function validateTriageResults(results,{fields,nonempty},errors) {
 if(!Array.isArray(results)||!results.length) {errors.push('triage results required');return;}
 const ids=new Set(),base=['node_id','status','package_version','engine_version','contains_placeholders','inputs_hash'];
 for(const r of results) {
  const more=r?.status==='scored'?['score','category','components','overrides_fired']:r?.status==='incomplete'?['missing']:r?.status==='invalid'?['input','value']:[];
  if(!fields(r,[...base,...more],[...base,...more],'triage result',errors)) continue;
  if(!['scored','incomplete','invalid'].includes(r.status)||!nonempty(r.node_id)||ids.has(r.node_id)||!nonempty(r.package_version)||!nonempty(r.engine_version)||typeof r.contains_placeholders!=='boolean'||! /^[a-f0-9]{64}$/.test(r.inputs_hash)) errors.push('Invalid triage result metadata');ids.add(r.node_id);
  if(r.status==='scored') {
   if(!Number.isSafeInteger(r.score)||!nonempty(r.category)||!Array.isArray(r.components)||!r.components.length||!Array.isArray(r.overrides_fired)||r.overrides_fired.some(x=>!nonempty(x))) errors.push('Invalid scored result');
   else {for(const c of r.components) if(fields(c,['name','value','points','band_id'],['name','value','points','band_id'],'component',errors)) if(!nonempty(c.name)||!Number.isSafeInteger(c.points)||!nonempty(c.band_id)) errors.push('Invalid component');if(r.components.reduce((s,c)=>s+c.points,0)!==r.score) errors.push('Inconsistent component score');}
  } else if(r.status==='incomplete') {if(!Array.isArray(r.missing)||!r.missing.length||r.missing.some(x=>!nonempty(x))) errors.push('Invalid missing list');}
  else if(r.status==='invalid'&&!nonempty(r.input)) errors.push('Invalid input name');
 }
}
