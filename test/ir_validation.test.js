import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateIR } from '../src/ir.js';
import { ir,clone } from './helpers.js';
test('valid placeholder IR',()=>assert.deepEqual(validateIR(ir),[]));
for(const [name,mutate] of Object.entries({
 type:x=>x.nodes[0].type='code',status:x=>x.nodes[0].status='other',risk:x=>x.nodes[0].risk='other',severity:x=>x.nodes[1].severity='other',top:x=>x.extra=1,node:x=>x.nodes[0].extra=1,nested:x=>x.nodes[0].bands[0].extra=1,
 page:x=>delete x.nodes[0].source.page,bbox:x=>delete x.nodes[0].source.bbox,text:x=>delete x.nodes[0].source.text,
 duplicate:x=>x.nodes[1].id=x.nodes[0].id,reviewers:x=>x.nodes[0].reviewers=['one'],duplicateReviewers:x=>x.nodes[0].reviewers=['one','one'],
 overlap:x=>x.nodes[0].bands[0].max=16,gap:x=>x.nodes[0].bands[1].min=16,edgeOverlap:x=>x.nodes[0].bands[0].max_inclusive=true,edgeGap:x=>x.nodes[0].bands[1].min_inclusive=false,
 missingEnum:x=>x.nodes[0].on_missing_input='ignore',noBandEnum:x=>x.nodes[0].on_no_band='ignore',condition:x=>x.nodes[1].when={unknown:true},endpoint:x=>x.nodes[0].bands.at(-1).max_inclusive=true
})) test('reject '+name,()=>{const x=clone(ir);mutate(x);assert.ok(validateIR(x).length);});
test('collect errors with node ids',()=>{const x=clone(ir);x.nodes[0].status='bad';x.nodes[1].severity='bad';const e=validateIR(x);assert.ok(e.some(v=>v.includes(x.nodes[0].id)));assert.ok(e.some(v=>v.includes(x.nodes[1].id)));});
test('inclusive left band with exclusive right lower edge is valid',()=>{const x=clone(ir);x.nodes[0].bands[0].max_inclusive=true;x.nodes[0].bands[1].min_inclusive=false;assert.deepEqual(validateIR(x),[]);});
