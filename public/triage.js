import {$,el,api,form,notice,error} from './common.js';
const colours={standard:'triage-standard',urgent:'triage-urgent',emergency:'triage-emergency'};
export const categoryBadge=category=>el('strong',{class:'triage-category '+(colours[category]??'triage-neutral')},category);
export function triageResultView(results) {
 const box=el('div');
 for(const r of results) {
  const section=el('section',{class:'triage-node'},el('h4',{},r.node_id));
  if(r.status==='incomplete') section.append(el('p',{class:'triage-unscored'},'Cannot triage: missing '+r.missing.join(', ')));
  else if(r.status==='invalid') section.append(el('p',{class:'triage-unscored'},`Cannot triage: invalid ${r.input} = ${String(r.value)}`));
  else if(r.status==='scored') {
   const rows=r.components.map(c=>el('tr',{},el('th',{scope:'row'},c.name),el('td',{},c.value),el('td',{},c.points),el('td',{},c.band_id)));
   section.append(categoryBadge(r.category),el('p',{},`Score: ${r.score}`),el('div',{class:'table-scroll'},el('table',{},el('caption',{},'Recorded scoring components'),el('thead',{},el('tr',{},['Parameter','Value','Points','Band / level'].map(x=>el('th',{scope:'col'},x)))),el('tbody',{},rows))),el('p',{},'Rule overrides fired: '+(r.overrides_fired.join(', ')||'none')));
  }
  section.append(el('p',{class:'hash'},`Package ${r.package_version} · engine ${r.engine_version}`),el('p',{class:'hash'},'Inputs SHA-256: '+r.inputs_hash));box.append(section);
 }
 return box;
}
export function initTriage({refreshPatient}) {
 let patientId=null,encounterId=null,config=null,current=null;
 const fields=$('triage-fields'),result=$('triage-result'),header=$('triage-header');
 const path=()=>'/api/encounters/'+encodeURIComponent(encounterId);
 async function configuration() {
  const release=$('active-release').value;config=null;$('triage-population').replaceChildren();
  if(!release) {$('triage-config-note').textContent='Choose a signed release above to load its triage populations.';return;}
  config=await api('/api/triage/config?release_version='+encodeURIComponent(release));
  $('triage-population').replaceChildren(...config.populations.map(p=>el('option',{value:p},p)));
  $('triage-config-note').textContent=config.populations.length?'Use the population appropriate to the patient. All sample thresholds and categories are placeholders.':'This release contains no triage rules. Choose a release with scored triage.';
  if(!encounterId) renderFields(null);
 }
 function renderFields(ctx) {
  const definitions=config?.fields??[];
  fields.replaceChildren(...definitions.map(f=>{
   const id='triage-'+f.input,value=ctx?.[f.input]??null;
   const control=f.kind==='ordinal'?el('select',{id,name:f.input},el('option',{value:''},'Not recorded'),...f.values.map(v=>el('option',{value:v,selected:v===value},v))):el('input',{id,name:f.input,type:'number',step:'any',min:f.min,max:f.max,value:value??''});
   return el('div',{class:'field'},el('label',{for:id},f.label),control,value===null?el('span',{class:'badge missing'},'not recorded'):el('span',{class:'source-meta'},'Recorded: '+String(value)));
  }));
 }
 async function refresh() {
  header.replaceChildren(el('span',{class:'badge'},'Triage: not recorded'));
  if(!encounterId) {current=null;$('triage-work').hidden=true;result.replaceChildren(el('p',{},'Start an encounter to record triage.'));return;}
  const state=await api(path());current=state.current;$('triage-work').hidden=false;
  $('encounter-label').textContent='Encounter '+state.encounter_id+' · '+state.population;renderFields(state.ctx);
  result.replaceChildren(current?triageResultView(current.payload.results):el('p',{},'Triage not scored for the current observations.'));
  const selectable=current&&current.payload.results.every(r=>r.status==='scored');$('triage-override').hidden=!selectable;
  $('override-category').replaceChildren(...(state.override_categories??[]).map(c=>el('option',{value:c},c)));
  if(state.display) header.replaceChildren(el('span',{},'Triage: '),categoryBadge(state.override?.payload.category??state.display.category));
  if(state.override) result.append(el('p',{},`Clinician override: ${state.override.payload.category} — ${state.override.payload.reason}`));
 }
 form($('encounter-start'),async()=>{
  if(!patientId) throw Error('Select a patient first');
  if(!$('triage-population').value) throw Error('Choose a release with a matching triage population');
  const encounter=await api('/api/encounters',{patient_id:patientId,population:$('triage-population').value});encounterId=encounter.encounter_id;
  await refreshPatient();notice('Encounter opened. Missing inputs remain not recorded.');
 });
 form($('triage-vitals'),async()=>{
  if(!encounterId) throw Error('Start an encounter first');
  for(const f of config.fields) {const value=$('triage-'+f.input).value;if(value!=='') await api(path()+'/observations',{field:f.input,value:f.kind==='numeric'?Number(value):value});}
  await refreshPatient();notice('Encounter observations recorded. Score triage to see a current result.');
 });
 form($('triage-score'),async()=>{if(!encounterId) throw Error('Start an encounter first');await api(path()+'/triage',{release_version:$('active-release').value});await refreshPatient();result.focus();notice('Triage result recorded. Clinical action remains available.');});
 form($('triage-override'),async()=>{await api(path()+'/triage/override',{triage_ref:current.event_id,category:$('override-category').value,reason:$('override-reason').value});await refreshPatient();notice('Clinician override recorded with its reason. Original triage retained.');});
 $('active-release').addEventListener('change',()=>configuration().then(refresh).catch(error));
 return {
  async selectPatient(id,events) {
   const changed=patientId!==id;patientId=id;
   if(changed||!encounterId) encounterId=events.filter(e=>e.type==='encounter-opened').at(-1)?.payload.encounter_id??null;
   await configuration();await refresh();
  },configuration
 };
}
