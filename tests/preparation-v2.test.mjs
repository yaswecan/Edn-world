import test from 'node:test';
import assert from 'node:assert/strict';
import {pedagogyFixture,pilotDefinitions,pilotSpec,fixtureResponder,fixtureCapabilities} from './fixtures/pedagogy.mjs';
import {enqueueGeneration,runGenerationStep,resumeGeneration,reconcilePreparation,reviseGeneration,cancelGeneration,jobSummary,choosePreparationSession} from '../server/pedagogy/jobs.mjs';
import {qualityConfig,retrieveStructured,callStructured} from '../server/pedagogy/provider.mjs';
import {aiError} from '../server/ai/errors.mjs';
import {contractIssues,designContext} from '../server/pedagogy/design.mjs';
import {planReviewSchema,planSchemaFor} from '../server/pedagogy/contracts.mjs';
import {validate} from '../server/contracts.mjs';
import {runSafe} from '../server/safe-js.mjs';
import {importDocument} from '../server/pedagogy/documents.mjs';
import {studentSpec} from '../server/generator.mjs';
import {testActivityCode} from '../server/workshop-testing.mjs';
import {compileCorpus,downloadableCorpus} from '../server/corpus.mjs';

async function fixture({maxCalls=24}={}){
 const {store,actor}=await pedagogyFixture(),pilot=pilotDefinitions[1],respond=fixtureResponder(pilot);
 const source=await importDocument(store,actor,{filename:'logic-v2.md',role:'technical'},Buffer.from(pilot.source));
 const job=await enqueueGeneration(store,actor,{entryId:pilot.id,intent:'Contrat et reprise V2',sourceIds:[source.id]},{config:{...qualityConfig({EDEN_AI_MODEL:'gpt-6.1-sol'}),maxCalls},simulation:true});
 await runGenerationStep(store);const current=await store.get('generation_jobs',job.id);current.workingSpec=pilotSpec(pilot,current.workingSpec);current.baseline=structuredClone(current.workingSpec);current.capabilities=fixtureCapabilities();await store.put('generation_jobs',current);
 return {store,actor,job:current,respond,read:()=>store.get('generation_jobs',job.id),step:()=>runGenerationStep(store,{call:respond})};
}
test('submission is durable before transport, with revision, input hash, policy and reservation',async()=>{
 const f=await fixture();try{
  const result=await runGenerationStep(f.store,{call:async args=>{
   const j=await f.read(),row=await f.store.get('generation_calls',j.inflight.id);
   assert.equal(row.outcome,'submitting');assert.equal(row.revision,1);assert.equal(row.inputHash.length,64);assert.match(row.policyVersion,/2026-10-07/);assert.equal(j.calls,1);assert.ok(j.reservedUSD>0);
   await args.onEvent({type:'response.created',responseId:'remote-1',status:'in_progress'});
   assert.equal((await f.store.get('generation_calls',j.inflight.id)).responseId,'remote-1');return f.respond(args);
  }});
  assert.equal(result.stage,'design');assert.ok(result.documentary);assert.equal(jobSummary(result).candidateCount,0);
 }finally{await f.store.close();}
});
test('a changed context never turns saved-response reconciliation into a new paid call',async()=>{
 const f=await fixture();try{
  await f.step();const j=await f.read();j.stage='analysis';j.brief.intent='Changed after the first response';j.status='queued';await f.store.put('generation_jobs',j);
  let submitted=0;const result=await runGenerationStep(f.store,{call:async()=>{submitted++;throw Error('Must not submit');}});
  assert.equal(submitted,0);assert.equal(result.status,'blocked');assert.equal(result.providerError.kind,'context_changed');assert.equal(result.calls,1);
 }finally{await f.store.close();}
});
test('a local design error gets one bounded correction before writing, then remains blocked',async()=>{
 const f=await fixture();try{
  await f.step();let designs=0;
  const bad=async args=>{const result=await f.respond(args);if(args.role==='design'){designs++;result.value.analysis[0].prerequisites=['unprepared'];}return result;};
  const first=await runGenerationStep(f.store,{call:bad});assert.equal(first.status,'queued');assert.equal(first.stage,'design');assert.equal(first.planRevisions,1);
  const second=await runGenerationStep(f.store,{call:bad});assert.equal(second.status,'blocked');assert.equal(second.stage,'design');assert.equal(designs,2);assert.ok(second.documentary);
  assert.equal((await reconcilePreparation(f.store,f.job.id,f.actor)).status,'blocked');assert.equal((await f.read()).calls,3);
 }finally{await f.store.close();}
});
test('the provider response schema constrains curriculum and activity identities before generation',async()=>{
 const f=await fixture();try{
  const result=await f.respond({role:'design',input:{skeleton:f.job.workingSpec,sources:f.job.sources}}),schema=planSchemaFor(f.job.workingSpec,f.job.sources);
  validate(schema,result.value);result.value.coverage[0].skill+=' — invented label';assert.throws(()=>validate(schema,result.value));
  result.value.coverage[0].skill=f.job.workingSpec.skills[0];result.value.contract.finalTask.activityId='unknown';assert.throws(()=>validate(schema,result.value));
 }finally{await f.store.close();}
});
test('a corrected local validator can reuse a complete plan without another inference or budget reset',async()=>{
 const f=await fixture({maxCalls:2});try{
  await f.step();const designed=await f.step();assert.equal(designed.stage,'planReview');
  designed.stage='design';designed.status='blocked';designed.providerError={kind:'design_contract'};designed.reason='Obsolete local rejection';await f.store.put('generation_jobs',designed);
  const reconciled=await reconcilePreparation(f.store,designed.id,f.actor);assert.equal(reconciled.reconciliation,'saved_result');
  const adopted=await runGenerationStep(f.store,{call:async()=>assert.fail('Saved design must not be regenerated')});
  assert.equal(adopted.stage,'planReview');assert.equal(adopted.calls,2);assert.equal(adopted.config.maxCalls,2);
 }finally{await f.store.close();}
});
test('public examples show actual results without exposing private tests or validation variants',async()=>{
 const task={type:'CodeEditor',correctionMode:'javascript',tests:[{invoke:'double',argsJSON:'[12345]',expectedJSON:'24690'}],publicTests:[{invoke:'double',argsJSON:'[3]',expectedJSON:'6'}],validationVariants:{wrong:'private wrong',wrongExplanation:'private explanation',alternative:'private alternate'}};
 const output=await testActivityCode(task,'function double(n){ return n * 2; }');assert.equal(output.ok,true);assert.equal(output.examples[0].actual,6);assert.doesNotMatch(JSON.stringify(output),/12345|24690|private/);
 const failed=await testActivityCode(task,'function double(n){ return n + 2; }');assert.equal(failed.examples[0].actual,5);assert.equal(failed.ok,false);
 const safe=studentSpec({teacherGuide:'private',blocks:[],activities:[task],diagnostic:{tasks:[]}});assert.equal(safe.activities[0].tests,undefined);assert.equal(safe.activities[0].validationVariants,undefined);assert.deepEqual(safe.activities[0].publicTests,task.publicTests);
});
test('ambiguous sequence rows preserve documentary work but require an explicit choice before design',async()=>{
 const f=await fixture();try{
  const j=await f.read();j.brief.resolvedContext={hash:'initial',sessions:[{id:'one',row:8},{id:'two',row:12}]};await f.store.put('generation_jobs',j);
  const analysed=await f.step();assert.equal(analysed.status,'blocked');assert.equal(analysed.stage,'context');assert.equal(analysed.calls,1);
  await assert.rejects(choosePreparationSession(f.store,j.id,f.actor,{sessionId:'missing',expectedRevision:1}));
  const chosen=await choosePreparationSession(f.store,j.id,f.actor,{sessionId:'two',expectedRevision:1});assert.equal(chosen.stage,'design');assert.equal(chosen.brief.resolvedContext.sessions[0].row,12);assert.deepEqual(chosen.documentary,analysed.documentary);assert.equal(chosen.calls,1);
 }finally{await f.store.close();}
});
test('partial exports stay pinned and missing or corrupted files stop the download',async()=>{
 const f=await fixture();try{
  const j=await f.read(),lesson=await f.store.get('lessons',j.lessonId),pack=await compileCorpus(f.store,lesson.id,f.actor);
  const download=await downloadableCorpus(f.store,lesson,f.actor,j.lessonVersionId);assert.equal(download.complete,false);assert.equal(download.manifest.completeness,'partial');
  const zipManifest=JSON.parse(Buffer.from(download.files.find(f=>f.path==='00_MANIFEST/manifest.json').base64,'base64'));assert.equal(zipManifest.completeness,'partial');assert.ok(zipManifest.missing.length);
  const original=structuredClone(pack);pack.files=pack.files.slice(1);await f.store.put('corpus_packages',pack);
  await assert.rejects(downloadableCorpus(f.store,lesson,f.actor,j.lessonVersionId),/manquant/);
  original.files[0].base64=Buffer.from('corrupted').toString('base64');await f.store.put('corpus_packages',original);
  await assert.rejects(downloadableCorpus(f.store,lesson,f.actor,j.lessonVersionId),/indisponible/);
  await assert.rejects(downloadableCorpus(f.store,lesson,{...f.actor,classId:'other'},j.lessonVersionId),/introuvable/);
 }finally{await f.store.close();}
});
test('reconnecting while the worker runs submits no duplicate request',async()=>{
 const f=await fixture();try{
  let started,finish;const ready=new Promise(r=>started=r),pending=new Promise(r=>finish=r);
  const run=runGenerationStep(f.store,{call:async args=>{started();await pending;return f.respond(args);}});await ready;
  const results=await Promise.all([reconcilePreparation(f.store,f.job.id,f.actor),resumeGeneration(f.store,f.job.id,f.actor,{action:'new_attempt'})]);
  assert.ok(results.every(j=>j.reconciliation==='worker_active'));assert.equal((await f.read()).calls,1);finish();await run;
 }finally{await f.store.close();}
});
test('independent jobs can progress concurrently while sharing one atomic call ceiling',async()=>{
 const f=await fixture();let release;
 try{
  const original=await f.read();Object.assign(original.config,{sharedBudgetId:'acceptance',sharedMaxCalls:1,maxConcurrentPerConnection:3});await f.store.put('generation_jobs',original);
  const sibling={...structuredClone(original),id:original.id+'-sibling'};await f.store.insert('generation_jobs',sibling);
  let started;const ready=new Promise(r=>started=r),pending=new Promise(r=>release=r);
  const first=runGenerationStep(f.store,{call:async args=>{started();await pending;return f.respond(args);}});await ready;
  const second=await runGenerationStep(f.store,{call:async()=>assert.fail('Shared ceiling exceeded')});
  assert.equal(second.id,sibling.id);assert.equal(second.status,'blocked');assert.match(second.reason,/Plafond global/);
  assert.equal((await f.store.list('generation_calls',f.actor.classId)).length,1);release();await first;
  assert.equal((await f.read()).stage,'design');
 }finally{release?.();await f.store.close();}
});
test('complete output survives a worker crash and is adopted without another call, even after the call budget',async()=>{
 const f=await fixture({maxCalls:1});try{
  const done=await f.step();done.stage='analysis';done.status='running';done.inflight={id:done.lastCallId};done.leaseUntil='2000-01-01';await f.store.put('generation_jobs',done);
  const result=await runGenerationStep(f.store,{call:async()=>assert.fail('Repeated provider submission')});
  assert.equal(result.stage,'design');assert.equal(result.calls,1);assert.ok(result.documentary);
 }finally{await f.store.close();}
});
test('unknown outcomes keep provisions; double retry authorizes only one new attempt',async()=>{
 const f=await fixture({maxCalls:2});try{
  const broken=await runGenerationStep(f.store,{call:async()=>{throw aiError('uncertain','Connection lost');}}),reserved=broken.reservedUSD;
  assert.equal((await reconcilePreparation(f.store,f.job.id,f.actor)).reconciliation,'unknown_unrecoverable');
  assert.equal((await resumeGeneration(f.store,f.job.id,f.actor,{})).calls,1);
  await Promise.all([resumeGeneration(f.store,f.job.id,f.actor,{action:'new_attempt'}),resumeGeneration(f.store,f.job.id,f.actor,{action:'new_attempt'})]);
  const recovered=await f.step();assert.equal(recovered.calls,2);assert.ok(recovered.reservedUSD>=reserved*2);
  const blocked=await f.step();assert.equal(blocked.status,'blocked');assert.match(blocked.reason,/Budget/);assert.equal(blocked.calls,2);
  const exhausted=jobSummary({...broken,calls:2});assert.equal(exhausted.canResume,false);assert.match(exhausted.budgetReason,/Plafond/);
  const expired=jobSummary({...broken,startedAt:'2000-01-01'});assert.equal(expired.canResume,false);assert.match(expired.budgetReason,/durée/);assert.equal(expired.canReconcile,true);
 }finally{await f.store.close();}
});
test('remote recovery queries once and adopts once; lookup failures do not release budget',async()=>{
 const f=await fixture();try{
  await runGenerationStep(f.store,{call:async()=>{throw aiError('uncertain','Transport lost');}});
  let row=(await f.store.list('generation_calls',f.actor.classId))[0];row.retrieval='responses-background';row.responseId='remote';await f.store.put('generation_calls',row);
  let lookups=0;const before=await f.read();const failed=await reconcilePreparation(f.store,f.job.id,f.actor,{retrieve:async()=>{lookups++;throw Error('temporarily absent');}});
  assert.equal(failed.reconciliation,'lookup_unknown');assert.equal((await f.read()).reservedUSD,before.reservedUSD);
  const value=await f.respond({role:'analysis',input:{sources:before.sources}});
  await reconcilePreparation(f.store,f.job.id,f.actor,{retrieve:async()=>{lookups++;return value;}});
  const adopted=await runGenerationStep(f.store,{call:async()=>assert.fail('No new submission')});
  assert.equal(adopted.stage,'design');assert.equal(adopted.calls,1);assert.equal(lookups,2);
 }finally{await f.store.close();}
});
test('cancellation retains a late response without reactivation or publication',async()=>{
 const f=await fixture();try{
  let started,finish;const ready=new Promise(r=>started=r),wait=new Promise(r=>finish=r);
  const run=runGenerationStep(f.store,{call:async args=>{started();await wait;return f.respond(args);}});await ready;
  await cancelGeneration(f.store,f.job.id,f.actor);finish();await run;
  const job=await f.read(),row=(await f.store.list('generation_calls',f.actor.classId))[0];assert.equal(job.status,'cancelled');assert.equal(row.outcome,'discarded');assert.ok(row.output);assert.ok(job.reservedUSD>0);assert.equal((await f.store.list('generation_candidates',f.actor.classId)).length,0);
 }finally{await f.store.close();}
});
test('background cancellation records the local stop before contacting the provider and keeps its provision',async()=>{
 const f=await fixture();try{
  await runGenerationStep(f.store,{call:async args=>{await args.onEvent({type:'response.created',responseId:'background-active',status:'in_progress'});return {pending:true,responseId:'background-active',status:'in_progress'};}});
  const attempt=(await f.store.list('generation_calls',f.actor.classId))[0];attempt.retrieval='responses-background';await f.store.put('generation_calls',attempt);
  const before=await f.read();let cancellations=0;
  const cancelled=await cancelGeneration(f.store,f.job.id,f.actor,{cancel:async()=>{assert.equal((await f.read()).status,'cancelled');cancellations++;return {attempted:true,confirmed:true,status:'cancelled'};}});
  assert.equal(cancellations,1);assert.equal(cancelled.reservedUSD,before.reservedUSD);assert.equal((await f.store.get('generation_calls',attempt.id)).providerState,'cancelled');
 }finally{await f.store.close();}
});
test('new rules fence an in-flight revision, preserve analysis and shared budgets, and retain old output',async()=>{
 const f=await fixture();try{
  await f.step();const analysed=await f.read();analysed.finishedAt='2000-01-01';await f.store.put('generation_jobs',analysed);let started,finish;const ready=new Promise(r=>started=r),wait=new Promise(r=>finish=r);
  const run=runGenerationStep(f.store,{call:async args=>{started();await wait;return f.respond(args);}});await ready;
  const revised=await reviseGeneration(f.store,f.job.id,f.actor,{expectedRevision:1});
  assert.equal(revised.finishedAt,null);
  assert.equal(revised.revision,2);assert.equal(revised.stage,'design');assert.deepEqual(revised.documentary,analysed.documentary);assert.equal(revised.calls,2);assert.equal(revised.config.maxCalls,analysed.config.maxCalls);
  assert.equal((await reviseGeneration(f.store,f.job.id,f.actor,{expectedRevision:1})).revision,2);
  finish();await run;assert.equal((await f.read()).plan,null);
  const row=(await f.store.list('generation_calls',f.actor.classId)).at(-1);assert.equal(row.revision,1);assert.equal(row.outcome,'discarded');assert.ok(row.output);
  assert.equal((await f.store.list('generation_revisions',f.actor.classId)).length,1);
 }finally{await f.store.close();}
});
test('plan gates reject missing proof, unsupported tools, impossible time and unprepared final task before writing',async()=>{
 const f=await fixture();try{
  await f.step();const designed=await f.step();assert.equal(designed.stage,'planReview',designed.reason);
  const check=mutate=>{const plan=structuredClone(designed.plan);mutate(plan.contract);return contractIssues(plan,designed.workingSpec,designContext(designed));};
  assert.ok(check(c=>c.outcomes[0].proof=' ').some(i=>i.location.includes('outcomes')));
  assert.ok(check(c=>c.activities.find(a=>a.activityId==='guided').capabilities.push('ssh')).some(i=>i.location.includes('runtime')));
  assert.ok(check(c=>c.finalTask.requiredConceptIds.push('future-loops')).some(i=>i.location.includes('prerequisites')));
  const prerequisitePlan=structuredClone(designed.plan),concept=prerequisitePlan.analysis[0].conceptId;
  prerequisitePlan.coverage.forEach(c=>c.conceptIds=c.conceptIds.filter(id=>id!==concept));
  prerequisitePlan.prerequisites=prerequisitePlan.prerequisites.filter(p=>p.conceptId!==concept);
  prerequisitePlan.contract.finalTask.requiredConceptIds=[concept];
  assert.ok(contractIssues(prerequisitePlan,designed.workingSpec,designContext(designed)).some(i=>i.location.includes('prerequisites')));
  prerequisitePlan.prerequisites.push({conceptId:concept,status:'unknown',evidence:'Diagnostic non réalisé ; aucun acquis supposé.',action:'Préparer dans concept, observer une réponse dans guided, puis aider avant le défi.'});
  assert.equal(contractIssues(prerequisitePlan,designed.workingSpec,designContext(designed)).some(i=>i.location.includes('prerequisites')),false);
  assert.ok(check(c=>c.timing[0].minutes=1000).some(i=>i.location.includes('timing')));
  assert.equal(jobSummary(designed).candidateCount,0);
 }finally{await f.store.close();}
});
test('plan review receives the current diagnostic and planned timing, never the obsolete baseline',async()=>{
 const f=await fixture();try{
  await f.step();await f.step();const j=await f.read();j.baseline.diagnostic.duration=15;await f.store.put('generation_jobs',j);
  let inspected=false;
  await runGenerationStep(f.store,{call:async args=>{
   assert.equal(args.role,'planReview');assert.equal(args.input.skeleton.diagnostic.duration,j.workingSpec.diagnostic.duration);
   assert.notEqual(args.input.skeleton.diagnostic.duration,j.baseline.diagnostic.duration);
   for(const timing of j.plan.contract.timing)assert.equal(args.input.skeleton.blocks.find(b=>b.id===timing.blockId).minutes,timing.minutes);
   assert.match(args.input.productionStage,/avant rédaction/);inspected=true;return f.respond(args);
  }});assert.equal(inspected,true);
 }finally{await f.store.close();}
});
test('one candidate allows independent review but rejects a second corpus without increasing the ceiling',async()=>{
 const f=await fixture();try{
  const j=await f.read();j.config.maxRewrites=0;await f.store.put('generation_jobs',j);
  let result;for(let n=0;n<10;n++){result=await f.step();if(result.status==='blocked')break;}
  assert.equal(result.status,'blocked');assert.equal(result.reports.length,1);assert.equal((await f.store.list('generation_candidates',f.actor.classId)).length,1);assert.equal(result.config.maxRewrites,0);
 }finally{await f.store.close();}
});
test('background API uses one submission then retrieves by id; ChatGPT retrieval stays disabled',async()=>{
 const config={...qualityConfig({EDEN_AI_MODEL:'gpt-6.1-sol'}),background:true};let sent,event;
 const result=await callStructured({role:'planReview',input:{},schema:planReviewSchema,config,apiKey:'test-only',onEvent:e=>event=e,fetchImpl:async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({id:'resp_1',status:'in_progress'})};}});
 assert.equal(sent.background,true);assert.equal(sent.store,false);assert.equal(result.pending,true);assert.equal(event.responseId,'resp_1');
 const attempt={responseId:'resp_1',retrieval:'responses-background',profile:config.roles.planReview,role:'planReview'};
 const restored=await retrieveStructured({attempt,config,schema:planReviewSchema,apiKey:'test-only',fetchImpl:async(url,options)=>{assert.match(url,/responses\/resp_1$/);assert.equal(options.method,undefined);return {ok:true,json:async()=>({id:'resp_1',status:'completed',output:[{content:[{type:'output_text',text:'{"decision":"accept","issues":[]}'}]}]})};}});
 assert.equal(restored.value.decision,'accept');
 await assert.rejects(retrieveStructured({attempt,config:{...config,provider:'chatgpt_plan'},schema:planReviewSchema}),/ne permet pas/);
});
test('debugger stops on executed student lines, exposes actual local variables and advances deterministically',()=>{
 const code='function decide(age) {\n const allowed = age >= 18;\n return allowed;\n}\n';
 const first=runSafe(code,{invoke:'decide',args:[16],debug:{breakpoints:[2]}});assert.equal(first.debug.paused,true);assert.equal(first.debug.current.line,2);assert.equal(first.debug.current.variables.age,16);assert.equal(first.debug.current.variables.allowed,undefined);
 const next=runSafe(code,{invoke:'decide',args:[16],debug:{pauseAt:first.debug.steps+1}});assert.equal(next.debug.current.line,3);assert.equal(next.debug.current.variables.allowed,false);
 const changed=runSafe(code.replace('>= 18','>= 15'),{invoke:'decide',args:[16],debug:{pauseAt:next.debug.steps}});assert.equal(changed.debug.current.variables.allowed,true);
 const done=runSafe(code,{invoke:'decide',args:[19],debug:{afterStep:next.debug.steps}});assert.equal(done.value,true);assert.equal(done.debug.paused,false);
 const bounded=runSafe('for (;;) {}',{debug:{}});assert.equal(bounded.ok,false);assert.equal(bounded.errorCode,'LIMIT');
});
