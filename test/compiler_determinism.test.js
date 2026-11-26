import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { compile } from '../src/compiler.js';
import { ir,clone } from './helpers.js';
export const fixtures=['dose_band_example','contraindication_example'].flatMap(n=>JSON.parse(readFileSync(new URL('../fixtures/'+n+'.fixtures.json',import.meta.url))));
test('deterministic signed package and placeholder manifest',()=>{
 const root=mkdtempSync(join(tmpdir(),'rules-'));const {privateKey}=generateKeyPairSync('ed25519');
 try { for(const d of ['a','b']) {const m=compile(ir,{dir:join(root,d),privateKey,fixtures});assert.equal(m.contains_placeholders,true);}
 for(const f of ['rules.json','manifest.json','manifest.sig']) assert.deepEqual(readFileSync(join(root,'a',f)),readFileSync(join(root,'b',f)));
 } finally {rmSync(root,{recursive:true,force:true});}
});
test('compiler rejects drafts and unknown node types before writing',()=>{for(const mutation of [x=>x.nodes[0].status='draft',x=>x.nodes[0].type='unknown']) {const x=clone(ir);mutation(x);assert.throws(()=>compile(x,{}));}});
