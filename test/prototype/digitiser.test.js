import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setup,source } from './support.js';
import { digitise,manualBlock,listBlocks } from '../../src/digitiser.js';
export const block={page:1,id:'b1',kind:'table',bbox:[40,120,560,380],text:'PLACEHOLDER dose table',cells:[['Weight (kg)','Tablets'],['5 to <15','1'],['15 to <25','2'],['25 to <35','3']]};
test('mock fixture lookup is explicit and idempotent without interpreting uploaded bytes',t=>{const s=setup(t),src=source(s);assert.throws(()=>digitise(s,src.sha256),/No digitisation available/);const dir=join(s.root,'mock');mkdirSync(dir);const {page,...b}=block;writeFileSync(join(dir,src.sha256+'.json'),JSON.stringify({digitiser:'mock-fixture',document_sha256:src.sha256,pages:[{page,blocks:[b]}]}));const a=digitise(s,src.sha256,{fixtureDir:dir});assert.equal(a.blocks[0].digitiser,'mock-fixture');assert.deepEqual(digitise(s,src.sha256,{fixtureDir:dir}),a);assert.equal(listBlocks(s,src.sha256).length,1);});
test('manual path fully stores blocks and refuses replacement and unknown fields',t=>{const s=setup(t),src=source(s);assert.equal(manualBlock(s,src.sha256,block).digitiser,'manual');assert.deepEqual(listBlocks(s,src.sha256)[0].cells,block.cells);assert.throws(()=>manualBlock(s,src.sha256,block),/already exists/);assert.throws(()=>manualBlock(s,src.sha256,{...block,id:'b2',execute:'no'}),/unknown/);});
