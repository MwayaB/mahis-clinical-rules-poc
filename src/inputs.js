import { readFileSync } from 'node:fs';
import { invalidInput } from './domains.js';
import { fields } from './schema.js';
export const dataQuality=Object.freeze(JSON.parse(readFileSync(new URL('../samples/data-quality.json',import.meta.url))));
export const encounterEntry=Object.freeze(JSON.parse(readFileSync(new URL('../samples/triage/entry-guards.json',import.meta.url))));
export const inputCatalog=[...dataQuality.fields,...encounterEntry.fields.map(f=>({name:f.input,label:f.label,kind:f.kind,domain:f.kind==='numeric'?{min:f.min,max:f.max}:{values:f.values}}))];
export function checkObservation(field,value,definition) {
 const known=inputCatalog.find(d=>d.name===field),selected=known??definition;
 if(!selected) {const e=new Error('Unknown observation field '+field);e.status=422;throw e;}
 const errors=[];
 if(definition) {fields(definition,['name','kind','domain'],['name','kind','domain'],'input definition',errors);if(definition.name!==field) errors.push('Input definition name mismatch');fields(definition.domain,['min','max','min_inclusive','max_inclusive','integer','values','pattern'],[],'input domain',errors);}
 const reason=errors.join('; ')||(value===null&&selected.nullable?null:invalidInput(selected,value));
 if(reason) {const d=selected.domain,suffix=d.values?' ('+d.values.join(', ')+')':d.min!==undefined&&d.max!==undefined?` (${d.min} to ${d.max})`:'';const e=new Error(`${field}: ${reason}${suffix}`);e.status=422;throw e;}
 return selected;
}
