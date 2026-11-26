import { defaultTerminology,hasPrefix } from './terminology.js';
import { canonicalStringify } from './canonical.js';
export const contextFields = ['today','weight_kg','pregnant','proposed_atc','proposed_tablets'];
export const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
export const nonempty = x => typeof x === 'string' && x.trim().length > 0;
export function fields(x, allowed, required, path, errors) {
  if (!object(x)) { errors.push(`${path}: expected object`); return false; }
  for (const k of Object.keys(x)) if (!allowed.includes(k)) errors.push(`${path}: unknown field ${k}`);
  for (const k of required) if (!Object.hasOwn(x,k)) errors.push(`${path}: missing ${k}`);
  return true;
}
export const commonFields=['id','type','risk','status','source','placeholder','reviewers'];
export const tableFields=['applies_to','input','coverage','bands','on_missing_input','on_no_band','message_template'];
export const predicateFields=['applies_to','when','severity','message'];
export function validateNodes(nodes, { compiled=false,terminology=defaultTerminology }={}) {
 const errors=[]; const ids=new Set();
 if (!Array.isArray(nodes) || !nodes.length) return ['nodes: nonempty array required'];
 nodes.forEach((n,i)=>{
  const path=typeof n?.id==='string'?n.id:`node[${i}]`;
  const add=m=>errors.push(`${path}: ${m}`);
  const specific=n?.type==='table'?tableFields:n?.type==='predicate'?predicateFields:[];
  const base=compiled?['id','type','source_ref']:commonFields;
  if (!fields(n,[...base,...specific],[...base,...specific],path,errors)) return;
  if (!nonempty(n.id)) add('id must be nonempty');
  if (ids.has(n.id)) add('duplicate node ID'); ids.add(n.id);
  if (!['table','predicate'].includes(n.type)) add('unknown type');
  if (compiled) { if (!nonempty(n.source_ref)) add('invalid source_ref'); }
  else {
   if (!['approved','draft'].includes(n.status)) add('unknown status');
   if (!['high','standard'].includes(n.risk)) add('unknown risk');
   if (typeof n.placeholder!=='boolean') add('placeholder must be boolean');
   if (!Array.isArray(n.reviewers)||n.reviewers.some(x=>!nonempty(x))||new Set(n.reviewers).size!==n.reviewers.length||n.reviewers.length<(n.risk==='high'?2:1)) add('insufficient unique reviewers');
   if(fields(n.source,['page','bbox','text'],['page','bbox','text'],path+'.source',errors)) {
    const s=n.source;
    if(!Number.isInteger(s.page)||s.page<1) add('invalid source.page');
    if(!Array.isArray(s.bbox)||s.bbox.length!==4||!s.bbox.every(Number.isFinite)||s.bbox[0]>s.bbox[2]||s.bbox[1]>s.bbox[3]) add('invalid source.bbox');
    if(!nonempty(s.text)) add('invalid source.text');
   }
  }
  if(fields(n.applies_to,['atc','sex','age_years','icd10'],['atc'],path+'.applies_to',errors)) {
   const a=n.applies_to;
   // Signed compiled rules retain their release terminology; do not reinterpret with the installed seed.
   if(a.icd10!==undefined&&(!nonempty(a.icd10)||! /^[A-Z][0-9]{2}(?:\.[A-Z0-9]{1,4})?$/.test(a.icd10)||terminology!==null&&!hasPrefix(terminology,a.icd10))) add('unknown ICD-10 prefix '+JSON.stringify(a.icd10));
   if(!nonempty(a.atc)) add('invalid ATC');
   if(a.sex!==undefined&&!['F','M','U'].includes(a.sex)) add('invalid applicability sex');
   if(a.age_years!==undefined&&fields(a.age_years,['min','max'],['min','max'],path+'.applies_to.age_years',errors)) {
    if(!Number.isFinite(a.age_years.min)||!Number.isFinite(a.age_years.max)||a.age_years.min<0||a.age_years.max>120||a.age_years.min>a.age_years.max) add('invalid applicability age_years');
   }
  }
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
   if(!Array.isArray(n.bands)||!n.bands.length) {add('bands required');return;}
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
 });
 return errors;
}
export function validateIR(ir,terminology=defaultTerminology) {
 const errors=[];
 try { canonicalStringify(ir); } catch(e) { errors.push('IR: '+e.message); }
 if(!fields(ir,['ir_version','document','nodes'],['ir_version','document','nodes'],'IR',errors)) return errors;
 if(ir.ir_version!=='0.1') errors.push('IR: unsupported ir_version');
 if(fields(ir.document,['id','edition','checksum'],['id','edition','checksum'],'document',errors)) {
  for(const k of ['id','edition']) if(!nonempty(ir.document[k])) errors.push('document: invalid '+k);
  if(!/^sha256:[a-f0-9]{64}$/.test(ir.document.checksum)) errors.push('document: invalid checksum');
 }
 return errors.concat(validateNodes(ir.nodes,{terminology}));
}
