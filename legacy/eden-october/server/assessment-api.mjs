import {chooseLatest} from './state-choice.mjs';
import {randomBytes,createHash} from 'node:crypto';
import {sanitizeState,summary} from '../docs/app/model.js';
import {gradeDiagnostic} from './grade.mjs';
import {ITEMS,aggregate,RUBRIC_VERSION} from './rubric.mjs';
const error=(status,message)=>Object.assign(new Error(message),{status});
const digest=s=>createHash('sha256').update(JSON.stringify(s)).digest('hex');
const validId=id=>typeof id==='string'&&/^[a-f0-9]{24}$/.test(id);
export const receipt=s=>({id:s.id,kind:s.kind,created:Number(s.created),digest:s.digest,revision:s.state?.revision,attempt:s.attempt});
export async function assessmentAPI({req,res,route,repo,store,cfg,user,readJSON,send,now,actor}){
 const url=new URL(req.url,'http://local');
 if(route==='assessment'){
  if(req.method==='GET'){
   const session=await repo.session(user.id),stored=await repo.latestState(user.id,cfg.scope),history=await repo.history(user.id,cfg.scope);
   const latest=history.find(x=>x.kind==='course');const snap=latest?await repo.get(latest.id,cfg.scope):null;
   const final=session?.final_id?await repo.get(session.final_id,cfg.scope):null;
   // Last acknowledged state, not a default empty form. Never expose correction here.
   const state=chooseLatest(stored.state,stored.updated,snap);
   send(res,200,{session:session?{started:session.started,attempt:session.attempt,finalId:session.final_id}:null,state,finalState:final?.state||null,lastOrder:user.last_order||0,receipts:history.map(receipt)});return;
  }
  const b=await readJSON(req),action=b.action;
  if(action==='start'){const s=await repo.start(user.id,now);send(res,200,{started:s.started,attempt:s.attempt,finalId:s.final_id});return;}
  if(!['save','submit'].includes(action))throw error(400,'Action élève inconnue.');
  if(!/^[\w-]{5,100}$/.test(b.requestId||''))throw error(400,'Identifiant de remise manquant.');
  let state;try{state=sanitizeState(b.state);}catch(e){throw error(400,e.message);}state.alias=user.alias;
  const kind=action==='submit'?'diagnostic':'course';
  if(kind==='diagnostic'){
   state={...state,diagnosticVersion:RUBRIC_VERSION,responses:Object.fromEntries(Object.entries(state.responses).filter(([id])=>id.startsWith('diag-')))};
   // The deployed server chooses the rubric for a new submission; the browser cannot select an easier old one. Stored originals and reviews keep their historical rubric.
   // A newly enrolled offline learner can submit; the timing limitation is visible to the teacher.
   await repo.start(user.id,now);
  }
  const hash=digest(state),previous=await repo.findRequest(user.id,b.requestId);
  if(previous){if(previous.digest!==hash||previous.kind!==kind)throw error(409,'Cet identifiant correspond déjà à un autre rendu.');send(res,200,{...receipt(previous),confirmed:true});return;}
  const session=await repo.session(user.id);
  if(kind==='diagnostic'&&session?.final_id){const final=await repo.get(session.final_id,cfg.scope);send(res,200,{...receipt(final),confirmed:true,alreadySubmitted:true});return;}
  const id=randomBytes(12).toString('hex');
  const grade=kind==='diagnostic'?gradeDiagnostic(state):null;
  if(grade){grade.timing={started:session?.started,received:now,durationMs:Math.max(0,now-session.started),exceeded20min:now-session.started>20*60000};}
  const saved=await repo.save({id,learnerId:user.id,scope:cfg.scope,requestId:b.requestId,kind,now,digest:hash,state,grade});
  if(!saved){const s=await repo.session(user.id);if(s?.final_id){send(res,200,{...receipt(await repo.get(s.final_id,cfg.scope)),confirmed:true,alreadySubmitted:true});return;}throw error(409,'Remise concurrente : réessaie, sans effacer ton travail.');}
  // Keep course summary current, without replacing a newer autosave packet.
  send(res,201,{...receipt(saved),confirmed:true});return;
 }
 const action=req.method==='GET'?(url.searchParams.get('action')||'list'):null;
 if(action==='list'){send(res,200,{learners:await repo.list(cfg.scope),rubricVersion:RUBRIC_VERSION});return;}
 if(req.method==='GET'){
  const id=url.searchParams.get('id');if(!validId(id))throw error(400,'Identifiant élève invalide.');
  const detail=await store.detail(id,cfg.scope,now-cfg.retentionDays*86400000);if(!detail)throw error(404,'Élève introuvable.');
  const history=await repo.history(id,cfg.scope),session=await repo.session(id);
  const submissionId=url.searchParams.get('submission')||session?.final_id;
  const evaluation=submissionId?await repo.get(submissionId,cfg.scope):null;
  if(evaluation&&evaluation.learner_id!==id)throw error(404,'Rendu introuvable.');
  if(action==='detail'){send(res,200,{...detail,session,history,evaluation,audit:evaluation?await repo.reviewHistory(evaluation.id,cfg.scope):[]});return;}
  if(action==='export'){
   if(evaluation&&evaluation.kind!=='diagnostic')throw error(400,'Choisis une évaluation, pas une copie de travail.');
   const {studentFiles}=await import('./exports.mjs');
   const savedCourse=history.find(x=>x.kind==='course');const course=savedCourse?await repo.get(savedCourse.id,cfg.scope):null;
   const files=await studentFiles({learner:detail.learner,evaluation,course,history,now});
   if(url.searchParams.get('format')==='files'){send(res,200,{files:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,Buffer.from(v).toString('base64')]))});return;}
   const {zipStore}=await import('../docs/app/zip.js');const data=Buffer.from(zipStore(files));if(data.length>4_000_000)throw error(413,'Dossier trop volumineux. Utilise l’export fichier par fichier.');
   res.writeHead(200,{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="EDEN_${id}.zip"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(data);return;
  }
  throw error(400,'Action professeur inconnue.');
 }
 const b=await readJSON(req);
 if(b.action==='reopen'){
  if(!validId(b.learnerId)||typeof b.reason!=='string'||b.reason.trim().length<5||b.reason.length>1200)throw error(400,'Élève et motif de réouverture requis.');
  if(!await repo.reopen(b.learnerId,cfg.scope,b.reason.trim(),now,actor))throw error(409,'Aucun diagnostic remis à rouvrir.');send(res,200,{ok:true});return;
 }
 if(b.action!=='review'||!validId(b.submissionId)||!Number.isInteger(b.expectedVersion)||b.expectedVersion<0)throw error(400,'Relecture invalide.');
 const s=await repo.get(b.submissionId,cfg.scope);if(!s||s.kind!=='diagnostic')throw error(404,'Diagnostic introuvable.');
 if(!['a-relire','valide','a-revoir'].includes(b.status)||typeof b.note!=='string'||b.note.length>3000)throw error(400,'Statut ou commentaire invalide.');
 if(!Array.isArray(b.items)||b.items.length!==ITEMS.length)throw error(400,'Les 20 indicateurs sont requis.');
 const items=s.grade.items.map(spec=>{const choices=b.items.filter(i=>i.id===spec.id);if(choices.length!==1)throw error(400,'Indicateur manquant ou dupliqué.');const it=choices[0];if(![0,1,null].includes(it.point)||typeof it.comment!=='string'||it.comment.length>1200)throw error(400,'Point ou commentaire invalide.');const initial=s.grade.items.find(i=>i.id===spec.id);if(it.point!==initial.point&&it.comment.trim().length<3)throw error(400,'Explique chaque changement de point.');return {...initial,point:it.point,comment:it.comment,reviewRequired:it.point==null};});
 const stats=aggregate(items);if(b.status==='valide'&&stats.pending)throw error(400,'Renseigne tous les points avant de valider la correction.');
 const review={version:s.grade.version,items,...stats,status:b.status,note:b.note,reviewedAt:now};
 if(!await repo.review({submissionId:s.id,scope:cfg.scope,expectedVersion:b.expectedVersion,review,now,actor}))throw error(409,'Cette correction a changé. Recharge le dossier avant de réessayer.');
 send(res,200,{ok:true,review,reviewVersion:b.expectedVersion+1});
}
