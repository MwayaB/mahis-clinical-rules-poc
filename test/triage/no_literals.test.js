import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ir } from './support.js';
function files(root) {return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(root,e.name)):[join(root,e.name)]);}
test('triage category labels are data rather than source-code literals',()=>{const hits=[];for(const file of files(fileURLToPath(new URL('../../src/',import.meta.url)))) for(const [i,line] of readFileSync(file,'utf8').split('\n').entries()) {
 // The pre-existing risk enum has a homonym; this is not a triage category.
 if(file.endsWith('/ir.js')&&line.includes("['high','standard'].includes(n.risk)")) continue;
 for(const category of ir.nodes[0].categories_order) if(new RegExp('([\'"`])'+category+'\\1').test(line)) hits.push(`${file}:${i+1}:${category}`);
}assert.deepEqual(hits,[]);});
test('pure scoring and schema code contain no sample clinical boundary constants',()=>{
 const values=new Set(ir.nodes[0].parameters.filter(p=>p.kind==='numeric').flatMap(p=>p.bands.flatMap(b=>[b.min,b.max])).concat(ir.nodes[0].score_bands.flatMap(b=>[b.min,b.max])));
 // Zero and small integers are also array indices, counters and comparison results, not clinical constants.
 const boundaries=[...values].filter(v=>v>5);
 for(const path of ['../../src/evaluator.js','../../src/triage-ir.js']) {const source=readFileSync(new URL(path,import.meta.url),'utf8');for(const boundary of boundaries) assert.ok(!new RegExp('(^|[^\\w])'+boundary+'([^\\w]|$)').test(source),`${path} embeds ${boundary}`);}
});
