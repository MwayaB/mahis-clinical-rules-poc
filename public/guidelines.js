import {$,el,api,form,action,notice,error,sourceSelection} from './common.js';
async function refresh() {
 const sources=await api('/api/guidelines');$('source-count').textContent=`${sources.length} source${sources.length===1?'':'s'}`;$('empty').hidden=!!sources.length;
 $('sources').replaceChildren(...sources.map(s=>{
  const link=el('a',{href:'/digitise.html?document='+s.sha256},'Inspect blocks');link.addEventListener('click',()=>sourceSelection(s.sha256));
  return el('tr',{},el('td',{},el('strong',{},s.document_id),el('div',{class:'muted'},s.filename)),el('td',{},s.edition??'not recorded'),el('td',{},el('span',{class:'badge'},s.status)),el('td',{class:'hash'},s.sha256),el('td',{},link));
 }));
}
async function upload(file,id,edition) {
 const s=await api(`/api/guidelines?filename=${encodeURIComponent(file.name)}&document_id=${encodeURIComponent(id)}`,undefined,{method:'POST',headers:{'Content-Type':'application/pdf'},body:file});
 await api(`/api/guidelines/${s.sha256}/metadata`,{edition});sourceSelection(s.sha256);await refresh();notice('Source registered. Choose “Inspect blocks” to continue.');
}
form($('upload'),async()=>{const file=$('file').files[0];if(!file) throw Error('Choose a PDF file');await upload(file,$('document-id').value,$('edition').value);});
action($('sample'),async()=>{const response=await fetch('/samples/dose-guide/placeholder.pdf');if(!response.ok) throw Error('Sample PDF is unavailable');await upload(new File([await response.blob()],'placeholder.pdf',{type:'application/pdf'}),'PLACEHOLDER-DOSE-GUIDE','placeholder-2026');});
sourceSelection();refresh().catch(error);
