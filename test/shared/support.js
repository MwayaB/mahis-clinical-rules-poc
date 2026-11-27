// All nodes, clinical values, codes and reviewer identities are placeholders.
import { readFileSync } from 'node:fs';
import { listTypes } from '../../src/types/registry.js';
import { projectRules } from '../../src/compiler.js';
export const samples=['dose_band_example','contraindication_example','triage_example'].map(name=>({ir:JSON.parse(readFileSync(new URL('../../ir/'+name+'.ir.json',import.meta.url))),fixtures:JSON.parse(readFileSync(new URL('../../fixtures/'+name+'.fixtures.json',import.meta.url)))}));
export const cases=()=>listTypes().flatMap(type=>type.nodeKinds.map(kind=>{const sample=samples.find(s=>s.ir.nodes.some(n=>n.type===kind));return {type,node:sample.ir.nodes.find(n=>n.type===kind),ir:sample.ir,fixtures:sample.fixtures};}));
export function context(node) {return {today:'2026-01-01',sex:'F',age_years:30,population:node.scope?.population??'adult',weight_kg:12,pregnant:true,proposed_atc:node.applies_to?.atc??null,proposed_tablets:2,active_diagnoses:[{icd10:'B50.9',certainty:'confirmed',terminology_version:'seed-placeholder-2026'}],resp_rate_per_min:12,avpu:'alert'};}
export const packageFor=c=>({rules:projectRules({...c.ir,nodes:[c.node]}),manifest:{package_version:'poc-0.1.0',contains_placeholders:true,terminology_version:'seed-placeholder-2026'},engine_version:'0.1.0'});
export async function sharedEnvironment(t) {
 const {httpEnvironment}=await import('../prototype/support.js');const s=await httpEnvironment(t);
 const source=await s.ok('/api/guidelines?filename=placeholder.pdf&document_id=PLACEHOLDER-SHARED',Buffer.from('%PDF-PLACEHOLDER shared test source'));await s.ok(`/api/guidelines/${source.sha256}/metadata`,{edition:'placeholder-2026'});
 for(const c of cases()) {const imported=await s.ok('/api/rules/import',{document_sha256:source.sha256,node:c.node});for(const reviewer of ['placeholder-reviewer-a','placeholder-reviewer-b']) await s.ok(`/api/ir/${imported.node.id}/approve`,{reviewer});await s.ok('/api/fixtures',{node_id:imported.node.id,entries:c.fixtures});}
 const version='poc-demo-0.5.0';await s.ok('/api/releases',{document_sha256:source.sha256,version});return {...s,version};
}
export async function openCase(s,c) {
 const ctx=context(c.node),patient=await s.ok('/api/patients',{name:'PLACEHOLDER shared patient',sex:ctx.sex,age_years:ctx.age_years});
 await s.ok('/api/patients/'+patient.patient_id+'/diagnoses',{icd10:ctx.active_diagnoses[0].icd10,label:'PLACEHOLDER',certainty:'confirmed'});
 const encounter=await s.ok('/api/encounters',{patient_id:patient.patient_id,population:ctx.population}),base='/api/encounters/'+encounter.encounter_id;
 for(const definition of c.type.requiredInputs(c.node)) await s.ok(base+'/observations',{field:definition.name,value:ctx[definition.name],release_version:s.version});
 if(c.node.applies_to?.atc) await s.ok(base+'/observations',{field:'proposed_atc',value:ctx.proposed_atc,release_version:s.version});
 return {patient,encounter,base,ctx};
}
