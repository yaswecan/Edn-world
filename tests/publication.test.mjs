import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticRevisionFixture} from './fixtures/diagnostic-revision.mjs';
import {lessonPlanUnchanged} from '../server/lesson-plan.mjs';
import {preparePublication} from '../server/publication-readiness.mjs';
import {publishLesson} from '../server/domain.mjs';
import {createApp} from '../server/app.mjs';
import {passwordHash} from '../server/auth.mjs';

test('another timetable change does not block publication; changed lesson or curriculum still does',()=>{
 const entry={id:'A1:e',classId:'A1',date:'2026-10-05',skills:['CSS'],objective:'Une carte',duration:110,durationConfirmed:true,status:'planned',version:1};
 const spec={classId:'A1',planEntryId:entry.id,planVersion:1,sourceVersions:{curriculumVersion:'c'}};
 const original={version:1,curriculumVersion:'c',entries:[structuredClone(entry)]},current={version:2,curriculumVersion:'c',entries:[entry,{id:'A1:other'}]};
 assert.equal(lessonPlanUnchanged(spec,entry,[original,current]),true);
 assert.equal(lessonPlanUnchanged(spec,{...entry,editedBy:'teacher',version:2},[original,current]),true);
 for(const change of [{objective:'Autre objectif'},{skills:['JS']},{duration:90},{date:'2026-10-06'},{status:'cancelled'}])assert.equal(lessonPlanUnchanged(spec,{...entry,...change},[original,current]),false);
 assert.equal(lessonPlanUnchanged(spec,entry,[original,{...current,curriculumVersion:'new'}]),false);
 assert.equal(lessonPlanUnchanged(spec,entry,[current]),false);
 assert.equal(lessonPlanUnchanged(spec,entry,[{...original,entries:[{...entry,id:'e'}]},current]),true);
});

test('publication preparation compiles missing supports once and leaves final publication explicit',async()=>{
 const {store,actor,lesson}=await diagnosticRevisionFixture();try{
  const old=await store.get('lesson_versions',lesson.versionId),plan=await store.get('plan_versions','quality-plan'),entry=await store.get('plan_entries','box');
  plan.entries=[entry];await store.put('plan_versions',plan);await store.insert('plan_versions',{...plan,id:'changed-elsewhere',version:2,entries:[entry,{id:'unrelated'}]});
  const ready=await preparePublication(store,lesson.id,{version:1},actor);assert.equal(ready.quality.publishable,true,JSON.stringify(ready.blockers));assert.deepEqual(ready.blockers,[]);
  assert.equal((await store.list('corpus_packages')).length,1);assert.equal((await store.get('lessons',lesson.id)).status,'draft');
  assert.deepEqual(await store.get('lesson_versions',lesson.versionId),old);
  await preparePublication(store,lesson.id,{version:1},actor);assert.equal((await store.list('corpus_packages')).length,1);
  await assert.rejects(publishLesson(store,lesson.id,actor,{confirmed:false,version:1}),/Validation professeur/);
  await assert.rejects(preparePublication(store,lesson.id,{version:0},actor),/séance a changé/);
  const published=await publishLesson(store,lesson.id,actor,{confirmed:true,version:1});assert.equal(published.status,'published');
  assert.equal((await store.list('lesson_publications')).length,1);assert.equal((await store.list('lesson_runs'))[0].eligibleForDiagnostic,false);
 }finally{await store.close();}
});

test('an unfinished cancelled preparation cannot become ready by compiling an export',async()=>{
 const {store,actor,lesson}=await diagnosticRevisionFixture();try{
  Object.assign(lesson,{qualityRequired:true,qualityJobId:'cancelled'});await store.put('lessons',lesson);
  await store.insert('generation_jobs',{id:'cancelled',classId:actor.classId,lessonId:lesson.id,status:'cancelled',stage:'analysis',sources:[]});
  const ready=await preparePublication(store,lesson.id,{version:1},actor);
  assert.equal(ready.quality.publishable,false);assert.ok(ready.blockers.some(c=>c.id==='independent_review'&&c.action==='preparation'&&c.detail.includes('annulée')));
  assert.equal((await store.list('corpus_packages')).length,0);assert.equal((await store.list('generation_calls')).length,0);
  await assert.rejects(publishLesson(store,lesson.id,actor,{version:1,confirmed:true}),{status:422});
 }finally{await store.close();}
});

test('a broken executable correction is a blocker in preparation and on direct publication',async()=>{
 const {store,actor,lesson}=await diagnosticRevisionFixture();try{
  await preparePublication(store,lesson.id,{version:1},actor);
  const version=await store.get('lesson_versions',lesson.versionId),task=version.spec.activities.find(a=>a.correctionMode==='css');task.reference='Une explication sans le code de correction.';await store.put('lesson_versions',version);
  const ready=await preparePublication(store,lesson.id,{version:1},actor);assert.equal(ready.quality.publishable,false);assert.ok(ready.blockers.some(c=>c.id===`reference:${task.id}`&&c.action==='edit'));
  await assert.rejects(publishLesson(store,lesson.id,actor,{version:1,confirmed:true}),{status:422});
  assert.equal((await store.list('lesson_publications')).length,0);
 }finally{await store.close();}
});

test('published lessons have authenticated class-scoped links independent of today, with no draft or answer leaks',async()=>{
 const {store,actor,lesson}=await diagnosticRevisionFixture();
 for(const [id,classId] of [['student','A1'],['other','OTHER']])await store.insert('learners',{id,classId,username:id,displayName:id,passwordHash:passwordHash('student-check-only')});
 const server=createApp(store).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const login=async(role,username,password)=>{const response=await fetch(base+'/api/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role,username,password,classId:username==='other'?'OTHER':'A1'})});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0];};
 const call=async(path,cookie,{method='GET',body}={})=>{const response=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});return {status:response.status,body:await response.json()};};
 try{
  const teacher=await login('teacher','professeur','quality-preview-only'),student=await login('student','student','student-check-only'),other=await login('student','other','student-check-only');
  const prepare=`/api/lessons/${lesson.id}/publication/prepare`,direct=`/api/today?lesson=${lesson.id}`;
  assert.equal((await call(prepare,student,{method:'POST',body:{version:1}})).status,403);
  assert.equal((await call(direct,student)).status,404);assert.equal((await call(direct,'')).status,401);
  assert.equal((await call(prepare,teacher,{method:'POST',body:{version:1}})).body.quality.publishable,true);
  assert.equal((await call(`/api/lessons/${lesson.id}/publish`,teacher,{method:'POST',body:{version:1,confirmed:true}})).status,200);
  const accessible=await call(direct,student);assert.equal(accessible.status,200);assert.equal(accessible.body.lesson.id,lesson.id);assert.equal(accessible.body.date,lesson.date);
  assert.ok(accessible.body.lesson.spec.diagnostic.tasks.every(t=>t.reference===undefined&&t.tests===undefined&&t.expectedAnswer===undefined));
  assert.equal((await call(direct,other)).status,404);
  const offDay=await call('/api/today?date=2099-01-01',student);assert.equal(offDay.body.lesson,null);assert.deepEqual(offDay.body.availableLessons.map(l=>l.id),[lesson.id]);
  assert.deepEqual((await call('/api/today?date=2099-01-01',other)).body.availableLessons,[]);
  await store.insert('lessons',{...lesson,id:'unpublished',title:'Private draft'});assert.deepEqual((await call('/api/today?date=2099-01-01',student)).body.availableLessons.map(l=>l.id),[lesson.id]);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await store.close();}
});
