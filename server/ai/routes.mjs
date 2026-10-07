import express from 'express';
import {teacher,accountLimit} from '../auth.mjs';
import {fail,now} from '../store.mjs';
import {getChatGPT,browserBinding} from './chatgpt.mjs';
import {aiStatus,savePreferences,aiPreferences} from './settings.mjs';
import {readResponsesStream} from './plan-provider.mjs';
import {rejectResponse} from './errors.mjs';

export function aiRoutes(app,store,{chatgpt}={}) {
 const client=()=>chatgpt||getChatGPT();
 const local=(req,_res,next)=>{
  const c=client();
  if(!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress)||req.headers.host!==new URL(c.origin).host||req.headers['x-forwarded-host']||req.headers['x-forwarded-for'])fail(403,'Connexion personnelle locale uniquement.');
  if(req.path!=='/auth/callback'&&['POST','PUT','DELETE'].includes(req.method)&&req.headers.origin!==c.origin)fail(403,'Origine locale requise.');
  next();
 };
 app.get('/api/ai/settings',teacher,async(req,res)=>res.json(await aiStatus(store,req.user,{chatgpt})));
 app.put('/api/ai/settings',teacher,async(req,res)=>{
  if(req.body.provider==='chatgpt_plan')local(req,res,()=>{});
  res.json(await savePreferences(store,req.user,req.body,{chatgpt}));
 });
 app.post('/api/ai/chatgpt/connect',teacher,local,accountLimit(10),express.urlencoded({extended:false}),async(req,res)=>{
  const binding=browserBinding();
  const url=await client().begin(req.user,{sessionId:req.sessionId,browserBinding:binding,profileId:req.body.profileId||null,consent:req.body.consent==='true'});
  res.setHeader('Set-Cookie',`tween_siwc=${binding}; HttpOnly; SameSite=Lax; Path=/auth/callback; Max-Age=300`);
  res.setHeader('Referrer-Policy','no-referrer');res.redirect(303,url);
 });
 app.get('/auth/callback',local,async(req,res)=>{
  res.setHeader('Referrer-Policy','no-referrer');
  const binding=req.headers.cookie?.split(';').map(x=>x.trim()).find(x=>x.startsWith('tween_siwc='))?.slice('tween_siwc='.length);
  res.setHeader('Set-Cookie','tween_siwc=; HttpOnly; SameSite=Lax; Path=/auth/callback; Max-Age=0');
  try{
   const result=await client().finish(new URL(req.originalUrl,client().origin).searchParams,binding,async a=>{
    const s=await store.get('sessions',a.sessionId),t=await store.get('teachers',a.ownerId);
    return s&&t&&s.role==='teacher'&&s.userId===a.ownerId&&s.classId===a.classId&&t.classId===a.classId&&s.expiresAt>now()&&(s.authVersion||0)===(t.authVersion||0);
   });
   res.redirect(303,'/ai-settings.html?signin='+(result.denied?'declined':'connected'));
  }catch{res.redirect(303,'/ai-settings.html?signin=failed');}
 });
 app.get('/api/ai/chatgpt/:id/models',teacher,local,async(req,res)=>res.json(await client().models(req.user,req.params.id)));
 app.post('/api/ai/chatgpt/:id/recheck',teacher,local,accountLimit(10),async(req,res)=>res.json(await client().models(req.user,req.params.id,{recheck:true})));
 app.post('/api/ai/chatgpt/:id/disconnect',teacher,local,async(req,res)=>res.json(await client().disconnect(req.user,req.params.id)));
 app.post('/api/ai/chatgpt/:id/acknowledge',teacher,local,async(req,res)=>{await client().acknowledge(req.user,req.params.id);res.json({ok:true});});
 app.post('/api/ai/chatgpt/:id/verify',teacher,local,accountLimit(3),async(req,res)=>{
  const p=await aiPreferences(store,req.user);
  if(p.provider!=='chatgpt_plan'||p.connectionId!==req.params.id||!p.model)fail(400,'Enregistrez cette connexion et son modèle avant l’essai.');
  if((await store.list('generation_jobs',req.user.classId)).some(j=>j.config?.connectionId===p.connectionId&&['queued','running','retry_wait'].includes(j.status)))fail(409,'Attendez la fin de la préparation avant cet essai.');
  try{
   const timeoutMs=30000,signal=AbortSignal.timeout(timeoutMs);
   const response=await client().request(req.user,p.connectionId,{model:p.model,input:[{role:'user',content:'Réponds exactement : Connexion vérifiée.'}],store:false,stream:true},{signal});
   if(!response.ok)await rejectResponse(response,'chatgpt_plan');const result=await readResponsesStream(response,{signal,timeoutMs});
   res.json({completed:true,model:result.model||p.model,usage:result.usage});
  }catch(error){await client().noteError(req.user,p.connectionId,error);throw error;}
 });
}
