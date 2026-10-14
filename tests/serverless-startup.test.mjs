import test from 'node:test';
import assert from 'node:assert/strict';
import {Pool} from 'pg';
import {createServerlessHandler} from '../server/serverless.mjs';
import {openStore} from '../server/store.mjs';

const response=()=>({headers:{},setHeader(name,value){this.headers[name]=value;},end(body){this.body=JSON.parse(body);}});
const healthy=(_req,res)=>{res.statusCode=200;res.end(JSON.stringify({ok:true}));};

test('Neon quota failures are explicit, throttled, and recover on a later request',async()=>{
 let time=0,attempts=0;
 const logs=[];
 const handler=createServerlessHandler(async()=>{
  if(++attempts===1)throw Error('Your account or project has exceeded the quota. Upgrade your plan to increase limits.');
  return healthy;
 },{now:()=>time,logError:error=>logs.push(error)});
 const first=response();await handler({},first);
 assert.equal(first.statusCode,503);
 assert.equal(first.body.code,'DATABASE_QUOTA_EXCEEDED');
 assert.match(first.body.error,/quota/);
 assert.doesNotMatch(first.body.error,/configuration serveur|Upgrade/);
 assert.equal(first.headers['Retry-After'],'60');
 assert.equal(first.headers['Cache-Control'],'no-store');
 time=59000;
 const waiting=response();await handler({},waiting);
 assert.equal(waiting.statusCode,503);
 assert.equal(waiting.headers['Retry-After'],'1');
 assert.equal(attempts,1);
 assert.equal(logs.length,1);
 time=60000;
 const recovered=response();await handler({},recovered);
 assert.equal(recovered.statusCode,200);
 await handler({},response());
 assert.equal(attempts,2,'The recovered application stays cached.');
});

test('concurrent requests share one failed startup and one successful retry',async()=>{
 let reject,attempts=0,time=0;
 const handler=createServerlessHandler(()=>{
  attempts++;
  if(attempts===1)return new Promise((_resolve,fail)=>{reject=fail;});
  return healthy;
 },{now:()=>time,logError:()=>{}});
 const replies=Array.from({length:8},response),pending=replies.map(res=>handler({},res));
 await Promise.resolve();
 reject(Error('Your project has exceeded the compute time quota.'));
 await Promise.all(pending);
 assert.equal(attempts,1);
 assert.ok(replies.every(res=>res.statusCode===503&&res.body.code==='DATABASE_QUOTA_EXCEEDED'));
 time=60000;
 const recovered=Array.from({length:8},response);
 await Promise.all(recovered.map(res=>handler({},res)));
 assert.equal(attempts,2);
 assert.ok(recovered.every(res=>res.statusCode===200));
});

test('other initialization errors stay private and retry after a short cooldown',async()=>{
 let time=0,attempts=0;
 const handler=createServerlessHandler(()=>{
  if(++attempts===1)throw Error('Connection failed: postgresql://user:secret@private-host/db');
  return healthy;
 },{now:()=>time,logError:()=>{}});
 const failed=response();await handler({},failed);
 assert.equal(failed.statusCode,503);
 assert.equal(failed.body.code,'INITIALIZATION_FAILED');
 assert.doesNotMatch(JSON.stringify(failed.body),/secret|private-host/);
 assert.equal(failed.headers['Retry-After'],'5');
 time=5000;
 const recovered=response();await handler({},recovered);
 assert.equal(recovered.statusCode,200);
});

test('application errors do not reset or get reported as failed initialization',async()=>{
 let attempts=0;
 const handler=createServerlessHandler(()=>{attempts++;return ()=>{throw Error('Application error');};});
 await assert.rejects(handler({},response()),/Application error/);
 await assert.rejects(handler({},response()),/Application error/);
 assert.equal(attempts,1);
});

test('a rejected PostgreSQL startup closes its pool before propagating the error',async t=>{
 const failure=Error('Your account or project has exceeded the quota.');
 let pool;
 t.mock.method(Pool.prototype,'query',function(){pool=this;return Promise.reject(failure);});
 await assert.rejects(openStore({url:'postgresql://unused:unused@localhost/unused'}),error=>error===failure);
 assert.equal(pool.ended,true);
});
