import test from 'node:test';
import assert from 'node:assert/strict';
import {pedagogyFixture,pilotDefinitions,pilotSpec,fixtureResponder,fixtureCapabilities} from './fixtures/pedagogy.mjs';
import {chatgptFixture} from './fixtures/chatgpt.mjs';
import {enqueueGeneration,runGenerationStep,cancelGeneration,resumeGeneration,ownedJob,jobSummary} from '../server/pedagogy/jobs.mjs';
import {qualityConfig,callStructured} from '../server/pedagogy/provider.mjs';
import {savePreferences,freezeProvider} from '../server/ai/settings.mjs';
import {aiError,planError} from '../server/ai/errors.mjs';
import {importDocument} from '../server/pedagogy/documents.mjs';
import {proposeRubricCorrection} from '../server/assessment.mjs';
import {generateLesson} from '../server/generator.mjs';

const config=()=>({...qualityConfig({OPENAI_MODEL:'gpt-5.4'}),provider:'openai_api'});
const input={entryId:'box',intent:'Préparer un cours',requestId:'same-action'};
test('explicit ChatGPT resume updates an old call timeout without resetting frozen identity, progress or budgets',async()=>{
 const {store,actor}=await pedagogyFixture(),f=await chatgptFixture();try{
  const {profileId}=await f.connect({actor});await savePreferences(store,actor,{provider:'chatgpt_plan',connectionId:profileId,model:'account-model'},{chatgpt:f.client});
  const settings=await freezeProvider(store,actor,{chatgpt:f.client,env:{}});assert.equal(settings.timeoutMs,600000);
  const job=await enqueueGeneration(store,actor,input,{config:{...settings,timeoutMs:180000},simulation:true});await runGenerationStep(store);
  const blocked=await runGenerationStep(store,{call:async()=>{throw Object.assign(aiError('uncertain','Legacy timeout'),{partialOutput:'{"partial":'});}});
  assert.equal(blocked.status,'blocked');assert.equal(await runGenerationStep(store),null);
  assert.equal((await resumeGeneration(store,job.id,actor,{}, {chatgpt:f.client,env:{}})).status,'blocked');
  assert.equal((await store.get('generation_jobs',job.id)).config.timeoutMs,180000);
  const resumed=await resumeGeneration(store,job.id,actor,{confirmed:true},{chatgpt:f.client,env:{}});
  assert.equal(resumed.config.timeoutMs,600000);
  assert.deepEqual(resumed.config,{...blocked.config,timeoutMs:600000});
  for(const key of ['startedAt','calls','lessonId','lessonVersionId','stage','unitIndex','iteration'])assert.equal(resumed[key],blocked[key],key);
  assert.equal(resumed.providerError,null);assert.equal(resumed.events.at(-1).previousTimeoutMs,180000);
  assert.equal((await store.list('generation_calls',actor.classId))[0].partialOutput,'{"partial":');
 }finally{await store.close();await f.close();}
});
test('an individual call cannot run beyond the remaining preparation time budget',async()=>{
 const {store,actor}=await pedagogyFixture();try{
  const job=await enqueueGeneration(store,actor,input,{config:config(),simulation:true});await runGenerationStep(store);
  const saved=await store.get('generation_jobs',job.id);saved.config.timeoutMs=600000;saved.config.maxDurationMs=10000;saved.startedAt=new Date(Date.now()-5000).toISOString();await store.put('generation_jobs',saved);
  let effectiveTimeout;
  await runGenerationStep(store,{call:async args=>{effectiveTimeout=args.config.timeoutMs;throw aiError('uncertain','Stopped test call');}});
  assert.ok(effectiveTimeout>0&&effectiveTimeout<=5000);
  assert.equal((await store.get('generation_jobs',job.id)).config.timeoutMs,600000);
 }finally{await store.close();}
});
test('schema rejection stays blocked until explicit recovery, including jobs saved with no recovery field',async()=>{
 const {store,actor}=await pedagogyFixture();try{
  const job=await enqueueGeneration(store,actor,input,{config:config(),simulation:true});await runGenerationStep(store);
  let calls=0;
  const call=async()=>{calls++;throw planError({error:{code:'invalid_json_schema',param:'text.format.schema'}},400);};
  const blocked=await runGenerationStep(store,{call});
  assert.equal(blocked.status,'blocked');assert.equal(blocked.recovery,null);assert.equal(jobSummary(blocked).canResume,true);
  assert.equal(await runGenerationStep(store,{call}),null);assert.equal(calls,1);
  assert.equal((await resumeGeneration(store,job.id,actor,{})).status,'blocked');
  const resumed=await resumeGeneration(store,job.id,actor,{confirmed:true});
  assert.equal(resumed.status,'queued');assert.equal(resumed.stage,'analysis');assert.equal(resumed.lessonId,blocked.lessonId);assert.equal(resumed.calls,1);
  assert.equal(resumed.events.at(-1).recovery,'schema_rejected');
  // Older failures have only the provider code. Preserve source and budget guards.
  delete blocked.recovery;blocked.sourceChanged=true;await store.put('generation_jobs',blocked);
  assert.equal(jobSummary(blocked).canResume,false);await assert.rejects(resumeGeneration(store,job.id,actor,{confirmed:true}),/nouvelle demande/);
  blocked.sourceChanged=false;blocked.startedAt='2000-01-01';await store.put('generation_jobs',blocked);
  await assert.rejects(resumeGeneration(store,job.id,actor,{confirmed:true}),/Budget/);
  blocked.providerError.code='unrelated_failure';await store.put('generation_jobs',blocked);
  assert.equal(jobSummary(blocked).canResume,false);
 }finally{await store.close();}
});
test('owner-scoped idempotence freezes provider, connection and model; another teacher cannot read or cancel',async()=>{
 const {store,actor}=await pedagogyFixture(),f=await chatgptFixture();try{
  const {profileId}=await f.connect({actor});await savePreferences(store,actor,{provider:'chatgpt_plan',connectionId:profileId,model:'account-model'},{chatgpt:f.client});
  const a=await enqueueGeneration(store,actor,input,{chatgpt:f.client});assert.equal(a.config.provider,'chatgpt_plan');assert.equal(a.config.connectionId,profileId);
  await savePreferences(store,actor,{provider:'openai_api'});const b=await enqueueGeneration(store,actor,input,{chatgpt:f.client});assert.equal(b.id,a.id);assert.equal(b.config.roles.review.model,'account-model');
  await assert.rejects(enqueueGeneration(store,actor,{...input,intent:'changed'},{chatgpt:f.client}),/autre contenu/);
  const other={...actor,id:'teacher-two'};await store.insert('teachers',other);await assert.rejects(ownedJob(store,a.id,other),/introuvable/);await assert.rejects(cancelGeneration(store,a.id,other),/introuvable/);
  const independent=await enqueueGeneration(store,other,input,{config:config(),simulation:true});assert.notEqual(independent.id,a.id);
 }finally{await store.close();await f.close();}
});
test('all pedagogical stages share the same plan provider and retain frontend/programming/shell contracts',async()=>{
 for(const pilot of pilotDefinitions){const {store,actor}=await pedagogyFixture(),f=await chatgptFixture();try{
  const {profileId}=await f.connect({actor});await savePreferences(store,actor,{provider:'chatgpt_plan',connectionId:profileId,model:'account-model'},{chatgpt:f.client});
  const settings=await freezeProvider(store,actor,{chatgpt:f.client});const source=await importDocument(store,actor,{filename:pilot.id+'.md',role:'technical'},Buffer.from(pilot.source));
  let job=await enqueueGeneration(store,actor,{entryId:pilot.id,intent:'Test pédagogique',sourceIds:[source.id]},{config:settings,simulation:true});await runGenerationStep(store);
  job=await store.get('generation_jobs',job.id);job.capabilities=fixtureCapabilities();job.workingSpec=pilotSpec(pilot,job.workingSpec);job.baseline=structuredClone(job.workingSpec);await store.put('generation_jobs',job);
  const responder=fixtureResponder(pilot),roles=[];
  const call=async args=>callStructured({...args,chatgpt:f.client,apiKey:'forbidden-fallback',fetchImpl:async(url,options)=>{
   assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.headers.Authorization,'Bearer synthetic-access');const body=JSON.parse(options.body);assert.equal(body.stream,true);assert.equal(body.max_output_tokens,undefined);assert.deepEqual(JSON.parse(body.input[0].content[0].text),args.input);roles.push(args.role);
   const {value}=await responder(args);return new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',model:'account-model',output:[{content:[{type:'output_text',text:JSON.stringify(value)}]}]}})+'\n\n',{headers:{'content-type':'text/event-stream'}});
  }});
  for(let i=0;i<25&&['queued','running'].includes(job.status);i++)job=await runGenerationStep(store,{call,inspect:async()=>({status:'PASS',evidence:'Controlled fixture render'}),labCheck:async spec=>Object.fromEntries(spec.activities.filter(a=>['shell-git','dom'].includes(a.workshop?.profile)).map(a=>[a.id,{status:'PASS',evidence:'Controlled lab fixture; no real lab executed'}]))});
  assert.equal(job.status,'fixture',job.reason);for(const role of ['design','planReview','write','review','repair'])assert.ok(roles.includes(role),role);
  assert.ok(job.workingSpec.blocks.some(b=>b.phase==='diagnostic'));assert.ok(job.workingSpec.activities.some(a=>['CodeEditor','Terminal'].includes(a.type)));
  assert.equal(job.workingSpec.activities.find(a=>a.id==='guided').workshop.profile,job.baseline.activities.find(a=>a.id==='guided').workshop.profile);
  assert.ok((await store.list('generation_calls',actor.classId)).every(c=>c.trace.provider==='chatgpt_plan'&&c.trace.costUSD===null));
 }finally{await store.close();await f.close();}}
});
test('API side paths are blocked before network use when ChatGPT is selected',async()=>{
 const {store,actor}=await pedagogyFixture();try{
  const t=await store.get('teachers',actor.id);t.aiPreferences={provider:'chatgpt_plan',connectionId:'one',model:'account-model'};await store.put('teachers',t);
  await assert.rejects(proposeRubricCorrection(store,'unused',actor,{}),/Choisissez explicitement/);
  await assert.rejects(generateLesson(store,{intent:'test'},actor,{entryId:'box'}),/Aucun appel API/);
 }finally{await store.close();}
});
test('one active generation per connection; lease loss and expired worker cannot install results',async()=>{
 const {store,actor}=await pedagogyFixture();try{
  const a=await enqueueGeneration(store,actor,input,{config:config(),simulation:true});await runGenerationStep(store);
  const b=await enqueueGeneration(store,actor,{...input,requestId:'next'},{config:config(),simulation:true});
  let start,finish;const started=new Promise(r=>start=r),result=new Promise(r=>finish=r);
  const running=runGenerationStep(store,{call:async()=>{start();return result;}});await started;
  assert.equal(await runGenerationStep(store),null);assert.equal((await store.get('generation_jobs',b.id)).stage,'assemble');
  await store.transaction(async tx=>{const current=await tx.get('generation_jobs',a.id);current.leaseUntil='2000-01-01';await tx.put('generation_jobs',current);});
  await runGenerationStep(store);finish(await fixtureResponder(pilotDefinitions[0])({role:'analysis',input:{sources:(await store.get('generation_jobs',a.id)).sources}}));await running;
  const saved=await store.get('generation_jobs',a.id);assert.equal(saved.status,'blocked');assert.equal(saved.recovery,'uncertain');assert.equal((await store.list('generation_calls',actor.classId))[0].outcome,'discarded');
 }finally{await store.close();}
});
test('temporary retries persist schedule, respect Retry-After and stop after three attempts',async()=>{
 const {store,actor}=await pedagogyFixture();try{
  const job=await enqueueGeneration(store,actor,input,{config:config(),simulation:true});await runGenerationStep(store);let calls=0;
  const call=async()=>{calls++;throw aiError('temporary','Incident temporaire',{retryAfterSeconds:120});};
  for(let i=0;i<3;i++){const before=Date.now(),r=await runGenerationStep(store,{call});if(i<2){assert.equal(r.status,'retry_wait');assert.ok(Date.parse(r.availableAt)>=before+120000);assert.equal(await runGenerationStep(store,{call}),null);r.availableAt='2000-01-01';await store.put('generation_jobs',r);}else assert.equal(r.status,'blocked');}
  assert.equal(calls,3);assert.equal((await store.get('generation_jobs',job.id)).calls,3);
 }finally{await store.close();}
});
test('incomplete and unknown outcomes keep fragments and require explicit resumption; cancellation aborts transport',async()=>{
 const {store,actor}=await pedagogyFixture();try{
  const job=await enqueueGeneration(store,actor,input,{config:config(),simulation:true});await runGenerationStep(store);
  let r=await runGenerationStep(store,{call:async()=>{throw Object.assign(aiError('incomplete','Incomplete'),{partialOutput:'{"draft":'});}});
  assert.equal(r.recovery,'incomplete');assert.equal((await store.list('generation_calls',actor.classId))[0].partialOutput,'{"draft":');assert.equal(await runGenerationStep(store),null);
  assert.equal((await resumeGeneration(store,job.id,actor,{})).status,'blocked');await resumeGeneration(store,job.id,actor,{confirmed:true});
  let started;const ready=new Promise(r=>started=r);
  const running=runGenerationStep(store,{call:async({signal})=>{started();await new Promise((resolve,reject)=>{signal.addEventListener('abort',()=>reject(aiError('uncertain','Aborted')),{once:true});});}});
  await ready;await cancelGeneration(store,job.id,actor);r=await running;assert.equal(r.status,'cancelled');assert.equal((await store.list('generation_candidates',actor.classId)).length,0);
 }finally{await store.close();}
});
test('a late candidate never overwrites a newer teacher revision',async()=>{
 const {store,actor}=await pedagogyFixture();try{
  const job=await enqueueGeneration(store,actor,input,{config:config(),simulation:true});await runGenerationStep(store);
  const j=await store.get('generation_jobs',job.id),lesson=await store.get('lessons',j.lessonId);lesson.versionId='newer-version';lesson.version++;await store.put('lessons',lesson);j.stage='checks';await store.put('generation_jobs',j);
  const result=await runGenerationStep(store);assert.equal(result.status,'blocked');assert.match(result.reason,/modifié/);assert.equal((await store.get('lessons',lesson.id)).versionId,'newer-version');assert.equal((await store.list('generation_candidates',actor.classId)).length,0);
 }finally{await store.close();}
});
