import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {pedagogyFixture} from './fixtures/pedagogy.mjs';
import {chatgptFixture} from './fixtures/chatgpt.mjs';
import {passwordHash} from '../server/auth.mjs';
import {createApp} from '../server/app.mjs';

async function fixture(){
 const {store,actor}=await pedagogyFixture(),server=createServer();server.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}`,f=await chatgptFixture({origin:base});server.on('request',createApp(store,{chatgpt:f.client}));
 await store.insert('teachers',{...actor,id:'teacher-two',username:'second'});await store.insert('learners',{id:'student-one',classId:'A1',username:'student',passwordHash:passwordHash('student-only-password')});
 const request=async(path,{method='GET',cookie,body,headers={},raw=false,redirect='manual'}={})=>{const r=await fetch(base+path,{method,redirect,headers:{...(cookie?{Cookie:cookie}:{}),Origin:base,'Content-Type':'application/json',...headers},body:body==null?undefined:raw?body:JSON.stringify(body)});return {r,data:r.headers.get('content-type')?.includes('application/json')?await r.json():await r.text()};};
 const login=async(role,username,password)=>{const {r}=await request('/api/login',{method:'POST',body:{role,username,password}});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const teacher=await login('teacher','professeur','quality-preview-only'),second=await login('teacher','second','quality-preview-only'),student=await login('student','student','student-only-password');
 return {...f,store,actor,base,teacher,second,student,request,close:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));await store.close();await f.close();}};
}
test('teacher/student and same-class teacher isolation apply to settings, callbacks, connections and jobs',async()=>{
 const f=await fixture();try{
  assert.equal((await f.request('/api/ai/settings')).r.status,401);
  for(const path of ['/api/ai/settings','/api/preparation/jobs'])assert.equal((await f.request(path,{cookie:f.student})).r.status,403);
  assert.equal((await f.request('/api/ai/chatgpt/connect',{method:'POST',cookie:f.student,body:{}})).r.status,403);
  const {profileId}=await f.connect({actor:f.actor});
  for(const [path,method] of [[`/api/ai/chatgpt/${profileId}/models`,'GET'],[`/api/ai/chatgpt/${profileId}/disconnect`,'POST']])assert.equal((await f.request(path,{method,cookie:f.second,body:method==='POST'?{}:undefined})).r.status,404);
  let result=await f.request('/api/ai/settings',{method:'PUT',cookie:f.teacher,body:{provider:'chatgpt_plan',connectionId:profileId,model:'account-model'}});assert.equal(result.r.status,200);
  f.authority.inference=options=>{assert.equal(JSON.parse(options.body).stream,true);return new Response('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',model:'account-model',output:[{content:[{type:'output_text',text:'Connexion vérifiée.'}]}]}})+'\n\n',{headers:{'content-type':'text/event-stream'}});};
  const probe=await f.request(`/api/ai/chatgpt/${profileId}/verify`,{method:'POST',cookie:f.teacher,body:{}});assert.equal(probe.r.status,200);assert.equal(probe.data.completed,true);assert.doesNotMatch(JSON.stringify(probe.data),/synthetic-access|synthetic-refresh/);
  result=await f.request('/api/preparation/jobs',{method:'POST',cookie:f.teacher,body:{entryId:'box',intent:'Préparer',requestId:'api-action'}});assert.equal(result.r.status,202);const id=result.data.id;
  assert.equal((await f.request(`/api/ai/chatgpt/${profileId}/verify`,{method:'POST',cookie:f.teacher,body:{}})).r.status,409);
  for(const [suffix,method] of [['','GET'],['/candidates','GET'],['/cancel','POST'],['/resume','POST']])assert.equal((await f.request(`/api/preparation/jobs/${id}${suffix}`,{method,cookie:f.second,body:method==='POST'?{confirmed:true}:undefined})).r.status,404);
  const own=await f.request('/api/preparation/jobs',{cookie:f.second});assert.deepEqual(own.data,[]);
  const settings=await f.request('/api/ai/settings',{cookie:f.teacher});assert.doesNotMatch(JSON.stringify(settings.data),/synthetic-access|synthetic-refresh|id_token|clientId|subject-one/);
  const second=await f.request('/api/ai/settings',{cookie:f.second});assert.deepEqual(second.data.connections,[]);
 }finally{await f.close();}
});
test('local routes reject remote origins, DNS rebinding and forwarded requests; callback binds a live teacher session',async()=>{
 const f=await fixture();try{
  for(const headers of [{Origin:'https://evil.test'},{Host:'evil.test',Origin:'http://evil.test'},{'X-Forwarded-For':'1.2.3.4'},{Origin:''}])assert.equal((await f.request('/api/ai/chatgpt/connect',{method:'POST',cookie:f.teacher,body:{},headers})).r.status,403);
  const connected=await f.request('/api/ai/chatgpt/connect',{method:'POST',cookie:f.teacher,body:{}});assert.equal(connected.r.status,303);
  const location=new URL(connected.r.headers.get('location'));assert.equal(location.origin,'https://auth.openai.com');const binding=connected.r.headers.get('set-cookie').split(';')[0];assert.match(connected.r.headers.get('set-cookie'),/HttpOnly; SameSite=Lax/);
  f.authority.codes.set('http-code',{nonce:location.searchParams.get('nonce')});
  const params=new URLSearchParams({state:location.searchParams.get('state'),code:'http-code',client_id:'oaiapp_http'});
  // The primary SameSite=Strict cookie is absent on this cross-site callback.
  const callback=await f.request('/auth/callback?'+params,{cookie:binding});assert.equal(callback.r.status,303);assert.equal(callback.r.headers.get('location'),'/ai-settings.html?signin=connected');
  assert.equal((await f.request('/auth/callback?'+params,{cookie:binding})).r.headers.get('location'),'/ai-settings.html?signin=failed');
  const next=await f.request('/api/ai/chatgpt/connect',{method:'POST',cookie:f.teacher,body:{}}),u=new URL(next.r.headers.get('location'));
  await f.request('/api/logout',{method:'POST',cookie:f.teacher,body:{}});
  const expired=await f.request('/auth/callback?'+new URLSearchParams({state:u.searchParams.get('state'),code:'http-code',client_id:'oaiapp_expired'}),{cookie:next.r.headers.get('set-cookie').split(';')[0]});assert.equal(expired.r.headers.get('location'),'/ai-settings.html?signin=failed');
 }finally{await f.close();}
});
test('connection verification consumes real SSE even when the upstream omits Content-Type',async()=>{
 const f=await fixture();try{
  const {profileId}=await f.connect({actor:f.actor});
  assert.equal((await f.request('/api/ai/settings',{method:'PUT',cookie:f.teacher,body:{provider:'chatgpt_plan',connectionId:profileId,model:'account-model'}})).r.status,200);
  let calls=0;
  f.authority.inference=options=>{
   calls++;assert.equal(new Headers(options.headers).get('accept'),'text/event-stream');
   const body=JSON.parse(options.body);assert.equal(body.stream,true);assert.equal(body.store,false);
   // Byte responses preserve the missing Content-Type observed on the live route.
   return new Response(new TextEncoder().encode('data: '+JSON.stringify({type:'response.completed',response:{status:'completed',model:'account-model',output:[{content:[{type:'output_text',text:'Connexion vérifiée.'}]}]}})+'\n\n'));
  };
  const probe=await f.request(`/api/ai/chatgpt/${profileId}/verify`,{method:'POST',cookie:f.teacher,body:{}});
  assert.equal(probe.r.status,200);assert.equal(probe.data.completed,true);assert.equal(calls,1);
  assert.equal((await f.client.list(f.actor))[0].state,'available');
 }finally{await f.close();}
});
