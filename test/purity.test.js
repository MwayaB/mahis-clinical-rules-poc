import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
test('evaluator has only approved imports and no ambient side effects',()=>{
 const s=readFileSync(new URL('../src/evaluator.js',import.meta.url),'utf8');
 for(const banned of ['Date','Math.random','process.','require(','node:fs','node:net','node:http','fetch(','process.env','eval(','new Function']) assert.ok(!s.includes(banned),banned);
 const imports=[...s.matchAll(/\bimport\s+.*?from\s+['"]([^'"]+)['"]/g)];assert.ok(imports.length);
 for(const m of imports) assert.ok(['./canonical.js','./hash.js'].includes(m[1]));
 assert.ok(!/\bimport\s*\(/.test(s));
});
