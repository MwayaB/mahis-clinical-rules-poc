import {$,el,api,form,notice,error} from './common.js';
const severityClasses={block:'block',warn:'warn',info:'info'};
const colours={standard:'triage-standard',urgent:'triage-urgent',emergency:'triage-emergency'};
export const categoryBadge=category=>el('strong',{class:'triage-category '+(colours[category]??'triage-neutral')},category);
export function renderResults(results) {
 const box=el('div');
 for(const r of results) {
  const section=el('section',{class:'assessment-node'},el('h4',{},r.node_id));
  if(r.status==='incomplete') section.append(el('p',{},'Cannot assess: missing '+r.missing.join(', ')));
  else if(r.status==='invalid') section.append(el('p',{},'Cannot assess: '+r.invalid.map(i=>`${i.input} = ${String(i.value)} (${i.reason??'invalid'})`).join(', ')));
  else if(r.payload.renderer==='category') {
   section.append(categoryBadge(r.outcome.category),el('p',{},'Score: '+r.payload.score));
   section.append(el('div',{class:'table-scroll'},el('table',{},el('caption',{},'Recorded assessment components'),el('thead',{},el('tr',{},['Input','Value','Points','Band / level'].map(v=>el('th',{scope:'col'},v)))),el('tbody',{},r.payload.components.map(c=>el('tr',{},el('th',{scope:'row'},c.name),el('td',{},c.value),el('td',{},c.points),el('td',{},c.band_id)))))),el('p',{},'Rule overrides fired: '+(r.payload.overrides_fired.join(', ')||'none')));
  } else if(r.payload.renderer==='advice') {
   if(!r.outcome.items.length) section.append(el('p',{},'No advice for these recorded inputs.'));
   for(const item of r.outcome.items) section.append(el('div',{class:'advice '+(severityClasses[item.severity]??'info')},el('strong',{},item.severity),el('p',{},item.message),el('p',{class:'hash'},item.source_ref)));
  }
  section.append(el('p',{class:'hash'},`Package ${r.package_version} · engine ${r.engine_version}`),el('p',{class:'hash'},'Inputs SHA-256: '+r.inputs_hash));box.append(section);
 }
 return box;
}
export function initAssessment({refreshPatient}) {
 let patientId=null,encounterId=null,config=null,current=[];
 const result=$('assessment-results'),header=$('assessment-header'),path=()=>'/api/encounters/'+encodeURIComponent(encounterId);
 function renderFields(ctx) {
  $('assessment-fields').replaceChildren(...(config?.fields??[]).filter(f=>!f.readonly).map(f=>{
   const value=ctx?.[f.name]??null,id='assessment-'+f.name,domain=f.domain??{};
   let input;
   if(domain.values||f.kind==='boolean') {const options=domain.values??['false','true'];input=el('select',{id,name:f.name},el('option',{value:''},'Not recorded'),...options.map(v=>el('option',{value:String(v),selected:String(v)===String(value)},String(v))));}
   else input=el('input',{id,name:f.name,type:f.kind==='numeric'?'number':'text',step:domain.integer?'1':'any',min:domain.min,max:domain.max,value:value??''});
   return el('div',{class:'field'},el('label',{for:id},f.label??f.name),input,value==null?el('span',{class:'badge missing'},'not recorded'):el('span',{class:'source-meta'},'Recorded: '+String(value)));
  }));
 }
 async function configuration() {
  const version=$('active-release').value;config=await api('/api/assessment/config'+(version?'?release_version='+encodeURIComponent(version):''));
  $('assessment-population').replaceChildren(...(config.populations.length?config.populations:['patient']).map(p=>el('option',{value:p},p)));
  $('assessment-config-note').textContent=version?'Inputs and actions come from the selected signed release. All sample clinical values are placeholders.':'Choose a signed release before assessing.';
  if(!encounterId) renderFields(null);
 }
 function actionChoices() {
  const selected=current.find(c=>String(c.event.seq)===$('override-assessment').value);$('override-action').replaceChildren(...(selected?.actions??selected?.result.payload.actions??[]).map(action=>el('option',{value:action},action)));
 }
 async function refresh() {
  header.replaceChildren(el('span',{class:'badge'},'Assessment: not recorded'));
  if(!encounterId) {current=[];$('assessment-work').hidden=true;result.replaceChildren(el('p',{},'Start an encounter to record assessment inputs.'));return;}
  const state=await api(path());current=state.current;$('assessment-work').hidden=false;renderFields(state.ctx);$('encounter-label').textContent='Encounter '+state.encounter_id+' · '+state.population;
  result.replaceChildren(current.length?renderResults(current.map(c=>c.result)):el('p',{},'Not assessed for the current observations.'));
  const completed=current.filter(c=>c.result.outcome);$('assessment-override').hidden=!completed.length;
  $('override-assessment').replaceChildren(...completed.map(c=>el('option',{value:String(c.event.seq)},c.result.node_id)));actionChoices();
  const categories=completed.filter(c=>c.result.payload.renderer==='category');
  if(current.length) {
   const labels={ok:'recorded',advice:'advice available',incomplete:'incomplete',invalid:'invalid'};
   header.replaceChildren(...(categories.length?categories.map(c=>categoryBadge(c.result.outcome.category)):[el('span',{class:'badge'},'Assessment: '+[...new Set(current.map(c=>labels[c.result.status]))].join(', '))]));
  }
  for(const override of state.overrides??[]) result.append(el('p',{},`Override of #${override.payload.assessment_seq}: ${override.payload.action} — ${override.payload.reason}`));
 }
 $('override-assessment').addEventListener('change',actionChoices);
 form($('encounter-start'),async()=>{if(!patientId) throw Error('Select a patient first');const e=await api('/api/encounters',{patient_id:patientId,population:$('assessment-population').value});encounterId=e.encounter_id;await refreshPatient();notice('Encounter opened. Missing inputs stay not recorded.');});
 form($('assessment-inputs'),async()=>{if(!encounterId) throw Error('Start an encounter first');for(const f of config.fields.filter(f=>!f.readonly)) {const value=$('assessment-'+f.name).value;if(value!=='') await api(path()+'/observations',{field:f.name,value:f.kind==='numeric'?Number(value):f.kind==='boolean'?value==='true':value,release_version:$('active-release').value});}await refreshPatient();notice('Assessment inputs recorded.');});
 form($('assessment-run'),async()=>{if(!encounterId) throw Error('Start an encounter first');await api(path()+'/assess',{release_version:$('active-release').value});await refreshPatient();result.focus();notice('Every assessment result was recorded. Clinical action remains available.');});
 form($('assessment-override'),async()=>{const selected=current.find(c=>String(c.event.seq)===$('override-assessment').value);await api(path()+'/assess/'+selected.event.seq+'/override',{node_id:selected.result.node_id,action:$('override-action').value,reason:$('override-reason').value});await refreshPatient();notice('Reasoned override recorded; original assessment retained.');});
 $('active-release').addEventListener('change',()=>configuration().then(refresh).catch(error));
 return {configuration,async selectPatient(id,events){const changed=patientId!==id;patientId=id;if(changed||!encounterId) encounterId=events.filter(e=>e.type==='encounter-opened').at(-1)?.payload.encounter_id??null;await configuration();await refresh();}};
}
