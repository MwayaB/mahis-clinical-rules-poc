import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { canonicalStringify } from '../canonical.js';
import { fields,nonempty } from '../ir.js';
import { validTimestamp } from '../events.js';
export class ApiError extends Error { constructor(message,status=400) {super(message);this.status=status;} }
export function exact(value,allowed,required=allowed) {const errors=[];fields(value,allowed,required,'request',errors);if(errors.length) throw new ApiError(errors.join('; '));return value;}
export function text(value,name='value') {if(!nonempty(value)||value.length>500) throw new ApiError(`${name} must be a nonempty string (max 500 characters)`);return value;}
export function digest(value) {if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value)) throw new ApiError('Checksum must be exactly 64 lowercase hex characters');return value;}
export function timestamp(value) {if(!validTimestamp(value)) throw new ApiError('Valid UTC timestamp required');return value;}
export function openStore(dataDir) {
 const root=resolve(dataDir);mkdirSync(root,{recursive:true});const db=new DatabaseSync(join(root,'prototype.db'));
 db.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS sources(sha256 TEXT PRIMARY KEY,record TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS digitisations(document_sha256 TEXT NOT NULL,block_id TEXT NOT NULL,record TEXT NOT NULL,PRIMARY KEY(document_sha256,block_id));
 CREATE TABLE IF NOT EXISTS nodes(node_id TEXT PRIMARY KEY,document_sha256 TEXT NOT NULL,block_id TEXT NOT NULL,node TEXT NOT NULL,content_hash TEXT NOT NULL,approvals TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS review_events(seq INTEGER PRIMARY KEY AUTOINCREMENT,node_id TEXT NOT NULL,kind TEXT NOT NULL,actor TEXT NOT NULL,occurred_at TEXT NOT NULL,before_hash TEXT NOT NULL,after_hash TEXT NOT NULL,snapshot TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS fixtures(node_id TEXT PRIMARY KEY,content_hash TEXT NOT NULL,entries TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS releases(version TEXT PRIMARY KEY,record TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS patients(patient_id TEXT PRIMARY KEY,record TEXT NOT NULL);`);
 for(const table of ['review_events','releases','digitisations']) for(const action of ['UPDATE','DELETE']) db.exec(`CREATE TRIGGER IF NOT EXISTS ${table}_no_${action} BEFORE ${action} ON ${table} BEGIN SELECT RAISE(ABORT,'append-only'); END;`);
 return {root,db,encode:canonicalStringify,transaction(fn) {db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}},close(){db.close();}};
}
