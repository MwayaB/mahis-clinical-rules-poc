import { checkPregnancy } from './plausibility.js';
import { readFileSync } from 'node:fs';
const pregnancyRules=JSON.parse(readFileSync(new URL('../ir/contraindication_example.ir.json',import.meta.url))).nodes;
import { buildContext } from './context.js';
import { evaluate } from './evaluator.js';
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
export const diagnose=args=>record(args,'diagnosis-recorded',{icd10:args.icd10,label:args.label,certainty:args.certainty??'suspected'});
export const respond=args=>record(args,'advice-response',{advice_ref:args.adviceRef,action:args.action,reason:args.reason??''});
export function prescribe(args) {
 const {db,today,patientId,packageDir,trustedPublicKeys,eventIds}=args;
 const pkg=applyPackage(packageDir,{trustedPublicKeys,engineVersion:'0.1.0'});
 return db.transaction(()=>{
  const draft=record({...args,eventId:eventIds.prescription},'prescription-drafted',{atc:args.atc??null,tablets:args.tablets??null});
  const ctx=buildContext(db.listForPatient(patientId,{upToSeq:draft.seq}),{today});
  const result=evaluate(pkg,ctx);
  const shown=record({...args,eventId:eventIds.advice},'advice-shown',{
   rule_ids:result.advice.map(a=>a.rule_id),severities:result.advice.map(a=>a.severity),package_version:result.package_version,engine_version:result.engine_version,inputs_hash:result.inputs_hash,
   context_up_to_seq:draft.seq,rules_sha256:pkg.manifest.rules_sha256,manifest_sha256:inputsHash(pkg.manifest),today,advice:result.advice
  });
  return {result,draft,shown,exitCode:result.advice.some(a=>a.severity==='block')?2:0};
 });
}
export function replay({db,patientId,adviceEvent,loadedPackage}) {
 const e=adviceEvent,p=e.payload,pkg=loadedPackage;
 if(e.patient_id!==patientId||e.type!=='advice-shown') throw new Error('Wrong advice event');
 const stored=db.listForPatient(patientId,{upToSeq:e.seq}).find(x=>x.event_id===e.event_id);
 if(!stored||canonicalStringify(stored)!==canonicalStringify(e)||p.context_up_to_seq>=e.seq) throw new Error('Advice event or cutoff mismatch');
 if(p.package_version!==pkg.manifest.package_version||p.engine_version!==pkg.engine_version||p.rules_sha256!==pkg.manifest.rules_sha256||p.manifest_sha256!==inputsHash(pkg.manifest)) throw new Error('Exact recorded package required');
 const ctx=buildContext(db.listForPatient(patientId,{upToSeq:p.context_up_to_seq}),{today:p.today});
 const result=evaluate(pkg,ctx);
 if(result.inputs_hash!==p.inputs_hash||canonicalStringify(result.advice)!==canonicalStringify(p.advice)) throw new Error('Replay differs from recorded advice');
 return result;
}
