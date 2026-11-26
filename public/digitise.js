import {$,el,api,form,action,notice,error,sourceSelection,blockCard} from './common.js';
const sha=sourceSelection(new URLSearchParams(location.search).get('document'));
async function refresh() {
 const s=await api('/api/guidelines/'+sha);$('source-summary').replaceChildren(el('strong',{},s.document_id),el('p',{class:'hash'},s.sha256));
 if(!s.edition) {
  const metadata=el('form',{method:'post',action:`/api/guidelines/${sha}/metadata`},el('label',{for:'set-edition'},'Edition (required)'),el('input',{id:'set-edition',name:'edition',required:true}),el('button',{type:'submit'},'Set metadata'));
  form(metadata,async data=>{await api(`/api/guidelines/${sha}/metadata`,data);await refresh();notice('Metadata set.');});$('source-summary').append(metadata);$('document-work').hidden=true;return;
 }
 $('document-work').hidden=false;$('review-link').href='/review.html?document='+sha;
 const blocks=await api(`/api/guidelines/${sha}/blocks`);$('blocks').replaceChildren(...blocks.map(b=>el('section',{class:'card'},blockCard(b))));
 if(!blocks.length) $('blocks').append(el('p',{class:'empty'},'No blocks yet. Run mock digitisation or enter a manual block.'));
}
action($('digitise'),async()=>{const r=await api(`/api/guidelines/${sha}/digitise`,{});await refresh();notice(`Stored ${r.blocks.length} blocks · digitiser: ${r.digitiser}`);});
form($('manual'),async data=>{const block={page:Number(data.page),id:data['block-id'],kind:data.kind,bbox:data.bbox.split(',').map(Number),text:data['block-text']};if(data.kind==='table') block.cells=JSON.parse(data.cells);await api(`/api/guidelines/${sha}/blocks`,block);await refresh();notice('Manual block stored.');});
if(sha) refresh().catch(error);
