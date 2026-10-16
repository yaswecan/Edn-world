import {labContext,checkDiagnosticLab,saveDiagnosticLabFiles,reserveDiagnosticLabCapture} from './lab-context.mjs';
import {lessonForWork,assignmentAccess,assertWritable} from '../student-tracking.mjs';
import {editorCandidate} from '../lesson-editor.mjs';
import {student,teacher,loggedIn} from '../auth.mjs';
import {ownedJob} from './jobs.mjs';
import {resolve} from 'node:path';
import {scoped,requireValue,fail,uid,now} from '../store.mjs';
import {digest} from './contracts.mjs';
export const labService=async(path,body)=>{
 if(!process.env.EDEN_LAB_URL||!process.env.EDEN_LAB_TOKEN)fail(503,'Laboratoire indisponible. Aucune commande exécutée et aucune compétence évaluée.');
 const expected=process.env[path==='/dom'?'EDEN_LAB_DOM_IMAGE':'EDEN_LAB_SHELL_IMAGE'];requireValue(/^(?:sha256:|[^\s]+@sha256:)[a-f0-9]{64}$/.test(expected||''),'Empreinte de l’image du laboratoire non configurée.');
 const url=new URL(process.env.EDEN_LAB_URL);requireValue(url.protocol==='https:'||['127.0.0.1','localhost'].includes(url.hostname),'Le laboratoire distant exige HTTPS.');
 const r=await fetch(new URL(path,url),{method:'POST',headers:{Authorization:`Bearer ${process.env.EDEN_LAB_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
 if(!r.ok)fail(503,`Incident technique du laboratoire (${r.status}) ; résultat pédagogique non évalué.`);const result=await r.json();requireValue(JSON.stringify(result).length<=2000000,'Réponse du laboratoire trop volumineuse.');if(['/dom','/reference','/sessions'].includes(path)||path.endsWith('/check'))requireValue(typeof result.runtime==='string','Version du laboratoire absente de la preuve.');if(result.runtime)requireValue(result.runtime===expected||result.runtime.startsWith(expected+' '),'L’image active du laboratoire ne correspond pas à la version attendue.');return result;
};
const service=labService;
async function owned(store,id,actor){const session=await store.get('lab_sessions',id);if(!session||session.learnerId!==actor.id)fail(403,'Laboratoire d’un autre utilisateur.');if(session.preview){requireValue(actor.role==='teacher','Aperçu réservé au professeur.');if(session.jobId)await ownedJob(store,session.jobId,actor);else{const lesson=await scoped(store,'lessons',session.lessonId,actor);requireValue(session.editorPreview||lesson.versionId===session.lessonVersionId,'La séance a changé. Rechargez l’aperçu.');}}else{requireValue(actor.role==='student','Laboratoire élève requis.');if(session.attemptId)await checkDiagnosticLab(store,actor,session);else await lessonForWork(store,actor,{lessonId:session.lessonId,lessonVersionId:session.lessonVersionId,assignmentId:session.assignmentId});}requireValue(session.runtime===process.env.EDEN_LAB_SHELL_IMAGE,'Le runtime a changé : reconnectez le laboratoire.');return session;}
export async function inspectLabReferences(spec){
 const evidence={};for(const task of spec.activities.filter(a=>['shell-git','dom'].includes(a.workshop?.profile))){
  if(task.workshop.profile==='dom'){const {inspectDOMReference}=await import('./dom.mjs');evidence[task.id]=await inspectDOMReference(task);continue;}
  try{const result=await service('/reference',{files:task.workshop.files||[],code:task.reference,tests:task.tests});evidence[task.id]={status:result.ok?'PASS':'FAIL',evidence:JSON.stringify({runtime:result.runtime,checks:result.checks,snapshotHash:result.snapshotHash})};}
  catch(error){evidence[task.id]={status:'NOT RUN',evidence:error.message};}
 }return evidence;
}
async function checkpoint(store,actor,session){
 if(!session.attemptId)return;
 const order=await reserveDiagnosticLabCapture(store,actor,session),snapshot=await service(`/sessions/${session.remoteId}/snapshot`,{});await saveDiagnosticLabFiles(store,actor,session,snapshot.files||[],order);session.checkpointAt=now();await store.put('lab_sessions',session);
}
export function labRoutes(app,store){
 app.get('/vendor/xterm.js',loggedIn,(_req,res)=>res.sendFile(resolve('node_modules/@xterm/xterm/lib/xterm.js')));
 app.get('/vendor/xterm.css',loggedIn,(_req,res)=>res.sendFile(resolve('node_modules/@xterm/xterm/css/xterm.css')));
 app.post('/api/preparation/jobs/:id/lab',teacher,async(req,res)=>{
  const job=await ownedJob(store,req.params.id,req.user);requireValue(job.lessonVersionId,'Aperçu indisponible.');
  requireValue(!req.body.lessonVersionId||req.body.lessonVersionId===job.lessonVersionId,'Version d’aperçu modifiée.');
  const spec=(await scoped(store,'lesson_versions',job.lessonVersionId,req.user)).spec,task=spec.activities.find(a=>a.id===req.body.activityId&&a.workshop?.profile==='shell-git');requireValue(task,'Atelier inconnu.');
  const key=digest(['teacher-preview',req.user.classId,req.user.id,job.id,job.lessonVersionId,task.id]),remote=await service('/sessions',{key,files:task.workshop.files||[],profile:'shell-git'});
  const session=await store.transaction(async tx=>{const old=(await tx.list('lab_sessions',req.user.classId)).find(s=>s.key===key);return old||tx.insert('lab_sessions',{id:uid('previewlab'),classId:req.user.classId,learnerId:req.user.id,preview:true,jobId:job.id,lessonId:job.lessonId,lessonVersionId:job.lessonVersionId,activityId:task.id,key,remoteId:remote.id,runtime:remote.runtime,snapshots:[],validations:[]});});res.json({id:session.id,status:'connected',preview:true});
 });
 app.post('/api/lessons/:id/preview/lab',teacher,async(req,res)=>{
  const lesson=await scoped(store,'lessons',req.params.id,req.user);if(!req.body.editorSpec)requireValue(req.body.lessonVersionId===lesson.versionId,'Version d’aperçu modifiée.');
  const spec=req.body.editorSpec?(await editorCandidate(store,lesson,{spec:req.body.editorSpec,token:req.body.editorToken},req.user)).spec:(await scoped(store,'lesson_versions',lesson.versionId,req.user)).spec,task=[...spec.activities,...spec.diagnostic.tasks].find(a=>a.id===req.body.activityId&&a.workshop?.profile==='shell-git');requireValue(task,'Atelier inconnu.');
  const key=digest(['teacher-preview',req.user.classId,req.user.id,lesson.versionId,task.id,...(req.body.editorSpec?[task]:[])]),remote=await service('/sessions',{key,files:task.workshop.files||[],profile:'shell-git'});
  const session=await store.transaction(async tx=>{const current=await scoped(tx,'lessons',lesson.id,req.user);requireValue(req.body.editorSpec||current.versionId===lesson.versionId,'Version d’aperçu modifiée.');return (await tx.list('lab_sessions',req.user.classId)).find(s=>s.key===key)||tx.insert('lab_sessions',{id:uid('previewlab'),classId:req.user.classId,learnerId:req.user.id,preview:true,editorPreview:!!req.body.editorSpec,...(req.body.editorSpec?{editorTask:task}:{}),lessonId:lesson.id,lessonVersionId:lesson.versionId,activityId:task.id,key,remoteId:remote.id,runtime:remote.runtime,snapshots:[],validations:[]});});res.json({id:session.id,status:'connected',preview:true});
 });
 app.post('/api/labs',student,async(req,res)=>{
  const {lesson,task,attemptId}=await labContext(store,req.user,req.body,'shell-git');
  const prior=(await store.list('lab_sessions',lesson.classId)).find(s=>s.learnerId===req.user.id&&s.assignmentId===lesson.assignmentId&&s.activityId===task.id&&!s.preview&&(s.attemptId||null)===attemptId);
  const key=prior?.key||digest([lesson.classId,req.user.id,lesson.assignmentId,task.id,attemptId]),remote=await service('/sessions',{key,files:task.workshop.files||[],profile:'shell-git'});
  const session=await store.transaction(async tx=>{if(attemptId)await checkDiagnosticLab(tx,req.user,{attemptId});const old=(await tx.list('lab_sessions',lesson.classId)).find(s=>s.key===key);if(old){old.runtime=remote.runtime;return tx.put('lab_sessions',old);}return tx.insert('lab_sessions',{id:uid('lab'),attemptId,assignmentId:lesson.assignmentId,classId:lesson.classId,learnerId:req.user.id,lessonId:lesson.id,lessonVersionId:lesson.versionId,activityId:task.id,key,remoteId:remote.id,runtime:remote.runtime,snapshots:[],validations:[]});});await checkpoint(store,req.user,session);res.json({id:session.id,status:'connected'});
 });
 app.post('/api/labs/:id/io',loggedIn,async(req,res)=>{const session=await owned(store,req.params.id,req.user),input=req.body;
  requireValue(typeof input.input==='string'&&input.input.length<=8192&&Number.isInteger(input.cursor)&&input.cursor>=0,'Entrée terminal invalide.');
  const result=await service(`/sessions/${session.remoteId}/io`,{input:input.input,cursor:input.cursor,cols:Math.max(20,Math.min(200,Number(input.cols)||80)),rows:Math.max(5,Math.min(80,Number(input.rows)||24))});await checkDiagnosticLab(store,req.user,session);if(session.attemptId&&(input.input||Date.now()-Date.parse(session.checkpointAt||0)>5000))await checkpoint(store,req.user,session);res.json(result);
 });
 app.post('/api/labs/:id/files',loggedIn,async(req,res)=>{const session=await owned(store,req.params.id,req.user);requireValue(['list','write'].includes(req.body.action),'Action fichier invalide.');const result=await service(`/sessions/${session.remoteId}/files`,{action:req.body.action,path:req.body.path,content:req.body.content});await checkDiagnosticLab(store,req.user,session);await checkpoint(store,req.user,session);res.json(result);});
 app.post('/api/labs/:id/check',loggedIn,async(req,res)=>{
  const session=await owned(store,req.params.id,req.user),spec=(await store.get('lesson_versions',session.lessonVersionId)).spec,task=session.editorTask||[...spec.activities,...spec.diagnostic.tasks].find(a=>a.id===session.activityId);
  const result=await service(`/sessions/${session.remoteId}/check`,{tests:session.preview?task.tests:task.publicTests||[]});
  await checkDiagnosticLab(store,req.user,session);await checkpoint(store,req.user,session);
  const evidence={id:uid('labproof'),at:now(),runtime:result.runtime,status:result.ok?'correct':'incorrect',checks:result.checks,snapshotHash:result.snapshotHash};
  session.validations.push(evidence);session.validations=session.validations.slice(-100);await store.put('lab_sessions',session);
  if(!session.preview&&!session.attemptId)await store.insert('learning_events',{id:evidence.id,classId:req.user.classId,learnerId:req.user.id,lessonRunId:(await store.get('lessons',session.lessonId)).runId,lessonVersionId:session.lessonVersionId,type:'lab_validated',activityId:task.id,payload:evidence});res.json({ok:result.ok,checks:result.checks});
 });
 app.post('/api/labs/:id/reset',loggedIn,async(req,res)=>{const session=await owned(store,req.params.id,req.user);requireValue(req.body.confirmed===true,'Confirmez la réinitialisation ; une sauvegarde sera conservée.');const snapshot=await service(`/sessions/${session.remoteId}/snapshot`,{});await checkDiagnosticLab(store,req.user,session);session.snapshots.push({at:now(),snapshot});session.snapshots=session.snapshots.slice(-3);await store.put('lab_sessions',session);const result=await service(`/sessions/${session.remoteId}/reset`,{});await checkpoint(store,req.user,session);res.json(result);});
}
