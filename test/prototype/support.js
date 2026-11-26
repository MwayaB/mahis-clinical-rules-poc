import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../../src/prototype/store.js';
import { uploadGuideline,setMetadata } from '../../src/registry.js';
export const NOW='2026-01-01T10:00:00.000Z';
export function setup(t) {const root=mkdtempSync(join(tmpdir(),'prototype-'));const store=openStore(root);t.after(()=>{store.close();rmSync(root,{recursive:true,force:true});});return store;}
export function source(store) {const s=uploadGuideline(store,{bytes:Buffer.from('%PDF-PLACEHOLDER test bytes'),contentType:'application/pdf',filename:'placeholder.pdf',documentId:'PLACEHOLDER-GUIDE',now:NOW});return setMetadata(store,s.sha256,{edition:'placeholder-2026'});}
