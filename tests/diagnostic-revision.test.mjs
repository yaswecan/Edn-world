import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticRevisionFixture} from './fixtures/diagnostic-revision.mjs';
import {reviseDiagnostic} from '../server/diagnostic-revision.mjs';
import {DIAGNOSTIC_POLICY} from '../server/diagnostic-practice.mjs';
import {diagnosticChecks} from '../server/diagnostic.mjs';

test('reinforcing a draft creates an immutable version with the same lesson duration, without approving or publishing it',async()=>{
 const {store,actor,lesson,spec}=await diagnosticRevisionFixture();try{
  const old=await store.get('lesson_versions',lesson.versionId);
  const revised=await reviseDiagnostic(store,lesson.id,{version:1},actor),version=await store.get('lesson_versions',revised.versionId);
  assert.equal(revised.changed,true);assert.equal(revised.version,2);assert.equal(revised.status,'draft');assert.equal(revised.pedagogicalValidation,null);assert.equal(revised.quality.publishable,false);
  assert.deepEqual(await store.get('lesson_versions',lesson.versionId),old);
  const content=activities=>activities.map(({duration,...a})=>a);
  assert.deepEqual(content(version.spec.activities),content(spec.activities));assert.equal(version.previousVersionId,lesson.versionId);
  assert.equal(version.spec.blocks.reduce((n,b)=>n+b.minutes,0),spec.blocks.reduce((n,b)=>n+b.minutes,0));
  assert.equal(version.spec.diagnostic.policyVersion,DIAGNOSTIC_POLICY);assert.equal(version.spec.diagnostic.duration,20);
  assert.deepEqual(diagnosticChecks(version.spec).filter(c=>!c.ok),[]);
  const snapshot=(await store.list('content_snapshots'))[0];assert.equal(snapshot.manifest.event,'diagnostic.revised');assert.equal(snapshot.manifest.subject.lessonVersionId,version.id);
  assert.equal(JSON.parse(snapshot.files[0].content).diagnostic.policyVersion,DIAGNOSTIC_POLICY);
  assert.equal((await store.list('audit_log')).at(-1).action,'diagnostic.revised');
  assert.equal((await reviseDiagnostic(store,lesson.id,{version:2},actor)).changed,false);
  assert.equal((await store.list('lesson_versions')).length,2);
  assert.equal((await store.list('generation_calls')).length,0);assert.equal((await store.list('assessment_attempts')).length,0);
 }finally{await store.close();}
});

test('reinforcement rejects stale versions, another class, active preparation, published lessons and existing learner work',async()=>{
 const {store,actor,lesson}=await diagnosticRevisionFixture();try{
  await assert.rejects(reviseDiagnostic(store,lesson.id,{version:0},actor),/version du brouillon/);
  await assert.rejects(reviseDiagnostic(store,lesson.id,{version:1},{...actor,classId:'OTHER'}),{status:404});
  const job=await store.insert('generation_jobs',{id:'active',lessonId:lesson.id,classId:actor.classId,status:'queued'});
  await assert.rejects(reviseDiagnostic(store,lesson.id,{version:1},actor),/encore en cours/);job.status='cancelled';await store.put('generation_jobs',job);
  lesson.status='published';await store.put('lessons',lesson);await assert.rejects(reviseDiagnostic(store,lesson.id,{version:1},actor),/publiée/);
  lesson.status='draft';await store.put('lessons',lesson);await store.insert('assessment_attempts',{id:'started',lessonId:lesson.id,classId:actor.classId,lessonVersionId:lesson.versionId});
  await assert.rejects(reviseDiagnostic(store,lesson.id,{version:1},actor),/déjà commencé/);
  assert.equal((await store.list('lesson_versions')).length,1);assert.equal((await store.list('content_snapshots')).length,0);
 }finally{await store.close();}
});

test('reinforcement preserves the exact previously taught source and excludes untaught tasks',async()=>{
 const {store,actor,lesson,spec}=await diagnosticRevisionFixture();try{
  const source=structuredClone(spec);source.activities=spec.activities.filter(a=>a.id==='guided');
  await store.insert('lesson_versions',{id:'previous:v1',lessonId:'previous',classId:actor.classId,version:1,spec:source});
  const previous=await store.insert('lesson_runs',{id:'real-run',classId:actor.classId,lessonVersionId:'previous:v1',status:'completed',date:'2026-10-01',coveredSkills:source.skills,reactivatedPrerequisites:[],coveredActivityIds:['guided'],coveredContent:'Une carte et ses bordures.'});
  const old=await store.get('lesson_versions',lesson.versionId);Object.assign(old.spec.diagnostic,{kind:'previous_lesson',sourceLessonRunId:previous.id,sourceLessonVersion:previous.lessonVersionId});await store.put('lesson_versions',old);
  const revised=await reviseDiagnostic(store,lesson.id,{version:1},actor),d=(await store.get('lesson_versions',revised.versionId)).spec.diagnostic;
  assert.equal(d.sourceLessonRunId,previous.id);assert.equal(d.sourceLessonVersion,'previous:v1');assert.equal(d.tasks.length,2);
  assert.equal(d.tasks[0].type,'CodeEditor');assert.equal(d.tasks[0].starter,source.activities[0].starter);assert.deepEqual(d.criteria,source.skills);
 }finally{await store.close();}
});
