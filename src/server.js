import * as encounters from './encounters.js';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { openStore,ApiError,exact,digest } from './prototype/store.js';
import { openEventLog } from './events.js';
import * as registry from './registry.js';
import * as digitiser from './digitiser.js';
import * as drafts from './draft.js';
import * as review from './review.js';
import * as fixtures from './fixtures.js';
import * as releases from './release.js';
import * as emr from './emr.js';
const staticFiles={'/':'guidelines.html','/guidelines.html':'guidelines.html','/digitise.html':'digitise.html','/review.html':'review.html','/emr.html':'emr.html','/style.css':'style.css','/common.js':'common.js','/guidelines.js':'guidelines.js','/digitise.js':'digitise.js','/review.js':'review.js','/emr.js':'emr.js','/samples/dose-guide/placeholder.pdf':'../samples/dose-guide/placeholder.pdf'};
function readBody(req,max) {
 return new Promise((done,fail)=>{
  let size=0,chunks=[],failed=false;
  if(req.headers['content-length']&&(!/^\d+$/.test(req.headers['content-length'])||Number(req.headers['content-length'])>max)) {req.resume();fail(new ApiError('Request body exceeds allowed size',413));return;}
  req.on('data',chunk=>{if(failed) return;size+=chunk.length;if(size>max){failed=true;chunks=[];fail(new ApiError('Request body exceeds allowed size',413));}else chunks.push(chunk);});
  req.on('end',()=>{if(!failed) done(Buffer.concat(chunks));});req.on('error',fail);
 });
}
async function jsonBody(req) {
 if(req.headers['content-type']?.split(';')[0]!=='application/json') throw new ApiError('Content-Type must be application/json',415);
 const bytes=await readBody(req,2*1024*1024);try{return JSON.parse(bytes);}catch{throw new ApiError('Invalid JSON body');}
}
export async function startServer({host='127.0.0.1',port=8080,dataDir=fileURLToPath(new URL('../data/',import.meta.url)),keyDir=fileURLToPath(new URL('../keys/',import.meta.url)),clock,fixtureDir,publicDir=fileURLToPath(new URL('../public/',import.meta.url))}={}) {
 if(host!=='127.0.0.1') throw new ApiError('Server must bind to 127.0.0.1 only');
 if(!Number.isInteger(port)||port<0||port>65535||typeof clock!=='function') throw new ApiError('Valid port and caller clock required');
 const store=openStore(dataDir),events=openEventLog(join(store.root,'clinical.db'));let server;
 try {
 server=createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(value));};
  try {
   const origin=`http://127.0.0.1:${server.address().port}`;
   if(req.headers.host!==new URL(origin).host||req.headers.origin&&req.headers.origin!==origin||req.headers['sec-fetch-site']==='cross-site') throw new ApiError('Only same-origin loopback requests are accepted',403);
   const raw=req.url.split('?')[0];if(/%2f|%5c|\.\.|\\/i.test(raw)) throw new ApiError('Invalid path');
   const url=new URL(req.url,origin),path=url.pathname,method=req.method;
   const queryKeys=path==='/api/guidelines'&&method==='POST'?['filename','document_id']:path==='/api/triage/config'?['release_version']:path==='/api/ir'?['document']:path==='/api/fixtures'?['node']:['/digitise.html','/review.html'].includes(path)?['document']:[];
   for(const key of url.searchParams.keys()) if(!queryKeys.includes(key)||url.searchParams.getAll(key).length!==1) throw new ApiError('Unknown or duplicate query parameter '+key);
   const who=()=>req.headers['x-user']??'local-user';const meta=()=>({actor:who(),now:clock(),keyDir});
   let match;
   if(method==='GET'&&staticFiles[path]) {
    const file=staticFiles[path],ext=file.split('.').at(-1),types={html:'text/html',css:'text/css',js:'text/javascript',pdf:'application/pdf'};
    const bytes=readFileSync(join(resolve(publicDir),file));res.writeHead(200,{'Content-Type':types[ext]+'; charset=utf-8'});res.end(bytes);return;
   }
   if(path==='/api/guidelines'&&method==='GET') return send(200,registry.listSources(store));
   if(path==='/api/guidelines'&&method==='POST') {
    if(req.headers['content-type']!=='application/pdf') throw new ApiError('Content-Type must be application/pdf',415);
    const bytes=await readBody(req,registry.MAX_UPLOAD);
    return send(200,registry.uploadGuideline(store,{bytes,contentType:req.headers['content-type'],filename:url.searchParams.get('filename'),documentId:url.searchParams.get('document_id'),user:who(),now:clock()}));
   }
   if((match=/^\/api\/guidelines\/([^/]+)(?:\/(metadata|digitise|blocks|draft))?$/.exec(path))) {
    const [,sha,action]=match;digest(sha);
    if(!action&&method==='GET') return send(200,registry.getSource(store,sha));
    if(action==='metadata'&&method==='POST') return send(200,registry.setMetadata(store,sha,await jsonBody(req)));
    if(action==='digitise'&&method==='POST') {exact(await jsonBody(req),[]);return send(200,digitiser.digitise(store,sha,{fixtureDir}));}
    if(action==='blocks'&&method==='GET') return send(200,digitiser.listBlocks(store,sha));
    if(action==='blocks'&&method==='POST') return send(201,digitiser.manualBlock(store,sha,await jsonBody(req)));
    if(action==='draft'&&method==='POST') return send(200,drafts.generateDrafts(store,sha,await jsonBody(req),meta()));
   }
   if(path==='/api/triage/drafts'&&method==='POST') return send(201,review.importTriageDraft(store,await jsonBody(req),meta()));
   if(path==='/api/ir'&&method==='GET') return send(200,drafts.listDrafts(store,url.searchParams.get('document')));
   if((match=/^\/api\/ir\/([^/]+)\/(edit|approve|reject|history)$/.exec(path))) {
    const id=decodeURIComponent(match[1]),action=match[2];
    if(action==='history'&&method==='GET') return send(200,review.reviewHistory(store,id));
    if(method==='POST') {const body=await jsonBody(req);const fn={edit:review.editNode,approve:review.approveNode,reject:review.rejectNode}[action];if(fn) return send(200,fn(store,id,body,meta()));}
   }
   if(path==='/api/fixtures'&&method==='GET') return send(200,fixtures.getFixtures(store,url.searchParams.get('node')));
   if(path==='/api/fixtures'&&method==='POST') return send(200,fixtures.saveFixtures(store,await jsonBody(req)));
   if(path==='/api/releases'&&method==='GET') return send(200,releases.listReleases(store));
   if(path==='/api/releases'&&method==='POST') return send(201,releases.createRelease(store,await jsonBody(req),meta()));
   if(path==='/api/triage/config'&&method==='GET') return send(200,encounters.triageConfiguration(store,url.searchParams.get('release_version'),{keyDir}));
   if(path==='/api/encounters'&&method==='POST') return send(201,encounters.startEncounter(store,events,await jsonBody(req),meta()));
   if((match=/^\/api\/encounters\/([^/]+)(?:\/(observations|triage|triage\/override))?$/.exec(path))) {
    const id=decodeURIComponent(match[1]),action=match[2];
    if(!action&&method==='GET') return send(200,encounters.readEncounter(store,events,id,meta()));
    if(method==='POST') {const fn={observations:encounters.recordEncounterObservation,triage:encounters.scoreEncounter,'triage/override':encounters.overrideEncounter}[action];if(fn) return send(200,fn(store,events,id,await jsonBody(req),meta()));}
   }
   if(path==='/api/patients'&&method==='GET') return send(200,emr.listPatients(store));
   if(path==='/api/patients'&&method==='POST') return send(201,emr.createPatient(store,events,await jsonBody(req),meta()));
   if((match=/^\/api\/patients\/([^/]+)\/(observations|status|diagnoses|prescriptions\/check|events|context)$/.exec(path))) {
    const id=decodeURIComponent(match[1]),action=match[2];
    if(action==='diagnoses'&&method==='GET') return send(200,emr.patientDiagnoses(store,events,id));
    if(action==='events'&&method==='GET') return send(200,emr.patientEvents(store,events,id));
    if(action==='context'&&method==='GET') return send(200,emr.patientContext(store,events,id,meta()));
    if(method==='POST') {const fn={observations:emr.recordObservation,status:emr.recordStatus,diagnoses:emr.recordDiagnosis,'prescriptions/check':emr.checkPrescription}[action];if(fn) return send(200,fn(store,events,id,await jsonBody(req),meta()));}
   }
   if((match=/^\/api\/events\/(\d+)\/replay$/.exec(path))&&method==='POST') {exact(await jsonBody(req),[]);return send(200,emr.replayAdvice(store,events,Number(match[1]),{keyDir}));}
   if(path==='/api/sample-bundle'&&method==='GET') return send(200,JSON.parse(readFileSync(new URL('../samples/dose-guide/bundle.json',import.meta.url))));
   throw new ApiError('Route not found',404);
  } catch(e) {if(!res.headersSent) send(e.status??(e.code?500:400),{error:e.status||!e.code?e.message:'Local storage operation failed'});else res.end();}
 });
 await new Promise((done,fail)=>{server.once('error',fail);server.listen(port,host,done);});
 return {server,store,events,url:`http://127.0.0.1:${server.address().port}`,async close(){await new Promise((done,fail)=>server.close(e=>e?fail(e):done()));events.close();store.close();}};
 } catch(e) {events.close();store.close();throw e;}
}
