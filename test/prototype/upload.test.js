import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { setup,NOW } from './support.js';
import { uploadGuideline,setMetadata,requireMetadata,MAX_UPLOAD,listSources } from '../../src/registry.js';
const input={bytes:Buffer.from('%PDF-PLACEHOLDER'),contentType:'application/pdf',filename:'sample.pdf',documentId:'PLACEHOLDER',now:NOW};
test('registry rejects non PDF and oversized bodies',t=>{const s=setup(t);for(const change of [{contentType:'text/plain'},{bytes:Buffer.from('bad')},{bytes:Buffer.alloc(MAX_UPLOAD+1)},{filename:'../bad.pdf'}]) assert.throws(()=>uploadGuideline(s,{...input,...change}));assert.deepEqual(listSources(s),[]);});
test('hash upload idempotence, actual bytes, metadata gate and unknown fields',t=>{const s=setup(t),a=uploadGuideline(s,input);assert.equal(a.status,'uploaded');assert.equal(a.uploaded_by,'local-user');assert.ok(existsSync(join(s.root,'sources',a.sha256+'.pdf')));assert.deepEqual(uploadGuideline(s,{...input,documentId:'OTHER'}),a);assert.throws(()=>requireMetadata(s,a.sha256),/edition/);assert.throws(()=>setMetadata(s,a.sha256,{edition:'x',extra:true}),/unknown/);assert.equal(setMetadata(s,a.sha256,{edition:'placeholder-2026'}).status,'metadata-set');assert.throws(()=>setMetadata(s,a.sha256,{edition:'other'}),/conflicting/);assert.equal(listSources(s).length,1);});
