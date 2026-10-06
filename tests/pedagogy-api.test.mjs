import test from 'node:test';
import assert from 'node:assert/strict';
import {pedagogyFixture,buildPilot,pilotDefinitions} from './fixtures/pedagogy.mjs';
import {createApp} from '../server/app.mjs';
import {passwordHash} from '../server/auth.mjs';
import {qualityConfig} from '../server/pedagogy/provider.mjs';
import {enqueueGeneration,runGenerationStep,cancelGeneration} from '../server/pedagogy/jobs.mjs';

async function httpFixture(){
 const fixture=await pedagogyFixture(),{store,actor}=fixture;
 await store.insert('learners',{id:'private-student',classId:'A1',role:'student',username:'student',passwordHash:passwordHash('test-student-123')});
 const server=createApp(store).listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});const base=`http://127.0.0.1:${server.address().port}`;
 const login=async(role,username,password)=>{const r=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,username,password})});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const teacher=await login('teacher','professeur','quality-preview-only'),student=await login('student','student','test-student-123');
 const call=async(path,{method='GET',body,cookie=teacher,headers={}}={})=>{const r=await fetch(base+path,{method,headers:{Cookie:cookie,'Content-Type':'application/json',...headers},body:body===undefined?undefined:Buffer.isBuffer(body)?body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 return {...fixture,server,base,teacher,student,call,close:async()=>{await new Promise(r=>server.close(r));await store.close();}};
}
test('teacher import is connected, originals private, jobs report missing AI and cannot be opened cross-role',async()=>{
 const f=await httpFixture();try{
 const source=await f.call('/api/preparation/sources',{method:'POST',headers:{'Content-Type':'application/octet-stream','X-Source-Filename':'corrige.md','X-Source-Role':'solution'},body:Buffer.from('# Corrigé\nreturn true;')});assert.equal(source.status,201);assert.equal(source.data.visibility,'teacher');assert.equal(source.data.originalBase64,undefined);
 for(const path of ['/api/preparation/sources',`/api/preparation/sources/${source.data.id}/original`,'/api/preparation/jobs'])assert.equal((await f.call(path,{cookie:f.student})).status,403);
 const job=await f.call('/api/preparation/jobs',{method:'POST',body:{entryId:'box',intent:'Approfondir',sourceIds:[source.data.id],requestId:'api-1'}});assert.equal(job.status,202);assert.equal(job.data.status,'blocked');assert.equal(job.data.calls,0);
 assert.equal((await f.call(`/api/preparation/jobs/${job.data.id}`,{cookie:f.student})).status,403);
 const generate=await f.call('/api/lessons/generate',{method:'POST',body:{entryId:'box',intent:'Préparer'}});assert.equal(generate.status,202);assert.equal(generate.data.kind,'preparation_job');
 }finally{await f.close();}
});
test('fixture and stale validation block publication; learner APIs never leak reviewer metadata',async()=>{
 const f=await httpFixture();try{
 const job=await buildPilot(f.store,f.actor,pilotDefinitions[0]),lesson=await f.store.get('lessons',job.lessonId);
 const publish=await f.call(`/api/lessons/${encodeURIComponent(lesson.id)}/publish`,{method:'POST',body:{confirmed:true,version:lesson.version}});assert.equal(publish.status,422);
 lesson.status='published';lesson.runId='test-run';await f.store.put('lessons',lesson);
 const today=await f.call('/api/today?date=2026-10-05',{cookie:f.student});assert.equal(today.status,200);for(const key of ['qualityJobId','pedagogicalValidation','quality','provider','agentRunId'])assert.equal(today.data.lesson[key],undefined,key);
 assert.equal(today.data.lesson.spec.blocks.find(b=>b.id==='concept').depth,undefined);
 }finally{await f.close();}
});
test('real lab route requires publication, diagnostic, ownership and configured service',async()=>{
 const f=await httpFixture();try{
 const job=await buildPilot(f.store,f.actor,pilotDefinitions[2]),lesson=await f.store.get('lessons',job.lessonId),body={lessonId:lesson.id,lessonVersionId:lesson.versionId,activityId:'guided'};
 assert.equal((await f.call('/api/labs',{method:'POST',cookie:f.student,body})).status,400);
 lesson.status='published';await f.store.put('lessons',lesson);
 assert.equal((await f.call('/api/labs',{method:'POST',cookie:f.student,body})).status,400);
 await f.store.insert('assessment_attempts',{id:'done',classId:'A1',learnerId:'private-student',lessonVersionId:lesson.versionId,submissionId:'saved'});
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
