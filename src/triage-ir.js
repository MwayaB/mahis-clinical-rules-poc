// Schema mechanics only: thresholds, points and category labels are supplied by reviewed IR.
export const triageFields=['scope','parameters','score_bands','overrides','categories_order'];
export function validateTriage(n,{fields,nonempty,object},errors) {
 const path=n.id,add=m=>errors.push(`${path}: ${m}`);
 const array=(v,label)=>{if(!Array.isArray(v)||!v.length){add(label+' must be nonempty');return false;}return true;};
 if(fields(n.scope,['population'],['population'],path+'.scope',errors)&&!nonempty(n.scope.population)) add('invalid population');
 const categories=n.categories_order;
 if(!array(categories,'categories_order')||categories.some(c=>!nonempty(c))||new Set(categories).size!==categories.length) add('invalid or duplicate categories_order');
 const category=c=>{if(!Array.isArray(categories)||!categories.includes(c)) add('unknown category '+String(c));};
 const interval=(b,label,allowed)=>{
  if(!fields(b,allowed,allowed,path+'.'+label,errors)) return false;
  if(!Number.isFinite(b.min)||!Number.isFinite(b.max)||b.min>b.max||typeof b.min_inclusive!=='boolean'||typeof b.max_inclusive!=='boolean') {add('invalid '+label);return false;}return true;
 };
 const inputs=new Map(),names=new Set();let minScore=0,maxScore=0;
 if(array(n.parameters,'parameters')) for(const p of n.parameters) {
  const keys=p?.kind==='numeric'?['name','input','kind','bands','coverage']:['name','input','kind','levels'];
  if(!fields(p,keys,keys,path+'.parameter',errors)) continue;
  if(!nonempty(p.name)||names.has(p.name)) add('invalid or duplicate parameter name');names.add(p.name);
  if(!nonempty(p.input)||inputs.has(p.input)) add('invalid or duplicate parameter input');inputs.set(p.input,p);
  const points=[];
  if(p.kind==='numeric') {
   const validCoverage=fields(p.coverage,['min','max'],['min','max'],path+'.coverage',errors)&&Number.isFinite(p.coverage.min)&&Number.isFinite(p.coverage.max)&&p.coverage.min<p.coverage.max;
   if(!validCoverage) add('invalid parameter coverage');
   if(array(p.bands,'numeric bands')) {
    const bands=[];
    for(const b of p.bands) if(interval(b,'numeric band',['min','max','min_inclusive','max_inclusive','points'])) {
     if(b.min===b.max||!Number.isSafeInteger(b.points)) add('invalid numeric band or integer points');else {bands.push(b);points.push(b.points);}
    }
    bands.sort((a,b)=>a.min-b.min);
    if(validCoverage&&bands.length===p.bands.length) {
     if(bands[0]?.min!==p.coverage.min||!bands[0]?.min_inclusive||bands.at(-1)?.max!==p.coverage.max||bands.at(-1)?.max_inclusive) add('numeric bands must cover [min,max) exactly');
     for(let i=1;i<bands.length;i++) {const a=bands[i-1],b=bands[i];if(a.max>b.min||a.max===b.min&&a.max_inclusive&&b.min_inclusive) add('overlapping numeric bands');if(a.max<b.min||a.max===b.min&&!a.max_inclusive&&!b.min_inclusive) add('gap in numeric bands');}
    }
   }
  } else if(p.kind==='ordinal') {
   const values=new Set();
   if(array(p.levels,'ordinal levels')) for(const level of p.levels) if(fields(level,['value','points'],['value','points'],path+'.level',errors)) {
    if(!nonempty(level.value)||values.has(level.value)) add('invalid or duplicate ordinal value');values.add(level.value);
    if(!Number.isSafeInteger(level.points)) add('ordinal points must be integers');else points.push(level.points);
   }
  } else add('unknown parameter kind');
  if(points.length) {minScore+=Math.min(...points);maxScore+=Math.max(...points);}
 }
 if(!Number.isSafeInteger(minScore)||!Number.isSafeInteger(maxScore)) add('score range exceeds safe integers');
 if(array(n.score_bands,'score_bands')) {
  const ranges=[];
  for(const b of n.score_bands) if(interval(b,'score band',['min','max','min_inclusive','max_inclusive','category'])) {
   category(b.category);
   if(!Number.isSafeInteger(b.min)||!Number.isSafeInteger(b.max)) add('score bands require integer boundaries');
   else {const lo=b.min+(b.min_inclusive?0:1),hi=b.max-(b.max_inclusive?0:1);if(lo>hi) add('empty score band');else ranges.push({lo,hi});}
  }
  ranges.sort((a,b)=>a.lo-b.lo);
  if(ranges.length===n.score_bands.length) {
   if(ranges[0]?.lo>minScore||ranges.at(-1)?.hi<maxScore) add('incomplete score coverage');
   for(let i=1;i<ranges.length;i++) {if(ranges[i].lo<=ranges[i-1].hi) add('overlapping score bands');if(ranges[i].lo>ranges[i-1].hi+1) add('gap in score bands');}
  }
 }
 if(!Array.isArray(n.overrides)) add('overrides must be an array');
 else {const ids=new Set();for(const o of n.overrides) if(fields(o,['id','when','category'],['id','when','category'],path+'.override',errors)) {
  if(!nonempty(o.id)||ids.has(o.id)) add('invalid or duplicate override ID');ids.add(o.id);category(o.category);
  if(!object(o.when)||!Object.keys(o.when).length) add('nonempty equality override required');
  else for(const [k,v] of Object.entries(o.when)) {const p=inputs.get(k);if(!p) add('unknown override input '+k);else if(p.kind==='numeric'?(typeof v!=='number'||!Number.isFinite(v)):typeof v!=='string'||!p.levels?.some(l=>l.value===v)) add('invalid override equality');}
 }}
}
