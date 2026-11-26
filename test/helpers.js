import { readFileSync } from 'node:fs';
export const dose = JSON.parse(readFileSync(new URL('../ir/dose_band_example.ir.json',import.meta.url)));
export const predicate = JSON.parse(readFileSync(new URL('../ir/contraindication_example.ir.json',import.meta.url)));
export const ir = {...dose,nodes:[...dose.nodes,...predicate.nodes]};
export const clone = x=>structuredClone(x);
export const ctx = (changes={})=>Object.freeze({sex:'F',age_years:30,today:'2026-01-01',weight_kg:12,pregnant:false,proposed_atc:'P01BF01',proposed_tablets:2,...changes});

import { mkdtempSync,writeFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { compile } from '../src/compiler.js';
import { openEventLog } from '../src/events.js';
import { register,observe,prescribe } from '../src/workflow.js';
export function environment(t) {
 const root=mkdtempSync(join(tmpdir(),'workflow-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const keys=generateKeyPairSync('ed25519'),pub=join(root,'pub.pem'),dir=join(root,'pkg');writeFileSync(pub,keys.publicKey.export({type:'spki',format:'pem'}));
 const fixtures=['dose_band_example','contraindication_example'].flatMap(n=>JSON.parse(readFileSync(new URL('../fixtures/'+n+'.fixtures.json',import.meta.url))));
 compile(ir,{dir,privateKey:keys.privateKey,fixtures});const db=openEventLog(join(root,'events.db'));t.after(()=>db.close());
 let id=0;const args=()=>({db,today:'2026-01-01',occurredAt:'2026-01-01T10:00:00.000Z',patientId:'P1',eventId:'id-'+(++id)});
 const rx=(changes={})=>prescribe({...args(),packageDir:dir,trustedPublicKeys:[pub],atc:'P01BF01',tablets:2,eventIds:{prescription:'rx-'+(++id),advice:'advice-'+(++id)},...changes});
 register({...args(),name:'PLACEHOLDER test patient (age unspecified)',sex:'F',age_years:30});
 return {root,keys,pub,dir,fixtures,db,args,rx};
}
