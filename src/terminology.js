import { readFileSync } from 'node:fs';
const nonempty=x=>typeof x==='string'&&x.trim().length>0;
function exact(x,keys,where) {
 if(!x||typeof x!=='object'||Array.isArray(x)) throw Error(`${where}: expected object`);
 for(const k of Object.keys(x)) if(!keys.includes(k)) throw Error(`${where}: unknown field ${k}`);
 for(const k of keys) if(!Object.hasOwn(x,k)) throw Error(`${where}: missing ${k}`);
}
export function loadTerminology(path) {
 const t=JSON.parse(readFileSync(path,'utf8'));
 exact(t,['system','terminology_version','source','placeholder','codes'],'terminology');
 if(t.system!=='ICD-10'||!nonempty(t.terminology_version)||!nonempty(t.source)||typeof t.placeholder!=='boolean'||!Array.isArray(t.codes)||!t.codes.length) throw Error('Invalid terminology metadata');
 const seen=new Set();
 for(const c of t.codes) {
  exact(c,['code','label','chapter'],'terminology code');
  if(!/^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?$/.test(c.code)||!nonempty(c.label)||!nonempty(c.chapter)) throw Error('Invalid terminology code or label');
  if(seen.has(c.code)) throw Error('Duplicate terminology code '+c.code);seen.add(c.code);Object.freeze(c);
 }
 Object.freeze(t.codes);return Object.freeze(t);
}
export const isKnownCode=(t,code)=>typeof code==='string'&&t.codes.some(c=>c.code===code);
export const hasPrefix=(t,prefix)=>nonempty(prefix)&&t.codes.some(c=>c.code.startsWith(prefix));
export const labelFor=(t,code)=>t.codes.find(c=>c.code===code)?.label??null;
export const defaultTerminology=loadTerminology(new URL('../terminology/icd10-seed.json',import.meta.url));
