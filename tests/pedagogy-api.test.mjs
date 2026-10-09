import {grantFixture} from './fixtures/tracking-assignment.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {pedagogyFixture,buildPilot,pilotDefinitions} from './fixtures/pedagogy.mjs';
import {createApp} from '../server/app.mjs';
import {passwordHash} from '../server/auth.mjs';
import {qualityConfig} from '../server/pedagogy/provider.mjs';
import {enqueueGeneration,runGenerationStep,cancelGeneration} from '../server/pedagogy/jobs.mjs';
import {readResponsesStream} from '../server/ai/plan-provider.mjs';

async function httpFixture(){
 const fixture=await pedagogyFixture(),{store,actor}=fixture;
 await store.insert('learners',{id:'private-student',classId:'A1',role:'student',username:'student',passwordHash:passwordHash('test-student-123')});
 const server=createApp(store).listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});const base=`http://127.0.0.1:${server.address().port}`;
 const login=async(role,username,password)=>{const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,username,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const teacher=await login('teacher','professeur','quality-preview-only'),student=await login('student','student','test-student-123');
 const call=async(path,{method='GET',body,cookie=teacher,headers={}}={})=>{const r=await fetch(base+path,{method,headers:{Cookie:cookie,'Content-Type':'application/json',...headers},body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 return {...fixture,server,base,teacher,student,call,close:async()=>{await new Promise(r=>server.close(r));await store.close();}};
}
test('documentary citations open the exact transmitted source or library passage and enforce current rights',async()=>{
 const f=await httpFixture();try{
  const job=await buildPilot(f.store,f.actor,pilotDefinitions[0]);
  for(const p of job.documentContext.passages){const path=`/api/preparation/jobs/${job.id}/passages/${encodeURIComponent(p.segmentId)}`,result=await f.call(path);assert.equal(result.status,200);assert.equal(result.data.sourceHash,p.sourceHash);assert.equal(result.data.passage.location,p.location);assert.equal((await f.call(path,{cookie:f.student})).status,403);}
  const source=await f.store.get('pedagogical_sources',job.sourceIds[0]);source.access.revoked=true;await f.store.put('pedagogical_sources',source);
  assert.equal((await f.call(`/api/preparation/jobs/${job.id}/passages/${encodeURIComponent(job.documentContext.passages[0].segmentId)}`)).status,404);
 }finally{await f.close();}
});
test('teacher import is connected, originals private, jobs report missing AI and cannot be opened cross-role',async()=>{
 const f=await httpFixture();try{
 const source=await f.call('/api/preparation/sources',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Source-Filename':'corrige.md','X-Source-Role':'solution'},body:Buffer.from('# Corrigé\nreturn true;')});assert.equal(source.status,201);assert.equal(source.data.visibility,'teacher');assert.equal(source.data.originalBase64,undefined);
 for(const path of ['/api/preparation/sources',`/api/preparation/sources/${source.data.id}/original`,'/api/preparation/jobs'])assert.equal((await f.call(path,{cookie:f.student})).status,403);
 const job=await f.call('/api/preparation/jobs',{method:'POST',body:{entryId:'box',intent:'Approfondir',sourceIds:[source.data.id],requestId:'api-1'}});assert.equal(job.status,202);assert.equal(job.data.status,'blocked');assert.equal(job.data.calls,0);
 assert.equal((await f.call(`/api/preparation/jobs/${job.data.id}`,{cookie:f.student})).status,403);
 const generate=await f.call('/api/lessons/generate',{method:'POST',body:{entryId:'box',intent:'Préparer'}});assert.equal(generate.status,202);assert.equal(generate.data.kind,'preparation_job');
 }finally{await f.close();}
});
test('live provider activity is durable and owner-only; private reasoning and incomplete output never reach the API',async()=>{
 const f=await httpFixture();let release;
 try{
  const job=await enqueueGeneration(f.store,f.actor,{entryId:'box',intent:'Suivi simulé'},{config:qualityConfig({OPENAI_MODEL:'gpt-5.4'}),simulation:true});await runGenerationStep(f.store);
  let ready;const started=new Promise(resolve=>ready=resolve),resume=new Promise(resolve=>release=resolve);
  const events=[
   {type:'response.created',response:{id:'test-response',model:'confirmed-model',status:'in_progress'}},
   {type:'response.reasoning_text.delta',delta:'PRIVATE_REASONING'},
   {type:'response.reasoning_summary_text.delta',item_id:'reason',summary_index:0,delta:'Résumé public.'},
   {type:'response.output_text.delta',delta:'{"draft":'},
   {type:'response.output_text.delta',delta:'"incomplete"'}
  ];
  const running=runGenerationStep(f.store,{call:async({onEvent})=>{
   const response=new Response(events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join(''),{headers:{'content-type':'text/event-stream'}});
   return readResponsesStream(response,{onEvent:async event=>{await onEvent(event);if(event.type==='response.output_text.delta'&&event.activity.outputCharacters===9){ready();await resume;}}});
  }});
  await started;
  const path=`/api/preparation/jobs/${job.id}`,live=await f.call(path);assert.equal(live.status,200);
  const saved=live.data.callsTrace[0];assert.equal(saved.activity.summary,'Résumé public.');assert.equal(saved.activity.outputCharacters,9);assert.equal(saved.effectiveModel,'confirmed-model');assert.equal(saved.outcome,'running');
  for(const field of ['partialOutput','output','schema'])assert.equal(saved[field],undefined);
  assert.doesNotMatch(JSON.stringify(live.data),/PRIVATE_REASONING/);
  assert.equal((await f.call(path,{cookie:f.student})).status,403);
  const other={...f.actor,id:'other-teacher',username:'other',passwordHash:passwordHash('other-password')};await f.store.insert('teachers',other);
  const login=await fetch(f.base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role:'teacher',username:'other',password:'other-password'})});
  assert.equal(login.status,200);assert.equal((await f.call(path,{cookie:login.headers.get('set-cookie').split(';')[0]})).status,404);
  release();await running;
  const final=await f.call(path);assert.equal(final.data.status,'blocked');assert.equal(final.data.calls,1);
  assert.equal(final.data.callsTrace[0].activity.outputCharacters,21);assert.ok(final.data.callsTrace[0].finishedAt);
  assert.equal((await f.store.list('generation_calls',f.actor.classId))[0].partialOutput,'{"draft":"incomplete"');
  assert.doesNotMatch(JSON.stringify(await f.store.list('generation_calls',f.actor.classId)),/PRIVATE_REASONING/);
 }finally{release?.();await f.close();}
});
test('preparation API accepts an imported sequence with persisted blank rows instead of returning 500',async()=>{
 const f=await httpFixture();try{
  const entry=await f.store.get('plan_entries','logic');entry.sequence='S04';await f.store.put('plan_entries',entry);
  const curriculum=await f.store.get('curriculum_versions','quality-curriculum');
  curriculum.sequences=[{id:'S04',source:{name:'S04 Logique',rows:[['Fiche'],null,null,[entry.date,'Séance']]}}];await f.store.put('curriculum_versions',curriculum);
  const result=await f.call('/api/preparation/jobs',{method:'POST',body:{entryId:entry.id,intent:'Préparer depuis une fiche avec lignes vides.',requestId:'blank-row-api'}});
  assert.equal(result.status,202);assert.equal(result.data.brief.resolvedContext.sessions[0].row,4);assert.equal(result.data.calls,0);
  const duplicate=await f.call('/api/preparation/jobs',{method:'POST',body:{entryId:entry.id,intent:'Préparer depuis une fiche avec lignes vides.',requestId:'blank-row-api'}});
  assert.equal(duplicate.data.id,result.data.id);
 }finally{await f.close();}
});
test('teacher preview tests the pinned exercise without creating student work or disclosing its answer',async()=>{
 const f=await httpFixture();try{
  const job=await buildPilot(f.store,f.actor,pilotDefinitions[0]),lesson=await f.store.get('lessons',job.lessonId),spec=(await f.store.get('lesson_versions',lesson.versionId)).spec;
  const task=spec.activities.find(a=>a.type==='CodeEditor'),path=`/api/lessons/${encodeURIComponent(lesson.id)}/preview/test`,body={lessonVersionId:lesson.versionId,taskId:task.id,code:task.reference};
  const tables=['lessons','lesson_versions','learning_events','learning_progress','assessment_attempts','submissions','work_submissions'],before=await Promise.all(tables.map(t=>f.store.list(t)));
  const result=await f.call(path,{method:'POST',body});assert.equal(result.status,200);assert.equal(result.data.ok,true);
  for(const key of ['reference','expectedAnswer','tests'])assert.equal(result.data[key],undefined);
  assert.equal((await f.call(path,{method:'POST',body,cookie:f.student})).status,403);
  for(const patch of [{lessonVersionId:'old-version'},{taskId:'absent'},{code:'x'.repeat(10001)}])assert.equal((await f.call(path,{method:'POST',body:{...body,...patch}})).status,400);
  assert.equal((await f.call(path,{method:'POST'})).status,400);
  assert.equal((await f.call(`/api/lessons/${encodeURIComponent(lesson.id)}/preview`,{method:'POST'})).status,200);
  assert.equal((await f.call(`/api/lessons/${encodeURIComponent(lesson.id)}/preview`,{method:'POST',body:{lessonVersionId:'old-version'}})).status,400);
  const otherLesson={...lesson,id:'other-class-lesson',classId:'B2'};await f.store.insert('lessons',otherLesson);
  assert.equal((await f.call('/api/lessons/other-class-lesson/preview/test',{method:'POST',body})).status,404);await f.store.remove('lessons',otherLesson.id);
  assert.deepEqual(await Promise.all(tables.map(t=>f.store.list(t))),before);
 }finally{await f.close();}
});
test('fixture and stale validation block publication; learner APIs never leak reviewer metadata',async()=>{
 const f=await httpFixture();try{
 const job=await buildPilot(f.store,f.actor,pilotDefinitions[0]),lesson=await f.store.get('lessons',job.lessonId);
 const publish=await f.call(`/api/lessons/${encodeURIComponent(lesson.id)}/publish`,{method:'POST',body:{confirmed:true,version:lesson.version}});assert.equal(publish.status,422);
 lesson.status='published';lesson.runId='test-run';await f.store.put('lessons',lesson);await grantFixture(f.store,lesson,await f.store.get('learners','private-student'));
 const today=await f.call('/api/today?date=2026-10-05',{cookie:f.student});assert.equal(today.status,200);for(const key of ['qualityJobId','pedagogicalValidation','quality','provider','agentRunId'])assert.equal(today.data.lesson[key],undefined,key);
 assert.equal(today.data.lesson.spec.blocks.find(b=>b.id==='concept').depth,undefined);
 }finally{await f.close();}
});
test('real lab route requires publication, diagnostic, ownership and configured service',async()=>{
 const f=await httpFixture();try{
 const job=await buildPilot(f.store,f.actor,pilotDefinitions[2]),lesson=await f.store.get('lessons',job.lessonId),body={lessonId:lesson.id,lessonVersionId:lesson.versionId,activityId:'guided'};
 assert.equal((await f.call('/api/labs',{method:'POST',cookie:f.student,body})).status,404);
 lesson.status='published';await f.store.put('lessons',lesson);await grantFixture(f.store,lesson,await f.store.get('learners','private-student'));
 assert.equal((await f.call('/api/labs',{method:'POST',cookie:f.student,body})).status,400);
 await f.store.insert('assessment_attempts',{id:'done',classId:'A1',learnerId:'private-student',lessonVersionId:lesson.versionId,submissionId:'saved'});
 await grantFixture(f.store,lesson,await f.store.get('learners','private-student'));
 const missing=await f.call('/api/labs',{method:'POST',cookie:f.student,body});assert.equal(missing.status,503);assert.match(missing.data.error,/Aucune commande/);
 assert.equal((await f.store.list('lab_sessions','A1')).length,0);
 }finally{await f.close();}
});
test('cancellation while a provider call is running keeps its trace without installing its result',async()=>{
 const {store,actor}=await pedagogyFixture();try{
 const job=await enqueueGeneration(store,actor,{entryId:'box',intent:'Prepare'},{config:qualityConfig({EDEN_AI_MODEL:'gpt-6.1-sol'}),simulation:true});await runGenerationStep(store);
 let started,finish;const ready=new Promise(r=>started=r),response=new Promise(r=>finish=r);
 const running=runGenerationStep(store,{call:async()=>{started();return response;}});await ready;await cancelGeneration(store,job.id,actor);finish({value:{},trace:{role:'design',status:'completed',costUSD:0}});const result=await running;assert.equal(result.status,'cancelled');assert.equal((await store.list('generation_calls',actor.classId)).length,1);assert.equal((await store.list('generation_candidates',actor.classId)).length,0);
 }finally{await store.close();}
});
