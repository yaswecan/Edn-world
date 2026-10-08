import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnosticRevisionFixture} from './fixtures/diagnostic-revision.mjs';
import {applyRevisionPatch,proposeLessonRevision,applyLessonRevision} from '../server/lesson-revision.mjs';
import {preparePublication,takeOverDraft} from '../server/publication-readiness.mjs';
import {publishLesson,editLesson} from '../server/domain.mjs';
import {createApp} from '../server/app.mjs';
import {passwordHash} from '../server/auth.mjs';

export const revisionOptions={configure:async()=>({provider:'chatgpt_plan',roles:{write:{model:'fixture',billing:'chatgpt_plan'}}})};
const input={version:1,prompt:'JavaScript seulement, retire les dessins.',requestId:'test-request'};
const patch=(path,value)=>({op:'replace',path,valueJSON:JSON.stringify(value)});
const response=(changes=[patch('/teacherGuide','Faire justifier les cas limites en JavaScript.')])=>({summary:'Cours recentré sur JavaScript.',changes});
const fake=changes=>({...revisionOptions,call:async()=>({value:response(changes),trace:{provider:'fixture'}})});

test('prompt revision proposes, persists and applies a new draft exactly once; old version and diagnostic stay intact',async()=>{
 const {store,actor,lesson,spec}=await diagnosticRevisionFixture();try{
  const old=await store.get('lesson_versions',lesson.versionId);let calls=0;
  const options={...revisionOptions,call:async()=>{calls++;return {value:response()};}};
  const proposal=await proposeLessonRevision(store,lesson.id,input,actor,options);
  assert.equal((await store.get('lessons',lesson.id)).version,1);assert.equal(proposal.status,'ready');
  assert.equal((await proposeLessonRevision(store,lesson.id,input,actor,options)).id,proposal.id);assert.equal(calls,1);
  await assert.rejects(applyLessonRevision(store,lesson.id,{proposalId:proposal.id,version:1,confirmed:false},actor),/confirmez/);
  const request={proposalId:proposal.id,version:1,confirmed:true},revised=await applyLessonRevision(store,lesson.id,request,actor);
  assert.equal(revised.status,'draft');assert.equal(revised.version,2);assert.equal(revised.pedagogicalValidation,null);
  assert.deepEqual(await store.get('lesson_versions',lesson.versionId),old);
  const saved=await store.get('lesson_versions',revised.versionId);assert.deepEqual(saved.spec.diagnostic,spec.diagnostic);assert.equal(saved.previousVersionId,lesson.versionId);
  assert.match(saved.spec.teacherGuide,/JavaScript/);assert.equal((await applyLessonRevision(store,lesson.id,request,actor)).version,2);
  assert.equal((await store.list('lesson_versions')).length,2);assert.equal((await store.list('content_snapshots')).length,1);
  const ready=await preparePublication(store,lesson.id,{version:2},actor);assert.equal(ready.quality.publishable,true,JSON.stringify(ready.blockers));
  assert.equal((await publishLesson(store,lesson.id,actor,{version:2,confirmed:true})).status,'published');
 }finally{await store.close();}
});

test('drawing removals update links and exports; protected fields, invalid schemas and dangling references are rejected atomically',async()=>{
 const {store,spec}=await diagnosticRevisionFixture();try{
  spec.activities.push({...spec.activities[0],id:'extra-drawing',type:'Blackboard',title:'Dessiner',instruction:'Dessine en Python.'});
  const block=spec.blocks.find(b=>b.phase==='observe'),index=spec.blocks.indexOf(block);block.activityIds.push('extra-drawing');block.content='Exemple en Python.';
  const retained=spec.activities.filter(a=>a.type!=='Blackboard'),ids=new Set(retained.map(a=>a.id));
  const changes=[patch('/activities',retained),...spec.blocks.map((b,i)=>patch(`/blocks/${i}/activityIds`,b.activityIds.filter(id=>ids.has(id)))),patch(`/blocks/${index}/content`,'Exemple commenté en JavaScript.')];
  const revised=applyRevisionPatch(spec,response(changes));
  assert.ok(!JSON.stringify(revised).includes('Python'));assert.ok(!revised.activities.some(a=>a.type==='Blackboard'));assert.ok(revised.slides.some(s=>s.body.includes('JavaScript')));
  assert.ok(spec.activities.some(a=>a.id==='extra-drawing'));
  for(const changes of [[patch('/classId','OTHER')],[patch('/diagnostic/duration',8)],[patch('/blocks/__proto__/polluted',true)],[patch('/title',42)],[{op:'remove',path:`/activities/${spec.activities.length-1}`,valueJSON:''}]])assert.throws(()=>applyRevisionPatch(spec,response(changes)));
  const diagnosticIndex=spec.blocks.findIndex(b=>b.type==='Diagnostic');assert.throws(()=>applyRevisionPatch(spec,response([patch(`/blocks/${diagnosticIndex}/minutes`,1)])),/diagnostic/);
  assert.equal({}.polluted,undefined);
 }finally{await store.close();}
});

test('late model output, stale application, provider errors and concurrent requests cannot overwrite drafts',async()=>{
 const {store,actor,lesson,spec}=await diagnosticRevisionFixture();try{
  const proposal=await proposeLessonRevision(store,lesson.id,input,actor,fake());
  await assert.rejects(proposeLessonRevision(store,lesson.id,{...input,requestId:'failure'},actor,{...revisionOptions,call:async()=>{throw Error('Connexion indisponible');}}),/Connexion/);
  assert.equal((await store.get('lessons',lesson.id)).version,1);
  await assert.rejects(proposeLessonRevision(store,lesson.id,{...input,requestId:'late'},actor,{...revisionOptions,call:async()=>{await editLesson(store,lesson.id,{version:1,spec,reason:'Édition concurrente'},actor);return {value:response()};}}),{status:409});
  await assert.rejects(applyLessonRevision(store,lesson.id,{proposalId:proposal.id,version:1,confirmed:true},actor),{status:409});
  assert.equal((await store.get('lessons',lesson.id)).version,2);
  const stale=(await store.list('lesson_adaptations')).find(p=>p.prompt&&p.status==='failed');assert.ok(stale);
  let release,calls=0;const gate=new Promise(resolve=>{release=resolve;}),request={...input,version:2,requestId:'concurrent'};
  const pending=proposeLessonRevision(store,lesson.id,request,actor,{...revisionOptions,call:async()=>{calls++;await gate;return {value:response()};}});
  while(!calls)await new Promise(resolve=>setTimeout(resolve,5));
  try{await assert.rejects(proposeLessonRevision(store,lesson.id,request,actor,fake()),/déjà en cours/);}finally{release();await pending;}
  assert.equal(calls,1);
 }finally{await store.close();}
});

test('active preparation, published content, foreign class and another teacher cannot use a revision',async()=>{
 const {store,actor,lesson}=await diagnosticRevisionFixture();try{
  const p=await proposeLessonRevision(store,lesson.id,input,actor,fake());
  await assert.rejects(proposeLessonRevision(store,lesson.id,input,{...actor,classId:'OTHER'},fake()),{status:404});
  await assert.rejects(applyLessonRevision(store,lesson.id,{proposalId:p.id,version:1,confirmed:true},{...actor,id:'another'}),/inaccessible/);
  await store.insert('generation_jobs',{id:'active',classId:actor.classId,lessonId:lesson.id,status:'running'});
  await assert.rejects(proposeLessonRevision(store,lesson.id,{...input,requestId:'active'},actor,fake()),/en cours/);
  await assert.rejects(applyLessonRevision(store,lesson.id,{proposalId:p.id,version:1,confirmed:true},actor),/en cours/);
  await store.put('lessons',{...lesson,status:'published'});
  await assert.rejects(proposeLessonRevision(store,lesson.id,{...input,requestId:'published'},actor,fake()),/brouillons/);
 }finally{await store.close();}
});

test('teacher takeover is explicit and versioned; technical checks still block publication and simulations remain barred',async()=>{
 const {store,actor,lesson}=await diagnosticRevisionFixture();try{
  await store.put('lessons',{...lesson,qualityRequired:true,qualityJobId:'cancelled'});
  const job=await store.insert('generation_jobs',{id:'cancelled',classId:actor.classId,lessonId:lesson.id,status:'cancelled',stage:'analysis',sources:[]});
  const old=await store.get('lesson_versions',lesson.versionId),request={version:1,confirmed:true,reason:'Relecture et ajustements par le professeur.'};
  assert.equal((await preparePublication(store,lesson.id,{version:1},actor)).canTakeOver,true);
  await assert.rejects(publishLesson(store,lesson.id,actor,{version:1,confirmed:true}),{status:422});
  await assert.rejects(takeOverDraft(store,lesson.id,{...request,confirmed:false},actor),/Confirmez/);
  await store.put('generation_jobs',{...job,simulation:true});await assert.rejects(takeOverDraft(store,lesson.id,request,actor),/ne peut pas/);
  await store.put('generation_jobs',job);
  const revised=await takeOverDraft(store,lesson.id,request,actor);assert.equal(revised.version,2);assert.equal(revised.status,'draft');assert.equal(revised.qualityRequired,false);
  assert.deepEqual(await store.get('lesson_versions',lesson.versionId),old);assert.deepEqual(await store.get('generation_jobs',job.id),job);
  assert.equal((await store.list('teacher_approvals')).length,0);
  const version=await store.get('lesson_versions',revised.versionId);version.spec.activities.find(a=>a.correctionMode==='css').reference='invalid';await store.put('lesson_versions',version);
  const ready=await preparePublication(store,lesson.id,{version:2},actor);assert.equal(ready.quality.publishable,false);assert.ok(ready.blockers.some(c=>c.id.startsWith('reference:')));
  await assert.rejects(publishLesson(store,lesson.id,actor,{version:2,confirmed:true}),{status:422});
 }finally{await store.close();}
});

test('revision HTTP routes enforce teacher authorization and recover the persisted proposal',async()=>{
 const {store,actor,lesson}=await diagnosticRevisionFixture();
 await store.insert('learners',{id:'student',classId:actor.classId,username:'student',displayName:'Test',passwordHash:passwordHash('student-check-only')});
 const server=createApp(store,{lessonRevision:fake()}).listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`;
 const call=async(path,cookie='',body)=>fetch(base+path,{method:body?'POST':'GET',headers:{cookie,'content-type':'application/json'},body:body?JSON.stringify(body):undefined});
 const login=async(role,username,password)=>(await call('/api/login','',{role,username,password})).headers.get('set-cookie').split(';')[0];
 try{
  const teacher=await login('teacher','professeur','quality-preview-only'),student=await login('student','student','student-check-only'),path=`/api/lessons/${lesson.id}/revisions`;
  assert.equal((await call(path+'/propose','',input)).status,401);assert.equal((await call(path+'/propose',student,input)).status,403);
  assert.equal((await call(path,student)).status,403);
  const proposalResponse=await call(path+'/propose',teacher,input);assert.equal(proposalResponse.status,200);const p=await proposalResponse.json();
  const history=await (await call(path,teacher)).json();assert.equal(history[0].id,p.id);assert.equal(history[0].trace,undefined);
  assert.equal((await call(path+'/apply',student,{proposalId:p.id,version:1,confirmed:true})).status,403);
  assert.equal((await call(path+'/apply',teacher,{proposalId:p.id,version:1,confirmed:true})).status,200);
  assert.equal((await store.get('lessons',lesson.id)).status,'draft');
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await store.close();}
});
