import {validate} from '../contracts.mjs';
import {fail} from '../store.mjs';
import {failOpenAI} from '../openai-errors.mjs';
import {digest,CHARTER_VERSION} from './contracts.mjs';
import {prompts} from './prompts.mjs';
import {callPlanStructured} from '../ai/plan-provider.mjs';

export const PROFILE_VERSION='quality-profiles-1';
// Capabilities are explicit and versioned. No guessed reasoning parameter or fallback.
const capabilities={
 'gpt-4.1':{efforts:['none'],input:2,output:8},
 'gpt-5.4':{efforts:['none','low','medium','high','xhigh'],input:2.5,output:15},
 'gpt-6.1-sol':{efforts:['low','medium','high','xhigh','max'],input:2,output:10}
};
const number=(env,key,value,min,max)=>{const n=Number(env[key]??value);if(!Number.isFinite(n)||n<min||n>max)fail(503,`${key} hors limites (${min}–${max}).`);return n;};
export function pipelineLimits(env=process.env,{provider='openai_api'}={}){
 const plan=provider==='chatgpt_plan';
 return {maxCalls:number(env,'EDEN_AI_MAX_CALLS',24,1,40),maxDurationMs:number(env,'EDEN_AI_MAX_SESSION_MINUTES',30,1,90)*60000,timeoutMs:number(env,'EDEN_AI_CALL_TIMEOUT_SECONDS',plan?600:180,10,plan?1200:240)*1000,maxRewrites:number(env,'EDEN_AI_MAX_REWRITES',3,0,3)};
}
export function qualityConfig(env=process.env){
 const roles={};
 for(const role of ['analysis','design','planReview','write','review','repair']){
  const name=role==='planReview'?'REVIEW':role==='analysis'?'DESIGN':role.toUpperCase(),model=env[`EDEN_AI_${name}_MODEL`]||env.EDEN_AI_MODEL||env.OPENAI_MODEL;
  if(!model)fail(503,'Modèle IA non configuré. Aucun modèle de secours ne sera appelé.');
  const cap=capabilities[model];if(!cap)fail(503,`Capacités et tarifs non vérifiés pour ${model}. Ajouter un profil documenté avant les appels.`);
  const effort=env[`EDEN_AI_${name}_EFFORT`]||env.EDEN_AI_EFFORT||(cap.efforts.includes('high')?'high':'none');
  if(!cap.efforts.includes(effort))fail(503,`Effort ${effort} incompatible avec ${model}.`);
  roles[role]={model,effort,inputUSDPerMillion:cap.input,outputUSDPerMillion:cap.output,maxOutputTokens:number(env,'EDEN_AI_MAX_OUTPUT_TOKENS',24000,1024,64000)};
 }
 return {version:PROFILE_VERSION,roles,...pipelineLimits(env),background:env.EDEN_AI_BACKGROUND==='1',maxUSD:number(env,'EDEN_AI_MAX_SESSION_USD',6,0.01,50),maxCallUSD:number(env,'EDEN_AI_MAX_CALL_USD',1.5,0.01,10)};
}
export function estimateCall(profile,input,{role,schema,imageCount=0}={}){
 // One token per UTF-8 byte + prompt/schema allowance is intentionally conservative.
 const inputBound=Buffer.byteLength(JSON.stringify(input))+Buffer.byteLength(JSON.stringify(schema||{}))+Buffer.byteLength(prompts[role]||'')+4096+imageCount*20000;
 if(inputBound>180000)fail(413,'Dossier trop volumineux : sélectionner moins de sources ou scinder la séance. Aucun contexte tronqué.');
 return {inputBound,usd:profile.billing==='chatgpt_plan'?0:1.4*(inputBound*profile.inputUSDPerMillion+profile.maxOutputTokens*profile.outputUSDPerMillion)/1e6};
}
export async function callStructured(args){
 if(args.config.provider==='chatgpt_plan')return callPlanStructured(args);
 if(args.config.provider&&!['openai_api'].includes(args.config.provider))fail(503,'Fournisseur IA inconnu.');
 const {role,input,schema,config,fetchImpl=fetch,apiKey=process.env.OPENAI_API_KEY,signal,images=[],onEvent}=args;
 if(!apiKey)fail(503,'OPENAI_API_KEY absente : génération IA non exécutée.');
 const p=config.roles[role],body={model:p.model,store:false,...(config.background?{background:true}:{}),service_tier:'default',max_output_tokens:p.maxOutputTokens,
  ...(p.effort==='none'&&p.model==='gpt-4.1'?{}:{reasoning:{effort:p.effort}}),
  input:[{role:'system',content:prompts[role]},{role:'user',content:images.length?[{type:'input_text',text:JSON.stringify(input)},...images.map(data=>({type:'input_image',image_url:`data:image/png;base64,${data}`,detail:'low'}))]:JSON.stringify(input)}],text:{format:{type:'json_schema',name:`Tween_${role}_v1`,strict:true,schema}}};
 const startedAt=new Date().toISOString(),start=Date.now();
 const trace={role,profileVersion:config.version,promptVersion:CHARTER_VERSION,requestedModel:p.model,parameters:{reasoning:body.reasoning||null,max_output_tokens:p.maxOutputTokens,store:false,background:!!config.background},requestHash:digest(body),startedAt,cache:'provider_usage_only'};
 try{
  const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(config.timeoutMs)]):AbortSignal.timeout(config.timeoutMs)});
  if(!response.ok)await failOpenAI(response);
  const result=await response.json();Object.assign(trace,{responseId:result.id,effectiveModel:result.model||null,status:result.status,usage:result.usage||null,stopReason:result.incomplete_details?.reason||null});
  trace.costUSD=result.usage?(result.usage.input_tokens*p.inputUSDPerMillion+result.usage.output_tokens*p.outputUSDPerMillion)/1e6:null;
  await onEvent?.({type:'response.created',responseId:result.id,status:result.status});
  if(config.background&&['queued','in_progress'].includes(result.status))return {pending:true,responseId:result.id,status:result.status,trace};
  if(result.status!=='completed')fail(409,`Réponse incomplète : ${result.incomplete_details?.reason||result.status||'statut absent'}.`,{kind:'incomplete',retryable:false});
  const parts=result.output?.flatMap(x=>x.content||[])||[];
  if(parts.some(x=>x.type==='refusal'))throw Error('Réponse refusée par le fournisseur.');
  const raw=parts.filter(x=>x.type==='output_text').map(x=>x.text).join('');if(!raw)throw Error('Réponse structurée vide.');
  const value=validate(schema,JSON.parse(raw));
  trace.outputHash=digest(raw);trace.durationMs=Date.now()-start;
  trace.costUSD=result.usage?(result.usage.input_tokens*p.inputUSDPerMillion+result.usage.output_tokens*p.outputUSDPerMillion)/1e6:null;
  trace.costMethod='Estimation USD tarif standard non mis en cache ; inclut le raisonnement dans output_tokens. Pas une facture.';
  return {value,trace};
 }catch(error){if(!error.status&&['TypeError','AbortError','TimeoutError'].includes(error.name)){error=Object.assign(new Error('Appel API interrompu. Son issue est incertaine ; aucune reprise automatique.'),{details:{provider:'openai_api',kind:'uncertain',retryable:false}});}Object.assign(trace,{durationMs:Date.now()-start,error:error.message,status:trace.status||'failed',...(error.details?{providerError:error.details}:{})});error.trace=trace;throw error;}
}

export async function retrieveStructured({attempt,config,schema,fetchImpl=fetch,apiKey=process.env.OPENAI_API_KEY}) {
 if(attempt.retrieval!=='responses-background'||!attempt.responseId||config.provider==='chatgpt_plan')fail(409,'Cette intégration ne permet pas de récupérer la réponse distante.',{kind:'uncertain',retryable:false});
 if(!apiKey)fail(503,'OPENAI_API_KEY absente : consultation distante non exécutée.',{kind:'uncertain',retryable:false});
 const response=await fetchImpl(`https://api.openai.com/v1/responses/${encodeURIComponent(attempt.responseId)}`,{headers:{Authorization:`Bearer ${apiKey}`},signal:AbortSignal.timeout(Math.min(config.timeoutMs,15000))});
 // A 404 or a polling error does not establish that generation failed remotely.
 if(!response.ok)fail(409,`Consultation distante non confirmée (${response.status}). La provision reste réservée.`,{kind:'uncertain',retryable:false});
 const result=await response.json();
 if(['queued','in_progress'].includes(result.status))return {pending:true,responseId:result.id,status:result.status};
 if(result.status!=='completed')fail(409,`Réponse distante ${result.status||'inconnue'} ; aucune sortie complète adoptée.`,{kind:['failed','cancelled','incomplete'].includes(result.status)?'incomplete':'uncertain',retryable:false});
 const parts=(result.output||[]).flatMap(x=>x.content||[]);
 if(parts.some(x=>x.type==='refusal'))fail(409,'Réponse distante refusée.',{kind:'incomplete',retryable:false});
 const raw=parts.filter(x=>x.type==='output_text').map(x=>x.text).join('');
 const value=validate(schema,JSON.parse(raw)),p=attempt.profile;
 return {value,trace:{...attempt.trace,provider:'openai_api',role:attempt.role,requestedModel:p.model,effectiveModel:result.model,responseId:result.id,status:result.status,usage:result.usage||null,recovered:true,outputHash:digest(raw),costUSD:result.usage?(result.usage.input_tokens*p.inputUSDPerMillion+result.usage.output_tokens*p.outputUSDPerMillion)/1e6:null}};
}

export async function cancelStructured({attempt,config,fetchImpl=fetch,apiKey=process.env.OPENAI_API_KEY}){
 if(attempt.retrieval!=='responses-background'||!attempt.responseId||config.provider==='chatgpt_plan'||!apiKey)return {attempted:false,confirmed:false,reason:'remote_cancellation_unavailable'};
 try{
  const response=await fetchImpl(`https://api.openai.com/v1/responses/${encodeURIComponent(attempt.responseId)}/cancel`,{method:'POST',headers:{Authorization:`Bearer ${apiKey}`},signal:AbortSignal.timeout(15000)});
  if(!response.ok)return {attempted:true,confirmed:false,httpStatus:response.status};
  const result=await response.json();return {attempted:true,confirmed:result.status==='cancelled',status:['cancelled','completed','failed','in_progress','queued'].includes(result.status)?result.status:'unknown'};
 }catch{return {attempted:true,confirmed:false,status:'unknown'};}
}
