import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalStringify as c } from '../src/canonical.js';
test('recursive canonical ordering and number encoding', () => assert.equal(c({z:[{b:2,a:1},null,true],a:-0}), '{"a":0,"z":[{"a":1,"b":2},null,true]}'));
test('reject all non JSON values', () => { for (const v of [NaN,Infinity,-Infinity,undefined,()=>{}, {x:undefined},[undefined],Array(1),1n,new Date()]) assert.throws(()=>c(v)); const x={}; x.x=x; assert.throws(()=>c(x)); });
