#!/usr/bin/env node
import { randomUUID } from 'node:crypto';
import { openEventLog } from './events.js';
import * as workflow from './workflow.js';
const [command,...tokens]=process.argv.slice(2);
const flags={};
if(command==='serve') {
 try {
  const opts={};for(let i=0;i<tokens.length;i+=2) {const k=tokens[i].slice(2);if(!tokens[i].startsWith('--')||!['port','data','keys','host'].includes(k)||!tokens[i+1]||Object.hasOwn(opts,k)) throw Error('Invalid server arguments');opts[k]=tokens[i+1];}
  const {startServer}=await import('./server.js');
  const app=await startServer({host:opts.host??'127.0.0.1',port:opts.port===undefined?8080:Number(opts.port),dataDir:opts.data,keyDir:opts.keys,clock:()=>new Date().toISOString()});
  console.log(`Local placeholder prototype: ${app.url}/guidelines.html`);
  for(const signal of ['SIGINT','SIGTERM']) process.once(signal,async()=>{await app.close();process.exit(0);});
 } catch(e) {console.error(e.message);process.exitCode=1;}
} else {
try {
 const allowed={register:['patient-id','name','sex'],observe:['patient-id','field','value','supersedes'],status:['patient-id','field','value','supersedes'],diagnose:['patient-id','icd10','label','certainty'],prescribe:['patient-id','atc','tablets','package','pubkey'],events:['patient-id'],respond:['patient-id','advice-ref','action','reason']};
 if(!allowed[command]) throw new Error('Commands: register, observe, status, diagnose, prescribe, events, respond');
 for(let i=0;i<tokens.length;i+=2) {
  const key=tokens[i].slice(2),value=tokens[i+1];
  if(!tokens[i].startsWith('--')||![...allowed[command],'db'].includes(key)||value===undefined||Object.hasOwn(flags,key)) throw new Error('Invalid or duplicate argument '+tokens[i]);flags[key]=value;
 }
 if(!flags.db||!flags['patient-id']) throw new Error('--db and --patient-id required');
 const required={register:['name','sex'],observe:['field','value'],status:['field','value'],diagnose:['icd10','label'],prescribe:['package','pubkey'],events:[],respond:['advice-ref','action']};
 for(const k of required[command]) if(!Object.hasOwn(flags,k)) throw new Error('Missing --'+k);
 const occurredAt=new Date().toISOString();
 const db=openEventLog(flags.db);
 try {
  const args={db,today:occurredAt.slice(0,10),occurredAt,patientId:flags['patient-id'],eventId:randomUUID()};let output;
  switch(command) {
   case 'register': output=workflow.register({...args,name:flags.name,sex:flags.sex});break;
   case 'observe': if(!flags.value.trim()) throw new Error('Numeric value required');output=workflow.observe({...args,field:flags.field,value:Number(flags.value),supersedes:flags.supersedes});break;
   case 'status': if(!['true','false'].includes(flags.value)) throw new Error('Status must be true or false');output=workflow.status({...args,field:flags.field,value:flags.value==='true',supersedes:flags.supersedes});break;
   case 'diagnose': output=workflow.diagnose({...args,icd10:flags.icd10,label:flags.label,certainty:flags.certainty});break;
   case 'prescribe': {
    const tablets=flags.tablets===undefined?null:Number(flags.tablets);if(flags.tablets!==undefined&&!flags.tablets.trim()) throw new Error('Integer tablets required');
    output=workflow.prescribe({...args,atc:flags.atc??null,tablets,packageDir:flags.package,trustedPublicKeys:[flags.pubkey],eventIds:{prescription:randomUUID(),advice:randomUUID()}});
    process.exitCode=output.exitCode;break;
   }
   case 'respond': output=workflow.respond({...args,adviceRef:flags['advice-ref'],action:flags.action,reason:flags.reason});break;
   case 'events': output=db.listForPatient(args.patientId);break;
  }
  console.log(JSON.stringify(output,null,2));
 } finally {db.close();}
} catch(e) {console.error(e.message);process.exitCode=1;}

}
