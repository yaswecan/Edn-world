import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat,chmod} from 'node:fs/promises';
import {join} from 'node:path';
import {chatgptFixture,owner,json} from './fixtures/chatgpt.mjs';
import {credentialVault} from '../server/ai/vault.mjs';
import {localChatGPTMode,createChatGPT,SCOPES} from '../server/ai/chatgpt.mjs';

test('hosted flags never authorize a local runtime',()=>{
 for(const env of [{EDEN_CHATGPT_MODE:'hosted'},{EDEN_CHATGPT_MODE:'local',VERCEL:'1'},{EDEN_CHATGPT_MODE:'local',NODE_ENV:'production'},{EDEN_CHATGPT_MODE:'local',EDEN_PERSONAL_LOCAL:'1',HOST:'127.0.0.1',DATABASE_URL:'production',EDEN_CHATGPT_VAULT:'/tmp/no'}])assert.equal(localChatGPTMode(env).enabled,false);
 assert.equal(localChatGPTMode({}).state,'disabled');
});
test('PKCE, callback, cryptographic identity and grant validation; registration/host reused after logout',async()=>{
 const f=await chatgptFixture();try{
  const p=await f.pending();assert.equal(p.url.searchParams.get('client_id'),'dynamic_agent_client');assert.equal(p.url.searchParams.get('agent_name_hint'),'Tween Teach');assert.equal(p.url.searchParams.get('code_challenge_method'),'S256');assert.equal(p.url.searchParams.get('scope'),SCOPES);assert.match(p.url.searchParams.get('ext_agent_host_id'),/^urn:uuid:/);
  const result=await f.client.finish(p.params,p.binding,async()=>true),params=f.authority.lastTokenParams;
  assert.equal(params.get('redirect_uri'),p.url.searchParams.get('redirect_uri'));assert.equal(params.get('client_id'),'oaiapp_1');assert.equal(params.has('client_secret'),false);assert.equal(params.get('resource'),'https://api.openai.com/v1');
  const initial=(await f.client.list(owner))[0];assert.equal(initial.state,'connected');assert.equal(initial.planAuthorized,true);assert.equal(JSON.stringify(initial).includes('synthetic-access'),false);
  assert.deepEqual(await f.client.models(owner,result.profileId),[{slug:'account-model',displayName:'Modèle du compte'}]);assert.equal((await f.client.list(owner))[0].state,'available');
  assert.equal((await stat(join(f.directory,'connections.json'))).mode&0o777,0o600);
  assert.equal((await f.client.disconnect(owner,result.profileId)).remoteRevocationConfirmed,true);
  const saved=JSON.parse(await readFile(join(f.directory,'connections.json'),'utf8'));assert.equal(saved.profiles[0].tokens,undefined);
  const returning=await f.pending({profileId:result.profileId});assert.equal(returning.url.searchParams.get('client_id'),'oaiapp_1');assert.equal(returning.url.searchParams.has('agent_name_hint'),false);assert.equal(returning.url.searchParams.get('ext_agent_host_id'),p.url.searchParams.get('ext_agent_host_id'));
  await f.client.finish(returning.params,returning.binding,async()=>true);
 }finally{await f.close();}
});
test('denial, state mismatch, wrong browser, replay and revoked teacher session never exchange a code',async()=>{
 const f=await chatgptFixture();try{
  const p=await f.pending(),bad=new URLSearchParams(p.params);bad.set('state','wrong');await assert.rejects(f.client.finish(bad,p.binding,async()=>true));
  await assert.rejects(f.client.finish(p.params,'wrong-browser',async()=>true));
  const denied=new URLSearchParams({state:p.params.get('state'),error:'access_denied'});assert.equal((await f.client.finish(denied,p.binding,async()=>true)).denied,true);
  await assert.rejects(f.client.finish(p.params,p.binding,async()=>true));
  const q=await f.pending();await assert.rejects(f.client.finish(q.params,q.binding,async()=>false));assert.equal(f.authority.lastTokenParams,undefined);
 }finally{await f.close();}
});
test('tampered signature, nonce, issuer, audience, expiration and identity are rejected',async()=>{
 for(const options of [{badSignature:true},{claims:{nonce:'wrong'}},{claims:{iss:'https://evil.test'}},{claims:{aud:'wrong'}},{claims:{exp:1}}]){
  const f=await chatgptFixture();try{const p=await f.pending(options);await assert.rejects(f.client.finish(p.params,p.binding,async()=>true));assert.equal((await f.client.list(owner))[0].state,'not_connected');}finally{await f.close();}
 }
 const f=await chatgptFixture();try{
  const {profileId}=await f.connect();const p=await f.pending({profileId,claims:{sub:'someone-else'}});await assert.rejects(f.client.finish(p.params,p.binding,async()=>true),/identité/i);
  const q=await f.pending({profileId});q.params.set('client_id','oaiapp_injected');await assert.rejects(f.client.finish(q.params,q.binding,async()=>true),/incohérent/);
  assert.equal(JSON.parse(await readFile(join(f.directory,'connections.json'),'utf8')).profiles[0].subject,'subject-one');
 }finally{await f.close();}
});
test('identity without granted plan scopes remains connected without inference or model discovery',async()=>{
 for(const scope of ['openid profile email',null,'openid chatgpt.tokens.use.direct']){const f=await chatgptFixture();try{
  f.authority.scope=scope;const {profileId}=await f.connect();assert.equal((await f.client.list(owner))[0].state,'permission_missing');
  await assert.rejects(f.client.models(owner,profileId),/autorisé/);assert.equal(f.authority.calls.some(c=>c.url.endsWith('/models')),false);
 }finally{await f.close();}}
});
test('same email registrations stay distinct, owner isolation and returning client ID survive a failed exchange',async()=>{
 const f=await chatgptFixture();try{
  const a=await f.connect(),b=await f.connect();assert.notEqual(a.profileId,b.profileId);assert.equal((await f.client.list(owner)).length,2);
  const other={...owner,id:'teacher-two'};assert.deepEqual(await f.client.list(other),[]);await assert.rejects(f.client.access(other,a.profileId),/introuvable/);
  f.authority.tokenFailure=()=>json({error:'invalid_grant'},400);const p=await f.pending();await assert.rejects(f.client.finish(p.params,p.binding,async()=>true));
  const retained=(await f.client.list(owner)).at(-1);const again=await f.pending({profileId:retained.id});assert.notEqual(again.url.searchParams.get('client_id'),'dynamic_agent_client');
 }finally{await f.close();}
});
test('concurrent refresh is serialized and atomic; revoked and uncertain rotations do not replay tokens',async()=>{
 const f=await chatgptFixture();try{
  const {profileId}=await f.connect(),vault=credentialVault(f.directory);
  await vault.locked(async(data,save)=>{data.profiles[0].tokens.expiresAt=1;await save();});
  const second=createChatGPT({directory:f.directory,origin:'http://127.0.0.1:4181',fetchImpl:f.fetchImpl});
  const tokens=await Promise.all([f.client.access(owner,profileId),second.access(owner,profileId),f.client.access(owner,profileId)]);assert.equal(new Set(tokens).size,1);assert.equal(f.authority.refreshes,1);assert.equal(f.authority.lastTokenParams.has('scope'),false);
  await vault.locked(async(data,save)=>{data.profiles[0].tokens.expiresAt=1;await save();});f.authority.refreshFailure=()=>json({error:'refresh_token_reused'},400);
  await assert.rejects(f.client.access(owner,profileId));assert.equal((await f.client.list(owner))[0].state,'reconnect_required');assert.equal(JSON.parse(await readFile(join(f.directory,'connections.json'),'utf8')).profiles[0].tokens,undefined);
 }finally{await f.close();}
});
test('temporary network and revocation failures retain connection appropriately; interrupted refresh is fenced',async()=>{
 const f=await chatgptFixture();try{
  const {profileId}=await f.connect(),vault=credentialVault(f.directory);
  f.authority.modelFailure=()=>json({detail:'sensitive upstream message'},503);await assert.rejects(f.client.models(owner,profileId));assert.ok(JSON.parse(await readFile(join(f.directory,'connections.json'),'utf8')).profiles[0].tokens);
  await vault.locked(async(data,save)=>{data.profiles[0].refreshPending=true;await save();});await assert.rejects(f.client.access(owner,profileId),/renouvellement a été interrompu/);assert.equal(f.authority.refreshes,0);
  f.authority.revocationFailure=true;assert.equal((await f.client.disconnect(owner,profileId)).remoteRevocationConfirmed,false);assert.equal((await f.client.list(owner))[0].state,'not_connected');
  assert.equal(JSON.parse(await readFile(join(f.directory,'connections.json'),'utf8')).profiles[0].tokens,undefined);
  await chmod(join(f.directory,'connections.json'),0o644);await assert.rejects(f.client.list(owner),/non protégé/);
 }finally{await f.close();}
});
