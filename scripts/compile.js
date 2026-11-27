import { readFileSync } from 'node:fs';
import { compile } from '../src/compiler.js';
try {
 const flags={},tokens=process.argv.slice(2);
 for(let i=0;i<tokens.length;i+=2) {
  const key=tokens[i].slice(2);if(!tokens[i].startsWith('--')||!['ir','fixtures','key','out','version','review-events'].includes(key)||!tokens[i+1]||Object.hasOwn(flags,key)) throw new Error('Invalid compile arguments');flags[key]=tokens[i+1];
 }
 for(const key of ['ir','fixtures','key','out','review-events']) if(!flags[key]) throw new Error('Required --'+key);
 const ir=JSON.parse(readFileSync(flags.ir)),fixtures=JSON.parse(readFileSync(flags.fixtures));
 const manifest=compile(ir,{dir:flags.out,privateKey:readFileSync(flags.key),fixtures,reviewEvents:JSON.parse(readFileSync(flags['review-events'])),packageVersion:flags.version??'poc-0.1.0'});
 console.log(JSON.stringify(manifest,null,2));
} catch(e) {console.error(e.message);process.exitCode=1;}
