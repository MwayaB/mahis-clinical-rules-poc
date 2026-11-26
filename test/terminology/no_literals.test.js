import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync,readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
function files(root) {return readdirSync(root,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(root,e.name)):[join(root,e.name)]);}
test('src contains no quoted ICD-10 code literals',()=>{const hits=[];for(const path of files(fileURLToPath(new URL('../../src/',import.meta.url)))) {const lines=readFileSync(path,'utf8').split('\n');lines.forEach((line,i)=>{if(/^\s*\/\/ allowed:\s*\S/.test(line)) return;if(/(['"`])[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?\1/.test(line)) hits.push(`${path}:${i+1}`);});}assert.deepEqual(hits,[]);});
