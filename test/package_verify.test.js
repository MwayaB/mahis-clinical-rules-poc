import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync,sign,createHash } from 'node:crypto';
import { compile } from './compile-approved.js';
import { applyPackage,compareVersions } from '../src/package.js';
import { canonicalStringify } from '../src/canonical.js';
import { ir } from './helpers.js';
const fixtures=['dose_band_example','contraindication_example'].flatMap(n=>JSON.parse(readFileSync(new URL('../fixtures/'+n+'.fixtures.json',import.meta.url))));
export function setup(t) {
 const root=mkdtempSync(join(tmpdir(),'verify-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const keys=generateKeyPairSync('ed25519');const pub=join(root,'pub.pem');writeFileSync(pub,keys.publicKey.export({type:'spki',format:'pem'}));
 const dir=join(root,'package');compile(ir,{dir,privateKey:keys.privateKey,fixtures});
 return {root,dir,keys,pub,load:()=>applyPackage(dir,{trustedPublicKeys:[pub],engineVersion:'0.1.0'})};
}
export function resign(s,mutateManifest=()=>{},mutateRules) {
 const m=JSON.parse(readFileSync(join(s.dir,'manifest.json')));
 if(mutateRules) {const rules=JSON.parse(readFileSync(join(s.dir,'rules.json')));mutateRules(rules);const bytes=canonicalStringify(rules);writeFileSync(join(s.dir,'rules.json'),bytes);m.rules_sha256=createHash('sha256').update(bytes).digest('hex');}
 mutateManifest(m);const bytes=Buffer.from(canonicalStringify(m));writeFileSync(join(s.dir,'manifest.json'),bytes);writeFileSync(join(s.dir,'manifest.sig'),sign(null,bytes,s.keys.privateKey));
}
test('valid package deeply frozen',t=>{const p=setup(t).load();assert.ok(Object.isFrozen(p.rules[0].bands[0]));assert.equal(p.manifest.contains_placeholders,true);});
for(const f of ['rules.json','manifest.json']) test('tampered byte '+f,t=>{const s=setup(t);const path=join(s.dir,f),bytes=readFileSync(path);bytes[0]^=1;writeFileSync(path,bytes);assert.throws(s.load);});
test('wrong key refused',t=>{const s=setup(t);writeFileSync(s.pub,generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'}));assert.throws(s.load,/Signature/);});
for(const [name,m,r] of [
 ['manifest field',x=>x.extra=true],['manifest enum',x=>x.ir_version='future'],['future engine',x=>x.engine_min_version='1.0.0'],['node count',x=>x.node_count=99],
 ['node type',()=>{},x=>x[0].type='code'],['node field',()=>{},x=>x[0].extra=1],['nested field',()=>{},x=>x[0].bands[0].extra=1],['severity',()=>{},x=>x[1].severity='other']
]) test('signed invalid '+name+' refused',t=>{const s=setup(t);resign(s,m,r);assert.throws(s.load);});
test('numeric semver comparison',()=>{assert.equal(compareVersions('0.10.0','0.2.0'),1);assert.throws(()=>compareVersions('bad','0.1.0'));});
