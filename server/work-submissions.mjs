import {findAssignment,assertWritable,assignmentAccess} from './student-tracking.mjs';
import {uid,now,scoped,requireValue,fail} from './store.mjs';
import {freezeContent,canonical,sha256,safeContentPath,snapshotView,preserveOriginal} from './content-snapshots.mjs';
import {labService} from './pedagogy/labs.mjs';
import {student,teacher} from './auth.mjs';
import {artifactBuffer} from './artifacts.mjs';
import {validateDOMFiles} from './pedagogy/dom.mjs';

const receipt=s=>({id:s.id,submissionId:s.id,snapshotId:s.snapshotId,sha256:s.sha256,receivedAt:s.acceptedAt,lessonVersionId:s.lessonVersionId});
export async function submitWork(store,actor,input,{laboratory=labService}={}){
 requireValue(actor.role==='student','Remise réservée à l’élève.');
 requireValue(typeof input.requestId==='string'&&/^[\w-]{8,100}$/.test(input.requestId),'Identité de remise invalide.');
 requireValue(input.answers&&typeof input.answers==='object'&&!Array.isArray(input.answers)&&JSON.stringify(input.answers).length<=150000,'Réponses invalides.');
 const id='work_'+sha256(actor.id+'\0'+input.requestId),requestHash=sha256(canonical({assignmentId:input.assignmentId||null,lessonId:input.lessonId,lessonVersionId:input.lessonVersionId,answers:input.answers}));
 const existing=await store.get('work_submissions',id);
 if(existing){await ownedWork(store,id,actor);if(existing.requestHash!==requestHash)fail(409,'Cette demande a déjà remis un autre état. Créez une nouvelle remise.');return receipt(existing);}
 const assignment=await findAssignment(store,actor,input);await assertWritable(store,assignment);actor={...actor,classId:assignment.classId};
 const lesson={id:assignment.lessonId,versionId:assignment.lessonVersionId};
 const prior=(await store.list('work_submissions',actor.classId)).find(s=>s.assignmentId===assignment.id);if(prior)return receipt(prior);
 const lv=await scoped(store,'lesson_versions',lesson.versionId,actor),spec=lv.spec;
 const attempt=(await store.list('assessment_attempts',actor.classId)).filter(a=>a.learnerId===actor.id&&a.assignmentId===assignment.id&&a.mode!=='practice').at(-1);
 requireValue(attempt?.submissionId||(await store.list('learning_reprises',actor.classId)).some(r=>r.assignmentId===assignment.id),'Terminez le diagnostic avant la remise de séance.');
 const known=new Set([...spec.activities,...spec.diagnostic.tasks].map(a=>a.id));
 requireValue(Object.entries(input.answers).every(([id,answer])=>known.has(id)&&typeof answer==='string'&&answer.length<=100000),'Réponse hors activité ou trop volumineuse.');
 const answers=Object.fromEntries(spec.activities.filter(a=>Object.hasOwn(input.answers,a.id)).map(a=>[a.id,input.answers[a.id]]));
 const completedActivityIds=spec.activities.filter(a=>typeof answers[a.id]==='string'&&answers[a.id].trim()).map(a=>a.id);
 const files=[{path:'answers.json',content:canonical(answers),audience:'student'}],external=[];
 for(const a of spec.activities){
  const prefix='activities/'+sha256(a.id).slice(0,20);
  if(a.workshop?.profile==='shell-git'){
   const session=(await store.list('lab_sessions',actor.classId)).find(s=>s.learnerId===actor.id&&s.assignmentId===assignment.id&&s.lessonVersionId===lesson.versionId&&s.activityId===a.id&&!s.preview);
   if(!session){requireValue(!a.required,`Remise incomplète : laboratoire de « ${a.title} » non sauvegardé.`);continue;}
   const state=await laboratory(`/sessions/${session.remoteId}/snapshot`,{});
   requireValue(Array.isArray(state.files)&&state.files.length<=1000,'Instantané de laboratoire invalide.');
   let total=0;const included=[];
   for(const f of state.files){
    // Never project the learner's Git configuration, hooks, filters or secrets.
    if(f.path?.split('/').some(p=>/^\.git|^\.env(?:\.|$)/i.test(p)))continue;
    safeContentPath(f.path);requireValue(typeof f.base64==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(f.base64),'Fichier de laboratoire invalide.');
    const bytes=Buffer.from(f.base64,'base64');total+=bytes.length;requireValue(total<=512000,'Instantané de laboratoire trop volumineux.');
    const path=`${prefix}/${f.path}`,object=await preserveOriginal(store,bytes);external.push({path,audience:'student',...object});included.push({path:f.path,sha256:object.sha256,bytes:object.bytes});
    const text=bytes.toString('utf8');if(!text.includes('\0')&&Buffer.from(text).equals(bytes))files.push({path,content:text,audience:'student'});
   }
   if(included.length)completedActivityIds.push(a.id);
   files.push({path:`${prefix}/lab-evidence.json`,content:canonical({activityId:a.id,runtime:session.runtime,capturedAt:now(),files:included,studentGit:{tracked:state.tracked||[],committed:state.committed||[]},validation:'NOT RUN',automaticArchiveIsNotStudentCommit:true}),audience:'student'});
  }else if(a.workshop?.profile==='dom'){
   let selected;if(Object.hasOwn(answers,a.id)){try{selected=JSON.parse(answers[a.id]).files;}catch{fail(400,'Projet DOM illisible : remise non confirmée.');}}
   // The browser transmits unsaved files explicitly. Never substitute an older
   // session for a current editor revision that was not acknowledged.
   requireValue(selected||!a.required,`Remise incomplète : fichiers actuels de « ${a.title} » absents.`);
   if(selected)for(const f of validateDOMFiles(selected))files.push({path:`${prefix}/${f.path}`,content:f.content,audience:'student'});
  }else if(a.type==='CodeEditor'&&Object.hasOwn(answers,a.id)){
   const filename={html:'index.html',css:'style.css',javascript:'main.js',sql:'query.sql'}[a.workshop?.language]||'answer.txt';
   files.push({path:`${prefix}/${filename}`,content:answers[a.id],audience:'student'});
   if(a.workshop?.language==='css'&&a.workshop.document)files.push({path:`${prefix}/index.html`,content:a.workshop.document,audience:'student'});
  }
 }
 return store.transaction(async tx=>{
  const previous=await tx.get('work_submissions',id);if(previous){if(previous.requestHash!==requestHash)fail(409,'Demande déjà utilisée.');return receipt(previous);}
  await assertWritable(tx,await assignmentAccess(tx,assignment.id,actor));
  const already=(await tx.list('work_submissions',actor.classId)).find(s=>s.assignmentId===assignment.id);if(already)return receipt(already);
  const latest=await tx.get('learning_progress',assignment.progressId||`${actor.id}:${lv.id}`);if(input.progressVersion!==(latest?.version||0))fail(409,'Le travail a changé dans un autre onglet. Rechargez avant la remise.');
  const acceptedAt=now(),snapshot=await freezeContent(tx,{classId:actor.classId,event:'work.submitted',eventId:id,acceptedAt,subject:{kind:'work',learnerId:actor.id,lessonId:lesson.id,lessonVersionId:lv.id},versions:{lessonHash:sha256(canonical(spec)),criteria:sha256(canonical(spec.activities.map(a=>({id:a.id,tests:a.tests,checks:a.workshop?.checks})))),validator:'eden-workshop-1',validation:'NOT RUN',workRevision:requestHash,activities:spec.activities.map(a=>({id:a.id,title:a.title,folder:'activities/'+sha256(a.id).slice(0,20)}))},files,external});
  const submitted=await tx.insert('work_submissions',{id,classId:actor.classId,learnerId:actor.id,lessonId:lesson.id,assignmentId:assignment.id,completedActivityIds:[...new Set([...completedActivityIds,...(latest?.completed||[]).filter(id=>spec.activities.some(a=>a.id===id))])],lessonVersionId:lv.id,requestHash,requestId:input.requestId,snapshotId:snapshot.id,sha256:snapshot.sha256,acceptedAt});
  const progressId=assignment.progressId||`${actor.id}:${lv.id}`,progress=await tx.get('learning_progress',progressId);if(progress){progress.submittedAt=acceptedAt;await tx.put('learning_progress',progress);}
  await tx.audit(actor,'work.submitted',id,{snapshotId:snapshot.id,sha256:snapshot.sha256});return receipt(submitted);
 });
}
async function ownedWork(store,id,actor){const s=await store.get('work_submissions',id);if(!s||s.learnerId!==actor.id)fail(404,'Remise introuvable.');if(s.assignmentId)await assignmentAccess(store,s.assignmentId,actor);else await findAssignment(store,actor,{lessonId:s.lessonId,lessonVersionId:s.lessonVersionId});return s;}
export function workSubmissionRoutes(app,store){
 app.post('/api/lessons/:id/work/submit',student,async(req,res)=>res.json(await submitWork(store,req.user,{...req.body,lessonId:req.params.id})));
 app.get('/api/work-submissions',student,async(req,res)=>{const rows=[];for(const s of await store.list('work_submissions'))if(s.learnerId===req.user.id){try{await ownedWork(store,s.id,req.user);rows.push(receipt(s));}catch(e){if(e.status!==404)throw e;}}res.json(rows);});
 app.get('/api/work-submissions/:id',student,async(req,res)=>{const s=await ownedWork(store,req.params.id,req.user);res.json({receipt:receipt(s),snapshot:await snapshotView(store,s.snapshotId,{...req.user,classId:s.classId})});});
 app.get('/api/work-submissions/:id/file',student,async(req,res)=>{const s=await ownedWork(store,req.params.id,req.user);const snapshot=await scoped(store,'content_snapshots',s.snapshotId,{...req.user,classId:s.classId}),file=snapshot.externalObjects?.find(f=>f.path===req.query.path&&f.audience==='student');requireValue(file,'Fichier absent de la remise.');res.type('application/octet-stream').attachment(file.path.split('/').at(-1)).send(await artifactBuffer(file));});
 app.get('/api/teacher/work-submissions',teacher,async(req,res)=>res.json(await store.list('work_submissions',req.user.classId)));
 app.get('/api/teacher/work-submissions/:id',teacher,async(req,res)=>{const s=await scoped(store,'work_submissions',req.params.id,req.user);res.json({receipt:receipt(s),snapshot:await snapshotView(store,s.snapshotId,{...req.user,classId:s.classId})});});
}
