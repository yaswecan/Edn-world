import {scoped,requireValue,now,fail} from './store.mjs';
import {canonical,sha256} from './content-snapshots.mjs';
export async function saveLearningEvent(store,actor,input){return store.transaction(async tx=>{
 const lesson=await scoped(tx,'lessons',input.lessonId,actor);requireValue(lesson.status==='published','Séance non ouverte.');requireValue(!input.lessonVersionId||input.lessonVersionId===lesson.versionId,'La séance a été adaptée. Actualisez votre parcours.');const spec=(await tx.get('lesson_versions',lesson.versionId)).spec;
 requireValue(['step_started','step_completed','answer_saved','lesson_submitted','resource_opened','code_tested'].includes(input.type),'Événement invalide.');requireValue(typeof input.eventId==='string'&&input.eventId.length>0&&input.eventId.length<=100,'Identifiant d’événement invalide.');requireValue(JSON.stringify(input.payload||{}).length<=150000,'Événement trop volumineux.');
 if(input.activityId)requireValue(spec.activities.some(a=>a.id===input.activityId)||spec.blocks.some(b=>b.id===input.activityId),'Activité inconnue.');
 const eventId=`${actor.id}:${input.eventId}`,inputHash=sha256(canonical(input)),existing=await tx.get('learning_events',eventId);if(existing){if(input.type==='lesson_submitted'&&existing.inputHash&&existing.inputHash!==inputHash)fail(409,'Cet événement a déjà un autre contenu.');return existing;}
 if(input.type==='lesson_submitted'){
  requireValue(typeof input.payload?.submissionId==='string','Un reçu durable de remise est requis.');
  const receipt=await tx.get('work_submissions',input.payload?.submissionId);requireValue(receipt?.learnerId===actor.id&&receipt.classId===actor.classId&&receipt.lessonVersionId===lesson.versionId,'Un reçu durable de remise est requis.');
 }
 const event=await tx.insert('learning_events',{id:eventId,inputHash,classId:actor.classId,learnerId:actor.id,lessonId:lesson.id,lessonRunId:lesson.runId,lessonVersionId:lesson.versionId,activityId:input.activityId||null,type:input.type,payloadVersion:1,payload:input.payload||{},timestamp:now()});
 const id=`${actor.id}:${lesson.versionId}`,old=await tx.get('learning_progress',id),progress=old||{id,classId:actor.classId,learnerId:actor.id,lessonVersionId:lesson.versionId,answers:{},answerSavedAt:{},completed:[],stepId:null,version:0};
 if(input.type==='answer_saved'){requireValue(spec.activities.some(a=>a.id===input.activityId),'Réponse liée à une activité attendue.');requireValue(typeof input.payload?.answer==='string'&&input.payload.answer.length<=100000,'Réponse invalide.');progress.answers[input.activityId]=input.payload.answer;progress.answerSavedAt??={};progress.answerSavedAt[input.activityId]=event.timestamp;}
 if(input.type==='step_started')progress.stepId=input.activityId;
 if(input.type==='step_completed'&&!progress.completed.includes(input.activityId))progress.completed.push(input.activityId);
 if(input.type==='lesson_submitted')progress.submittedAt=event.timestamp;
 progress.version++;progress.savedAt=event.timestamp;if(old)await tx.put('learning_progress',progress);else await tx.insert('learning_progress',progress);return {...event,progressVersion:progress.version};
});}
