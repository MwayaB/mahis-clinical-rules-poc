import {el,field} from './common.js';
export function triageReviewEditor(node) {
 let serial=0;
 const view=el('div',{class:'triage-review-editor'});
 function control(label,value,{type='text',...attrs}={}) {
  const input=el('input',{type,value,...attrs}),wrap=field(`${node.id}-triage-control-${serial++}`,label,input);
  return {view:wrap,input,value:()=>input.value};
 }
 function number(label,value,integer=false) {
  const c=control(label,value,{type:'number',step:integer?'1':'any',required:true});
  return {...c,value:()=>{if(c.input.value.trim()==='') throw Error(label+' is required');const value=Number(c.input.value);if(!Number.isFinite(value)||integer&&!Number.isInteger(value)) throw Error(label+' must be '+(integer?'an integer':'a number'));return value;}};
 }
 function checked(label,value) {
  const id=`${node.id}-triage-control-${serial++}`,input=el('input',{type:'checkbox',id,name:id,checked:value});
  return {view:el('div',{class:'check-label'},input,el('label',{for:id},label)),value:()=>input.checked};
 }
 function category(label,value) {
  const input=el('select',{},node.categories_order.map(c=>el('option',{value:c,selected:c===value},c))),wrap=field(`${node.id}-triage-control-${serial++}`,label,input);
  return {view:wrap,value:()=>input.value};
 }
 function interval(b,index,scoreBand=false) {
  const group=el('fieldset',{},el('legend',{},`${scoreBand?'Score band':'Input band'} ${index+1}`)),minimum=number('Minimum',b.min),maximum=number('Maximum',b.max),lo=checked('Include minimum',b.min_inclusive),hi=checked('Include maximum',b.max_inclusive),output=scoreBand?category('Category',b.category):number('Points',b.points,true);
  group.append(el('div',{class:'grid'},minimum.view,maximum.view,lo.view,hi.view,output.view));
  return {view:group,value:()=>({...b,min:minimum.value(),max:maximum.value(),min_inclusive:lo.value(),max_inclusive:hi.value(),...(scoreBand?{category:output.value()}:{points:output.value()})})};
 }
 const population=control('Population',node.scope.population,{required:true});view.append(population.view,el('h3',{},'Required scoring inputs'),el('p',{class:'muted'},'Every input listed below is required. Additional encounter observations are not scored unless declared in this rule.'));
 const parameters=node.parameters.map(p=>{
  const group=el('fieldset',{},el('legend',{},p.name)),name=control('Parameter name',p.name,{required:true}),input=control('Encounter input',p.input,{required:true});
  group.append(el('div',{class:'grid'},name.view,input.view),el('p',{},'Input kind: '+p.kind));
  if(p.kind==='numeric') {
   const lo=number('Coverage minimum',p.coverage.min),hi=number('Coverage maximum (excluded)',p.coverage.max),bands=p.bands.map((b,i)=>interval(b,i));
   group.append(el('div',{class:'grid'},lo.view,hi.view),...bands.map(b=>b.view));view.append(group);
   return ()=>({...p,name:name.value(),input:input.value(),coverage:{min:lo.value(),max:hi.value()},bands:bands.map(b=>b.value())});
  }
  const levels=p.levels.map((level,i)=>{const value=control('Level value',level.value,{required:true}),points=number('Points',level.points,true);group.append(el('fieldset',{},el('legend',{},'Ordinal level '+(i+1)),el('div',{class:'grid'},value.view,points.view)));return ()=>({...level,value:value.value(),points:points.value()});});view.append(group);
  return ()=>({...p,name:name.value(),input:input.value(),levels:levels.map(level=>level())});
 });
 view.append(el('h3',{},'Total score categories'));const bands=node.score_bands.map((b,i)=>interval(b,i,true));view.append(...bands.map(b=>b.view));
 view.append(el('h3',{},'Category priority'),el('ol',{},node.categories_order.map(c=>el('li',{},c))),el('p',{class:'muted'},'Priority increases down this list. Category names and ordering can be changed in the advanced editor.'));
 view.append(el('h3',{},'Automatic rule overrides'));
 const overrides=node.overrides.map(o=>{
  const group=el('fieldset',{},el('legend',{},o.id)),selected=category('Override category',o.category);
  const conditions=Object.entries(o.when).map(([input,value])=>{const c=typeof value==='number'?number('Equals',value):control('Equals',value,{required:true});group.append(el('div',{class:'grid'},el('p',{},'When input: ',el('code',{},input)),c.view));return ()=>[input,c.value()];});
  group.append(selected.view);view.append(group);return ()=>({...o,when:Object.fromEntries(conditions.map(c=>c())),category:selected.value()});
 });
 return {view,value:()=>({scope:{...node.scope,population:population.value()},parameters:parameters.map(p=>p()),score_bands:bands.map(b=>b.value()),overrides:overrides.map(o=>o()),categories_order:[...node.categories_order]})};
}
