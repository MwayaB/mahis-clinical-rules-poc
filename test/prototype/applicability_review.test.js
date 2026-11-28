import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { httpEnvironment,releasedHTTP } from './support.js';
test('review can repair misplaced sex through audited edit and retain two-reviewer requirement',async t=>{
 const s=await httpEnvironment(t),{drafts}=await releasedHTTP(s),n=drafts.nodes.find(x=>x.node.type==='predicate').node,path='/api/ir/'+n.id;
 const broken=await s.ok(path+'/edit',{when:{pregnant:true,sex:'F'},applies_to:{atc:n.applies_to.atc}});assert.equal(broken.approvals.length,0);assert.equal((await s.request(path+'/approve',{reviewer:'a'})).status,409);
 const repaired=await s.ok(path+'/edit',{when:{pregnant:true},applies_to:n.applies_to});assert.equal(repaired.node.parse_errors,undefined);assert.equal((await s.ok(path+'/approve',{reviewer:'a'})).node.status,'draft');assert.equal((await s.ok(path+'/approve',{reviewer:'b'})).node.status,'approved');
 const ui=readFileSync(new URL('../../public/review.js',import.meta.url),'utf8');assert.match(ui,/const applies_to=\{\.\.\.n.applies_to/);assert.match(ui,/automatedChecks/);assert.doesNotMatch(ui,/Load sample fixtures|Save fixtures/);assert.match(ui,/Rule applicability · checked before conditions/);
});
