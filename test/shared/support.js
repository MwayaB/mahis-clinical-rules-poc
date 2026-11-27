// All nodes, clinical values, codes and reviewer identities are placeholders.
import { readFileSync } from 'node:fs';
import { listTypes } from '../../src/types/registry.js';
import { projectRules } from '../../src/compiler.js';
export const samples=['dose_band_example','contraindication_example','triage_example'].map(name=>({ir:JSON.parse(readFileSync(new URL('../../ir/'+name+'.ir.json',import.meta.url))),fixtures:JSON.parse(readFileSync(new URL('../../fixtures/'+name+'.fixtures.json',import.meta.url)))}));
export const cases=()=>listTypes().flatMap(type=>type.nodeKinds.map(kind=>{const sample=samples.find(s=>s.ir.nodes.some(n=>n.type===kind));return {type,node:sample.ir.nodes.find(n=>n.type===kind),ir:sample.ir,fixtures:sample.fixtures};}));
export function context(node) {return {today:'2026-01-01',sex:'F',age_years:30,population:node.scope?.population??'adult',weight_kg:12,pregnant:true,proposed_atc:node.applies_to?.atc??null,proposed_tablets:2,active_diagnoses:[{icd10:'B50.9',certainty:'confirmed',terminology_version:'seed-placeholder-2026'}],resp_rate_per_min:12,avpu:'alert'};}
export const packageFor=c=>({rules:projectRules({...c.ir,nodes:[c.node]}),manifest:{package_version:'poc-0.1.0',contains_placeholders:true,terminology_version:'seed-placeholder-2026'},engine_version:'0.1.0'});
