import { inputsHash } from './canonical.js';
export function contentHash(node) {const {status,reviewers,...content}=node;return inputsHash(content);}
export function approvalEvidence(node,events) {
 const hash=contentHash(node),history=events.filter(e=>e.node_id===node.id).sort((a,b)=>a.seq-b.seq);
 const reset=history.filter(e=>['edited','rejected','draft-created','draft-imported'].includes(e.kind)).at(-1)?.seq??-1;
 const reviewers=new Map();
 for(const e of history) if(e.seq>reset&&e.kind==='approved'&&e.after_hash===hash&&typeof e.actor==='string'&&e.actor.trim()) reviewers.set(e.actor.trim(),{reviewer:e.actor.trim(),content_hash:hash,approved_at:e.occurred_at});
 return [...reviewers.values()];
}
export function requireApprovals(nodes,events=[]) {
 const errors=[];for(const node of nodes) if(approvalEvidence(node,events).length<(node.risk==='high'?2:1)) errors.push(`${node.id}: not approved by ${node.risk==='high'?'two distinct':'distinct'} reviewers for current content; review_events required`);
 if(errors.length) throw new Error(errors.join('\n'));
}
export const readReviewEvents=(store,id)=>store.db.prepare('SELECT * FROM review_events'+(id?' WHERE node_id=?':'')+' ORDER BY seq').all(...(id?[id]:[]));
