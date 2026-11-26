import { readFileSync,existsSync } from 'node:fs';
import { join } from 'node:path';
import { ApiError,exact,text,digest } from './prototype/store.js';
import { requireMetadata } from './registry.js';
export function validateBlock(block) {
 exact(block,['page','id','kind','bbox','text','cells'],['page','id','kind','bbox','text']);
 text(block.id,'block id');if(!/^[a-zA-Z0-9_-]+$/.test(block.id)) throw new ApiError('Block id must contain letters, digits, underscores or hyphens');
 if(!Number.isInteger(block.page)||block.page<1||!['table','paragraph'].includes(block.kind)||!Array.isArray(block.bbox)||block.bbox.length!==4||!block.bbox.every(Number.isFinite)||block.bbox[0]>block.bbox[2]||block.bbox[1]>block.bbox[3]||typeof block.text!=='string'||!block.text.trim()) throw new ApiError('Invalid block page, kind, bbox or text');
 if(block.kind==='table'&&(!Array.isArray(block.cells)||!block.cells.length||block.cells.some(row=>!Array.isArray(row)||!row.length||row.some(cell=>typeof cell!=='string')))) throw new ApiError('Table requires string cells');
 if(block.kind==='paragraph'&&Object.hasOwn(block,'cells')) throw new ApiError('Paragraph does not accept cells');
 return block;
}
export function listBlocks(store,sha) {requireMetadata(store,sha);return store.db.prepare('SELECT record FROM digitisations WHERE document_sha256=? ORDER BY block_id').all(sha).map(r=>JSON.parse(r.record));}
export function manualBlock(store,sha,block) {
 requireMetadata(store,sha);validateBlock(block);
 const record={...block,digitiser:'manual',document_sha256:sha};
 if(store.db.prepare('SELECT 1 FROM digitisations WHERE document_sha256=? AND block_id=?').get(sha,block.id)) throw new ApiError('Block id already exists; history cannot be replaced',409);
 store.db.prepare('INSERT INTO digitisations VALUES(?,?,?)').run(sha,block.id,store.encode(record));return record;
}
export function digitise(store,sha,{fixtureDir=new URL('../fixtures/digitised/',import.meta.url)}={}) {
 digest(sha);requireMetadata(store,sha);
 const previous=listBlocks(store,sha).filter(b=>b.digitiser==='mock-fixture');if(previous.length) return {digitiser:'mock-fixture',document_sha256:sha,blocks:previous};
 const path=fixtureDir instanceof URL?new URL(sha+'.json',fixtureDir):join(fixtureDir,sha+'.json');
 if(!existsSync(path)) throw new ApiError('No digitisation available for this file. Use the manual entry path.',404);
 const fixture=JSON.parse(readFileSync(path));exact(fixture,['digitiser','document_sha256','pages']);
 if(fixture.digitiser!=='mock-fixture'||fixture.document_sha256!==sha||!Array.isArray(fixture.pages)||!fixture.pages.length) throw new ApiError('Invalid mock fixture');
 const blocks=[];
 for(const page of fixture.pages) {exact(page,['page','blocks']);if(!Array.isArray(page.blocks)) throw new ApiError('Invalid fixture blocks');for(const block of page.blocks) {const full={...block,page:page.page};validateBlock(full);blocks.push({...full,digitiser:'mock-fixture',document_sha256:sha});}}
 if(!blocks.length) throw new ApiError('Empty mock fixture');
 store.transaction(()=>{for(const b of blocks) {
  if(store.db.prepare('SELECT 1 FROM digitisations WHERE document_sha256=? AND block_id=?').get(sha,b.id)) throw new ApiError('Mock block conflicts with manual block; refusing overwrite',409);
  store.db.prepare('INSERT INTO digitisations VALUES(?,?,?)').run(sha,b.id,store.encode(b));
 }});
 return {digitiser:'mock-fixture',document_sha256:sha,blocks};
}
