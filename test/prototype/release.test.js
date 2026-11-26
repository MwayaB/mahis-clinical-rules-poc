import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { setup,source,NOW,doseBlock } from './support.js';
import { manualBlock } from '../../src/digitiser.js';
import { generateDrafts } from '../../src/draft.js';
import { approveNode,editNode } from '../../src/review.js';
import { saveFixtures } from '../../src/fixtures.js';
import { createRelease,listReleases,loadRelease } from '../../src/release.js';
import { verifyPackage } from '../../src/package.js';
function prepare(s) {const src=source(s);manualBlock(s,src.sha256,doseBlock);const n=generateDrafts(s,src.sha256,{atc_by_block:{b1:'P01BF01'}},{actor:'a',now:NOW}).nodes[0].node;const opts={actor:'a',now:NOW,keyDir:join(s.root,'keys')};return {n,opts,body:{document_sha256:src.sha256,version:'poc-demo-0.1.0'}};}
const approve=(s,n)=>{approveNode(s,n.id,{reviewer:'a'},{now:NOW});approveNode(s,n.id,{reviewer:'b'},{now:NOW});};
function fixtures(s,n) {const ctx={today:'2026-01-01',weight_kg:12,pregnant:false,proposed_atc:'P01BF01',proposed_tablets:2};saveFixtures(s,{node_id:n.id,entries:[{name:'PLACEHOLDER positive',ctx,expect:[n.id]},{name:'PLACEHOLDER negative',ctx:{...ctx,proposed_tablets:1},expect:[]}]});}
test('release refuses unapproved, missing fixtures, parse errors; succeeds only with reviewed package',t=>{const s=setup(t),p=prepare(s);assert.throws(()=>createRelease(s,p.body,p.opts),/not approved/);approve(s,p.n);assert.throws(()=>createRelease(s,p.body,p.opts),/fixtures/);fixtures(s,p.n);const r=createRelease(s,p.body,p.opts);assert.equal(r.kind,'release-created');assert.deepEqual(r.reviewers[p.n.id],['a','b']);assert.equal(verifyPackage(join(s.root,'releases',p.body.version),[join(p.opts.keyDir,'dev-public.pem')]).manifest.rules_sha256,r.rules_sha256);assert.equal(loadRelease(s,r.version,p.opts).manifest.contains_placeholders,true);assert.throws(()=>createRelease(s,p.body,p.opts),/already exists/);assert.equal(listReleases(s).length,1);editNode(s,p.n.id,{bands:[]},{actor:'a',now:NOW});assert.throws(()=>createRelease(s,{...p.body,version:'poc-demo-0.1.1'},p.opts),/parse errors/);});
test('source metadata and unknown release fields fail closed',t=>{const s=setup(t),p=prepare(s);assert.throws(()=>createRelease(s,{...p.body,extra:1},p.opts),/unknown/);assert.throws(()=>createRelease(s,{...p.body,version:'../keys'},p.opts),/Version/);});
