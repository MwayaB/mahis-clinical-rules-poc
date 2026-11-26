import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultTerminology as seed,loadTerminology,isKnownCode,hasPrefix,labelFor } from '../../src/terminology.js';
test('seed loads with unique labelled codes and exact versus prefix lookup',()=>{assert.equal(seed.codes.length,12);assert.equal(new Set(seed.codes.map(c=>c.code)).size,12);for(const c of seed.codes) {assert.ok(c.label);assert.equal(labelFor(seed,c.code),c.label);assert.ok(isKnownCode(seed,c.code));}assert.ok(hasPrefix(seed,'B50'));assert.equal(isKnownCode(seed,'B50'),false);assert.equal(labelFor(seed,'UNKNOWN'),null);});
test('loader rejects duplicate codes unknown fields and missing metadata',t=>{const root=mkdtempSync(join(tmpdir(),'term-'));t.after(()=>rmSync(root,{recursive:true,force:true}));const path=join(root,'seed.json');for(const mutate of [s=>s.extra=true,s=>s.codes[0].extra=true,s=>s.codes.push(s.codes[0]),s=>delete s.system,s=>delete s.terminology_version,s=>s.codes[0].label='']) {const s=structuredClone(seed);mutate(s);writeFileSync(path,JSON.stringify(s));assert.throws(()=>loadTerminology(path));}});
