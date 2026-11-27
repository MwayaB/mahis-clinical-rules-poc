import { fields,nonempty,object } from './schema.js';
export function validateEnvelope(result,errors) {
 const keys=['node_id','node_type','status','outcome','missing','invalid','payload','package_version','engine_version','inputs_hash'];
 if(!fields(result,keys,keys.filter(k=>k!=='outcome'),'assessment',errors)) return;
 if(!['ok','advice','incomplete','invalid'].includes(result.status)||!nonempty(result.node_id)||!nonempty(result.node_type)||!nonempty(result.package_version)||!nonempty(result.engine_version)||! /^sha256:[a-f0-9]{64}$/.test(result.inputs_hash)) errors.push('Invalid assessment metadata');
 if(!Array.isArray(result.missing)||result.missing.some(k=>!nonempty(k))||!Array.isArray(result.invalid)||!object(result.payload)) errors.push('Invalid assessment detail');
 if(['ok','advice'].includes(result.status)) {if(!object(result.outcome)||result.missing?.length||result.invalid?.length) errors.push('Completed assessment requires outcome and valid complete inputs');}
 else {if(Object.hasOwn(result,'outcome')||['score','category','components'].some(k=>Object.hasOwn(result.payload??{},k))) errors.push('Incomplete or invalid assessment cannot have an outcome or partial score');if(result.status==='incomplete'&&!result.missing?.length||result.status==='invalid'&&!result.invalid?.length) errors.push('Missing assessment diagnostic');}
 for(const invalid of result.invalid??[]) if(fields(invalid,['input','value','reason'],['input','value'],'invalid input',errors)) if(!nonempty(invalid.input)||invalid.reason!==undefined&&!nonempty(invalid.reason)) errors.push('Invalid input diagnostic');
}
