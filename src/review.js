import { getType } from './types/registry.js';
import { approvalEvidence,readReviewEvents } from './approval.js';
import { requireMetadata } from './registry.js';
import { manualBlock,listBlocks } from './digitiser.js';
import { triageFields } from './ir.js';
import { exact,text,timestamp,ApiError } from './prototype/store.js';
import { contentHash } from './draft.js';
import { validateNodes } from './ir.js';
export function getNode(store,id) {const r=store.db.prepare('SELECT * FROM nodes WHERE node_id=?').get(text(id,'node_id'));if(!r) throw new ApiError('Node not found',404);return {node:JSON.parse(r.node),content_hash:r.content_hash,type_info:{fields:getType(JSON.parse(r.node).type).fields,renderer:getType(JSON.parse(r.node).type).renderer},approvals:approvalEvidence(JSON.parse(r.node),readReviewEvents(store,id)),document_sha256:r.document_sha256,block_id:r.block_id};}
export function nodeErrors(node) {
 const {parse_errors,...clean}=node;
 return [...(parse_errors??[]),...validateNodes([clean])];
}
function save(store,current,node,approvals,kind,actor,now) {
 text(actor,'reviewer/editor');timestamp(now);const hash=contentHash(node);
 store.db.prepare('INSERT INTO review_events(node_id,kind,actor,occurred_at,before_hash,after_hash,snapshot) VALUES(?,?,?,?,?,?,?)').run(node.id,kind,actor,now,current.content_hash,hash,store.encode({node,approvals}));
 store.db.prepare('UPDATE nodes SET node=?,content_hash=?,approvals=? WHERE node_id=?').run(store.encode(node),hash,store.encode(approvals),node.id);
 return getNode(store,node.id);
}
export function editNode(store,id,body,{actor,now}) {
 const current=getNode(store,id),node=structuredClone(current.node);
 const allowed=getType(node.type).fields.filter(k=>!['input','on_missing_input','on_no_band'].includes(k));
 exact(body,allowed,[]);if(!Object.keys(body).length) throw new ApiError('Provide editable fields');
 Object.assign(node,body);node.status='draft';node.reviewers=[];delete node.parse_errors;
 if(node.type==='table'&&body.bands&&!Object.hasOwn(body,'coverage')&&Array.isArray(node.bands)&&node.bands.length&&node.bands.every(b=>Number.isFinite(b?.min)&&Number.isFinite(b?.max))) node.coverage={min:Math.min(...node.bands.map(b=>b.min)),max:Math.max(...node.bands.map(b=>b.max))};
 const errors=nodeErrors(node);if(errors.length) node.parse_errors=errors;
 return store.transaction(()=>save(store,current,node,[],'edited',actor,now));
}
export function approveNode(store,id,body,{now}) {
 exact(body,['reviewer']);const reviewer=text(body.reviewer,'reviewer').trim(),current=getNode(store,id);
 const errors=nodeErrors(current.node);if(errors.length) throw new ApiError(`${id}: cannot approve: ${errors.join('; ')}`,409);
 if(current.approvals.some(a=>a.reviewer===reviewer&&a.content_hash===current.content_hash)) return current;
 const approvals=[...current.approvals,{reviewer,content_hash:current.content_hash,approved_at:timestamp(now)}];
 const node={...current.node,reviewers:approvals.map(a=>a.reviewer),status:approvals.length>=2?'approved':'draft'};
 return store.transaction(()=>save(store,current,node,approvals,'approved',reviewer,now));
}
export function rejectNode(store,id,body,{now}) {
 exact(body,['reviewer','reason']);text(body.reviewer,'reviewer');text(body.reason,'reason');const current=getNode(store,id),node={...current.node,status:'draft',reviewers:[]};
 return store.transaction(()=>{const result=save(store,current,node,[],'rejected',body.reviewer,now); // Reason is retained in the immutable event snapshot.
  // Insert a separate append-only reason record rather than mutate the prior event.
  store.db.prepare('INSERT INTO review_events(node_id,kind,actor,occurred_at,before_hash,after_hash,snapshot) VALUES(?,?,?,?,?,?,?)').run(id,'rejection-reason',body.reviewer,now,current.content_hash,current.content_hash,store.encode({reason:body.reason}));return result;});
}
export function reviewHistory(store,id) {getNode(store,id);return store.db.prepare('SELECT * FROM review_events WHERE node_id=? ORDER BY seq').all(id).map(r=>({...r,snapshot:JSON.parse(r.snapshot)}));}

export function importRuleDraft(store,body,{actor,now}) {
 exact(body,['document_sha256','node','block_id'],['document_sha256','node']);requireMetadata(store,body.document_sha256);
 const node=structuredClone(body.node);
 try{getType(node?.type);}catch(e){throw new ApiError(e.message,422);}
 node.status='draft';node.reviewers=[];
 const errors=nodeErrors(node);if(errors.length) throw new ApiError(errors.join('; '),422);
 const blocks=listBlocks(store,body.document_sha256);
 const matches=blocks.filter(b=>b.page===node.source.page&&b.text===node.source.text&&JSON.stringify(b.bbox)===JSON.stringify(node.source.bbox));
 const autoMatches=matches.filter(b=>b.digitiser!=='manual');
 if(body.block_id===undefined&&autoMatches.length>1) throw new ApiError('Multiple matching source blocks; provide block_id',422);
 const sourceBlock=body.block_id!==undefined?blocks.find(b=>b.id===body.block_id):autoMatches[0];
 if(body.block_id!==undefined&&!sourceBlock) throw new ApiError('Source block not found',422);
 if(sourceBlock&&!matches.includes(sourceBlock)) throw new ApiError('Authored triage provenance must match the selected source block',422);
 const block_id=sourceBlock?.id??node.id;
 if(sourceBlock) node.id=`${body.document_sha256}-${block_id}`;
 const existing=store.db.prepare('SELECT document_sha256 FROM nodes WHERE node_id=?').get(node.id);
 if(existing) {if(existing.document_sha256!==body.document_sha256) throw new ApiError('Node belongs to another source',409);return getNode(store,node.id);}
 text(actor,'editor');timestamp(now);const hash=contentHash(node);
 return store.transaction(()=>{
  if(!sourceBlock) manualBlock(store,body.document_sha256,{id:node.id,page:node.source.page,kind:'paragraph',bbox:node.source.bbox,text:node.source.text});
  store.db.prepare('INSERT INTO nodes VALUES(?,?,?,?,?,?)').run(node.id,body.document_sha256,block_id,store.encode(node),hash,'[]');
  store.db.prepare('INSERT INTO review_events(node_id,kind,actor,occurred_at,before_hash,after_hash,snapshot) VALUES(?,?,?,?,?,?,?)').run(node.id,'draft-imported',actor,now,'',hash,store.encode(node));
  return getNode(store,node.id);
 });
}

export const importTriageDraft=importRuleDraft;
