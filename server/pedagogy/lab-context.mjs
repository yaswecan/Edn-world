import {currentActor} from '../competency-service.mjs';
import {ownedAttempt,lessonForWork} from '../student-tracking.mjs';
import {requireValue,now} from '../store.mjs';

// Diagnostics reuse the existing engines, but are scoped to their own attempt.
export async function labContext(store,actor,input,profile){
 await currentActor(store,actor);
 if(input.attemptId){
  const attempt=await ownedAttempt(store,input.attemptId,actor),v=await store.get('lesson_versions',attempt.lessonVersionId),task=v.spec.diagnostic.tasks.find(t=>t.id===input.activityId&&t.workshop?.profile===profile);
  if(task){
   requireValue(attempt.assignmentId===input.assignmentId&&attempt.lessonVersionId===input.lessonVersionId&&attempt.lessonId===input.lessonId,'Le laboratoire appartient à une autre copie.');
   await ownedAttempt(store,attempt.id,actor,{write:true});
   return {task,attemptId:attempt.id,lesson:{id:attempt.lessonId,classId:attempt.classId,versionId:attempt.lessonVersionId,runId:attempt.runId,assignmentId:attempt.assignmentId}};
  }
 }
 const lesson=await lessonForWork(store,actor,input),spec=(await store.get('lesson_versions',lesson.versionId)).spec,task=spec.activities.find(t=>t.id===input.activityId&&t.workshop?.profile===profile);requireValue(task,'Atelier inconnu.');
 const submitted=(await store.list('assessment_attempts',lesson.classId)).some(a=>a.learnerId===actor.id&&a.assignmentId===lesson.assignmentId&&a.submissionId);
 requireValue(submitted||(await store.list('learning_reprises',lesson.classId)).some(r=>r.assignmentId===lesson.assignmentId),'Termine d’abord le diagnostic.');return {task,lesson,attemptId:null};
}

export async function checkDiagnosticLab(store,actor,session){
 await currentActor(store,actor);
 if(session.attemptId)return ownedAttempt(store,session.attemptId,actor,{write:true});
}

export async function reserveDiagnosticLabCapture(store,actor,session){
 return store.transaction(async tx=>{const a=await checkDiagnosticLab(tx,actor,session);a.labSequence=(a.labSequence||0)+1;await tx.put('assessment_attempts',a);return a.labSequence;});
}

export async function saveDiagnosticLabFiles(store,actor,session,files,order=null){
 if(!session.attemptId)return;
 const safe=files.filter(f=>typeof f.path==='string'&&!f.path.split('/').some(p=>p==='..'||p==='.git')&&!f.path.startsWith('/')).map(f=>({path:f.path,content:typeof f.content==='string'?f.content:Buffer.from(f.base64||'','base64').toString('utf8')}));
 requireValue(safe.length<=100&&JSON.stringify(safe).length<=90000,'Fichiers du diagnostic trop volumineux ; conservez une récupération séparée.');
 await store.transaction(async tx=>{const a=await checkDiagnosticLab(tx,actor,session);if(order&&a.labResponses?.[session.activityId]?.order>=order)return;if(!order){a.labSequence=(a.labSequence||0)+1;order=a.labSequence;}const saved={...a.labResponses,[session.activityId]:{files:safe,capturedAt:now(),order}};requireValue(JSON.stringify(saved).length<=140000,'Ensemble des fichiers du diagnostic trop volumineux.');a.labResponses=saved;await tx.put('assessment_attempts',a);});
}
