import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { ir,clone,ctx,environment } from './helpers.js';
import { compile } from './compile-approved.js';
import { applyPackage } from '../src/package.js';
import { evaluate } from '../src/evaluator.js';
import { observe,replay } from '../src/workflow.js';
test('replay exact package and predecessor context despite later corrections',t=>{
 const s=environment(t);observe({...s.args(),field:'weight_kg',value:12});const a=s.rx();observe({...s.args(),field:'weight_kg',value:20});
 const original=applyPackage(s.dir,{trustedPublicKeys:[s.pub]});assert.deepEqual(replay({db:s.db,patientId:'P1',adviceEvent:a.shown,loadedPackage:original}),a.result);
 const changed=clone(ir);changed.nodes[0].bands[0].max=14;changed.nodes[0].bands[1].min=14;
 const newDir=join(s.root,'new');compile(changed,{dir:newDir,privateKey:s.keys.privateKey,fixtures:s.fixtures,packageVersion:'poc-0.1.1'});const next=applyPackage(newDir,{trustedPublicKeys:[s.pub]});
 assert.throws(()=>replay({db:s.db,patientId:'P1',adviceEvent:a.shown,loadedPackage:next}),/Exact recorded package/);
 for(const weight of [4.99,5,10,13.99,14,14.01,14.99,15,15.01,24.99,25,34.99,35]) {
  const c=ctx({weight_kg:weight,proposed_tablets:1});const oldAdvice=evaluate(original,c).advice,newAdvice=evaluate(next,c).advice;
  if(weight>=14&&weight<15) assert.notDeepEqual(newAdvice,oldAdvice,'changed interval '+weight);else assert.deepEqual(newAdvice,oldAdvice,'unchanged '+weight);
 }
});
