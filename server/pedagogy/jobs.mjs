import {uid,now,fail,requireValue,scoped} from '../store.mjs';
import {generateLesson,resolveEntry} from '../generator.mjs';
import {retrieveResources} from '../retrieval.mjs';
import {compileCorpus} from '../corpus.mjs';
import {callStructured,pipelineLimits,cancelStructured} from './provider.mjs';
import {sourceDossier} from './documents.mjs';
import {planSchemaFor,planReviewSchema,unitSchema,reviewSchema,documentarySchema,digest,CHARTER_VERSION} from './contracts.mjs';
import {mechanisms,runtimeProfiles} from './catalog.mjs';
import {validatePlan,applyPlanOrder,unitSlots,applyUnit,softwareChecks,candidateHash,decideQuality} from './quality.mjs';
import {prepareScaffold} from './scaffold.mjs';
import {readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {freezeProvider,aiPreferences} from '../ai/settings.mjs';
import {nextRetryAt} from '../ai/errors.mjs';
import {getChatGPT} from '../ai/chatgpt.mjs';
import {hasLease,invokeAttempt,reconcileGeneration,unknownAttempt,recoverableAttempt} from './attempts.mjs';
import {runtimeManifest} from './policy.mjs';
import {designContext,analysisInputHash,validateDocumentary,validateDesignContract} from './design.mjs';
import {preparationContext} from './context.mjs';
import {prepareVisualReferences,visualAssets} from './visuals.mjs';

export const qualityEnabled=()=>process.env.EDEN_QUALITY_PIPELINE==='1'||process.env.NODE_ENV!=='production'&&process.env.EDEN_QUALITY_PIPELINE!=='0';
const pending=['queued','running','retry_wait'];
// A rejected schema never generated output. Existing jobs can be explicitly
// resumed after a code fix, including jobs saved before this recovery existed.
const recoveryReason=job=>job.recovery||(job.providerError?.code==='invalid_json_schema'?'schema_rejected':null);
export async function ownedJob(store,id,actor){const job=await scoped(store,'generation_jobs',id,actor);if(job.actor?.id!==actor.id)fail(404,'Préparation introuvable.');return job;}
export const jobSummary=job=>{
 const {workingSpec,baseline,referenceBaseline,sources,config,actor,...rest}=job;
 const active=job.status==='running'&&Date.parse(job.leaseUntil)>Date.now();
 const durationExhausted=Number.isFinite(config?.maxDurationMs)&&Date.now()-Date.parse(job.startedAt)>=config.maxDurationMs;
 const callsExhausted=Number.isFinite(config?.maxCalls)&&job.calls>=config.maxCalls;
 const budgetReason=durationExhausted?'Budget de durée épuisé : aucun nouvel appel autorisé.':callsExhausted?'Plafond d’appels atteint : aucun nouvel appel autorisé.':null;
 return {...rest,provider:config?.provider||'openai_api',connectionId:config?.connectionId||null,profiles:config?.roles,
  spentUSD:config?.provider==='chatgpt_plan'?null:job.spentUSD,reservedUSD:config?.provider==='chatgpt_plan'?null:job.reservedUSD,
  sourceVersions:sources?.map(s=>({id:s.id,title:s.title,contentHash:s.contentHash})),
  candidateCount:job.candidateCount||0,maxCandidates:1+(config?.maxRewrites||0),revision:job.revision||1,
  preview:{versionId:job.lessonVersionId||null,completeness:job.candidateVersionId===job.lessonVersionId?'candidate':'partial'},
  workerState:active?'active':job.status==='running'?'lease_expired':'idle',attemptState:job.attemptState||job.recovery||null,
  canCancel:[...pending,'blocked'].includes(job.status),canReconcile:['running','blocked','retry_wait'].includes(job.status),
  budgetReason,canResume:job.status==='blocked'&&!!recoveryReason(job)&&!job.sourceChanged&&!budgetReason,
  canRevise:!!job.workingSpec&&!job.sourceChanged&&job.status!=='cancelled',policyVersion:job.policyVersion||'legacy'};
};
export async function enqueueGeneration(store,actor,input,{config=null,simulation=false,chatgpt}={}){
 requireValue(qualityEnabled(),'Préparation approfondie désactivée sur cette instance.');
 requireValue(actor.role==='teacher','Action réservée au professeur.');
 requireValue(!input.requestId||typeof input.requestId==='string'&&input.requestId.length<=200,'Identifiant de demande invalide.');
 const requestDigest=digest({entryId:input.entryId||null,intent:input.intent,sourceIds:input.sourceIds||[],constraints:input.constraints||[],targetDate:input.targetDate||null});
 const duplicate=async tx=>{const previous=(await tx.list('generation_jobs',actor.classId)).find(j=>j.actor?.id===actor.id&&input.requestId&&j.requestId===input.requestId);if(previous?.requestDigest&&previous.requestDigest!==requestDigest)fail(409,'Cette action a déjà été enregistrée avec un autre contenu.');return previous;};
 const existing=await duplicate(store);if(existing)return existing;
 requireValue(typeof input.intent==='string'&&input.intent.trim()&&input.intent.length<=4000,'Intention requise, 4 000 caractères maximum.');
 const entry=input.entryId?await scoped(store,'plan_entries',input.entryId,actor):resolveEntry(await store.list('plan_entries',actor.classId),input);
 requireValue(entry.durationConfirmed,'Confirmer la durée de séance.');requireValue(entry.skills.length<=8,'Scinder la séance au-delà de huit compétences pour préserver la profondeur.');
 const sources=await sourceDossier(store,actor,input.sourceIds||[]),plan=(await store.list('plan_versions',actor.classId)).at(-1);
 requireValue(plan,'Planification absente.');
 const resolvedContext=await preparationContext(store,actor,entry,plan);
 let settings=config,unavailable=null;try{settings??=await freezeProvider(store,actor,{chatgpt});if(!simulation&&process.env.VERCEL)unavailable='Exécuteur de préparation hébergé non activé. Utilisez le parcours personnel local.';}catch(e){unavailable=e.message;settings??={...await aiPreferences(store,actor),ownerId:actor.id,classId:actor.classId};}
 return store.transaction(async tx=>{
  const previous=await duplicate(tx);if(previous)return previous;
  const job=await tx.insert('generation_jobs',{id:uid('prep'),classId:actor.classId,requestId:input.requestId||uid('request'),requestDigest,actor:{id:actor.id,classId:actor.classId,role:'teacher'},entryId:entry.id,sourceIds:sources.map(s=>s.id),sources,
   brief:{version:2,intent:input.intent,entry,planVersion:plan.version,resolvedContext,constraints:input.constraints||[],priorLearning:'Seules les séances clôturées sont des preuves ; diagnostic du jour non réalisé.'},
   revision:1,policyVersion:CHARTER_VERSION,capabilities:runtimeManifest(),candidateCount:0,config:settings,simulation,status:unavailable?'blocked':'queued',stage:'assemble',reason:unavailable,events:[{stage:'queued',at:now()}],startedAt:now(),calls:0,reservedUSD:0,spentUSD:0,iteration:0,unitIndex:0,reports:[],planRevisions:0,retryAttempts:{}});
  await tx.audit(actor,'generation.queued',job.id,{simulation,sourceIds:job.sourceIds});return job;
 });
}
export async function cancelGeneration(store,id,actor,{cancel=cancelStructured}={}){
 const job=await store.transaction(async tx=>{const job=await ownedJob(tx,id,actor);requireValue([...pending,'blocked'].includes(job.status),'Ce travail ne peut plus être annulé.');job.status='cancelled';job.reason='Annulation locale enregistrée. Un appel déjà envoyé peut avoir consommé du quota ou être facturé.';job.finishedAt=now();await tx.put('generation_jobs',job);return job;});
 for(const attempt of (await store.list('generation_calls',actor.classId)).filter(c=>c.jobId===id&&unknownAttempt(c)&&recoverableAttempt(c))){
  const cancellation=await cancel({attempt,config:job.config});
  await store.transaction(async tx=>{const row=await tx.get('generation_calls',attempt.id);row.cancellation={...cancellation,at:now()};if(cancellation.confirmed){row.providerState='cancelled';if(unknownAttempt(row))row.outcome='cancelled';}await tx.put('generation_calls',row);});
 }return job;
}
export async function choosePreparationSession(store,id,actor,{sessionId,expectedRevision}={}){
 return store.transaction(async tx=>{
  const job=await ownedJob(tx,id,actor);requireValue(job.status==='blocked'&&job.stage==='context'&&job.revision===expectedRevision,'Le contexte a changé ; rechargez la préparation.');
  const context=job.brief.resolvedContext,selected=context.sessions.find(s=>s.id===sessionId);requireValue(selected,'Choisissez une ligne de la fiche proposée.');
  context.sessionAlternatives=context.sessions;context.sessions=[selected];context.selection={sessionId,by:actor.id,at:now()};delete context.hash;context.hash=digest(context);
  job.stage='design';job.status='queued';job.reason=null;job.events.push({stage:'session_selected',sessionId,at:now()});await tx.put('generation_jobs',job);return job;
 });
}
export async function reconcilePreparation(store,id,actor,options={}) {
 const job=await ownedJob(store,id,actor);
 if(job.status==='blocked'&&job.providerError?.kind==='design_contract'&&job.plan&&!job.sourceChanged){
  let valid=false;try{validatePlan(job.plan,job.workingSpec,job.sources);validateDesignContract(job.plan,job.workingSpec,designContext(job));valid=true;}catch{/* Preserve genuine design failures. */}
  if(valid)await store.transaction(async tx=>{const current=await ownedJob(tx,id,actor);if(current.status==='blocked'&&current.revision===job.revision&&!current.sourceChanged&&digest(current.plan)===digest(job.plan)){current.providerError=null;current.events.push({stage:'local_design_revalidated',at:now(),newInference:false});await tx.put('generation_jobs',current);}});
 }
 return reconcileGeneration(store,id,actor,{ownedJob,...options});
}
export async function resumeGeneration(store,id,actor,input={},options={}){
 const before=await ownedJob(store,id,actor);
 const reconciled=await reconcilePreparation(store,id,actor,options);
 if(['worker_active','saved_result','remote_recovered','remote_active'].includes(reconciled.reconciliation)||['queued','running','retry_wait','completed','fixture'].includes(reconciled.status))return reconciled;
 if(input.action!=='new_attempt'&&input.confirmed!==true)return reconciled;
 requireValue(before.status==='blocked'&&recoveryReason(before)&&!before.sourceChanged,'Cette préparation nécessite une nouvelle demande.');
 let timeoutMs=before.config?.timeoutMs;
 if(before.config?.provider==='chatgpt_plan'){
  const client=options.chatgpt||getChatGPT(),models=await client.models(actor,before.config.connectionId,{recheck:true});
  requireValue(models.some(m=>m.slug===before.config.roles.design.model),'Le modèle initial n’est plus disponible.');
  timeoutMs=pipelineLimits(options.env||process.env,{provider:'chatgpt_plan'}).timeoutMs;
 }
 return store.transaction(async tx=>{
  const j=await ownedJob(tx,id,actor);
  if(['queued','running','retry_wait'].includes(j.status))return j;
  requireValue(j.status==='blocked'&&recoveryReason(j)&&!j.sourceChanged,'État modifié. Rechargez la préparation.');
  requireValue(Date.now()-Date.parse(j.startedAt)<j.config.maxDurationMs&&j.calls<j.config.maxCalls,'Budget de durée ou d’appels atteint. Aucun plafond augmenté.');
  for(const row of (await tx.list('generation_calls',actor.classId)).filter(c=>c.jobId===j.id&&(c.revision||1)===(j.revision||1)&&unknownAttempt(c))) {
   row.retryAuthorizedAt=now();row.events??=[];row.events.push({state:'new_attempt_authorized',at:now()});await tx.put('generation_calls',row);
  }
  j.events.push({stage:'explicit_resume',at:now(),recovery:recoveryReason(j),previousTimeoutMs:j.config.timeoutMs,timeoutMs});j.config.timeoutMs=timeoutMs;
  j.inflight=null;j.reason=null;j.recovery=null;j.providerError=null;j.finishedAt=null;j.status='queued';j.availableAt=now();j.leaseToken=null;await tx.put('generation_jobs',j);return j;
 });
}
export async function reviseGeneration(store,id,actor,{expectedRevision}={}) {
 return store.transaction(async tx=>{
  const job=await ownedJob(tx,id,actor),revision=job.revision||1;
  requireValue(Number.isInteger(expectedRevision),'Révision attendue requise.');
  if(revision===expectedRevision+1&&job.policyVersion===CHARTER_VERSION)return job;
  requireValue(revision===expectedRevision,'La préparation a changé ; rechargez son état.');
  requireValue(job.workingSpec&&!job.sourceChanged&&job.status!=='cancelled','Contexte ou sources à revoir avant une nouvelle conception.');
  const lesson=await tx.get('lessons',job.lessonId);requireValue(lesson?.status==='draft','Une préparation ne remplace jamais une séance publiée.');
  await tx.insert('generation_revisions',{id:`${id}:r${revision}`,classId:job.classId,jobId:id,revision,snapshot:job,reason:'Activation des règles de cours et révision ciblée de la conception.'});
  job.revision=revision+1;job.policyVersion=CHARTER_VERSION;job.capabilities=runtimeManifest();job.leaseToken=null;job.leaseUntil=null;job.inflight=null;
  job.documentary=job.documentary?.inputHash===analysisInputHash(job)?job.documentary:null;
  job.plan=null;job.designContract=null;job.planReview=null;job.decision=null;job.checks=null;job.reports=[];job.planRevisions=0;job.unitIndex=0;job.unitResponses=[];
  job.workingSpec=prepareScaffold(job.baseline);job.stage=job.documentary?'design':'analysis';job.candidateVersionId=null;
  job.status=Date.now()-Date.parse(job.startedAt)<job.config.maxDurationMs&&job.calls<job.config.maxCalls?'queued':'blocked';
  job.reason=job.status==='blocked'?'Règles actualisées, sources conservées. Budget initial épuisé : aucun nouvel appel lancé.':null;job.recovery=null;
  if(job.documentary&&job.brief.resolvedContext?.sessions.length>1&&!job.brief.resolvedContext.selection){job.stage='context';job.status='blocked';job.reason='Analyse documentaire conservée. Choisissez la ligne de fiche correspondant à la séance.';}
  job.finishedAt=job.status==='blocked'?now():null;job.durationMs=job.status==='blocked'?Date.now()-Date.parse(job.startedAt):null;job.providerError=null;
  job.events.push({stage:'revision_activated',revision:job.revision,at:now(),analysisReused:!!job.documentary});
  lesson.preparationState='draft';lesson.pedagogicalValidation=null;await tx.put('lessons',lesson);await tx.put('generation_jobs',job);return job;
 });
}
async function claim(store){return store.transaction(async tx=>{
 const jobs=await tx.list('generation_jobs'),at=now();
 for(const j of jobs.filter(j=>j.status==='running'&&(!j.leaseUntil||j.leaseUntil<=at))){
  if(j.inflight){const attempt=await tx.get('generation_calls',j.inflight.id);if(attempt?.outcome!=='completed'){if(recoverableAttempt(attempt)){j.status='retry_wait';j.availableAt=at;}else{j.status='blocked';j.recovery='uncertain';j.reason='Bail du worker expiré ; issue fournisseur inconnue. Aucune relance ni double facturation présumée.';}j.leaseToken=null;await tx.put('generation_jobs',j);}}
 }
 const group=j=>j.config?.connectionId||`api:${j.actor?.id}`;
 const active=jobs.filter(j=>j.status==='running'&&j.leaseUntil>at);
 const candidates=jobs.filter(j=>j.status==='queued'||j.status==='retry_wait'&&j.availableAt<=at||j.status==='running'&&(!j.leaseUntil||j.leaseUntil<=at));
 const concurrency=j=>Math.max(1,Math.min(3,Number(j.config?.maxConcurrentPerConnection)||1));
 const job=candidates.find(j=>active.filter(a=>group(a)===group(j)).length<concurrency(j)&&(concurrency(j)>1||!jobs.some(a=>a.id!==j.id&&pending.includes(a.status)&&group(a)===group(j)&&jobs.indexOf(a)<jobs.indexOf(j))));if(!job)return null;
 if(job.inflight){const saved=await tx.get('generation_calls',job.inflight.id);if(saved?.outcome==='completed')job.inflight=null;}
 if(job.sourceChanged){job.status='blocked';job.reason=job.invalidationReason;await tx.put('generation_jobs',job);return null;}
 job.status='running';job.leaseToken=uid('lease');job.leaseUntil=new Date(Date.now()+300000).toISOString();job.events.push({stage:job.stage,iteration:job.iteration,unitIndex:job.unitIndex,at:now()});await tx.put('generation_jobs',job);return job;
});}
async function checkpoint(store,job){return store.transaction(async tx=>{const current=await tx.get('generation_jobs',job.id);if(!hasLease(current,job))fail(409,'Travail annulé ou repris par un autre worker.');job.leaseUntil=current.leaseUntil;job.spentUSD=current.spentUSD;if(current.sourceChanged){job.sourceChanged=true;job.invalidationReason=current.invalidationReason;}await tx.put('generation_jobs',job);return job;});}
async function invoke(store,job,role,input,schema,call,images=[]){
 return invokeAttempt(store,job,role,input,schema,call,images,{checkpoint});
}
async function saveCandidate(store,job){
 return store.transaction(async tx=>{
  const current=await tx.get('generation_jobs',job.id);requireValue(hasLease(current,job),'Travail annulé ou bail expiré.');
  const lesson=await tx.get('lessons',job.lessonId);requireValue(lesson.status==='draft','La préparation ne remplace jamais une publication.');
  const candidateId=`${job.id}:r${job.revision||1}:candidate:${job.iteration+1}`,existing=await tx.get('generation_candidates',candidateId);if(existing){const installedVersion=existing.lessonVersionId||`${lesson.id}:v${existing.spec.lessonVersion}`;requireValue(lesson.versionId===installedVersion,'Le brouillon a été modifié depuis cette préparation.');job.workingSpec=existing.spec;job.lessonVersionId=installedVersion;job.candidateVersionId=installedVersion;job.candidateCount=(await tx.list('generation_candidates',job.classId)).filter(c=>c.jobId===job.id).length;return;}
  requireValue(!job.lessonVersionId||lesson.versionId===job.lessonVersionId,'Le brouillon a été modifié depuis cette préparation. Aucun remplacement effectué.');
  requireValue((await tx.list('generation_candidates',job.classId)).filter(c=>c.jobId===job.id).length<1+job.config.maxRewrites,'Plafond de versions candidates atteint : une correction demande une nouvelle version, sans dépassement silencieux.');
  const version=lesson.version+1,versionId=`${lesson.id}:v${version}`;job.workingSpec.lessonVersion=version;
  await tx.insert('lesson_versions',{id:versionId,classId:job.classId,version,lessonId:lesson.id,spec:job.workingSpec,authorId:job.actor.id,qualityJobId:job.id,preparationRevision:job.revision||1,designContract:job.designContract});
  await tx.insert('generation_candidates',{id:candidateId,classId:job.classId,jobId:job.id,revision:job.revision||1,lessonVersionId:versionId,iteration:job.iteration,spec:job.workingSpec,contentHash:candidateHash(job.workingSpec,job.sources),unitResponses:job.unitResponses||[],simulation:job.simulation});
  Object.assign(lesson,{version,versionId,title:job.workingSpec.title,provider:job.simulation?'fixture':job.config.provider==='chatgpt_plan'?'chatgpt_plan':'openai',preparationState:'reviewing'});await tx.put('lessons',lesson);job.lessonVersionId=versionId;job.candidateVersionId=versionId;job.candidateCount=(job.candidateCount||0)+1;
 });
}
export async function runGenerationStep(store,{call=callStructured,inspect=null,labCheck=null}={}){
 const job=await claim(store);if(!job)return null;
 const controller=new AbortController(),withSignal=args=>call({...args,signal:controller.signal});
 const heartbeat=setInterval(()=>store.transaction(async tx=>{const current=await tx.get('generation_jobs',job.id);if(hasLease(current,job)){current.leaseUntil=new Date(Date.now()+300000).toISOString();await tx.put('generation_jobs',current);}else controller.abort();}).catch(()=>controller.abort()),30000);heartbeat.unref();
 const cancellation=setInterval(async()=>{try{if(!hasLease(await store.get('generation_jobs',job.id),job))controller.abort();}catch{controller.abort();}},1000);
 try{
  const currentPlan=(await store.list('plan_versions',job.classId)).at(-1);requireValue(currentPlan?.version===job.brief.planVersion,'Le plan a changé : préparer un nouveau brouillon.');
  if(job.stage==='assemble'){
   let lesson=(await store.list('lessons',job.classId)).find(l=>l.qualityJobId===job.id);
   if(!lesson)lesson=await generateLesson(store,{classId:job.classId,intent:job.brief.intent,mode:'prepare',constraints:job.brief.constraints},job.actor,{entryId:job.entryId,localOnly:true,qualityJobId:job.id});
   const version=await store.get('lesson_versions',lesson.versionId);job.lessonId=lesson.id;job.lessonVersionId=lesson.versionId;job.baseline=version.spec;job.workingSpec=prepareScaffold(version.spec,{diagnosticMinutes:process.env.EDEN_DIAGNOSTIC_MINUTES||8});
   if(!job.simulation){
    const required=new Set(job.workingSpec.activities.map(a=>a.workshop?.profile).filter(p=>['dom','shell-git'].includes(p)));
    for(const profile of required){const image=process.env[profile==='dom'?'EDEN_LAB_DOM_IMAGE':'EDEN_LAB_SHELL_IMAGE'];requireValue(process.env.EDEN_LAB_URL&&process.env.EDEN_LAB_TOKEN&&/^(?:sha256:|[^\s]+@sha256:)[a-f0-9]{64}$/.test(image||''),`Cette séance exige le laboratoire ${profile==='dom'?'frontend interactif':'shell/Git'} existant. Configurez-le avant les appels IA. Aucun atelier ne sera retiré.`);}
   }
   const references=await retrieveResources(store,job.classId,{criteria:version.spec.skills,query:job.brief.entry.objective,limit:12});
   job.sources.push(...references.filter(r=>version.spec.skills.includes(r.resourceId)).map(r=>({id:r.id,title:r.title,role:'reference',contentHash:r.sourceVersion,status:'extracted',warnings:['Bibliothèque locale ; qualité technique à examiner, non validée par le professeur.'],segments:[{id:`${r.id}:full`,parent:r.title,location:`NEXUS/${r.resourceId}`,text:JSON.stringify(r.resource),visibility:'teacher'}]})));
   job.brief.previousSource=version.spec.sourceVersions.previousLessonRunId;job.stage='analysis';
  }else if(job.stage==='analysis'){
   const content=validateDocumentary(await invoke(store,job,'analysis',{brief:job.brief,sources:job.sources},documentarySchema,withSignal),job.sources);
   job.documentary={inputHash:analysisInputHash(job),content,at:now(),callId:job.lastCallId};job.stage='design';
   if(job.brief.resolvedContext?.sessions.length>1&&!job.brief.resolvedContext.selection){job.stage='context';job.status='blocked';job.reason='Analyse documentaire conservée. Plusieurs lignes de fiche correspondent à cette date : choisissez la séance avant la conception.';}
  }else if(job.stage==='design'){
   job.plan=await invoke(store,job,'design',{brief:job.brief,sources:job.sources,documentary:job.documentary,context:designContext(job),skeleton:job.workingSpec,mechanisms,runtimeProfiles,previousPlanIssues:job.planReview?.issues||[]},planSchemaFor(job.workingSpec,job.sources),withSignal);
   const issues=[];
   try{validatePlan(job.plan,job.workingSpec,job.sources);}catch(e){issues.push({location:'plan',problem:e.message});}
   try{job.designContract=validateDesignContract(job.plan,job.workingSpec,designContext(job));}catch(e){issues.push(...(e.details?.issues||[{location:'contract',problem:e.message}]));}
   if(issues.length)fail(400,'Conception à corriger : '+issues.map(i=>`${i.location} : ${i.problem}`).join(' ; '),{kind:'design_contract',issues});
   job.contractIssues=[];job.stage='planReview';
  }else if(job.stage==='planReview'){
   job.planReview=await invoke(store,job,'planReview',{brief:job.brief,sources:job.sources,documentary:job.documentary,context:designContext(job),plan:job.plan,skeleton:applyPlanOrder(job.workingSpec,job.plan),productionStage:'Conception avant rédaction : les identifiants, profils et diagnostic sont figés. Les textes et fichiers hérités sont des emplacements à réécrire selon le contrat. Les durées des blocs sont celles du contrat validé.'},planReviewSchema,withSignal);
   if(job.planReview.decision==='accept'&&!job.planReview.issues.length){
    job.workingSpec=applyPlanOrder(job.workingSpec,job.plan);job.stage='write';job.unitIndex=0;job.unitResponses=[];
    for(const id of job.sourceIds){const source=await store.get('pedagogical_sources',id);if(source){source.analysisStatus=job.simulation?'fixture_analysis':'analyzed';source.analyses=[...(source.analyses||[]).filter(a=>a.jobId!==job.id),{jobId:job.id,planHash:digest(job.plan),at:now(),simulation:job.simulation,concepts:job.plan.analysis.filter(c=>c.citations.some(s=>s.sourceId===id))}];await store.put('pedagogical_sources',source);}}
   }
   else if(job.planReview.decision==='revise'&&job.planRevisions++<1)job.stage='design';
   else{job.status='blocked';job.reason='Conception refusée avant rédaction : '+job.planReview.issues.map(i=>i.problem).join('; ');}
  }else if(['write','repair'].includes(job.stage)){
   const skill=job.workingSpec.skills[job.unitIndex],slots=unitSlots(job.workingSpec,skill);
   const unit=await invoke(store,job,job.stage,{brief:job.brief,context:designContext(job),plan:job.plan,sources:job.sources,unit:slots,globalContext:{objectives:job.workingSpec.objectives,activities:job.workingSpec.activities.map(a=>({id:a.id,instruction:a.instruction}))},issues:job.reports.at(-1)?.report.issues||[]},unitSchema,withSignal);
   requireValue(unit.skill===skill,'Unité hors compétence demandée.');job.workingSpec=applyUnit(job.workingSpec,unit,job.sources);job.unitResponses.push(...unit.responses);job.unitIndex++;
   if(job.unitIndex>=job.workingSpec.skills.length)job.stage='checks';
  }else if(job.stage==='checks'){
   if(!job.simulation)await prepareVisualReferences(store,job.workingSpec,job);
   await saveCandidate(store,job);
   const browserEvidence=inspect?await inspect(job.workingSpec,job,{assets:await visualAssets(store,job.workingSpec)}):null,labEvidence=labCheck?await labCheck(job.workingSpec,job):null;
   job.checks=await softwareChecks(job.workingSpec,{baseline:job.baseline,sources:job.sources,browserEvidence,labEvidence,plan:job.plan,context:designContext(job),strictArtifacts:!job.simulation});job.stage='review';
  }else if(job.stage==='review'){
   const images=[],render=job.checks.find(c=>c.id==='browser-render');
   if(render?.status==='PASS'){
    let proof;try{proof=JSON.parse(render.evidence);}catch{/* Simulated tests do not provide image artifacts. */}
    if(proof?.directory&&Array.isArray(proof.captures))for(const file of proof.captures.filter(f=>/^\d+-390\.png$/.test(f)).slice(2,4)){const bytes=await readFile(resolve(proof.directory,file));if(bytes.length<=2*1024*1024)images.push(bytes.toString('base64'));}
   }
   const hash=candidateHash(job.workingSpec,job.sources),report=await invoke(store,job,'review',{brief:job.brief,context:designContext(job),briefHash:digest(job.brief),charterVersion:CHARTER_VERSION,contentHash:hash,sources:job.sources,plan:job.plan,candidate:job.workingSpec,baseline:job.baseline,executionEvidence:job.checks,visualEvidence:{imagesAttached:images.length,scope:'Deux vues mobiles représentatives si disponibles ; les autres captures sont référencées dans les preuves.'},previousIssues:job.reports.at(-1)?.report.issues||[],repairResponses:job.unitResponses},reviewSchema,withSignal,images);
   job.decision=decideQuality({spec:job.workingSpec,sources:job.sources,brief:job.brief,report,checks:job.checks});job.reports.push(job.decision);
   const fingerprint=r=>digest(r.report.issues.filter(i=>i.severity!=='minor').map(i=>[i.rule,i.location,i.problem]).sort());
   const stagnant=job.reports.length>=2&&fingerprint(job.reports.at(-1))===fingerprint(job.reports.at(-2));
   if(job.decision.state==='ready'){job.status=job.simulation?'fixture':'completed';job.stage='complete';}
   else if(report.decision==='blocked'||job.iteration>=job.config.maxRewrites||stagnant||!report.issues.length){job.status='blocked';job.reason=stagnant?'Anomalies répétées : arrêt pour stagnation.':`Brouillon non validé : ${job.decision.blockers.join(', ')||'seuil ou couverture insuffisant'}`;}
   else{job.iteration++;job.unitIndex=0;job.unitResponses=[];job.stage='repair';}
   const candidate=await store.get('generation_candidates',`${job.id}:r${job.revision||1}:candidate:${job.iteration+(job.stage==='repair'?0:1)}`);if(candidate){candidate.review=job.decision;await store.put('generation_candidates',candidate);}
  }
  if(!['blocked','completed','fixture'].includes(job.status))job.status='queued';
  else{
   job.finishedAt=now();job.durationMs=Date.now()-Date.parse(job.startedAt);
   if(job.lessonId){await store.transaction(async tx=>{const current=await tx.get('generation_jobs',job.id);requireValue(hasLease(current,job),'Travail annulé ou repris.');const lesson=await tx.get('lessons',job.lessonId);requireValue(lesson.status==='draft'&&(!job.lessonVersionId||lesson.versionId===job.lessonVersionId),'Brouillon modifié : résultat tardif non appliqué.');lesson.preparationState=job.status==='completed'?'ready':job.status==='fixture'?'fixture':'draft';lesson.pedagogicalValidation=job.decision||null;await tx.put('lessons',lesson);});await compileCorpus(store,job.lessonId,job.actor);}
  }
  await checkpoint(store,job);return job;
 }catch(error){
  const current=await store.get('generation_jobs',job.id);if(!hasLease(current,job))return current;
  const details=error.details||{},attempt=error.operationAttempts||1;
  if(details.kind==='design_contract'){job.contractIssues=details.issues;job.planReview={decision:'revise',issues:details.issues.map(i=>({...i,requestedChange:i.problem,resolutionCriterion:'Contrôle applicatif réussi.'}))};}
  job.reason=error.message;job.providerError=details;job.recovery=['uncertain','incomplete','usage_limit','reconnect_required','temporary','rate_limit'].includes(details.kind)?details.kind:null;
  if(details.kind==='design_contract'&&job.planRevisions<1&&Date.now()-Date.parse(job.startedAt)<job.config.maxDurationMs&&job.calls<job.config.maxCalls){job.planRevisions++;job.status='queued';job.events.push({stage:'design_correction',at:now(),issues:details.issues});}
  else if(details.kind==='remote_pending'){job.status='retry_wait';job.availableAt=new Date(Date.now()+3000).toISOString();}
  else if(details.retryable&&attempt<3&&Date.now()-Date.parse(job.startedAt)<job.config.maxDurationMs){job.status='retry_wait';job.availableAt=nextRetryAt(details,attempt);job.events.push({stage:'retry_wait',at:now(),availableAt:job.availableAt});}
  else{job.status='blocked';job.finishedAt=now();}
  if(job.status==='blocked'&&job.lessonId)await store.transaction(async tx=>{const current=await tx.get('generation_jobs',job.id),lesson=await tx.get('lessons',job.lessonId);if(hasLease(current,job)&&lesson?.status==='draft'&&lesson.versionId===job.lessonVersionId){lesson.preparationState='draft';await tx.put('lessons',lesson);}});
  await checkpoint(store,job);return job;
 }finally{clearInterval(heartbeat);clearInterval(cancellation);}
}
