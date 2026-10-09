import {assignRun} from '../../server/student-tracking.mjs';
// Explicit synthetic distribution for older domain fixtures which bypass publishLesson.
export async function grantFixture(store,lesson,learner){return store.transaction(async tx=>{
 if(!await tx.get('learners',learner.id))await tx.insert('learners',learner);
 const runId=lesson.runId||'fixture-run:'+lesson.id;
 let run=await tx.get('lesson_runs',runId);if(!run)run=await tx.insert('lesson_runs',{id:runId,classId:lesson.classId,lessonId:lesson.id,lessonVersionId:lesson.versionId,date:lesson.date,status:'planned',closedAt:null});
 const a=await assignRun(tx,run,learner,{provenance:'legacy-stable-id'});
 for(const attempt of (await tx.list('assessment_attempts',lesson.classId)).filter(t=>t.learnerId===learner.id&&t.lessonVersionId===lesson.versionId&&!t.assignmentId))await tx.put('assessment_attempts',{...attempt,lessonId:lesson.id,runId,assignmentId:a.id,draftVersion:0});
 return a;
});}
