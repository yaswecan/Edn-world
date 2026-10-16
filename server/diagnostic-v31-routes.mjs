import {teacher,student} from './auth.mjs';
import {scoped,requireValue,fail,now,uid} from './store.mjs';
import {currentActor,digest} from './competency-service.mjs';
import {diagnosticSources,upgradeDiagnostic,DIAGNOSTIC_V31,requireDiagnosticV31,adjustDiagnosticTime,responseUnits,deadlinePassed} from './diagnostic-v31.mjs';
import {lessonSchema,validate} from './contracts.mjs';
import {orderAndTime} from './lesson-structure.mjs';
import {freezeContent,canonical} from './content-snapshots.mjs';
import {ownedAttempt,safeAttempt} from './student-tracking.mjs';
import {submitAttempt,reviseCorrection} from './assessment.mjs';

async function draft(tx,actor,id,input){
 const lesson=await scoped(tx,'lessons',id,actor);
 if(lesson.status!=='draft')fail(409,'Préparez une nouvelle séance : la version publiée reste conservée.');
 if(lesson.version!==input.version)fail(409,'La séance a changé. Rechargez l’aperçu.');
 if((await tx.list('assessment_attempts',actor.classId)).some(a=>a.lessonVersionId===lesson.versionId))fail(409,'Cette version a déjà été commencée.');
 if((await tx.list('generation_jobs',actor.classId)).some(j=>j.lessonId===id&&['running','queued','retry_wait'].includes(j.status)))fail(409,'Attendez la fin de la préparation.');
 return {lesson,spec:(await scoped(tx,'lesson_versions',lesson.versionId,actor)).spec};
}
async function preview(tx,actor,id,input){
 const {lesson,spec}=await draft(tx,actor,id,input),sources=await diagnosticSources(tx,actor,{date:spec.date,trackId:input.trackId||null});
 const source=input.sourceRunId?sources.candidates.find(s=>s.runId===input.sourceRunId):sources.selected;
 if(input.sourceRunId)requireValue(source,'Cette source ne contient pas d’activité réalisée éligible.');
 const diagnostic=upgradeDiagnostic(spec.diagnostic,source);
 // Changing a source never carries over an earlier confirmation.
 if(source&&digest(diagnostic.contract.source)!==digest(source)){diagnostic.contract.source=source;diagnostic.contract.sourceConfirmed=false;diagnostic.contract.reviewed=false;diagnostic.sourceLessonRunId=source.runId;diagnostic.sourceLessonVersion=source.lessonVersionId;diagnostic.kind='previous_lesson';}
 return {lessonId:id,version:lesson.version,lessonVersionId:lesson.versionId,sources,diagnostic,token:digest([lesson.versionId,source||null,spec.diagnostic])};
}

export function diagnosticV31Routes(app,store){
 const handle=fn=>async(req,res)=>res.json(await store.transaction(async tx=>{await currentActor(tx,req.user);return fn(tx,req.user,req);}));
 app.post('/api/diagnostics/lessons/:id/preview',teacher,handle((tx,a,r)=>preview(tx,a,r.params.id,r.body)));
 app.post('/api/diagnostics/lessons/:id/apply',teacher,handle(async(tx,a,r)=>{
  const input=r.body,p=await preview(tx,a,r.params.id,input);
  if(p.token!==input.token)fail(409,'La source ou le brouillon a changé. Vérifiez un nouvel aperçu.');
  requireValue(input.reason?.trim()&&input.reason.length<=2000&&input.confirmed===true,'Confirmez la source et justifiez la nouvelle version.');
  const {lesson,spec:old}=await draft(tx,a,r.params.id,input),spec=structuredClone(old),d=structuredClone(input.diagnostic);
  requireValue(d?.contract?.version===DIAGNOSTIC_V31,'Diagnostic V3.1 attendu.');
  // The client edits the tasks/rubric, never the source provenance or N.
  d.contract={...p.diagnostic.contract,sourceConfirmed:true,reviewed:true,confirmedBy:a.id,confirmedAt:now(),reason:input.reason};
  d.sourceLessonRunId=d.contract.source?.runId||null;d.sourceLessonVersion=d.contract.source?.lessonVersionId||null;d.kind='previous_lesson';
  requireDiagnosticV31(d);
  if(old.diagnostic.contract?.version===DIAGNOSTIC_V31&&digest({...old.diagnostic,contract:{...old.diagnostic.contract,confirmedAt:null}})===digest({...d,contract:{...d.contract,confirmedAt:null}}))return {...lesson,changed:false};
  spec.diagnostic=d;spec.sourceVersions.previousLessonRunId=d.sourceLessonRunId;spec.lessonVersion=lesson.version+1;
  orderAndTime(spec,old.blocks.reduce((n,b)=>n+b.minutes,0),d.duration);spec.timeline=spec.blocks.map(b=>({blockId:b.id,minutes:b.minutes}));validate(lessonSchema,spec);
  const previousVersionId=lesson.versionId;lesson.version++;lesson.versionId=`${lesson.id}:v${lesson.version}`;lesson.pedagogicalValidation=null;
  await tx.insert('lesson_versions',{id:lesson.versionId,lessonId:lesson.id,classId:a.classId,version:lesson.version,spec,previousVersionId,reason:input.reason,authorId:a.id});await tx.put('lessons',lesson);
  await freezeContent(tx,{classId:a.classId,event:'diagnostic.v31',eventId:lesson.versionId,subject:{kind:'lesson',lessonId:lesson.id,lessonVersionId:lesson.versionId},versions:{previousVersionId},files:[{path:'lesson.json',content:canonical(spec),audience:'teacher'}]});
  await tx.audit(a,'diagnostic.v31',lesson.id,{version:lesson.version,baseCount:d.contract.baseCount,sourceRunId:d.sourceLessonRunId});
  return {...lesson,changed:true,gridStatus:'Configurez la grille de cette nouvelle version avant publication.'};
 }));
 app.post('/api/diagnostics/submissions/:id/comments',teacher,async(req,res)=>{const old=await scoped(store,'corrections',req.params.id,req.user);const correction=await reviseCorrection(store,req.params.id,{...req.body,items:old.items.map(i=>({id:i.id,points:i.points,feedback:i.feedback,observedGrade:i.observedGrade??null,exempt:i.exempt,exemptionReason:i.exemptionReason})),finalize:false,reason:'Sauvegarde des commentaires'},req.user);res.json(correction);});
 app.post('/api/diagnostics/attempts/:id/time',teacher,handle(async(tx,a,r)=>safeAttempt(await adjustDiagnosticTime(tx,a,r.params.id,r.body))));
 app.get('/api/diagnostics/attempts/:id/state',student,handle(async(tx,a,r)=>safeAttempt(await ownedAttempt(tx,r.params.id,a))));
 app.post('/api/diagnostics/attempts/:id/expire',student,async(req,res)=>{
  const a=await ownedAttempt(store,req.params.id,req.user);requireValue(a.submissionId||deadlinePassed(a),'L’échéance serveur n’est pas atteinte.');
  const s=await submitAttempt(store,a.id,{},req.user,{draftVersion:a.draftVersion});res.json({submissionId:s.id,receivedAt:s.submittedAt,closure:s.closure});
 });
 app.post('/api/diagnostics/attempts/:id/recovery',teacher,handle(async(tx,a,r)=>{
  const attempt=await scoped(tx,'assessment_attempts',r.params.id,a),input=r.body;
  requireValue(attempt.submissionId&&input.reason?.trim()&&input.reason.length<=2000,'Une récupération distincte exige une copie figée et un motif.');
  requireValue(input.answers&&typeof input.answers==='object'&&!Array.isArray(input.answers)&&JSON.stringify(input.answers).length<=150000,'Récupération invalide.');
  const v=await scoped(tx,'lesson_versions',attempt.lessonVersionId,a),ids=new Set(v.spec.diagnostic.tasks.map(t=>t.id));
  requireValue(Object.entries(input.answers).every(([id,value])=>ids.has(id)&&typeof value==='string'&&value.length<=100000),'Réponses de récupération invalides.');
  requireValue(typeof input.requestId==='string'&&input.requestId.length<=200,'Clé de récupération requise.');
  const id='diagnostic-recovery:'+digest([attempt.id,input.requestId]),old=(await tx.list('content_snapshots',a.classId)).find(s=>s.manifest.eventId===id);
  const signature=digest(input.answers);if(old){requireValue(old.manifest.versions.answerHash===signature,'Cette récupération existe avec un autre contenu.');return {id:old.id,originalSubmissionId:attempt.submissionId};}
  const saved=await freezeContent(tx,{classId:a.classId,event:'diagnostic.recovery',eventId:id,subject:{kind:'diagnostic',learnerId:attempt.learnerId,attemptId:attempt.id,lessonId:attempt.lessonId,lessonVersionId:attempt.lessonVersionId},versions:{originalSubmissionId:attempt.submissionId,answerHash:signature,authorizedBy:a.id,reason:input.reason},files:[{path:'recovery.json',content:canonical(input.answers),audience:'teacher'}]});
  await tx.audit(a,'diagnostic.recovery',saved.id,{attemptId:attempt.id});return {id:saved.id,originalSubmissionId:attempt.submissionId};
 }));
 app.get('/api/diagnostics/runs/:id/questions',teacher,handle(async(tx,a,r)=>{
  await scoped(tx,'lesson_runs',r.params.id,a);const rows=[];
  for(const attempt of (await tx.list('assessment_attempts',a.classId)).filter(t=>t.runId===r.params.id&&t.submissionId)){
   const s=await scoped(tx,'submissions',attempt.submissionId,a),c=await scoped(tx,'corrections',s.id,a),learner=await tx.get('learners',attempt.learnerId);
   rows.push({attemptId:attempt.id,submissionId:s.id,learnerId:attempt.learnerId,displayName:learner?.displayName,correction:c,units:responseUnits(s.diagnostic,attempt.id,s.lessonVersionId,s.answers),diagnostic:s.diagnostic});
  }return {rows};
 }));
 app.get('/api/diagnostics/runs/:id/metrics',teacher,handle(async(tx,a,r)=>{
  await scoped(tx,'lesson_runs',r.params.id,a);const rows=[];
  for(const attempt of (await tx.list('assessment_attempts',a.classId)).filter(t=>t.runId===r.params.id&&t.mode!=='practice')){
   const s=attempt.submissionId?await tx.get('submissions',attempt.submissionId):null,closed=s?.closedAt||s?.submittedAt;
   rows.push({attemptId:attempt.id,closure:s?.closure||'not_submitted',durationMinutes:closed&&attempt.timing?.startedAt?Math.round((Date.parse(closed)-Date.parse(attempt.timing.startedAt))/6000)/10:null,notAddressed:Object.values(s?.answerStates||{}).filter(v=>['not_addressed','time_limit'].includes(v)).length,technicalIncidents:(attempt.history||[]).filter(e=>e.payload?.result?.status==='technical_incident').length,accommodated:!!attempt.timing?.history?.length});
  }return {scope:'Indicateurs de conception de cette occurrence ; aucun niveau de compétence déduit.',calibration:'Temps réel en classe à analyser après usage autorisé.',rows};
 }));
}
