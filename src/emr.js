import { inputCatalog } from './inputs.js';
import { replayAssessment } from './assessment.js';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { exact,text,ApiError,timestamp } from './prototype/store.js';
import { buildContext } from './context.js';
import * as workflow from './workflow.js';
import { getRelease,loadRelease } from './release.js';
export function listPatients(store) {return store.db.prepare('SELECT record FROM patients ORDER BY patient_id').all().map(r=>JSON.parse(r.record));}
export function getPatient(store,id) {text(id,'patient ID');const row=store.db.prepare('SELECT record FROM patients WHERE patient_id=?').get(id);if(!row) throw new ApiError('Patient not found',404);return JSON.parse(row.record);}
const args=(db,id,now)=>({db,patientId:id,today:timestamp(now).slice(0,10),occurredAt:now,eventId:randomUUID()});
export function createPatient(store,db,body,{now}) {
 exact(body,['name','sex','patient_id','age_years'],['name','sex']);text(body.name,'name');if(!inputCatalog.find(d=>d.name==='sex').domain.values.includes(body.sex)) throw new ApiError('Sex must be F, M or U');
 const id=body.patient_id===undefined?randomUUID():text(body.patient_id,'patient ID');if(store.db.prepare('SELECT 1 FROM patients WHERE patient_id=?').get(id)) throw new ApiError('Patient ID already exists',409);
 workflow.register({...args(db,id,now),name:body.name,sex:body.sex,age_years:body.age_years});
 const record={patient_id:id,name:body.name,sex:body.sex,age_years:body.age_years??null,created_at:now,placeholder:true};store.db.prepare('INSERT INTO patients VALUES(?,?)').run(id,store.encode(record));return record;
}
export function patientEvents(store,db,id) {getPatient(store,id);return db.listForPatient(id);}
export function patientContext(store,db,id,{now}) {return buildContext(patientEvents(store,db,id),{today:timestamp(now).slice(0,10)});}
export function recordObservation(store,db,id,body,{now}) {getPatient(store,id);exact(body,['field','value','supersedes'],['field','value']);return workflow.observe({...args(db,id,now),...body});}
export function recordStatus(store,db,id,body,{now,keyDir}) {
 getPatient(store,id);exact(body,['field','value','supersedes','release_version'],['field','value']);
 const {release_version,...status}=body;let rules;
 if(release_version!==undefined) {
  try {rules=loadRelease(store,release_version,{keyDir}).rules;}
  catch(e) {if(e.status) throw e;throw new ApiError(`Cannot verify selected release ${release_version}: ${e.message}`,409);}
 }
 return workflow.status({...args(db,id,now),...status,...(rules!==undefined?{rules}:{})});
}
export function recordDiagnosis(store,db,id,body,{now}) {getPatient(store,id);exact(body,['icd10','label','certainty'],['icd10','label']);return workflow.diagnose({...args(db,id,now),...body});}
export function patientDiagnoses(store,db,id) {
 const events=patientEvents(store,db,id),retired=new Set(events.map(e=>e.payload.supersedes).filter(Boolean));
 return events.filter(e=>e.type==='diagnosis-recorded'&&!retired.has(e.event_id)).map(e=>({event_id:e.event_id,icd10:e.payload.icd10,label:e.payload.label,certainty:e.payload.certainty,system:e.payload.system??null,terminology_version:e.payload.terminology_version??null,recorded_at:e.occurred_at}));
}
export function checkPrescription(store,db,id,body,{now,keyDir}) {
 getPatient(store,id);exact(body,['atc','tablets','release_version'],['release_version']);
 getRelease(store,body.release_version);loadRelease(store,body.release_version,{keyDir});
 return workflow.prescribe({...args(db,id,now),atc:body.atc??null,tablets:body.tablets??null,packageDir:join(store.root,'releases',body.release_version),trustedPublicKeys:[join(keyDir,'dev-public.pem')],eventIds:{prescription:randomUUID(),advice:randomUUID()}});
}
export function replayAdvice(store,db,seq,{keyDir}) {
 if(!Number.isSafeInteger(seq)||seq<1) throw new ApiError('Invalid event seq');
 let found;for(const p of listPatients(store)) {found=db.listForPatient(p.patient_id,{upToSeq:seq}).find(e=>e.seq===seq);if(found) break;}
 if(!found||!['advice-shown','assessment-recorded'].includes(found.type)) throw new ApiError('Advice event not found',404);
 const pkg=loadRelease(store,found.payload.package_version,{keyDir});const result=replayAssessment({db,patientId:found.patient_id,adviceEvent:found,loadedPackage:pkg});
 return {matches:true,event_seq:seq,result};
}
