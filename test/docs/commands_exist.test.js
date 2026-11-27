import {test} from 'node:test';import assert from 'node:assert/strict';import {read} from './support.js';
test('all documented npm run commands exist',()=>{const pkg=JSON.parse(read('package.json'));for(const m of read('README.md').matchAll(/npm run ([\w:-]+)/g))assert.ok(pkg.scripts[m[1]],m[1]);assert.equal(pkg.scripts.demo,'bash scripts/prototype-demo.sh');});
