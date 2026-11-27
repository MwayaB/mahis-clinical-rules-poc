import {test} from 'node:test';import assert from 'node:assert/strict';import {read} from './support.js';
test('public README is under 150 lines',()=>assert.ok(read('README.md').split('\n').length<150));
