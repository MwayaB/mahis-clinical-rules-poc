export const $=id=>document.getElementById(id);
export function el(tag,attrs={},...children) {
 const node=document.createElement(tag);
 for(const [key,value] of Object.entries(attrs)) {if(key==='class') node.className=value;else if(key==='text') node.textContent=value;else if(key.startsWith('on')) node.addEventListener(key.slice(2),value);else if(value!==false&&value!==null&&value!==undefined) node.setAttribute(key,value===true?'':value);}
 for(const child of children.flat(Infinity)) if(child!==null&&child!==undefined) node.append(child instanceof Node?child:document.createTextNode(String(child)));
 return node;
}
export function error(e) {$('error').hidden=false;$('error').textContent=e.message??String(e);$('error').focus();}
export function notice(message) {$('error').hidden=true;$('notice').textContent=message;}
export async function api(path,body,options={}) {
 const response=await fetch(path,{method:body===undefined?'GET':'POST',...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),...options});
 const data=await response.json();if(!response.ok) throw new Error(data.error??'Request failed');return data;
}
export function action(button,fn) {button.addEventListener('click',async()=>{button.disabled=true;try{await fn();}catch(e){error(e);}finally{button.disabled=false;}});}
export function form(node,fn) {
 node.addEventListener('submit',async e=>{e.preventDefault();const buttons=[...node.querySelectorAll('button[type=submit]')];buttons.forEach(b=>b.disabled=true);try{await fn(Object.fromEntries(new FormData(node)),e.submitter);}catch(e){error(e);}finally{buttons.forEach(b=>b.disabled=false);}});
}
export function field(id,label,control) {control.id=id;control.name=id;return el('div',{class:'field'},el('label',{for:id},label),control);}
export function input(id,label,value='',type='text',attrs={}) {const control=el('input',{type,value,...attrs});return field(id,label,control);}
export function blockCard(block) {
 const box=el('div',{class:'block-card'},el('span',{class:'badge'},block.digitiser),el('h3',{},`Source block ${block.id}`),el('p',{class:'source-meta'},`Page ${block.page} · bbox [${block.bbox.join(', ')}]`),el('p',{class:'block-text'},block.text));
 if(block.cells) {
  const table=el('table',{},el('caption',{},'Source table — placeholder values'),el('thead',{},el('tr',{},block.cells[0].map(c=>el('th',{scope:'col'},c)))),el('tbody',{},block.cells.slice(1).map(row=>el('tr',{},row.map(c=>el('td',{},c))))));box.append(el('div',{class:'table-scroll'},table));
 }
 return box;
}
export function sourceSelection(sha) {if(sha) sessionStorage.setItem('document',sha);const current=sha||sessionStorage.getItem('document');for(const href of ['/digitise.html','/review.html']) {const link=document.querySelector(`nav a[href^="${href}"]`);if(link&&current) link.href=href+'?document='+current;}return current;}
