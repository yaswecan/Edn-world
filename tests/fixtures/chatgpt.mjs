import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createChatGPT,ISSUER,AUTHORIZE,TOKEN,SCOPES} from '../../server/ai/chatgpt.mjs';

export const owner={id:'teacher-one',classId:'A1',role:'teacher'};
export const discovery={issuer:ISSUER,authorization_endpoint:AUTHORIZE,token_endpoint:TOKEN,jwks_uri:ISSUER+'/jwks',revocation_endpoint:ISSUER+'/revoke',response_types_supported:['code'],subject_types_supported:['public'],id_token_signing_alg_values_supported:['RS256']};
export const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}});
export async function chatgptFixture({origin='http://127.0.0.1:4181'}={}){
 const directory=await mkdtemp(join(tmpdir(),'tween-siwc-'));
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048}),jwk={...publicKey.export({format:'jwk'}),kid:'test',alg:'RS256',use:'sig'};
 const codes=new Map(),calls=[];
 const authority={codes,calls,refreshes:0,scope:SCOPES,subject:'subject-one',models:[{slug:'account-model',display_name:'Modèle du compte',visibility:'list'},{slug:'hidden',display_name:'Caché',visibility:'hide'}],tokenFailure:null,refreshFailure:null,modelFailure:null,revocationFailure:false};
 const jwt=(claims)=>{const header=Buffer.from(JSON.stringify({alg:'RS256',kid:'test'})).toString('base64url'),payload=Buffer.from(JSON.stringify(claims)).toString('base64url'),data=header+'.'+payload;return data+'.'+sign('RSA-SHA256',Buffer.from(data),privateKey).toString('base64url');};
 const fetchImpl=async(url,options={})=>{
  url=String(url);calls.push({url,method:options.method||'GET'});
  if(url===ISSUER+'/.well-known/openid-configuration')return json(discovery);
  if(url===ISSUER+'/jwks')return json({keys:[jwk]});
  if(url===TOKEN){
   const params=new URLSearchParams(options.body);authority.lastTokenParams=params;
   if(params.get('grant_type')==='refresh_token'){
    authority.refreshes++;await new Promise(r=>setTimeout(r,25));if(authority.refreshFailure)return authority.refreshFailure();
    return json({access_token:'synthetic-access-rotated',refresh_token:'synthetic-refresh-rotated',token_type:'Bearer',expires_in:3600,scope:authority.scope});
   }
   if(authority.tokenFailure)return authority.tokenFailure();
   const c=codes.get(params.get('code'));if(!c)return json({error:'invalid_grant'},400);
   const claims={iss:ISSUER,aud:params.get('client_id'),sub:authority.subject,email:'same@example.test',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600,nonce:c.nonce,...c.claims};
   let idToken=jwt(claims);if(c.badSignature)idToken=idToken.slice(0,-10)+'invalidsig';
   return json({access_token:'synthetic-access',refresh_token:'synthetic-refresh',id_token:idToken,token_type:'Bearer',expires_in:3600,...(authority.scope===null?{}:{scope:authority.scope})});
  }
  if(url==='https://api.openai.com/v1/models')return authority.modelFailure?authority.modelFailure():json({models:authority.models});
  if(url==='https://api.openai.com/v1/responses'&&authority.inference)return authority.inference(options);
  if(url===ISSUER+'/revoke')return new Response('',{status:authority.revocationFailure?503:200});
  throw Error('Unexpected network destination in test');
 };
 const client=createChatGPT({directory,origin,fetchImpl});
 async function pending({profileId,actor=owner,claims,badSignature}={}){
  const binding='synthetic-browser-binding',url=new URL(await client.begin(actor,{sessionId:'session-one',browserBinding:binding,profileId}));
  const code='code-'+codes.size;codes.set(code,{nonce:url.searchParams.get('nonce'),claims,badSignature});
  const params=new URLSearchParams({state:url.searchParams.get('state'),code,...(!profileId?{client_id:'oaiapp_'+codes.size}:{})});return {url,params,binding};
 }
 async function connect(options={}){const p=await pending(options);return client.finish(p.params,p.binding,async()=>true);}
 return {directory,client,authority,fetchImpl,pending,connect,close:()=>rm(directory,{recursive:true,force:true})};
}
