import {failOpenAI} from '../openai-errors.mjs';

export const USAGE_URL = 'https://chatgpt.com/settings/usage';
const codes = {
 server_is_overloaded: ['temporary', 'Le modèle ChatGPT est temporairement surchargé. Le travail enregistré et les fragments sont conservés.'],
 invalid_json_schema: ['failed', 'Le format de préparation envoyé par l’application a été refusé par ChatGPT. Votre brouillon est conservé ; reprenez cette étape après correction de l’application.'],
 subscription_sharing_usage_limit_exceeded: ['usage_limit', 'Une limite d’utilisation a été atteinte. Consultez la gestion de l’usage ChatGPT.'],
 subscription_sharing_user_not_eligible: ['permission_missing', 'L’utilisation du forfait est indisponible pour ce compte ou cet espace ChatGPT.'],
 subscription_sharing_usage_unavailable: ['temporary', 'La vérification de l’usage ChatGPT est temporairement indisponible.'],
 subscription_sharing_user_unavailable: ['temporary', 'Le compte ou l’espace ChatGPT est temporairement indisponible.'],
 subscription_sharing_unsupported_capability: ['unsupported', 'Une capacité demandée n’est pas acceptée par ChatGPT. Le brouillon est conservé.'],
 subscription_sharing_route_not_supported: ['configuration_incomplete', 'Cette route n’est pas autorisée pour l’intégration ChatGPT.'],
 subscription_sharing_invalid_user: ['reconnect_required', 'La connexion ChatGPT doit être vérifiée. Reconnectez ce compte.'],
 chatpass_v2_scope_not_authorized: ['permission_missing', 'L’utilisation de votre abonnement n’est pas autorisée.'],
 chatpass_v2_invalid_authorization_context: ['permission_missing', 'L’autorisation ChatGPT ne permet pas cette opération.'],
 invalid_client: ['configuration_incomplete', 'L’enregistrement de cette connexion doit être vérifié.'],
 ...Object.fromEntries(['invalid_grant','invalid_refresh_token','token_expired','refresh_token_expired','refresh_token_invalidated','refresh_token_reused'].map(code=>[code,['reconnect_required','Reconnectez votre compte ChatGPT. Le brouillon est conservé.']]))
};
export function retryAfter(headers, at=Date.now()) {
 const value=headers?.get('retry-after');if(!value)return null;
 const seconds=/^\d+(\.\d+)?$/.test(value)?Number(value):(Date.parse(value)-at)/1000;
 return Number.isFinite(seconds)&&seconds>=0?Math.ceil(seconds):null;
}
export function aiError(kind,message,details={}) {
 return Object.assign(new Error(message),{status:502,details:{provider:'chatgpt_plan',kind,retryable:kind==='temporary',...details}});
}
export function planInterruption(error,{signal,timeoutMs}={}) {
 if(error.details)return error;
 const reason=signal?.aborted?signal.reason:error;
 if(reason?.name==='TimeoutError')return aiError('uncertain',`Le délai maximal de l’appel ChatGPT${timeoutMs?` (${Math.ceil(timeoutMs/1000)} s)`:''} a été atteint. Le texte partiel est conservé, mais aucun résultat complet n’a été confirmé. Reprenez cette étape pour réessayer.`,{interruption:'timeout',...(timeoutMs?{timeoutMs}:{})});
 if(signal?.aborted||reason?.name==='AbortError')return aiError('uncertain','L’appel ChatGPT a été annulé. Le texte partiel est conservé ; son issue reste incertaine.',{interruption:'aborted'});
 return aiError('uncertain','La connexion à ChatGPT a été interrompue. Le texte partiel est conservé ; son issue reste incertaine.',{interruption:'transport'});
}
export function planError(body,status,headers,{stream=false}={}) {
 const error=body?.error&&typeof body.error==='object'?body.error:body;
 const candidate=typeof body?.error==='string'?body.error:error?.code;
 // Keep bounded machine codes, including future codes, without retaining arbitrary messages.
 const code=typeof candidate==='string'&&candidate.length<=120&&/^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(candidate)?candidate:null;
 const recovery=Object.hasOwn(codes,code)?codes[code]:null;
 const [kind,message]=recovery|| (status===401?['reconnect_required','Reconnectez votre compte ChatGPT.']:status===403?['permission_missing','Cette opération n’est pas autorisée pour votre connexion ChatGPT.']:status===429?['usage_limit','ChatGPT refuse momentanément de nouveaux appels. La cause précise n’est pas disponible.']:status>=500?['temporary','ChatGPT est temporairement indisponible.']:['failed','La demande ChatGPT a échoué. Votre brouillon est conservé.']);
 const details={providerStatus:status,code,bodyShape:body?.error?'error':body?.detail?'detail':'other',stream};
 const requestId=headers?.get('x-request-id');if(/^[\w-]{1,200}$/.test(requestId||''))details.requestId=requestId;
 const param=error?.param;if(typeof param==='string'&&/^[a-zA-Z0-9_.\[\]-]{1,100}$/.test(param))details.param=param;
 const seconds=retryAfter(headers);if(seconds!==null&&kind==='temporary')details.retryAfterSeconds=seconds;
 return aiError(kind,message,details);
}
export async function rejectResponse(response,provider) {
 if(provider==='openai_api')return failOpenAI(response);
 let body;try{body=await response.json();}catch{body=null;}
 throw planError(body,response.status,response.headers);
}
export function nextRetryAt(details,attempt,{at=Date.now(),random=Math.random}={}) {
 // Retry-After is a minimum, never shortened by our cap. Only the fallback is bounded.
 const delay=details.retryAfterSeconds==null?Math.min(60000,1000*2**Math.min(attempt,6))*(0.75+random()*0.5):details.retryAfterSeconds*1000;
 return new Date(at+delay).toISOString();
}
