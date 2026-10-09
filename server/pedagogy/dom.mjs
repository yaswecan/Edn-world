import {lessonForWork} from '../student-tracking.mjs';
import {editorCandidate} from '../lesson-editor.mjs';
import {ownedJob} from './jobs.mjs';
import {teacher,student} from '../auth.mjs';
import {scoped,requireValue,fail,uid,now} from '../store.mjs';
import {digest} from './contracts.mjs';
import {labService} from './labs.mjs';
export function domFiles(task,{reference=false}={}){
 const files=structuredClone(task.workshop.files||[]),script=files.find(f=>f.path==='main.js');
 requireValue(script,'Fichier main.js absent.');script.content=reference?task.reference:task.starter;return files;
}
export function validateDOMFiles(files){
 requireValue(Array.isArray(files)&&files.length===3&&new Set(files.map(f=>f.path)).size===3&&files.every(f=>['index.html','style.css','main.js'].includes(f.path)&&typeof f.content==='string'&&Buffer.byteLength(f.content)<=30000),'Trois fichiers attendus : index.html, style.css et main.js, 30 Ko maximum chacun.');return files;
}
export async function inspectDOMReference(task){
 try{const result=await labService('/dom',{files:validateDOMFiles(domFiles(task,{reference:true})),actions:[],tests:task.tests});return {status:result.ok?'PASS':'FAIL',evidence:JSON.stringify({runtime:result.runtime,checks:result.checks,snapshotHash:result.snapshotHash})};}
 catch(error){return {status:'NOT RUN',evidence:error.message};}
}
export function domRoutes(app,store){
 const busy=new Set();
 app.post('/api/dom/render',student,async(req,res)=>{
  const lock=`${req.user.classId}:${req.user.id}`;requireValue(!busy.has(lock),'Un atelier DOM est déjà en cours.');busy.add(lock);
  try{
   const lesson=await lessonForWork(store,req.user,req.body);
   const attempt=(await store.list('assessment_attempts',lesson.classId)).find(a=>a.learnerId===req.user.id&&a.assignmentId===lesson.assignmentId&&a.submissionId);requireValue(attempt||(await store.list('learning_reprises',lesson.classId)).some(r=>r.assignmentId===lesson.assignmentId),'Termine d’abord le diagnostic.');
   const spec=(await store.get('lesson_versions',lesson.versionId)).spec,task=spec.activities.find(a=>a.id===req.body.activityId&&a.workshop?.profile==='dom');requireValue(task,'Atelier DOM inconnu.');
   const key=digest([lesson.classId,req.user.id,lesson.assignmentId,task.id,'dom']);let session=(await store.list('lab_sessions',lesson.classId)).find(s=>s.key===key||s.learnerId===req.user.id&&s.assignmentId===lesson.assignmentId&&s.activityId===task.id&&!s.preview);
   if(!session)session=await store.insert('lab_sessions',{id:uid('dom'),key,assignmentId:lesson.assignmentId,classId:lesson.classId,learnerId:req.user.id,lessonId:lesson.id,lessonVersionId:lesson.versionId,activityId:task.id,files:domFiles(task),actions:[],snapshots:[],validations:[]});
   if(req.body.action==='stop'){session.actions=[];await store.put('lab_sessions',session);return res.json({stopped:true,files:session.files});}
   if(req.body.action==='reset'){requireValue(req.body.confirmed===true,'Confirmer la réinitialisation.');session.snapshots=[...session.snapshots,{at:now(),files:session.files}].slice(-3);session.files=domFiles(task);session.actions=[];}
   else if(req.body.files){session.files=validateDOMFiles(req.body.files);session.actions=[];}
   if(req.body.interaction){requireValue(session.actions.length<40,'Limite de 40 interactions : relancer l’aperçu.');session.actions.push(req.body.interaction);}
   // Save drafts before execution so an unavailable lab never loses edited code.
   await store.put('lab_sessions',session);
   const result=await labService('/dom',{files:session.files,actions:session.actions,...(req.body.action==='check'?{tests:task.publicTests||[]}:{})});
   if(req.body.action==='check'){
    const proof={id:uid('domproof'),at:now(),runtime:result.runtime,status:result.ok?'correct':'incorrect',checks:result.checks,snapshotHash:result.snapshotHash};session.validations=[...session.validations,proof].slice(-100);await store.put('lab_sessions',session);
    await store.insert('learning_events',{id:proof.id,classId:req.user.classId,learnerId:req.user.id,lessonRunId:lesson.runId,lessonVersionId:lesson.versionId,type:'lab_validated',activityId:task.id,payload:proof});
   }
   res.json({...result,files:session.files});
  }finally{busy.delete(lock);}
 });
 app.post('/api/lessons/:id/preview/dom',teacher,async(req,res)=>{
  const key=`teacher:${req.user.id}`;if(busy.has(key))fail(409,'Un aperçu est déjà en cours.');busy.add(key);
  try{const lesson=await scoped(store,'lessons',req.params.id,req.user);if(!req.body.editorSpec)requireValue(lesson.versionId===req.body.lessonVersionId,'Version d’aperçu modifiée.');const spec=req.body.editorSpec?(await editorCandidate(store,lesson,{spec:req.body.editorSpec,token:req.body.editorToken},req.user)).spec:(await scoped(store,'lesson_versions',lesson.versionId,req.user)).spec,task=[...spec.activities,...spec.diagnostic.tasks].find(a=>a.id===req.body.activityId&&a.workshop?.profile==='dom');requireValue(task,'Atelier inconnu.');res.json(await labService('/dom',{files:validateDOMFiles(req.body.action==='reset'?domFiles(task):req.body.files||domFiles(task)),actions:req.body.actions||[],...(req.body.action==='check'?{tests:task.tests}:{})}));}finally{busy.delete(key);}
 });
 app.post('/api/preparation/jobs/:id/dom',teacher,async(req,res)=>{
  const key=`teacher:${req.user.id}`;if(busy.has(key))fail(409,'Un aperçu est déjà en cours.');busy.add(key);
  try{const job=await ownedJob(store,req.params.id,req.user);requireValue(job.lessonId,'Brouillon absent.');const lesson=await store.get('lessons',job.lessonId),spec=(await store.get('lesson_versions',lesson.versionId)).spec,task=spec.activities.find(a=>a.id===req.body.activityId&&a.workshop?.profile==='dom');requireValue(task,'Atelier inconnu.');res.json(await labService('/dom',{files:validateDOMFiles(req.body.action==='reset'?domFiles(task):req.body.files||domFiles(task)),actions:req.body.actions||[],...(req.body.action==='check'?{tests:task.tests}:{})}));}finally{busy.delete(key);}
 });
}
