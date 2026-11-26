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
async function fixtureEditor(entry) {
 const n=entry.node,f=await api('/api/fixtures?node='+encodeURIComponent(n.id)),box=el('details',{class:'fixture-editor'},el('summary',{},`Authored fixtures · ${f.entries.length} saved${f.stale?' · STALE — save for current revision':''}`));
 const edit=el('form',{method:'post',action:'/api/fixtures','aria-label':'Fixtures for '+n.id}),rows=el('div'),controls=[];
 function add(data={name:'',ctx:{},expect:[]}) {
  const prefix=n.id+'-fixture-'+controls.length,row=el('div',{class:'card compact'}),c={row,original:data.ctx};
  for(const [key,label,value,type] of [['name','Fixture name',data.name,'text'],['sex','Sex (blank means not recorded)',data.ctx.sex??'','text'],['age_years','Age years (blank means not recorded)',data.ctx.age_years??'','number'],['active_diagnoses','Active diagnoses (JSON array)',JSON.stringify(data.ctx.active_diagnoses??[]),'text'],['today','Today (YYYY-MM-DD)',data.ctx.today??'','date'],['weight_kg','Weight kg (blank means not recorded)',data.ctx.weight_kg??'','number'],['proposed_atc','Proposed ATC (blank means not recorded)',data.ctx.proposed_atc??'','text'],['proposed_tablets','Proposed tablet count (blank means not recorded)',data.ctx.proposed_tablets??'','number'],['expect','Expected rule IDs (comma separated; blank means no advice)',data.expect.join(', '),'text']]) {
   const control=input(prefix+'-'+key,label,value,type,{...(type==='number'?{step:'any'}:{}),...(['name','today'].includes(key)?{required:true}:{})});c[key]=control.querySelector('input');row.append(control);
  }
  const preg=selectField(prefix+'-pregnant','Pregnancy input',[['null','Not recorded'],['true','Pregnant'],['false','Not pregnant']],String(data.ctx.pregnant??null));c.pregnant=preg.querySelector('select');row.append(preg);controls.push(c);rowButtons(row,rows);
 }
 f.entries.forEach(add);
 const addButton=el('button',{type:'button',class:'secondary'},'Add authored fixture');addButton.addEventListener('click',()=>add());
 const loadButton=el('button',{type:'button',class:'secondary'},'Load sample fixtures');action(loadButton,async()=>{const sample=await api('/api/sample-bundle');if(sample.document_sha256!==sha) throw Error('Sample fixtures apply only to the shipped sample PDF');rows.replaceChildren();controls.length=0;(sample.fixtures[entry.block.id]??[]).forEach(add);notice('Sample fixture entries loaded. Save them to attach to this content revision.');});
 edit.append(rows,el('div',{class:'toolbar'},addButton,loadButton,el('button',{type:'submit'},'Save fixtures')));
 form(edit,async()=>{
  const entries=controls.filter(c=>c.row.isConnected).map(c=>({name:c.name.value,ctx:{...c.original,sex:c.sex.value||null,age_years:c.age_years.value===''?null:Number(c.age_years.value),active_diagnoses:JSON.parse(c.active_diagnoses.value),today:c.today.value,weight_kg:c.weight_kg.value===''?null:Number(c.weight_kg.value),pregnant:c.pregnant.value==='null'?null:c.pregnant.value==='true',proposed_atc:c.proposed_atc.value||null,proposed_tablets:c.proposed_tablets.value===''?null:Number(c.proposed_tablets.value)},expect:c.expect.value.split(',').map(s=>s.trim()).filter(Boolean)}));
  await api('/api/fixtures',{node_id:n.id,entries});notice('Authored fixtures saved for current content.');await refreshNodes();
 });
 box.append(el('p',{class:'muted'},'At least one matching and one non-matching case with complete inputs are required. Generated boundaries do not replace authored cases.'),edit,el('details',{},el('summary',{},`${f.generated.length} generated boundary checks (read only)`),el('pre',{class:'hash'},json(f.generated))));return box;
}
async function nodeCard(entry) {
 const n=entry.node,box=el('section',{class:'card'}),left=el('div',{class:'review-source'},blockCard(entry.block)),right=el('div');
 box.append(el('div',{class:'section-heading'},el('h2',{},`${n.type==='table'?'Weight table':'Pregnancy predicate'} · ${entry.block.id}`),el('span',{class:'badge'},`${n.status} · ${entry.approvals.length} of 2 approvals`)));
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
 const approval=el('form',{method:'post',action:`/api/ir/${n.id}/approve`,'aria-label':'Review decision for '+entry.block.id});const reviewer=input(n.id+'-reviewer','Reviewer ID (required)','','text',{required:true});
 const approve=el('button',{type:'submit',value:'approve'},'Approve current revision'),reject=el('button',{type:'submit',class:'secondary',value:'reject'},'Reject'),reason=input(n.id+'-reason','Rejection reason (required when rejecting)');approval.append(el('h3',{},'Review decision'),reviewer,reason,el('div',{class:'toolbar'},approve,reject));
 form(approval,async(_,submitter)=>{const actionName=submitter.value,body={reviewer:reviewer.querySelector('input').value};if(actionName==='reject') {body.reason=reason.querySelector('input').value;if(!body.reason.trim()) throw Error('Enter a reason before rejecting');}await api(`/api/ir/${n.id}/${actionName}`,body);notice(actionName==='approve'?'Approval recorded for this content.':'Node returned to draft.');await refreshNodes();});
 right.append(edit,approval,el('p',{class:'hash'},'Content SHA-256: '+entry.content_hash),el('p',{class:'muted'},'Approvers: '+(entry.approvals.map(a=>a.reviewer).join(', ')||'none')));box.append(el('div',{class:'review-grid'},left,right));box.append(await fixtureEditor(entry));
 const history=el('details',{},el('summary',{},'Revision & approval history'));const load=el('button',{type:'button',class:'secondary'},'Show history'),out=el('pre',{class:'hash'});action(load,async()=>{out.textContent=json(await api(`/api/ir/${n.id}/history`));});history.append(load,out);box.append(history);return box;
}
async function refreshNodes() {
 const data=await api('/api/ir?document='+sha);$('nodes').replaceChildren(...await Promise.all(data.nodes.map(nodeCard)));$('unconverted').replaceChildren(...data.unconverted.map(b=>el('div',{class:'parse-errors'},`Block ${b.block_id}: ${b.reason}`)));
 const existing=await api('/api/releases');$('releases').replaceChildren(...existing.filter(r=>r.document_sha256===sha).map(r=>el('p',{},el('span',{class:'badge'},r.version),' · signed · '+r.fixture_count+' fixtures checked')));
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
