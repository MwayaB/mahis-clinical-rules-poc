import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateIR } from '../../../src/ir.js';
import { ir,copy } from './support.js';
test('sample scored triage validates without changing supplied values',()=>assert.deepEqual(validateIR(ir),[]));
for(const [name,mutate,match] of [
 ['empty parameters',n=>n.parameters=[],/parameters/],['unknown kind',n=>n.parameters[0].kind='expression',/kind/],
 ['overlap',n=>n.parameters[0].bands[0].max=10,/overlap/],['gap',n=>n.parameters[0].bands[0].max=8,/gap/],
 ['noninteger points',n=>n.parameters[0].bands[0].points=1.5,/points/],['numeric ordinal',n=>n.parameters[1].levels[0].value=0,/ordinal/],
 ['duplicate ordinal',n=>n.parameters[1].levels[1].value='alert',/duplicate ordinal/],['missing points',n=>delete n.parameters[1].levels[0].points,/points/],
 ['incomplete score range',n=>n.score_bands[2].max=5,/coverage/],['score overlap',n=>n.score_bands[1].min=2,/overlap/],['score gap',n=>n.score_bands[1].min=4,/gap/],
 ['unknown score category',n=>n.score_bands[0].category='other',/category/],['unknown override category',n=>n.overrides[0].category='other',/category/],
 ['duplicate category order',n=>n.categories_order.push(n.categories_order[0]),/duplicate categories/],['unknown override field',n=>n.overrides[0].when={unlisted:true},/override input/],
 ['override expression',n=>n.overrides[0].when={avpu:{gt:2}},/equality/],['invalid reviewer metadata',n=>n.reviewers=[false],/reviewers/],
 ['duplicate parameter',n=>n.parameters.push(copy(n.parameters[0])),/duplicate parameter/],['unknown node field',n=>n.extra=true,/unknown field/],
 ['unknown scope field',n=>n.scope.extra=true,/unknown field/],['unknown parameter field',n=>n.parameters[0].extra=true,/unknown field/],
 ['unknown band field',n=>n.parameters[0].bands[0].extra=true,/unknown field/],['unknown level field',n=>n.parameters[1].levels[0].extra=true,/unknown field/],
 ['unknown coverage field',n=>n.parameters[0].coverage.extra=true,/unknown field/],['unknown score field',n=>n.score_bands[0].extra=true,/unknown field/],['unknown override field shape',n=>n.overrides[0].extra=true,/unknown field/]
]) test('triage IR rejects '+name,()=>{const x=copy(ir);mutate(x.nodes[0]);assert.match(validateIR(x).join('\n'),match);});
test('ordinal ordering does not define points or numeric comparisons',()=>{const x=copy(ir);x.nodes[0].parameters[1].levels.reverse();assert.deepEqual(validateIR(x),[]);});
