import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../src/evaluator.js';
import { projectRules } from '../src/compiler.js';
import { ir,ctx,clone } from './helpers.js';
for(const variant of ['example','alternate inclusion']) {
 const data=clone(ir);if(variant!=='example') {data.nodes[0].bands[0].max_inclusive=true;data.nodes[0].bands[1].min_inclusive=false;}
 const rules=projectRules(data);
 for(const n of rules.filter(n=>n.type==='table')) for(const [i,b] of n.bands.entries()) for(const x of [b.min,b.min-0.01,b.max-0.01,b.max]) test(`${variant} band ${i} at ${x}`,()=>{
  // Independent interval oracle derives expectations solely from declared endpoints.
  const matches=n.bands.filter(s=>(s.min_inclusive?x>=s.min:x>s.min)&&(s.max_inclusive?x<=s.max:x<s.max));
  assert.ok(matches.length<=1);
  const pkg={rules:[n],manifest:{package_version:'test',contains_placeholders:true},engine_version:'0.1.0'};
  for(const tablets of [0,1,2,3]) {const r=evaluate(pkg,ctx({weight_kg:x,proposed_tablets:tablets}));assert.equal(r.advice.length,matches.length&&matches[0].value===tablets?0:1);}
 });
}
