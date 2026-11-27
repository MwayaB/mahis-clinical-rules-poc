import {test} from 'node:test';import assert from 'node:assert/strict';import {read} from './support.js';
test('README leads with placeholder notice problem summary quickstart and further reading',()=>assert.deepEqual([...read('README.md').matchAll(/^## (.+)$/gm)].map(m=>m[1].toLowerCase()),['placeholder notice','problem statement','summary','quickstart','where to read next']));
