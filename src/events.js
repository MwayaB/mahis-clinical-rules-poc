import { validateTriageResults } from './triage-records.js';
import { defaultTerminology,isKnownCode,labelFor } from './terminology.js';
import { checkNumber, checkPregnancy,checkTriageObservation,triageEntry } from './plausibility.js';
import { DatabaseSync } from 'node:sqlite';
import { canonicalStringify } from './canonical.js';
import { fields,nonempty } from './ir.js';
const shapes={
 'patient-registered':['name','sex'], 'observation-recorded':['field','value'], 'status-recorded':['field','value'],
 'diagnosis-recorded':['icd10','label','certainty','system','terminology_version'], 'prescription-drafted':['atc','tablets'],
 'advice-shown':['rule_ids','severities','package_version','engine_version','inputs_hash','context_up_to_seq','rules_sha256','manifest_sha256','today','advice'],
 'advice-response':['advice_ref','action','reason'],
 'encounter-opened':['encounter_id','population'],
 'triage-recorded':['encounter_id','population','results','package_version','engine_version','inputs_hash','context_up_to_seq','rules_sha256','manifest_sha256'],
 'triage-overridden':['encounter_id','triage_ref','category','reason']
};
export function validDay(s) {
 if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
 const [y,m,d]=s.split('-').map(Number);const days=[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31];return y>=1&&m>=1&&m<=12&&d>=1&&d<=days[m-1];
}
export function validTimestamp(s) {return typeof s==='string'&&/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{3})?Z$/.test(s)&&validDay(s.slice(0,10));}
export function openEventLog(path,{terminology=defaultTerminology}={}) {
 const sql=new DatabaseSync(path);sql.exec(`PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS events (seq INTEGER PRIMARY KEY AUTOINCREMENT,event_id TEXT NOT NULL UNIQUE,patient_id TEXT NOT NULL,type TEXT NOT NULL,payload TEXT NOT NULL,occurred_at TEXT NOT NULL);
 CREATE TRIGGER IF NOT EXISTS no_update BEFORE UPDATE ON events BEGIN SELECT RAISE(ABORT,'append-only'); END;
 CREATE TRIGGER IF NOT EXISTS no_delete BEFORE DELETE ON events BEGIN SELECT RAISE(ABORT,'append-only'); END;`);
 const decode=r=>r?{...r,payload:JSON.parse(r.payload)}:null;
 const byId=id=>decode(sql.prepare('SELECT * FROM events WHERE event_id=?').get(id));
 const api={
  terminology,
  append(event) {
   const errors=[];if(!fields(event,['event_id','patient_id','type','payload','occurred_at'],['event_id','patient_id','type','payload','occurred_at'],'event',errors)) throw new Error(errors.join('; '));
   if(!nonempty(event.event_id)||!nonempty(event.patient_id)||!validTimestamp(event.occurred_at)) errors.push('Invalid event identity or timestamp');
   const allowed=shapes[event.type];const p=event.payload;
   if(!allowed) errors.push('Unknown event type');
   else if(fields(p,[...allowed,'supersedes',...(event.type==='patient-registered'?['age_years']:[]),...(event.type==='diagnosis-recorded'?['label_entered']:[]),...(event.type==='observation-recorded'?['encounter_id']:[])],allowed,'payload',errors)) {
    switch(event.type) {
     case 'patient-registered': if(p.age_years!==undefined) checkNumber('age_years',p.age_years);if(!nonempty(p.name)||!['F','M','U'].includes(p.sex)) errors.push('Invalid registration');break;
     case 'observation-recorded': {
      if(p.field==='weight_kg') checkNumber('weight_kg',p.value);
      else if(triageEntry.fields.some(f=>f.input===p.field)) {checkTriageObservation(p.field,p.value);if(!nonempty(p.encounter_id)) errors.push('Triage observation requires encounter_id');}
      else errors.push('Unknown observation field');
      if(p.encounter_id!==undefined) {const encounter=api.findEncounter(p.encounter_id);if(!encounter||encounter.patient_id!==event.patient_id) errors.push('Unknown or wrong-patient encounter');}
      break;
     }
     case 'status-recorded': {const registration=api.listForPatient(event.patient_id).filter(e=>e.type==='patient-registered').at(-1);checkPregnancy(p.value,registration?.payload??{});}if(p.field!=='pregnant'||typeof p.value!=='boolean') errors.push('Invalid pregnancy status');break;
     case 'diagnosis-recorded': {
      if(!isKnownCode(terminology,p.icd10)||p.system!==terminology.system||p.terminology_version!==terminology.terminology_version||p.label!==labelFor(terminology,p.icd10)) {const e=new Error('icd10 must be an exact known code with canonical label, system and terminology_version');e.status=422;throw e;}
      if(p.label_entered!==undefined&&typeof p.label_entered!=='string') errors.push('Invalid label_entered');
     }if(!nonempty(p.icd10)||!nonempty(p.label)||!['suspected','confirmed','presumptive','ruled-out'].includes(p.certainty)) errors.push('Invalid diagnosis');break;
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
     case 'encounter-opened': {
      if(!nonempty(p.encounter_id)||!nonempty(p.population)||api.findEncounter(p.encounter_id)||!api.listForPatient(event.patient_id).some(e=>e.type==='patient-registered')) errors.push('Invalid encounter');break;
     }
     case 'triage-recorded': {
      const encounter=api.findEncounter(p.encounter_id);
      if(!encounter||encounter.patient_id!==event.patient_id||encounter.payload.population!==p.population) errors.push('Invalid triage encounter');
      validateTriageResults(p.results,{fields,nonempty},errors);
      if(!nonempty(p.package_version)||!nonempty(p.engine_version)||![p.inputs_hash,p.rules_sha256,p.manifest_sha256].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x))||p.context_up_to_seq!==api.listForPatient(event.patient_id).at(-1)?.seq) errors.push('Invalid triage audit cutoff or metadata');
      if(Array.isArray(p.results)&&p.results.some(r=>r.package_version!==p.package_version||r.engine_version!==p.engine_version||r.inputs_hash!==p.inputs_hash)) errors.push('Inconsistent triage metadata');break;
     }
     case 'triage-overridden': {
      const prior=byId(p.triage_ref);
      if(!prior||prior.patient_id!==event.patient_id||prior.type!=='triage-recorded'||prior.payload.encounter_id!==p.encounter_id||!prior.payload.results.every(r=>r.status==='scored')||!nonempty(p.category)||!nonempty(p.reason)) errors.push('Invalid triage override');break;
     }
     case 'advice-response': {const ref=byId(p.advice_ref);if(!ref||ref.patient_id!==event.patient_id||ref.type!=='advice-shown'||!['accepted','overridden'].includes(p.action)||typeof p.reason!=='string'||p.action==='overridden'&&!nonempty(p.reason)) errors.push('Invalid advice response');break;}
    }
    if(Object.hasOwn(p,'supersedes')) {
     const prior=byId(p.supersedes);
     if(!prior||prior.patient_id!==event.patient_id||prior.type!==event.type||prior.payload.field!==p.field||['advice-shown','advice-response','encounter-opened','triage-recorded','triage-overridden'].includes(event.type)||prior.payload.encounter_id!==p.encounter_id) errors.push('Invalid supersedes target');
    }
   }
   if(errors.length) throw new Error(errors.join('; '));
   const result=sql.prepare('INSERT INTO events(event_id,patient_id,type,payload,occurred_at) VALUES(?,?,?,?,?)').run(event.event_id,event.patient_id,event.type,canonicalStringify(p),event.occurred_at);
   return {...event,seq:Number(result.lastInsertRowid)};
  },
  findEncounter(encounterId) {return decode(sql.prepare("SELECT * FROM events WHERE type='encounter-opened' AND json_extract(payload,'$.encounter_id')=?").get(encounterId));},
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
