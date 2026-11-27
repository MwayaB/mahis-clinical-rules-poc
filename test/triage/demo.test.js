import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { httpEnvironment } from '../prototype/support.js';
test('complete curl demo records adult incomplete scored overridden and replay states',async t=>{const s=await httpEnvironment(t,{shipped:true});const {stdout}=await promisify(execFile)(process.execPath,[fileURLToPath(new URL('../../scripts/prototype-flow.js',import.meta.url))],{env:{...process.env,PROTOTYPE_BASE_URL:s.app.url},maxBuffer:8*1024*1024});for(const state of ['incomplete','scored','overridden']) assert.match(stdout,new RegExp('Adult triage: '+state));assert.match(stdout,/no indication recorded/);assert.match(stdout,/triage-overridden/);});
