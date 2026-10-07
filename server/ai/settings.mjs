import {fail,requireValue} from '../store.mjs';
import {qualityConfig,pipelineLimits} from '../pedagogy/provider.mjs';
import {getChatGPT,localChatGPTMode} from './chatgpt.mjs';
import {USAGE_URL} from './errors.mjs';

export async function aiPreferences(store,actor){const teacher=await store.get('teachers',actor.id);return teacher?.aiPreferences||{provider:'openai_api',connectionId:null,model:null};}
export async function savePreferences(store,actor,input,{chatgpt}={}){
 requireValue(['openai_api','chatgpt_plan'].includes(input.provider),'Mode d’accès IA invalide.');
 let connectionId=null,model=null;
 if(input.provider==='chatgpt_plan'){
  const client=chatgpt||getChatGPT(),profiles=await client.list(actor),profile=profiles.find(p=>p.id===input.connectionId);
  requireValue(profile,'Sélectionnez votre connexion ChatGPT.');connectionId=profile.id;
  const models=await client.models(actor,profile.id);requireValue(models.some(m=>m.slug===input.model),'Sélectionnez un modèle accessible à cette connexion.');model=input.model;
 }
 return store.transaction(async tx=>{const t=await tx.get('teachers',actor.id);if(!t||t.classId!==actor.classId)fail(403,'Compte professeur introuvable.');t.aiPreferences={provider:input.provider,connectionId,model};await tx.put('teachers',t);return t.aiPreferences;});
}
export async function aiStatus(store,actor,{chatgpt,env=process.env}={}){
 const preference=await aiPreferences(store,actor),mode=chatgpt?{enabled:true,state:'not_connected'}:localChatGPTMode(env);
 let apiReady=false,apiReason=null;try{qualityConfig(env);apiReady=!!env.OPENAI_API_KEY;if(!apiReady)apiReason='Clé API absente.';}catch(e){apiReason=e.message;}
 let connections=[];if(mode.enabled)try{connections=await (chatgpt||getChatGPT(env)).list(actor);}catch{mode.enabled=false;mode.state='configuration_incomplete';mode.reason='Le stockage local de la connexion doit être vérifié.';}
 const active=connections.find(p=>p.id===preference.connectionId),planReady=mode.enabled&&active?.state==='available'&&active.models.some(m=>m.slug===preference.model);
 return {preference,connections,usageURL:USAGE_URL,api:{state:apiReady?'available':'configuration_incomplete',reason:apiReason},chatgpt:{...mode,state:mode.enabled?(active?.state||'not_connected'):mode.state},
  configured:preference.provider==='chatgpt_plan'?!!planReady:apiReady,usage:{remaining:null,cost:null},executor:env.VERCEL?'unavailable':'local'};
}
export async function freezeProvider(store,actor,{chatgpt,env=process.env}={}){
 const preference=await aiPreferences(store,actor);
 if(preference.provider==='openai_api'){
  const config=qualityConfig(env);if(!env.OPENAI_API_KEY)fail(503,'OPENAI_API_KEY absente : aucun appel IA effectué.');return {...config,provider:'openai_api',ownerId:actor.id,classId:actor.classId,connectionId:null};
 }
 const client=chatgpt||getChatGPT(env),models=await client.models(actor,preference.connectionId);
 const selected=models.find(m=>m.slug===preference.model);requireValue(selected,'Ce modèle n’est plus accessible à la connexion choisie.');
 // Preserve pipeline budgets, but never reinterpret forbidden token limits as quota controls.
 const limits=pipelineLimits(env,{provider:'chatgpt_plan'});
 const roles=planProfiles(selected);
 return {...limits,version:'siwc-local-2026-10-07',provider:'chatgpt_plan',ownerId:actor.id,classId:actor.classId,connectionId:preference.connectionId,roles,maxUSD:null,maxCallUSD:null};
}
export function planProfiles(model){
 const effort=model.reasoningEfforts?.includes('high')?'high':null;
 return Object.fromEntries(['analysis','design','planReview','write','review','repair'].map(role=>[role,{model:model.slug,effort,billing:'chatgpt_plan',...(effort?{reasoningCapability:{source:'account-model-catalog',efforts:model.reasoningEfforts,checkedAt:new Date().toISOString()}}:{})}]));
}
