import { mkdirSync,writeFileSync } from 'node:fs';
import { join,basename } from 'node:path';
import { sha256 } from './compiler.js';
import { ApiError,exact,text,digest,timestamp } from './prototype/store.js';
export const MAX_UPLOAD=25*1024*1024;
export function getSource(store,sha) {digest(sha);const row=store.db.prepare('SELECT record FROM sources WHERE sha256=?').get(sha);if(!row) throw new ApiError('Guideline not found',404);return JSON.parse(row.record);}
export function listSources(store) {return store.db.prepare('SELECT record FROM sources ORDER BY sha256').all().map(r=>JSON.parse(r.record));}
export function uploadGuideline(store,{bytes,contentType,filename,documentId,user='local-user',now}) {
 if(contentType!=='application/pdf') throw new ApiError('Content-Type must be application/pdf',415);
 if(!Buffer.isBuffer(bytes)||bytes.length>MAX_UPLOAD) throw new ApiError('PDF exceeds 25 MB',413);
 if(bytes.length<5||bytes.subarray(0,5).toString('ascii')!=='%PDF-') throw new ApiError('File must begin with %PDF-');
 text(filename,'filename');if(basename(filename)!==filename||filename.includes('\\')||/[\x00-\x1f]/.test(filename)) throw new ApiError('Filename must be a plain filename');
 text(documentId,'document_id');text(user,'X-User');timestamp(now);
 const hash=sha256(bytes),existing=store.db.prepare('SELECT record FROM sources WHERE sha256=?').get(hash);
 if(existing) return JSON.parse(existing.record);
 const record={document_id:documentId,edition:null,filename,sha256:hash,uploaded_at:now,uploaded_by:user,status:'uploaded'};
 const dir=join(store.root,'sources');mkdirSync(dir,{recursive:true});
 try {writeFileSync(join(dir,hash+'.pdf'),bytes,{flag:'wx',mode:0o600});}catch(e){if(e.code!=='EEXIST') throw e;}
 store.db.prepare('INSERT INTO sources VALUES(?,?)').run(hash,store.encode(record));return record;
}
export function setMetadata(store,sha,body) {
 exact(body,['edition']);text(body.edition,'edition');const source=getSource(store,sha);
 if(source.edition!==null&&source.edition!==body.edition) throw new ApiError('Metadata is already set; conflicting edition refused',409);
 source.edition=body.edition;source.status='metadata-set';store.db.prepare('UPDATE sources SET record=? WHERE sha256=?').run(store.encode(source),sha);return source;
}
export function requireMetadata(store,sha) {const source=getSource(store,sha);if(source.status!=='metadata-set') throw new ApiError('Set edition metadata before continuing',409);return source;}
