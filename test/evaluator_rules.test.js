import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/evaluator.js';
import { projectRules } from '../src/compiler.js';
import { ir,ctx } from './helpers.js';
const pkg={rules:projectRules(ir),manifest:{package_version:'poc-0.1.0',contains_placeholders:true},engine_version:'0.1.0'};
for(const [name,changes,severities] of [
 ['correct dose',{proposed_tablets:1},[]],['wrong dose',{},['warn']],['missing weight',{weight_kg:null},['warn']],['outside coverage',{weight_kg:35},['warn']],['below coverage',{weight_kg:4},['warn']],
 ['predicate match',{proposed_atc:'J01XX01',pregnant:true},['block']],['predicate mismatch',{proposed_atc:'J01XX01',pregnant:false},[]],['predicate missing',{proposed_atc:'J01XX01',pregnant:null},['warn']],
 ['missing ATC',{proposed_atc:null},['warn']],['missing tablets',{proposed_tablets:null},['warn']],['all missing',{weight_kg:null,proposed_tablets:null},['warn','warn']],['unrelated ATC',{proposed_atc:'UNRELATED'},[]]
]) test(name,()=>{const c=ctx(changes),before=JSON.stringify(c),r=evaluate(pkg,c);assert.deepEqual(r.advice.map(x=>x.severity),severities);assert.equal(r.contains_placeholders,true);assert.match(r.inputs_hash,/^[a-f0-9]{64}$/);assert.equal(JSON.stringify(c),before);assert.deepEqual(evaluate(pkg,c),r);});
test('rendered wrong dose and source',()=>{const r=evaluate(pkg,ctx());assert.match(r.advice[0].message,/12 kg.*1 tablet; 2 recorded/);assert.match(r.advice[0].source_ref,/:p1:al-dose-weight-band$/);});
test('missing predicate field warns even if another equality mismatches',()=>{const p=structuredClone(pkg);p.rules[1].when={pregnant:true,weight_kg:99};assert.equal(evaluate(p,ctx({proposed_atc:'J01XX01',pregnant:null})).advice[0].severity,'warn');});
test('stable severity then rule sorting',()=>{const p=structuredClone(pkg);p.rules=[...['z','a'].map(id=>({...p.rules[1],id,severity:'warn'})),{...p.rules[1],id:'block',severity:'block'}];assert.deepEqual(evaluate(p,ctx({proposed_atc:'J01XX01',pregnant:true})).advice.map(x=>x.rule_id),['block','a','z']);});
