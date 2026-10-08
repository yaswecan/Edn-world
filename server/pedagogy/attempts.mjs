import {uid,now,fail,requireValue} from '../store.mjs';
import {validate} from '../contracts.mjs';
import {digest,CHARTER_VERSION} from './contracts.mjs';
import {estimateCall,retrieveStructured} from './provider.mjs';

export const hasLease=(current,job)=>current?.status==='running'&&current.leaseToken===job.leaseToken&&(current.revision||1)===(job.revision||1)&&Date.parse(current.leaseUntil)>Date.now();
export const unknownAttempt=c=>c&&(['submitting','running','unknown'].includes(c.outcome)||c.trace?.providerError?.kind==='uncertain');
export const recoverableAttempt=c=>!!(c?.responseId&&c.retrieval==='responses-background');
export const operationKey=job=>`${job.id}:r${job.revision||1}:${job.stage}:${job.iteration}:${job.unitIndex}:${job.planRevisions}`;

async function recordResult(store,job,attempt,result,activity) {
 return store.transaction(async tx=>{
  const current=await tx.get('generation_jobs',job.id),row=await tx.get('generation_calls',attempt.id);
  if(['completed','discarded'].includes(row.outcome))return row;
  const active=hasLease(current,job)&&!row.retryAuthorizedAt;
  Object.assign(row,{outcome:active?'completed':'discarded',providerState:'completed',trace:result.trace,output:result.value,outputHash:digest(result.value),completedAt:now()});
  if(activity){row.activity=activity;row.lastEventAt=activity.lastSignalAt;}
  row.events.push({state:row.outcome,at:now()});await tx.put('generation_calls',row);
  // Full conservative reservation is kept, including unknown/late consumption.
  // Actual usage is recorded independently and is not an excuse to lift a ceiling.
  current.spentUSD=(current.spentUSD||0)+(result.trace?.costUSD||0);
  if(active){current.lastCallId=row.id;current.inflight=null;current.attemptState='completed';}
  await tx.put('generation_jobs',current);return row;
 });
}

export async function invokeAttempt(store,job,role,input,schema,call,images=[],{checkpoint,retrieve=retrieveStructured}={}) {
 const key=operationKey(job),inputHash=digest({input,schema,policy:job.policyVersion||CHARTER_VERSION});
 let rows=(await store.list('generation_calls',job.classId)).filter(c=>c.jobId===job.id);
 const saved=rows.find(c=>c.operationKey===key&&c.inputHash===inputHash&&c.outcome==='completed');
 if(saved){validate(schema,saved.output);job.inflight=null;job.lastCallId=saved.id;return saved.output;}
 if(rows.some(c=>c.operationKey===key&&c.outcome==='completed'))fail(409,'Une réponse est déjà conservée pour cette étape, mais son contexte a changé. Actualisez les règles pour créer une révision explicite ; aucun nouvel appel lancé.',{kind:'context_changed',retryable:false});
 const active=rows.findLast(c=>c.operationKey===key&&c.inputHash===inputHash&&unknownAttempt(c)&&!c.retryAuthorizedAt);
 let attempt=active,result,latestActivity;
 if(active){
  if(!recoverableAttempt(active))fail(409,'Résultat de la dernière tentative non confirmé. Une nouvelle tentative distincte est nécessaire.',{kind:'uncertain',retryable:false});
  try{result=await retrieve({attempt:active,config:job.config,schema});}
  catch(e){if(e.details?.kind==='incomplete')await store.transaction(async tx=>{const row=await tx.get('generation_calls',active.id);if(unknownAttempt(row)){row.outcome='incomplete';row.providerState='terminal_without_valid_output';row.events.push({state:'incomplete',at:now()});await tx.put('generation_calls',row);}});throw e;}
 }else{
  const profile=job.config.roles[role]||job.config.roles.design,cost=estimateCall(profile,input,{role,schema,imageCount:images.length});
  attempt=await store.transaction(async tx=>{
   const current=await tx.get('generation_jobs',job.id);requireValue(hasLease(current,job),'Travail annulé, révision remplacée ou bail expiré.');
   if(current.config.sharedBudgetId){const group=(await tx.list('generation_jobs',job.classId)).filter(j=>j.config?.sharedBudgetId===current.config.sharedBudgetId);requireValue(group.reduce((n,j)=>n+j.calls,0)<current.config.sharedMaxCalls,'Plafond global d’appels de la recette atteint.');}
   requireValue(current.calls<current.config.maxCalls&&(current.config.provider==='chatgpt_plan'||cost.usd<=current.config.maxCallUSD&&(current.reservedUSD||0)+cost.usd<=current.config.maxUSD),'Budget maximal d’appels ou de coût atteint.');
   requireValue(Date.now()-Date.parse(current.startedAt)<current.config.maxDurationMs,'Durée maximale de préparation atteinte.');
   const row={id:`${job.id}:call:${current.calls+1}`,classId:job.classId,jobId:job.id,revision:job.revision||1,operationKey:key,inputHash,documentContext:job.documentContext?{id:job.documentContext.id,sha256:job.documentContext.sha256}:null,stage:job.stage,role,policyVersion:job.policyVersion||CHARTER_VERSION,runtimeVersion:job.capabilities?.version||null,provider:job.config.provider||'openai_api',profile,parameters:{timeoutMs:job.config.timeoutMs,background:!!job.config.background},schema,
    reservedUSD:cost.usd,outcome:'submitting',providerState:'unknown',responseId:null,retrieval:job.config.provider!=='chatgpt_plan'&&job.config.background?'responses-background':null,events:[{state:'submitting',at:now()}]};
   await tx.insert('generation_calls',row);current.calls++;current.reservedUSD=(current.reservedUSD||0)+cost.usd;current.inflight={id:row.id,role,at:now(),reservedUSD:cost.usd};current.attemptState='submitting';await tx.put('generation_jobs',current);
   Object.assign(job,{calls:current.calls,reservedUSD:current.reservedUSD,inflight:current.inflight,attemptState:current.attemptState});return row;
  });
  let activitySavedAt=0,savedPhase,pendingPartialOutput;
  const onEvent=async event=>{
   if(event.activity)latestActivity=event.activity;
   if(event.partialOutput!==undefined)pendingPartialOutput=event.partialOutput.slice(0,200000);
   const terminal=['response.created','response.completed'].includes(event.type),phaseChanged=latestActivity?.phase!==savedPhase;
   // Keep the newest snapshot in memory; write at most once a second between phase changes.
   // Final/error paths flush it even when the last delta was throttled.
   if(!terminal&&!phaseChanged&&Date.now()-activitySavedAt<1000)return;
   if(event.type==='response.output_text.delta'&&!latestActivity&&event.partialOutput===undefined)return;
   activitySavedAt=Date.now();savedPhase=latestActivity?.phase;
   return store.transaction(async tx=>{
   const row=await tx.get('generation_calls',attempt.id);if(!row||['completed','discarded'].includes(row.outcome))return;
   if(event.responseId)row.responseId=event.responseId;
   if(event.status)row.providerState=event.status;
   if(event.model)row.effectiveModel=event.model;
   if(latestActivity)row.activity=latestActivity;
   if(pendingPartialOutput!==undefined){row.partialOutput=pendingPartialOutput;pendingPartialOutput=undefined;}
   row.lastEventAt=latestActivity?.lastSignalAt||now();if(event.type==='response.created'){row.outcome='running';row.events.push({state:'running',at:now()});}await tx.put('generation_calls',row);
  });};
  try{
   const remainingMs=job.config.maxDurationMs-(Date.now()-Date.parse(job.startedAt));
   result=await call({role,input,schema,config:{...job.config,roles:{...job.config.roles,[role]:profile},timeoutMs:Math.min(job.config.timeoutMs,remainingMs)},images,onEvent});
  }catch(e){
   await store.transaction(async tx=>{const row=await tx.get('generation_calls',attempt.id);row.outcome=e.details?.kind==='uncertain'?'unknown':e.details?.kind==='incomplete'?'incomplete':'failed';row.providerState=row.outcome;row.trace=e.trace||{role,error:e.message};row.partialOutput=e.partialOutput||row.partialOutput||null;row.finishedAt=now();if(latestActivity){row.activity=latestActivity;row.lastEventAt=latestActivity.lastSignalAt;}row.events.push({state:row.outcome,at:now()});await tx.put('generation_calls',row);if(e.trace?.costUSD){const current=await tx.get('generation_jobs',job.id);current.spentUSD=(current.spentUSD||0)+e.trace.costUSD;await tx.put('generation_jobs',current);}});
   job.attemptState=e.details?.kind==='uncertain'?'unknown':'failed';job.inflight=null;job.retryAttempts??={};job.retryAttempts[key]=(job.retryAttempts[key]||0)+1;e.operationAttempts=job.retryAttempts[key];await checkpoint(store,job);throw e;
  }
 }
 if(result.pending){
  job.inflight={id:attempt.id,role,at:now(),reservedUSD:attempt.reservedUSD};job.attemptState='running';
  await store.transaction(async tx=>{const row=await tx.get('generation_calls',attempt.id);row.outcome='running';row.responseId=result.responseId||row.responseId;row.providerState=result.status;await tx.put('generation_calls',row);});
  fail(409,'Appel fournisseur en cours : suivi du même appel.',{kind:'remote_pending',retryable:false});
 }
 try{validate(schema,result.value);}catch{
  await store.transaction(async tx=>{const row=await tx.get('generation_calls',attempt.id);row.outcome='incomplete';row.providerState='completed_invalid';row.trace=result.trace;row.partialOutput=JSON.stringify(result.value??null).slice(0,200000);await tx.put('generation_calls',row);});
  fail(409,'Résultat reçu mais incompatible avec le schéma attendu ; conservé comme sortie incomplète.',{kind:'incomplete',retryable:false});
 }
 const row=await recordResult(store,job,attempt,result,latestActivity);
 if(row.outcome!=='completed')fail(409,'Résultat conservé dans l’ancienne tentative ; aucune adoption après annulation ou remplacement.');
 job.inflight=null;job.attemptState='completed';job.spentUSD=(await store.get('generation_jobs',job.id)).spentUSD;job.lastCallId=attempt.id;
 await checkpoint(store,job);return result.value;
}

// Reconciliation never submits a new paid request. Unknown is not failure.
export async function reconcileGeneration(store,id,actor,{ownedJob,retrieve=retrieveStructured}={}) {
 let job=await ownedJob(store,id,actor);
 if(['cancelled','completed','fixture'].includes(job.status))return job;
 if(job.status==='running'&&Date.parse(job.leaseUntil)>Date.now())return {...job,reconciliation:'worker_active'};
 const calls=(await store.list('generation_calls',actor.classId)).filter(c=>c.jobId===id&&(c.revision||1)===(job.revision||1));
 const last=calls.findLast(c=>c.operationKey===operationKey(job)||c.stage===job.stage||!c.stage&&c.trace?.role===job.stage);
 if(last?.outcome==='completed'&&last.output&&!['design_contract','context_changed'].includes(job.providerError?.kind)){
  return store.transaction(async tx=>{const current=await ownedJob(tx,id,actor);if((current.revision||1)!==(job.revision||1)||current.status==='cancelled'||operationKey(current)!==operationKey(job)||current.status==='running'&&Date.parse(current.leaseUntil)>Date.now())return current;current.status='queued';current.finishedAt=null;current.durationMs=null;current.inflight=null;current.reason=null;current.recovery=null;current.reconciliation='saved_result';current.leaseToken=null;await tx.put('generation_jobs',current);return current;});
 }
 if(unknownAttempt(last)&&recoverableAttempt(last)){
  let result;try{result=await retrieve({attempt:last,config:job.config,schema:last.schema});}catch(e){
   if(e.details?.kind==='incomplete')return store.transaction(async tx=>{const current=await ownedJob(tx,id,actor),row=await tx.get('generation_calls',last.id);if(current.revision!==job.revision||current.status==='cancelled'||row.outcome==='completed')return current;row.outcome='incomplete';row.providerState='terminal_without_valid_output';await tx.put('generation_calls',row);current.status='blocked';current.recovery='incomplete';current.reason=e.message;current.reconciliation='retry_available';await tx.put('generation_jobs',current);return current;});
   return {...job,reconciliation:'lookup_unknown',reconciliationReason:e.message};
  }
  return store.transaction(async tx=>{
   const current=await ownedJob(tx,id,actor),row=await tx.get('generation_calls',last.id);
   if(row.outcome==='completed')return current;
   if(current.status==='cancelled'||(current.revision||1)!==(job.revision||1)||row.retryAuthorizedAt){if(!result.pending){validate(row.schema,result.value);Object.assign(row,{outcome:'discarded',output:result.value,outputHash:digest(result.value),trace:result.trace,completedAt:now()});await tx.put('generation_calls',row);}return current;}
   if(result.pending){current.reconciliation='remote_active';current.inflight={id:row.id,role:row.role};current.status='retry_wait';current.availableAt=new Date(Date.now()+3000).toISOString();}
   else{validate(row.schema,result.value);Object.assign(row,{outcome:'completed',providerState:'completed',output:result.value,outputHash:digest(result.value),trace:result.trace,completedAt:now()});current.spentUSD=(current.spentUSD||0)+(result.trace?.costUSD||0);current.status='queued';current.inflight=null;current.reconciliation='remote_recovered';await tx.put('generation_calls',row);}
   current.leaseToken=null;current.finishedAt=null;current.durationMs=null;current.reason=null;current.recovery=null;await tx.put('generation_jobs',current);return current;
  });
 }
 return {...job,reconciliation:unknownAttempt(last)?'unknown_unrecoverable':'retry_available'};
}
