import {findAssignment,assertWritable} from './student-tracking.mjs';
import {scoped,requireValue,now,fail} from './store.mjs';
import {canonical,sha256} from './content-snapshots.mjs';
export async function saveLearningEvent(store,actor,input){return store.transaction(async tx=>{
 const assignment=await findAssignment(tx,actor,input);await assertWritable(tx,assignment);
 const lesson={id:assignment.lessonId,runId:assignment.runId,versionId:assignment.lessonVersionId},spec=(await tx.get('lesson_versions',assignment.lessonVersionId)).spec;
 actor={...actor,classId:assignment.classId};
 requireValue(['step_started','step_completed','answer_saved','lesson_submitted','resource_opened','code_tested'].includes(input.type),'Événement invalide.');requireValue(typeof input.eventId==='string'&&input.eventId.length>0&&input.eventId.length<=100,'Identifiant d’événement invalide.');requireValue(JSON.stringify(input.payload||{}).length<=150000,'Événement trop volumineux.');
 if(input.activityId)requireValue(spec.activities.some(a=>a.id===input.activityId)||spec.blocks.some(b=>b.id===input.activityId),'Activité inconnue.');
 const eventId=`${actor.id}:${input.eventId}`,inputHash=sha256(canonical(input)),existing=await tx.get('learning_events',eventId);if(existing){if(existing.inputHash&&existing.inputHash!==inputHash)fail(409,'Cet événement a déjà un autre contenu.');return existing;}
 if(input.type==='lesson_submitted'){
  requireValue(typeof input.payload?.submissionId==='string','Un reçu durable de remise est requis.');
  const receipt=await tx.get('work_submissions',input.payload?.submissionId);requireValue(receipt?.learnerId===actor.id&&receipt.assignmentId===assignment.id,'Un reçu durable de remise est requis.');
 }
 const event=await tx.insert('learning_events',{id:eventId,inputHash,classId:actor.classId,learnerId:actor.id,lessonId:lesson.id,lessonRunId:lesson.runId,lessonVersionId:lesson.versionId,assignmentId:assignment.id,activityId:input.activityId||null,type:input.type,payloadVersion:1,payload:input.payload||{},timestamp:now()});
 const id=assignment.progressId||`${actor.id}:${lesson.versionId}`,old=await tx.get('learning_progress',id),progress=old||{id,classId:actor.classId,learnerId:actor.id,assignmentId:assignment.id,lessonId:lesson.id,runId:lesson.runId,lessonVersionId:lesson.versionId,answers:{},answerSavedAt:{},completed:[],stepId:null,version:0};
 if(input.type==='answer_saved'){if(progress.submittedAt||(await tx.list('work_submissions',actor.classId)).some(s=>s.assignmentId===assignment.id))fail(409,'Le travail a déjà été remis.');if(input.progressVersion!==progress.version)fail(409,'Le travail a changé dans un autre onglet. Rechargez avant de réessayer.');requireValue(spec.activities.some(a=>a.id===input.activityId),'Réponse liée à une activité attendue.');requireValue(typeof input.payload?.answer==='string'&&input.payload.answer.length<=100000,'Réponse invalide.');progress.answers[input.activityId]=input.payload.answer;progress.answerSavedAt??={};progress.answerSavedAt[input.activityId]=event.timestamp;}
 if(input.type==='step_started')progress.stepId=input.activityId;
 if(input.type==='step_completed'&&!progress.completed.includes(input.activityId)){const task=spec.activities.find(a=>a.id===input.activityId);if(task&&!['Preview','FileExplorer','CodeStationLauncher','Blackboard'].includes(task.type))requireValue(typeof progress.answers?.[task.id]==='string'&&progress.answers[task.id].trim(),'Enregistre une réponse avant de terminer cette activité.');progress.completed.push(input.activityId);}
 if(input.type==='lesson_submitted')progress.submittedAt=event.timestamp;
 if(input.type!=='code_tested')progress.version++;progress.savedAt=event.timestamp;if(old)await tx.put('learning_progress',progress);else await tx.insert('learning_progress',progress);event.progressVersion=progress.version;await tx.put('learning_events',event);return event;
});}
