import {approvalControls,automatedChecks} from './review-controls.js';
import { triageReviewEditor } from './triage-review.js';
import {$,el,api,form,action,notice,error,sourceSelection,blockCard,input,field} from './common.js';
let sha=sourceSelection(new URLSearchParams(location.search).get('document'));
const json=(value)=>JSON.stringify(value,null,2);
function selectField(id,label,options,value) {return field(id,label,el('select',{},options.map(([v,t])=>el('option',{value:v,selected:v===value},t))));}
function rowButtons(row,container) {const remove=el('button',{type:'button',class:'secondary'},'Remove row');remove.addEventListener('click',()=>row.remove());row.append(remove);container.append(row);}
function bandEditor(n) {
 const container=el('div'),controls=[];
 function add(b={}) {
  const i=controls.length,prefix=n.id+'-band-'+i,row=el('div',{class:'band-row'}),get={row};
  for(const [key,label] of [['min','Minimum'],['max','Maximum'],['value','Tablets']]) {const f=input(prefix+'-'+key,label,b[key]??'','number',{step:key==='value'?'1':'any',required:true});get[key]=f.querySelector('input');row.append(f);}
  for(const [key,label] of [['min_inclusive','Include minimum'],['max_inclusive','Include maximum']]) {const checkbox=el('input',{type:'checkbox',id:prefix+'-'+key,name:prefix+'-'+key,checked:b[key]===true});get[key]=checkbox;row.append(el('div',{class:'check-label'},checkbox,el('label',{for:checkbox.id},label)));}
  controls.push(get);rowButtons(row,container);
 }
 n.bands.forEach(add);const addButton=el('button',{type:'button',class:'secondary'},'Add band');addButton.addEventListener('click',()=>add());
 return {view:el('div',{},el('h3',{},'Weight bands · placeholder values'),container,addButton),value:()=>controls.filter(c=>c.row.isConnected).map(c=>({min:Number(c.min.value),max:Number(c.max.value),value:Number(c.value.value),unit:'tablet',min_inclusive:c.min_inclusive.checked,max_inclusive:c.max_inclusive.checked}))};
}
function whenEditor(n) {
 const container=el('div'),rows=[];
 function add(key='',value='') {const i=rows.length,row=el('div',{class:'band-row'}),k=input(n.id+'-condition-key-'+i,'Context field',key,'text',{required:true}),v=input(n.id+'-condition-value-'+i,'Equality value (JSON scalar)',value,'text',{required:true});row.append(k,v);rows.push({row,key:k.querySelector('input'),value:v.querySelector('input')});rowButtons(row,container);}
 for(const [k,v] of Object.entries(n.when)) add(k,JSON.stringify(v));const button=el('button',{type:'button',class:'secondary'},'Add equality condition');button.addEventListener('click',()=>add());
 return {view:el('div',{},container,button),value:()=>{const entries=rows.filter(r=>r.row.isConnected).map(r=>[r.key.value,JSON.parse(r.value.value)]);if(new Set(entries.map(x=>x[0])).size!==entries.length) throw Error('Duplicate equality fields');return Object.fromEntries(entries);}};
}
async function triageCard(entry) {
 const n=entry.node,box=el('section',{class:'card'},el('h2',{},n.type.replaceAll('_',' ')+' · '+n.id),el('p',{},`${n.status} · ${entry.approvals.length} of ${n.risk==='high'?2:1} approvals`),blockCard(entry.block));
 if(n.parse_errors?.length) box.append(el('div',{class:'parse-errors'},n.parse_errors.join('; ')));
 const editable=entry.type_info.fields,editor=el('textarea',{rows:20,required:true},json(Object.fromEntries(editable.map(k=>[k,n[k]]))));
 let structured;try{structured=n.type==='scored_triage'?triageReviewEditor(n):null;}catch{structured=null;}
 const edit=el('form',{method:'post',action:`/api/ir/${n.id}/edit`,'aria-label':'Review triage inputs '+n.id},structured?.view??el('p',{},'Correct the rule schema in the advanced editor to restore the structured inputs.'),el('button',{type:'submit',disabled:!structured},'Save triage revision'));
 form(edit,async()=>{await api(`/api/ir/${n.id}/edit`,structured.value());notice('Triage revision saved; previous approvals reset.');await refreshNodes();});
 const advancedForm=el('form',{method:'post',action:`/api/ir/${n.id}/edit`,'aria-label':'Advanced triage JSON '+n.id},field(n.id+'-triage-json','Authored triage fields (JSON)',editor),el('button',{type:'submit',class:'secondary'},'Save advanced triage edit'));
 form(advancedForm,async()=>{await api(`/api/ir/${n.id}/edit`,JSON.parse(editor.value));notice('Triage revision saved; previous approvals reset.');await refreshNodes();});
 const advanced=el('details',{open:!structured},el('summary',{},'Advanced JSON editor'),advancedForm);
 const approval=approvalControls(entry,refreshNodes),checks=automatedChecks(await api(`/api/ir/${encodeURIComponent(n.id)}/checks`,{}));
 const history=el('details',{},el('summary',{},'Triage revision and approval history')),historyOut=el('pre'),loadHistory=el('button',{type:'button',class:'secondary'},'Load history');action(loadHistory,async()=>{historyOut.textContent=json(await api(`/api/ir/${n.id}/history`));});history.append(loadHistory,historyOut);
 box.append(edit,advanced,approval,checks,el('p',{class:'hash'},entry.content_hash),history);return box;
}

async function nodeCard(entry) {
 if(!['table','predicate'].includes(entry.node.type)) return triageCard(entry);
 const n=entry.node,box=el('section',{class:'card'}),left=el('div',{class:'review-source'},blockCard(entry.block)),right=el('div');
 box.append(el('div',{class:'section-heading'},el('h2',{},`${n.type==='table'?'Weight table':'Pregnancy predicate'} · ${entry.block.id}`),el('span',{class:'badge'},`${n.status} · ${entry.approvals.length} of ${n.risk==='high'?2:1} approvals`)));
 if(n.parse_errors?.length) right.append(el('div',{class:'parse-errors'},el('strong',{},'Parse errors'),el('ul',{},n.parse_errors.map(e=>el('li',{},e)))));
 const edit=el('form',{method:'post',action:`/api/ir/${n.id}/edit`,'aria-label':'Edit '+entry.block.id}),atc=input(n.id+'-atc','ATC code (required)',n.applies_to.atc,'text',{required:true}),message=field(n.id+'-message','Placeholder advice message',el('textarea',{rows:3,required:true},n.message_template??n.message));
 const applicable=el('fieldset',{},el('legend',{},'Rule applicability · checked before conditions'));
 const sex=selectField(n.id+'-sex','Patient sex',[['','Any'],['F','Female'],['M','Male'],['U','Unknown / unspecified']],n.applies_to.sex??'');
 const minAge=input(n.id+'-age-min','Minimum age (years, inclusive)',n.applies_to.age_years?.min??'','number',{min:0,max:120,step:'any'}),maxAge=input(n.id+'-age-max','Maximum age (years, inclusive)',n.applies_to.age_years?.max??'','number',{min:0,max:120,step:'any'});
 const indication=input(n.id+'-icd10','ICD-10 indication prefix (optional)',n.applies_to.icd10??'');
 applicable.append(atc,sex,minAge,maxAge,indication,el('p',{class:'muted'},'Applicability is read from explicit guideline text and must be checked against the source during review. The EMR automatically selects approved rules using patient data.'));edit.append(applicable,el('p',{class:'muted'},'Sex, age and indication belong in Applicability. Conditions accept pregnant, weight_kg, proposed_atc, proposed_tablets and today.'));
 const structured=n.type==='table'?bandEditor(n):whenEditor(n);edit.append(structured.view);
 let severity;if(n.type==='predicate') {severity=selectField(n.id+'-severity','Severity',[['block','Block'],['warn','Warning'],['info','Information']],n.severity);edit.append(severity);}
 edit.append(message,el('button',{type:'submit'},'Save edit'));
 form(edit,async()=>{
  const applies_to={...n.applies_to,atc:atc.querySelector('input').value};
  const sexValue=sex.querySelector('select').value,lo=minAge.querySelector('input').value,hi=maxAge.querySelector('input').value,code=indication.querySelector('input').value.trim();
  if(sexValue) applies_to.sex=sexValue;else delete applies_to.sex;
  if(lo===''&&hi==='') delete applies_to.age_years;else {if(lo===''||hi==='') throw Error('Supply both minimum and maximum applicability ages');applies_to.age_years={min:Number(lo),max:Number(hi)};}
  if(code) applies_to.icd10=code;else delete applies_to.icd10;
  const body={applies_to};
  if(n.type==='table') {body.bands=structured.value();body.message_template=message.querySelector('textarea').value;}else{body.when=structured.value();body.severity=severity.querySelector('select').value;body.message=message.querySelector('textarea').value;}
  await api(`/api/ir/${n.id}/edit`,body,{headers:{'Content-Type':'application/json','X-User':$('editor').value}});notice('Revision saved. Previous approvals reset.');await refreshNodes();
 });
 const approval=approvalControls(entry,refreshNodes);
 right.append(edit,approval,el('p',{class:'hash'},'Content SHA-256: '+entry.content_hash),el('p',{class:'muted'},'Approvers: '+(entry.approvals.map(a=>a.reviewer).join(', ')||'none')));box.append(el('div',{class:'review-grid'},left,right));box.append(automatedChecks(await api(`/api/ir/${encodeURIComponent(n.id)}/checks`,{})));
 const history=el('details',{},el('summary',{},'Revision & approval history'));const load=el('button',{type:'button',class:'secondary'},'Show history'),out=el('pre',{class:'hash'});action(load,async()=>{out.textContent=json(await api(`/api/ir/${n.id}/history`));});history.append(load,out);box.append(history);return box;
}
async function refreshNodes() {
 const data=await api('/api/ir?document='+sha);$('triage-import-panel').hidden=data.nodes.some(entry=>entry.node.type==='scored_triage');$('nodes').replaceChildren(...await Promise.all(data.nodes.map(nodeCard)));$('unconverted').replaceChildren(...data.unconverted.map(b=>el('div',{class:'parse-errors'},`Block ${b.block_id}: ${b.reason}`)));
 const existing=await api('/api/releases');$('releases').replaceChildren(...existing.filter(r=>r.document_sha256===sha).map(r=>el('p',{},el('span',{class:'badge'},r.version),' · signed · '+r.fixture_count+' automated checks passed')));
}
async function loadDocument() {
 if(!sha) {$('review-work').hidden=true;return;}sourceSelection(sha);$('document').value=sha;const blocks=await api(`/api/guidelines/${sha}/blocks`);$('review-work').hidden=false;
 $('atc-fields').replaceChildren(...blocks.map(b=>input('draft-atc-'+b.id,`ATC for block ${b.id} (${b.kind})`,'','text')));
 if(!document.getElementById('editor')) $('draft').prepend(input('editor','Editor ID (required)','local-user','text',{required:true}));
 if(!document.getElementById('sample-atcs')) {const button=el('button',{id:'sample-atcs',type:'button',class:'secondary'},'Use sample ATC mapping');$('draft').append(button);action(button,async()=>{const sample=await api('/api/sample-bundle');if(sample.document_sha256!==sha) throw Error('Sample mapping applies only to the shipped PDF');for(const [id,atc] of Object.entries(sample.atc_by_block)) if($('draft-atc-'+id)) $('draft-atc-'+id).value=atc;notice('Human-authored sample drug codes filled. Check them before creating drafts.');});}
 await refreshNodes();
}
form($('draft'),async()=>{const blocks=await api(`/api/guidelines/${sha}/blocks`),atc_by_block={};for(const b of blocks) if($('draft-atc-'+b.id).value.trim()) atc_by_block[b.id]=$('draft-atc-'+b.id).value.trim();await api(`/api/guidelines/${sha}/draft`,{atc_by_block},{headers:{'Content-Type':'application/json','X-User':$('editor').value}});notice('Drafts created. Review and save any corrections before approving.');await refreshNodes();});
form($('release'),async()=>{const r=await api('/api/releases',{document_sha256:sha,version:$('version').value});notice(`Signed release ${r.version} created. It is now available in the EMR.`);await refreshNodes();});
$('document').addEventListener('change',()=>{sha=$('document').value;loadDocument().catch(error);});
(async()=>{const sources=await api('/api/guidelines');$('document').append(...sources.filter(s=>s.edition).map(s=>el('option',{value:s.sha256},`${s.document_id} · ${s.edition}`)));await loadDocument();})().catch(error);

const importForm=document.getElementById('triage-import');
if(importForm) {
 action($('load-triage-sample'),async()=>{const sample=await api('/api/sample-bundle');if(sha!==sample.document_sha256) throw Error('Upload and select the combined placeholder PDF before importing its authored rule');$('triage-node-json').value=json(Object.values(sample.authored_rules_by_block)[0]);notice('Authored placeholder triage sample loaded; no PDF extraction was performed.');});
 form(importForm,async()=>{if(!sha) throw Error('Select the source document first');await api('/api/rules/import',{document_sha256:sha,node:JSON.parse($('triage-node-json').value)});notice('Rule imported as draft. Clinical approval and automated checks are required.');await refreshNodes();});
}
