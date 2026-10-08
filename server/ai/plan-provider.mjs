import {validate} from '../contracts.mjs';
import {digest,CHARTER_VERSION} from '../pedagogy/contracts.mjs';
import {prompts} from '../pedagogy/prompts.mjs';
import {getChatGPT} from './chatgpt.mjs';
import {aiError,planError,planInterruption,rejectResponse} from './errors.mjs';

// A deliberately small HTTP allowlist. No inherited API parameters, tools, or remote state.
export const PLAN_FIELDS=Object.freeze(['model','instructions','input','store','stream','text']);
export function planRequest({role,input,schema,config,images=[]}) {
 const profile=config.roles[role];
 if(profile.effort!=null&&(profile.reasoningCapability?.source!=='account-model-catalog'||!profile.reasoningCapability.efforts.includes(profile.effort)))throw aiError('unsupported','Le réglage de raisonnement n’est pas confirmé pour cette route et ce modèle.');
 return {model:profile.model,instructions:prompts[role],store:false,stream:true,...(profile.effort?{reasoning:{effort:profile.effort}}:{}),
  input:[{role:'user',content:[{type:'input_text',text:JSON.stringify(input)},...images.map(data=>({type:'input_image',image_url:`data:image/png;base64,${data}`,detail:'low'}))]}],
  text:{format:{type:'json_schema',name:`Tween_${role}_v1`,strict:true,schema}}};
}

export async function readResponsesStream(response,{signal,onEvent,timeoutMs}={}) {
 const contentType=response.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase();
 // The ChatGPT plan route can omit Content-Type on a valid SSE response.
 // Success still requires parsing response.completed below, never just HTTP 200.
 if(!response.body||contentType&&contentType!=='text/event-stream'){
  await response.body?.cancel().catch(()=>{});
  throw aiError('uncertain','Le fournisseur n’a pas ouvert le flux attendu. Aucun résultat validé.');
 }
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',text='',bytes=0,savedCharacters=0;
 // Only public summaries and allowlisted lifecycle signals leave this parser.
 // Raw reasoning text, reasoning content and encrypted content are never copied.
 const summaries=new Map();let phase='accepted',summaryTruncated=false;
 const rememberSummary=(item,index,value,append=false)=>{
  if(typeof value!=='string')return;
  const key=`${item??0}:${index??0}`;
  if(!summaries.has(key)&&summaries.size>=16){summaryTruncated=true;return;}
  const full=(append?summaries.get(key)||'':'')+value;
  summaries.set(key,full.slice(0,6000));if(full.length>6000)summaryTruncated=true;
 };
 const activity=()=>{
  const summary=[...summaries.values()].join('\n\n');
  return {phase,lastSignalAt:new Date().toISOString(),outputCharacters:text.length,summary:summary.slice(0,6000),summaryTruncated:summaryTruncated||summary.length>6000};
 };
 const onAbort=()=>{reader.cancel(signal.reason).catch(()=>{});};
 signal?.addEventListener('abort',onAbort,{once:true});
 try{
  while(true){
   signal?.throwIfAborted();const {done,value}=await reader.read();
   signal?.throwIfAborted();
   buffer+=done?decoder.decode():decoder.decode(value,{stream:true});bytes+=value?.length||0;
   if(bytes>16*1024*1024)throw aiError('incomplete','Réponse trop volumineuse. Scindez la préparation.');
   buffer=buffer.replace(/\r\n/g,'\n');let end;
   while((end=buffer.indexOf('\n\n'))!==-1){
    const frame=buffer.slice(0,end);buffer=buffer.slice(end+2);
    const raw=frame.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).replace(/^ /,'')).join('\n');
    if(!raw||raw==='[DONE]')continue;
    let event;try{event=JSON.parse(raw);}catch{throw aiError('uncertain','Flux illisible. Le brouillon est conservé.');}
    if(['response.created','response.in_progress'].includes(event.type))await onEvent?.({type:event.type,responseId:event.response?.id,status:event.response?.status,model:event.response?.model,activity:activity()});
    if(event.type==='response.output_item.added'&&event.item?.type==='reasoning'){
     phase='reasoning';await onEvent?.({type:'response.output_item.added',activity:activity()});
    }
    if(['response.reasoning_summary_text.delta','response.reasoning_summary_text.done','response.reasoning_summary_part.done'].includes(event.type)){
     const delta=event.type.endsWith('.delta');
     rememberSummary(event.item_id??event.output_index,event.summary_index,delta?event.delta:event.type==='response.reasoning_summary_part.done'?(event.part?.type==='summary_text'?event.part.text:null):event.text,delta);
     phase='reasoning';await onEvent?.({type:event.type,activity:activity()});
    }
    if(event.type==='response.output_text.delta'&&typeof event.delta==='string'){
     text+=event.delta;phase='writing';const persist=text.length-savedCharacters>4096;
     await onEvent?.({type:event.type,activity:activity(),...persist?{partialOutput:text}:{}});if(persist)savedCharacters=text.length;
    }
    if(event.type==='response.failed'||event.type==='error')throw planError(event.response||event,response.status,response.headers,{stream:true});
    if(event.type==='response.incomplete')throw aiError('incomplete','La réponse ChatGPT est incomplète. Votre brouillon est conservé.');
    if(event.type==='response.completed'){
     const result=event.response;
     if(result?.status!=='completed')throw aiError('incomplete','Événement terminal incohérent.');
     const content=(result.output||[]).flatMap(x=>x.content||[]);
     if(content.some(x=>x.type==='refusal'))throw aiError('failed','Le fournisseur a refusé cette demande.');
     const complete=content.filter(x=>x.type==='output_text').map(x=>x.text).join('')||text;
     if(!complete)throw aiError('incomplete','La réponse ChatGPT est vide.');
     for(const [index,item] of (result.output||[]).entries())if(item.type==='reasoning')for(const [partIndex,part] of (item.summary||[]).entries())if(part.type==='summary_text')rememberSummary(item.id??index,partIndex,part.text);
     text=complete;phase='completed';
     await onEvent?.({type:event.type,responseId:result.id,status:result.status,model:result.model,activity:activity()});
     return {id:result.id,model:result.model,status:result.status,usage:result.usage||null,text:complete};
    }
   }
   if(done)throw aiError('uncertain','Flux interrompu sans confirmation de réussite. Une reprise explicite est nécessaire.');
  }
 }catch(error){const safe=planInterruption(error,{signal,timeoutMs});safe.partialOutput=text.slice(0,200000);throw safe;}
 finally{signal?.removeEventListener('abort',onAbort);await reader.cancel().catch(()=>{});reader.releaseLock();}
}

export async function callPlanStructured({role,input,schema,config,fetchImpl=fetch,signal,images=[],chatgpt=getChatGPT(),onEvent}) {
 const body=planRequest({role,input,schema,config,images}),owner={id:config.ownerId,classId:config.classId};
 const trace={provider:'chatgpt_plan',role,profileVersion:config.version,promptVersion:CHARTER_VERSION,requestedModel:body.model,
  parameters:{reasoning:body.reasoning||null,reasoningPolicy:body.reasoning?'explicit_catalog_verified':'provider_default_unverified',store:false,stream:true,timeoutMs:config.timeoutMs},requestHash:digest(body),startedAt:new Date().toISOString(),costUSD:null,costMethod:'Usage du forfait ChatGPT ; coût et quota restant inconnus.'};
 const start=Date.now();
 const timeout=AbortSignal.timeout(config.timeoutMs),combined=signal?AbortSignal.any([signal,timeout]):timeout;
 try{
  const response=await chatgpt.request(owner,config.connectionId,body,{fetchImpl,signal:combined});
  if(!response.ok)await rejectResponse(response,'chatgpt_plan');
  const result=await readResponsesStream(response,{signal:combined,onEvent,timeoutMs:config.timeoutMs});
  Object.assign(trace,{responseId:result.id,effectiveModel:result.model,status:result.status,usage:result.usage,outputHash:digest(result.text),durationMs:Date.now()-start});
  let value;try{value=validate(schema,JSON.parse(result.text));}catch{throw Object.assign(aiError('incomplete','Le contenu reçu ne respecte pas le contrat pédagogique. Brouillon à corriger.'),{partialOutput:result.text.slice(0,200000)});}
  return {value,trace};
 }catch(error){
  const safe=planInterruption(error,{signal:combined,timeoutMs:config.timeoutMs});
  Object.assign(trace,{durationMs:Date.now()-start,status:safe.details?.kind==='uncertain'?'unknown':'failed',error:safe.message,providerError:safe.details});safe.trace=trace;
  await chatgpt.noteError(owner,config.connectionId,safe);throw safe;
 }
}
