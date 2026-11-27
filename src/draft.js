import { validateNodes } from './ir.js';
import { readFileSync } from 'node:fs';
import { listBlocks } from './digitiser.js';
import { requireMetadata } from './registry.js';
import { exact,text,ApiError,timestamp } from './prototype/store.js';
import { inputsHash } from './canonical.js';
const tableTemplate=JSON.parse(readFileSync(new URL('../ir/dose_band_example.ir.json',import.meta.url))).nodes[0];
const predicateTemplate=JSON.parse(readFileSync(new URL('../ir/contraindication_example.ir.json',import.meta.url))).nodes[0];
export function draftBlocks(blocks,{documentSha,atcByBlock}) {
 const nodes=[],unconverted=[];
 for(const block of blocks) {
  const headers=block.cells?.[0]?.map(s=>s.toLowerCase().trim());
  const weight=headers?.findIndex(s=>s.includes('weight')),tablets=headers?.findIndex(s=>s.includes('tablet'));
  const isTable=block.kind==='table'&&weight>=0&&tablets>=0&&weight!==tablets;
  const isPregnancy=block.kind==='paragraph'&&/^Pregnancy:\s*not recommended\b/i.test(block.text.trim());
  if(!isTable&&!isPregnancy) {unconverted.push({block_id:block.id,reason:'not converted: review manually'});continue;}
  const n=structuredClone(isTable?tableTemplate:predicateTemplate),errors=[];
  n.id=`${documentSha}-${block.id}`;n.status='draft';n.risk='high';n.placeholder=true;n.reviewers=[];n.applies_to={atc:atcByBlock[block.id]??''};
  if(isPregnancy) n.applies_to.sex='F';
  // Only explicit source annotations supply additional applicability. Never inherit template indications.
  const sourceAtc=/\bATC ([A-Z][A-Z0-9]+)\b/.exec(block.text)?.[1];
  const sourceIcd=/\bICD-10 (?:prefix )?([A-Z][0-9]{2}(?:\.[A-Z0-9]{1,4})?)\b/.exec(block.text)?.[1];
  const sourceSex=/\bsex ([FMU])\b/.exec(block.text)?.[1];
  const sourceAge=/\bage(?:d)? (\d+(?:\.\d+)?) to (\d+(?:\.\d+)?) years inclusive\b/.exec(block.text);
  if(sourceAtc) {if(n.applies_to.atc&&n.applies_to.atc!==sourceAtc) errors.push('Supplied ATC conflicts with source ATC');n.applies_to.atc=sourceAtc;}
  if(sourceIcd) n.applies_to.icd10=sourceIcd;
  if(sourceSex) n.applies_to.sex=sourceSex;
  if(sourceAge) n.applies_to.age_years={min:Number(sourceAge[1]),max:Number(sourceAge[2])};
  n.source={page:block.page,bbox:[...block.bbox],text:block.text};
  if(!n.applies_to.atc.trim()) errors.push('Reviewer must supply the ATC code');
  if(isTable) {
   n.bands=[];
   if(headers.length!==2||block.cells.length<2) errors.push('Expected exactly weight and tablet columns with data rows');
   for(const [index,row] of block.cells.slice(1).entries()) {
    const range=/^(\d+(?:\.\d+)?)\s+to\s+<(\d+(?:\.\d+)?)$/.exec(row[weight]?.trim()??'');const value=/^\d+$/.test(row[tablets]?.trim()??'')?Number(row[tablets].trim()):NaN;
    if(row.length!==headers.length||!range||!Number.isSafeInteger(value)||Number(range[1])>=Number(range[2])) {errors.push(`Row ${index+2}: cannot parse weight band or integer tablets`);continue;}
    n.bands.push({min:Number(range[1]),max:Number(range[2]),min_inclusive:true,max_inclusive:false,value,unit:tableTemplate.bands[0].unit});
   }
   n.coverage=n.bands.length?{min:Math.min(...n.bands.map(b=>b.min)),max:Math.max(...n.bands.map(b=>b.max))}:{min:0,max:0};
  } else if(/trimester|unless|except|only|\bif\b/i.test(block.text)) errors.push('Qualified pregnancy text needs manual review; the simple pregnancy predicate cannot represent qualifiers');
  if(errors.length) n.parse_errors=errors;
  nodes.push({block_id:block.id,node:n});
 }
 return {nodes,unconverted};
}
export function contentHash(node) {const {status,reviewers,...content}=node;return inputsHash(content);}
export function generateDrafts(store,sha,body,{actor,now}) {
 requireMetadata(store,sha);exact(body,['atc_by_block']);exact(body.atc_by_block,Object.keys(body.atc_by_block??{}),[]);text(actor,'editor');timestamp(now);
 const blocks=listBlocks(store,sha);
 for(const [id,atc] of Object.entries(body.atc_by_block)) {if(!blocks.some(b=>b.id===id)) throw new ApiError('Unknown block '+id);text(atc,'ATC');}
 const result=draftBlocks(blocks,{documentSha:sha,atcByBlock:body.atc_by_block});
 // The shipped mock has explicit authored IR, not inferred scoring from arbitrary text.
 const sample=JSON.parse(readFileSync(new URL('../samples/dose-guide/bundle.json',import.meta.url)));
 if(sample.document_sha256===sha) for(const block of blocks) {
  const authored=sample.authored_rules_by_block?.[block.id];if(!authored) continue;
  if(authored.type!=='scored_triage'||authored.placeholder!==true||validateNodes([authored]).length) throw new ApiError('Invalid authored sample rule for '+block.id,422);
  if(authored.source.page!==block.page||JSON.stringify(authored.source.bbox)!==JSON.stringify(block.bbox)||authored.source.text!==block.text) throw new ApiError('Authored sample source does not match '+block.id,422);
  const node={...structuredClone(authored),id:`${sha}-${block.id}`,status:'draft',reviewers:[]};
  result.nodes.push({block_id:block.id,node});
 }

 store.transaction(()=>{for(const {block_id,node} of result.nodes) {
  if(store.db.prepare('SELECT 1 FROM nodes WHERE node_id=?').get(node.id)) continue;
  const hash=contentHash(node);store.db.prepare('INSERT INTO nodes VALUES(?,?,?,?,?,?)').run(node.id,sha,block_id,store.encode(node),hash,'[]');
  store.db.prepare('INSERT INTO review_events(node_id,kind,actor,occurred_at,before_hash,after_hash,snapshot) VALUES(?,?,?,?,?,?,?)').run(node.id,'draft-created',actor,now,'',hash,store.encode(node));
 }});
 return listDrafts(store,sha);
}
export function listDrafts(store,sha) {
 requireMetadata(store,sha);const blocks=listBlocks(store,sha);
 const nodes=store.db.prepare('SELECT * FROM nodes WHERE document_sha256=? ORDER BY node_id').all(sha).map(r=>({node:JSON.parse(r.node),content_hash:r.content_hash,approvals:JSON.parse(r.approvals),block:blocks.find(b=>b.id===r.block_id)}));
 return {nodes,unconverted:blocks.filter(b=>!nodes.some(n=>n.block.id===b.id)).map(b=>({block_id:b.id,reason:'not converted: review manually',block:b}))};
}
