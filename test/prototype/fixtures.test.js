import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup,source,NOW,doseBlock } from './support.js';
import { manualBlock } from '../../src/digitiser.js';
import { generateDrafts } from '../../src/draft.js';
import { saveFixtures,getFixtures,releaseFixtures,generateBoundaries } from '../../src/fixtures.js';
import { editNode } from '../../src/review.js';
function draft(s) {const src=source(s);manualBlock(s,src.sha256,doseBlock);const n=generateDrafts(s,src.sha256,{atc_by_block:{b1:'P01BF01'}},{actor:'a',now:NOW}).nodes[0].node;return {src,n};}
export function authored(n) {const ctx={active_diagnoses:[{icd10:'B50.9',certainty:'confirmed'}],today:'2026-01-01',weight_kg:12,pregnant:false,proposed_atc:n.applies_to.atc,proposed_tablets:2};return [{name:'PLACEHOLDER wrong dose',ctx,expect:[n.id]},{name:'PLACEHOLDER correct dose',ctx:{...ctx,proposed_tablets:1},expect:[]}];}
test('authored gate required independently of generated boundaries and stale content rejected',t=>{const s=setup(t),{src,n}=draft(s);assert.throws(()=>releaseFixtures(s,src.sha256),new RegExp(n.id));saveFixtures(s,{node_id:n.id,entries:authored(n).slice(0,1)});assert.throws(()=>releaseFixtures(s,src.sha256),/positive and negative/);saveFixtures(s,{node_id:n.id,entries:authored(n)});assert.equal(releaseFixtures(s,src.sha256).length,26);assert.equal(generateBoundaries([n]).length,24);editNode(s,n.id,{message_template:'PLACEHOLDER changed {value}'},{actor:'a',now:NOW});assert.equal(getFixtures(s,n.id).stale,true);assert.throws(()=>releaseFixtures(s,src.sha256),/stale/);});
test('fixture unknown fields and expectations refused',t=>{const s=setup(t),{n}=draft(s);const entries=authored(n);entries[0].ctx.extra=1;assert.throws(()=>saveFixtures(s,{node_id:n.id,entries}),/unknown/);assert.throws(()=>saveFixtures(s,{node_id:n.id,entries:[{...authored(n)[0],expect:['missing']}]}),/unknown rule/);});
