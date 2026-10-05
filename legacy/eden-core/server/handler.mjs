/** Shared Node handler for Vercel Functions and the local development server. */
import {randomBytes} from 'node:crypto';
import {readConfig,hash,secretEqual} from './config.mjs';
import {createDatabase} from './database.mjs';
import {createStore} from './store.mjs';
import {sanitizeSimulator,simulatorSummary,EVENT_LIMIT} from '../docs/app/pcsim/model.js';
import {STEPS} from '../docs/app/content.js';
export const MAX_BODY_BYTES=300000;
const DAY=86400000;
const token=()=>randomBytes(32).toString('base64url');
export function httpError(status,message,code='REQUEST_REJECTED'){return Object.assign(new Error(message),{status,code});}
function send(res,status,data,headers={}){
 res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers});
 res.end(JSON.stringify(data));
}
export async function readJSON(req){
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw httpError(415,'Envoie du JSON.');
 const declared=Number(req.headers['content-length']);
 if(Number.isFinite(declared)&&declared>MAX_BODY_BYTES)throw httpError(413,'Corps limité à 300 Ko.');
 let data;
 try {
  // Vercel may have parsed req.body already; never read a consumed stream twice.
  const parsed=req.body;
  if(parsed!==undefined){
   if(Buffer.isBuffer(parsed)||typeof parsed==='string'){
    if(Buffer.byteLength(parsed)>MAX_BODY_BYTES)throw httpError(413,'Corps limité à 300 Ko.');
    data=JSON.parse(parsed.toString());
   } else {
    if(Buffer.byteLength(JSON.stringify(parsed)??'')>MAX_BODY_BYTES)throw httpError(413,'Corps limité à 300 Ko.');
    data=parsed;
   }
  } else {
   const chunks=[];let bytes=0;
   for await(const chunk of req){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);bytes+=b.length;
    if(bytes>MAX_BODY_BYTES)throw httpError(413,'Corps limité à 300 Ko.');chunks.push(b);}
   data=JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }
 }catch(e){if(e.status)throw e;throw httpError(400,'JSON invalide.');}
 if(!data||typeof data!=='object'||Array.isArray(data))throw httpError(400,'Objet JSON attendu.');
 return data;
}
export function requestOrigin(req,cfg){
 const host=String(req.headers.host||'');
 if(!/^[a-z0-9.:[\]-]+(?::\d{1,5})?$/i.test(host)||host.length>255)throw httpError(400,'Hôte invalide.');
 // Vercel terminates HTTPS at its edge. In local development, use HTTP.
 const secure=cfg.secure||req.socket?.encrypted===true;
 const inferred=`${secure?'https':'http'}://${host}`;
 const origin=cfg.publicOrigin||inferred;
 try{if(new URL(origin).origin!==origin)throw new Error();}catch{throw httpError(503,'PUBLIC_ORIGIN doit être une origine sans chemin.','CONFIGURATION_REQUIRED');}
 if(req.headers.origin&&req.headers.origin!==origin)throw httpError(403,'Origine refusée.');
 if(req.headers['sec-fetch-site']==='cross-site')throw httpError(403,'Requête intersite refusée.');
 return origin;
}
function bearer(req){const match=String(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9_-]{40,90})$/);return match?.[1]||'';}
function cookieToken(req){return String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('eden_teacher='))?.slice('eden_teacher='.length)||'';}
const EVENTS=new Set(['action-refused','part-installed','cable-connected','boot-started','boot-ended','boot-interrupted','power-off','bios-opened','boot-target-changed','baseline-completed','session-opened','case-completed','case-started','diagnosis-wrong','diagnosis-correct','software-repaired','hint-used','transfer-chosen','bonus-completed']);
export function validatePacket(b){
 if(!Number.isSafeInteger(b.order)||b.order<1||typeof b.packetId!=='string'||!b.packetId||b.packetId.length>120)throw httpError(400,'Enveloppe invalide.');
 if(!Number.isInteger(b.coreCompleted)||b.coreCompleted<0||b.coreCompleted>STEPS.length)throw httpError(400,'Progression du cours invalide.');
 const raw=b.simulator;
 if(!raw||!Array.isArray(raw.events)||raw.events.length>EVENT_LIMIT)throw httpError(400,'Liste d’événements invalide.');
 const ids=new Set();
 for(const ev of raw.events){
  if(!ev||typeof ev.id!=='string'||ev.id.length>160||!ev.id||ids.has(ev.id)||!EVENTS.has(ev.type)||ev.runId!==raw.runId||!Number.isInteger(ev.seq)||ev.seq<1||ev.seq>raw.seq)throw httpError(400,'Événement invalide.');
  ids.add(ev.id);
 }
 const s=sanitizeSimulator(raw);if(!s)throw httpError(400,'État du simulateur invalide.');
 return {order:b.order,summary:simulatorSummary(s),events:s.events,coreCompleted:b.coreCompleted};
}
/** store is injectable only in tests. There is no in-memory persistence path in production. */
export function createHandler({env=process.env,store,clock=Date.now,log=(code)=>console.error('EDEN API:',code)}={}){
 const cfg=readConfig(env);
 const repository=store||createStore(createDatabase(cfg.databaseUrl));
 const cutoff=now=>now-cfg.retentionDays*DAY;
 const teacherHash=(t,origin)=>hash(`${t}:${origin}`);
 async function teacher(req,origin,now){
  const t=cookieToken(req);
  if(!/^[A-Za-z0-9_-]{40,90}$/.test(t)||!await repository.teacherAuth(teacherHash(t,origin),cfg.scope,cfg.teacherVersion,now))throw httpError(401,'Connexion professeur requise.');
  return t;
 }
 async function learner(req,now){const t=bearer(req),row=t?await repository.learnerAuth(hash(t),cfg.scope,cfg.studentVersion,now):null;if(!row)throw httpError(401,'Session élève absente ou expirée.');return row;}
 return async function handle(req,res,route){
  try {
   const origin=requestOrigin(req,cfg),now=clock(),method=req.method||'GET';
   const methods={config:['GET'],health:['GET'],enroll:['POST'],events:['POST'],'teacher/login':['POST'],'teacher/logout':['POST'],'teacher/learners':['GET'],'teacher/learner':['GET','POST','DELETE'],'teacher/maintenance':['POST'],cron:['GET']};
   if(!methods[route])throw httpError(404,'Route API introuvable.');
   if(!methods[route].includes(method)){res.setHeader('Allow',methods[route].join(', '));throw httpError(405,'Méthode refusée.');}
   if(!cfg.configured){
    if(route==='config'){send(res,200,{enabled:false,backend:'neon',reason:'configuration-required',message:'Suivi à configurer dans Vercel. Le parcours local reste disponible.',missing:cfg.problems});return;}
    throw httpError(503,`Configuration Vercel à compléter : ${cfg.problems.join(', ')}.`, 'CONFIGURATION_REQUIRED');
   }
   // Cron is authenticated before any database work.
   if(route==='cron'&&(!cfg.cronSecret||cfg.cronSecret.length<32||!secretEqual(req.headers.authorization,`Bearer ${cfg.cronSecret}`)))throw httpError(401,'Autorisation cron requise.');
   await repository.ready();
   if(route==='config'){send(res,200,{enabled:true,backend:'neon',classLabel:cfg.classLabel,retentionDays:cfg.retentionDays,totalSteps:STEPS.length});return;}
   if(route==='health'){send(res,200,{ok:true,backend:'neon',schema:1});return;}
   if(route==='enroll'){
    const ip=env.VERCEL==='1'?String(req.headers['x-real-ip']||req.headers['x-vercel-forwarded-for']||'edge'):String(req.socket?.remoteAddress||'local');
    if(!await repository.rate(cfg.ipKey(ip,'enroll'),120,15*60000,now))throw httpError(429,'Trop de tentatives. Réessaie dans 15 minutes.');
    const b=await readJSON(req);
    if(!secretEqual(b.classCode,cfg.classCode))throw httpError(403,'Code de classe incorrect.');
    if(typeof b.alias!=='string'||!/^[-\p{L}\p{N}._ ]{2,48}$/u.test(b.alias.trim()))throw httpError(400,'Code élève attendu : 2 à 48 lettres, chiffres ou tirets.');
    const id=randomBytes(12).toString('hex'),t=token(),expiresAt=now+7*DAY;
    await repository.enroll({id,scope:cfg.scope,alias:b.alias.trim(),tokenHash:hash(t),credentialVersion:cfg.studentVersion,expires:expiresAt,now});
    send(res,201,{studentId:id,token:t,expiresAt});return;
   }
   if(route==='events'){
    const user=await learner(req,now);
    if(!await repository.rate(cfg.ipKey(user.id,'events'),120,60000,now))throw httpError(429,'Trop d’envois rapprochés. Réessaie dans une minute.');
    const packet=validatePacket(await readJSON(req));
    const r=await repository.ingest({...packet,id:user.id,scope:cfg.scope,credentialVersion:cfg.studentVersion,now});
    if(!r.authorized)throw httpError(401,'Session élève absente ou expirée.');
    send(res,200,{receivedAt:new Date(now).toISOString(),acceptedEvents:r.acceptedEvents,duplicateOrOlder:r.duplicateOrOlder});return;
   }
   if(route==='teacher/login'){
    const ip=env.VERCEL==='1'?String(req.headers['x-real-ip']||req.headers['x-vercel-forwarded-for']||'edge'):String(req.socket?.remoteAddress||'local');
    if(!await repository.rate(cfg.ipKey(ip,'teacher'),12,15*60000,now))throw httpError(429,'Trop de tentatives de connexion. Attends 15 minutes.');
    const b=await readJSON(req);
    if(!secretEqual(b.password,cfg.teacherPassword))throw httpError(403,'Connexion refusée.');
    const t=token();await repository.createTeacher(teacherHash(t,origin),cfg.scope,cfg.teacherVersion,now+8*3600000);
    send(res,200,{ok:true},{'Set-Cookie':`eden_teacher=${t}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=28800${origin.startsWith('https:')?'; Secure':''}`});return;
   }
   if(route==='cron'){await repository.cleanup(cfg.scope,cutoff(now),now);send(res,200,{ok:true});return;}
   const t=await teacher(req,origin,now);
   if(route==='teacher/logout'){
    await repository.logout(teacherHash(t,origin),cfg.scope);
    send(res,200,{ok:true},{'Set-Cookie':`eden_teacher=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${origin.startsWith('https:')?'; Secure':''}`});return;
   }
   if(route==='teacher/maintenance'){const r=await repository.cleanup(cfg.scope,cutoff(now),now);send(res,200,{ok:true,...r});return;}
   if(route==='teacher/learners'){
    // Bounded work performed inside the invocation, not an unreliable background interval.
    await repository.cleanup(cfg.scope,cutoff(now),now);
    send(res,200,{learners:await repository.list(cfg.scope,cutoff(now)),retentionDays:cfg.retentionDays,totalSteps:STEPS.length});return;
   }
   if(route==='teacher/learner'){
    const id=req.query?.id||new URL(req.url,'http://local').pathname.split('/').filter(Boolean).at(-1);
    if(typeof id!=='string'||!/^[a-f0-9]{24}$/.test(id))throw httpError(400,'Identifiant invalide.');
    const d=await repository.detail(id,cfg.scope,cutoff(now));if(!d)throw httpError(404,'Élève introuvable.');
    if(method==='GET'){send(res,200,d);return;}
    if(method==='DELETE'){await repository.remove(id,cfg.scope);send(res,200,{ok:true});return;}
    const b=await readJSON(req);
    if(!['a-valider','valide','a-revoir'].includes(b.validation))throw httpError(400,'Statut invalide.');
    if(!(b.expectedRevision===null||Number.isInteger(b.expectedRevision))||!(b.expectedRunId===null||typeof b.expectedRunId==='string'))throw httpError(400,'Recharge la fiche avant de la valider.');
    if(b.note!==undefined&&typeof b.note!=='string')throw httpError(400,'Note invalide.');
    const ok=await repository.validate({id,scope:cfg.scope,now,validation:b.validation,note:(b.note||'').slice(0,1200),expectedRevision:b.expectedRevision,expectedRunId:b.expectedRunId});
    if(!ok)throw httpError(409,'De nouveaux essais sont arrivés. Recharge la fiche avant de valider.','STALE_VALIDATION');
    send(res,200,{ok:true});return;
   }
  }catch(error){
   const status=error.status||503;
   if(!error.status)log(error.code||error.name||'DATABASE_UNAVAILABLE'); // no URL, token, alias or payload
   send(res,status,{error:error.status?error.message:'Suivi momentanément indisponible. Tes essais restent locaux ; réessaie ou contacte le professeur.',code:error.code||'SERVICE_UNAVAILABLE'},status===429?{'Retry-After':'60'}:{});
  }
 };
}
let productionHandler;
export function handle(req,res,route){productionHandler??=createHandler();return productionHandler(req,res,route);}
