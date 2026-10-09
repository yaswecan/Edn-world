import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticRevisionFixture} from './fixtures/diagnostic-revision.mjs';
import {lessonPlanUnchanged} from '../server/lesson-plan.mjs';
import {preparePublication} from '../server/publication-readiness.mjs';
import {publishLesson} from '../server/domain.mjs';
import {parisDate} from '../server/generator.mjs';
import {todayLesson,publishedLessons} from '../server/today-lesson.mjs';
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

test('a duration-only planning change accepts an already retimed lesson without rewriting its source',()=>{
 const entry={id:'A1:e',classId:'A1',date:'2026-10-08',skills:['JS'],objective:'Boucles',duration:175,durationConfirmed:true,status:'planned',version:1};
 const currentEntry={...entry,duration:135,version:2};
 const plans=[{version:1,curriculumVersion:'c',entries:[entry]},{version:2,curriculumVersion:'c',entries:[currentEntry]}];
 const spec={classId:'A1',planEntryId:entry.id,planVersion:1,sourceVersions:{curriculumVersion:'c'},blocks:[{id:'first',minutes:20},{id:'next',minutes:115}],timeline:[{blockId:'first',minutes:20},{blockId:'next',minutes:115}]};
 const original=structuredClone(spec);
 assert.equal(lessonPlanUnchanged(spec,currentEntry,plans),true);
 assert.deepEqual(spec,original);
 for(const change of [{duration:130},{durationConfirmed:false},{objective:'Autre objectif'},{skills:['CSS']},{date:'2026-10-09'},{status:'cancelled'}])assert.equal(lessonPlanUnchanged(spec,{...currentEntry,...change},plans),false);
 assert.equal(lessonPlanUnchanged({...spec,timeline:[{blockId:'first',minutes:135}]},currentEntry,plans),false);
 assert.equal(lessonPlanUnchanged(spec,currentEntry,[plans[0],{...plans[1],curriculumVersion:'new'}]),false);
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

test('teacher publication accepts pedagogical warnings and atomically selects today, preserving the planned date',async()=>{
 const {store,actor,lesson}=await diagnosticRevisionFixture();try{
  const version=await store.get('lesson_versions',lesson.versionId),entry=await store.get('plan_entries','box');
  entry.status='cancelled';await store.put('plan_entries',entry);
  version.spec.blocks=version.spec.blocks.filter(b=>!['summary','extend'].includes(b.phase));
  version.spec.timeline=version.spec.timeline.filter(t=>version.spec.blocks.some(b=>b.id===t.blockId));
  version.spec.studentFlow=version.spec.studentFlow.filter(id=>version.spec.blocks.some(b=>b.id===id));
  for(const task of version.spec.activities.filter(a=>a.correctionMode==='css'))task.reference='Corrigé à relire';
  await store.put('lesson_versions',version);
  Object.assign(lesson,{qualityRequired:true,qualityJobId:'cancelled'});await store.put('lessons',lesson);
  await store.insert('generation_jobs',{id:'cancelled',classId:actor.classId,lessonId:lesson.id,status:'cancelled',sources:[]});
  await store.insert('lessons',{...lesson,id:'already-published',status:'published'});
  await store.insert('classes',{id:actor.classId,classId:actor.classId,name:'Classe conservée',todayLesson:{date:parisDate(),lessonId:'already-published'}});
  const report=await preparePublication(store,lesson.id,{version:1},actor);
  for(const id of ['plan_identity','lesson_sections','lesson_summary','independent_review'])assert.ok(report.blockers.some(c=>c.id===id),id);
  assert.ok(report.blockers.some(c=>c.id.startsWith('reference:')));
  assert.equal((await store.list('corpus_packages')).length,0);
  const input={version:1,confirmed:true,validationMode:'teacher',setToday:true,date:parisDate()};
  const [published,retry]=await Promise.all([publishLesson(store,lesson.id,actor,input),publishLesson(store,lesson.id,actor,input)]);
  assert.equal(published.status,'published');assert.equal(retry.publicationId,published.publicationId);
  assert.equal(published.date,lesson.date);assert.deepEqual(await store.get('lesson_versions',lesson.versionId),version);
  assert.equal(published.quality.publishable,false,'Automatic warnings are not marked as passed');
  assert.equal((await store.get('lessons','already-published')).status,'published');
  assert.deepEqual(await todayLesson(store,actor.classId,publishedLessons(await store.list('lessons',actor.classId))),{date:parisDate(),lessonId:lesson.id,selected:true});
  assert.equal((await store.get('classes',actor.classId)).name,'Classe conservée');
  const publications=await store.list('lesson_publications');assert.equal(publications.length,1);assert.equal(publications[0].validationMode,'teacher');
  assert.equal((await store.list('teacher_approvals'))[0].validationMode,'teacher');
  assert.equal((await store.list('lesson_runs')).length,1);assert.equal((await store.list('corpus_packages')).length,1);
  assert.equal((await store.list('generation_calls')).length,0);
 }finally{await store.close();}
});

test('manual publication keeps version, teacher, in-progress and day guards, and can publish without changing today',async()=>{
 const {store,actor,lesson}=await diagnosticRevisionFixture();try{
  const input={version:1,confirmed:true,validationMode:'teacher'};
  for(const patch of [{version:0},{confirmed:false},{validationMode:'unknown'}])await assert.rejects(publishLesson(store,lesson.id,actor,{...input,...patch}));
  await assert.rejects(publishLesson(store,lesson.id,{...actor,role:'student'},input));
  await assert.rejects(publishLesson(store,lesson.id,{...actor,classId:'OTHER'},input),{status:404});
  await store.insert('generation_jobs',{id:'running',classId:actor.classId,lessonId:lesson.id,status:'running'});
  await assert.rejects(publishLesson(store,lesson.id,actor,input),{status:409});
  assert.equal((await store.list('corpus_packages')).length,0);
  await store.put('generation_jobs',{id:'running',classId:actor.classId,lessonId:lesson.id,status:'cancelled'});
  const selection={date:parisDate(),lessonId:'existing'};
  await store.insert('classes',{id:actor.classId,classId:actor.classId,todayLesson:selection});
  await assert.rejects(publishLesson(store,lesson.id,actor,{...input,setToday:true,date:'2000-01-01'}),{status:409});
  assert.equal((await store.get('lessons',lesson.id)).status,'draft');
  for(const table of ['lesson_publications','lesson_runs','teacher_approvals'])assert.equal((await store.list(table)).length,0,table);
  assert.deepEqual((await store.get('classes',actor.classId)).todayLesson,selection);
  await publishLesson(store,lesson.id,actor,input);
  assert.deepEqual((await store.get('classes',actor.classId)).todayLesson,selection);
  await publishLesson(store,lesson.id,actor,{...input,setToday:true,date:parisDate()});
  assert.equal((await store.get('classes',actor.classId)).todayLesson.lessonId,lesson.id);
  assert.equal((await store.list('lesson_publications')).length,1);
  await store.put('lessons',{...await store.get('lessons',lesson.id),status:'completed'});
  await assert.rejects(publishLesson(store,lesson.id,actor,input),{status:409});
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
