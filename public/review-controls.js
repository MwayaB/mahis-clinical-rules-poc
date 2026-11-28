import {el,input,form,api,notice} from './common.js';
export function approvalControls(entry,refresh) {
 const n=entry.node,required=n.risk==='high'?2:1,approved=entry.approvals??[];
 const box=el('section',{'aria-label':'Approval evidence for '+n.id},el('h3',{},'Approvals'),el('p',{},`${approved.length} of ${required} required approvals for this revision`),el('p',{},'Approvers: '+(approved.map(a=>a.reviewer).join(', ')||'none')));
 const decision=el('form',{method:'post',action:`/api/ir/${n.id}/approve`,'aria-label':'Review decision for '+n.id}),reviewer=input(n.id+'-reviewer','Reviewer ID (required)','','text',{required:true}),reason=input(n.id+'-reason','Rejection reason (required when rejecting)');
 decision.append(reviewer,reason,el('div',{class:'toolbar'},el('button',{type:'submit',value:'approve'},'Approve current revision'),el('button',{type:'submit',value:'reject',class:'secondary'},'Reject')));
 form(decision,async(_,submitter)=>{const choice=submitter?.value??'approve',body={reviewer:reviewer.querySelector('input').value};if(choice==='reject'){body.reason=reason.querySelector('input').value;if(!body.reason.trim()) throw Error('Enter a reason before rejecting');}await api(`/api/ir/${n.id}/${choice}`,body);notice(choice==='approve'?'Approval recorded for current content.':'Node returned to draft.');await refresh();});
 box.append(decision);return box;
}
export function automatedChecks(checks) {
 const box=el('section',{'aria-label':'Automated checks'},el('h3',{},'Automated checks: '+(checks.status==='passed'?'passed':'needs attention')),el('p',{},checks.message));
 box.append(el('details',{},el('summary',{},'Technical details'),el('pre',{class:'hash'},JSON.stringify(checks.details,null,2))));
 return box;
}
