import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, verify, createPublicKey } from 'node:crypto';
import { fields, nonempty, validateNodes } from './ir.js';
import { canonicalStringify } from './canonical.js';
export const ENGINE_VERSION='0.1.0';
const manifestFields=['terminology_version','package_version','ir_version','engine_min_version','contains_placeholders','source_documents','rules_sha256','node_count','triage_nodes'];
export function compareVersions(a,b) {
 const parse=v=>{if(typeof v!=='string'||!/^\d+\.\d+\.\d+$/.test(v)) throw new Error('Invalid semver');const ns=v.split('.').map(Number);if(!ns.every(Number.isSafeInteger)) throw new Error('Invalid semver');return ns;};
 const x=parse(a),y=parse(b);for(let i=0;i<3;i++) if(x[i]!==y[i]) return x[i]>y[i]?1:-1;return 0;
}
function validateManifest(m) {
 const errors=[];
 if(!fields(m,manifestFields,manifestFields.filter(k=>k!=='triage_nodes'),'manifest',errors)) throw new Error(errors.join('\n'));
 if(!/^poc-(?:demo-)?\d+\.\d+\.\d+$/.test(m.package_version)) errors.push('Invalid package_version');
 if(!nonempty(m.terminology_version)) errors.push('Invalid terminology_version');
 if(m.ir_version!=='0.1') errors.push('Unsupported IR version');
 try {compareVersions(m.engine_min_version,'0.1.0');} catch {errors.push('Invalid engine minimum');}
 if(typeof m.contains_placeholders!=='boolean'||!Number.isSafeInteger(m.node_count)||m.node_count<1||typeof m.rules_sha256!=='string'||!/^[a-f0-9]{64}$/.test(m.rules_sha256)) errors.push('Invalid manifest values');
 if(m.triage_nodes!==undefined&&(!Number.isSafeInteger(m.triage_nodes)||m.triage_nodes<0||m.triage_nodes>m.node_count)) errors.push('Invalid triage_nodes');
 if(!Array.isArray(m.source_documents)||!m.source_documents.length) errors.push('Invalid source_documents');
 else for(const d of m.source_documents) if(fields(d,['id','edition','checksum'],['id','edition','checksum'],'document',errors)) {
  if(!nonempty(d.id)||!nonempty(d.edition)||!/^sha256:[a-f0-9]{64}$/.test(d.checksum)) errors.push('Invalid source document');
 }
 if(errors.length) throw new Error(errors.join('\n'));
}
export function verifyPackage(dir,trustedPublicKeys) {
 const manifestBytes=readFileSync(join(dir,'manifest.json')),sig=readFileSync(join(dir,'manifest.sig'));
 if(!Array.isArray(trustedPublicKeys)||!trustedPublicKeys.length) throw new Error('No trusted public keys');
 const trusted=trustedPublicKeys.some(path=>{
  try {const key=createPublicKey(readFileSync(path));return key.asymmetricKeyType==='ed25519'&&verify(null,manifestBytes,key,sig);} catch {return false;}
 });
 if(!trusted) throw new Error('Signature verification failed');
 const manifest=JSON.parse(manifestBytes);validateManifest(manifest);
 const rulesBytes=readFileSync(join(dir,'rules.json'));
 if(createHash('sha256').update(rulesBytes).digest('hex')!==manifest.rules_sha256) throw new Error('Rules checksum mismatch');
 return {manifest,rulesBytes};
}
export function deepFreeze(x) {if(x&&typeof x==='object') {for(const v of Object.values(x)) deepFreeze(v);Object.freeze(x);}return x;}
export function applyPackage(dir,{trustedPublicKeys,engineVersion=ENGINE_VERSION}) {
 const {manifest,rulesBytes}=verifyPackage(dir,trustedPublicKeys);
 if(compareVersions(manifest.engine_min_version,engineVersion)>0) throw new Error('Engine too old');
 // A caller cannot claim a future evaluator implementation through this argument.
 if(engineVersion!==ENGINE_VERSION) throw new Error('Unsupported evaluator engine version');
 const rules=JSON.parse(rulesBytes);const errors=validateNodes(rules,{compiled:true,terminology:null});
 if(rules.filter(n=>n.type==='scored_triage').length!==(manifest.triage_nodes??0)) errors.push('Triage node count mismatch');
 if(rules.length!==manifest.node_count) errors.push('Node count mismatch');
 if(canonicalStringify(rules)!==rulesBytes.toString()) errors.push('Rules are not canonical');
 if(errors.length) throw new Error(errors.join('\n'));
 return deepFreeze({manifest,rules,engine_version:ENGINE_VERSION});
}
