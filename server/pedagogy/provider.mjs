import {validate} from '../contracts.mjs';
import {fail} from '../store.mjs';
import {failOpenAI} from '../openai-errors.mjs';
import {digest,CHARTER_VERSION} from './contracts.mjs';
import {prompts} from './prompts.mjs';

export const PROFILE_VERSION='quality-profiles-1';
// Capabilities are explicit and versioned. No guessed reasoning parameter or fallback.
const capabilities={
 'gpt-4.1':{efforts:['none'],input:2,output:8},
 'gpt-5.4':{efforts:['none','low','medium','high','xhigh'],input:2.5,output:15},
 'gpt-6.1-sol':{efforts:['low','medium','high','xhigh','max'],input:2,output:10}
};
const number=(env,key,value,min,max)=>{const n=Number(env[key]??value);if(!Number.isFinite(n)||n<min||n>max)fail(503,`${key} hors limites (${min}–${max}).`);return n;};
export function qualityConfig(env=process.env){
 const roles={};
 for(const role of ['design','planReview','write','review','repair']){
  const name=role==='planReview'?'REVIEW':role.toUpperCase(),model=env[`EDEN_AI_${name}_MODEL`]||env.EDEN_AI_MODEL||env.OPENAI_MODEL;
  if(!model)fail(503,'Modèle IA non configuré. Aucun modèle de secours ne sera appelé.');
  const cap=capabilities[model];if(!cap)fail(503,`Capacités et tarifs non vérifiés pour ${model}. Ajouter un profil documenté avant les appels.`);
  const effort=env[`EDEN_AI_${name}_EFFORT`]||env.EDEN_AI_EFFORT||(cap.efforts.includes('high')?'high':'none');
  if(!cap.efforts.includes(effort))fail(503,`Effort ${effort} incompatible avec ${model}.`);
  roles[role]={model,effort,inputUSDPerMillion:cap.input,outputUSDPerMillion:cap.output,maxOutputTokens:number(env,'EDEN_AI_MAX_OUTPUT_TOKENS',24000,1024,64000)};
 }
 return {version:PROFILE_VERSION,roles,maxCalls:number(env,'EDEN_AI_MAX_CALLS',24,1,40),maxUSD:number(env,'EDEN_AI_MAX_SESSION_USD',6,0.01,50),maxCallUSD:number(env,'EDEN_AI_MAX_CALL_USD',1.5,0.01,10),maxDurationMs:number(env,'EDEN_AI_MAX_SESSION_MINUTES',30,1,90)*60000,timeoutMs:number(env,'EDEN_AI_CALL_TIMEOUT_SECONDS',180,10,240)*1000,maxRewrites:number(env,'EDEN_AI_MAX_REWRITES',3,0,3)};
}
export function estimateCall(profile,input,{role,schema,imageCount=0}={}){
 // One token per UTF-8 byte + prompt/schema allowance is intentionally conservative.
 const inputBound=Buffer.byteLength(JSON.stringify(input))+Buffer.byteLength(JSON.stringify(schema||{}))+Buffer.byteLength(prompts[role]||'')+4096+imageCount*20000;
 if(inputBound>180000)fail(413,'Dossier trop volumineux : sélectionner moins de sources ou scinder la séance. Aucun contexte tronqué.');
 return {inputBound,usd:1.4*(inputBound*profile.inputUSDPerMillion+profile.maxOutputTokens*profile.outputUSDPerMillion)/1e6};
}
export async function callStructured({role,input,schema,config,fetchImpl=fetch,apiKey=process.env.OPENAI_API_KEY,signal,images=[]}){
 if(!apiKey)fail(503,'OPENAI_API_KEY absente : génération IA non exécutée.');
 const p=config.roles[role],body={model:p.model,store:false,service_tier:'default',max_output_tokens:p.maxOutputTokens,
  ...(p.effort==='none'&&p.model==='gpt-4.1'?{}:{reasoning:{effort:p.effort}}),
  input:[{role:'system',content:prompts[role]},{role:'user',content:images.length?[{type:'input_text',text:JSON.stringify(input)},...images.map(data=>({type:'input_image',image_url:`data:image/png;base64,${data}`,detail:'low'}))]:JSON.stringify(input)}],text:{format:{type:'json_schema',name:`Tween_${role}_v1`,strict:true,schema}}};
 const startedAt=new Date().toISOString(),start=Date.now();
 const trace={role,profileVersion:config.version,promptVersion:CHARTER_VERSION,requestedModel:p.model,parameters:{reasoning:body.reasoning||null,max_output_tokens:p.maxOutputTokens,store:false},requestHash:digest(body),startedAt,cache:'provider_usage_only'};
 try{
  const response=await fetchImpl('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(config.timeoutMs)]):AbortSignal.timeout(config.timeoutMs)});
  if(!response.ok)await failOpenAI(response);
  const result=await response.json();Object.assign(trace,{responseId:result.id,effectiveModel:result.model||null,status:result.status,usage:result.usage||null,stopReason:result.incomplete_details?.reason||null});
  if(result.status!=='completed')throw Error(`Réponse incomplète : ${result.incomplete_details?.reason||result.status||'statut absent'}.`);
  const parts=result.output?.flatMap(x=>x.content||[])||[];
  if(parts.some(x=>x.type==='refusal'))throw Error('Réponse refusée par le fournisseur.');
  const raw=parts.filter(x=>x.type==='output_text').map(x=>x.text).join('');if(!raw)throw Error('Réponse structurée vide.');
  const value=validate(schema,JSON.parse(raw));
  trace.outputHash=digest(raw);trace.durationMs=Date.now()-start;
  trace.costUSD=result.usage?(result.usage.input_tokens*p.inputUSDPerMillion+result.usage.output_tokens*p.outputUSDPerMillion)/1e6:null;
  trace.costMethod='Estimation USD tarif standard non mis en cache ; inclut le raisonnement dans output_tokens. Pas une facture.';
  return {value,trace};
 }catch(error){Object.assign(trace,{durationMs:Date.now()-start,error:error.message,status:trace.status||'failed',...(error.details?.provider==='openai'?{providerError:error.details}:{})});error.trace=trace;throw error;}
}
