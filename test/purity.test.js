import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
const files=['evaluator.js','domains.js','schema.js','triage-ir.js',...readdirSync(new URL('../src/types/',import.meta.url)).filter(n=>n.endsWith('.js')).map(n=>'types/'+n)];
for(const name of files) test('pure assessment module '+name,()=>{const source=readFileSync(new URL('../src/'+name,import.meta.url),'utf8');for(const banned of ['Date','Math.random','process.','require(','node:fs','node:net','node:http','fetch(','process.env','eval(','new Function']) assert.ok(!source.includes(banned),name+': '+banned);for(const m of source.matchAll(/\bimport\s+.*?from\s+['"]([^'"]+)['"]/g)) assert.ok(m[1].startsWith('.'),m[1]);assert.ok(!/\bimport\s*\(/.test(source));});
