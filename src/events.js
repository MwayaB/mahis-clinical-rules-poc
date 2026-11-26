import { DatabaseSync } from 'node:sqlite';
import { canonicalStringify } from './canonical.js';
import { fields,nonempty } from './ir.js';
const shapes={
 'patient-registered':['name','sex'], 'observation-recorded':['field','value'], 'status-recorded':['field','value'],
 'diagnosis-recorded':['icd10','label','certainty'], 'prescription-drafted':['atc','tablets'],
 'advice-shown':['rule_ids','severities','package_version','engine_version','inputs_hash','context_up_to_seq','rules_sha256','manifest_sha256','today','advice'],
 'advice-response':['advice_ref','action','reason']
};
export function validDay(s) {
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
 const [y,m,d]=s.split('-').map(Number);const days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];return y>=1&&m>=1&&m<=12&&d>=1&&d<=days[m-1];
}
export function validTimestamp(s) {return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?Z$/.test(s)&&validDay(s.slice(0,10));}
export function openEventLog(path) {
 const sql=new DatabaseSync(path);sql.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT NOT NULL UNIQUE,patient_id TEXT NOT NULL,type TEXT NOT NULL,payload TEXT NOT NULL,occurred_at TEXT NOT NULL);
 CREATE TRIGGER IF NOT EXISTS no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'append-only'); END;
 CREATE TRIGGER IF NOT EXISTS no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'append-only'); END;`);
 const decode=r=>r?{...r,payload:JSON.parse(r.payload)}:null;
 const byId=id=>decode(sql.prepare('SELECT * FROM events WHERE event_id=?').get(id));
 const api={
  append(event) {
   const errors=[];if(!fields(event,['event_id','patient_id','type','payload','occurred_at'],['event_id','patient_id','type','payload','occurred_at'],'event',errors)) throw new Error(errors.join('; '));
   if(!nonempty(event.event_id)||!nonempty(event.patient_id)||!validTimestamp(event.occurred_at)) errors.push('Invalid event identity or timestamp');
   const allowed=shapes[event.type];const p=event.payload;
   if(!allowed) errors.push('Unknown event type');
   else if(fields(p,[...allowed,'supersedes',...(event.type==='patient-registered'?['age_years']:[])],allowed,'payload',errors)) {
    switch(event.type) {
     case 'patient-registered': if(!nonempty(p.name)||!['F','M','U'].includes(p.sex)) errors.push('Invalid registration');break;
     case 'observation-recorded': if(p.field!=='weight_kg'||typeof p.value!=='number'||!Number.isFinite(p.value)||p.value<=0) errors.push('Invalid weight');break;
     case 'status-recorded': if(p.field!=='pregnant'||typeof p.value!=='boolean') errors.push('Invalid pregnancy status');break;
     case 'diagnosis-recorded': if(!nonempty(p.icd10)||!nonempty(p.label)||!['suspected','confirmed'].includes(p.certainty)) errors.push('Invalid diagnosis');break;
     case 'prescription-drafted': if(p.atc!==null&&!nonempty(p.atc)||p.tablets!==null&&(!Number.isInteger(p.tablets)||p.tablets<0)) errors.push('Invalid prescription');break;
     case 'advice-shown': {
      if(!validDay(p.today)||!Array.isArray(p.rule_ids)||!p.rule_ids.every(nonempty)||!Array.isArray(p.severities)||p.severities.some(x=>!['block','warn','info'].includes(x))||p.rule_ids.length!==p.severities.length||!nonempty(p.package_version)||!nonempty(p.engine_version)||![p.inputs_hash,p.rules_sha256,p.manifest_sha256].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x))||!Number.isSafeInteger(p.context_up_to_seq)||p.context_up_to_seq<0||!Array.isArray(p.advice)) errors.push('Invalid advice audit');
      else {
       const prior=Number(sql.prepare('SELECT coalesce(max(seq),0) AS seq FROM events WHERE patient_id=?').get(event.patient_id).seq);
       if(p.context_up_to_seq!==prior) errors.push('Advice cutoff must be patient predecessor');
       for(const a of p.advice) if(fields(a,['rule_id','severity','message','source_ref'],['rule_id','severity','message','source_ref'],'advice',errors)) {if(!nonempty(a.rule_id)||!nonempty(a.message)||!nonempty(a.source_ref)||!['block','warn','info'].includes(a.severity)) errors.push('Invalid advice item');}
       if(canonicalStringify(p.rule_ids)!==canonicalStringify(p.advice.map(x=>x.rule_id))||canonicalStringify(p.severities)!==canonicalStringify(p.advice.map(x=>x.severity))) errors.push('Inconsistent advice audit');
      } break;
     }
     case 'advice-response': {const ref=byId(p.advice_ref);if(!ref||ref.patient_id!==event.patient_id||ref.type!=='advice-shown'||!['accepted','overridden'].includes(p.action)||typeof p.reason!=='string'||p.action==='overridden'&&!nonempty(p.reason)) errors.push('Invalid advice response');break;}
    }
    if(Object.hasOwn(p,'supersedes')) {
     const prior=byId(p.supersedes);
     if(!prior||prior.patient_id!==event.patient_id||prior.type!==event.type||prior.payload.field!==p.field||['advice-shown','advice-response'].includes(event.type)) errors.push('Invalid supersedes target');
    }
   }
   if(errors.length) throw new Error(errors.join('; '));
   const result=sql.prepare('INSERT INTO events(event_id,patient_id,type,payload,occurred_at) VALUES(?,?,?,?,?)').run(event.event_id,event.patient_id,event.type,canonicalStringify(p),event.occurred_at);
   return {...event,seq:Number(result.lastInsertRowid)};
  },
  listForPatient(patientId,{upToSeq=Number.MAX_SAFE_INTEGER}={}) {
   if(!nonempty(patientId)||!Number.isSafeInteger(upToSeq)||upToSeq<0) throw new Error('Invalid patient or cutoff');
   return sql.prepare('SELECT * FROM events WHERE patient_id=? AND seq<=? ORDER BY seq').all(patientId,upToSeq).map(decode);
  },
  transaction(fn) {sql.exec('BEGIN IMMEDIATE');try {const result=fn();sql.exec('COMMIT');return result;} catch(e) {sql.exec('ROLLBACK');throw e;}},
  close() {sql.close();}
 };
 return api;
}
export const append=(db,event)=>db.append(event);
export const listForPatient=(db,id,options)=>db.listForPatient(id,options);
