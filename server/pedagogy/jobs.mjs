import {uid,now,fail,requireValue,scoped} from '../store.mjs';
import {generateLesson,resolveEntry} from '../generator.mjs';
import {retrieveResources} from '../retrieval.mjs';
import {compileCorpus} from '../corpus.mjs';
import {qualityConfig,callStructured,estimateCall} from './provider.mjs';
import {sourceDossier} from './documents.mjs';
import {planSchema,planReviewSchema,unitSchema,reviewSchema,digest,CHARTER_VERSION} from './contracts.mjs';
import {mechanisms,runtimeProfiles} from './catalog.mjs';
import {validatePlan,applyPlanOrder,unitSlots,applyUnit,softwareChecks,candidateHash,decideQuality} from './quality.mjs';
import {prepareScaffold} from './scaffold.mjs';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';

export const qualityEnabled=()=>process.env.EDEN_QUALITY_PIPELINE==='1'||process.env.NODE_ENV!=='production'&&process.env.EDEN_QUALITY_PIPELINE!=='0';
export const jobSummary=job=>{const {workingSpec,baseline,referenceBaseline,sources,config,actor,...rest}=job;return {...rest,profiles:config?.roles,sourceVersions:sources?.map(s=>({id:s.id,title:s.title,contentHash:s.contentHash})),canCancel:['queued','running'].includes(job.status)};};
export async function enqueueGeneration(store,actor,input,{config=null,simulation=false}={}){
 requireValue(qualityEnabled(),'Préparation approfondie désactivée sur cette instance.');
 requireValue(typeof input.intent==='string'&&input.intent.trim()&&input.intent.length<=4000,'Intention requise, 4 000 caractères maximum.');
 const entry=input.entryId?await scoped(store,'plan_entries',input.entryId,actor):resolveEntry(await store.list('plan_entries',actor.classId),input);
 requireValue(entry.durationConfirmed,'Confirmer la durée de séance.');requireValue(entry.skills.length<=8,'Scinder la séance au-delà de huit compétences pour préserver la profondeur.');
 const sources=await sourceDossier(store,actor,input.sourceIds||[]),plan=(await store.list('plan_versions',actor.classId)).at(-1);
 requireValue(plan,'Planification absente.');
 let settings=config,unavailable=null;try{settings??=qualityConfig();if(!simulation&&!process.env.OPENAI_API_KEY)unavailable='OPENAI_API_KEY absente : aucun appel IA effectué.';}catch(e){unavailable=e.message;}
 return store.transaction(async tx=>{
  const previous=(await tx.list('generation_jobs',actor.classId)).find(j=>input.requestId&&j.requestId===input.requestId);if(previous)return previous;
  const job=await tx.insert('generation_jobs',{id:uid('prep'),classId:actor.classId,requestId:input.requestId||uid('request'),actor:{id:actor.id,classId:actor.classId,role:'teacher'},entryId:entry.id,sourceIds:sources.map(s=>s.id),sources,
   brief:{version:1,intent:input.intent,entry,planVersion:plan.version,constraints:input.constraints||[],priorLearning:'Seules les séances clôturées sont des preuves ; diagnostic du jour non réalisé.'},
   config:settings,simulation,status:unavailable?'blocked':'queued',stage:'assemble',reason:unavailable,events:[{stage:'queued',at:now()}],startedAt:now(),calls:0,reservedUSD:0,spentUSD:0,iteration:0,unitIndex:0,reports:[],planRevisions:0});
  await tx.audit(actor,'generation.queued',job.id,{simulation,sourceIds:job.sourceIds});return job;
 });
}
export async function cancelGeneration(store,id,actor){return store.transaction(async tx=>{const job=await scoped(tx,'generation_jobs',id,actor);requireValue(['queued','running'].includes(job.status),'Ce travail ne peut plus être annulé.');job.status='cancelled';job.reason='Annulé par le professeur. Un appel déjà envoyé peut être facturé.';job.finishedAt=now();await tx.put('generation_jobs',job);return job;});}
async function claim(store){return store.transaction(async tx=>{
 const job=(await tx.list('generation_jobs')).find(j=>j.status==='queued'||j.status==='running'&&Date.parse(j.leaseUntil||0)<Date.now());if(!job)return null;
 if(job.inflight){const saved=await tx.get('generation_calls',job.inflight.id);if(saved?.outcome==='completed')job.inflight=null;else{job.status='blocked';job.reason='Interruption pendant un appel fournisseur : résultat incertain. Aucun retry aveugle pour éviter une double facturation.';await tx.put('generation_jobs',job);return null;}}
 if(job.sourceChanged){job.status='blocked';job.reason=job.invalidationReason;await tx.put('generation_jobs',job);return null;}
 job.status='running';job.leaseToken=uid('lease');job.leaseUntil=new Date(Date.now()+300000).toISOString();job.events.push({stage:job.stage,iteration:job.iteration,unitIndex:job.unitIndex,at:now()});await tx.put('generation_jobs',job);return job;
});}
async function checkpoint(store,job){return store.transaction(async tx=>{const current=await tx.get('generation_jobs',job.id);if(current.status==='cancelled'||current.leaseToken!==job.leaseToken)fail(409,'Travail annulé ou repris par un autre worker.');if(current.sourceChanged){job.sourceChanged=true;job.invalidationReason=current.invalidationReason;}await tx.put('generation_jobs',job);return job;});}
async function invoke(store,job,role,input,schema,call,images=[]){
 const operationKey=`${job.id}:${job.stage}:${job.iteration}:${job.unitIndex}:${job.planRevisions}`;
 const saved=(await store.list('generation_calls',job.classId)).find(c=>c.operationKey===operationKey&&c.outcome==='completed');
 if(saved)return saved.output;
 const cost=estimateCall(job.config.roles[role],input,{role,schema,imageCount:images.length});
 requireValue(job.calls<job.config.maxCalls&&cost.usd<=job.config.maxCallUSD&&job.reservedUSD+cost.usd<=job.config.maxUSD,'Budget maximal d’appels ou de coût atteint.');
 requireValue(Date.now()-Date.parse(job.startedAt)<job.config.maxDurationMs,'Durée maximale de préparation atteinte.');
 const callId=`${job.id}:call:${job.calls+1}`;job.calls++;job.reservedUSD+=cost.usd;job.inflight={id:callId,role,at:now(),reservedUSD:cost.usd};await checkpoint(store,job);
 let result;
 try{result=await call({role,input,schema,config:job.config,images});}
 catch(e){await store.insert('generation_calls',{id:callId,classId:job.classId,jobId:job.id,operationKey,trace:e.trace||{role,error:e.message},outcome:'failed',reservedUSD:cost.usd});job.inflight=null;await checkpoint(store,job);throw e;}
 await store.insert('generation_calls',{id:callId,classId:job.classId,jobId:job.id,operationKey,trace:result.trace,outcome:'completed',output:result.value,outputHash:digest(result.value),reservedUSD:cost.usd});
 job.inflight=null;job.spentUSD+=result.trace?.costUSD||0;job.lastCallId=callId;
 // Keep reservation charged for the full job: an upper bound, even on unknown usage.
 await checkpoint(store,job);return result.value;
}
async function saveCandidate(store,job){
 return store.transaction(async tx=>{
  const current=await tx.get('generation_jobs',job.id);requireValue(current.status!=='cancelled'&&current.leaseToken===job.leaseToken,'Travail annulé.');
  const candidateId=`${job.id}:candidate:${job.iteration+1}`,existing=await tx.get('generation_candidates',candidateId);if(existing){job.workingSpec=existing.spec;return;}
  const lesson=await tx.get('lessons',job.lessonId);requireValue(lesson.status==='draft','La préparation ne remplace jamais une publication.');
  const version=lesson.version+1,versionId=`${lesson.id}:v${version}`;job.workingSpec.lessonVersion=version;
  await tx.insert('lesson_versions',{id:versionId,classId:job.classId,version,spec:job.workingSpec,authorId:job.actor.id,qualityJobId:job.id});
  await tx.insert('generation_candidates',{id:candidateId,classId:job.classId,jobId:job.id,iteration:job.iteration,spec:job.workingSpec,contentHash:candidateHash(job.workingSpec,job.sources),unitResponses:job.unitResponses||[],simulation:job.simulation});
  Object.assign(lesson,{version,versionId,title:job.workingSpec.title,provider:job.simulation?'fixture':'openai',preparationState:'reviewing'});await tx.put('lessons',lesson);
 });
}
export async function runGenerationStep(store,{call=callStructured,inspect=null,labCheck=null}={}){
 const job=await claim(store);if(!job)return null;
 const heartbeat=setInterval(()=>store.transaction(async tx=>{const current=await tx.get('generation_jobs',job.id);if(current?.status==='running'&&current.leaseToken===job.leaseToken){current.leaseUntil=new Date(Date.now()+300000).toISOString();await tx.put('generation_jobs',current);}}).catch(()=>{}),30000);heartbeat.unref();
 try{
  requireValue(Date.now()-Date.parse(job.startedAt)<job.config.maxDurationMs,'Durée maximale atteinte.');
  const currentPlan=(await store.list('plan_versions',job.classId)).at(-1);requireValue(currentPlan?.version===job.brief.planVersion,'Le plan a changé : préparer un nouveau brouillon.');
  if(job.stage==='assemble'){
   let lesson=(await store.list('lessons',job.classId)).find(l=>l.qualityJobId===job.id);
   if(!lesson)lesson=await generateLesson(store,{classId:job.classId,intent:job.brief.intent,mode:'prepare',constraints:job.brief.constraints},job.actor,{entryId:job.entryId,localOnly:true,qualityJobId:job.id});
   const version=await store.get('lesson_versions',lesson.versionId);job.lessonId=lesson.id;job.baseline=version.spec;job.workingSpec=prepareScaffold(version.spec,{diagnosticMinutes:process.env.EDEN_DIAGNOSTIC_MINUTES||8});
   const references=await retrieveResources(store,job.classId,{criteria:version.spec.skills,query:job.brief.entry.objective,limit:12});
   job.sources.push(...references.filter(r=>version.spec.skills.includes(r.resourceId)).map(r=>({id:r.id,title:r.title,role:'reference',contentHash:r.sourceVersion,status:'extracted',warnings:['Bibliothèque locale ; qualité technique à examiner, non validée par le professeur.'],segments:[{id:`${r.id}:full`,parent:r.title,location:`NEXUS/${r.resourceId}`,text:JSON.stringify(r.resource),visibility:'teacher'}]})));
   job.brief.previousSource=version.spec.sourceVersions.previousLessonRunId;job.stage='design';
  }else if(job.stage==='design'){
   job.plan=validatePlan(await invoke(store,job,'design',{brief:job.brief,sources:job.sources,skeleton:job.workingSpec,mechanisms,runtimeProfiles,previousPlanIssues:job.planReview?.issues||[]},planSchema,call),job.workingSpec,job.sources);job.stage='planReview';
  }else if(job.stage==='planReview'){
   job.planReview=await invoke(store,job,'planReview',{brief:job.brief,sources:job.sources,plan:job.plan,skeleton:job.baseline},planReviewSchema,call);
   if(job.planReview.decision==='accept'&&!job.planReview.issues.length){
    job.workingSpec=applyPlanOrder(job.workingSpec,job.plan);job.stage='write';job.unitIndex=0;job.unitResponses=[];
    for(const id of job.sourceIds){const source=await store.get('pedagogical_sources',id);if(source){source.analysisStatus=job.simulation?'fixture_analysis':'analyzed';source.analyses=[...(source.analyses||[]).filter(a=>a.jobId!==job.id),{jobId:job.id,planHash:digest(job.plan),at:now(),simulation:job.simulation,concepts:job.plan.analysis.filter(c=>c.citations.some(s=>s.sourceId===id))}];await store.put('pedagogical_sources',source);}}
   }
   else if(job.planReview.decision==='revise'&&job.planRevisions++<1)job.stage='design';
   else{job.status='blocked';job.reason='Conception refusée avant rédaction : '+job.planReview.issues.map(i=>i.problem).join('; ');}
  }else if(['write','repair'].includes(job.stage)){
   const skill=job.workingSpec.skills[job.unitIndex],slots=unitSlots(job.workingSpec,skill);
   const unit=await invoke(store,job,job.stage,{brief:job.brief,plan:job.plan,sources:job.sources,unit:slots,globalContext:{objectives:job.workingSpec.objectives,activities:job.workingSpec.activities.map(a=>({id:a.id,instruction:a.instruction}))},issues:job.reports.at(-1)?.report.issues||[]},unitSchema,call);
   requireValue(unit.skill===skill,'Unité hors compétence demandée.');job.workingSpec=applyUnit(job.workingSpec,unit,job.sources);job.unitResponses.push(...unit.responses);job.unitIndex++;
   if(job.unitIndex>=job.workingSpec.skills.length)job.stage='checks';
  }else if(job.stage==='checks'){
   await saveCandidate(store,job);
   const browserEvidence=inspect?await inspect(job.workingSpec,job):null,labEvidence=labCheck?await labCheck(job.workingSpec,job):null;
   job.checks=await softwareChecks(job.workingSpec,{baseline:job.baseline,sources:job.sources,browserEvidence,labEvidence});job.stage='review';
  }else if(job.stage==='review'){
   const images=[],render=job.checks.find(c=>c.id==='browser-render');
   if(render?.status==='PASS'){
    let proof;try{proof=JSON.parse(render.evidence);}catch{/* Simulated tests do not provide image artifacts. */}
    if(proof?.directory&&Array.isArray(proof.captures))for(const file of proof.captures.filter(f=>/^\d+-390\.png$/.test(f)).slice(2,4)){const bytes=await readFile(resolve(proof.directory,file));if(bytes.length<=2*1024*1024)images.push(bytes.toString('base64'));}
   }
   const hash=candidateHash(job.workingSpec,job.sources),report=await invoke(store,job,'review',{brief:job.brief,briefHash:digest(job.brief),charterVersion:CHARTER_VERSION,contentHash:hash,sources:job.sources,plan:job.plan,candidate:job.workingSpec,baseline:job.baseline,executionEvidence:job.checks,visualEvidence:{imagesAttached:images.length,scope:'Deux vues mobiles représentatives si disponibles ; les autres captures sont référencées dans les preuves.'},previousIssues:job.reports.at(-1)?.report.issues||[],repairResponses:job.unitResponses},reviewSchema,call,images);
   job.decision=decideQuality({spec:job.workingSpec,sources:job.sources,brief:job.brief,report,checks:job.checks});job.reports.push(job.decision);
   const fingerprint=r=>digest(r.report.issues.filter(i=>i.severity!=='minor').map(i=>[i.rule,i.location,i.problem]).sort());
   const stagnant=job.reports.length>=2&&fingerprint(job.reports.at(-1))===fingerprint(job.reports.at(-2));
   if(job.decision.state==='ready'){job.status=job.simulation?'fixture':'completed';job.stage='complete';}
   else if(report.decision==='blocked'||job.iteration>=job.config.maxRewrites||stagnant||!report.issues.length){job.status='blocked';job.reason=stagnant?'Anomalies répétées : arrêt pour stagnation.':`Brouillon non validé : ${job.decision.blockers.join(', ')||'seuil ou couverture insuffisant'}`;}
   else{job.iteration++;job.unitIndex=0;job.unitResponses=[];job.stage='repair';}
   const candidate=await store.get('generation_candidates',`${job.id}:candidate:${job.iteration+(job.stage==='repair'?0:1)}`);if(candidate){candidate.review=job.decision;await store.put('generation_candidates',candidate);}
  }
  if(!['blocked','completed','fixture'].includes(job.status))job.status='queued';
  else{
   job.finishedAt=now();job.durationMs=Date.now()-Date.parse(job.startedAt);
   if(job.lessonId){await store.transaction(async tx=>{const current=await tx.get('generation_jobs',job.id);requireValue(current.status!=='cancelled'&&current.leaseToken===job.leaseToken,'Travail annulé ou repris.');const lesson=await tx.get('lessons',job.lessonId);lesson.preparationState=job.status==='completed'?'ready':job.status==='fixture'?'fixture':'draft';lesson.pedagogicalValidation=job.decision||null;await tx.put('lessons',lesson);});await compileCorpus(store,job.lessonId,job.actor);}
  }
  await checkpoint(store,job);return job;
 }catch(error){
  const current=await store.get('generation_jobs',job.id);if(current.status==='cancelled'||current.leaseToken!==job.leaseToken)return current;
  job.status='blocked';job.reason=error.message;job.finishedAt=now();await checkpoint(store,job);return job;
 }finally{clearInterval(heartbeat);}
}
