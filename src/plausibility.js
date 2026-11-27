import { readFileSync } from 'node:fs';
import { dataQuality } from './inputs.js';
export const triageEntry=Object.freeze(JSON.parse(readFileSync(new URL('../samples/triage/entry-guards.json',import.meta.url))));
// Data-quality guards only. These limits are not clinical recommendations.
export const limits=dataQuality.limits;
function fail(message) {const error=new Error(message);error.status=422;throw error;}
export function checkNumber(field,value,range=limits[field]) {
 if(typeof value!=='number'||!Number.isFinite(value)||value<range.min||value>range.max) fail(`${field} must be ${range.min} to ${range.max}${field==='weight_kg'?' kg':field==='age_years'?' years':''} (data-quality guard)`);
}
export function checkPregnancy(value,ctx,rules=[]) {
 if(value!==true) return;
 if(ctx.sex!==dataQuality.pregnancy_sex) fail(`pregnant true requires sex ${dataQuality.pregnancy_sex} (data-quality guard)`);
 const range={...limits.pregnancy_age};
 for(const n of rules) if(Object.hasOwn(n.when??{},'pregnant')&&n.applies_to?.age_years) {
  range.min=Math.max(range.min,n.applies_to.age_years.min);range.max=Math.min(range.max,n.applies_to.age_years.max);
 }
 if(ctx.age_years==null) fail(`pregnant true requires age_years recorded within ${range.min} to ${range.max} years`);
 checkNumber('age_years',ctx.age_years,range);
}

export function checkTriageObservation(field,value) {
 const guard=triageEntry.fields.find(f=>f.input===field);
 if(!guard) fail(`unknown triage field ${field}`);
 if(guard.kind==='numeric') checkNumber(field,value,guard);
 else if(typeof value!=='string'||!guard.values.includes(value)) fail(`${field} must be one of ${guard.values.join(', ')} (data-quality guard)`);
}
