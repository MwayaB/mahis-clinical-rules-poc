import { dosingTypes } from './dosing.js';
import { triageType } from './triage.js';
const definitions=new Map(),kinds=new Map();
export function registerType(definition) {
 const required=['name','version','nodeKinds','fields','validate','serialise','requiredInputs','evaluate','requiredFixtureKinds','scope','renderer'];
 if(!definition||required.some(k=>!Object.hasOwn(definition,k))||typeof definition.name!=='string'||!definition.name||typeof definition.version!=='string'||!definition.version||definitions.has(definition.name)) throw new Error('Invalid or duplicate type definition');
 for(const fn of ['validate','serialise','requiredInputs','evaluate']) if(typeof definition[fn]!=='function') throw new Error('Type requires '+fn);
 for(const key of ['nodeKinds','fields','requiredFixtureKinds']) if(!Array.isArray(definition[key])||!definition[key].length||definition[key].some(k=>typeof k!=='string'||!k)||new Set(definition[key]).size!==definition[key].length) throw new Error('Invalid type '+key);
 if(!['patient','encounter'].includes(definition.scope)||!['advice','category'].includes(definition.renderer)) throw new Error('Invalid type scope or renderer');
 for(const kind of definition.nodeKinds) if(kinds.has(kind)) throw new Error('Duplicate node kind '+kind);
 const d=Object.freeze({...definition,nodeKinds:Object.freeze([...definition.nodeKinds]),fields:Object.freeze([...definition.fields]),requiredFixtureKinds:Object.freeze([...definition.requiredFixtureKinds])});definitions.set(d.name,d);for(const kind of d.nodeKinds) kinds.set(kind,d);
 return ()=>{definitions.delete(d.name);for(const kind of d.nodeKinds) kinds.delete(kind);};
}
export function getType(name) {const type=kinds.get(name)??definitions.get(name);if(!type) throw new Error('Unknown node kind '+String(name));return type;}
export const listTypes=()=>[...definitions.values()];
for(const definition of [...dosingTypes,triageType]) registerType(definition);
