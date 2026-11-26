import { generateKeyPairSync } from 'node:crypto';
import { mkdirSync,writeFileSync,existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir=fileURLToPath(new URL('../keys/',import.meta.url));
const privatePath=dir+'dev-private.pem',publicPath=dir+'dev-public.pem';
if(existsSync(privatePath)||existsSync(publicPath)) {
 if(!existsSync(privatePath)||!existsSync(publicPath)) throw new Error('Incomplete development keypair; refusing overwrite');
 console.log('Keeping existing development keypair');
} else {
 mkdirSync(dir,{recursive:true,mode:0o700});
 const {privateKey,publicKey}=generateKeyPairSync('ed25519');
 writeFileSync(privatePath,privateKey.export({type:'pkcs8',format:'pem'}),{mode:0o600,flag:'wx'});
 writeFileSync(publicPath,publicKey.export({type:'spki',format:'pem'}),{mode:0o644,flag:'wx'});
 console.log('Generated development Ed25519 keypair');
}
