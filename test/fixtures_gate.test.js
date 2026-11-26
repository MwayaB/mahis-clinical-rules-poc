import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { compile,fixtureGate,projectRules } from '../src/compiler.js';
import { ir } from './helpers.js';
const fixtures=['dose_band_example','contraindication_example'].flatMap(n=>JSON.parse(readFileSync(new URL('../fixtures/'+n+'.fixtures.json',import.meta.url))));
for(const n of ir.nodes) for(const positive of [true,false]) test(`gate refuses ${n.id} without ${positive?'positive':'negative'}`,()=>{
 const fs=fixtures.filter(f=>!(f.ctx.proposed_atc===n.applies_to.atc&&f.expect.includes(n.id)===positive));
 assert.throws(()=>compile(ir,{fixtures:fs}),new RegExp(n.id));
});
test('fixture expectations must actually match',()=>{const fs=structuredClone(fixtures);fs[0].expect=[];assert.throws(()=>fixtureGate(projectRules(ir),fs),/Fixture mismatch/);});
test('unrelated ATC cannot satisfy negative gate',()=>{const fs=structuredClone(fixtures);fs[1].ctx.proposed_atc='UNRELATED';assert.throws(()=>fixtureGate(projectRules(ir),fs),/al-dose-weight-band/);});
