import { dataQuality,inputCatalog } from './inputs.js';
import { getType } from './types/registry.js';
import { fields,nonempty,object } from './schema.js';
export { fields,nonempty,object } from './schema.js';
export { triageFields } from './triage-ir.js';
import { defaultTerminology,hasPrefix } from './terminology.js';
import { canonicalStringify } from './canonical.js';
export const contextFields = ['today','weight_kg','pregnant','proposed_atc','proposed_tablets'];
export const commonFields=['id','type','risk','status','source','placeholder','reviewers'];
export { tableFields,predicateFields } from './types/dosing.js';
export function validateNodes(nodes, { compiled=false,terminology=defaultTerminology }={}) {
 const errors=[]; const ids=new Set();
 if (!Array.isArray(nodes) || !nodes.length) return ['nodes: nonempty array required'];
 nodes.forEach((n,i)=>{
  const path=typeof n?.id==='string'?n.id:`node[${i}]`;
  const add=m=>errors.push(`${path}: ${m}`);
  let definition;try{definition=getType(n?.type);}catch{add('unknown type '+String(n?.type));return;}
  const specific=definition.fields;
  const base=compiled?['id','type','source_ref']:commonFields;
  if (!fields(n,[...base,...specific],[...base,...specific],path,errors)) return;
  if (!nonempty(n.id)) add('id must be nonempty');
  if (ids.has(n.id)) add('duplicate node ID'); ids.add(n.id);
  if (compiled) { if (!nonempty(n.source_ref)) add('invalid source_ref'); }
  else {
   if (!['approved','draft'].includes(n.status)) add('unknown status');
   if (!['high','standard'].includes(n.risk)) add('unknown risk');
   if (typeof n.placeholder!=='boolean') add('placeholder must be boolean');
   if (!Array.isArray(n.reviewers)||n.reviewers.some(x=>!nonempty(x))||new Set(n.reviewers).size!==n.reviewers.length) add('invalid unique reviewers metadata');
   if(fields(n.source,['page','bbox','text'],['page','bbox','text'],path+'.source',errors)) {
    const s=n.source;
    if(!Number.isInteger(s.page)||s.page<1) add('invalid source.page');
    if(!Array.isArray(s.bbox)||s.bbox.length!==4||!s.bbox.every(Number.isFinite)||s.bbox[0]>s.bbox[2]||s.bbox[1]>s.bbox[3]) add('invalid source.bbox');
    if(!nonempty(s.text)) add('invalid source.text');
   }
  }
  if(!n.applies_to) {errors.push(...definition.validate(n,{compiled,terminology,pregnancySex:dataQuality.pregnancy_sex}));return;}
  if(fields(n.applies_to,['atc','sex','age_years','icd10'],['atc'],path+'.applies_to',errors)) {
   const a=n.applies_to;
   // Signed compiled rules retain their release terminology; do not reinterpret with the installed seed.
   if(a.icd10!==undefined&&(!nonempty(a.icd10)||! /^[A-Z][0-9]{2}(?:\.[A-Z0-9]{1,4})?$/.test(a.icd10)||terminology!==null&&!hasPrefix(terminology,a.icd10))) add('unknown ICD-10 prefix '+JSON.stringify(a.icd10));
   if(!nonempty(a.atc)) add('invalid ATC');
   if(a.sex!==undefined&&!inputCatalog.find(d=>d.name==='sex').domain.values.includes(a.sex)) add('invalid applicability sex');
   if(a.age_years!==undefined&&fields(a.age_years,['min','max'],['min','max'],path+'.applies_to.age_years',errors)) {
    if(!Number.isFinite(a.age_years.min)||!Number.isFinite(a.age_years.max)||a.age_years.min<0||a.age_years.max>dataQuality.limits.age_years.max||a.age_years.min>a.age_years.max) add('invalid applicability age_years');
   }
  }
  errors.push(...definition.validate(n,{compiled,terminology,pregnancySex:dataQuality.pregnancy_sex}));
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
