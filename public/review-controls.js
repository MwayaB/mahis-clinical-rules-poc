import {el,input,form,api,notice,action,field} from './common.js';
export function approvalControls(entry,refresh) {
 const n=entry.node,required=n.risk==='high'?2:1,approved=entry.approvals??[];
 const box=el('section',{'aria-label':'Approval evidence for '+n.id},el('h3',{},'Approvals'),el('p',{},`${approved.length} of ${required} required approvals for this revision`),el('p',{},'Approvers: '+(approved.map(a=>a.reviewer).join(', ')||'none')));
 const decision=el('form',{method:'post',action:`/api/ir/${n.id}/approve`,'aria-label':'Review decision for '+n.id}),reviewer=input(n.id+'-reviewer','Reviewer ID (required)','','text',{required:true}),reason=input(n.id+'-reason','Rejection reason (required when rejecting)');
 decision.append(reviewer,reason,el('div',{class:'toolbar'},el('button',{type:'submit',value:'approve'},'Approve current revision'),el('button',{type:'submit',value:'reject',class:'secondary'},'Reject')));
 form(decision,async(_,submitter)=>{const choice=submitter?.value??'approve',body={reviewer:reviewer.querySelector('input').value};if(choice==='reject'){body.reason=reason.querySelector('input').value;if(!body.reason.trim()) throw Error('Enter a reason before rejecting');}await api(`/api/ir/${n.id}/${choice}`,body);notice(choice==='approve'?'Approval recorded for current content.':'Node returned to draft.');await refresh();});
 box.append(decision);return box;
}
export function fixturePanel(entry,f,...content) {
 return el('details',{class:'fixture-editor',open:true},el('summary',{},`Authored fixtures · ${f.entries.length} saved${f.stale?' · STALE — save for current revision':''}`),el('p',{},'Fixtures belong to this rule revision. Inspect, load or edit cases, then save them before release.'),...content);
}
export async function jsonFixtures(entry,sha,refresh) {
 const n=entry.node,f=await api('/api/fixtures?node='+encodeURIComponent(n.id)),text=el('textarea',{rows:14,required:true},JSON.stringify(f.entries,null,2)),edit=el('form',{method:'post',action:'/api/fixtures','aria-label':'Fixtures for '+n.id},field(n.id+'-fixtures','Authored fixtures (JSON)',text));
 const load=el('button',{type:'button',class:'secondary'},'Load sample fixtures');action(load,async()=>{const sample=await api('/api/sample-bundle');if(sha!==sample.document_sha256) throw Error('Sample fixtures do not match this source');text.value=JSON.stringify(sample.fixtures[entry.block.id]??[],null,2);notice('Sample fixtures loaded; inspect and save them for this revision.');});
 edit.append(load,el('button',{type:'submit'},'Save fixtures'));form(edit,async()=>{await api('/api/fixtures',{node_id:n.id,entries:JSON.parse(text.value)});notice('Fixtures saved for current revision.');await refresh();});
 return fixturePanel(entry,f,edit);
}
