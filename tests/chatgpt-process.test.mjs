import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chatgptFixture} from './fixtures/chatgpt.mjs';
import {pedagogyFixture} from './fixtures/pedagogy.mjs';
import {credentialVault} from '../server/ai/vault.mjs';
import {qualityConfig} from '../server/pedagogy/provider.mjs';
import {enqueueGeneration,runGenerationStep} from '../server/pedagogy/jobs.mjs';

test('two separate processes refresh one connection exactly once under the filesystem lock',async()=>{
 const f=await chatgptFixture();try{
  const {profileId}=await f.connect();await credentialVault(f.directory).locked(async(data,save)=>{data.profiles[0].tokens.expiresAt=1;await save();});
  const run=async()=>{const child=spawn(process.execPath,['tests/fixtures/chatgpt-refresh.mjs',f.directory,profileId],{stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',chunk=>error+=chunk);const [code]=await once(child,'exit');assert.equal(code,0,error);};
  await Promise.all([run(),run()]);assert.equal(await readFile(join(f.directory,'refresh-count.txt'),'utf8'),'refresh\n');
 }finally{await f.close();}
});
test('SIGKILL during a provider operation leaves a durable uncertain job that is never blindly retried',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'tween-worker-')),path=join(dir,'jobs.sqlite'),marker=join(dir,'started'),{store,actor}=await pedagogyFixture({path});let child;
 try{
  const job=await enqueueGeneration(store,actor,{entryId:'box',intent:'Crash recovery'},{config:qualityConfig({OPENAI_MODEL:'gpt-5.4'}),simulation:true});await runGenerationStep(store);
  child=spawn(process.execPath,['--import','tsx','tests/fixtures/chatgpt-crash.mjs',path,marker],{stdio:'ignore'});
  let started=false;for(let i=0;i<100;i++){try{await access(marker);started=true;break;}catch{await new Promise(r=>setTimeout(r,50));}}assert.equal(started,true);
  const exit=once(child,'exit');child.kill('SIGKILL');await exit;child=null;
  const persisted=await store.get('generation_jobs',job.id);assert.equal(persisted.status,'running');assert.ok(persisted.inflight);persisted.leaseUntil='2000-01-01';await store.put('generation_jobs',persisted);
  let called=false;await runGenerationStep(store,{call:async()=>{called=true;}});const recovered=await store.get('generation_jobs',job.id);assert.equal(called,false);assert.equal(recovered.status,'blocked');assert.equal(recovered.recovery,'uncertain');
 }finally{child?.kill('SIGKILL');await store.close();await rm(dir,{recursive:true,force:true});}
});
