import {grantFixture} from './fixtures/tracking-assignment.mjs';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {openStore} from '../server/store.mjs';
import {createApp} from '../server/app.mjs';
import {passwordHash} from '../server/auth.mjs';
import {previewImport,applyImport} from '../server/importer.mjs';
import {seedCatalog} from '../server/game.mjs';
import {demoFlexbox} from '../server/demo-flexbox.mjs';
const teacher={id:'teacher',role:'teacher',classId:'A1',username:'prof',displayName:'Professeur',passwordHash:passwordHash('test-password-only')};
let store,server,base,teacherCookie,studentCookie,otherCookie,lesson,studentId;
async function call(path,{method='GET',body,cookie=teacherCookie,origin}={}){const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(origin?{Origin:origin}:{})},body:body?JSON.stringify(body):undefined});let data;try{data=await r.json();}catch{data=null;}return {status:r.status,data,headers:r.headers};}
before(async()=>{store=await openStore({path:':memory:',url:''});await store.insert('teachers',teacher);await seedCatalog(store);const file=(await readdir('.')).find(n=>n.startsWith('Planification_A1_')&&n.endsWith('.xlsx'));const report=await previewImport(store,await readFile(file),teacher);await applyImport(store,report.id,teacher,{confirmed:true});const learner=(await store.list('learners','A1'))[0];studentId=learner.id;learner.passwordHash=passwordHash('student-test-only');await store.put('learners',learner);await store.insert('learners',{id:'other',classId:'OTHER',username:'other',displayName:'Other',passwordHash:passwordHash('other-test-only')});server=createApp(store).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base=`http://127.0.0.1:${server.address().port}`;
for(const [role,username,password,key]of [['teacher','prof','test-password-only','t'],['student',learner.username,'student-test-only','s'],['student','other','other-test-only','o']]){const r=await call('/api/login',{method:'POST',body:{role,username,password,classId:key==='o'?'OTHER':'A1'},cookie:''});assert.equal(r.status,200);const c=r.headers.get('set-cookie').split(';')[0];if(key==='t')teacherCookie=c;if(key==='s')studentCookie=c;if(key==='o')otherCookie=c;}
});
after(async()=>{await new Promise(r=>server.close(r));await store.close();});
test('teacher auth and student class boundaries',async()=>{assert.equal((await call('/api/dashboard',{cookie:''})).status,401);assert.equal((await call('/api/dashboard',{cookie:studentCookie})).status,403);const r=await call('/api/dashboard');assert.equal(r.status,200);assert.equal(r.data.learners.length,18);assert.ok(r.data.learners.every(l=>!l.passwordHash));});
test('cross-origin mutations rejected',async()=>{const r=await call('/api/logout',{method:'POST',origin:'https://evil.invalid'});assert.equal(r.status,403);});
test('API lifecycle: prepare, compile, preview, explicit publish',async()=>{const entries=(await call('/api/plans/A1')).data.entries;const entry=entries.find(e=>e.date==='2026-10-08');const proposed=await call('/api/plans/A1/changes/propose',{method:'POST',body:{entryId:entry.id,patch:{durationConfirmed:true},reason:'Confirmer'}});assert.equal(proposed.status,200);await call(`/api/plans/A1/changes/${encodeURIComponent(proposed.data.id)}/apply`,{method:'POST',body:{confirmed:true}});const generated=await call('/api/twin/intent',{method:'POST',body:{intent:'Prépare jeudi',entryId:entry.id,localOnly:true}});assert.equal(generated.status,200,JSON.stringify(generated.data));lesson=generated.data;assert.ok(lesson.corpusManifest.files.length>20);assert.ok(lesson.quality.publishable);const preview=await call(`/api/lessons/${encodeURIComponent(lesson.id)}/preview`,{method:'POST'});assert.equal(preview.data.teacherGuide,undefined);assert.equal(preview.data.diagnostic.tasks[0].reference,undefined);assert.equal((await call(`/api/lessons/${encodeURIComponent(lesson.id)}`,{cookie:studentCookie})).status,403);const published=await call(`/api/lessons/${encodeURIComponent(lesson.id)}/publish`,{method:'POST',body:{confirmed:true,version:lesson.version}});assert.equal(published.status,200,JSON.stringify(published.data));});
test('student APIs expose no answers before submission; submit is immutable and owned',async()=>{const today=await call('/api/today?date=2026-10-08',{cookie:studentCookie});assert.equal(today.status,200);assert.ok(today.data.lesson);const preview=await call(`/api/lessons/${encodeURIComponent(lesson.id)}/preview`,{method:'POST'});assert.deepEqual(preview.data,today.data.lesson.spec);assert.equal(today.data.lesson.spec.diagnostic.tasks[0].reference,undefined);assert.equal(today.data.lesson.spec.activities[0].expectedAnswer,undefined);assert.equal((await call('/api/today?date=2026-10-08',{cookie:otherCookie})).data.lesson,null);
 const start=await call(`/api/assessments/${encodeURIComponent(lesson.id)}/start`,{method:'POST',cookie:studentCookie});assert.equal(start.status,200);const a=start.data;const answers=Object.fromEntries(lesson.spec.diagnostic.tasks.map(t=>[t.id,'Une production personnelle']));const save=await call(`/api/assessments/${a.id}/save`,{method:'POST',cookie:studentCookie,body:{answers,draftVersion:0}});assert.equal(save.status,200);assert.ok(save.data.receivedAt);
 assert.equal((await call(`/api/assessments/${a.id}/submit`,{method:'POST',cookie:otherCookie,body:{answers}})).status,404);
 const submitted=await call(`/api/assessments/${a.id}/submit`,{method:'POST',cookie:studentCookie,body:{answers,draftVersion:save.data.draftVersion}});assert.equal(submitted.status,200);assert.equal(submitted.data.correction,undefined);const duplicate=await call(`/api/assessments/${a.id}/submit`,{method:'POST',cookie:studentCookie,body:{answers:{tampered:true}}});assert.equal(submitted.data.sha256,duplicate.data.sha256);assert.equal((await call(`/api/assessments/${a.id}/save`,{method:'POST',cookie:studentCookie,body:{answers:{}}})).status,409);
 const after=await call('/api/today?date=2026-10-08',{cookie:studentCookie});assert.equal(after.data.lesson.spec.diagnostic.tasks[0].reference,undefined);assert.equal(after.data.lesson.spec.activities[0].reference,undefined);
 const review=await call(`/api/teacher/submissions/${submitted.data.submissionId}`);assert.equal(review.status,200);const correction=review.data.correction;
 const approved=await call(`/api/teacher/submissions/${submitted.data.submissionId}/correction`,{method:'POST',body:{version:correction.version,items:correction.items.map(i=>({id:i.id,points:i.max})),reason:'Relu avec la grille',autonomous:true,transfer:false}});assert.equal(approved.status,200);assert.equal(approved.data.score,20);assert.equal((await store.list('evidence','A1')).length,0);
});
test('teacher corpus never downloadable by students',async()=>{assert.equal((await call(`/api/corpus/${encodeURIComponent(lesson.id)}/download`,{cookie:studentCookie})).status,403);const r=await fetch(base+`/api/corpus/${encodeURIComponent(lesson.id)}/download`,{headers:{Cookie:teacherCookie}});assert.equal(r.status,200);assert.equal(r.headers.get('content-type'),'application/zip');const bytes=Buffer.from(await r.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');});
test('unsupported code remains bounded and never executes host access',async()=>{for(const code of ['while(true){}','process.exit()','fetch("https://example.com")','globalThis.constructor.constructor("return process")()']){const r=await call('/api/code/run',{method:'POST',cookie:studentCookie,body:{code}});assert.equal(r.status,200);assert.equal(r.data.ok,false);}});
test('Drive returns a configuration error rather than fake success',async()=>{const r=await call(`/api/corpus/${encodeURIComponent(lesson.id)}/publish-drive`,{method:'POST',body:{confirmed:true,students:['all']}});assert.equal(r.status,503);});
test('live adaptation keeps submitted diagnostic attempts across the version switch',async()=>{const before=(await call('/api/today?date=2026-10-08',{cookie:studentCookie})).data;const proposed=await call(`/api/lessons/${encodeURIComponent(lesson.id)}/adapt/propose`,{method:'POST',body:{version:before.lesson.version,strategy:'practice'}});assert.equal(proposed.status,200,JSON.stringify(proposed.data));const applied=await call(`/api/lessons/${encodeURIComponent(lesson.id)}/adapt/apply`,{method:'POST',body:{confirmed:true,proposalId:proposed.data.id}});assert.equal(applied.status,200,JSON.stringify(applied.data));const after=(await call('/api/today?date=2026-10-08',{cookie:studentCookie})).data;assert.equal(after.lesson.versionId,before.lesson.versionId);assert.equal(after.attempt.id,before.attempt.id);assert.equal(after.attempt.submissionId,before.attempt.submissionId);const start=await call(`/api/assessments/${encodeURIComponent(lesson.id)}/start`,{method:'POST',cookie:studentCookie});assert.equal(start.data.id,before.attempt.id);const stale=await call('/api/events',{method:'POST',cookie:studentCookie,body:{lessonId:lesson.id,lessonVersionId:before.lesson.versionId,eventId:'stale',type:'step_started',activityId:'opening'}});assert.equal(stale.status,200);});
test('worker endpoint rejects anonymous and teacher-session requests without its secret',async()=>{assert.equal((await call('/api/internal/publication-worker',{cookie:''})).status,401);assert.equal((await call('/api/internal/publication-worker')).status,401);});
test('workshop tests use the published task, preserve the attempt and reject stale or foreign versions',async()=>{
 const current=(await call('/api/today?date=2026-10-08',{cookie:studentCookie})).data.lesson,spec=(await store.get('lesson_versions',current.versionId)).spec,task=spec.activities.find(a=>a.correctionMode==='javascript');assert.ok(task);
 const body={lessonId:lesson.id,lessonVersionId:current.versionId,taskId:task.id,code:task.reference};
 const good=await call('/api/code/run',{method:'POST',cookie:studentCookie,body});assert.equal(good.status,200);assert.equal(good.data.ok,true,JSON.stringify(good.data));
 assert.ok((await store.list('learning_events','A1')).some(e=>e.type==='code_tested'&&e.activityId===task.id&&e.payload.code===task.reference));
 assert.equal((await call('/api/code/run',{method:'POST',cookie:otherCookie,body})).status,404);
 assert.equal((await call('/api/code/run',{method:'POST',cookie:studentCookie,body:{...body,lessonVersionId:'old'}})).status,404);
 assert.equal((await call('/api/code/run',{method:'POST',cookie:studentCookie,body:{...body,taskId:'missing'}})).status,400);
});
test('HTML and CSS diagnostic attempts use their frozen exercises and record tests without exposing solutions',async()=>{
 const spec=demoFlexbox();for(const task of spec.diagnostic.tasks)task.publicTests=structuredClone(task.tests);
 await store.insert('lesson_versions',{id:'diagnostic-web:v1',classId:'A1',spec});
 const syntheticLesson=await store.insert('lessons',{id:'diagnostic-web',classId:'A1',versionId:'diagnostic-web:v1',status:'published'});
 await grantFixture(store,syntheticLesson,await store.get('learners',studentId));
 const start=await call('/api/assessments/diagnostic-web/start',{method:'POST',cookie:studentCookie});
 assert.equal(start.status,200);
 const path=`/api/assessments/${start.data.id}/test`;
 for(const task of spec.diagnostic.tasks.filter(t=>t.type==='CodeEditor')){
  const body={taskId:task.id,code:task.reference};
  assert.equal((await call(path,{method:'POST',cookie:otherCookie,body})).status,404);
  const good=await call(path,{method:'POST',cookie:studentCookie,body});
  assert.equal(good.status,200);assert.equal(good.data.ok,true,JSON.stringify(good.data));
  for(const key of ['reference','expectedAnswer','tests'])assert.equal(good.data[key],undefined);
  const bad=await call(path,{method:'POST',cookie:studentCookie,body:{...body,code:task.starter}});
  assert.equal(bad.status,200);assert.equal(bad.data.ok,false);
 }
 assert.equal((await call(path,{method:'POST',cookie:studentCookie,body:{taskId:'unknown',code:'test'}})).status,400);
 const saved=await store.get('assessment_attempts',start.data.id);
 assert.equal(saved.executions,4);assert.equal(saved.history.length,4);
 assert.ok(saved.firstAttempt['baseline-html'].payload.result.ok);
 assert.equal(saved.lastAttempt['baseline-html'].payload.result.ok,false);
 const submitted=await call(`/api/assessments/${start.data.id}/submit`,{method:'POST',cookie:studentCookie,body:{answers:{},draftVersion:start.data.draftVersion}});
 assert.equal(submitted.status,200);
 assert.equal((await call(path,{method:'POST',cookie:studentCookie,body:{taskId:'baseline-html',code:'<h1>Mon projet</h1>'}})).status,409);
});
