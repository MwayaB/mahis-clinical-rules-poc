import { mkdirSync,writeFileSync,readFileSync,existsSync,rmSync } from 'node:fs';
import { join } from 'node:path';
import { generateKeyPairSync,createPrivateKey,createPublicKey } from 'node:crypto';
import { exact,text,timestamp,ApiError } from './prototype/store.js';
import { requireMetadata } from './registry.js';
import { listDrafts } from './draft.js';
import { nodeErrors } from './review.js';
import { releaseFixtures } from './fixtures.js';
import { validateIR } from './ir.js';
import { compile } from './compiler.js';
import { verifyPackage,applyPackage } from './package.js';
import { inputsHash } from './canonical.js';
export function ensureDevKeys(keyDir) {
 mkdirSync(keyDir,{recursive:true,mode:0o700});const privatePath=join(keyDir,'dev-private.pem'),publicPath=join(keyDir,'dev-public.pem');
 if(existsSync(privatePath)!==existsSync(publicPath)) throw new ApiError('Incomplete development keypair; refusing replacement',409);
 if(!existsSync(privatePath)) {const pair=generateKeyPairSync('ed25519');writeFileSync(privatePath,pair.privateKey.export({type:'pkcs8',format:'pem'}),{flag:'wx',mode:0o600});writeFileSync(publicPath,pair.publicKey.export({type:'spki',format:'pem'}),{flag:'wx',mode:0o644});}
 const key=createPrivateKey(readFileSync(privatePath)),pub=createPublicKey(readFileSync(publicPath));
 if(key.asymmetricKeyType!=='ed25519'||pub.asymmetricKeyType!=='ed25519'||createPublicKey(key).export({type:'spki',format:'pem'})!==pub.export({type:'spki',format:'pem'})) throw new ApiError('Invalid development keypair');
 return {privatePath,publicPath};
}
export function listReleases(store) {return store.db.prepare('SELECT record FROM releases ORDER BY version').all().map(r=>JSON.parse(r.record));}
export function getRelease(store,version) {if(typeof version!=='string'||!/^poc-(?:demo-)?\d+\.\d+\.\d+$/.test(version)) throw new ApiError('Invalid release version');const r=store.db.prepare('SELECT record FROM releases WHERE version=?').get(version);if(!r) throw new ApiError('Release not found',404);return JSON.parse(r.record);}
export function createRelease(store,body,{keyDir,actor,now}) {
 exact(body,['document_sha256','version']);const source=requireMetadata(store,body.document_sha256);text(actor,'actor');timestamp(now);
 if(typeof body.version!=='string'||!/^poc-(?:demo-)?\d+\.\d+\.\d+$/.test(body.version)) throw new ApiError('Version must be poc-0.1.0 or poc-demo-0.1.0 style');
 if(store.db.prepare('SELECT 1 FROM releases WHERE version=?').get(body.version)) throw new ApiError('Release version already exists; releases are append-only',409);
 const drafts=listDrafts(store,source.sha256),errors=[];
 if(!drafts.nodes.length) errors.push('No nodes drafted');
 for(const {node,approvals,content_hash} of drafts.nodes) {
  if(node.status!=='approved'||new Set(approvals.filter(a=>a.content_hash===content_hash).map(a=>a.reviewer)).size<2) errors.push(`${node.id}: not approved by two distinct reviewers for current content`);
  if(node.parse_errors?.length) errors.push(`${node.id}: parse errors: ${node.parse_errors.join('; ')}`);
 }
 if(drafts.unconverted.length) errors.push('Unconverted source blocks require manual review: '+drafts.unconverted.map(b=>b.block_id).join(', '));
 if(errors.length) throw new ApiError(errors.join('\n'),409);
 const fixtures=releaseFixtures(store,source.sha256);
 const nodes=drafts.nodes.map(r=>r.node);const ir={ir_version:'0.1',document:{id:source.document_id,edition:source.edition,checksum:'sha256:'+source.sha256},nodes};
 const validation=validateIR(ir);for(const n of nodes) validation.push(...nodeErrors(n));if(validation.length) throw new ApiError(validation.join('\n'),409);
 const keys=ensureDevKeys(keyDir),dir=join(store.root,'releases',body.version);
 if(existsSync(dir)) throw new ApiError('Release directory already exists; refusing overwrite',409);
 let created=false;
 try {
  compile(ir,{dir,privateKey:readFileSync(keys.privatePath),fixtures,packageVersion:body.version});created=true;
  const {manifest}=verifyPackage(dir,[keys.publicPath]);applyPackage(dir,{trustedPublicKeys:[keys.publicPath],engineVersion:'0.1.0'});
  const record={kind:'release-created',version:body.version,document_sha256:source.sha256,rules_sha256:manifest.rules_sha256,manifest_sha256:inputsHash(manifest),created_at:now,created_by:actor,contains_placeholders:manifest.contains_placeholders,reviewers:Object.fromEntries(drafts.nodes.map(r=>[r.node.id,r.approvals.map(a=>a.reviewer)])),fixture_count:fixtures.length};
  store.db.prepare('INSERT INTO releases VALUES(?,?)').run(body.version,store.encode(record));return record;
 } catch(e) {if(created) rmSync(dir,{recursive:true,force:true});throw e;}
}
export function loadRelease(store,version,{keyDir}) {const release=getRelease(store,version);const publicPath=join(keyDir,'dev-public.pem');const pkg=applyPackage(join(store.root,'releases',version),{trustedPublicKeys:[publicPath],engineVersion:'0.1.0'});if(pkg.manifest.rules_sha256!==release.rules_sha256||inputsHash(pkg.manifest)!==release.manifest_sha256) throw new ApiError('Stored release fingerprint mismatch',409);return pkg;}
