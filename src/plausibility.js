// Data-quality guards only. These limits are not clinical recommendations.
export const limits=Object.freeze({weight_kg:Object.freeze({min:0.5,max:200}),age_years:Object.freeze({min:0,max:120}),pregnancy_age:Object.freeze({min:10,max:60})});
function fail(message) {const error=new Error(message);error.status=422;throw error;}
export function checkNumber(field,value,range=limits[field]) {
 if(typeof value!=='number'||!Number.isFinite(value)||value<range.min||value>range.max) fail(`${field} must be ${range.min} to ${range.max}${field==='weight_kg'?' kg':' years'} (data-quality guard)`);
}
export function checkPregnancy(value,ctx,rules=[]) {
 if(value!==true) return;
 if(ctx.sex!=='F') fail('pregnant true requires sex F (data-quality guard)');
 const range={...limits.pregnancy_age};
 for(const n of rules) if(Object.hasOwn(n.when??{},'pregnant')&&n.applies_to?.age_years) {
  range.min=Math.max(range.min,n.applies_to.age_years.min);range.max=Math.min(range.max,n.applies_to.age_years.max);
 }
 if(ctx.age_years==null) fail(`pregnant true requires age_years recorded within ${range.min} to ${range.max} years`);
 checkNumber('age_years',ctx.age_years,range);
}
