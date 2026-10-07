import * as oauth from 'oauth4webapi';
import {randomBytes,randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {credentialVault} from './vault.mjs';
import {aiError,planError,rejectResponse} from './errors.mjs';
import {fail,requireValue} from '../store.mjs';

export const ISSUER='https://auth.openai.com';
export const RESOURCE='https://api.openai.com/v1';
export const AUTHORIZE=ISSUER+'/api/accounts/authorize';
export const TOKEN=ISSUER+'/api/accounts/oauth/token';
export const SCOPES='openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const random=()=>randomBytes(32).toString('base64url');
const digest=value=>createHash('sha256').update(value).digest('hex');
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const permitted=scopes=>['resource.invoke','chatgpt.tokens.use.direct'].every(s=>scopes?.includes(s));
const clearTokens=p=>{delete p.tokens;delete p.refreshPending;delete p.disconnectPending;p.models=[];};
const owned=(data,owner,id)=>{const p=data.profiles.find(p=>p.id===id&&p.ownerId===owner.id&&p.classId===owner.classId);if(!p)fail(404,'Connexion introuvable.');return p;};
const safe=p=>({id:p.id,label:p.label,email:p.email||null,state:p.state,planAuthorized:permitted(p.scopes),models:p.models||[],welcomePending:!!p.welcomePending,remoteRevocationConfirmed:p.remoteRevocationConfirmed??null});

export function localChatGPTMode(env=process.env) {
 if(env.VERCEL||env.NODE_ENV==='production'||env.EDEN_CHATGPT_MODE==='hosted')return {enabled:false,state:'disabled',reason:'Cette option nécessite l’activation de l’intégration hébergée. Accès partenaire requis.'};
 if(env.EDEN_CHATGPT_MODE!=='local')return {enabled:false,state:'disabled',reason:'Démarrez le parcours personnel avec npm run dev:chatgpt.'};
 if(env.EDEN_PERSONAL_LOCAL!=='1'||env.DATABASE_URL||env.HOST!=='127.0.0.1'||!env.EDEN_CHATGPT_VAULT)return {enabled:false,state:'configuration_incomplete',reason:'Utilisez le démarrage personnel isolé : npm run dev:chatgpt.'};
 return {enabled:true,state:'not_connected',reason:null};
}

export function createChatGPT({directory,origin,fetchImpl=fetch}={}) {
 const base=new URL(origin);requireValue(base.protocol==='http:'&&base.hostname==='127.0.0.1'&&base.pathname==='/'&&!base.username&&!base.password&&!base.search&&!base.hash,'Origine locale SIWC invalide.');
 const redirectUri=base.origin+'/auth/callback',vault=credentialVault(directory);
 let discovery;
 const options=()=>({[oauth.customFetch]:fetchImpl,signal:AbortSignal.timeout(20000)});
 async function metadata() {
  discovery??=(async()=>{
   const as=await oauth.processDiscoveryResponse(new URL(ISSUER),await oauth.discoveryRequest(new URL(ISSUER),options()));
   // Never accept credentials destinations supplied by a browser or application settings.
   if(as.authorization_endpoint!==AUTHORIZE||as.token_endpoint!==TOKEN)throw aiError('configuration_incomplete','Le contrat OAuth publié a changé. Vérifiez la configuration.');
   for(const key of ['jwks_uri','revocation_endpoint']){const u=new URL(as[key]);if(u.origin!==ISSUER||u.username||u.password)throw aiError('configuration_incomplete','Métadonnées OAuth inattendues.');}
   return as;
  })().catch(error=>{discovery=null;throw error.details?error:aiError('temporary','Découverte OpenAI indisponible. Réessayez plus tard.');});
  return discovery;
 }
 function tokenSet(result,previous={}) {
  if(!Number.isFinite(result.expires_in)||result.expires_in<=0)throw aiError('configuration_incomplete','Expiration OAuth absente ou invalide.');
  return {access_token:result.access_token,refresh_token:result.refresh_token||previous.refresh_token,id_token:result.id_token||previous.id_token,
   expiresAt:Date.now()+result.expires_in*1000,earliestRefreshAt:result.earliest_refresh_at??null};
 }
 async function list(owner){return vault.locked(data=>data.profiles.filter(p=>p.ownerId===owner.id&&p.classId===owner.classId).map(safe));}
 async function begin(owner,{sessionId,browserBinding,profileId,consent=false}) {
  if(owner.role!=='teacher')fail(403,'Action réservée au professeur.');
  await metadata();
  return vault.locked(async(data,save)=>{
   const profile=profileId?owned(data,owner,profileId):null;
   const attempt={state:oauth.generateRandomState(),nonce:oauth.generateRandomNonce(),verifier:oauth.generateRandomCodeVerifier(),expiresAt:Date.now()+300000,
    ownerId:owner.id,classId:owner.classId,sessionId,binding:digest(browserBinding),profileId:profile?.id||randomUUID(),clientId:profile?.clientId||null,redirectUri};
   data.attempts=data.attempts.filter(a=>a.expiresAt>Date.now()&&a.sessionId!==sessionId);data.attempts.push(attempt);await save();
   const params=new URLSearchParams({client_id:attempt.clientId||'dynamic_agent_client',ext_agent_host_id:data.hostId,response_type:'code',redirect_uri:redirectUri,scope:SCOPES,resource:RESOURCE,state:attempt.state,nonce:attempt.nonce,code_challenge_method:'S256',code_challenge:await oauth.calculatePKCECodeChallenge(attempt.verifier)});
   if(!profile?.clientId)params.set('agent_name_hint','Tween Teach');
   // No ID token in a browser-visible URL. Hints are optional; identity is checked below.
   if(consent)params.set('prompt','consent');
   return AUTHORIZE+'?'+params;
  });
 }
 async function finish(params,browserBinding,validateSession) {
  return vault.locked(async(data,save)=>{
   const state=params.get('state'),index=data.attempts.findIndex(a=>same(a.state,state)&&same(a.binding,digest(browserBinding||'')));
   if(index<0)fail(400,'Tentative de connexion invalide ou déjà utilisée.');
   const [attempt]=data.attempts.splice(index,1);await save();
   if(attempt.expiresAt<=Date.now()||!await validateSession(attempt))fail(401,'Tentative expirée. Recommencez depuis vos réglages.');
   const as=await metadata();
   if(params.has('error')){if(params.getAll('state').length!==1)fail(400,'Tentative invalide.');return {denied:true};}
   const supplied=params.get('client_id'),clientId=attempt.clientId||supplied;
   if(params.getAll('client_id').length>1||!clientId||clientId==='dynamic_agent_client'||!/^[A-Za-z0-9_-]{1,200}$/.test(clientId)||attempt.clientId&&supplied&&supplied!==attempt.clientId)fail(400,'Enregistrement ChatGPT incohérent.');
   const client={client_id:clientId},validated=oauth.validateAuthResponse(as,client,params,attempt.state);
   const owner={id:attempt.ownerId,classId:attempt.classId};
   let p=data.profiles.find(p=>p.id===attempt.profileId);
   if(p)owned(data,owner,p.id);
   else {p={id:attempt.profileId,ownerId:owner.id,classId:owner.classId,clientId,label:`Connexion ${data.profiles.filter(p=>p.ownerId===owner.id).length+1}`,state:'not_connected',models:[]};data.profiles.push(p);}
   // Keep a newly issued registration even if this one-time code expires.
   if(p.clientId!==clientId)fail(400,'Client ChatGPT inattendu.');await save();
   try {
    const response=await oauth.authorizationCodeGrantRequest(as,client,oauth.None(),validated,attempt.redirectUri,attempt.verifier,{...options(),additionalParameters:{resource:RESOURCE}});
    if(!response.ok)throw planError(await response.json().catch(()=>null),response.status,response.headers);
    const result=await oauth.processAuthorizationCodeResponse(as,client,response,{expectedNonce:attempt.nonce,requireIdToken:true});
    await oauth.validateApplicationLevelSignature(as,response,options());
    const identity=oauth.getValidatedIdTokenClaims(result);
    if(!identity?.sub||p.subject&&(p.subject!==identity.sub||p.issuer!==identity.iss))throw aiError('reconnect_required','L’identité ne correspond pas à cette connexion. Ajoutez un autre compte.');
    const tokens=tokenSet(result),scopes=typeof result.scope==='string'?result.scope.split(/\s+/):[];
    if(result.client_id&&result.client_id!==clientId)throw aiError('configuration_incomplete','Client OAuth inattendu.');
    Object.assign(p,{subject:identity.sub,issuer:identity.iss,email:typeof identity.email==='string'?identity.email:null,tokens,scopes,models:[],state:permitted(scopes)?'connected':'permission_missing',welcomePending:permitted(scopes)&&!p.welcomeSeen,refreshPending:false,disconnectPending:false});await save();
    return {owner,profileId:p.id,planAuthorized:permitted(scopes)};
   }catch(error){throw error.details?error:aiError('reconnect_required','La connexion n’a pas pu être vérifiée. Recommencez depuis les réglages.');}
  });
 }
 async function access(owner,id,{recheck=false}={}) {
  return vault.locked(async(data,save)=>{
   const p=owned(data,owner,id);
   if(p.disconnectPending){clearTokens(p);p.state='not_connected';await save();}
   if(!p.tokens)throw aiError('reconnect_required','Connectez votre compte ChatGPT pour préparer une séance.');
   if(!permitted(p.scopes))throw aiError('permission_missing','L’utilisation de votre abonnement n’est pas encore autorisée.');
   if(['usage_limit','permission_missing','configuration_incomplete','reconnect_required'].includes(p.state)&&!recheck)throw aiError(p.state,p.state==='usage_limit'?'Une limite d’utilisation a été atteinte. Consultez la gestion de l’usage ChatGPT.':'Vérifiez cette connexion dans les réglages IA.');
   if(p.refreshPending){p.state='reconnect_required';await save();throw aiError('reconnect_required','Un renouvellement a été interrompu. Reconnectez ce compte pour éviter de réutiliser un ancien jeton.');}
   if(p.tokens.expiresAt<=Date.now()+60000){
    if(!p.tokens.refresh_token){p.state='reconnect_required';await save();throw aiError('reconnect_required','Cette connexion doit être renouvelée dans les réglages.');}
    const earliest=p.tokens.earliestRefreshAt;
    const earliestAt=typeof earliest==='number'?(earliest<1e12?earliest*1000:earliest):Date.parse(earliest);
    if(Number.isFinite(earliestAt)&&earliestAt>Date.now()){
     if(p.tokens.expiresAt<=Date.now())throw aiError('temporary','Le renouvellement ChatGPT n’est pas encore disponible.',{retryAfterSeconds:Math.ceil((earliestAt-Date.now())/1000)});
    }else{
     const as=await metadata(),client={client_id:p.clientId};
     p.refreshPending=true;await save();
     try{
      const response=await oauth.refreshTokenGrantRequest(as,client,oauth.None(),p.tokens.refresh_token,{...options(),additionalParameters:{resource:RESOURCE}});
      if(!response.ok){p.refreshPending=false;throw planError(await response.json().catch(()=>null),response.status,response.headers);}
      const result=await oauth.processRefreshTokenResponse(as,client,response);
      if(result.id_token){await oauth.validateApplicationLevelSignature(as,response,options());const identity=oauth.getValidatedIdTokenClaims(result);if(identity.sub!==p.subject||identity.iss!==p.issuer)throw aiError('reconnect_required','Identité inattendue lors du renouvellement.');}
      if(result.client_id&&result.client_id!==p.clientId)throw aiError('reconnect_required','Client inattendu lors du renouvellement.');
      if(!result.refresh_token)throw aiError('reconnect_required','Renouvellement sans jeton de remplacement. Reconnectez ce compte.');
      p.tokens=tokenSet(result,p.tokens);if(typeof result.scope==='string')p.scopes=result.scope.split(/\s+/);
      p.refreshPending=false;p.state=permitted(p.scopes)?'connected':'permission_missing';await save();
     }catch(error){
      if(error.details?.kind==='reconnect_required'){clearTokens(p);p.state='reconnect_required';}
      // A transport failure can hide a rotated refresh token: preserve the set but require reauthorization.
      else p.state=p.refreshPending?'reconnect_required':error.details?.kind||'temporary';
      await save();throw error.details?error:aiError('reconnect_required','Renouvellement interrompu. Les credentials sont conservés ; reconnectez ce compte.');
     }
    }
   }
   if(!permitted(p.scopes))throw aiError('permission_missing','La permission d’utiliser le forfait n’a pas été renouvelée.');
   return p.tokens.access_token;
  });
 }
 async function noteError(owner,id,error){if(!error.details)return;await vault.locked(async(data,save)=>{const p=owned(data,owner,id);if(p.tokens){p.state=error.details.kind;await save();}});}
 async function request(owner,id,body,{signal,fetchImpl:send=fetchImpl}={}){
  const token=await access(owner,id);let response;
  await vault.locked(data=>{
   const p=owned(data,owner,id);
   // Sign-out and dispatch are serialized. A cached token cannot start a later call.
   if(p.disconnectPending||p.tokens?.access_token!==token||!permitted(p.scopes)||['usage_limit','permission_missing','configuration_incomplete','reconnect_required'].includes(p.state))throw aiError('reconnect_required','La connexion a changé avant l’envoi. Vérifiez-la dans les réglages.');
   signal?.throwIfAborted();
   response=send(RESOURCE+'/responses',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',Accept:'text/event-stream'},body:JSON.stringify(body),signal});
   response.catch(()=>{});
  });
  return response;
 }
 async function models(owner,id,{recheck=false}={}){
  try{
   const token=await access(owner,id,{recheck}),response=await fetchImpl(RESOURCE+'/models',{headers:{Authorization:`Bearer ${token}`,Accept:'application/json'},signal:AbortSignal.timeout(20000)});
   if(!response.ok)await rejectResponse(response,'chatgpt_plan');const body=await response.json();
   if(!Array.isArray(body.models))throw aiError('configuration_incomplete','Catalogue ChatGPT inattendu. Aucun modèle de secours sélectionné.');
   const result=body.models.filter(m=>m.visibility==='list').map(m=>{
    if(typeof m.slug!=='string'||!m.slug||m.slug.length>200||typeof m.display_name!=='string')throw aiError('configuration_incomplete','Catalogue ChatGPT incomplet.');
    const efforts=(m.supported_reasoning_levels||[]).map(x=>x.effort).filter(x=>['low','medium','high','xhigh','max'].includes(x));
    return {slug:m.slug,displayName:m.display_name.slice(0,200),...(efforts.length?{reasoningEfforts:[...new Set(efforts)],defaultReasoningEffort:m.default_reasoning_level||null}:{})};
   });
   await vault.locked(async(data,save)=>{const p=owned(data,owner,id);if(!p.tokens)throw aiError('reconnect_required','Connexion fermée pendant la découverte.');p.models=result;p.state=result.length?'available':'permission_missing';await save();});return result;
  }catch(error){const safeError=error.details?error:aiError('temporary','Le catalogue ChatGPT est temporairement indisponible.');await noteError(owner,id,safeError);throw safeError;}
 }
 async function disconnect(owner,id){
  return vault.locked(async(data,save)=>{
   const p=owned(data,owner,id);p.state='not_connected';p.disconnectPending=true;data.attempts=data.attempts.filter(a=>a.profileId!==id);await save();
   let confirmed=false;
   try{if(p.tokens?.refresh_token){const as=await metadata();for(let attempt=0;attempt<2;attempt++){const r=await oauth.revocationRequest(as,{client_id:p.clientId},oauth.None(),p.tokens.refresh_token,{...options(),additionalParameters:{token_type_hint:'refresh_token'}});if(r.status===200){confirmed=true;break;}if(r.status<500)break;await new Promise(r=>setTimeout(r,300+Math.random()*300));}}}
   catch{/* Never keep a usable appearance after local sign-out. */}
   clearTokens(p);p.scopes=[];p.remoteRevocationConfirmed=confirmed;await save();return {disconnected:true,remoteRevocationConfirmed:confirmed};
  });
 }
 async function acknowledge(owner,id){return vault.locked(async(data,save)=>{const p=owned(data,owner,id);p.welcomeSeen=true;p.welcomePending=false;await save();});}
 return {origin:base.origin,redirectUri,list,begin,finish,access,request,models,disconnect,noteError,acknowledge};
}
let runtime;
export function getChatGPT(env=process.env){
 const mode=localChatGPTMode(env);if(!mode.enabled)throw aiError(mode.state,mode.reason);
 const origin=`http://127.0.0.1:${env.PORT||4181}`;
 const key=env.EDEN_CHATGPT_VAULT+'|'+origin;
 if(runtime?.key!==key)runtime={key,client:createChatGPT({directory:env.EDEN_CHATGPT_VAULT,origin})};
 return runtime.client;
}
export const browserBinding=random;
