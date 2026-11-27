import { recordAssessments,replayAssessment } from './assessment.js';
import { defaultTerminology,isKnownCode,labelFor } from './terminology.js';
import { checkPregnancy } from './plausibility.js';
import { readFileSync } from 'node:fs';
const pregnancyRules=JSON.parse(readFileSync(new URL('../ir/contraindication_example.ir.json',import.meta.url))).nodes;
import { buildContext } from './context.js';
import { adviceFromAssessments } from './evaluator.js';
import { applyPackage } from './package.js';
import { validDay } from './events.js';
import { canonicalStringify,inputsHash } from './canonical.js';
function record(args,type,payload) {
 const {db,today,occurredAt,patientId,eventId}=args;
 if(!validDay(today)) throw new Error('Valid today required');
 if(type!=='patient-registered'&&!db.listForPatient(patientId).some(e=>e.type==='patient-registered')) throw new Error('Patient not registered');
 return db.append({event_id:eventId,patient_id:patientId,type,payload,occurred_at:occurredAt});
}
export const register=args=>record(args,'patient-registered',{name:args.name,sex:args.sex,...(args.age_years!==undefined?{age_years:args.age_years}:{})});
export const observe=args=>record(args,'observation-recorded',{field:args.field,value:args.value,...(args.supersedes?{supersedes:args.supersedes}:{})});
export const status=args=>{checkPregnancy(args.value,buildContext(args.db.listForPatient(args.patientId),{today:args.today}),args.rules??pregnancyRules);return record(args,'status-recorded',{field:args.field,value:args.value,...(args.supersedes?{supersedes:args.supersedes}:{})});};
export function diagnose(args) {
 const terminology=args.terminology??args.db.terminology??defaultTerminology;
 if(!isKnownCode(terminology,args.icd10)) {const e=new Error('icd10 unknown code '+JSON.stringify(args.icd10));e.status=422;throw e;}
 const label=labelFor(terminology,args.icd10),different=args.label!==undefined&&args.label!==label;
 const event=record(args,'diagnosis-recorded',{icd10:args.icd10,label,certainty:args.certainty??'suspected',system:terminology.system,terminology_version:terminology.terminology_version,...(different?{label_entered:args.label}:{})});
 return {...event,warnings:different?['Entered diagnosis label differs from terminology; canonical label stored']:[]};
}
export const respond=args=>record(args,'advice-response',{advice_ref:args.adviceRef,action:args.action,reason:args.reason??''});
export function prescribe(args) {
 if(args.atc!=null&&(typeof args.atc!=='string'||! /^[A-Z][0-9]{2}[A-Z]{2}[0-9]{2}$/.test(args.atc))) {const error=new Error('atc must contain only the 7-character ATC code; omit the ATC label and spaces');error.status=422;throw error;}
 const {db,today,patientId,packageDir,trustedPublicKeys,eventIds}=args;
 const pkg=applyPackage(packageDir,{trustedPublicKeys,engineVersion:'0.1.0'});
 return db.transaction(()=>{
  // Record proposal inputs before assessing; the legacy receipt remains the final two events.
  for(const [field,value] of [['proposed_atc',args.atc??null],['proposed_tablets',args.tablets??null]]) record({...args,eventId:args.eventIds.prescription+'-'+field},'observation-recorded',{field,value});
  const ctx=buildContext(db.listForPatient(patientId),{today,terminologyVersion:pkg.manifest.terminology_version});
  const assessed=recordAssessments({db,patientId,pkg,ctx,today,occurredAt:args.occurredAt,scope:'patient'});
  const result={advice:adviceFromAssessments(pkg,ctx,assessed.results),package_version:pkg.manifest.package_version,engine_version:pkg.engine_version,contains_placeholders:pkg.manifest.contains_placeholders,inputs_hash:inputsHash(ctx)};
  const draft=record({...args,eventId:eventIds.prescription},'prescription-drafted',{atc:args.atc??null,tablets:args.tablets??null});
  const shown=record({...args,eventId:eventIds.advice},'advice-shown',{
   rule_ids:result.advice.map(a=>a.rule_id),severities:result.advice.map(a=>a.severity),package_version:result.package_version,engine_version:result.engine_version,inputs_hash:result.inputs_hash,
   context_up_to_seq:draft.seq,rules_sha256:pkg.manifest.rules_sha256,manifest_sha256:inputsHash(pkg.manifest),today,advice:result.advice
  });
  return {result,draft,shown,exitCode:result.advice.some(a=>a.severity==='block')?2:0};
 });
}
export const replay=replayAssessment;
