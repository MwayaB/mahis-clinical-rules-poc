import { fields,nonempty,object } from '../schema.js';
const contextFields=['today','weight_kg','pregnant','proposed_atc','proposed_tablets'];
export const tableFields=['applies_to','input','coverage','bands','on_missing_input','on_no_band','message_template'];
export const predicateFields=['applies_to','when','severity','message'];
function validate(n) {const errors=[],path=n.id,add=m=>errors.push(`${path}: ${m}`);
  if(n.type==='predicate') {
   if(Object.hasOwn(n.when??{},'pregnant')&&n.applies_to?.sex!=='F') add('pregnancy condition requires applies_to.sex F');
   if(!['block','warn','info'].includes(n.severity)) add('unknown severity');
   if(!nonempty(n.message)) add('message required');
   if(!object(n.when)||!Object.keys(n.when).length) add('nonempty flat when required');
   else for(const [k,v] of Object.entries(n.when)) {
    if(!contextFields.includes(k)) add('unknown condition field '+k);
    if(v===null||!['string','number','boolean'].includes(typeof v)||typeof v==='number'&&!Number.isFinite(v)) add('invalid equality value');
    if(k==='pregnant'&&typeof v!=='boolean'||k==='weight_kg'&&(typeof v!=='number'||v<=0)||k==='proposed_tablets'&&(!Number.isInteger(v)||v<0)||['today','proposed_atc'].includes(k)&&!nonempty(v)) add('condition type mismatch');
   }
  }
  if(n.type==='table') {
   if(n.input!=='weight_kg') add('unsupported table input');
   for(const k of ['on_missing_input','on_no_band']) if(!['warn','info'].includes(n[k])) add('unknown '+k);
   if(!nonempty(n.message_template)||/\{([^{}]+)\}/g.test(n.message_template.replace(/\{(input_value|value|unit|observed)\}/g,''))) add('invalid message template');
   let valid=fields(n.coverage,['min','max'],['min','max'],path+'.coverage',errors);
   if(valid&&(!Number.isFinite(n.coverage.min)||!Number.isFinite(n.coverage.max)||n.coverage.min>=n.coverage.max)) {add('invalid coverage');valid=false;}
   if(!Array.isArray(n.bands)||!n.bands.length) {add('bands required');return errors;}
   const bands=[];
   n.bands.forEach((b,j)=>{
    if(!fields(b,['min','max','min_inclusive','max_inclusive','value','unit'],['min','max','min_inclusive','max_inclusive','value','unit'],path+'.band['+j+']',errors)) return;
    if(!Number.isFinite(b.min)||!Number.isFinite(b.max)||b.min>=b.max||typeof b.min_inclusive!=='boolean'||typeof b.max_inclusive!=='boolean'||!Number.isInteger(b.value)||b.value<0||b.unit!=='tablet') {add('invalid band');return;}
    bands.push(b);
   });
   bands.sort((a,b)=>a.min-b.min);
   if(valid&&bands.length===n.bands.length) {
    // Coverage is [min,max): the supplied example excludes its maximum.
    if(bands[0].min!==n.coverage.min||!bands[0].min_inclusive||bands.at(-1).max!==n.coverage.max||bands.at(-1).max_inclusive) add('bands must cover [min,max) exactly');
    for(let j=1;j<bands.length;j++) {
     const a=bands[j-1],b=bands[j];
     if(a.max>b.min||a.max===b.min&&a.max_inclusive&&b.min_inclusive) add('overlapping bands');
     if(a.max<b.min||a.max===b.min&&!a.max_inclusive&&!b.min_inclusive) add('gap in coverage');
    }
   }
  }
return errors;
}

const itemsResult=(items,payload={})=>({status:items.length?'advice':'ok',outcome:{items},payload});
function evaluate(n,ctx) {
 const items=[],add=(severity,message)=>items.push({rule_id:n.id,severity,message,source_ref:n.source_ref});
 if(n.type==='predicate') {if(Object.entries(n.when).every(([k,v])=>ctx[k]===v)) add(n.severity,n.message);return itemsResult(items);}
 const x=ctx[n.input],band=n.bands.find(b=>(x>b.min||b.min_inclusive&&x===b.min)&&(x<b.max||b.max_inclusive&&x===b.max));
 if(!band) throw new Error('Validated table input has no band');
 if(ctx.proposed_tablets!==band.value) {const tokens={input_value:x,value:band.value,unit:band.unit,observed:ctx.proposed_tablets};add('warn',n.message_template.replace(/\{(input_value|value|unit|observed)\}/g,(_,k)=>String(tokens[k])));}
 return itemsResult(items,{matched_band:band});
}
const kind=value=>typeof value==='number'?'numeric':typeof value==='boolean'?'boolean':'string';
const requiredInputs=n=>n.type==='table'?[{name:n.input,kind:'numeric',domain:{min:n.coverage.min,max:n.coverage.max,min_inclusive:true,max_inclusive:false}},{name:'proposed_tablets',kind:'numeric',domain:{integer:true,min:0}}]:Object.entries(n.when).map(([name,value])=>({name,kind:kind(value),domain:{}}));
export const dosingTypes=['table','predicate'].map(name=>({name,version:'1.0.0',nodeKinds:[name],fields:name==='table'?tableFields:predicateFields,validate,serialise:n=>Object.fromEntries((name==='table'?tableFields:predicateFields).map(k=>[k,n[k]])),requiredInputs,evaluate,eligibleFixtureKinds:r=>[r.status==='advice'?'positive':r.status==='ok'?'negative':r.status],requiredFixtureKinds:['positive','negative'],scope:'patient',renderer:'advice',allowedActions:()=>['accepted','overridden']}));
