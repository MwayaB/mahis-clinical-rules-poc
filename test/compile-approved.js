// Placeholder review-event evidence for compiler unit tests, never production approval metadata.
import { compile as compileRaw } from '../src/compiler.js';
import { contentHash } from '../src/approval.js';
export function reviewEventsFor(ir) {let seq=0;return ir.nodes.flatMap(node=>['placeholder-reviewer-a','placeholder-reviewer-b'].map(actor=>({seq:++seq,node_id:node.id,kind:'approved',actor,after_hash:contentHash(node),occurred_at:'2026-01-01T00:00:00Z'})));}
export const compile=(ir,options={})=>compileRaw(ir,{reviewEvents:reviewEventsFor(ir),...options});
