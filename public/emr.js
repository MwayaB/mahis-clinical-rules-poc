import { initTriage,triageResultView } from './triage.js';
import {$,el,api,form,action,notice,error} from './common.js';
let patientId=null;
const triagePanel=initTriage({refreshPatient});
const base=()=>'/api/patients/'+encodeURIComponent(patientId);
function showAdvice(result) {
 $('advice').replaceChildren();
 if(!result.advice.length) $('advice').append(el('p',{},'Prescription recorded. No guideline advice for the supplied inputs.'));
 for(const a of result.advice) $('advice').append(el('div',{class:'advice '+a.severity},el('span',{class:'severity'},a.severity==='block'?'Hard stop · block advice':a.severity==='warn'?'Warning':'Information'),el('p',{},`Prescription recorded. Guideline advice: ${a.message}`),el('p',{class:'hash'},a.source_ref)));
 $('advice').append(el('p',{class:'hash'},`Package ${result.package_version} · engine ${result.engine_version}`),el('p',{class:'hash'},`Inputs SHA-256: ${result.inputs_hash}`));$('advice').focus();
}
async function refreshPatient() {
 if(!patientId) return;
 const [ctx,events,patients,diagnoses]=await Promise.all([api(base()+'/context'),api(base()+'/events'),api('/api/patients'),api(base()+'/diagnoses')]);const patient=patients.find(p=>p.patient_id===patientId);$('pregnant').value=ctx.pregnant===null?'':String(ctx.pregnant);$('patient-title-active').textContent=patient.name;
 $('observations').replaceChildren(...[['weight_kg','Weight (kg)'],['pregnant','Pregnancy status']].map(([key,label])=>el('div',{class:'observation-value'},el('span',{class:'muted'},label),ctx[key]===null?el('strong',{},el('span',{class:'badge missing'},'not recorded')):el('strong',{},key==='pregnant'?(ctx[key]?'Pregnant':'Not pregnant'):`${ctx[key]} kg`),el('p',{class:'source-meta'},ctx.recorded_at[key]?'Recorded '+ctx.recorded_at[key]:'Date not recorded'))));
 $('diagnosis-summary').replaceChildren(diagnoses.length?el('ul',{},diagnoses.map(d=>el('li',{},el('strong',{},d.icd10),' · '+d.label+' · '+d.certainty,el('p',{class:'source-meta'},'Recorded '+d.recorded_at)))):el('p',{},el('span',{class:'badge missing'},'not recorded'),' · Indication-dependent checks will warn'));
 $('events').replaceChildren(...events.map(e=>{
  const entry=el('details',{class:'event',open:['advice-shown','triage-recorded','triage-overridden'].includes(e.type)},el('summary',{},`#${e.seq} · ${e.type} · ${e.occurred_at}`));
  if(['advice-shown','triage-recorded'].includes(e.type)) {
   entry.append(el('p',{class:'hash'},`Package version: ${e.payload.package_version}`),el('p',{class:'hash'},`Engine version: ${e.payload.engine_version}`),el('p',{class:'hash'},`Inputs hash: ${e.payload.inputs_hash}`));
   const button=el('button',{type:'button',class:'secondary'},(e.type==='triage-recorded'?'Replay triage #':'Replay advice #')+e.seq),result=el('p');action(button,async()=>{const r=await api(`/api/events/${e.seq}/replay`,{});result.textContent=r.matches?'Replay matches the recorded advice.':'Replay does not match.';notice(result.textContent);});entry.append(button,result);
  }
  if(e.type==='triage-recorded') entry.append(triageResultView(e.payload.results));
  if(e.type==='triage-overridden') entry.append(el('p',{},`Override of ${e.payload.triage_ref}: ${e.payload.category} — ${e.payload.reason}`));
  entry.append(el('details',{},el('summary',{},'Raw event payload'),el('pre',{},JSON.stringify(e.payload,null,2))));return entry;
 }));
 await triagePanel.selectPatient(patientId,events);
}
async function listPatients() {
 const patients=await api('/api/patients');$('patient-list').replaceChildren(...patients.map(p=>{const b=el('button',{type:'button','aria-pressed':p.patient_id===patientId?'true':'false'},p.name);action(b,async()=>{patientId=p.patient_id;$('no-patient').hidden=true;$('patient-work').hidden=false;$('advice').replaceChildren(el('p',{class:'empty'},'Check a prescription to see advice.'));await listPatients();await refreshPatient();});return b;}));
}
form($('patient'),async()=>{const p=await api('/api/patients',{name:$('patient-name').value,sex:$('sex').value,...($('age-years').value===''?{}:{age_years:Number($('age-years').value)})});patientId=p.patient_id;$('no-patient').hidden=true;$('patient-work').hidden=false;await listPatients();await refreshPatient();notice('Placeholder patient created.');});
form($('weight-form'),async()=>{await api(base()+'/observations',{field:'weight_kg',value:Number($('weight').value)});await refreshPatient();notice('Weight recorded.');});
form($('pregnancy-form'),async()=>{await api(base()+'/status',{field:'pregnant',value:$('pregnant').value==='true'});await refreshPatient();notice('Pregnancy status recorded.');});
form($('diagnosis'),async()=>{const saved=await api(base()+'/diagnoses',{icd10:$('icd10').value,label:$('diagnosis-label').value,certainty:document.querySelector('input[name=certainty]:checked').value});await refreshPatient();notice(['Placeholder diagnosis recorded.',...(saved.warnings??[])].join(' '));});
form($('prescription'),async()=>{const r=await api(base()+'/prescriptions/check',{atc:$('atc').value||null,tablets:$('tablets').value===''?null:Number($('tablets').value),release_version:$('active-release').value});await refreshPatient();showAdvice(r.result);notice('Prescription and advice events recorded.');});
(async()=>{await listPatients();const releases=await api('/api/releases');$('active-release').replaceChildren(el('option',{value:''},releases.length?'Choose a signed release':'No release available — create one in Review'),...releases.map(r=>el('option',{value:r.version},r.version)));if(releases.length===1) $('active-release').value=releases[0].version;await triagePanel.configuration();})().catch(error);
