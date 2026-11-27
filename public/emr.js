import { initAssessment,renderResults } from './assessment.js';
import {$,el,api,form,action,notice,error} from './common.js';
let patientId=null;
const assessmentPanel=initAssessment({refreshPatient});
const base=()=>'/api/patients/'+encodeURIComponent(patientId);
async function refreshPatient() {
 if(!patientId) return;
 const [ctx,events,patients,diagnoses]=await Promise.all([api(base()+'/context'),api(base()+'/events'),api('/api/patients'),api(base()+'/diagnoses')]);const patient=patients.find(p=>p.patient_id===patientId);$('patient-title-active').textContent=patient.name;
 $('diagnosis-summary').replaceChildren(diagnoses.length?el('ul',{},diagnoses.map(d=>el('li',{},el('strong',{},d.icd10),' · '+d.label+' · '+d.certainty,el('p',{class:'source-meta'},'Recorded '+d.recorded_at)))):el('p',{},el('span',{class:'badge missing'},'not recorded'),' · Indication-dependent checks will warn'));
 $('events').replaceChildren(...events.map(e=>{
  const entry=el('details',{class:'event',open:['advice-shown','assessment-recorded','assessment-overridden'].includes(e.type)},el('summary',{},`#${e.seq} · ${e.type} · ${e.occurred_at}`));
  if(['advice-shown','assessment-recorded'].includes(e.type)) {
   entry.append(el('p',{class:'hash'},`Package version: ${e.payload.package_version}`),el('p',{class:'hash'},`Engine version: ${e.payload.engine_version}`),el('p',{class:'hash'},`Inputs hash: ${e.payload.inputs_hash}`));
   const button=el('button',{type:'button',class:'secondary'},(e.type==='assessment-recorded'?'Replay assessment #':'Replay advice #')+e.seq),result=el('p');action(button,async()=>{const r=await api(`/api/events/${e.seq}/replay`,{});result.textContent=r.matches?'Replay matches the recorded result.':'Replay does not match.';notice(result.textContent);});entry.append(button,result);
  }
  if(e.type==='assessment-recorded') entry.append(renderResults(e.payload.result?[e.payload.result]:e.payload.results));
  if(e.type==='assessment-overridden') entry.append(el('p',{},`Override of ${e.payload.assessment_seq}: ${e.payload.action} — ${e.payload.reason}`));
  entry.append(el('details',{},el('summary',{},'Raw event payload'),el('pre',{},JSON.stringify(e.payload,null,2))));return entry;
 }));
 await assessmentPanel.selectPatient(patientId,events);
}
async function listPatients() {
 const patients=await api('/api/patients');$('patient-list').replaceChildren(...patients.map(p=>{const b=el('button',{type:'button','aria-pressed':p.patient_id===patientId?'true':'false'},p.name);action(b,async()=>{patientId=p.patient_id;$('no-patient').hidden=true;$('patient-work').hidden=false;$('assessment-results').replaceChildren();await listPatients();await refreshPatient();});return b;}));
}
form($('patient'),async()=>{const p=await api('/api/patients',{name:$('patient-name').value,sex:$('sex').value,...($('age-years').value===''?{}:{age_years:Number($('age-years').value)})});patientId=p.patient_id;$('no-patient').hidden=true;$('patient-work').hidden=false;await listPatients();await refreshPatient();notice('Placeholder patient created.');});
form($('diagnosis'),async()=>{const saved=await api(base()+'/diagnoses',{icd10:$('icd10').value,label:$('diagnosis-label').value,certainty:document.querySelector('input[name=certainty]:checked').value});await refreshPatient();notice(['Placeholder diagnosis recorded.',...(saved.warnings??[])].join(' '));});
(async()=>{await listPatients();const releases=await api('/api/releases');$('active-release').replaceChildren(el('option',{value:''},releases.length?'Choose a signed release':'No release available — create one in Review'),...releases.map(r=>el('option',{value:r.version},r.version)));if(releases.length===1) $('active-release').value=releases[0].version;await assessmentPanel.configuration();})().catch(error);
